// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import Submission from "@/models/Submission";
import Task from "@/models/Task";
import TaskView from "@/models/TaskView";
import User from "@/models/User";
import { createFundedTask } from "@/lib/ledger/flows/tasks";
import { submitWork } from "@/lib/ledger/flows/submissions";
import { createUser, startTestDb, taskInput } from "@/lib/payments/test-utils";
import { dailyCapFor, dhakaDayStart, dhakaNextMidnight } from "./earning-limits";
import { DAILY_EARNING_CAP } from "./trust";

let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  db = await startTestDb("taskhub_earning_limits_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await TaskView.deleteMany({});
});
afterEach(() => {
  delete process.env.EARNING_CAPS;
});

describe("Dhaka day", () => {
  it("starts at 18:00 UTC the evening before, and the next reset is 24 hours later", () => {
    // 2025-03-10 20:00 UTC is 02:00 on March 11 in Dhaka: the day began 18:00 UTC on March 10.
    const now = new Date("2025-03-10T20:00:00Z");
    expect(dhakaDayStart(now).toISOString()).toBe("2025-03-10T18:00:00.000Z");
    expect(dhakaNextMidnight(now).toISOString()).toBe("2025-03-11T18:00:00.000Z");
    // 17:59 UTC is still the same Dhaka day (23:59); 18:00 UTC starts the next.
    expect(dhakaDayStart(new Date("2025-03-10T17:59:59Z")).toISOString()).toBe("2025-03-09T18:00:00.000Z");
    expect(dhakaDayStart(new Date("2025-03-10T18:00:00Z")).toISOString()).toBe("2025-03-10T18:00:00.000Z");
  });

  it("caps come from the level table, or from EARNING_CAPS", () => {
    expect([0, 1, 2, 3].map(dailyCapFor)).toEqual([100, 300, 800, 2000]);
    expect(DAILY_EARNING_CAP[3]).toBe(2000);
    process.env.EARNING_CAPS = "10, 20, 30, 40";
    expect([0, 1, 2, 3].map(dailyCapFor)).toEqual([10, 20, 30, 40]);
    process.env.EARNING_CAPS = "garbage";
    expect(dailyCapFor(0)).toBe(100);
    expect(dailyCapFor(99)).toBe(2000);
  });
});

async function setup(opts: { reward?: number; workers?: number; minSeconds?: number; level?: number } = {}) {
  const buyer = await createUser(100000);
  const worker = await createUser(0);
  await User.updateOne(
    { _id: worker._id },
    { $set: { role: "worker", ...(opts.level !== undefined ? { trust: { score: 50, level: opts.level, components: {}, capped: false, computedAt: new Date() } } : {}) } },
  );
  const make = async (reward = opts.reward ?? 30) => {
    const res = await createFundedTask({
      buyerId: String(buyer._id),
      buyerName: "B",
      buyerEmail: "b@example.test",
      data: { ...taskInput({ requiredWorkers: opts.workers ?? 5, payableAmount: reward }), minSeconds: opts.minSeconds },
    });
    if (!res.ok) throw new Error("setup failed");
    return res.task;
  };
  const submit = (taskId: unknown) =>
    submitWork({
      taskId: String(taskId),
      worker: { id: String(worker._id), name: "W", email: worker.email },
      data: { details: "Done, here are the details.", proofLinks: ["https://example.com/p"] },
    });
  return { buyer, worker, make, submit };
}

describe("daily earning cap", () => {
  it("lets a New worker take 100 coins of work a day, then refuses, and the slot is given back", async () => {
    const { make, submit } = await setup({ reward: 30 });
    const tasks = [await make(), await make(), await make(), await make()];
    for (const t of tasks.slice(0, 3)) expect((await submit(t._id)).ok).toBe(true); // 90 coins
    const refused = await submit(tasks[3]._id); // 90 + 30 > 100
    expect(refused).toMatchObject({ ok: false, reason: "daily_cap", cap: 100, used: 90 });
    if (!refused.ok && refused.reason === "daily_cap") expect(refused.resetsAt.getTime()).toBeGreaterThan(Date.now());
    expect((await Task.findById(tasks[3]._id).lean())?.filledWorkers).toBe(0);
    expect(await Submission.countDocuments({ taskId: tasks[3]._id })).toBe(0);
  });

  it("a higher level has a higher cap, and a rejected submission frees its coins", async () => {
    const skilled = await setup({ reward: 300, level: 2 });
    const [a, b, c] = [await skilled.make(), await skilled.make(), await skilled.make()];
    expect((await skilled.submit(a._id)).ok).toBe(true);
    expect((await skilled.submit(b._id)).ok).toBe(true); // 600 of 800
    expect(await skilled.submit(c._id)).toMatchObject({ ok: false, reason: "daily_cap", cap: 800, used: 600 });
    await Submission.updateOne({ taskId: a._id }, { $set: { status: "rejected" } });
    expect((await skilled.submit(c._id)).ok).toBe(true); // 300 + 300 = 600 again
  });

  it("yesterday's work (Dhaka time) does not count", async () => {
    const { make, submit } = await setup({ reward: 60 });
    const [a, b] = [await make(), await make()];
    expect((await submit(a._id)).ok).toBe(true);
    await Submission.collection.updateOne({ taskId: a._id }, { $set: { createdAt: new Date(dhakaDayStart().getTime() - 1000) } });
    expect((await submit(b._id)).ok).toBe(true);
  });

  it("two submissions at the same moment cannot both squeeze under the cap", async () => {
    const { make, submit } = await setup({ reward: 60 });
    const [a, b] = [await make(), await make()];
    const results = await Promise.all([submit(a._id), submit(b._id)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ reason: "daily_cap" });
    expect((await Submission.aggregate([{ $group: { _id: null, t: { $sum: "$payableAmount" } } }]))[0].t).toBe(60);
  });
});

describe("minimum time on task", () => {
  it("refuses a submission without a view, or too soon, and allows it after the wait", async () => {
    const { worker, make, submit } = await setup({ minSeconds: 120, reward: 10 });
    const task = await make();
    expect(await submit(task._id)).toMatchObject({ ok: false, reason: "too_fast", waitSeconds: 120 });
    expect((await Task.findById(task._id).lean())?.filledWorkers).toBe(0);

    await TaskView.create({ taskId: task._id, workerId: worker._id, viewedAt: new Date(Date.now() - 30_000) });
    const soon = await submit(task._id);
    expect(soon).toMatchObject({ ok: false, reason: "too_fast" });
    if (!soon.ok && soon.reason === "too_fast") expect(soon.waitSeconds).toBeGreaterThan(80);

    await TaskView.updateOne({ taskId: task._id }, { $set: { viewedAt: new Date(Date.now() - 121_000) } });
    expect((await submit(task._id)).ok).toBe(true);
  });

  it("tasks without a minimum are not affected", async () => {
    const { make, submit } = await setup({ reward: 10 });
    expect((await submit((await make())._id)).ok).toBe(true);
  });

  it("the view is recorded once, so reopening does not restart the clock", async () => {
    const { worker, make } = await setup();
    const task = await make();
    const first = new Date(Date.now() - 60_000);
    await TaskView.updateOne({ taskId: task._id, workerId: worker._id }, { $setOnInsert: { viewedAt: first } }, { upsert: true });
    await TaskView.updateOne({ taskId: task._id, workerId: worker._id }, { $setOnInsert: { viewedAt: new Date() } }, { upsert: true });
    expect((await TaskView.findOne({}).lean())?.viewedAt.getTime()).toBe(first.getTime());
    expect(mongoose.connection.readyState).toBe(1);
  });
});
