import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import AuditLog from "@/models/AuditLog";
import LedgerAccount from "@/models/LedgerAccount";
import Notification from "@/models/Notification";
import PayoutAccount from "@/models/PayoutAccount";
import User from "@/models/User";
import Withdrawal from "@/models/Withdrawal";
import { startTestDb } from "@/lib/payments/test-utils";
import { resetRateLimits } from "@/lib/rate-limit-memory";

const authMock = vi.hoisted(() => vi.fn());
const emailMock = vi.hoisted(() => ({ sendWithdrawalConfirmationEmail: vi.fn(async () => undefined) }));
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/email", () => emailMock);

import { GET as listGet, POST as requestPost } from "@/app/api/v1/withdrawals/route";
import { POST as confirmPost } from "@/app/api/v1/withdrawals/[id]/confirm/route";
import { POST as resendPost } from "@/app/api/v1/withdrawals/[id]/resend/route";
import { POST as cancelPost } from "@/app/api/v1/withdrawals/[id]/cancel/route";
import { PATCH as decidePatch } from "@/app/api/v1/withdrawals/[id]/approve/route";
import { POST as payPost } from "@/app/api/v1/withdrawals/[id]/pay/route";
import { reconcile } from "@/lib/ledger/reconcile";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_withdrawal_api_test");
  await PayoutAccount.init();
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await Promise.all([Withdrawal.deleteMany({}), PayoutAccount.deleteMany({}), Notification.deleteMany({})]);
  resetRateLimits();
  vi.clearAllMocks();
  emailMock.sendWithdrawalConfirmationEmail.mockResolvedValue(undefined);
  process.env.NEXTAUTH_URL = "https://app.test";
});
afterEach(() => {
  delete process.env.NEXTAUTH_URL;
});

const ADMIN = "6b0000000000000000000a01";
const as = (u: { _id: unknown; email?: string } | null, role: string) =>
  authMock.mockResolvedValue(u ? { user: { id: String(u._id), role, name: "Worker", email: u.email ?? "w@example.test" } } : null);
const ctx = (id: unknown) => ({ params: Promise.resolve({ id: String(id) }) });
const post = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`https://app.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const patch = (path: string, body: unknown) =>
  new NextRequest(`https://app.test${path}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const BODY = { coinRequested: 200, paymentSystem: "bkash", accountNumber: "01700000000" };
const requestIt = (body: unknown = BODY, headers: Record<string, string> = {}) =>
  requestPost(post("/api/v1/withdrawals", body, headers), undefined);

async function worker(coins = 1000) {
  const u = await User.create({ name: "Worker", email: `w${Math.random()}@example.test`, role: "worker", coins });
  as(u, "worker");
  return u;
}
const payouts = async () => (await LedgerAccount.findById("system:payouts_pending"))?.balance ?? 0;
/** The token from the email link that was "sent". */
const sentToken = () => {
  const [, url] = emailMock.sendWithdrawalConfirmationEmail.mock.calls.at(-1) as unknown as [string, string];
  return new URL(url).searchParams.get("token")!;
};

describe("requesting a withdrawal", () => {
  it("reserves the coins, emails a link, and never shows the worker the token hash or the risk assessment", async () => {
    const w = await worker(500);
    const res = await requestIt();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ status: "awaiting_confirmation", coinRequested: 200, emailed: true });
    for (const hidden of ["confirmTokenHash", "riskScore", "riskFlags"]) expect(body).not.toHaveProperty(hidden);

    expect(emailMock.sendWithdrawalConfirmationEmail).toHaveBeenCalledTimes(1);
    const [to, url, details] = emailMock.sendWithdrawalConfirmationEmail.mock.calls[0] as unknown as [string, string, { coins: number }];
    expect(to).toBe(w.email);
    expect(url).toContain(`https://app.test/worker/withdrawals/confirm?id=${body._id}&token=`);
    expect(details.coins).toBe(200);
    expect(JSON.stringify(body)).not.toContain(sentToken());
    expect((await User.findById(w._id))?.coins).toBe(300);
    expect(await payouts()).toBe(200);
  });

  it("still creates the request when the email cannot be sent, and says so", async () => {
    await worker();
    emailMock.sendWithdrawalConfirmationEmail.mockRejectedValueOnce(new Error("resend down"));
    const res = await requestIt();
    expect(res.status).toBe(201);
    expect((await res.json()).emailed).toBe(false);
    expect(await Withdrawal.countDocuments()).toBe(1);
  });

  it("validates and enforces the limits with clear errors, changing nothing", async () => {
    await worker(100_000);
    expect((await requestIt({ ...BODY, coinRequested: 100 })).status).toBe(400);
    expect((await requestIt({ ...BODY, paymentSystem: "" })).status).toBe(400);
    expect((await requestIt({ ...BODY, coinRequested: 5000 })).status).toBe(422);
    const poor = await worker(150);
    void poor;
    expect((await requestIt()).status).toBe(400);
    expect(await Withdrawal.countDocuments()).toBe(0);
    expect(await payouts()).toBe(0);
  });

  it("is for signed-in workers only", async () => {
    const w = await worker();
    as(w, "buyer");
    expect((await requestIt()).status).toBe(401);
    as(null, "worker");
    expect((await requestIt()).status).toBe(401);
    as(w, "demo_admin");
    expect((await requestIt()).status).toBe(401);
  });

  it("an Idempotency-Key makes simultaneous double-clicks one request", async () => {
    await worker(1000);
    const results = await Promise.all(Array.from({ length: 5 }, () => requestIt(BODY, { "Idempotency-Key": "withdraw-key-0001" })));
    expect(await Withdrawal.countDocuments()).toBe(1);
    expect(await payouts()).toBe(200);
    expect(results.every((r) => [201, 409].includes(r.status))).toBe(true);
  });
});

