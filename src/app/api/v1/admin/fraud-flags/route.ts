import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { connectDB } from "@/lib/db";
import FraudFlag from "@/models/FraudFlag";
import Submission from "@/models/Submission";
import User from "@/models/User";

/** The fraud queue, highest severity first, then oldest. `?status=all|dismissed|confirmed` shows reviewed ones. */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(await auth(), "read");
  if (!guard.ok) return guard.response;
  await connectDB();

  const status = new URL(req.url).searchParams.get("status");
  const filter = status === "all" ? {} : { status: ["dismissed", "confirmed"].includes(status ?? "") ? status : "open" };
  const flags = await FraudFlag.find(filter).sort({ createdAt: 1 }).limit(300).lean();
  const severityRank = { high: 0, medium: 1, low: 2 } as const;
  flags.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.createdAt.getTime() - b.createdAt.getTime());

  const subIds = flags.flatMap((f) => [f.submissionId, f.evidence.otherSubmissionId].filter((id): id is NonNullable<typeof id> => Boolean(id)));
  const userIds = flags.flatMap((f) => (f.evidence.otherUserId ? [f.userId, f.evidence.otherUserId] : [f.userId]));
  const [subs, users] = await Promise.all([
    Submission.find({ _id: { $in: subIds } }).select("taskTitle proofImageUrl workerName createdAt").lean(),
    User.find({ _id: { $in: userIds } }).select("name").lean(),
  ]);
  const subBy = new Map(subs.map((s) => [String(s._id), s]));
  const userBy = new Map(users.map((u) => [String(u._id), u.name]));

  return NextResponse.json({
    flags: flags.map((f) => ({
      ...f,
      userName: userBy.get(String(f.userId)) ?? null,
      otherUserName: f.evidence.otherUserId ? (userBy.get(String(f.evidence.otherUserId)) ?? null) : null,
      submission: f.submissionId ? (subBy.get(String(f.submissionId)) ?? null) : null,
      otherSubmission: f.evidence.otherSubmissionId ? (subBy.get(String(f.evidence.otherSubmissionId)) ?? null) : null,
    })),
  });
}
