import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import AuditLog from "@/models/AuditLog";
import Dispute from "@/models/Dispute";
import MfaCredential from "@/models/MfaCredential";
import MfaSession from "@/models/MfaSession";
import Notification from "@/models/Notification";
import Submission from "@/models/Submission";
import User from "@/models/User";
import { coinsOf, createPendingSubmission, createUser, startTestDb, taskInput } from "@/lib/payments/test-utils";
import { createFundedTask } from "@/lib/ledger/flows/tasks";
import { rejectSubmission } from "@/lib/ledger/flows/submissions";
import { beginEnrollment, confirmEnrollment } from "@/lib/mfa";
import { currentStep, totpForStep } from "@/lib/totp";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/queue/auto-approve-queue", () => ({
  scheduleDisputeWindow: vi.fn(async () => true),
  cancelDisputeWindow: vi.fn(async () => undefined),
  scheduleAutoApprove: vi.fn(async () => true),
  cancelAutoApprove: vi.fn(async () => undefined),
}));

import { GET as disputesGet, POST as disputesPost } from "@/app/api/v1/disputes/route";
import { POST as replyPost } from "@/app/api/v1/disputes/[id]/buyer-statement/route";
import { POST as withdrawPost } from "@/app/api/v1/disputes/[id]/withdraw/route";
import { GET as adminList } from "@/app/api/v1/admin/disputes/route";
import { GET as adminDetail } from "@/app/api/v1/admin/disputes/[id]/route";
import { POST as claimPost } from "@/app/api/v1/admin/disputes/[id]/claim/route";
import { POST as decidePost } from "@/app/api/v1/admin/disputes/[id]/decide/route";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_dispute_api_test");
  await Promise.all([Dispute.init(), MfaCredential.init(), MfaSession.init()]);
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await Promise.all([Dispute.deleteMany({}), Notification.deleteMany({}), MfaCredential.deleteMany({}), MfaSession.deleteMany({})]);
  vi.clearAllMocks();
  process.env.DISPUTE_WINDOW_MS = String(3 * 24 * 3600 * 1000);
});
afterEach(() => {
  process.env.DISPUTE_WINDOW_MS = "0";
  process.env.MFA_ENFORCED = "false";
});

const STATEMENT = "I did exactly what the task asked and attached the proof it required.";
const as = (u: { _id: unknown } | null, role: string, sid?: string) =>
  authMock.mockResolvedValue(u ? { user: { id: String(u._id), role, name: "N", email: "n@example.test", sid } } : null);
