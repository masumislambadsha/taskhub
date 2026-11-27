import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import LedgerAccount from "@/models/LedgerAccount";
import Submission from "@/models/Submission";
import Task from "@/models/Task";
import {
  coinsOf,
  createPendingSubmission,
  createPreLedgerTask,
  createUser,
  startTestDb,
  taskInput,
} from "@/lib/payments/test-utils";
import { createFundedTask, deleteFundedTask } from "@/lib/ledger/flows/tasks";
import { approveSubmission, submitWork } from "@/lib/ledger/flows/submissions";
import { autoApproveSubmission, sweepDueSubmissions } from "@/lib/ledger/flows/auto-approve";
import { autoApproveAfterMs, DEFAULT_AUTO_APPROVE_AFTER_MS } from "@/lib/auto-approve";
import { reconcile } from "@/lib/ledger/reconcile";
import { escrowAccount } from "@/lib/ledger";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_auto_approve_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
});
afterEach(() => {
  delete process.env.AUTO_APPROVE_AFTER_MS;
});

const HOUR = 3_600_000;

async function fundedTask(coins = 100, workers = 3, reward = 10) {
  const buyer = await createUser(coins);
  const res = await createFundedTask({
    buyerId: String(buyer._id),
    buyerName: "Buyer",
    buyerEmail: "buyer@example.test",
    data: taskInput({ requiredWorkers: workers, payableAmount: reward }),
  });
  if (!res.ok) throw new Error("setup failed");
  return { buyer, task: res.task };
}

/** A pending submission whose auto-approve time is `dueInMs` from now (negative = overdue). */
async function pendingDue(task: { _id: mongoose.Types.ObjectId; buyerId: mongoose.Types.ObjectId }, dueInMs: number, workerCoins = 0) {
  const worker = await createUser(workerCoins);
  const sub = await createPendingSubmission(task, worker._id);
  await Submission.updateOne({ _id: sub._id }, { $set: { autoApproveAt: new Date(Date.now() + dueInMs) } });
  return { worker, sub };
}

describe("autoApproveAfterMs", () => {
  it("is 72 hours unless AUTO_APPROVE_AFTER_MS says otherwise", () => {
    expect(autoApproveAfterMs()).toBe(72 * HOUR);
    expect(DEFAULT_AUTO_APPROVE_AFTER_MS).toBe(72 * HOUR);
    process.env.AUTO_APPROVE_AFTER_MS = "3000";
    expect(autoApproveAfterMs()).toBe(3000);
    process.env.AUTO_APPROVE_AFTER_MS = "garbage";
    expect(autoApproveAfterMs()).toBe(72 * HOUR);
    process.env.AUTO_APPROVE_AFTER_MS = "-5";
    expect(autoApproveAfterMs()).toBe(72 * HOUR);
  });
});

describe("submitWork", () => {
  it("sets autoApproveAt 72 hours ahead by default and from the setting when given", async () => {
    const { task } = await fundedTask();
    const worker = await createUser(0);
    const before = Date.now();
    const res = await submitWork({ taskId: String(task._id), worker: { id: String(worker._id), name: "W", email: "w@example.test" }, data: { details: "done" } });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const at = res.submission.autoApproveAt!.getTime();
    expect(at).toBeGreaterThanOrEqual(before + 72 * HOUR);
    expect(at).toBeLessThanOrEqual(Date.now() + 72 * HOUR);

    process.env.AUTO_APPROVE_AFTER_MS = "3000";
    const worker2 = await createUser(0);
    const res2 = await submitWork({ taskId: String(task._id), worker: { id: String(worker2._id), name: "W", email: "w2@example.test" }, data: { details: "done" } });
    if (!res2.ok) throw new Error("expected ok");
    expect(res2.submission.autoApproveAt!.getTime() - Date.now()).toBeLessThanOrEqual(3000);
  });
});