describe("confirming, resending and cancelling", () => {
  it("the emailed token confirms the request and sends it to the admin queue", async () => {
    await worker();
    const { _id } = await (await requestIt()).json();
    const res = await confirmPost(post(`/api/v1/withdrawals/${_id}/confirm`, { token: sentToken() }), ctx(_id));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("pending");
    expect(await Notification.countDocuments({ message: /confirmed and waiting for review/ })).toBe(1);
    expect((await confirmPost(post(`/api/v1/withdrawals/${_id}/confirm`, { token: sentToken() }), ctx(_id))).status).toBe(404);
  });

  it("rejects a wrong token, a missing token, an expired link, and another worker", async () => {
    await worker();
    const { _id } = await (await requestIt()).json();
    expect((await confirmPost(post("/x", { token: "wrong" }), ctx(_id))).status).toBe(400);
    expect((await confirmPost(post("/x", {}), ctx(_id))).status).toBe(400);
    const token = sentToken();
    await Withdrawal.updateOne({ _id }, { $set: { confirmExpiresAt: new Date(Date.now() - 1000) } });
    expect((await confirmPost(post("/x", { token }), ctx(_id))).status).toBe(410);
    const other = await worker();
    void other;
    expect((await confirmPost(post("/x", { token }), ctx(_id))).status).toBe(404);
    expect((await Withdrawal.findById(_id))?.status).toBe("awaiting_confirmation");
  });

  it("a resent link replaces the old one, and resending is rate limited", async () => {
    await worker();
    const { _id } = await (await requestIt()).json();
    const first = sentToken();
    expect((await resendPost(post("/x"), ctx(_id))).status).toBe(200);
    const second = sentToken();
    expect(second).not.toBe(first);
    expect((await confirmPost(post("/x", { token: first }), ctx(_id))).status).toBe(400);
    expect((await resendPost(post("/x"), ctx(_id))).status).toBe(200);
    expect((await resendPost(post("/x"), ctx(_id))).status).toBe(200);
    const limited = await resendPost(post("/x"), ctx(_id));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("the worker can cancel and gets the coins back; a demo admin and a stranger cannot", async () => {
    const w = await worker(500);
    const { _id } = await (await requestIt()).json();
    as(await worker(), "worker");
    expect((await cancelPost(post("/x"), ctx(_id))).status).toBe(404);
    as({ _id: ADMIN }, "demo_admin");
    expect((await cancelPost(post("/x"), ctx(_id))).status).toBe(403);
    as(w, "worker");
    const res = await cancelPost(post("/x"), ctx(_id));
    expect(res.status).toBe(200);
    expect((await User.findById(w._id))?.coins).toBe(500);
    expect(await payouts()).toBe(0);
    expect((await cancelPost(post("/x"), ctx(_id))).status).toBe(404);
  });
});

describe("the lists", () => {
  async function seedQueue() {
    const old = await worker(1000);
    await User.collection.updateOne({ _id: old._id }, { $set: { createdAt: new Date(Date.now() - 90 * 86_400_000) } });
    const young = await worker(1000);
    const calm = await (await requestIt({ ...BODY, accountNumber: "01711111111" })).json();
    as(young, "worker");
    const risky = await (await requestIt({ ...BODY, accountNumber: "01722222222" })).json();
    for (const w of [calm, risky]) {
      await Withdrawal.updateOne({ _id: w._id }, { $set: { status: "pending" }, $unset: { confirmTokenHash: "" } });
    }
    return { calm, risky };
  }

  it("a worker sees only their own, without risk data or the token hash", async () => {
    await seedQueue();
    const me = await worker();
    await requestIt({ ...BODY, accountNumber: "01733333333" });
    const body = await (await listGet(new NextRequest("https://app.test/api/v1/withdrawals"))).json();
    expect(body.withdrawals).toHaveLength(1);
    for (const hidden of ["confirmTokenHash", "riskScore", "riskFlags"]) expect(body.withdrawals[0]).not.toHaveProperty(hidden);
    void me;
  });

  it("an admin sees everyone's with the reasons, riskiest first when asked, and can filter by status", async () => {
    const { calm, risky } = await seedQueue();
    as({ _id: ADMIN }, "admin");
    const byRisk = await (await listGet(new NextRequest("https://app.test/api/v1/withdrawals?sort=risk&status=pending"))).json();
    expect(byRisk.withdrawals.map((w: { _id: string }) => w._id)).toEqual([risky._id, calm._id]);
    expect(byRisk.withdrawals[0].riskScore).toBeGreaterThan(byRisk.withdrawals[1].riskScore);
    expect(byRisk.withdrawals[0].riskFlags.map((f: { code: string }) => f.code)).toContain("new_account");
    expect(byRisk.withdrawals[0]).not.toHaveProperty("confirmTokenHash");

    const none = await (await listGet(new NextRequest("https://app.test/api/v1/withdrawals?status=paid"))).json();
    expect(none.withdrawals).toHaveLength(0);
  });
});

describe("the admin's side through the routes", () => {
  async function confirmedRequest(coins = 200) {
    const w = await worker(1000);
    const { _id } = await (await requestIt({ ...BODY, coinRequested: coins })).json();
    await confirmPost(post("/x", { token: sentToken() }), ctx(_id));
    as({ _id: ADMIN }, "admin");
    return { w, id: String(_id) };
  }
  const decide = (id: string, body: unknown) => decidePatch(patch(`/api/v1/withdrawals/${id}/approve`, body), ctx(id));
  const pay = (id: string, body: unknown) => payPost(post(`/api/v1/withdrawals/${id}/pay`, body), ctx(id));

  it("approve, then pay with the transaction ID: coins retire once, audited, worker told at each step", async () => {
    const { w, id } = await confirmedRequest();
    expect((await decide(id, { action: "approve" })).status).toBe(200);
    expect((await Withdrawal.findById(id))?.status).toBe("approved");
    expect(await payouts()).toBe(200);

    expect((await pay(id, {})).status).toBe(400);
    expect((await pay(id, { transactionId: "" })).status).toBe(400);
    const paid = await pay(id, { transactionId: "BKASH-ABC-123" });
    expect(paid.status).toBe(200);
    expect((await paid.json()).externalTransactionId).toBe("BKASH-ABC-123");
    expect(await payouts()).toBe(0);
    expect((await User.findById(w._id))?.coins).toBe(800);
    expect((await pay(id, { transactionId: "BKASH-ABC-123" })).status).toBe(404);

    expect((await AuditLog.find({ action: { $in: ["withdrawal.approve", "withdrawal.paid"] } }).sort("createdAt").lean()).map((e) => e.action)).toEqual(["withdrawal.approve", "withdrawal.paid"]);
    const msgs = (await Notification.find({}).lean()).map((n) => n.message);
    expect(msgs.some((m) => /approved/.test(m))).toBe(true);
    expect(msgs.some((m) => /was paid.*BKASH-ABC-123/.test(m))).toBe(true);
    expect((await reconcile()).ok).toBe(true);
  });

  it("rejecting needs a reason and returns the coins", async () => {
    const { w, id } = await confirmedRequest(300);
    expect((await decide(id, { action: "reject" })).status).toBe(400);
    expect((await decide(id, { action: "reject", reason: "no" })).status).toBe(400);
    expect((await Withdrawal.findById(id))?.status).toBe("pending");
    const res = await decide(id, { action: "reject", reason: "Account number is wrong" });
    expect(res.status).toBe(200);
    expect((await User.findById(w._id))?.coins).toBe(1000);
    expect(await Notification.countDocuments({ message: /rejected and the coins were returned/ })).toBe(1);
    expect((await AuditLog.findOne({ action: "withdrawal.reject" }))?.reason).toBe("Account number is wrong");
  });

  it("an unconfirmed request cannot be approved or paid, and the demo admin and workers are refused", async () => {
    const w = await worker(1000);
    const { _id } = await (await requestIt()).json();
    as({ _id: ADMIN }, "admin");
    expect((await decide(String(_id), { action: "approve" })).status).toBe(404);
    expect((await pay(String(_id), { transactionId: "TRX12345" })).status).toBe(404);

    as({ _id: ADMIN }, "demo_admin");
    expect((await decide(String(_id), { action: "approve" })).status).toBe(403);
    expect((await pay(String(_id), { transactionId: "TRX12345" })).status).toBe(403);
    as(w, "worker");
    expect((await decide(String(_id), { action: "approve" })).status).toBe(401);
    expect((await pay(String(_id), { transactionId: "TRX12345" })).status).toBe(401);
    expect((await Withdrawal.findById(_id))?.status).toBe("awaiting_confirmation");
    expect(await AuditLog.countDocuments()).toBe(0);
  });
});
