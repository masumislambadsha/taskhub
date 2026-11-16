import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import LedgerAccount from "@/models/LedgerAccount";
import LedgerTransaction from "@/models/LedgerTransaction";
import Withdrawal from "@/models/Withdrawal";
import { coinsOf, createUser, startTestDb } from "@/lib/payments/test-utils";
import { approveWithdrawal, rejectWithdrawal } from "@/lib/ledger/flows/withdrawals";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_ledger_withdrawals_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
});

async function pendingWithdrawal(workerId: mongoose.Types.ObjectId | string, coins: number) {
  return Withdrawal.create({
    workerId,
    workerName: "Worker",
    workerEmail: "worker@example.test",
    coinRequested: coins,
    amount: coins / 20,
    paymentSystem: "bkash",
    accountNumber: "01700000000",
  });
}

describe("approveWithdrawal", () => {
  it("takes the coins from the worker and retires them to system:issuance", async () => {
    const worker = await createUser(500);
    const w = await pendingWithdrawal(worker._id, 200);
    const res = await approveWithdrawal({ withdrawalId: String(w._id), adminId: "admin1" });
    expect(res.ok).toBe(true);
    expect(await coinsOf(worker._id)).toBe(300);
    expect((await LedgerAccount.findById("system:issuance"))?.balance).toBe(200);
    const saved = await Withdrawal.findById(w._id);
    expect(saved?.status).toBe("approved");
    expect(saved?.processedAt).toBeInstanceOf(Date);
    const row = await LedgerTransaction.findOne({ idempotencyKey: `withdrawal:${w._id}` });
    expect(row?.type).toBe("withdrawal");
    expect(row?.createdBy).toBe("admin1");
    expect(row?.meta.withdrawalId).toBe(String(w._id));
  });

  it("refuses with insufficient coins and leaves everything unchanged", async () => {
    const worker = await createUser(199);
    const w = await pendingWithdrawal(worker._id, 200);
    const res = await approveWithdrawal({ withdrawalId: String(w._id), adminId: "admin1" });
    expect(res).toEqual({ ok: false, reason: "insufficient_coins" });
    expect(await coinsOf(worker._id)).toBe(199);
    const saved = await Withdrawal.findById(w._id);
    expect(saved?.status).toBe("pending");
    expect(saved?.processedAt).toBeUndefined();
    expect(await LedgerTransaction.countDocuments({})).toBe(0);
    expect(await LedgerAccount.countDocuments({})).toBe(0);
  });

  it("refuses when the worker no longer exists", async () => {
    const w = await pendingWithdrawal("65f000000000000000000001", 200);
    const res = await approveWithdrawal({ withdrawalId: String(w._id), adminId: "a" });
    expect(res).toEqual({ ok: false, reason: "insufficient_coins" });
    expect((await Withdrawal.findById(w._id))?.status).toBe("pending");
  });

  it("20 withdrawals of 200 approved at once from a 400-coin worker: exactly 2 succeed", async () => {
    const worker = await createUser(400);
    const withdrawals = await Promise.all(
      Array.from({ length: 20 }, () => pendingWithdrawal(worker._id, 200)),
    );
    const results = await Promise.all(
      withdrawals.map((w) => approveWithdrawal({ withdrawalId: String(w._id), adminId: "a" })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(await coinsOf(worker._id)).toBe(0);
    expect(await Withdrawal.countDocuments({ status: "approved" })).toBe(2);
    expect(await Withdrawal.countDocuments({ status: "pending" })).toBe(18);
  });

  it("approving the same withdrawal 10 times at once pays once", async () => {
    const worker = await createUser(1000);
    const w = await pendingWithdrawal(worker._id, 200);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => approveWithdrawal({ withdrawalId: String(w._id), adminId: "a" })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await coinsOf(worker._id)).toBe(800);
  });

  it("cannot approve a withdrawal that was rejected", async () => {
    const worker = await createUser(1000);
    const w = await pendingWithdrawal(worker._id, 200);
    expect((await rejectWithdrawal({ withdrawalId: String(w._id) })).ok).toBe(true);
    expect(await approveWithdrawal({ withdrawalId: String(w._id), adminId: "a" })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await coinsOf(worker._id)).toBe(1000);
  });
});

describe("rejectWithdrawal", () => {
  it("moves no coins", async () => {
    const worker = await createUser(500);
    const w = await pendingWithdrawal(worker._id, 200);
    const res = await rejectWithdrawal({ withdrawalId: String(w._id) });
    expect(res.ok).toBe(true);
    expect(await coinsOf(worker._id)).toBe(500);
    expect((await Withdrawal.findById(w._id))?.status).toBe("rejected");
    expect(await LedgerTransaction.countDocuments({})).toBe(0);
  });
});
