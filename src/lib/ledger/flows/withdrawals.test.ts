import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import AuditLog from "@/models/AuditLog";
import LedgerAccount from "@/models/LedgerAccount";
import LedgerTransaction from "@/models/LedgerTransaction";
import Withdrawal from "@/models/Withdrawal";
import { coinsOf, createUser, startTestDb } from "@/lib/payments/test-utils";
import {
  approveWithdrawal,
  cancelWithdrawal,
  confirmWithdrawal,
  expireUnconfirmedWithdrawals,
  markWithdrawalPaid,
  reissueConfirmation,
  rejectWithdrawal,
  requestWithdrawal,
} from "@/lib/ledger/flows/withdrawals";
import { reconcile } from "@/lib/ledger/reconcile";
import {
  WITHDRAWAL_DAILY_LIMIT_COINS,
  WITHDRAWAL_UNCONFIRMED_EXPIRY_MS,
  WITHDRAWAL_WEEKLY_LIMIT_COINS,
} from "@/lib/constants";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_ledger_withdrawals_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await Withdrawal.deleteMany({});
});

const HOUR = 3_600_000;
const audit = { actorId: "6b0000000000000000000a01", actorRole: "admin" };
const balanceOf = async (id: string) => (await LedgerAccount.findById(id))?.balance ?? 0;
const payouts = () => balanceOf("system:payouts_pending");

async function worker(coins = 1000) {
  const u = await createUser(coins);
  return { id: String(u._id), name: "Worker", email: u.email, _id: u._id };
}
const request = (w: { id: string; name: string; email: string }, coins = 200, over = {}) =>
  requestWithdrawal({ worker: w, coins, paymentSystem: "bkash", accountNumber: "01700000000", ...over });

async function requested(coins = 200, workerCoins = 1000) {
  const w = await worker(workerCoins);
  const res = await request(w, coins);
  if (!res.ok) throw new Error(`setup failed: ${res.reason}`);
  return { w, withdrawal: res.withdrawal, token: res.confirmToken, id: String(res.withdrawal._id) };
}
async function confirmed(coins = 200) {
  const r = await requested(coins);
  const c = await confirmWithdrawal({ withdrawalId: r.id, workerId: r.w.id, token: r.token });
  if (!c.ok) throw new Error("confirm failed");
  return r;
}
async function approved(coins = 200) {
  const r = await confirmed(coins);
  const a = await approveWithdrawal({ withdrawalId: r.id, adminId: audit.actorId, audit });
  if (!a.ok) throw new Error("approve failed");
  return r;
}

