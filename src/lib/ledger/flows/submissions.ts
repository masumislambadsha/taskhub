import mongoose from "mongoose";
import Submission, { type ISubmissionDoc } from "@/models/Submission";
import Task, { type ITaskDoc } from "@/models/Task";
import { escrowAccount, userAccount } from "../accounts";
import { InsufficientCoinsError, UnknownAccountError } from "../errors";
import { ensureEscrowOpen } from "../escrow";
import { postTransaction } from "../post";
import { inLedgerTransaction } from "../run";
import { autoApproveAtFrom } from "@/lib/auto-approve";
import { disputeWindowMs } from "@/lib/dispute-window";
import User from "@/models/User";
import { recordAudit, SYSTEM_AUDIT } from "@/lib/audit";
import { queueNotification } from "@/lib/outbox";

export type SubmitWorkResult =
  | { ok: true; submission: ISubmissionDoc; task: ITaskDoc }
  | { ok: false; reason: "not_available" | "pending_exists" | "full" };

/**
 * Takes a slot on a task and creates the worker's pending submission, in one
 * transaction. No coins move: the slot's reward is already in escrow, and the
 * submission turns an open slot into a pending one.
 *
 * The slot is taken with a conditional update (task open and
 * `filledWorkers < requiredWorkers`), so concurrent workers cannot take more
 * slots than the task has. Every submitter writes the same task document, so
 * concurrent transactions conflict and are retried one after the other; the
 * retried one then sees the other's pending submission, which makes the
 * "already pending" check safe without a unique index. The caller sends any
 * notification after this returns, never inside the transaction.
 */
export async function submitWork(args: {
  taskId: string;
  worker: { id: string; name: string; email: string };
  data: { details: string; proofLinks?: string[]; proofImageUrl?: string };
}): Promise<SubmitWorkResult> {
  const { taskId, worker, data } = args;
  // `taskId` comes from request JSON, so it can be any value at runtime: an
  // operator object would otherwise reach the query filter, and a malformed
  // string would throw a CastError.
  if (typeof taskId !== "string" || !mongoose.isValidObjectId(taskId)) {
    return { ok: false, reason: "not_available" };
  }
  return inLedgerTransaction(async (session): Promise<SubmitWorkResult> => {
    const task = await Task.findOneAndUpdate(
      {
        _id: taskId,
        status: "open",
        $expr: { $lt: ["$filledWorkers", "$requiredWorkers"] },
      },
      { $inc: { filledWorkers: 1 } },
      { session, returnDocument: "after" },
    );

    if (!task) {
      const current = await Task.findById(taskId).session(session).lean();
      if (!current || current.status !== "open") return { ok: false, reason: "not_available" };
      // Same precedence as before: a worker with a pending submission hears that first.
      const pending = await Submission.exists({
        taskId: current._id,
        workerId: worker.id,
        status: "pending",
      }).session(session);
      return { ok: false, reason: pending ? "pending_exists" : "full" };
    }

    // A second slot for the same worker is refused: give the slot just taken
    // back inside this transaction, so the net change is zero.
    const existing = await Submission.findOne({
      taskId: task._id,
      workerId: worker.id,
      status: "pending",
    }).session(session);
    if (existing) {
      await Task.updateOne({ _id: task._id }, { $inc: { filledWorkers: -1 } }, { session });
      return { ok: false, reason: "pending_exists" };
    }

    if (task.filledWorkers >= task.requiredWorkers) {
      await Task.updateOne({ _id: task._id }, { $set: { status: "closed" } }, { session });
      task.status = "closed";
    }

    const [submission] = await Submission.create(
      [
        {
          taskId: task._id,
          taskTitle: task.title,
          taskBuyerId: task.buyerId,
          taskBuyerName: task.buyerName,
          workerId: worker.id,
          workerName: worker.name,
          workerEmail: worker.email,
          payableAmount: task.payableAmount,
          autoApproveAt: autoApproveAtFrom(),
          ...data,
        },
      ],
      { session },
    );
    await queueNotification(
      {
        toUserId: String(task.buyerId),
        toEmail: task.buyerEmail,
        message: `New submission on "${task.title}" from ${worker.name}`,
        actionRoute: "/buyer/submissions",
        type: "info",
      },
      `submission-new:${submission._id}`,
      session,
    );
    return { ok: true, submission, task };
  });
}

