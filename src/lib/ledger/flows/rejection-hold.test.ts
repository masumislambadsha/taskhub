import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import LedgerAccount from "@/models/LedgerAccount";
import LedgerTransaction from "@/models/LedgerTransaction";
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
import { createFundedTask, deleteFundedTask, updateFundedTask } from "@/lib/ledger/flows/tasks";
import { approveSubmission, rejectSubmission, settleRejection } from "@/lib/ledger/flows/submissions";
import { sweepDueHolds } from "@/lib/ledger/flows/rejection-settlement";
import { disputeWindowMs, DEFAULT_DISPUTE_WINDOW_MS } from "@/lib/dispute-window";
import { reconcile } from "@/lib/ledger/reconcile";
import { escrowAccount } from "@/lib/ledger";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_rejection_hold_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  process.env.DISPUTE_WINDOW_MS = String(3 * 24 * 3600 * 1000);
});
afterEach(() => {
  process.env.DISPUTE_WINDOW_MS = "0";
});

const DAY = 24 * 3600 * 1000;
const escrowOf = async (taskId: unknown) =>
  (await LedgerAccount.findById(escrowAccount(String(taskId))))?.balance;

async function setup(buyerCoins = 100, workers = 3, reward = 10) {
  const buyer = await createUser(buyerCoins);
  const res = await createFundedTask({
    buyerId: String(buyer._id),
    buyerName: "Buyer",
    buyerEmail: "buyer@example.test",
    data: taskInput({ requiredWorkers: workers, payableAmount: reward }),
  });
  if (!res.ok) throw new Error("setup failed");
  const worker = await createUser(0);
  const sub = await createPendingSubmission(res.task, worker._id);
  return { buyer, task: res.task, worker, sub };
}
const reject = (buyer: { _id: unknown }, sub: { _id: unknown }) =>
  rejectSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id), reason: "No proof" });

describe("dispute window setting", () => {
  it("is 3 days by default and read from DISPUTE_WINDOW_MS", () => {
    delete process.env.DISPUTE_WINDOW_MS;
    expect(disputeWindowMs()).toBe(DEFAULT_DISPUTE_WINDOW_MS);
    expect(DEFAULT_DISPUTE_WINDOW_MS).toBe(3 * DAY);
    process.env.DISPUTE_WINDOW_MS = "5000";
    expect(disputeWindowMs()).toBe(5000);
    process.env.DISPUTE_WINDOW_MS = "0";
    expect(disputeWindowMs()).toBe(0);
    process.env.DISPUTE_WINDOW_MS = "-1";
    expect(disputeWindowMs()).toBe(DEFAULT_DISPUTE_WINDOW_MS);
  });
});

