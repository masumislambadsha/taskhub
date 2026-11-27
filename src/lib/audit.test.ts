import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import AuditLog from "@/models/AuditLog";
import Category from "@/models/Category";
import PaymentEvent from "@/models/PaymentEvent";
import Submission from "@/models/Submission";
import User from "@/models/User";
import Withdrawal from "@/models/Withdrawal";
import {
  coinsOf,
  createPayment,
  createPendingSubmission,
  createPreLedgerTask,
  createUser,
  startTestDb,
} from "@/lib/payments/test-utils";

const authMock = vi.hoisted(() => vi.fn());
const stripeMock = vi.hoisted(() => ({
  webhooks: { constructEvent: vi.fn() },
  checkout: { sessions: { retrieve: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/stripe", () => ({ getStripe: () => stripeMock }));

import { PATCH as withdrawalPatch } from "@/app/api/v1/withdrawals/[id]/approve/route";
import { PATCH as userPatch, DELETE as userDelete } from "@/app/api/v1/admin/users/[id]/route";
import { PATCH as taskPatch } from "@/app/api/v1/admin/tasks/route";
import { POST as categoryPost } from "@/app/api/v1/admin/categories/route";
import { PATCH as categoryPatch, DELETE as categoryDelete } from "@/app/api/v1/admin/categories/[id]/route";
import { POST as adminConfirm } from "@/app/api/v1/payments/admin-confirm/route";
import { POST as replayPost } from "@/app/api/v1/admin/payment-events/[id]/replay/route";
import { POST as ledgerOpen } from "@/app/api/v1/admin/ledger/open/route";
import { GET as auditGet } from "@/app/api/v1/admin/audit/route";
import { GET as auditExport } from "@/app/api/v1/admin/audit/export/route";
import { recordAudit, SYSTEM_AUDIT, clientIp } from "@/lib/audit";
import { inLedgerTransaction } from "@/lib/ledger/run";
import { adjustUserCoins } from "@/lib/ledger/flows/users";
import { autoApproveSubmission } from "@/lib/ledger/flows/auto-approve";
import { approveSubmission } from "@/lib/ledger/flows/submissions";
import { csvCell, toCsv } from "@/lib/csv";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_audit_test");
  await Category.init();
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await Category.deleteMany({});
  vi.clearAllMocks();
});

const ADMIN = "6b0000000000000000000a01";
const asAdmin = (role = "admin") =>
  authMock.mockResolvedValue({ user: { id: ADMIN, role } });
const ctx = (id: unknown) => ({ params: Promise.resolve({ id: String(id) }) });
const HEADERS = { "x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": "vitest-agent", "x-request-id": "req-123" };
const req = (path: string, method: string, body?: unknown) =>
  new NextRequest(`https://app.test${path}`, {
    method,
    headers: { "content-type": "application/json", ...HEADERS },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const entries = (filter = {}) => AuditLog.find(filter).sort("createdAt").lean();

async function mkUser(role: string, coins = 0) {
  return User.create({ name: role, email: `${role}-${Math.random()}@example.test`, role, coins });
}
async function mkWithdrawal(coins: number, workerCoins: number) {
  const worker = await mkUser("worker", workerCoins);
  const w = await Withdrawal.create({
    workerId: worker._id, workerName: "W", workerEmail: worker.email,
    coinRequested: coins, amount: coins / 20, paymentSystem: "bkash", accountNumber: "017",
  });
  return { worker, w };
}

describe("the audit log is append-only", () => {
  it("lives in audit_logs and refuses every update and delete", async () => {
    expect(AuditLog.collection.collectionName).toBe("audit_logs");
    await recordAudit(SYSTEM_AUDIT, { action: "test.entry", targetType: "t", targetId: "1" });
    const row = await AuditLog.findOne({});
    for (const run of [
      () => AuditLog.updateOne({ _id: row!._id }, { $set: { action: "x" } }),
      () => AuditLog.updateMany({}, { $set: { action: "x" } }),
      () => AuditLog.findOneAndUpdate({ _id: row!._id }, { $set: { action: "x" } }),
      () => AuditLog.replaceOne({ _id: row!._id }, { actorId: "a" }),
      () => AuditLog.deleteOne({ _id: row!._id }),
      () => AuditLog.deleteMany({}),
      () => AuditLog.findOneAndDelete({ _id: row!._id }),
    ]) {
      await expect(run()).rejects.toThrow(/append-only/);
    }
    row!.action = "changed";
    await expect((row as unknown as { save(): Promise<unknown> }).save()).rejects.toThrow(/append-only/);
    expect((await AuditLog.findOne({}))?.action).toBe("test.entry");
  });

  it("an entry written in a transaction that aborts does not exist", async () => {
    await expect(
      inLedgerTransaction(async (session) => {
        await recordAudit(SYSTEM_AUDIT, { action: "test.rolled_back", targetType: "t", targetId: "1" }, session);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await AuditLog.countDocuments()).toBe(0);
  });

  it("reads the client IP from the proxy header", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBeUndefined();
  });
});

describe("withdrawals", () => {
  it("approving writes one entry with who, from where, and what changed", async () => {
    asAdmin();
    const { worker, w } = await mkWithdrawal(200, 500);
    const res = await withdrawalPatch(req(`/api/v1/withdrawals/${w._id}/approve`, "PATCH", { action: "approve" }), ctx(w._id));
    expect(res.status).toBe(200);

    const log = await entries();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      actorId: ADMIN, actorRole: "admin", action: "withdrawal.approve",
      targetType: "withdrawal", targetId: String(w._id),
      before: { status: "pending" }, after: { status: "approved", coins: 200, workerId: String(worker._id) },
      ip: "203.0.113.7", userAgent: "vitest-agent", requestId: "req-123",
    });
    expect(log[0].createdAt).toBeInstanceOf(Date);
  });

  it("rejecting writes one entry with the reason", async () => {
    asAdmin();
    const { w } = await mkWithdrawal(200, 500);
    await withdrawalPatch(req(`/api/v1/withdrawals/${w._id}/approve`, "PATCH", { action: "reject", reason: "Wrong account number" }), ctx(w._id));
    const log = await entries();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: "withdrawal.reject", reason: "Wrong account number", after: { status: "rejected" } });
  });

  it("a refused approval changes nothing and writes nothing", async () => {
    asAdmin();
    const { w } = await mkWithdrawal(200, 10); // the worker cannot cover it
    const res = await withdrawalPatch(req(`/api/v1/withdrawals/${w._id}/approve`, "PATCH", { action: "approve" }), ctx(w._id));
    expect(res.status).toBe(400);
    expect(await AuditLog.countDocuments()).toBe(0);
    expect((await Withdrawal.findById(w._id))?.status).toBe("pending");
  });

  it("a second approval of the same withdrawal writes no second entry", async () => {
    asAdmin();
    const { w } = await mkWithdrawal(200, 500);
    await withdrawalPatch(req(`/api/v1/withdrawals/${w._id}/approve`, "PATCH", { action: "approve" }), ctx(w._id));
    const again = await withdrawalPatch(req(`/api/v1/withdrawals/${w._id}/approve`, "PATCH", { action: "approve" }), ctx(w._id));
    expect(again.status).toBe(404);
    expect(await AuditLog.countDocuments()).toBe(1);
  });

  it("the demo admin is refused and leaves no entry", async () => {
    asAdmin("demo_admin");
    const { w } = await mkWithdrawal(200, 500);
    const res = await withdrawalPatch(req(`/api/v1/withdrawals/${w._id}/approve`, "PATCH", { action: "approve" }), ctx(w._id));
    expect(res.status).toBe(403);
    expect(await AuditLog.countDocuments()).toBe(0);
  });
});

describe("users", () => {
  it("a role change writes one role_change entry", async () => {
    asAdmin();
    const u = await mkUser("worker");
    const res = await userPatch(req(`/api/v1/admin/users/${u._id}`, "PATCH", { role: "buyer" }), ctx(u._id));
    expect(res.status).toBe(200);
    const log = await entries();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: "user.role_change", targetType: "user", targetId: String(u._id), before: { role: "worker" }, after: { role: "buyer" } });
  });

  it("suspending and unsuspending are separate, named entries", async () => {
    asAdmin();
    const u = await mkUser("worker");
    await userPatch(req(`/api/v1/admin/users/${u._id}`, "PATCH", { status: "suspended" }), ctx(u._id));
    await userPatch(req(`/api/v1/admin/users/${u._id}`, "PATCH", { status: "active" }), ctx(u._id));
    expect((await entries()).map((e) => e.action)).toEqual(["user.suspend", "user.unsuspend"]);
  });

  it("changing role and status together writes two entries", async () => {
    asAdmin();
    const u = await mkUser("worker");
    await userPatch(req(`/api/v1/admin/users/${u._id}`, "PATCH", { role: "buyer", status: "suspended" }), ctx(u._id));
    expect((await entries()).map((e) => e.action).sort()).toEqual(["user.role_change", "user.suspend"]);
  });

  it("a change that changes nothing, or fails, writes nothing", async () => {
    asAdmin();
    const u = await mkUser("worker");
    await userPatch(req(`/api/v1/admin/users/${u._id}`, "PATCH", { role: "worker" }), ctx(u._id));
    expect((await userPatch(req(`/api/v1/admin/users/${u._id}`, "PATCH", { role: "nonsense" }), ctx(u._id))).status).toBe(400);
    expect((await userPatch(req(`/api/v1/admin/users/${new mongoose.Types.ObjectId()}`, "PATCH", { role: "buyer" }), ctx(new mongoose.Types.ObjectId()))).status).toBe(404);
    expect(await AuditLog.countDocuments()).toBe(0);
  });

  it("deleting a user writes one entry with what they held", async () => {
    asAdmin();
    const u = await mkUser("worker", 40);
    const res = await userDelete(req(`/api/v1/admin/users/${u._id}`, "DELETE"), ctx(u._id));
    expect(res.status).toBe(200);
    const log = await entries();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: "user.delete", targetId: String(u._id), before: { role: "worker", coins: 40 }, after: { forfeited: 40 } });
  });
});

