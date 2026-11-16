import Submission, { type ISubmissionDoc } from "@/models/Submission";
import Task from "@/models/Task";
import { escrowAccount, userAccount } from "../accounts";
import { InsufficientCoinsError, UnknownAccountError } from "../errors";
import { ensureEscrowOpen } from "../escrow";
import { postTransaction } from "../post";
import { inLedgerTransaction } from "../run";

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
}): Promise<ApproveSubmissionResult> {
  const { submissionId, buyerId } = args;
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
        { $set: { status: "approved" } },
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
 * - The buyer already deleted the task (its open slots were refunded): the
 *   slot is not reopened and the reward is refunded to the buyer
 *   (`escrow -R, buyer +R`, key `reject-refund:<submissionId>`).
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
      let released = false;
      if (
        task &&
        (task.status === "archived" || task.escrowReleasedAt || priceDelta !== 0)
      ) {
        // Pre-ledger task: open its escrow from the state before this rejection.
        released = (await ensureEscrowOpen(pending.taskId, session)).released;
      }

      const $set: Record<string, unknown> = { status: "rejected" };
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
          released
            ? { $inc: { filledWorkers: -1 } }
            : { $inc: { filledWorkers: -1 }, $set: { status: "open" } },
          { session },
        );
        const escrow = escrowAccount(task._id);
        const buyer = userAccount(buyerId);
        if (released) {
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