export type ApproveSubmissionResult =
  | { ok: true; submission: ISubmissionDoc }
  | { ok: false; reason: "not_found" | "escrow_insufficient" | "worker_missing" };

/**
 * Approves a pending submission and pays the worker out of the task's escrow
 * (`escrow:task:<id> -R, worker +R`, key `approve:<submissionId>`).
 *
 * The status flip is conditional on `pending` and runs in the same transaction
 * as the payout, so approving twice, even concurrently, pays once: the loser
 * finds the submission no longer pending.
 */
export async function approveSubmission(args: {
  submissionId: string;
  buyerId: string;
  /** Who made the decision: the buyer (the default) or "system" for an automatic approval. */
  decidedBy?: string;
}): Promise<ApproveSubmissionResult> {
  const { submissionId, buyerId } = args;
  const decidedBy = args.decidedBy ?? buyerId;
  const bySystem = decidedBy === "system";
  try {
    return await inLedgerTransaction(async (session): Promise<ApproveSubmissionResult> => {
      const pending = await Submission.findOne({
        _id: submissionId,
        taskBuyerId: buyerId,
        status: "pending",
      }).session(session);
      if (!pending) return { ok: false, reason: "not_found" };

      // Pre-ledger task: open its escrow while this submission is still pending.
      await ensureEscrowOpen(pending.taskId, session);

      const submission = await Submission.findOneAndUpdate(
        { _id: submissionId, taskBuyerId: buyerId, status: "pending" },
        { $set: { status: "approved", decidedAt: new Date(), decidedBy }, $unset: { autoApproveError: "" } },
        { session, returnDocument: "after" },
      );
      if (!submission) return { ok: false, reason: "not_found" };

      await postTransaction(
        {
          type: "submission_payout",
          idempotencyKey: `approve:${submissionId}`,
          entries: [
            { accountId: escrowAccount(submission.taskId), amount: -submission.payableAmount },
            { accountId: userAccount(submission.workerId), amount: submission.payableAmount },
          ],
          meta: { taskId: String(submission.taskId), submissionId },
          createdBy: buyerId,
        },
        session,
      );
      // An automatic approval is the platform acting on its own, so it is logged.
      if (bySystem) {
        await recordAudit(
          SYSTEM_AUDIT,
          {
            action: "submission.auto_approve",
            targetType: "submission",
            targetId: submissionId,
            before: { status: "pending" },
            after: { status: "approved", coins: submission.payableAmount, workerId: String(submission.workerId), buyerId },
          },
          session,
        );
      }
      // The notices are queued in this same transaction, so the payout and the
      // message about it exist together.
      await queueNotification(
        {
          toUserId: String(submission.workerId),
          toEmail: submission.workerEmail,
          message: bySystem
            ? `Your submission for "${submission.taskTitle}" was approved automatically. +${submission.payableAmount} coins`
            : `Your submission for "${submission.taskTitle}" was approved! +${submission.payableAmount} coins`,
          actionRoute: "/worker/submissions",
          type: "success",
        },
        `submission-approved:${submissionId}:worker`,
        session,
      );
      if (bySystem) {
        const buyer = await User.findById(buyerId).select("email").session(session).lean();
        if (buyer?.email) {
          await queueNotification(
            {
              toUserId: buyerId,
              toEmail: buyer.email,
              message: `A submission for "${submission.taskTitle}" was approved automatically because it was not reviewed in time.`,
              actionRoute: "/buyer/submissions",
              type: "info",
            },
            `submission-approved:${submissionId}:buyer`,
            session,
          );
        }
      }
      return { ok: true, submission };
    });
  } catch (err) {
    if (err instanceof InsufficientCoinsError) {
      return { ok: false, reason: "escrow_insufficient" };
    }
    if (err instanceof UnknownAccountError) {
      return {
        ok: false,
        reason: err.accountId.startsWith("user:") ? "worker_missing" : "escrow_insufficient",
      };
    }
    throw err;
  }
}

export type RejectSubmissionResult =
  | { ok: true; submission: ISubmissionDoc }
  | { ok: false; reason: "not_found" };