describe("tasks, categories, payments and the ledger", () => {
  it("an admin task status change writes one entry", async () => {
    asAdmin();
    const buyer = await createUser(0);
    const task = await createPreLedgerTask(buyer._id);
    const res = await taskPatch(req("/api/v1/admin/tasks", "PATCH", { id: String(task._id), status: "blocked" }));
    expect(res.status).toBe(200);
    const log = await entries();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: "task.status_change", targetType: "task", before: { status: "open" }, after: { status: "blocked" } });
    // The same status again changes nothing, so adds nothing.
    await taskPatch(req("/api/v1/admin/tasks", "PATCH", { id: String(task._id), status: "blocked" }));
    expect(await AuditLog.countDocuments()).toBe(1);
  });

  it("category create, update and delete each write one entry", async () => {
    asAdmin();
    const created = await categoryPost(req("/api/v1/admin/categories", "POST", { name: "Surveys", icon: "poll" }));
    const { category } = await created.json();
    await categoryPatch(req(`/api/v1/admin/categories/${category._id}`, "PATCH", { name: "Quick Surveys", icon: "poll" }), ctx(category._id));
    await categoryDelete(req(`/api/v1/admin/categories/${category._id}`, "DELETE"), ctx(category._id));

    const log = await entries();
    expect(log.map((e) => e.action)).toEqual(["category.create", "category.update", "category.delete"]);
    expect(log[1]).toMatchObject({ before: { name: "Surveys" }, after: { name: "Quick Surveys" } });
    expect(log.every((e) => e.targetId === category._id)).toBe(true);
  });

  it("manually confirming a payment writes one entry, and a repeat writes none", async () => {
    asAdmin();
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "bkash", price: 10 });
    const first = await adminConfirm(req("/api/v1/payments/admin-confirm", "POST", { paymentId: String(payment._id) }), undefined);
    expect(first.status).toBe(200);
    const second = await adminConfirm(req("/api/v1/payments/admin-confirm", "POST", { paymentId: String(payment._id) }), undefined);
    expect(second.status).toBe(404);

    const log = await entries();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: "payment.admin_confirm", targetId: String(payment._id), after: { status: "success", coins: 150 } });
    expect(await coinsOf(user._id)).toBe(150);
  });

  it("replaying a payment event writes one entry", async () => {
    asAdmin();
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe", price: 10 });
    const row = await PaymentEvent.create({
      provider: "stripe", eventId: "evt_1", type: "checkout.session.completed",
      payload: { id: "cs_1", payment_status: "paid", amount_total: 1000, currency: "usd", metadata: { paymentId: String(payment._id) } },
    });
    const res = await replayPost(req(`/api/v1/admin/payment-events/${row._id}/replay`, "POST"), ctx(row._id));
    expect(res.status).toBe(200);
    const log = await entries();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: "payment.event_replay", targetType: "payment_event", targetId: String(row._id), after: { outcome: "credited", ok: true } });
  });

  it("opening the ledger is logged for a real run and not for a dry run", async () => {
    asAdmin();
    await createUser(5);
    await ledgerOpen(req("/api/v1/admin/ledger/open", "POST"), undefined);
    expect(await AuditLog.countDocuments()).toBe(0);
    const res = await ledgerOpen(req("/api/v1/admin/ledger/open?apply=1", "POST"), undefined);
    expect(res.status).toBe(200);
    const log = await entries();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: "ledger.open", targetType: "ledger" });
  });
});