describe("requesting", () => {
  it("moves the coins to system:payouts_pending and waits for the worker to confirm", async () => {
    const { w, withdrawal, id, token } = await requested(200, 500);
    expect(await coinsOf(w._id)).toBe(300);
    expect(await payouts()).toBe(200);
    expect(withdrawal).toMatchObject({ status: "awaiting_confirmation", coinRequested: 200 });
    expect(withdrawal.reservedAt).toBeInstanceOf(Date);
    expect(withdrawal.confirmExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 29 * 60_000);
    const row = await LedgerTransaction.findOne({ idempotencyKey: `withdrawal-request:${id}` });
    expect(row?.type).toBe("withdrawal_request");
    // Only the hash of the token is stored.
    expect(JSON.stringify(await Withdrawal.collection.findOne({ _id: withdrawal._id }))).not.toContain(token);
    expect((await reconcile()).ok).toBe(true);
  });

  it("refuses below the minimum and with too few coins, changing nothing", async () => {
    const w = await worker(150);
    expect(await request(w, 100)).toEqual({ ok: false, reason: "below_minimum" });
    expect(await request(w, 200.5)).toEqual({ ok: false, reason: "below_minimum" });
    expect(await request(w, 200)).toEqual({ ok: false, reason: "insufficient_coins" });
    expect(await coinsOf(w._id)).toBe(150);
    expect(await Withdrawal.countDocuments()).toBe(0);
    expect(await payouts()).toBe(0);
  });

  it("refuses a worker whose account no longer exists", async () => {
    const res = await request({ id: "65f000000000000000000001", name: "x", email: "x@example.test" });
    expect(res).toEqual({ ok: false, reason: "worker_missing" });
  });

  it("enforces the daily limit, and a cancelled request no longer counts", async () => {
    const w = await worker(100_000);
    const now = new Date();
    expect((await request(w, WITHDRAWAL_DAILY_LIMIT_COINS, { now })).ok).toBe(true);
    expect(await request(w, 200, { now })).toEqual({ ok: false, reason: "daily_limit" });
    expect(await coinsOf(w._id)).toBe(100_000 - WITHDRAWAL_DAILY_LIMIT_COINS);

    const first = await Withdrawal.findOne({});
    await cancelWithdrawal({ withdrawalId: String(first!._id), workerId: w.id });
    expect((await request(w, 200, { now })).ok).toBe(true);
  });

  it("enforces the weekly limit across days, and rejected requests do not count", async () => {
    const w = await worker(100_000);
    const now = new Date();
    // Two days of 2000 each (4000 this week), neither within the last 24 hours.
    for (const hoursAgo of [30, 55]) {
      await Withdrawal.collection.insertOne({
        workerId: w._id, workerName: "W", workerEmail: w.email, coinRequested: WITHDRAWAL_DAILY_LIMIT_COINS,
        amount: 100, paymentSystem: "bkash", accountNumber: "017", status: "paid",
        createdAt: new Date(now.getTime() - hoursAgo * HOUR), updatedAt: new Date(),
      });
    }
    expect(await request(w, 2000, { now })).toEqual({ ok: false, reason: "weekly_limit" }); // 6000 > 5000
    expect((await request(w, 1000, { now })).ok).toBe(true); // exactly 5000
    expect(await request(w, 200, { now })).toEqual({ ok: false, reason: "weekly_limit" });

    // A rejected one frees its share of the week.
    await Withdrawal.collection.updateMany({ status: "paid" }, { $set: { status: "rejected" } });
    expect((await request(w, 1000, { now })).ok).toBe(true);
    void WITHDRAWAL_WEEKLY_LIMIT_COINS;
  });

  it("8 requests of 200 at once from a 500-coin worker: exactly 2 succeed and the books balance", async () => {
    const w = await worker(500);
    const results = await Promise.all(Array.from({ length: 8 }, () => request(w, 200)));
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(await coinsOf(w._id)).toBe(100);
    expect(await payouts()).toBe(400);
    expect((await reconcile()).ok).toBe(true);
  });
});

