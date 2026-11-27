import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import LedgerAccount from "@/models/LedgerAccount";
import LedgerTransaction from "@/models/LedgerTransaction";
import Submission from "@/models/Submission";
import Task from "@/models/Task";
import User from "@/models/User";
import {
  coinsOf,
  createPendingSubmission,
  createPreLedgerTask,
  createUser,
  startTestDb,
  taskInput,
} from "@/lib/payments/test-utils";
import { createFundedTask, deleteFundedTask, updateFundedTask } from "@/lib/ledger/flows/tasks";
import { approveSubmission, rejectSubmission, submitWork } from "@/lib/ledger/flows/submissions";
import { reconcile } from "@/lib/ledger/reconcile";
import { escrowAccount } from "@/lib/ledger";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_ledger_submissions_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
});

const escrowOf = async (taskId: unknown) =>
  (await LedgerAccount.findById(escrowAccount(String(taskId))))?.balance;

async function fundedTask(buyerCoins = 100, workers = 3, reward = 10) {
  const buyer = await createUser(buyerCoins);
  const res = await createFundedTask({
    buyerId: String(buyer._id),
    buyerName: "Buyer",
    buyerEmail: "buyer@example.test",
    data: taskInput({ requiredWorkers: workers, payableAmount: reward }),
  });
  if (!res.ok) throw new Error("setup failed");
  return { buyer, task: res.task };
}

describe("approveSubmission", () => {
  it("pays the worker out of escrow", async () => {
    const { buyer, task } = await fundedTask();
    const worker = await createUser(5);
    const sub = await createPendingSubmission(task, worker._id);

    const res = await approveSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) });
    expect(res.ok).toBe(true);
    expect(await coinsOf(worker._id)).toBe(15);
    expect(await escrowOf(task._id)).toBe(20);
    expect((await Submission.findById(sub._id))?.status).toBe("approved");
    const row = await LedgerTransaction.findOne({ idempotencyKey: `approve:${sub._id}` });
    expect(row?.type).toBe("submission_payout");
    expect(row?.meta).toMatchObject({ taskId: String(task._id), submissionId: String(sub._id) });
    expect(row?.createdBy).toBe(String(buyer._id));
  });

  it("the same submission approved 10 times concurrently is paid once", async () => {
    const { buyer, task } = await fundedTask();
    const worker = await createUser(0);
    const sub = await createPendingSubmission(task, worker._id);

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        approveSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) }),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.reason === "not_found")).toBe(true);
    expect(await coinsOf(worker._id)).toBe(10);
    expect(await escrowOf(task._id)).toBe(20);
    expect(await LedgerTransaction.countDocuments({ type: "submission_payout" })).toBe(1);
  });

  it("is paid once on a task from before the ledger, with a pre-ledger worker", async () => {
    const buyer = await createUser(0);
    const worker = await createUser(40);
    const task = await createPreLedgerTask(buyer._id, { requiredWorkers: 3, payableAmount: 10 });
    const sub = await createPendingSubmission(task, worker._id); // F=1, pending 10

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        approveSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) }),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await coinsOf(worker._id)).toBe(50);
    // Opened with (3-1)*10 + 10 = 30, then 10 paid out.
    expect(await escrowOf(task._id)).toBe(20);
    expect(await LedgerTransaction.countDocuments({ type: "opening" })).toBe(2); // worker + escrow
  });

  it("only the task's buyer can approve", async () => {
    const { task } = await fundedTask();
    const worker = await createUser(0);
    const other = await createUser(0);
    const sub = await createPendingSubmission(task, worker._id);
    const res = await approveSubmission({ submissionId: String(sub._id), buyerId: String(other._id) });
    expect(res).toEqual({ ok: false, reason: "not_found" });
    expect(await coinsOf(worker._id)).toBe(0);
  });

  it("refuses and stays pending when the escrow cannot cover the reward", async () => {
    const { buyer, task } = await fundedTask(100, 3, 10);
    const worker = await createUser(0);
    const sub = await createPendingSubmission(task, worker._id);
    await LedgerAccount.updateOne({ _id: escrowAccount(String(task._id)) }, { balance: 5 });

    const res = await approveSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) });
    expect(res).toEqual({ ok: false, reason: "escrow_insufficient" });
    expect((await Submission.findById(sub._id))?.status).toBe("pending");
    expect(await coinsOf(worker._id)).toBe(0);
  });

  it("refuses and stays pending when the worker account is gone", async () => {
    const { buyer, task } = await fundedTask();
    const worker = await createUser(0);
    const sub = await createPendingSubmission(task, worker._id);
    await User.deleteOne({ _id: worker._id });
    const res = await approveSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) });
    expect(res).toEqual({ ok: false, reason: "worker_missing" });
    expect((await Submission.findById(sub._id))?.status).toBe("pending");
    expect(await escrowOf(task._id)).toBe(30);
  });

  it("pays a pending submission after the buyer deleted the task", async () => {
    const { buyer, task } = await fundedTask(100, 3, 10);
    const worker = await createUser(0);
    const sub = await createPendingSubmission(task, worker._id);
    await deleteFundedTask({ taskId: String(task._id), buyerId: String(buyer._id) }); // refunds 20, keeps 10
    const res = await approveSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) });
    expect(res.ok).toBe(true);
    expect(await coinsOf(worker._id)).toBe(10);
    expect(await escrowOf(task._id)).toBe(0);
  });
});