describe("system and manual-coin actions", () => {
  it("an automatic approval is logged as the system; a buyer's approval is not", async () => {
    const buyer = await createUser(0);
    const task = await createPreLedgerTask(buyer._id, { requiredWorkers: 3, filledWorkers: 0, payableAmount: 10 });
    const a = await createPendingSubmission(task, (await createUser(0))._id);
    const b = await createPendingSubmission(task, (await createUser(0))._id);
    await Submission.updateMany({}, { $set: { autoApproveAt: new Date(Date.now() - 1000) } });

    await autoApproveSubmission(String(a._id));
    await approveSubmission({ submissionId: String(b._id), buyerId: String(buyer._id) });
    await autoApproveSubmission(String(a._id)); // already decided

    const log = await entries();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      actorId: "system", actorRole: "system", action: "submission.auto_approve",
      targetType: "submission", targetId: String(a._id), after: { status: "approved", coins: 10 },
    });
  });

  it("a manual coin adjustment writes one entry, and a replayed request none", async () => {
    const user = await createUser(0);
    const audit = { actorId: ADMIN, actorRole: "admin" };
    const args = { userId: String(user._id), delta: 50, adminId: ADMIN, requestId: "adj-1", reason: "Goodwill", audit };
    await adjustUserCoins(args);
    await adjustUserCoins(args);
    expect(await coinsOf(user._id)).toBe(50);
    const log = await entries();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: "coins.adjust", targetId: String(user._id), after: { delta: 50 }, reason: "Goodwill" });
  });

  it("an adjustment the ledger refuses writes no entry", async () => {
    const user = await createUser(10);
    const res = await adjustUserCoins({ userId: String(user._id), delta: -500, adminId: ADMIN, requestId: "adj-2", audit: { actorId: ADMIN, actorRole: "admin" } });
    expect(res.ok).toBe(false);
    expect(await AuditLog.countDocuments()).toBe(0);
  });
});

