import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { connectDB } from "@/lib/db";
import Dispute, { ACTIVE_DISPUTE_STATUSES, DISPUTE_STATUSES } from "@/models/Dispute";
import Submission from "@/models/Submission";
import { ADMIN_SLA_MS } from "@/lib/ledger/flows/disputes";

/** The admin queue, oldest first. `?status=all` or a single status shows resolved ones too. */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(await auth(), "read");
  if (!guard.ok) return guard.response;
  await connectDB();

  const status = new URL(req.url).searchParams.get("status");
  const filter =
    status === "all"
      ? {}
      : status && (DISPUTE_STATUSES as readonly string[]).includes(status)
        ? { status }
        : { status: { $in: ACTIVE_DISPUTE_STATUSES } };
  const disputes = await Dispute.find(filter).sort("createdAt").limit(200).lean();
  const subs = await Submission.find({ _id: { $in: disputes.map((d) => d.submissionId) } })
    .select("taskTitle payableAmount workerName taskBuyerName")
    .lean();
  const byId = new Map(subs.map((s) => [String(s._id), s]));
  const now = Date.now();
  return NextResponse.json({
    disputes: disputes.map((d) => ({
      ...d,
      submission: byId.get(String(d.submissionId)) ?? null,
      ageHours: Math.floor((now - d.createdAt.getTime()) / 3_600_000),
      overdue:
        ACTIVE_DISPUTE_STATUSES.includes(d.status) && now - d.createdAt.getTime() > ADMIN_SLA_MS,
    })),
  });
}
