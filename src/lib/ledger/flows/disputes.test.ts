import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import AuditLog from "@/models/AuditLog";
import Dispute from "@/models/Dispute";
import LedgerAccount from "@/models/LedgerAccount";
import LedgerTransaction from "@/models/LedgerTransaction";
import Notification from "@/models/Notification";
import Submission from "@/models/Submission";
import Task from "@/models/Task";
import User from "@/models/User";
import {
  coinsOf,
  createPendingSubmission,
  createUser,
  startTestDb,
  taskInput,
} from "@/lib/payments/test-utils";
import { createFundedTask, deleteFundedTask } from "@/lib/ledger/flows/tasks";
import { approveSubmission, rejectSubmission, settleRejection } from "@/lib/ledger/flows/submissions";
import { sweepDueHolds } from "@/lib/ledger/flows/rejection-settlement";
import {
  ADMIN_SLA_MS,
  BUYER_REPLY_WINDOW_MS,
  MAX_ACTIVE_DISPUTES_PER_WORKER,
  addBuyerStatement,
  claimDispute,
  decideDispute,
  openDispute,
  withdrawDispute,
} from "@/lib/ledger/flows/disputes";
import { notifyOverdueDisputes } from "@/lib/dispute-sla";
import { drainOutbox } from "@/lib/outbox";
import Outbox from "@/models/Outbox";
import { buyerHistory, workerHistory } from "@/lib/dispute-context";
import { reconcile } from "@/lib/ledger/reconcile";
import { escrowAccount } from "@/lib/ledger";

vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_disputes_test");
  await Dispute.init();
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await Dispute.deleteMany({});
  await Notification.deleteMany({});
  await Outbox.deleteMany({});
  process.env.DISPUTE_WINDOW_MS = String(3 * 24 * 3600 * 1000);
});
afterEach(() => {
  process.env.DISPUTE_WINDOW_MS = "0";
});

const STATEMENT = "I did exactly what the task asked and attached the proof it required.";
const NOTE = "Reviewed both sides and the proof.";
const escrowOf = async (taskId: unknown) =>
  (await LedgerAccount.findById(escrowAccount(String(taskId))))?.balance;
const audit = { actorId: "6b0000000000000000000a01", actorRole: "admin" };

async function setup(slots = 3, reward = 10) {
  const buyer = await createUser(200);
  const created = await createFundedTask({
    buyerId: String(buyer._id), buyerName: "Buyer", buyerEmail: buyer.email,
    data: taskInput({ requiredWorkers: slots, payableAmount: reward }),
  });
  if (!created.ok) throw new Error("setup");
  return { buyer, task: created.task };
}
async function rejected(ctx: { buyer: { _id: unknown }; task: { _id: mongoose.Types.ObjectId; buyerId: mongoose.Types.ObjectId } }, worker?: { _id: mongoose.Types.ObjectId }) {
  const w = worker ?? (await createUser(0));
  const sub = await createPendingSubmission(ctx.task, w._id);
  await rejectSubmission({ submissionId: String(sub._id), buyerId: String(ctx.buyer._id), reason: "Not right" });
  return { worker: w, sub };
}
const appeal = (sub: { _id: unknown }, worker: { _id: unknown }, over: Partial<Parameters<typeof openDispute>[0]> = {}) =>
  openDispute({ submissionId: String(sub._id), workerId: String(worker._id), statement: STATEMENT, ...over });

