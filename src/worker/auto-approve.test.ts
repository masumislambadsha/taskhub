import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import Redis from "ioredis";
import { Queue } from "bullmq";
import Notification from "@/models/Notification";
import Outbox from "@/models/Outbox";
import Submission from "@/models/Submission";
import {
  coinsOf,
  createPendingSubmission,
  createUser,
  startTestDb,
  taskInput,
} from "@/lib/payments/test-utils";
import { createFundedTask } from "@/lib/ledger/flows/tasks";
import { submitWork } from "@/lib/ledger/flows/submissions";
import {
  AUTO_APPROVE_QUEUE,
  closeAutoApproveProducer,
  scheduleAutoApprove,
} from "@/lib/queue/auto-approve-queue";
import { reconcile } from "@/lib/ledger/reconcile";

vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));

import { autoApproveAndNotify, startAutoApproveWorker, type AutoApproveRuntime } from "./auto-approve";

const BASE = process.env.TEST_REDIS_URL;
const URL = BASE ? `${BASE}/2` : undefined;

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_auto_approve_worker_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await Promise.all([Notification.deleteMany({}), Outbox.deleteMany({})]);
});

async function fundedTask(coins = 200, workers = 5, reward = 10) {
  const buyer = await createUser(coins);
  const res = await createFundedTask({
    buyerId: String(buyer._id),
    buyerName: "Buyer",
    buyerEmail: buyer.email,
    data: taskInput({ requiredWorkers: workers, payableAmount: reward }),
  });
  if (!res.ok) throw new Error("setup failed");
  return { buyer, task: res.task };
}

async function waitFor<T>(fn: () => Promise<T | false | null | undefined>, ms = 20_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 100));
  }
}

describe("autoApproveAndNotify", () => {
  it("approves and notifies the worker and the buyer", async () => {
    const { task, buyer } = await fundedTask();
    const worker = await createUser(0);
    const sub = await createPendingSubmission(task, worker._id);
    await Submission.updateOne({ _id: sub._id }, { $set: { autoApproveAt: new Date(Date.now() - 1000) } });

    const res = await autoApproveAndNotify(String(sub._id));

    expect(res.status).toBe("approved");
    expect(await coinsOf(worker._id)).toBe(10);
    const notes = await Notification.find({}).lean();
    expect(notes.map((n) => String(n.toUserId)).sort()).toEqual([String(worker._id), String(buyer._id)].sort());
    expect(notes.find((n) => String(n.toUserId) === String(worker._id))?.message).toContain("approved automatically");
  });

  it("does not notify twice for a repeat", async () => {
    const { task } = await fundedTask();
    const sub = await createPendingSubmission(task, (await createUser(0))._id);
    await Submission.updateOne({ _id: sub._id }, { $set: { autoApproveAt: new Date(Date.now() - 1000) } });
    await autoApproveAndNotify(String(sub._id));
    await autoApproveAndNotify(String(sub._id));
    expect(await Notification.countDocuments()).toBe(2);
  });

  it("throws, so the queue retries, when the submission is not due yet", async () => {
    const { task } = await fundedTask();
    const sub = await createPendingSubmission(task, (await createUser(0))._id);
    await Submission.updateOne({ _id: sub._id }, { $set: { autoApproveAt: new Date(Date.now() + 3_600_000) } });
    await expect(autoApproveAndNotify(String(sub._id))).rejects.toThrow(/not due/);
  });
});