describe("rejectSubmission", () => {
  it("moves no coins and reopens the slot", async () => {
    const { buyer, task } = await fundedTask();
    const worker = await createUser(0);
    const sub = await createPendingSubmission(task, worker._id);
    await createPendingSubmission(task, worker._id);
    await createPendingSubmission(task, worker._id); // full: task closed
    expect((await Task.findById(task._id))?.status).toBe("closed");

    const res = await rejectSubmission({
      submissionId: String(sub._id),
      buyerId: String(buyer._id),
      reason: "Not clear",
    });
    expect(res.ok).toBe(true);
    const saved = await Submission.findById(sub._id);
    expect(saved?.status).toBe("rejected");
    expect(saved?.rejectionReason).toBe("Not clear");
    const t = await Task.findById(task._id);
    expect(t?.filledWorkers).toBe(2);
    expect(t?.status).toBe("open");
    expect(await escrowOf(task._id)).toBe(30);
    expect(await LedgerTransaction.countDocuments({ type: "submission_reject_refund" })).toBe(0);
  });

  it("rejecting twice only counts once", async () => {
    const { buyer, task } = await fundedTask();
    const worker = await createUser(0);
    const sub = await createPendingSubmission(task, worker._id);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        rejectSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) }),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await Task.findById(task._id))?.filledWorkers).toBe(0);
  });

  it("refunds the buyer instead of reopening when the task was already deleted", async () => {
    const { buyer, task } = await fundedTask(100, 3, 10);
    const worker = await createUser(0);
    const sub = await createPendingSubmission(task, worker._id);
    await deleteFundedTask({ taskId: String(task._id), buyerId: String(buyer._id) });
    expect(await coinsOf(buyer._id)).toBe(90); // 100 - 30 + 20
    expect(await escrowOf(task._id)).toBe(10);

    const res = await rejectSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) });
    expect(res.ok).toBe(true);
    expect(await coinsOf(buyer._id)).toBe(100);
    expect(await escrowOf(task._id)).toBe(0);
    expect((await Task.findById(task._id))?.status).toBe("archived");
    const row = await LedgerTransaction.findOne({ idempotencyKey: `reject-refund:${sub._id}` });
    expect(row?.type).toBe("submission_reject_refund");
  });

  it("does the same for a task archived before the ledger", async () => {
    const buyer = await createUser(0);
    const worker = await createUser(0);
    // Bought 3 x 10; the buyer deleted it with 1 pending submission: the
    // refund of the 2 open slots (20) already happened, 10 is still owed.
    const task = await createPreLedgerTask(buyer._id, {
      requiredWorkers: 3,
      payableAmount: 10,
      status: "archived",
    });
    const sub = await createPendingSubmission(task, worker._id);

    const res = await rejectSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) });
    expect(res.ok).toBe(true);
    expect(await coinsOf(buyer._id)).toBe(10);
    expect(await escrowOf(task._id)).toBe(0);
    const t = await Task.findById(task._id);
    expect(t?.status).toBe("archived");
    expect(t?.escrowReleasedAt).toBeInstanceOf(Date);
  });

  describe("when the task holds more filled slots than it now needs", () => {
    it("refunds the reward and charges no reprice, because no slot reopens", async () => {
      // 3 slots at 10 coins, two taken; the buyer then lowers the count to 1.
      const { buyer, task } = await fundedTask(100, 3, 10);
      const a = await createPendingSubmission(task, (await createUser(0))._id);
      const b = await createPendingSubmission(task, (await createUser(0))._id);
      const edit = await updateFundedTask({
        taskId: String(task._id),
        buyerId: String(buyer._id),
        data: taskInput({ requiredWorkers: 1, payableAmount: 25 }),
      });
      expect(edit.ok).toBe(true);
      const buyerBefore = await coinsOf(buyer._id);
      const statusBefore = (await Task.findById(task._id))?.status;
      // Two pending rewards of 10 remain in escrow; the open slot is gone.
      expect(await escrowOf(task._id)).toBe(20);

      const res = await rejectSubmission({ submissionId: String(a._id), buyerId: String(buyer._id) });

      expect(res.ok).toBe(true);
      // The rejected reward comes back, and the new payout is not charged.
      expect(await coinsOf(buyer._id)).toBe(buyerBefore + 10);
      expect(await escrowOf(task._id)).toBe(10);
      const after = await Task.findById(task._id);
      expect(after?.filledWorkers).toBe(1);
      // Still full, so the rejection does not touch the status.
      expect(after?.status).toBe(statusBefore);
      expect(await LedgerTransaction.findOne({ idempotencyKey: `reject-reprice:${a._id}` })).toBeNull();
      expect((await reconcile()).escrowMismatches).toEqual([]);

      // Rejecting the second one leaves a slot, so that one reopens at the new payout.
      const res2 = await rejectSubmission({ submissionId: String(b._id), buyerId: String(buyer._id) });
      expect(res2.ok).toBe(true);
      expect(await escrowOf(task._id)).toBe(25);
      expect((await Task.findById(task._id))?.status).toBe("open");
      const report = await reconcile();
      expect(report.ok).toBe(true);
    });

    it("does the same on a task from before the ledger", async () => {
      const buyer = await createUser(0);
      const task = await createPreLedgerTask(buyer._id, {
        requiredWorkers: 1,
        filledWorkers: 2,
        payableAmount: 13,
        status: "closed",
      });
      const sub = await Submission.create({
        taskId: task._id,
        taskTitle: task.title,
        taskBuyerId: buyer._id,
        taskBuyerName: "Buyer",
        workerId: (await createUser(0))._id,
        workerName: "Worker",
        workerEmail: "worker@example.test",
        payableAmount: 3,
        details: "Done.",
      });

      const res = await rejectSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) });

      expect(res.ok).toBe(true);
      expect(await coinsOf(buyer._id)).toBe(3);
      expect(await escrowOf(task._id)).toBe(0);
      expect((await Task.findById(task._id))?.filledWorkers).toBe(1);
      expect((await reconcile()).escrowMismatches).toEqual([]);
    });
  });

  describe("when the task's payout changed after the submission", () => {
    const reprice = (buyer: { _id: unknown }, task: { _id: unknown }, payableAmount: number) =>
      updateFundedTask({
        taskId: String(task._id),
        buyerId: String(buyer._id),
        data: taskInput({ requiredWorkers: 3, payableAmount }),
      });

    it("charges the buyer the difference to reopen the slot at the new, higher payout", async () => {
      const { buyer, task } = await fundedTask(100, 3, 10); // buyer 70, escrow 30
      const worker = await createUser(0);
      const sub = await createPendingSubmission(task, worker._id); // reward 10, F=1
      await reprice(buyer, task, 15); // the 2 open slots now cost 15: +10
      expect(await escrowOf(task._id)).toBe(40); // 2 x 15 + 10 pending
      expect(await coinsOf(buyer._id)).toBe(60);

      const res = await rejectSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) });
      expect(res.ok).toBe(true);
      // The reopened slot is worth 15, not the rejected submission's 10.
      expect(await escrowOf(task._id)).toBe(45); // 3 x 15
      expect(await coinsOf(buyer._id)).toBe(55);
      const row = await LedgerTransaction.findOne({ idempotencyKey: `reject-reprice:${sub._id}` });
      expect(row?.type).toBe("task_reprice");
    });

    it("refunds the difference when the payout went down", async () => {
      const { buyer, task } = await fundedTask(100, 3, 10);
      const worker = await createUser(0);
      const sub = await createPendingSubmission(task, worker._id);
      await reprice(buyer, task, 4); // 2 open slots: -12
      expect(await escrowOf(task._id)).toBe(18); // 2 x 4 + 10
      const res = await rejectSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) });
      expect(res.ok).toBe(true);
      expect(await escrowOf(task._id)).toBe(12); // 3 x 4
      expect(await coinsOf(buyer._id)).toBe(70 + 12 + 6);
    });

    it("refunds the reward and removes the slot when the buyer cannot afford the higher payout", async () => {
      const { buyer, task } = await fundedTask(42, 3, 10); // buyer 12 left
      const worker = await createUser(0);
      const sub = await createPendingSubmission(task, worker._id);
      await reprice(buyer, task, 15); // charges 10: buyer 2 left, escrow 40
      const res = await rejectSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) });
      expect(res.ok).toBe(true);
      // An unfunded slot is never opened: the reward comes back and the task loses that slot.
      const after = await Task.findById(task._id);
      expect(after?.filledWorkers).toBe(0);
      expect(after?.requiredWorkers).toBe(2);
      expect(await coinsOf(buyer._id)).toBe(12);
      expect(await escrowOf(task._id)).toBe(30); // 2 open slots at 15
      expect((await reconcile()).ok).toBe(true);
    });

    it("opens a pre-ledger escrow first, then reprices", async () => {
      const buyer = await createUser(50);
      const worker = await createUser(0);
      const task = await createPreLedgerTask(buyer._id, { requiredWorkers: 3, payableAmount: 10 });
      const sub = await createPendingSubmission(task, worker._id);
      await Task.updateOne({ _id: task._id }, { payableAmount: 12 }); // edited before the ledger existed
      // Opening values the task at today's state: 2 open slots at 12 + 10 pending = 34.
      const res = await rejectSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) });
      expect(res.ok).toBe(true);
      // The reopened slot is worth 12, not 10: 3 x 12.
      expect(await escrowOf(task._id)).toBe(36);
      expect(await coinsOf(buyer._id)).toBe(48);
    });
  });
});

