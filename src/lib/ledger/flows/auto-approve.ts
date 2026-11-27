import Submission, { type ISubmissionDoc } from "@/models/Submission";
import { autoApproveAtFrom } from "@/lib/auto-approve";
import { approveSubmission } from "./submissions";

export type AutoApproveResult =
  | { status: "approved"; submission: ISubmissionDoc }
  /** Nothing to do: already decided, or not due yet. */
  | { status: "skipped"; reason: "not_pending" | "not_due" }
  /** Automatic approval cannot succeed; a person has to look. The submission stays pending. */
  | { status: "blocked"; reason: "escrow_insufficient" | "worker_missing" };

/**
 * Approves a pending submission on the buyer's behalf once its `autoApproveAt`
 * has passed. It uses the same `approveSubmission` as a buyer's click
 * (`decidedBy: "system"`), whose conditional status flip and `approve:<id>`
 * ledger key make a buyer approving at the same moment, a retried job and the
 * sweep all pay the worker exactly once.
 *
 * `toleranceMs` lets a delayed job that fires a moment early (clocks of Redis
 * and the web servers differ a little) still count as due.
 */
export async function autoApproveSubmission(
  submissionId: string,
  opts: { now?: Date; toleranceMs?: number } = {},
): Promise<AutoApproveResult> {
  const now = opts.now ?? new Date();
  const pending = await Submission.findOne({ _id: submissionId, status: "pending" }).lean();
  if (!pending) return { status: "skipped", reason: "not_pending" };
  if (
    !pending.autoApproveAt ||
    pending.autoApproveAt.getTime() - (opts.toleranceMs ?? 0) > now.getTime()
  ) {
    return { status: "skipped", reason: "not_due" };
  }

  const res = await approveSubmission({
    submissionId,
    buyerId: String(pending.taskBuyerId),
    decidedBy: "system",
  });
  if (res.ok) return { status: "approved", submission: res.submission };

  // Someone decided between the read above and the approval.
  if (res.reason === "not_found") return { status: "skipped", reason: "not_pending" };

  // The escrow cannot cover the reward, or the worker's account is gone.
  // Retrying cannot fix either, so remember it and stop the sweep retrying.
  const reason = res.reason === "worker_missing" ? "worker_missing" : "escrow_insufficient";
  await Submission.updateOne(
    { _id: submissionId, status: "pending" },
    { $set: { autoApproveError: reason } },
  );
  return { status: "blocked", reason };
}

export interface SweepResult {
  /** Pending submissions that had no `autoApproveAt` and were given one. */
  backfilled: number;
  approved: string[];
  blocked: string[];
  /** Submissions whose approval threw; they are tried again on the next sweep. */
  failed: string[];
}

/**
 * The safety net behind the delayed jobs: approves every pending submission
 * whose time has passed, in case a job was lost (Redis wiped, a deploy at the
 * wrong moment). Pending submissions that predate auto-approve get a fresh
 * window from now. Safe to run alongside the jobs, because both call
 * `autoApproveSubmission`.
 */
export async function sweepDueSubmissions(
  opts: {
    now?: Date;
    limit?: number;
    /** What approves one submission; defaults to `autoApproveSubmission`. The worker passes one that also notifies. */
    approve?: (submissionId: string, opts: { now: Date }) => Promise<AutoApproveResult>;
  } = {},
): Promise<SweepResult> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 200;
  const result: SweepResult = { backfilled: 0, approved: [], blocked: [], failed: [] };

  const backfill = await Submission.updateMany(
    { status: "pending", autoApproveAt: { $exists: false } },
    { $set: { autoApproveAt: autoApproveAtFrom(now.getTime()) } },
  );
  result.backfilled = backfill.modifiedCount;

  const due = await Submission.find({
    status: "pending",
    autoApproveAt: { $lte: now },
    autoApproveError: { $exists: false },
  })
    .sort("autoApproveAt")
    .limit(limit)
    .select("_id")
    .lean();

  for (const { _id } of due) {
    const id = String(_id);
    try {
      const res = await (opts.approve ?? autoApproveSubmission)(id, { now });
      if (res.status === "approved") result.approved.push(id);
      else if (res.status === "blocked") result.blocked.push(id);
    } catch {
      result.failed.push(id);
    }
  }
  return result;
}
