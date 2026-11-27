import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import AuditLog from "@/models/AuditLog";
import Notification from "@/models/Notification";
import Outbox from "@/models/Outbox";
import Submission from "@/models/Submission";
import Withdrawal from "@/models/Withdrawal";
import {
  coinsOf,
  createPendingSubmission,
  createUser,
  startTestDb,
  taskInput,
} from "@/lib/payments/test-utils";
import { createFundedTask } from "@/lib/ledger/flows/tasks";
import { approveSubmission, rejectSubmission } from "@/lib/ledger/flows/submissions";
import { approveWithdrawal, confirmWithdrawal, requestWithdrawal } from "@/lib/ledger/flows/withdrawals";
import { inLedgerTransaction } from "@/lib/ledger/run";
import {
  CLAIM_LOCK_MS,
  MAX_ATTEMPTS,
  backoffMs,
  drainOutbox,
  queueNotification,
  queueOutbox,
  retryOutboxRow,
  defaultHandlers,
} from "@/lib/outbox";

vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_outbox_test");
  await Outbox.init();
  await Notification.init();
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await Promise.all([Outbox.deleteMany({}), Notification.deleteMany({})]);
});

const USER = "6b0000000000000000000b01";
const note = (message = "hello") => ({ toUserId: USER, toEmail: "u@example.test", message });
const rows = (filter = {}) => Outbox.find(filter).sort("createdAt").lean();

describe("backoff", () => {
  it("doubles from 30 seconds and stops at an hour", () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([30_000, 60_000, 120_000, 240_000]);
    expect(backoffMs(20)).toBe(3_600_000);
  });
});

