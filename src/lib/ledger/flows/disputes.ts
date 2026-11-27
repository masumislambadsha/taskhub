import mongoose from "mongoose";
import Dispute, { ACTIVE_DISPUTE_STATUSES, type IDisputeDoc } from "@/models/Dispute";
import Submission from "@/models/Submission";
import { escrowAccount, userAccount } from "../accounts";
import { UnknownAccountError } from "../errors";
import { postTransaction } from "../post";
import { inLedgerTransaction } from "../run";
import { settleRejectionInSession } from "./submissions";
import { recordAudit, type AuditContext } from "@/lib/audit";

export const MIN_STATEMENT_LENGTH = 30;
export const MIN_ADMIN_NOTE_LENGTH = 10;
export const MAX_ACTIVE_DISPUTES_PER_WORKER = 3;
/** How long after an appeal the buyer may add a statement. */
export const BUYER_REPLY_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Admins are reminded about a dispute older than this. */
export const ADMIN_SLA_MS = 48 * 60 * 60 * 1000;

export type OpenDisputeResult =
  | { ok: true; dispute: IDisputeDoc }
  | {
      ok: false;
      reason:
        | "not_found"
        | "window_closed"
        | "already_disputed"
        | "statement_too_short"
        | "too_many_open"
        | "invalid_evidence";
    };

const isHttpUrl = (u: unknown) => {
  if (typeof u !== "string") return false;
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:";
  } catch {
    return false;
  }
};

/**
 * A worker appeals a rejection while its hold is open. The submission's hold
 * stops being settled by the window or by "accept"; only the admin's decision
 * or the worker withdrawing the appeal ends it. At most 3 appeals per worker
 * are active at once, and each submission can be appealed once.
 */
export async function openDispute(args: {
  submissionId: string;
  workerId: string;
  statement: string;
  evidence?: string[];
  now?: Date;
}): Promise<OpenDisputeResult> {
  const now = args.now ?? new Date();
  const statement = (args.statement ?? "").trim();
  if (statement.length < MIN_STATEMENT_LENGTH) return { ok: false, reason: "statement_too_short" };
  const evidence = args.evidence ?? [];
  if (evidence.length > 5 || !evidence.every(isHttpUrl)) return { ok: false, reason: "invalid_evidence" };
  if (!mongoose.isValidObjectId(args.submissionId)) return { ok: false, reason: "not_found" };

  return inLedgerTransaction(async (session): Promise<OpenDisputeResult> => {
    const sub = await Submission.findOne({
      _id: args.submissionId,
      workerId: args.workerId,
      status: "rejected",
      "rejectionHold.windowEndsAt": { $exists: true },
      "rejectionHold.settledAt": { $exists: false },
    }).session(session);
    if (!sub) return { ok: false, reason: "not_found" };
    if (sub.rejectionHold?.disputeId) return { ok: false, reason: "already_disputed" };
    if (sub.rejectionHold!.windowEndsAt.getTime() <= now.getTime()) return { ok: false, reason: "window_closed" };

    const active = await Dispute.countDocuments({
      workerId: args.workerId,
      status: { $in: ACTIVE_DISPUTE_STATUSES },
    }).session(session);
    if (active >= MAX_ACTIVE_DISPUTES_PER_WORKER) return { ok: false, reason: "too_many_open" };

    const [dispute] = await Dispute.create(
      [
        {
          submissionId: sub._id,
          taskId: sub.taskId,
          workerId: sub.workerId,
          buyerId: sub.taskBuyerId,
          workerStatement: statement,
          workerEvidence: evidence,
          createdAt: now,
        },
      ],
      { session },
    );
    // The conditional flip makes two simultaneous appeals open one dispute.
    const flipped = await Submission.updateOne(
      { _id: sub._id, "rejectionHold.disputeId": { $exists: false }, "rejectionHold.settledAt": { $exists: false } },
      { $set: { "rejectionHold.disputeId": dispute._id } },
      { session },
    );
    if (flipped.modifiedCount !== 1) return { ok: false, reason: "already_disputed" };
    return { ok: true, dispute };
  }).catch((err) => {
    // The unique index on submissionId: another appeal won the race.
    if ((err as { code?: number }).code === 11000) return { ok: false, reason: "already_disputed" } as const;
    throw err;
  });
}

