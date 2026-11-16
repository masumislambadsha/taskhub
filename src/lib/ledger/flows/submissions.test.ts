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
import { approveSubmission, rejectSubmission } from "@/lib/ledger/flows/submissions";
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

    it("refuses the rejection when the buyer cannot afford the higher payout", async () => {
      const { buyer, task } = await fundedTask(42, 3, 10); // buyer 12 left
      const worker = await createUser(0);
      const sub = await createPendingSubmission(task, worker._id);
      await reprice(buyer, task, 15); // charges 10: buyer 2 left, escrow 40
      const res = await rejectSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) });
      expect(res).toEqual({ ok: false, reason: "insufficient_coins" });
      expect((await Submission.findById(sub._id))?.status).toBe("pending");
      expect((await Task.findById(task._id))?.filledWorkers).toBe(1);
      expect(await escrowOf(task._id)).toBe(40);
      expect(await coinsOf(buyer._id)).toBe(2);
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
