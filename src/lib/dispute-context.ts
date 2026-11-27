import Dispute from "@/models/Dispute";
import Submission from "@/models/Submission";
import Task from "@/models/Task";
import User from "@/models/User";

/** A buyer is flagged once at least 3 of their rejections went to an admin and at least half were overturned. */
export const HARSH_MIN_RESOLVED = 3;
export const HARSH_OVERTURNED_RATE = 0.5;

export async function workerHistory(workerId: string) {
  const [total, approved, rejected, won, lost, withdrawn] = await Promise.all([
    Submission.countDocuments({ workerId }),
    Submission.countDocuments({ workerId, status: "approved" }),
    Submission.countDocuments({ workerId, status: "rejected" }),
    Dispute.countDocuments({ workerId, status: "resolved_worker" }),
    Dispute.countDocuments({ workerId, status: "resolved_buyer" }),
    Dispute.countDocuments({ workerId, status: "withdrawn" }),
  ]);
  const decided = approved + rejected;
  return {
    submissions: total,
    approved,
    rejected,
    approvalRate: decided ? approved / decided : null,
    disputes: { won, lost, withdrawn },
  };
}

export async function buyerHistory(buyerId: string) {
  const [approved, rejected, forWorker, forBuyer, withdrawn] = await Promise.all([
    Submission.countDocuments({ taskBuyerId: buyerId, status: "approved" }),
    Submission.countDocuments({ taskBuyerId: buyerId, status: "rejected" }),
    Dispute.countDocuments({ buyerId, status: "resolved_worker" }),
    Dispute.countDocuments({ buyerId, status: "resolved_buyer" }),
    Dispute.countDocuments({ buyerId, status: "withdrawn" }),
  ]);
  const decided = approved + rejected;
  const resolved = forWorker + forBuyer;
  const overturnedRate = resolved ? forWorker / resolved : null;
  return {
    approved,
    rejected,
    rejectionRate: decided ? rejected / decided : null,
    disputes: { overturned: forWorker, upheld: forBuyer, withdrawn },
    overturnedRate,
    harshReviewer:
      resolved >= HARSH_MIN_RESOLVED && (overturnedRate ?? 0) >= HARSH_OVERTURNED_RATE,
  };
}

/** Everything an admin needs to decide, side by side. No email addresses. */
export async function disputeContext(disputeId: string) {
  const dispute = await Dispute.findById(disputeId).lean();
  if (!dispute) return null;
  const [submission, task, worker, buyer, workerStats, buyerStats] = await Promise.all([
    Submission.findById(dispute.submissionId).lean(),
    Task.findById(dispute.taskId).select("title details submissionInfo payableAmount status").lean(),
    User.findById(dispute.workerId).select("name").lean(),
    User.findById(dispute.buyerId).select("name").lean(),
    workerHistory(String(dispute.workerId)),
    buyerHistory(String(dispute.buyerId)),
  ]);
  return {
    dispute,
    task,
    submission: submission && {
      _id: submission._id,
      details: submission.details,
      proofLinks: submission.proofLinks,
      proofImageUrl: submission.proofImageUrl,
      payableAmount: submission.payableAmount,
      rejectionReason: submission.rejectionReason,
      createdAt: submission.createdAt,
    },
    worker: { name: worker?.name ?? "Deleted user", history: workerStats },
    buyer: { name: buyer?.name ?? "Deleted user", history: buyerStats },
  };
}
