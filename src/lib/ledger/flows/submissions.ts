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
  | { ok: false; reason: "not_found" | "escrow_insufficient" };

/**
 * Rejects a pending submission (conditional on `pending`) and gives its slot
 * back to the task. No coins move, because the reward stays in escrow for the
 * reopened slot, with one exception: if the buyer already deleted the task
 * (its open slots were refunded), the slot is not reopened and the reward is
 * refunded to the buyer (`escrow -R, buyer +R`, key
 * `reject-refund:<submissionId>`).
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
      let released = false;
      if (task && (task.status === "archived" || task.escrowReleasedAt)) {
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
        if (released) {
          await postTransaction(
            {
              type: "submission_reject_refund",
              idempotencyKey: `reject-refund:${submissionId}`,
              entries: [
                { accountId: escrowAccount(task._id), amount: -submission.payableAmount },
                { accountId: userAccount(buyerId), amount: submission.payableAmount },
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
    if (err instanceof InsufficientCoinsError || err instanceof UnknownAccountError) {
      return { ok: false, reason: "escrow_insufficient" };
    }
    throw err;
  }
}
