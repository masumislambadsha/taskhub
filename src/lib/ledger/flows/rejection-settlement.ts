import Submission from "@/models/Submission";
import { settleRejection, type SettleRejectionResult } from "./submissions";

export interface HoldSweepResult {
  settled: string[];
  failed: string[];
}

/**
 * The safety net behind the dispute-window jobs: settles every rejection whose
 * window has ended and that is still held, in case a job was lost. Safe to run
 * alongside the jobs and the worker's own "accept", because `settleRejection`
 * settles each hold once.
 */
export async function sweepDueHolds(
  opts: {
    now?: Date;
    limit?: number;
    /** What settles one hold; the worker passes one that also notifies. */
    settle?: (submissionId: string) => Promise<SettleRejectionResult>;
  } = {},
): Promise<HoldSweepResult> {
  const now = opts.now ?? new Date();
  const due = await Submission.find({
    status: "rejected",
    "rejectionHold.windowEndsAt": { $lte: now },
    "rejectionHold.settledAt": { $exists: false },
    // A disputed hold is ended by an admin or by the worker withdrawing, never by the clock.
    "rejectionHold.disputeId": { $exists: false },
  })
    .sort("rejectionHold.windowEndsAt")
    .limit(opts.limit ?? 200)
    .select("_id")
    .lean();

  const result: HoldSweepResult = { settled: [], failed: [] };
  for (const { _id } of due) {
    const id = String(_id);
    try {
      const res = await (opts.settle ?? ((sid) => settleRejection({ submissionId: sid, via: "window" })))(id);
      if (res.ok) result.settled.push(id);
      else if (res.reason === "buyer_missing") result.failed.push(id);
    } catch {
      result.failed.push(id);
    }
  }
  return result;
}
