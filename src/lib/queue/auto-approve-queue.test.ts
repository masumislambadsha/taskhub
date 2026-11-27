import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Queue } from "bullmq";
import Redis from "ioredis";
import {
  AUTO_APPROVE_QUEUE,
  cancelDisputeWindow,
  disputeWindowJobId,
  scheduleDisputeWindow,
  autoApproveJobId,
  cancelAutoApprove,
  closeAutoApproveProducer,
  scheduleAutoApprove,
} from "./auto-approve-queue";

// Needs a real Redis: set TEST_REDIS_URL (CI does). Each test file uses its own database number.
const BASE = process.env.TEST_REDIS_URL;
const URL = BASE ? `${BASE}/1` : undefined;
const d = describe.skipIf(!URL);

d("auto-approve queue", () => {
  let inspect: Queue;
  let conn: Redis;

  beforeAll(() => {
    conn = new Redis(URL!, { maxRetriesPerRequest: null });
    inspect = new Queue(AUTO_APPROVE_QUEUE, { connection: conn });
  });
  afterAll(async () => {
    await inspect.close();
    conn.disconnect();
  });
  beforeEach(async () => {
    process.env.REDIS_URL = URL;
    await inspect.obliterate({ force: true });
  });
  afterEach(async () => {
    await closeAutoApproveProducer();
    delete process.env.REDIS_URL;
  });

  it("uses a job ID without colons", () => {
    expect(autoApproveJobId("abc123")).toBe("auto-approve-abc123");
    expect(autoApproveJobId("abc123")).not.toContain(":");
  });

  it("schedules a delayed job named after the submission", async () => {
    const runAt = new Date(Date.now() + 60 * 60 * 1000);
    expect(await scheduleAutoApprove("sub1", runAt)).toBe(true);

    const job = await inspect.getJob("auto-approve-sub1");
    expect(job?.name).toBe("auto-approve");
    expect(job?.data).toEqual({ submissionId: "sub1" });
    expect(await job?.getState()).toBe("delayed");
    expect(job?.opts.attempts).toBe(5);
    expect(job?.opts.delay).toBeGreaterThan(59 * 60 * 1000);
  });

  it("scheduling the same submission twice leaves one job", async () => {
    const runAt = new Date(Date.now() + 60_000);
    await scheduleAutoApprove("sub2", runAt);
    await scheduleAutoApprove("sub2", runAt);
    await Promise.all([scheduleAutoApprove("sub2", runAt), scheduleAutoApprove("sub2", runAt)]);
    expect(await inspect.getDelayedCount()).toBe(1);
  });

  it("cancels the job, and cancelling a missing one is harmless", async () => {
    await scheduleAutoApprove("sub3", new Date(Date.now() + 60_000));
    expect(await inspect.getDelayedCount()).toBe(1);
    await cancelAutoApprove("sub3");
    expect(await inspect.getDelayedCount()).toBe(0);
    await expect(cancelAutoApprove("never-scheduled")).resolves.toBeUndefined();
  });

  it("schedules and cancels the end of a dispute window with its own job ID", async () => {
    expect(disputeWindowJobId("abc")).toBe("dispute-window-abc");
    const runAt = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    expect(await scheduleDisputeWindow("sub5", runAt)).toBe(true);
    expect(await scheduleDisputeWindow("sub5", runAt)).toBe(true);
    expect(await inspect.getDelayedCount()).toBe(1);
    const job = await inspect.getJob("dispute-window-sub5");
    expect(job?.name).toBe("dispute-window");
    await cancelDisputeWindow("sub5");
    expect(await inspect.getDelayedCount()).toBe(0);
    await expect(cancelDisputeWindow("never")).resolves.toBeUndefined();
  });

  it("a runAt in the past schedules with no delay", async () => {
    await scheduleAutoApprove("sub4", new Date(Date.now() - 5000));
    const job = await inspect.getJob("auto-approve-sub4");
    expect(job?.opts.delay).toBe(0);
  });
});

describe("auto-approve queue without Redis", { timeout: 30_000 }, () => {
  afterEach(async () => {
    await closeAutoApproveProducer();
    delete process.env.REDIS_URL;
  });

  it("does nothing and reports false when REDIS_URL is not set", async () => {
    delete process.env.REDIS_URL;
    expect(await scheduleAutoApprove("x", new Date())).toBe(false);
    await expect(cancelAutoApprove("x")).resolves.toBeUndefined();
  });

  it("gives up quickly instead of failing the request when Redis is unreachable", async () => {
    process.env.REDIS_URL = "redis://127.0.0.1:1"; // nothing listens here
    const start = Date.now();
    expect(await scheduleAutoApprove("x", new Date(Date.now() + 1000))).toBe(false);
    await expect(cancelAutoApprove("x")).resolves.toBeUndefined();
    expect(Date.now() - start).toBeLessThan(8000);
  });
});