const ctx = (id: unknown) => ({ params: Promise.resolve({ id: String(id) }) });
const req = (path: string, body?: unknown) =>
  new NextRequest(`https://app.test${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const appealReq = (submissionId: unknown, over = {}) =>
  disputesPost(req("/api/v1/disputes", { submissionId: String(submissionId), statement: STATEMENT, ...over }), undefined);

async function world() {
  const buyer = await User.create({ name: "Buyer", email: "buyer@example.test", role: "buyer", coins: 200 });
  const created = await createFundedTask({
    buyerId: String(buyer._id), buyerName: "Buyer", buyerEmail: buyer.email,
    data: taskInput({ requiredWorkers: 3, payableAmount: 10 }),
  });
  if (!created.ok) throw new Error("setup");
  const worker = await User.create({ name: "Worker", email: "worker@example.test", role: "worker", coins: 0 });
  const sub = await createPendingSubmission(created.task, worker._id);
  await rejectSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id), reason: "Not right" });
  return { buyer, worker, task: created.task, sub };
}

describe("worker appeals", () => {
  it("creates a dispute, notifies the buyer, and refuses a repeat", async () => {
    const { worker, buyer, sub } = await world();
    as(worker, "worker");
    const res = await appealReq(sub._id, { evidence: ["https://i.ibb.co/x.png"] });
    expect(res.status).toBe(201);
    expect((await res.json()).status).toBe("open");
    const note = await Notification.findOne({ toUserId: buyer._id });
    expect(note?.actionRoute).toBe("/buyer/disputes");
    expect((await appealReq(sub._id)).status).toBe(409);
  });

  it("validates input and permissions", async () => {
    const { worker, buyer, sub } = await world();
    as(worker, "worker");
    expect((await appealReq(sub._id, { statement: "short" })).status).toBe(400);
    expect((await appealReq(sub._id, { evidence: ["javascript:x"] })).status).toBe(400);
    expect((await disputesPost(req("/api/v1/disputes", { statement: STATEMENT }), undefined)).status).toBe(400);
    expect((await appealReq("nope")).status).toBe(404);
    as(buyer, "buyer");
    expect((await appealReq(sub._id)).status).toBe(401);
    as({ _id: "6b0000000000000000000a01" }, "demo_admin");
    expect((await appealReq(sub._id)).status).toBe(403);
    as(null, "worker");
    expect((await appealReq(sub._id)).status).toBe(401);
    expect(await Dispute.countDocuments()).toBe(0);
  });

  it("an Idempotency-Key makes a double submit one appeal", async () => {
    const { worker, sub } = await world();
    as(worker, "worker");
    const make = () =>
      disputesPost(
        new NextRequest("https://app.test/api/v1/disputes", {
          method: "POST",
          headers: { "content-type": "application/json", "Idempotency-Key": "appeal-key-00001" },
          body: JSON.stringify({ submissionId: String(sub._id), statement: STATEMENT }),
        }),
        undefined,
      );
    const results = await Promise.all([make(), make(), make()]);
    expect(await Dispute.countDocuments()).toBe(1);
    expect(results.filter((r) => r.status === 201).length).toBeGreaterThanOrEqual(1);
  });

  it("the worker can withdraw it", async () => {
    const { worker, sub } = await world();
    as(worker, "worker");
    const d = await (await appealReq(sub._id)).json();
    const res = await withdrawPost(req(`/api/v1/disputes/${d._id}/withdraw`, {}), ctx(d._id));
    expect(res.status).toBe(200);
    expect((await Dispute.findById(d._id))?.status).toBe("withdrawn");
    expect((await withdrawPost(req(`/api/v1/disputes/${d._id}/withdraw`, {}), ctx(d._id))).status).toBe(404);
  });
});

describe("listing and the buyer's reply", () => {
  it("each side sees only their own disputes", async () => {
    const { worker, buyer, sub } = await world();
    as(worker, "worker");
    await appealReq(sub._id);
    const mine = await (await disputesGet()).json();
    expect(mine.disputes).toHaveLength(1);
    expect(mine.disputes[0].submission.taskTitle).toBeDefined();
    as(buyer, "buyer");
    expect((await (await disputesGet()).json()).disputes).toHaveLength(1);
    const stranger = await createUser(0);
    as(stranger, "worker");
    expect((await (await disputesGet()).json()).disputes).toHaveLength(0);
    as({ _id: "6b0000000000000000000a01" }, "admin");
    expect((await disputesGet()).status).toBe(401);
  });

  it("the buyer replies once; nobody else can", async () => {
    const { worker, buyer, sub } = await world();
    as(worker, "worker");
    const d = await (await appealReq(sub._id)).json();
    const reply = () => replyPost(req(`/api/v1/disputes/${d._id}/buyer-statement`, { statement: STATEMENT }), ctx(d._id));
    as(worker, "worker");
    expect((await reply()).status).toBe(401);
    as(buyer, "buyer");
    expect((await replyPost(req(`/api/v1/disputes/${d._id}/buyer-statement`, { statement: "short" }), ctx(d._id))).status).toBe(400);
    expect((await reply()).status).toBe(200);
    expect((await reply()).status).toBe(409);
    expect((await Dispute.findById(d._id))?.buyerStatement).toBe(STATEMENT);
  });
});

describe("the admin side", () => {
  const decide = (id: unknown, body: unknown) => decidePost(req(`/api/v1/admin/disputes/${id}/decide`, body), ctx(id));

  async function appealed() {
    const w = await world();
    as(w.worker, "worker");
    const d = await (await appealReq(w.sub._id)).json();
    return { ...w, dispute: d };
  }

  it("lists the queue oldest first with the age and an overdue flag, and shows the whole case", async () => {
    const { dispute, worker } = await appealed();
    // createdAt is immutable through the model, so age it with a raw update.
    await Dispute.collection.updateOne({ _id: new mongoose.Types.ObjectId(dispute._id) }, { $set: { createdAt: new Date(Date.now() - 50 * 3_600_000) } });
    as({ _id: "6b0000000000000000000a01" }, "admin");
    const list = await (await adminList(req("/api/v1/admin/disputes"))).json();
    expect(list.disputes).toHaveLength(1);
    expect(list.disputes[0]).toMatchObject({ overdue: true, ageHours: 50 });
    expect(list.disputes[0].submission.workerName).toBeDefined();

    const detail = await (await adminDetail(req(`/api/v1/admin/disputes/${dispute._id}`), ctx(dispute._id))).json();
    expect(detail.task.title).toBeDefined();
    expect(detail.submission.rejectionReason).toBe("Not right");
    expect(detail.dispute.workerStatement).toBe(STATEMENT);
    expect(detail.worker.history.submissions).toBe(1);
    expect(detail.buyer.history.rejected).toBe(1);
    expect(JSON.stringify(detail)).not.toContain("@example.test");
    void worker;
  });

  it("the demo admin may read the queue but not claim or decide; others get 401", async () => {
    const { dispute, worker } = await appealed();
    as({ _id: "6b0000000000000000000a02" }, "demo_admin");
    expect((await adminList(req("/api/v1/admin/disputes"))).status).toBe(200);
    expect((await claimPost(req("/x", {}), ctx(dispute._id))).status).toBe(403);
    expect((await decide(dispute._id, { winner: "worker", note: "Looked at it carefully" })).status).toBe(403);
    as(worker, "worker");
    expect((await adminList(req("/api/v1/admin/disputes"))).status).toBe(401);
    expect((await decide(dispute._id, { winner: "worker", note: "Looked at it carefully" })).status).toBe(401);
    expect((await Dispute.findById(dispute._id))?.status).toBe("open");
  });

  it("claims, then decides for the worker: paid, audited and both people told", async () => {
    const { dispute, worker, buyer } = await appealed();
    as({ _id: "6b0000000000000000000a01" }, "admin");
    expect((await claimPost(req("/x", {}), ctx(dispute._id))).status).toBe(200);
    expect((await claimPost(req("/x", {}), ctx(dispute._id))).status).toBe(404);

    const res = await decide(dispute._id, { winner: "worker", note: "The proof matches the task" });
    expect(res.status).toBe(200);
    expect(await coinsOf(worker._id)).toBe(10);
    expect((await Submission.findOne({}))?.status).toBe("approved");
    expect(await AuditLog.countDocuments({ action: "dispute.decide" })).toBe(1);
    const notified = (await Notification.find({ message: /decided the dispute/ }).lean()).map((n) => String(n.toUserId)).sort();
    expect(notified).toEqual([String(worker._id), String(buyer._id)].sort());
    expect((await decide(dispute._id, { winner: "buyer", note: "Changed my mind about it" })).status).toBe(404);
    expect(await coinsOf(worker._id)).toBe(10);
  });

  it("validates the decision", async () => {
    const { dispute } = await appealed();
    as({ _id: "6b0000000000000000000a01" }, "admin");
    expect((await decide(dispute._id, { winner: "nobody", note: "A fine long note here" })).status).toBe(400);
    expect((await decide(dispute._id, { winner: "buyer" })).status).toBe(400);
    expect((await decide(dispute._id, { winner: "buyer", note: "short" })).status).toBe(400);
    expect((await adminDetail(req("/x"), ctx("nope"))).status).toBe(404);
    expect((await Dispute.findById(dispute._id))?.status).toBe("open");
  });

  it("with two-factor on, deciding needs a verified login and a fresh code", async () => {
    process.env.MFA_ENFORCED = "true";
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64");
    const { dispute } = await appealed();
    const admin = await User.create({ name: "a", email: "a@example.test", role: "admin" });
    const begun = await beginEnrollment(String(admin._id), "a");
    if (!begun.ok) throw new Error();
    await confirmEnrollment(String(admin._id), "S1", totpForStep(begun.manualKey, currentStep()));

    as(admin, "admin", "other-login");
    const unverified = await decide(dispute._id, { winner: "buyer", note: "A fine long note here" });
    expect(unverified.status).toBe(403);
    expect((await unverified.json()).code).toBe("MFA_REQUIRED");

    as(admin, "admin", "S1");
    await MfaSession.updateOne({ userId: String(admin._id), sid: "S1" }, { $set: { stepUpAt: new Date(Date.now() - 20 * 60_000) } });
    const stale = await decide(dispute._id, { winner: "buyer", note: "A fine long note here" });
    expect((await stale.json()).code).toBe("STEP_UP_REQUIRED");
    expect((await Dispute.findById(dispute._id))?.status).toBe("open");

    await MfaSession.updateOne({ userId: String(admin._id), sid: "S1" }, { $set: { stepUpAt: new Date() } });
    expect((await decide(dispute._id, { winner: "buyer", note: "A fine long note here" })).status).toBe(200);
  });
});