describe("confirming", () => {
  it("moves the request into the admin queue and forgets the token", async () => {
    const { w, id, token } = await requested();
    const res = await confirmWithdrawal({ withdrawalId: id, workerId: w.id, token });
    expect(res.ok).toBe(true);
    const saved = await Withdrawal.findById(id);
    expect(saved).toMatchObject({ status: "pending" });
    expect(saved?.confirmedAt).toBeInstanceOf(Date);
    expect(saved?.confirmTokenHash).toBeUndefined();
    expect(await confirmWithdrawal({ withdrawalId: id, workerId: w.id, token })).toEqual({ ok: false, reason: "not_found" });
  });

  it("refuses a wrong token, someone else's request and an expired link", async () => {
    const { w, id, token } = await requested();
    expect(await confirmWithdrawal({ withdrawalId: id, workerId: w.id, token: "nope" })).toEqual({ ok: false, reason: "invalid_token" });
    const other = await worker();
    expect(await confirmWithdrawal({ withdrawalId: id, workerId: other.id, token })).toEqual({ ok: false, reason: "not_found" });
    expect(await confirmWithdrawal({ withdrawalId: "nope", workerId: w.id, token })).toEqual({ ok: false, reason: "not_found" });
    const late = new Date(Date.now() + 31 * 60_000);
    expect(await confirmWithdrawal({ withdrawalId: id, workerId: w.id, token, now: late })).toEqual({ ok: false, reason: "expired" });
    expect((await Withdrawal.findById(id))?.status).toBe("awaiting_confirmation");
  });

  it("a new link replaces the old one", async () => {
    const { w, id, token } = await requested();
    const again = await reissueConfirmation({ withdrawalId: id, workerId: w.id });
    if (!again.ok) throw new Error();
    expect(await confirmWithdrawal({ withdrawalId: id, workerId: w.id, token })).toEqual({ ok: false, reason: "invalid_token" });
    expect((await confirmWithdrawal({ withdrawalId: id, workerId: w.id, token: again.confirmToken })).ok).toBe(true);
    expect((await reissueConfirmation({ withdrawalId: id, workerId: w.id })).ok).toBe(false);
  });

  it("confirming many times at once confirms once", async () => {
    const { w, id, token } = await requested();
    const results = await Promise.all(Array.from({ length: 6 }, () => confirmWithdrawal({ withdrawalId: id, workerId: w.id, token })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });
});

describe("cancelling and expiring", () => {
  it("the worker can cancel before approval and gets exactly the coins back, once", async () => {
    const { w, id } = await requested(200, 500);
    const results = await Promise.all(Array.from({ length: 5 }, () => cancelWithdrawal({ withdrawalId: id, workerId: w.id })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await coinsOf(w._id)).toBe(500);
    expect(await payouts()).toBe(0);
    expect((await Withdrawal.findById(id))?.status).toBe("cancelled");
    expect((await reconcile()).ok).toBe(true);
  });

  it("cannot cancel after approval, or someone else's", async () => {
    const { w, id } = await approved();
    expect((await cancelWithdrawal({ withdrawalId: id, workerId: w.id })).ok).toBe(false);
    const fresh = await requested();
    const other = await worker();
    expect((await cancelWithdrawal({ withdrawalId: fresh.id, workerId: other.id })).ok).toBe(false);
  });

  it("unconfirmed requests are cancelled after 24 hours and the coins return; confirmed ones are kept", async () => {
    const stale = await requested(200, 500);
    const fresh = await requested(200, 500);
    const kept = await confirmed(200);
    const day = WITHDRAWAL_UNCONFIRMED_EXPIRY_MS + 60_000;
    for (const r of [stale, kept]) {
      await Withdrawal.collection.updateOne({ _id: r.withdrawal._id }, { $set: { createdAt: new Date(Date.now() - day) } });
    }
    const cancelled = await expireUnconfirmedWithdrawals();
    expect(cancelled).toEqual([stale.id]);
    expect(await coinsOf(stale.w._id)).toBe(500);
    expect((await Withdrawal.findById(stale.id))).toMatchObject({ status: "cancelled", cancelReason: "not confirmed within 24 hours" });
    expect((await Withdrawal.findById(fresh.id))?.status).toBe("awaiting_confirmation");
    expect((await Withdrawal.findById(kept.id))?.status).toBe("pending");
    expect(await expireUnconfirmedWithdrawals()).toEqual([]);
    expect((await reconcile()).ok).toBe(true);
  });

  it("confirming and expiring at the same moment end one way and keep the books balanced", async () => {
    const r = await requested(200, 500);
    await Withdrawal.collection.updateOne({ _id: r.withdrawal._id }, { $set: { createdAt: new Date(Date.now() - WITHDRAWAL_UNCONFIRMED_EXPIRY_MS - 1000) } });
    await Promise.all([
      confirmWithdrawal({ withdrawalId: r.id, workerId: r.w.id, token: r.token }),
      expireUnconfirmedWithdrawals(),
      expireUnconfirmedWithdrawals(),
    ]);
    const status = (await Withdrawal.findById(r.id))?.status;
    expect(["pending", "cancelled"]).toContain(status);
    expect(await coinsOf(r.w._id)).toBe(status === "cancelled" ? 500 : 300);
    expect((await reconcile()).ok).toBe(true);
  });
});

describe("the admin's decisions", () => {
  it("approving needs a confirmed request and is audited; the coins stay reserved", async () => {
    const unconfirmed = await requested();
    expect(await approveWithdrawal({ withdrawalId: unconfirmed.id, adminId: "a" })).toEqual({ ok: false, reason: "not_found" });

    const { id, w } = await confirmed(200);
    const res = await approveWithdrawal({ withdrawalId: id, adminId: audit.actorId, audit });
    expect(res.ok).toBe(true);
    expect(await Withdrawal.findById(id)).toMatchObject({ status: "approved", approvedBy: audit.actorId });
    expect(await payouts()).toBe(400); // both requests are still reserved
    expect(await coinsOf(w._id)).toBe(800);
    const log = await AuditLog.find({ action: "withdrawal.approve" }).lean();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ targetId: id, after: { status: "approved", coins: 200 } });
    expect(await approveWithdrawal({ withdrawalId: id, adminId: "a" })).toEqual({ ok: false, reason: "not_found" });
  });

  it("rejecting needs a reason and returns exactly the requested coins", async () => {
    const { id, w } = await confirmed(300);
    expect(await rejectWithdrawal({ withdrawalId: id, reason: "no" })).toEqual({ ok: false, reason: "reason_required" });
    expect(await rejectWithdrawal({ withdrawalId: id })).toEqual({ ok: false, reason: "reason_required" });
    expect((await Withdrawal.findById(id))?.status).toBe("pending");

    const res = await rejectWithdrawal({ withdrawalId: id, reason: "Account number looks wrong", audit });
    expect(res.ok).toBe(true);
    expect(await coinsOf(w._id)).toBe(1000);
    expect(await payouts()).toBe(0);
    expect(await Withdrawal.findById(id)).toMatchObject({ status: "rejected", rejectionReason: "Account number looks wrong" });
    expect((await AuditLog.find({ action: "withdrawal.reject" }).lean())[0]).toMatchObject({ reason: "Account number looks wrong" });
    expect((await rejectWithdrawal({ withdrawalId: id, reason: "again please" })).ok).toBe(false);
    expect((await reconcile()).ok).toBe(true);
  });

  it("an approved request can still be rejected, but a paid one cannot", async () => {
    const a = await approved(200);
    expect((await rejectWithdrawal({ withdrawalId: a.id, reason: "Found a problem" })).ok).toBe(true);
    expect(await coinsOf(a.w._id)).toBe(1000);

    const b = await approved(200);
    expect((await markWithdrawalPaid({ withdrawalId: b.id, adminId: "a", transactionId: "TRX12345" })).ok).toBe(true);
    expect((await rejectWithdrawal({ withdrawalId: b.id, reason: "too late now" })).ok).toBe(false);
  });
});

describe("paying", () => {
  it("retires the coins from payouts_pending once the admin enters the transaction ID", async () => {
    const { id, w } = await approved(200);
    const res = await markWithdrawalPaid({ withdrawalId: id, adminId: audit.actorId, transactionId: " BKASH-TRX-99 ", audit });
    expect(res.ok).toBe(true);
    expect(await Withdrawal.findById(id)).toMatchObject({ status: "paid", externalTransactionId: "BKASH-TRX-99", paidBy: audit.actorId });
    expect(await payouts()).toBe(0);
    expect(await coinsOf(w._id)).toBe(800);
    expect(await balanceOf("system:issuance")).toBe(200);
    expect((await LedgerTransaction.findOne({ idempotencyKey: `withdrawal-paid:${id}` }))?.type).toBe("withdrawal_paid");
    expect((await AuditLog.find({ action: "withdrawal.paid" }).lean())[0]).toMatchObject({ after: { transactionId: "BKASH-TRX-99" } });
    expect((await reconcile()).ok).toBe(true);
  });

  it("needs a transaction ID and an approved request", async () => {
    const a = await approved();
    expect(await markWithdrawalPaid({ withdrawalId: a.id, adminId: "a", transactionId: "" })).toEqual({ ok: false, reason: "transaction_id_required" });
    expect(await markWithdrawalPaid({ withdrawalId: a.id, adminId: "a", transactionId: "x".repeat(101) })).toEqual({ ok: false, reason: "transaction_id_required" });
    const pending = await confirmed();
    expect(await markWithdrawalPaid({ withdrawalId: pending.id, adminId: "a", transactionId: "TRX12345" })).toEqual({ ok: false, reason: "not_found" });
    expect((await Withdrawal.findById(a.id))?.status).toBe("approved");
  });

  it("paying the same request many times at once retires the coins once", async () => {
    const { id } = await approved(200);
    const results = await Promise.all(Array.from({ length: 8 }, () => markWithdrawalPaid({ withdrawalId: id, adminId: "a", transactionId: "TRX12345" })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await balanceOf("system:issuance")).toBe(200);
    expect((await reconcile()).ok).toBe(true);
  });
});

describe("withdrawals from before reservations", () => {
  async function legacy(coins: number, workerCoins: number) {
    const u = await createUser(workerCoins);
    const w = await Withdrawal.create({
      workerId: u._id, workerName: "W", workerEmail: u.email, coinRequested: coins,
      amount: coins / 20, paymentSystem: "bkash", accountNumber: "01700000000", status: "pending",
    });
    return { u, w };
  }

  it("approving reserves the coins then, and it can then be paid", async () => {
    const { u, w } = await legacy(200, 500);
    expect((await approveWithdrawal({ withdrawalId: String(w._id), adminId: "a" })).ok).toBe(true);
    expect(await coinsOf(u._id)).toBe(300);
    expect(await payouts()).toBe(200);
    expect((await Withdrawal.findById(w._id))?.reservedAt).toBeInstanceOf(Date);
    expect((await markWithdrawalPaid({ withdrawalId: String(w._id), adminId: "a", transactionId: "TRX12345" })).ok).toBe(true);
    expect((await reconcile()).ok).toBe(true);
  });

  it("is refused, staying pending, when the worker can no longer cover it", async () => {
    const { u, w } = await legacy(200, 199);
    expect(await approveWithdrawal({ withdrawalId: String(w._id), adminId: "a" })).toEqual({ ok: false, reason: "insufficient_coins" });
    expect(await coinsOf(u._id)).toBe(199);
    expect((await Withdrawal.findById(w._id))?.status).toBe("pending");
    expect(await LedgerTransaction.countDocuments()).toBe(0);
  });

  it("20 approved at once from a 400-coin worker: exactly 2 succeed", async () => {
    const u = await createUser(400);
    const ws = await Promise.all(
      Array.from({ length: 20 }, () =>
        Withdrawal.create({ workerId: u._id, workerName: "W", workerEmail: u.email, coinRequested: 200, amount: 10, paymentSystem: "bkash", accountNumber: "017", status: "pending" }),
      ),
    );
    const results = await Promise.all(ws.map((w) => approveWithdrawal({ withdrawalId: String(w._id), adminId: "a" })));
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(await coinsOf(u._id)).toBe(0);
    expect(await payouts()).toBe(400);
  });

  it("rejecting returns nothing, because nothing was reserved", async () => {
    const { u, w } = await legacy(200, 500);
    expect((await rejectWithdrawal({ withdrawalId: String(w._id), reason: "not valid" })).ok).toBe(true);
    expect(await coinsOf(u._id)).toBe(500);
    expect(await LedgerTransaction.countDocuments()).toBe(0);
  });
});

describe("reconciliation of the payouts account", () => {
  it("flags a payouts balance that does not match the open withdrawals", async () => {
    await requested(200, 500);
    expect((await reconcile()).payoutsMismatch).toBeNull();
    await LedgerAccount.updateOne({ _id: "system:payouts_pending" }, { $inc: { balance: 5 } });
    const report = await reconcile();
    expect(report.payoutsMismatch).toEqual({ balance: 205, expected: 200 });
    expect(report.ok).toBe(false);
  });
});

void mongoose;