export type BuyerStatementResult =
  | { ok: true; dispute: IDisputeDoc }
  | { ok: false; reason: "not_found" | "too_late" | "already_answered" | "statement_too_short" };

/** The buyer's one reply, within 48 hours of the appeal and before it is decided. */
export async function addBuyerStatement(args: {
  disputeId: string;
  buyerId: string;
  statement: string;
  now?: Date;
}): Promise<BuyerStatementResult> {
  const now = args.now ?? new Date();
  const statement = (args.statement ?? "").trim();
  if (statement.length < MIN_STATEMENT_LENGTH) return { ok: false, reason: "statement_too_short" };
  if (!mongoose.isValidObjectId(args.disputeId)) return { ok: false, reason: "not_found" };

  const d = await Dispute.findOne({
    _id: args.disputeId,
    buyerId: args.buyerId,
    status: { $in: ACTIVE_DISPUTE_STATUSES },
  }).lean();
  if (!d) return { ok: false, reason: "not_found" };
  if (d.buyerStatement) return { ok: false, reason: "already_answered" };
  if (now.getTime() - d.createdAt.getTime() > BUYER_REPLY_WINDOW_MS) return { ok: false, reason: "too_late" };

  const updated = await Dispute.findOneAndUpdate(
    { _id: d._id, status: { $in: ACTIVE_DISPUTE_STATUSES }, buyerStatement: { $exists: false } },
    { $set: { buyerStatement: statement, buyerStatementAt: now } },
    { returnDocument: "after" },
  );
  return updated ? { ok: true, dispute: updated } : { ok: false, reason: "already_answered" };
}

export type WithdrawDisputeResult =
  | { ok: true; dispute: IDisputeDoc }
  | { ok: false; reason: "not_found" | "buyer_missing" };

/** The worker drops the appeal; the rejection then settles as if they had accepted it. */
export async function withdrawDispute(args: {
  disputeId: string;
  workerId: string;
}): Promise<WithdrawDisputeResult> {
  if (!mongoose.isValidObjectId(args.disputeId)) return { ok: false, reason: "not_found" };
  try {
    return await inLedgerTransaction(async (session): Promise<WithdrawDisputeResult> => {
      const dispute = await Dispute.findOneAndUpdate(
        { _id: args.disputeId, workerId: args.workerId, status: { $in: ACTIVE_DISPUTE_STATUSES } },
        { $set: { status: "withdrawn", resolvedAt: new Date() } },
        { session, returnDocument: "after" },
      );
      if (!dispute) return { ok: false, reason: "not_found" };
      // The hold no longer has an open appeal, so the normal settlement can run.
      await Submission.updateOne(
        { _id: dispute.submissionId },
        { $unset: { "rejectionHold.disputeId": "" } },
        { session },
      );
      const settled = await settleRejectionInSession(session, {
        submissionId: String(dispute.submissionId),
        via: "accepted",
      });
      if (!settled.ok && settled.reason === "buyer_missing") throw new UnknownAccountError("buyer");
      return { ok: true, dispute };
    });
  } catch (err) {
    if (err instanceof UnknownAccountError) return { ok: false, reason: "buyer_missing" };
    throw err;
  }
}

/** An admin picks the dispute up; it moves from `open` to `under_review`. */
export async function claimDispute(args: { disputeId: string; adminId: string }): Promise<boolean> {
  if (!mongoose.isValidObjectId(args.disputeId)) return false;
  const res = await Dispute.updateOne(
    { _id: args.disputeId, status: "open" },
    { $set: { status: "under_review", adminId: args.adminId } },
  );
  return res.modifiedCount === 1;
}