describe.skipIf(!URL)("auto-approve worker with Redis", { timeout: 40_000 }, () => {
  let connection: Redis;
  let runtime: AutoApproveRuntime | null = null;

  beforeEach(async () => {
    process.env.REDIS_URL = URL;
    connection = new Redis(URL!, { maxRetriesPerRequest: null });
    const q = new Queue(AUTO_APPROVE_QUEUE, { connection });
    await q.obliterate({ force: true });
    await q.close();
  });
  afterEach(async () => {
    await runtime?.close();
    runtime = null;
    await closeAutoApproveProducer();
    connection.disconnect();
    delete process.env.REDIS_URL;
    delete process.env.AUTO_APPROVE_AFTER_MS;
  });

  it("approves a submission when its delayed job fires", async () => {
    process.env.AUTO_APPROVE_AFTER_MS = "1500";
    const { task } = await fundedTask();
    const worker = await createUser(0);
    const res = await submitWork({
      taskId: String(task._id),
      worker: { id: String(worker._id), name: "W", email: worker.email },
      data: { details: "done" },
    });
    if (!res.ok) throw new Error("submit failed");

    // Stop the startup sweep from doing the work: the submission is not due yet.
    runtime = await startAutoApproveWorker(connection);
    expect(await scheduleAutoApprove(String(res.submission._id), res.submission.autoApproveAt!)).toBe(true);
    expect((await Submission.findById(res.submission._id))?.status).toBe("pending");

    await waitFor(async () => (await Submission.findById(res.submission._id))?.status === "approved");
    const after = await Submission.findById(res.submission._id);
    expect(after?.decidedBy).toBe("system");
    expect(await coinsOf(worker._id)).toBe(10);
    expect((await reconcile()).ok).toBe(true);
  });

  it("approves a submission whose job was lost, through the sweep that runs at startup", async () => {
    const { task } = await fundedTask();
    const worker = await createUser(0);
    const sub = await createPendingSubmission(task, worker._id);
    await Submission.updateOne({ _id: sub._id }, { $set: { autoApproveAt: new Date(Date.now() - 60_000) } });
    // No job was ever scheduled (Redis was wiped, say).

    runtime = await startAutoApproveWorker(connection);

    await waitFor(async () => (await Submission.findById(sub._id))?.status === "approved");
    expect(await coinsOf(worker._id)).toBe(10);
    // The notice is created just after the approval commits, so wait for it.
    await waitFor(async () => (await Notification.countDocuments({ toUserId: String(worker._id) })) === 1);
    expect(await Notification.countDocuments({ toUserId: String(worker._id) })).toBe(1);
  });

  it("settles a rejection when its dispute-window job fires", async () => {
    process.env.DISPUTE_WINDOW_MS = "1200";
    const { task, buyer } = await fundedTask();
    const sub = await createPendingSubmission(task, (await createUser(0))._id);
    const { rejectSubmission } = await import("@/lib/ledger/flows/submissions");
    const { scheduleDisputeWindow } = await import("@/lib/queue/auto-approve-queue");
    runtime = await startAutoApproveWorker(connection);
    const rejected = await rejectSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) });
    if (!rejected.ok) throw new Error("reject failed");
    expect(await scheduleDisputeWindow(String(sub._id), rejected.submission.rejectionHold!.windowEndsAt)).toBe(true);
    expect((await Submission.findById(sub._id))?.rejectionHold?.settledAt).toBeUndefined();

    await waitFor(async () => (await Submission.findById(sub._id))?.rejectionHold?.settledAt);
    expect((await Submission.findById(sub._id))?.rejectionHold?.settledAs).toBe("window");
    // The notice is created just after the settlement commits, so wait for it.
    await waitFor(async () => (await Notification.countDocuments({ message: /now final/ })) === 1);
    expect(await Notification.countDocuments({ message: /now final/ })).toBe(1);
    expect((await reconcile()).ok).toBe(true);
  });

  it("settles a hold whose job was lost, through the startup sweep", async () => {
    process.env.DISPUTE_WINDOW_MS = "1000000";
    const { task, buyer } = await fundedTask();
    const sub = await createPendingSubmission(task, (await createUser(0))._id);
    const { rejectSubmission } = await import("@/lib/ledger/flows/submissions");
    await rejectSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) });
    await Submission.updateOne({ _id: sub._id }, { $set: { "rejectionHold.windowEndsAt": new Date(Date.now() - 1000) } });
    // No window job was ever scheduled.
    runtime = await startAutoApproveWorker(connection);
    await waitFor(async () => (await Submission.findById(sub._id))?.rejectionHold?.settledAt);
    expect((await reconcile()).ok).toBe(true);
  });

  it("sends queued notifications through its scheduled outbox drain", async () => {
    const { queueNotification } = await import("@/lib/outbox");
    await queueNotification(
      { toUserId: String(new mongoose.Types.ObjectId()), toEmail: "x@example.test", message: "queued by a flow" },
      "worker-drain-test",
    );
    // Nothing is sent until a worker runs its drain job.
    expect(await Notification.countDocuments({ outboxKey: "worker-drain-test" })).toBe(0);
    runtime = await startAutoApproveWorker(connection);
    await waitFor(async () => (await Notification.countDocuments({ outboxKey: "worker-drain-test" })) === 1);
  });

  it("registers one repeating sweep however many workers start", async () => {
    runtime = await startAutoApproveWorker(connection);
    const second = await startAutoApproveWorker(connection);
    const schedulers = await runtime.queue.getJobSchedulers();
    await second.close();
    const sweeps = schedulers.filter((s) => s.key === "sweep");
    expect(sweeps).toHaveLength(1);
    expect(sweeps[0].every).toBe(15 * 60 * 1000);
    const drains = schedulers.filter((s) => s.key === "outbox-drain");
    expect(drains).toHaveLength(1);
    expect(drains[0].every).toBe(30 * 1000);
  });

  it("a buyer's decision and the timer at the same moment pay once", async () => {
    process.env.AUTO_APPROVE_AFTER_MS = "1000";
    const { task, buyer } = await fundedTask();
    const worker = await createUser(0);
    const res = await submitWork({
      taskId: String(task._id),
      worker: { id: String(worker._id), name: "W", email: worker.email },
      data: { details: "done" },
    });
    if (!res.ok) throw new Error("submit failed");
    const id = String(res.submission._id);
    runtime = await startAutoApproveWorker(connection);
    await scheduleAutoApprove(id, res.submission.autoApproveAt!);

    const { approveSubmission } = await import("@/lib/ledger/flows/submissions");
    await new Promise((r) => setTimeout(r, 900));
    await approveSubmission({ submissionId: id, buyerId: String(buyer._id) });
    // The timer's job runs after the buyer already decided, and finds nothing to do.
    await waitFor(async () => !(await runtime!.queue.getJob(`auto-approve-${id}`)));

    expect(await coinsOf(worker._id)).toBe(10);
    expect((await reconcile()).ok).toBe(true);
  });
});