describe("reading the log", () => {
  async function seed() {
    const base = Date.UTC(2026, 10, 1);
    const rows = [
      { actorId: "a1", action: "withdrawal.approve", targetType: "withdrawal", targetId: "w1", createdAt: new Date(base) },
      { actorId: "a1", action: "withdrawal.reject", targetType: "withdrawal", targetId: "w2", createdAt: new Date(base + 86_400_000) },
      { actorId: "a2", action: "user.suspend", targetType: "user", targetId: "u1", createdAt: new Date(base + 2 * 86_400_000) },
    ];
    for (const r of rows) await AuditLog.create({ actorRole: "admin", ...r });
  }
  const get = (qs = "") => auditGet(new NextRequest(`https://app.test/api/v1/admin/audit${qs}`));
  const ids = async (res: Response) => ((await res.json()).entries as { targetId: string }[]).map((e) => e.targetId);

  it("is for admins only", async () => {
    await seed();
    asAdmin("demo_admin");
    expect((await get()).status).toBe(403);
    expect((await auditExport(new NextRequest("https://app.test/x"))).status).toBe(403);
    authMock.mockResolvedValue({ user: { id: "b", role: "buyer" } });
    expect((await get()).status).toBe(401);
    authMock.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
  });

  it("lists newest first and filters by actor, action, target and date", async () => {
    await seed();
    asAdmin();
    expect(await ids(await get())).toEqual(["u1", "w2", "w1"]);
    expect(await ids(await get("?actor=a2"))).toEqual(["u1"]);
    expect(await ids(await get("?action=withdrawal"))).toEqual(["w2", "w1"]);
    expect(await ids(await get("?action=withdrawal.reject"))).toEqual(["w2"]);
    expect(await ids(await get("?target=w1"))).toEqual(["w1"]);
    expect(await ids(await get("?targetType=user"))).toEqual(["u1"]);
    expect(await ids(await get("?from=2026-11-02&to=2026-11-02"))).toEqual(["w2"]);
    expect(await ids(await get("?from=garbage"))).toEqual(["u1", "w2", "w1"]);
  });

  it("exports the filtered rows as CSV", async () => {
    await seed();
    asAdmin();
    const res = await auditExport(new NextRequest("https://app.test/api/v1/admin/audit/export?action=withdrawal"));
    expect(res.headers.get("content-type")).toContain("text/csv");
    const lines = (await res.text()).trim().split("\r\n");
    expect(lines[0]).toBe("time,actor,role,action,target_type,target_id,before,after,reason,ip,request_id");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("withdrawal.reject");
  });
});

describe("csv", () => {
  it("quotes and escapes, and defuses spreadsheet formulas", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('a,b "c"')).toBe('"a,b ""c"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell(null)).toBe("");
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
    expect(csvCell(new Date(0))).toBe("1970-01-01T00:00:00.000Z");
    expect(toCsv([{ n: 1 }], [{ header: "n", value: (r) => r.n }])).toBe("n\r\n1\r\n");
  });
});