describe("autoApproveSubmission", () => {
  it("does nothing before the time, and approves after it as the system", async () => {
    const { task, buyer } = await fundedTask();
    const { worker, sub } = await pendingDue(task, HOUR, 5);

    const early = await autoApproveSubmission(String(sub._id));
    expect(early).toEqual({ status: "skipped", reason: "not_due" });
    expect((await Submission.findById(sub._id))?.status).toBe("pending");
    expect(await coinsOf(worker._id)).toBe(5);

    const later = await autoApproveSubmission(String(sub._id), { now: new Date(Date.now() + 2 * HOUR) });
    expect(later.status).toBe("approved");
    const after = await Submission.findById(sub._id);
    expect(after).toMatchObject({ status: "approved", decidedBy: "system" });
    expect(after?.decidedAt).toBeInstanceOf(Date);
    expect(await coinsOf(worker._id)).toBe(15);
    expect(await coinsOf(buyer._id)).toBe(70);
    expect((await reconcile()).ok).toBe(true);
  });

  it("counts a job that fires just early as due when given a tolerance", async () => {
    const { task } = await fundedTask();
    const { sub } = await pendingDue(task, 30_000);
    expect((await autoApproveSubmission(String(sub._id))).status).toBe("skipped");
    expect((await autoApproveSubmission(String(sub._id), { toleranceMs: 60_000 })).status).toBe("approved");
  });

  it("does nothing for a submission that is already decided", async () => {
    const { task, buyer } = await fundedTask();
    const { worker, sub } = await pendingDue(task, -HOUR, 0);
    const byBuyer = await approveSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) });
    expect(byBuyer.ok).toBe(true);

    const res = await autoApproveSubmission(String(sub._id));
    expect(res).toEqual({ status: "skipped", reason: "not_pending" });
    expect(await coinsOf(worker._id)).toBe(10);
    expect((await Submission.findById(sub._id))?.decidedBy).toBe(String(buyer._id));
  });

  it("a buyer approving and the timer firing at the same moment pay once", async () => {
    const { task, buyer } = await fundedTask(500, 5, 10);
    const { worker, sub } = await pendingDue(task, -HOUR, 0);
    const id = String(sub._id);

    const calls = Array.from({ length: 12 }, (_, i) =>
      i % 2 === 0
        ? approveSubmission({ submissionId: id, buyerId: String(buyer._id) }).then((r) => r.ok)
        : autoApproveSubmission(id).then((r) => r.status === "approved"),
    );
    const wins = (await Promise.all(calls)).filter(Boolean).length;

    expect(wins).toBe(1);
    expect(await coinsOf(worker._id)).toBe(10);
    expect(await LedgerCount(id)).toBe(1);
    expect((await reconcile()).ok).toBe(true);
  });

  it("pays a pending submission after the buyer deleted the task", async () => {
    const { task, buyer } = await fundedTask(100, 3, 10);
    const { worker, sub } = await pendingDue(task, -HOUR, 0);
    await deleteFundedTask({ taskId: String(task._id), buyerId: String(buyer._id) });

    const res = await autoApproveSubmission(String(sub._id));
    expect(res.status).toBe("approved");
    expect(await coinsOf(worker._id)).toBe(10);
    expect((await reconcile()).escrowMismatches).toEqual([]);
  });

  it("works on a task from before the ledger", async () => {
    const buyer = await createUser(0);
    const task = await createPreLedgerTask(buyer._id, { requiredWorkers: 2, filledWorkers: 1, payableAmount: 10 });
    const { worker, sub } = await pendingDue(task, -HOUR, 0);
    expect((await autoApproveSubmission(String(sub._id))).status).toBe("approved");
    expect(await coinsOf(worker._id)).toBe(10);
  });

  it("gives up cleanly when the escrow cannot cover the reward, and the sweep stops retrying it", async () => {
    const { task } = await fundedTask(100, 3, 10);
    const { worker, sub } = await pendingDue(task, -HOUR, 0);
    await LedgerAccount.updateOne({ _id: escrowAccount(String(task._id)) }, { $set: { balance: 0 } });

    const res = await autoApproveSubmission(String(sub._id));
    expect(res).toEqual({ status: "blocked", reason: "escrow_insufficient" });
    const after = await Submission.findById(sub._id);
    expect(after).toMatchObject({ status: "pending", autoApproveError: "escrow_insufficient" });
    expect(await coinsOf(worker._id)).toBe(0);

    const sweep = await sweepDueSubmissions();
    expect(sweep.approved).toEqual([]);
    expect(sweep.blocked).toEqual([]); // not even looked at again
  });

  it("gives up cleanly when the worker's account is gone", async () => {
    const { task } = await fundedTask();
    const { worker, sub } = await pendingDue(task, -HOUR);
    await mongoose.connection.collection("users").deleteOne({ _id: worker._id });
    expect(await autoApproveSubmission(String(sub._id))).toEqual({ status: "blocked", reason: "worker_missing" });
  });
});

