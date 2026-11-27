import mongoose from "mongoose";
import Submission, { type ISubmissionDoc } from "@/models/Submission";
import Task, { type ITaskDoc } from "@/models/Task";
import { escrowAccount, userAccount } from "../accounts";
import { InsufficientCoinsError, UnknownAccountError } from "../errors";
import { ensureEscrowOpen } from "../escrow";
import { postTransaction } from "../post";
import { inLedgerTransaction } from "../run";
import { autoApproveAtFrom } from "@/lib/auto-approve";

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
  | { ok: false; reason: "not_found" | "escrow_insufficient" | "insufficient_coins" };

/**
 * Rejects a pending submission (conditional on `pending`) and gives its slot
 * back to the task.
 *
 * Normally no coins move, because the reward stays in escrow for the reopened
 * slot. Two cases move coins, in the same transaction:
 *
 * - The buyer already deleted the task (its open slots were refunded), or the
 *   task is over-subscribed (the buyer lowered the worker count below the
 *   slots already taken): the slot is not reopened and the reward is refunded
 *   to the buyer (`escrow -R, buyer +R`, key `reject-refund:<submissionId>`).
 * - The task's payout was changed after the submission was made: the reopened
 *   slot is worth the task's current payout, not the submission's, so the
 *   difference is charged to or refunded to the buyer (key
 *   `reject-reprice:<submissionId>`). If the buyer cannot afford a higher
 *   payout, the rejection is refused with `insufficient_coins` (an unfunded
 *   slot would otherwise be opened).
 */
export async function rejectSubmission(args: {
  submissionId: string;
  buyerId: string;
  reason?: string;
}): Promise<RejectSubmissionResult> {
  const { submissionId, buyerId, reason } = args;
  try {
    return await inLedgerTransaction(async (session): Promise<RejectSubmissionResult> => {
      const pending = await Submission.findOne({
        _id: submissionId,
        taskBuyerId: buyerId,
        status: "pending",
      }).session(session);
      if (!pending) return { ok: false, reason: "not_found" };

      const task = await Task.findById(pending.taskId).session(session).lean();
      const priceDelta = task ? task.payableAmount - pending.payableAmount : 0;
      // A task can hold more filled slots than it now needs (the buyer lowered
      // the worker count after workers had taken slots). Rejecting one of its
      // submissions then reopens nothing, so there is no slot to keep funded.
      const overSubscribed = task
        ? task.filledWorkers - 1 >= task.requiredWorkers
        : false;
      let released = false;
      if (
        task &&
        (task.status === "archived" ||
          task.escrowReleasedAt ||
          priceDelta !== 0 ||
          overSubscribed)
      ) {
        // Pre-ledger task: open its escrow from the state before this rejection.
        released = (await ensureEscrowOpen(pending.taskId, session)).released;
      }
      // No slot reopens: the reward goes back to the buyer.
      const refund = released || overSubscribed;

      const $set: Record<string, unknown> = {
        status: "rejected",
        decidedAt: new Date(),
        decidedBy: buyerId,
      };
      if (reason) $set.rejectionReason = reason;
      const submission = await Submission.findOneAndUpdate(
        { _id: submissionId, taskBuyerId: buyerId, status: "pending" },
        { $set },
        { session, returnDocument: "after" },
      );
      if (!submission) return { ok: false, reason: "not_found" };

      if (task) {
        await Task.updateOne(
          { _id: task._id },
          refund
            ? { $inc: { filledWorkers: -1 } }
            : { $inc: { filledWorkers: -1 }, $set: { status: "open" } },
          { session },
        );
        const escrow = escrowAccount(task._id);
        const buyer = userAccount(buyerId);
        if (refund) {
          await postTransaction(
            {
              type: "submission_reject_refund",
              idempotencyKey: `reject-refund:${submissionId}`,
              entries: [
                { accountId: escrow, amount: -submission.payableAmount },
                { accountId: buyer, amount: submission.payableAmount },
              ],
              meta: { taskId: String(task._id), submissionId },
              createdBy: buyerId,
            },
            session,
          );
        } else if (priceDelta !== 0) {
          await postTransaction(
            {
              type: "task_reprice",
              idempotencyKey: `reject-reprice:${submissionId}`,
              entries:
                priceDelta > 0
                  ? [
                      { accountId: buyer, amount: -priceDelta },
                      { accountId: escrow, amount: priceDelta },
                    ]
                  : [
                      { accountId: escrow, amount: priceDelta },
                      { accountId: buyer, amount: -priceDelta },
                    ],
              meta: { taskId: String(task._id), submissionId },
              createdBy: buyerId,
            },
            session,
          );
        }
      }
      return { ok: true, submission };
    });
  } catch (err) {
    if (err instanceof InsufficientCoinsError) {
      return {
        ok: false,
        reason: err.accountId.startsWith("user:") ? "insufficient_coins" : "escrow_insufficient",
      };
    }
    if (err instanceof UnknownAccountError) return { ok: false, reason: "escrow_insufficient" };
    throw err;
  }
}