describe("rejecting holds the reward", () => {
  it("moves no coins and keeps the slot taken until the hold settles", async () => {
    const { buyer, task, sub } = await setup();
    const buyerBefore = await coinsOf(buyer._id);
    const escrowBefore = await escrowOf(task._id);
    const before = Date.now();

    const res = await reject(buyer, sub);

    expect(res.ok).toBe(true);
    const after = await Submission.findById(sub._id);
    expect(after).toMatchObject({ status: "rejected", rejectionReason: "No proof", decidedBy: String(buyer._id) });
    expect(after?.rejectionHold?.settledAt).toBeUndefined();
    expect(after!.rejectionHold!.windowEndsAt.getTime()).toBeGreaterThanOrEqual(before + 3 * DAY);
    expect(await coinsOf(buyer._id)).toBe(buyerBefore);
    expect(await escrowOf(task._id)).toBe(escrowBefore);
    expect((await Task.findById(task._id))?.filledWorkers).toBe(1);
    expect(await LedgerTransaction.countDocuments({ idempotencyKey: new RegExp(`${sub._id}$`) })).toBe(0);
    // The held reward still counts, so the books balance.
    expect((await reconcile()).ok).toBe(true);
  });

  it("a rejected submission cannot be approved", async () => {
    const { buyer, sub } = await setup();
    await reject(buyer, sub);
    expect(await approveSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) })).toEqual({ ok: false, reason: "not_found" });
  });

  it("deleting the task during the hold refunds only the open slots, not the held reward", async () => {
    const { buyer, task, sub } = await setup(100, 3, 10); // 3 slots, 1 taken, 30 in escrow
    await reject(buyer, sub);
    const del = await deleteFundedTask({ taskId: String(task._id), buyerId: String(buyer._id) });
    expect(del).toEqual({ ok: true, refunded: 20 });
    expect(await escrowOf(task._id)).toBe(10); // the held reward
    expect((await reconcile()).ok).toBe(true);

    // When the hold settles on a deleted task the reward goes back to the buyer.
    const settled = await settleRejection({ submissionId: String(sub._id), via: "window" });
    expect(settled).toMatchObject({ ok: true, outcome: "refunded" });
    expect(await escrowOf(task._id)).toBe(0);
    expect(await coinsOf(buyer._id)).toBe(100 - 30 + 20 + 10);
    expect((await reconcile()).ok).toBe(true);
  });

  it("works on a task from before the ledger", async () => {
    const buyer = await createUser(0);
    const task = await createPreLedgerTask(buyer._id, { requiredWorkers: 2, filledWorkers: 0, payableAmount: 10 });
    const sub = await createPendingSubmission(task, (await createUser(0))._id);
    expect((await reject(buyer, sub)).ok).toBe(true);
    expect(await escrowOf(task._id)).toBe(20); // opened with the open slot and the held reward
    expect((await reconcile()).escrowMismatches).toEqual([]);
    expect((await settleRejection({ submissionId: String(sub._id), via: "accepted" })).ok).toBe(true);
    expect((await reconcile()).escrowMismatches).toEqual([]);
  });
});

describe("settling", () => {
  it("accepting reopens the slot and leaves the escrow unchanged", async () => {
    const { buyer, task, sub } = await setup();
    await reject(buyer, sub);
    await Task.updateOne({ _id: task._id }, { $set: { status: "closed" } });

    const res = await settleRejection({ submissionId: String(sub._id), via: "accepted" });

    expect(res).toMatchObject({ ok: true, outcome: "reopened" });
    const after = await Task.findById(task._id);
    expect(after).toMatchObject({ filledWorkers: 0, status: "open" });
    expect(await escrowOf(task._id)).toBe(30);
    const s = await Submission.findById(sub._id);
    expect(s?.rejectionHold?.settledAs).toBe("accepted");
    expect(s?.rejectionHold?.settledAt).toBeInstanceOf(Date);
    expect((await reconcile()).ok).toBe(true);
  });

  it("charges the buyer the difference when the payout rose during the hold", async () => {
    const { buyer, task, sub } = await setup(100, 3, 10); // 30 in escrow, buyer 70
    await reject(buyer, sub);
    // The buyer raises the payout from 10 to 15: the 2 open slots cost 10 more.
    const edit = await updateFundedTask({
      taskId: String(task._id),
      buyerId: String(buyer._id),
      data: taskInput({ requiredWorkers: 3, payableAmount: 15 }),
    });
    expect(edit.ok).toBe(true);
    expect(await escrowOf(task._id)).toBe(40); // 2 open slots at 15, plus the held 10
    const buyerBefore = await coinsOf(buyer._id);

    const res = await settleRejection({ submissionId: String(sub._id), via: "window" });

    // The reopened slot is now worth 15, so 5 more is charged.
    expect(res).toMatchObject({ ok: true, outcome: "reopened" });
    expect(await coinsOf(buyer._id)).toBe(buyerBefore - 5);
    expect(await escrowOf(task._id)).toBe(45);
    expect((await Task.findById(task._id))?.filledWorkers).toBe(0);
    expect((await reconcile()).ok).toBe(true);
  });

  it("refunds the difference when the payout fell during the hold", async () => {
    const { buyer, task, sub } = await setup(100, 3, 10);
    await reject(buyer, sub);
    await updateFundedTask({
      taskId: String(task._id),
      buyerId: String(buyer._id),
      data: taskInput({ requiredWorkers: 3, payableAmount: 6 }),
    });
    const buyerBefore = await coinsOf(buyer._id);
    const res = await settleRejection({ submissionId: String(sub._id), via: "window" });
    expect(res).toMatchObject({ ok: true, outcome: "reopened" });
    expect(await coinsOf(buyer._id)).toBe(buyerBefore + 4);
    expect(await escrowOf(task._id)).toBe(18); // 3 open slots at 6
    expect((await reconcile()).ok).toBe(true);
  });

  it("settles exactly once when accept, the window job and the sweep race", async () => {
    const { buyer, task, sub } = await setup();
    await reject(buyer, sub);
    const id = String(sub._id);
    const results = await Promise.all([
      ...Array.from({ length: 5 }, () => settleRejection({ submissionId: id, via: "accepted" })),
      ...Array.from({ length: 5 }, () => settleRejection({ submissionId: id, via: "window" })),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await Task.findById(task._id))?.filledWorkers).toBe(0);
    expect(await escrowOf(task._id)).toBe(30);
    expect((await reconcile()).ok).toBe(true);
  });

  it("refuses to settle a submission that is not held", async () => {
    const { sub } = await setup();
    expect(await settleRejection({ submissionId: String(sub._id), via: "accepted" })).toEqual({ ok: false, reason: "not_found" });
    expect(await settleRejection({ submissionId: String(new mongoose.Types.ObjectId()), via: "window" })).toEqual({ ok: false, reason: "not_found" });
  });

  it("with a zero window, rejecting settles at once as before", async () => {
    process.env.DISPUTE_WINDOW_MS = "0";
    const { buyer, task, sub } = await setup();
    expect((await reject(buyer, sub)).ok).toBe(true);
    expect((await Task.findById(task._id))?.filledWorkers).toBe(0);
    expect((await Submission.findById(sub._id))?.rejectionHold?.settledAt).toBeInstanceOf(Date);
  });
});

