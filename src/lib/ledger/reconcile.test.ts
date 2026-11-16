import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import LedgerAccount from "@/models/LedgerAccount";
import LedgerTransaction from "@/models/LedgerTransaction";
import Task from "@/models/Task";
import User from "@/models/User";
import Withdrawal from "@/models/Withdrawal";
import {
  coinsOf,
  createPayment,
  createPendingSubmission,
  createPreLedgerTask,
  createUser,
  startTestDb,
  taskInput,
} from "@/lib/payments/test-utils";
import { escrowAccount, inLedgerTransaction, postTransaction, userAccount } from "@/lib/ledger";
import { reconcile } from "@/lib/ledger/reconcile";
import { openAll } from "@/lib/ledger/open-all";
import { creditPayment } from "@/lib/payments/credit";
import { createFundedTask, deleteFundedTask, updateFundedTask } from "@/lib/ledger/flows/tasks";
import { approveSubmission, rejectSubmission } from "@/lib/ledger/flows/submissions";
import { approveWithdrawal } from "@/lib/ledger/flows/withdrawals";
import { adjustUserCoins, createUserWithBonus, removeUser } from "@/lib/ledger/flows/users";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_ledger_reconcile_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
});

describe("reconcile", () => {
  it("is clean on an empty database", async () => {
    const report = await reconcile();
    expect(report).toMatchObject({
      ok: true,
      globalJournalSum: 0,
      globalCachedSum: 0,
      balanceMismatches: [],
      negativeBalances: [],
      escrowMismatches: [],
    });
  });

  it("stays clean through every kind of flow", async () => {
    const buyer = await createUser(0);
    const worker = await createUser(0);
    const pay = await createPayment(buyer._id, { coins: 500, price: 20 });
    await creditPayment({ paymentId: String(pay._id), gateway: { name: "sslcommerz", transactionId: "T1", validationId: "V1" } });
    const t = await createFundedTask({
      buyerId: String(buyer._id),
      buyerName: "B",
      buyerEmail: "b@example.test",
      data: taskInput({ requiredWorkers: 5, payableAmount: 40 }),
    });
    if (!t.ok) throw new Error("setup failed");
    const sub1 = await createPendingSubmission(t.task, worker._id);
    const sub2 = await createPendingSubmission(t.task, worker._id);
    await approveSubmission({ submissionId: String(sub1._id), buyerId: String(buyer._id) });
    await rejectSubmission({ submissionId: String(sub2._id), buyerId: String(buyer._id) });
    await updateFundedTask({ taskId: String(t.task._id), buyerId: String(buyer._id), data: taskInput({ requiredWorkers: 6, payableAmount: 40 }) });
    await deleteFundedTask({ taskId: String(t.task._id), buyerId: String(buyer._id) });
    await createUserWithBonus({ data: { name: "N", email: "n@example.test", role: "worker" }, bonus: 10 });
    await adjustUserCoins({ userId: String(worker._id), delta: 1000, adminId: "adm", requestId: "x1" });
    const w = await Withdrawal.create({
      workerId: worker._id, workerName: "W", workerEmail: "w@example.test",
      coinRequested: 200, amount: 10, paymentSystem: "bkash", accountNumber: "017",
    });
    await approveWithdrawal({ withdrawalId: String(w._id), adminId: "adm" });
    await removeUser({ userId: String(buyer._id), adminId: "adm" });

    const report = await reconcile();
    expect(report.balanceMismatches).toEqual([]);
    expect(report.escrowMismatches).toEqual([]);
    expect(report.negativeBalances).toEqual([]);
    expect(report.globalJournalSum).toBe(0);
    expect(report.globalCachedSum).toBe(0);
    expect(report.ok).toBe(true);
  });

  it("detects a tampered User.coins", async () => {
    const user = await createUser(100);
    await inLedgerTransaction((s) =>
      postTransaction(
        {
          type: "admin_adjustment",
          idempotencyKey: "t1",
          entries: [
            { accountId: "system:adjustments", amount: -5 },
            { accountId: userAccount(user._id), amount: 5 },
          ],
          createdBy: "adm",
        },
        s,
      ),
    );
    expect((await reconcile()).ok).toBe(true);

    await User.updateOne({ _id: user._id }, { $inc: { coins: 1000 } }); // the old, direct write
    const report = await reconcile();
    expect(report.ok).toBe(false);
    expect(report.balanceMismatches).toEqual([
      { accountId: userAccount(user._id), cached: 1105, journal: 105 },
    ]);
    expect(report.globalCachedSum).toBe(1000);
    expect(report.globalJournalSum).toBe(0);
  });

  it("detects a tampered ledger balance and a missing journal row", async () => {
    const user = await createUser(0);
    const pay = await createPayment(user._id, { coins: 150 });
    await creditPayment({ paymentId: String(pay._id), gateway: { name: "sslcommerz", transactionId: "T2", validationId: "V2" } });
    await LedgerAccount.updateOne({ _id: "system:issuance" }, { $inc: { balance: 7 } });
    let report = await reconcile();
    expect(report.balanceMismatches).toEqual([{ accountId: "system:issuance", cached: -143, journal: -150 }]);

    await LedgerAccount.updateOne({ _id: "system:issuance" }, { $inc: { balance: -7 } });
    await LedgerTransaction.collection.deleteMany({ type: "topup" });
    report = await reconcile();
    expect(report.ok).toBe(false);
    expect(report.balanceMismatches.map((m) => m.accountId).sort()).toEqual(["system:issuance", userAccount(user._id)].sort());
  });

  it("detects a negative user and an escrow that does not match its task", async () => {
    const buyer = await createUser(100);
    const t = await createFundedTask({
      buyerId: String(buyer._id), buyerName: "B", buyerEmail: "b@example.test",
      data: taskInput({ requiredWorkers: 3, payableAmount: 10 }),
    });
    if (!t.ok) throw new Error("setup failed");
    expect((await reconcile()).ok).toBe(true);

    await Task.updateOne({ _id: t.task._id }, { requiredWorkers: 9 }); // the task now claims 90
    let report = await reconcile();
    expect(report.escrowMismatches).toEqual([
      { accountId: escrowAccount(String(t.task._id)), taskId: String(t.task._id), balance: 30, expected: 90 },
    ]);
    expect(report.balanceMismatches).toEqual([]);

    await Task.deleteOne({ _id: t.task._id });
    report = await reconcile();
    expect(report.escrowMismatches[0].expected).toBeNull();

    await User.updateOne({ _id: buyer._id }, { coins: -5 });
    report = await reconcile();
    expect(report.negativeBalances).toEqual([{ accountId: userAccount(buyer._id), balance: -5 }]);
  });

  it("reports unopened users and tasks as information, not errors", async () => {
    const buyer = await createUser(10);
    await createPreLedgerTask(buyer._id);
    const report = await reconcile();
    expect(report.ok).toBe(true);
    expect(report.unopened).toEqual({ users: 1, tasksWithoutEscrow: 1 });
    await openAll({ dryRun: false });
    const after = await reconcile();
    expect(after.ok).toBe(true);
    expect(after.unopened).toEqual({ users: 0, tasksWithoutEscrow: 0 });
  });

  it("works without a snapshot too", async () => {
    await createUser(10);
    expect((await reconcile({ consistent: false })).ok).toBe(true);
  });
});