describe("submitWork", () => {
  const submit = (taskId: unknown, workerId: unknown) =>
    submitWork({
      taskId: String(taskId),
      worker: { id: String(workerId), name: "Worker", email: "worker@example.test" },
      data: { details: "All done, see the proof.", proofLinks: ["https://example.test/proof"] },
    });

  it("takes a slot and creates a pending submission", async () => {
    const { task } = await fundedTask(100, 3, 10);
    const worker = await createUser(0);
    const res = await submit(task._id, worker._id);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.submission.status).toBe("pending");
    expect(res.submission.payableAmount).toBe(10);
    expect(res.task.title).toBe(task.title);
    const t = await Task.findById(task._id);
    expect(t?.filledWorkers).toBe(1);
    expect(t?.status).toBe("open");
    expect((await reconcile()).ok).toBe(true);
  });

  it("10 workers at once on 5 open slots: exactly 5 get in, the other 5 are refused", async () => {
    const { task } = await fundedTask(1000, 5, 10);
    const workers = await Promise.all(Array.from({ length: 10 }, () => createUser(0)));
    const results = await Promise.all(workers.map((w) => submit(task._id, w._id)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    const refused = results.filter((r) => !r.ok);
    expect(refused).toHaveLength(5);
    // The fifth submission closes the task, so the losers find it closed: the
    // same "not available" a late worker always got on a closed task.
    expect(refused.every((r) => !r.ok && r.reason === "not_available")).toBe(true);
    const t = await Task.findById(task._id);
    expect(t?.filledWorkers).toBe(5);
    expect(t?.status).toBe("closed");
    expect(await Submission.countDocuments({ taskId: task._id, status: "pending" })).toBe(5);
    const report = await reconcile();
    expect(report.escrowMismatches).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("the same worker 5 times at once gets one submission", async () => {
    const { task } = await fundedTask(100, 5, 10);
    const worker = await createUser(0);
    const results = await Promise.all(Array.from({ length: 5 }, () => submit(task._id, worker._id)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(
      results.filter((r) => !r.ok).every((r) => !r.ok && r.reason === "pending_exists"),
    ).toBe(true);
    expect((await Task.findById(task._id))?.filledWorkers).toBe(1);
    expect(await Submission.countDocuments({ taskId: task._id, workerId: worker._id })).toBe(1);
    expect((await reconcile()).ok).toBe(true);
  });

  it("reports full for an open task with no slot left, and pending first for a worker who already submitted", async () => {
    const buyer = await createUser(0);
    const worker = await createUser(0);
    const other = await createUser(0);
    // Open but with every slot taken (not a state the app creates, but the check must hold).
    const task = await createPreLedgerTask(buyer._id, { requiredWorkers: 2, filledWorkers: 2 });
    expect(await submit(task._id, other._id)).toEqual({ ok: false, reason: "full" });
    await createPendingSubmission(task, worker._id);
    await Task.updateOne({ _id: task._id }, { filledWorkers: 2, status: "open" });
    expect(await submit(task._id, worker._id)).toEqual({ ok: false, reason: "pending_exists" });
  });

  it.each(["closed", "blocked", "archived"] as const)("refuses a %s task as not available", async (status) => {
    const buyer = await createUser(0);
    const worker = await createUser(0);
    const task = await createPreLedgerTask(buyer._id, { status });
    expect(await submit(task._id, worker._id)).toEqual({ ok: false, reason: "not_available" });
    expect(await Submission.countDocuments({})).toBe(0);
    expect((await Task.findById(task._id))?.filledWorkers).toBe(0);
  });

  it("refuses a task that does not exist as not available", async () => {
    const worker = await createUser(0);
    expect(await submit(new mongoose.Types.ObjectId(), worker._id)).toEqual({
      ok: false,
      reason: "not_available",
    });
  });

  it("refuses a task ID that is not an ObjectId, without touching any task", async () => {
    const { task } = await fundedTask(100, 3, 10);
    const worker = await createUser(0);
    const data = { details: "All done, see the proof.", proofLinks: ["https://example.test/proof"] };
    const w = { id: String(worker._id), name: "Worker", email: "worker@example.test" };
    const injected = await submitWork({ taskId: { $ne: null } as unknown as string, worker: w, data });
    expect(injected).toEqual({ ok: false, reason: "not_available" });
    expect(await submitWork({ taskId: "not-an-id", worker: w, data })).toEqual({
      ok: false,
      reason: "not_available",
    });
    expect((await Task.findById(task._id))?.filledWorkers).toBe(0);
    expect(await Submission.countDocuments({})).toBe(0);
  });

  it("accepts a new submission after a rejection frees a slot", async () => {
    const { buyer, task } = await fundedTask(100, 1, 10);
    const first = await createUser(0);
    const second = await createUser(0);
    const res = await submit(task._id, first._id);
    if (!res.ok) throw new Error("setup failed");
    expect(await submit(task._id, second._id)).toEqual({ ok: false, reason: "not_available" });

    const rejected = await rejectSubmission({
      submissionId: String(res.submission._id),
      buyerId: String(buyer._id),
    });
    expect(rejected.ok).toBe(true);
    expect((await Task.findById(task._id))?.status).toBe("open");

    expect((await submit(task._id, second._id)).ok).toBe(true);
    const t = await Task.findById(task._id);
    expect(t?.filledWorkers).toBe(1);
    expect(t?.status).toBe("closed");
    expect((await reconcile()).ok).toBe(true);
  });
});