describe("opening an appeal", () => {
  it("creates one dispute and stops the window from settling the hold", async () => {
    const ctx = await setup();
    const { worker, sub } = await rejected(ctx);
    const res = await appeal(sub, worker, { evidence: ["https://i.ibb.co/extra.png"] });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.dispute).toMatchObject({ status: "open", workerStatement: STATEMENT, workerEvidence: ["https://i.ibb.co/extra.png"] });
    const s = await Submission.findById(sub._id);
    expect(String(s?.rejectionHold?.disputeId)).toBe(String(res.dispute._id));

    // Accepting, the window and the sweep all refuse a disputed hold.
    expect((await settleRejection({ submissionId: String(sub._id), via: "accepted" })).ok).toBe(false);
    expect((await settleRejection({ submissionId: String(sub._id), via: "window" })).ok).toBe(false);
    await Submission.updateOne({ _id: sub._id }, { $set: { "rejectionHold.windowEndsAt": new Date(Date.now() - 1000) } });
    expect((await sweepDueHolds()).settled).toEqual([]);
    expect((await Task.findById(ctx.task._id))?.filledWorkers).toBe(1);
    expect((await reconcile()).ok).toBe(true);
  });

  it("refuses a short statement, bad evidence, someone else's submission and a submission that was not rejected", async () => {
    const ctx = await setup();
    const { worker, sub } = await rejected(ctx);
    expect(await appeal(sub, worker, { statement: "too short" })).toEqual({ ok: false, reason: "statement_too_short" });
    expect(await appeal(sub, worker, { evidence: ["javascript:alert(1)"] })).toEqual({ ok: false, reason: "invalid_evidence" });
    expect(await appeal(sub, worker, { evidence: Array(6).fill("https://x.test/a.png") })).toEqual({ ok: false, reason: "invalid_evidence" });
    const other = await createUser(0);
    expect(await appeal(sub, other)).toEqual({ ok: false, reason: "not_found" });
    const pending = await createPendingSubmission(ctx.task, worker._id as mongoose.Types.ObjectId);
    expect(await appeal(pending, worker)).toEqual({ ok: false, reason: "not_found" });
    expect(await appeal({ _id: "nope" }, worker)).toEqual({ ok: false, reason: "not_found" });
    expect(await Dispute.countDocuments()).toBe(0);
  });

  it("refuses once the window has ended or the hold is settled", async () => {
    const ctx = await setup();
    const { worker, sub } = await rejected(ctx);
    expect(await appeal(sub, worker, { now: new Date(Date.now() + 4 * 24 * 3600 * 1000) })).toEqual({ ok: false, reason: "window_closed" });
    await settleRejection({ submissionId: String(sub._id), via: "accepted" });
    expect(await appeal(sub, worker)).toEqual({ ok: false, reason: "not_found" });
  });

  it("many simultaneous appeals of one rejection open one dispute", async () => {
    const ctx = await setup();
    const { worker, sub } = await rejected(ctx);
    const results = await Promise.all(Array.from({ length: 6 }, () => appeal(sub, worker)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await Dispute.countDocuments()).toBe(1);
  });

  it("allows at most 3 appeals open at once per worker", async () => {
    const ctx = await setup(8);
    const worker = await createUser(0);
    for (let i = 0; i < MAX_ACTIVE_DISPUTES_PER_WORKER; i++) {
      const { sub } = await rejected(ctx, worker);
      expect((await appeal(sub, worker)).ok).toBe(true);
    }
    const { sub } = await rejected(ctx, worker);
    expect(await appeal(sub, worker)).toEqual({ ok: false, reason: "too_many_open" });
  });
});

describe("the buyer's reply", () => {
  it("is accepted once, within 48 hours, from the buyer only", async () => {
    const ctx = await setup();
    const { worker, sub } = await rejected(ctx);
    const res = await appeal(sub, worker);
    if (!res.ok) throw new Error();
    const id = String(res.dispute._id);
    const buyer = String(ctx.buyer._id);

    expect(await addBuyerStatement({ disputeId: id, buyerId: buyer, statement: "short" })).toEqual({ ok: false, reason: "statement_too_short" });
    expect(await addBuyerStatement({ disputeId: id, buyerId: String(worker._id), statement: STATEMENT })).toEqual({ ok: false, reason: "not_found" });
    const late = new Date(Date.now() + BUYER_REPLY_WINDOW_MS + 60_000);
    expect(await addBuyerStatement({ disputeId: id, buyerId: buyer, statement: STATEMENT, now: late })).toEqual({ ok: false, reason: "too_late" });

    expect((await addBuyerStatement({ disputeId: id, buyerId: buyer, statement: STATEMENT })).ok).toBe(true);
    expect(await addBuyerStatement({ disputeId: id, buyerId: buyer, statement: STATEMENT })).toEqual({ ok: false, reason: "already_answered" });
    expect((await Dispute.findById(id))?.buyerStatement).toBe(STATEMENT);
  });
});

describe("withdrawing", () => {
  it("drops the appeal and settles the rejection as accepted", async () => {
    const ctx = await setup();
    const { worker, sub } = await rejected(ctx);
    const res = await appeal(sub, worker);
    if (!res.ok) throw new Error();

    expect((await withdrawDispute({ disputeId: String(res.dispute._id), workerId: String(new mongoose.Types.ObjectId()) })).ok).toBe(false);
    const out = await withdrawDispute({ disputeId: String(res.dispute._id), workerId: String(worker._id) });
    expect(out.ok).toBe(true);
    expect((await Dispute.findById(res.dispute._id))?.status).toBe("withdrawn");
    const s = await Submission.findById(sub._id);
    expect(s?.rejectionHold?.settledAs).toBe("accepted");
    expect((await Task.findById(ctx.task._id))?.filledWorkers).toBe(0);
    expect((await withdrawDispute({ disputeId: String(res.dispute._id), workerId: String(worker._id) })).ok).toBe(false);
    expect((await reconcile()).ok).toBe(true);
  });
});