export type DecideDisputeResult =
  | { ok: true; dispute: IDisputeDoc; winner: "worker" | "buyer"; outcome?: "reopened" | "refunded" | "shrunk" }
  | { ok: false; reason: "not_found" | "note_too_short" | "buyer_missing" | "worker_missing" };

/**
 * An admin decides an appeal, once. The decision, the payout or settlement and
 * the audit entry are one transaction.
 *
 * - Worker wins: the held reward is paid to the worker out of the task's escrow
 *   (`dispute-win:<submissionId>`) and the submission becomes `approved`.
 * - Buyer wins: the hold settles like any other rejection: the slot reopens,
 *   or the buyer is refunded if no slot can reopen.
 * The flip of the dispute's status is conditional, so deciding twice is refused.
 */
export async function decideDispute(args: {
  disputeId: string;
  winner: "worker" | "buyer";
  note: string;
  adminId: string;
  audit: AuditContext;
}): Promise<DecideDisputeResult> {
  const note = (args.note ?? "").trim();
  if (note.length < MIN_ADMIN_NOTE_LENGTH) return { ok: false, reason: "note_too_short" };
  if (!mongoose.isValidObjectId(args.disputeId)) return { ok: false, reason: "not_found" };

  try {
    return await inLedgerTransaction(async (session): Promise<DecideDisputeResult> => {
      const dispute = await Dispute.findOneAndUpdate(
        { _id: args.disputeId, status: { $in: ACTIVE_DISPUTE_STATUSES } },
        {
          $set: {
            status: args.winner === "worker" ? "resolved_worker" : "resolved_buyer",
            adminId: args.adminId,
            adminNote: note,
            resolvedAt: new Date(),
          },
        },
        { session, returnDocument: "after" },
      );
      if (!dispute) return { ok: false, reason: "not_found" };

      let outcome: "reopened" | "refunded" | "shrunk" | undefined;
      if (args.winner === "worker") {
        const sub = await Submission.findOneAndUpdate(
          {
            _id: dispute.submissionId,
            status: "rejected",
            "rejectionHold.settledAt": { $exists: false },
            "rejectionHold.disputeId": dispute._id,
          },
          {
            $set: {
              status: "approved",
              decidedAt: new Date(),
              decidedBy: args.adminId,
              "rejectionHold.settledAt": new Date(),
              "rejectionHold.settledAs": "worker_won",
            },
          },
          { session, returnDocument: "after" },
        );
        if (!sub) throw new Error("dispute and submission are out of step");
        await postTransaction(
          {
            type: "dispute_won",
            idempotencyKey: `dispute-win:${sub._id}`,
            entries: [
              { accountId: escrowAccount(sub.taskId), amount: -sub.payableAmount },
              { accountId: userAccount(sub.workerId), amount: sub.payableAmount },
            ],
            meta: { taskId: String(sub.taskId), submissionId: String(sub._id) },
            createdBy: args.adminId,
          },
          session,
        );
      } else {
        const settled = await settleRejectionInSession(session, {
          submissionId: String(dispute.submissionId),
          via: "buyer_won",
        });
        if (!settled.ok) {
          if (settled.reason === "buyer_missing") throw new UnknownAccountError("buyer");
          throw new Error("dispute and submission are out of step");
        }
        outcome = settled.outcome;
      }

      await recordAudit(
        args.audit,
        {
          action: "dispute.decide",
          targetType: "dispute",
          targetId: String(dispute._id),
          before: { status: "under_review" },
          after: {
            winner: args.winner,
            submissionId: String(dispute.submissionId),
            workerId: String(dispute.workerId),
            buyerId: String(dispute.buyerId),
          },
          reason: note,
        },
        session,
      );
      return { ok: true, dispute, winner: args.winner, outcome };
    });
  } catch (err) {
    if (err instanceof UnknownAccountError) {
      return { ok: false, reason: err.accountId.startsWith("user:") ? "worker_missing" : "buyer_missing" };
    }
    throw err;
  }
}