describe("sweepDueHolds", () => {
  it("settles only the holds whose window has ended, and is safe to repeat", async () => {
    const { buyer, task } = await setup(500, 10, 10);
    const w1 = await createPendingSubmission(task, (await createUser(0))._id);
    const w2 = await createPendingSubmission(task, (await createUser(0))._id);
    await reject(buyer, w1);
    await reject(buyer, w2);
    await Submission.updateOne({ _id: w1._id }, { $set: { "rejectionHold.windowEndsAt": new Date(Date.now() - 1000) } });

    const first = await sweepDueHolds();
    expect(first.settled).toEqual([String(w1._id)]);
    expect((await Submission.findById(w2._id))?.rejectionHold?.settledAt).toBeUndefined();
    expect((await sweepDueHolds()).settled).toEqual([]);

    const later = await sweepDueHolds({ now: new Date(Date.now() + 4 * DAY) });
    expect(later.settled).toEqual([String(w2._id)]);
    expect((await reconcile()).ok).toBe(true);
  });

  it("reports a failing settlement and carries on with the rest", async () => {
    const { buyer, task } = await setup(500, 10, 10);
    const bad = await createPendingSubmission(task, (await createUser(0))._id);
    const good = await createPendingSubmission(task, (await createUser(0))._id);
    await reject(buyer, bad);
    await reject(buyer, good);
    await Submission.updateMany({ status: "rejected" }, { $set: { "rejectionHold.windowEndsAt": new Date(Date.now() - 1000) } });
    const res = await sweepDueHolds({
      settle: async (id) => {
        if (id === String(bad._id)) throw new Error("boom");
        return settleRejection({ submissionId: id, via: "window" });
      },
    });
    expect(res.failed).toEqual([String(bad._id)]);
    expect(res.settled).toEqual([String(good._id)]);
  });
});