describe("queueing", () => {
  it("stores the row with the change, and the same key twice is stored once", async () => {
    await queueNotification(note(), "k1");
    await queueNotification(note("again"), "k1");
    expect(await Outbox.countDocuments()).toBe(1);
    expect((await rows())[0]).toMatchObject({ type: "notification", status: "pending", attempts: 0, idempotencyKey: "k1" });
  });

  it("a queued row disappears with an aborted transaction, and exists after a committed one", async () => {
    await expect(
      inLedgerTransaction(async (session) => {
        await queueNotification(note(), "rolled-back", session);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await Outbox.countDocuments()).toBe(0);

    await inLedgerTransaction(async (session) => {
      await queueNotification(note(), "committed", session);
    });
    expect(await Outbox.countDocuments({ idempotencyKey: "committed" })).toBe(1);
  });
});

describe("draining", () => {
  it("sends each row once and marks it sent", async () => {
    await queueNotification(note("one"), "a");
    await queueNotification(note("two"), "b");
    const res = await drainOutbox();
    expect(res).toEqual({ sent: 2, retried: 0, failed: 0 });
    expect((await Notification.find({}).lean()).map((n) => n.message).sort()).toEqual(["one", "two"]);
    const sent = await rows({ status: "sent" });
    expect(sent).toHaveLength(2);
    expect(sent.every((r) => r.sentAt && !r.claimedAt && r.attempts === 1)).toBe(true);
    expect(await drainOutbox()).toEqual({ sent: 0, retried: 0, failed: 0 });
  });

  it("many drains at once send each row exactly once", async () => {
    for (let i = 0; i < 10; i++) await queueNotification(note(`m${i}`), `k${i}`);
    const send = vi.fn(async () => {});
    await Promise.all(Array.from({ length: 6 }, () => drainOutbox({ handlers: { notification: send } })));
    expect(send).toHaveBeenCalledTimes(10);
    expect(await Outbox.countDocuments({ status: "sent" })).toBe(10);
  });

  it("a failure is retried later with backoff, and the retry can succeed", async () => {
    await queueNotification(note(), "flaky");
    const now = new Date();
    const send = vi.fn().mockRejectedValueOnce(new Error("resend is down")).mockResolvedValue(undefined);

    expect(await drainOutbox({ now, handlers: { notification: send } })).toEqual({ sent: 0, retried: 1, failed: 0 });
    const after = (await rows())[0];
    expect(after).toMatchObject({ status: "pending", attempts: 1, lastError: "resend is down" });
    expect(after.claimedAt).toBeUndefined();
    expect(after.nextAttemptAt.getTime()).toBe(now.getTime() + backoffMs(1));

    // Not due yet: nothing happens.
    expect(await drainOutbox({ now: new Date(now.getTime() + 10_000), handlers: { notification: send } })).toEqual({ sent: 0, retried: 0, failed: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    // Due: it goes out.
    const later = new Date(now.getTime() + backoffMs(1) + 1000);
    expect(await drainOutbox({ now: later, handlers: { notification: send } })).toEqual({ sent: 1, retried: 0, failed: 0 });
    expect((await rows())[0]).toMatchObject({ status: "sent", attempts: 2 });
    expect((await rows())[0].lastError).toBeUndefined();
  });

  it("after the last attempt the row is failed and stays for an admin, who can retry it", async () => {
    await queueNotification(note(), "doomed");
    const send = vi.fn().mockRejectedValue(new Error("nope"));
    let now = new Date();
    let last = { sent: 0, retried: 0, failed: 0 };
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      last = await drainOutbox({ now, handlers: { notification: send } });
      now = new Date(now.getTime() + 2 * 3_600_000);
    }
    expect(last).toEqual({ sent: 0, retried: 0, failed: 1 });
    expect((await rows())[0]).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS, lastError: "nope" });
    expect(await drainOutbox({ now, handlers: { notification: send } })).toEqual({ sent: 0, retried: 0, failed: 0 });

    expect(await retryOutboxRow(String((await rows())[0]._id))).toBe(true);
    expect(await retryOutboxRow(String((await rows())[0]._id))).toBe(false); // already pending
    send.mockResolvedValue(undefined);
    expect(await drainOutbox({ now, handlers: { notification: send } })).toEqual({ sent: 1, retried: 0, failed: 0 });
  });

  it("a worker that crashed after claiming a row does not lose it: it is picked up again", async () => {
    await queueNotification(note(), "crash");
    const claimedAt = new Date();
    // The crash: the row was claimed and the attempt counted, then the process died.
    await Outbox.updateOne({}, { $set: { claimedAt }, $inc: { attempts: 1 } });

    const send = vi.fn(async () => {});
    // Still claimed recently: another drain leaves it alone.
    expect(await drainOutbox({ now: new Date(claimedAt.getTime() + 60_000), handlers: { notification: send } })).toEqual({ sent: 0, retried: 0, failed: 0 });
    expect(send).not.toHaveBeenCalled();
    // The claim is stale: it is taken over and sent.
    const later = new Date(claimedAt.getTime() + CLAIM_LOCK_MS + 1000);
    expect(await drainOutbox({ now: later, handlers: { notification: send } })).toEqual({ sent: 1, retried: 0, failed: 0 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("a repeated delivery changes nothing: a notification is created once even if sent twice", async () => {
    await defaultHandlers.notification({ ...note("once") }, "same-key");
    await defaultHandlers.notification({ ...note("once") }, "same-key");
    expect(await Notification.countDocuments()).toBe(1);
  });

  it("a crash after sending but before marking sent only repeats the send, never doubles the effect", async () => {
    await queueNotification(note("effect"), "after-send-crash");
    // The first attempt sent it, then the process died before marking the row sent.
    await defaultHandlers.notification(note("effect"), "after-send-crash");
    await Outbox.updateOne({}, { $set: { claimedAt: new Date(Date.now() - CLAIM_LOCK_MS - 1000) }, $inc: { attempts: 1 } });

    await drainOutbox();
    expect(await Notification.countDocuments()).toBe(1);
    expect((await rows())[0].status).toBe("sent");
  });

  it("delivers webhooks with the idempotency key and treats a non-2xx answer as a failure", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
        calls.push({ url, headers: init.headers });
        return new Response("", { status: calls.length === 1 ? 503 : 200 });
      }),
    );
    try {
      await queueOutbox({ type: "webhook", payload: { url: "https://hook.test/x", body: { a: 1 } }, idempotencyKey: "wh-1" });
      const now = new Date();
      expect((await drainOutbox({ now })).retried).toBe(1);
      expect((await rows())[0].lastError).toContain("503");
      expect((await drainOutbox({ now: new Date(now.getTime() + backoffMs(1) + 1000) })).sent).toBe(1);
      expect(calls.every((c) => c.headers["Idempotency-Key"] === "wh-1")).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("the flows queue their notices with the change", () => {
  async function funded() {
    const buyer = await createUser(200);
    const created = await createFundedTask({
      buyerId: String(buyer._id), buyerName: "Buyer", buyerEmail: buyer.email,
      data: taskInput({ requiredWorkers: 3, payableAmount: 10 }),
    });
    if (!created.ok) throw new Error("setup");
    return { buyer, task: created.task };
  }

  it("approving pays the worker and queues the notice, but sends nothing until drained", async () => {
    const { buyer, task } = await funded();
    const worker = await createUser(0);
    const sub = await createPendingSubmission(task, worker._id);
    const res = await approveSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) });
    expect(res.ok).toBe(true);
    expect(await coinsOf(worker._id)).toBe(10);
    expect(await Notification.countDocuments()).toBe(0);
    const queued = await rows({ idempotencyKey: `submission-approved:${sub._id}:worker` });
    expect(queued).toHaveLength(1);
    expect(queued[0].payload).toMatchObject({ toUserId: String(worker._id), type: "success" });

    await drainOutbox();
    expect((await Notification.findOne({}))?.message).toContain("approved! +10 coins");
  });

  it("a refused approval queues nothing", async () => {
    const { task } = await funded();
    const sub = await createPendingSubmission(task, (await createUser(0))._id);
    const stranger = await createUser(0);
    const res = await approveSubmission({ submissionId: String(sub._id), buyerId: String(stranger._id) });
    expect(res.ok).toBe(false);
    expect(await Outbox.countDocuments()).toBe(0);
  });

  it("approving the same submission many times at once queues one notice", async () => {
    const { buyer, task } = await funded();
    const sub = await createPendingSubmission(task, (await createUser(0))._id);
    await Promise.all(Array.from({ length: 8 }, () => approveSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id) })));
    expect(await Outbox.countDocuments({ idempotencyKey: `submission-approved:${sub._id}:worker` })).toBe(1);
  });

  it("an automatic approval queues a notice for the worker and one for the buyer", async () => {
    const { buyer, task } = await funded();
    const sub = await createPendingSubmission(task, (await createUser(0))._id);
    await approveSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id), decidedBy: "system" });
    const keys = (await rows()).map((r) => r.idempotencyKey).sort();
    expect(keys).toEqual([`submission-approved:${sub._id}:buyer`, `submission-approved:${sub._id}:worker`].sort());
    expect(await AuditLog.countDocuments({ action: "submission.auto_approve" })).toBe(1);
  });

  it("rejecting queues the worker's notice with the reason", async () => {
    const { buyer, task } = await funded();
    const sub = await createPendingSubmission(task, (await createUser(0))._id);
    process.env.DISPUTE_WINDOW_MS = "100000";
    try {
      await rejectSubmission({ submissionId: String(sub._id), buyerId: String(buyer._id), reason: "No proof" });
    } finally {
      process.env.DISPUTE_WINDOW_MS = "0";
    }
    const queued = await rows({ idempotencyKey: `submission-rejected:${sub._id}` });
    expect(queued).toHaveLength(1);
    expect((queued[0].payload as { message: string }).message).toContain("Reason: No proof");
    void Submission;
  });

  it("withdrawal steps queue their notices with each change", async () => {
    const worker = await createUser(1000);
    const w = { id: String(worker._id), name: "W", email: worker.email };
    const req = await requestWithdrawal({ worker: w, coins: 200, paymentSystem: "bkash", accountNumber: "01700000000" });
    if (!req.ok) throw new Error();
    const id = String(req.withdrawal._id);
    await confirmWithdrawal({ withdrawalId: id, workerId: w.id, token: req.confirmToken });
    await approveWithdrawal({ withdrawalId: id, adminId: "adm" });
    const keys = (await rows()).map((r) => r.idempotencyKey).sort();
    expect(keys).toEqual([`withdrawal-approved:${id}`, `withdrawal-confirmed:${id}`].sort());
    expect((await Withdrawal.findById(id))?.status).toBe("approved");
  });

  it("a failed approval leaves no queued notice (the notice and the change succeed or fail together)", async () => {
    const worker = await createUser(100);
    const w = await Withdrawal.create({
      workerId: worker._id, workerName: "W", workerEmail: worker.email, coinRequested: 200,
      amount: 10, paymentSystem: "bkash", accountNumber: "017", status: "pending", // older, unreserved: needs 200 coins
    });
    const res = await approveWithdrawal({ withdrawalId: String(w._id), adminId: "adm" });
    expect(res).toEqual({ ok: false, reason: "insufficient_coins" });
    expect(await Outbox.countDocuments()).toBe(0);
    expect((await Withdrawal.findById(w._id))?.status).toBe("pending");
  });
});