/**
 * Rejects a pending submission (conditional on `pending`). No coins move and
 * the slot stays taken: the reward stays in the task's escrow as a hold until
 * `settleRejection` runs (the worker accepts, the window ends, or an admin
 * decides). That keeps every coin accounted for, so a worker who wins an appeal
 * is paid from the held coins. The slot reopens only when the hold settles,
 * up to `DISPUTE_WINDOW_MS` (3 days) later.
 *
 * With `DISPUTE_WINDOW_MS=0` the hold is settled straight away.
 */
export async function rejectSubmission(args: {
  submissionId: string;
  buyerId: string;
  reason?: string;
}): Promise<RejectSubmissionResult> {
  const { submissionId, buyerId, reason } = args;
  const windowMs = disputeWindowMs();
  const result = await inLedgerTransaction(async (session): Promise<RejectSubmissionResult> => {
    const pending = await Submission.findOne({
      _id: submissionId,
      taskBuyerId: buyerId,
      status: "pending",
    }).session(session);
    if (!pending) return { ok: false, reason: "not_found" };

    // Pre-ledger task: open its escrow from the state before this rejection.
    await ensureEscrowOpen(pending.taskId, session);

    const $set: Record<string, unknown> = {
      status: "rejected",
      decidedAt: new Date(),
      decidedBy: buyerId,
      rejectionHold: { windowEndsAt: new Date(Date.now() + windowMs) },
    };
    if (reason) $set.rejectionReason = reason;
    const submission = await Submission.findOneAndUpdate(
      { _id: submissionId, taskBuyerId: buyerId, status: "pending" },
      { $set },
      { session, returnDocument: "after" },
    );
    if (!submission) return { ok: false, reason: "not_found" };
    await queueNotification(
      {
        toUserId: String(submission.workerId),
        toEmail: submission.workerEmail,
        message: `Your submission for "${submission.taskTitle}" was rejected.${reason ? ` Reason: ${reason}` : ""} You can accept the rejection now, appeal it, or it becomes final after the review window.`,
        actionRoute: "/worker/messages",
        type: "warning",
      },
      `submission-rejected:${submissionId}`,
      session,
    );
    return { ok: true, submission };
  });
  if (!result.ok || windowMs > 0) return result;

  const settled = await settleRejection({ submissionId, via: "window" });
  return settled.ok ? { ok: true, submission: settled.submission } : result;
}

export type SettleRejectionResult =
  | {
      ok: true;
      submission: ISubmissionDoc;
      /** What happened to the slot. */
      outcome: "reopened" | "refunded" | "shrunk";
    }
  | { ok: false; reason: "not_found" | "buyer_missing" };

/**
 * Ends a rejection's hold and gives the slot back, in one transaction. The flip
 * of `rejectionHold.settledAt` is conditional on it being unset, so the worker
 * accepting, the window job and the sweep can all race and it still settles once.
 *
 * What happens to the held reward and the slot:
 * - Normal: the slot reopens. The reward stays in escrow for it. If the task's
 *   payout changed since the submission, the difference is charged to or
 *   refunded to the buyer (`reject-reprice:<id>`).
 * - The task was deleted (open slots already refunded) or is over-subscribed
 *   (the buyer lowered the worker count below the slots taken): no slot
 *   reopens, so the reward is refunded to the buyer (`reject-refund:<id>`).
 * - The payout rose and the buyer cannot afford it: the reward is refunded and
 *   the task loses that slot (`requiredWorkers - 1`), because an unfunded slot
 *   must never be opened.
 */
export async function settleRejection(args: {
  submissionId: string;
  via: "accepted" | "window" | "buyer_won";
}): Promise<SettleRejectionResult> {
  try {
    return await inLedgerTransaction((session) => settleRejectionInSession(session, args));
  } catch (err) {
    if (err instanceof UnknownAccountError) return { ok: false, reason: "buyer_missing" };
    throw err;
  }
}

/**
 * The body of `settleRejection`, for callers that must settle inside a
 * transaction of their own (an admin deciding an appeal also updates the
 * dispute and writes the audit entry). `buyer_won` settles a disputed hold;
 * the other two refuse one, because while an appeal is open only the admin's
 * decision or the worker withdrawing it may end the hold.
 */