describe("the admin's decision", () => {
  async function disputed() {
    const ctx = await setup(3, 10);
    const { worker, sub } = await rejected(ctx);
    const res = await appeal(sub, worker);
    if (!res.ok) throw new Error();
    return { ...ctx, worker, sub, dispute: res.dispute };
  }
  const decide = (id: unknown, winner: "worker" | "buyer", note = NOTE) =>
    decideDispute({ disputeId: String(id), winner, note, adminId: audit.actorId, audit });

  it("worker wins: the held reward is paid out of escrow and the submission is approved", async () => {
    const { task, worker, sub, dispute } = await disputed();
    const escrowBefore = await escrowOf(task._id);

    const res = await decide(dispute._id, "worker");

    expect(res.ok).toBe(true);
    expect(await coinsOf(worker._id)).toBe(10);
    expect(await escrowOf(task._id)).toBe(escrowBefore! - 10);
    const s = await Submission.findById(sub._id);
    expect(s).toMatchObject({ status: "approved", decidedBy: audit.actorId });
    expect(s?.rejectionHold?.settledAs).toBe("worker_won");
    expect((await Dispute.findById(dispute._id))).toMatchObject({ status: "resolved_worker", adminNote: NOTE });
    expect((await Task.findById(task._id))?.filledWorkers).toBe(1); // the slot stays used
    const entry = await LedgerTransaction.findOne({ idempotencyKey: `dispute-win:${sub._id}` });
    expect(entry?.type).toBe("dispute_won");
    const log = await AuditLog.find({ action: "dispute.decide" }).lean();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ targetId: String(dispute._id), reason: NOTE, after: { winner: "worker" } });
    expect((await reconcile()).ok).toBe(true);
  });

  it("buyer wins: the rejection stands, the slot reopens and no coins reach the worker", async () => {
    const { task, buyer, worker, sub, dispute } = await disputed();
    const buyerBefore = await coinsOf(buyer._id);
    const res = await decide(dispute._id, "buyer");
    expect(res).toMatchObject({ ok: true, winner: "buyer", outcome: "reopened" });
    expect(await coinsOf(worker._id)).toBe(0);
    expect(await coinsOf(buyer._id)).toBe(buyerBefore);
    expect((await Task.findById(task._id))?.filledWorkers).toBe(0);
    expect((await Submission.findById(sub._id))?.rejectionHold?.settledAs).toBe("buyer_won");
    expect((await Dispute.findById(dispute._id))?.status).toBe("resolved_buyer");
    expect((await reconcile()).ok).toBe(true);
  });

  it("buyer wins on a task that was deleted: the held reward goes back to the buyer", async () => {
    const { task, buyer, dispute } = await disputed();
    await deleteFundedTask({ taskId: String(task._id), buyerId: String(buyer._id) });
    const buyerBefore = await coinsOf(buyer._id);
    const res = await decide(dispute._id, "buyer");
    expect(res).toMatchObject({ ok: true, outcome: "refunded" });
    expect(await coinsOf(buyer._id)).toBe(buyerBefore + 10);
    expect(await escrowOf(task._id)).toBe(0);
    expect((await reconcile()).ok).toBe(true);
  });

  it("cannot be decided twice, even at the same moment", async () => {
    const { worker, dispute } = await disputed();
    const results = await Promise.all([
      decide(dispute._id, "worker"), decide(dispute._id, "buyer"), decide(dispute._id, "worker"),
      decide(dispute._id, "buyer"), decide(dispute._id, "worker"),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await AuditLog.countDocuments({ action: "dispute.decide" })).toBe(1);
    const paid = (await coinsOf(worker._id)) === 10;
    expect((await Dispute.findById(dispute._id))?.status).toBe(paid ? "resolved_worker" : "resolved_buyer");
    expect((await reconcile()).ok).toBe(true);
  });

  it("needs a note, and refuses an unknown or already decided dispute, leaving nothing behind", async () => {
    const { dispute, worker } = await disputed();
    expect(await decide(dispute._id, "worker", "short")).toEqual({ ok: false, reason: "note_too_short" });
    expect(await decide(new mongoose.Types.ObjectId(), "worker")).toEqual({ ok: false, reason: "not_found" });
    expect(await decide("nope", "worker")).toEqual({ ok: false, reason: "not_found" });
    expect((await Dispute.findById(dispute._id))?.status).toBe("open");
    expect(await AuditLog.countDocuments()).toBe(0);
    expect(await coinsOf(worker._id)).toBe(0);
  });

  it("a worker whose account is gone cannot be paid: nothing changes", async () => {
    const { worker, dispute, sub } = await disputed();
    await User.deleteOne({ _id: worker._id });
    const res = await decide(dispute._id, "worker");
    expect(res).toEqual({ ok: false, reason: "worker_missing" });
    expect((await Dispute.findById(dispute._id))?.status).toBe("open");
    expect((await Submission.findById(sub._id))?.status).toBe("rejected");
    expect(await AuditLog.countDocuments()).toBe(0);
  });

  it("a decided dispute cannot be withdrawn or answered, and a claimed one can still be decided", async () => {
    const { buyer, worker, dispute } = await disputed();
    expect(await claimDispute({ disputeId: String(dispute._id), adminId: "a1" })).toBe(true);
    expect(await claimDispute({ disputeId: String(dispute._id), adminId: "a2" })).toBe(false);
    expect((await Dispute.findById(dispute._id))).toMatchObject({ status: "under_review", adminId: "a1" });
    expect((await decide(dispute._id, "buyer")).ok).toBe(true);
    expect((await withdrawDispute({ disputeId: String(dispute._id), workerId: String(worker._id) })).ok).toBe(false);
    expect(await addBuyerStatement({ disputeId: String(dispute._id), buyerId: String(buyer._id), statement: STATEMENT })).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("overdue reminders", () => {
  it("tells every admin once about a dispute older than 48 hours", async () => {
    const ctx = await setup();
    const { worker, sub } = await rejected(ctx);
    const res = await appeal(sub, worker);
    if (!res.ok) throw new Error();
    const a1 = await User.create({ name: "a1", email: "a1@example.test", role: "admin" });
    const a2 = await User.create({ name: "a2", email: "a2@example.test", role: "admin" });
    await User.create({ name: "demo", email: "demo@example.test", role: "demo_admin" });

    expect(await notifyOverdueDisputes()).toEqual([]); // too new
    const later = new Date(Date.now() + ADMIN_SLA_MS + 60_000);
    expect(await notifyOverdueDisputes(later)).toEqual([String(res.dispute._id)]);
    await drainOutbox();
    expect((await Notification.find({ message: /waited more than 48 hours/ }).lean()).map((n) => String(n.toUserId)).sort()).toEqual([String(a1._id), String(a2._id)].sort());
    expect(await notifyOverdueDisputes(later)).toEqual([]);
    await drainOutbox();
    expect(await Notification.countDocuments({ message: /waited more than 48 hours/ })).toBe(2);
  });

  it("simultaneous sweeps send one reminder, and a decided dispute gets none", async () => {
    const ctx = await setup(4);
    const w1 = await rejected(ctx);
    const w2 = await rejected(ctx);
    const d1 = await appeal(w1.sub, w1.worker);
    const d2 = await appeal(w2.sub, w2.worker);
    if (!d1.ok || !d2.ok) throw new Error();
    await User.create({ name: "a", email: "a@example.test", role: "admin" });
    await decideDispute({ disputeId: String(d2.dispute._id), winner: "buyer", note: NOTE, adminId: "a", audit });
    const later = new Date(Date.now() + ADMIN_SLA_MS + 60_000);
    const all = await Promise.all(Array.from({ length: 4 }, () => notifyOverdueDisputes(later)));
    expect(all.flat()).toEqual([String(d1.dispute._id)]);
    await drainOutbox();
    expect(await Notification.countDocuments({ message: /waited more than 48 hours/ })).toBe(1);
  });
});

describe("history for the admin", () => {
  it("counts a worker's and a buyer's approvals, rejections and dispute outcomes, and flags a harsh buyer", async () => {
    const ctx = await setup(10);
    const worker = await createUser(0);
    const ok = await createPendingSubmission(ctx.task, worker._id as mongoose.Types.ObjectId);
    await approveSubmission({ submissionId: String(ok._id), buyerId: String(ctx.buyer._id) });

    for (let i = 0; i < 3; i++) {
      const { sub, worker: w } = await rejected(ctx);
      const d = await appeal(sub, w);
      if (!d.ok) throw new Error();
      await decideDispute({ disputeId: String(d.dispute._id), winner: "worker", note: NOTE, adminId: "a", audit });
    }
    const buyer = await buyerHistory(String(ctx.buyer._id));
    expect(buyer.disputes.overturned).toBe(3);
    expect(buyer.overturnedRate).toBe(1);
    expect(buyer.harshReviewer).toBe(true);

    const w = await workerHistory(String(worker._id));
    expect(w).toMatchObject({ submissions: 1, approved: 1, approvalRate: 1 });
  });
});