describe("lazy opening under concurrent postings", () => {
  it("a pre-ledger user and a pre-ledger task with existing coins and escrow reconcile to zero", async () => {
    // Before the ledger: the buyer had 500 coins and a task funded for 5 x 10 = 50
    // with 1 approved earlier (F=1) and 2 pending (F=3), and a worker holding 300.
    const buyer = await createUser(500);
    const worker = await createUser(300);
    const task = await createPreLedgerTask(buyer._id, { requiredWorkers: 5, filledWorkers: 1, payableAmount: 10 });
    const subs = [await createPendingSubmission(task, worker._id), await createPendingSubmission(task, worker._id)];
    const wd = await Promise.all(
      Array.from({ length: 4 }, () =>
        Withdrawal.create({
          workerId: worker._id, workerName: "W", workerEmail: "w@example.test",
          coinRequested: 200, amount: 10, paymentSystem: "bkash", accountNumber: "017",
        }),
      ),
    );
    const pay = await createPayment(buyer._id, { coins: 150 });

    // Everything at once, on never-opened accounts.
    const results = await Promise.all([
      ...subs.map((s) => approveSubmission({ submissionId: String(s._id), buyerId: String(buyer._id) })),
      ...subs.map((s) => approveSubmission({ submissionId: String(s._id), buyerId: String(buyer._id) })),
      ...wd.map((w) => approveWithdrawal({ withdrawalId: String(w._id), adminId: "adm" })),
      creditPayment({ paymentId: String(pay._id), gateway: { name: "sslcommerz", transactionId: "T3", validationId: "V3" } }),
      createFundedTask({ buyerId: String(buyer._id), buyerName: "B", buyerEmail: "b@example.test", data: taskInput({ requiredWorkers: 2, payableAmount: 10 }) }),
      updateFundedTask({ taskId: String(task._id), buyerId: String(buyer._id), data: taskInput({ requiredWorkers: 6, payableAmount: 10 }) }),
    ]);
    expect(results).toHaveLength(2 + 2 + 4 + 3);

    // Both submissions paid exactly once; the worker's 300 + 20 - the approved withdrawals.
    expect(await LedgerTransaction.countDocuments({ type: "submission_payout" })).toBe(2);
    const approvedWithdrawals = await Withdrawal.countDocuments({ status: "approved" });
    expect(await coinsOf(worker._id)).toBe(300 + 20 - 200 * approvedWithdrawals);
    expect(approvedWithdrawals).toBeGreaterThanOrEqual(1);

    // One opening each, no matter how many postings raced.
    expect(await LedgerTransaction.countDocuments({ idempotencyKey: `opening:user:${buyer._id}` })).toBe(1);
    expect(await LedgerTransaction.countDocuments({ idempotencyKey: `opening:user:${worker._id}` })).toBe(1);
    expect(await LedgerTransaction.countDocuments({ idempotencyKey: `opening:escrow:${task._id}` })).toBe(1);

    const report = await reconcile();
    expect(report.balanceMismatches).toEqual([]);
    expect(report.escrowMismatches).toEqual([]);
    expect(report.negativeBalances).toEqual([]);
    expect(report.globalJournalSum).toBe(0);
    expect(report.globalCachedSum).toBe(0);
    expect(report.ok).toBe(true);
    expect(await mongoose.connection.collection("users").countDocuments({ ledgerOpenedAt: { $exists: false } })).toBe(0);
  });
});