async function LedgerCount(submissionId: string) {
  const { default: LedgerTransaction } = await import("@/models/LedgerTransaction");
  return LedgerTransaction.countDocuments({ idempotencyKey: `approve:${submissionId}` });
}

describe("sweepDueSubmissions", () => {
  it("approves only the due submissions, oldest first, and is safe to run twice", async () => {
    const { task } = await fundedTask(1000, 10, 10);
    const a = await pendingDue(task, -3 * HOUR);
    const b = await pendingDue(task, -HOUR);
    const later = await pendingDue(task, HOUR);

    const first = await sweepDueSubmissions();
    expect(first.approved).toEqual([String(a.sub._id), String(b.sub._id)]);
    expect(first.failed).toEqual([]);
    expect((await Submission.findById(later.sub._id))?.status).toBe("pending");

    const second = await sweepDueSubmissions();
    expect(second.approved).toEqual([]);
    expect(await coinsOf(a.worker._id)).toBe(10);
    expect(await coinsOf(b.worker._id)).toBe(10);
    expect(await coinsOf(later.worker._id)).toBe(0);
    expect((await reconcile()).ok).toBe(true);
  });

  it("gives submissions from before auto-approve a fresh window instead of approving them", async () => {
    const { task } = await fundedTask();
    const worker = await createUser(0);
    const sub = await createPendingSubmission(task, worker._id);
    expect((await Submission.findById(sub._id))?.autoApproveAt).toBeUndefined();

    const res = await sweepDueSubmissions();
    expect(res.backfilled).toBe(1);
    expect(res.approved).toEqual([]);
    const at = (await Submission.findById(sub._id))!.autoApproveAt!.getTime();
    expect(at).toBeGreaterThan(Date.now() + 71 * HOUR);
    expect(await coinsOf(worker._id)).toBe(0);
  });

  it("respects the limit", async () => {
    const { task } = await fundedTask(1000, 10, 10);
    await pendingDue(task, -HOUR);
    await pendingDue(task, -HOUR);
    await pendingDue(task, -HOUR);
    expect((await sweepDueSubmissions({ limit: 2 })).approved.length).toBe(2);
    expect((await sweepDueSubmissions({ limit: 2 })).approved.length).toBe(1);
  });

  it("keeps going when one approval throws, and reports it", async () => {
    const { task } = await fundedTask(1000, 10, 10);
    const bad = await pendingDue(task, -3 * HOUR);
    const good = await pendingDue(task, -HOUR);

    const res = await sweepDueSubmissions({
      approve: async (id, opts) => {
        if (id === String(bad.sub._id)) throw new Error("boom");
        return autoApproveSubmission(id, opts);
      },
    });
    expect(res.failed).toEqual([String(bad.sub._id)]);
    expect(res.approved).toEqual([String(good.sub._id)]);
    // The failed one is tried again next time.
    expect((await sweepDueSubmissions()).approved).toEqual([String(bad.sub._id)]);
  });

  it("many sweeps at once still pay each worker once", async () => {
    const { task } = await fundedTask(1000, 10, 10);
    const subs = [await pendingDue(task, -HOUR), await pendingDue(task, -HOUR), await pendingDue(task, -HOUR)];
    await Promise.all(Array.from({ length: 6 }, () => sweepDueSubmissions()));
    for (const s of subs) expect(await coinsOf(s.worker._id)).toBe(10);
    expect(await Task.findById(task._id).then((t) => t?.filledWorkers)).toBe(3);
    expect((await reconcile()).ok).toBe(true);
  });
});