export async function settleRejectionInSession(
  session: mongoose.mongo.ClientSession,
  args: { submissionId: string; via: "accepted" | "window" | "buyer_won" },
): Promise<SettleRejectionResult> {
  const { submissionId, via } = args;
  const held = await Submission.findOne({
    _id: submissionId,
    status: "rejected",
    "rejectionHold.windowEndsAt": { $exists: true },
    "rejectionHold.settledAt": { $exists: false },
    ...(via === "buyer_won"
      ? { "rejectionHold.disputeId": { $exists: true } }
      : { "rejectionHold.disputeId": { $exists: false } }),
  }).session(session);
  if (!held) return { ok: false, reason: "not_found" };

  const buyerId = String(held.taskBuyerId);
  const task = await Task.findById(held.taskId).session(session).lean();

  // Pre-ledger task: open its escrow from the state before settling.
  let released = false;
  if (task) released = (await ensureEscrowOpen(held.taskId, session)).released;

  const submission = await Submission.findOneAndUpdate(
    {
      _id: submissionId,
      status: "rejected",
      "rejectionHold.settledAt": { $exists: false },
    },
    { $set: { "rejectionHold.settledAt": new Date(), "rejectionHold.settledAs": via } },
    { session, returnDocument: "after" },
  );
  if (!submission) return { ok: false, reason: "not_found" };
  if (via !== "accepted") {
    await queueNotification(
      {
        toUserId: String(submission.workerId),
        toEmail: submission.workerEmail,
        message: `The rejection of your submission for "${submission.taskTitle}" is now final.`,
        actionRoute: "/worker/submissions",
        type: "info",
      },
      `rejection-final:${submissionId}`,
      session,
    );
  }
  if (!task) return { ok: true, submission, outcome: "refunded" };

  const reward = held.payableAmount;
  const priceDelta = task.payableAmount - reward;
  const overSubscribed = task.filledWorkers - 1 >= task.requiredWorkers;
  const escrow = escrowAccount(task._id);
  const buyer = userAccount(buyerId);

  const refundReward = (outcome: "refunded" | "shrunk") => ({ outcome });
  let outcome: "reopened" | "refunded" | "shrunk";

  if (released || overSubscribed) {
    await Task.updateOne({ _id: task._id }, { $inc: { filledWorkers: -1 } }, { session });
    outcome = refundReward("refunded").outcome;
  } else if (priceDelta > 0) {
    const buyerDoc = await User.findById(buyerId).select("coins").session(session).lean();
    if (!buyerDoc) throw new UnknownAccountError(buyer);
    if ((buyerDoc.coins ?? 0) < priceDelta) {
      await Task.updateOne(
        { _id: task._id },
        { $inc: { filledWorkers: -1, requiredWorkers: -1 } },
        { session },
      );
      outcome = refundReward("shrunk").outcome;
    } else {
      await Task.updateOne(
        { _id: task._id },
        { $inc: { filledWorkers: -1 }, $set: { status: "open" } },
        { session },
      );
      await postTransaction(
        {
          type: "task_reprice",
          idempotencyKey: `reject-reprice:${submissionId}`,
          entries: [
            { accountId: buyer, amount: -priceDelta },
            { accountId: escrow, amount: priceDelta },
          ],
          meta: { taskId: String(task._id), submissionId },
          createdBy: buyerId,
        },
        session,
      );
      outcome = "reopened";
    }
  } else {
    await Task.updateOne(
      { _id: task._id },
      { $inc: { filledWorkers: -1 }, $set: { status: "open" } },
      { session },
    );
    if (priceDelta < 0) {
      await postTransaction(
        {
          type: "task_reprice",
          idempotencyKey: `reject-reprice:${submissionId}`,
          entries: [
            { accountId: escrow, amount: priceDelta },
            { accountId: buyer, amount: -priceDelta },
          ],
          meta: { taskId: String(task._id), submissionId },
          createdBy: buyerId,
        },
        session,
      );
    }
    outcome = "reopened";
  }

  if (outcome !== "reopened") {
    await postTransaction(
      {
        type: "submission_reject_refund",
        idempotencyKey: `reject-refund:${submissionId}`,
        entries: [
          { accountId: escrow, amount: -reward },
          { accountId: buyer, amount: reward },
        ],
        meta: { taskId: String(task._id), submissionId },
        createdBy: buyerId,
      },
      session,
    );
  }
  return { ok: true, submission, outcome };
}
