import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Dispute from "@/models/Dispute";
import Submission from "@/models/Submission";
import { openDispute } from "@/lib/ledger/flows/disputes";
import { drainOutboxQuietly } from "@/lib/outbox";
import { refuseDemoAdmin } from "@/lib/roles";
import { withIdempotency } from "@/lib/idempotency";
import { withRequestLogging } from "@/lib/with-request-logging";

/** A worker's disputes, or a buyer's disputes about their rejections. */
export async function GET() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session || (role !== "worker" && role !== "buyer"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const disputes = await Dispute.find(
    role === "worker" ? { workerId: session.user.id } : { buyerId: session.user.id },
  )
    .sort("-createdAt")
    .limit(100)
    .lean();
  const subs = await Submission.find({ _id: { $in: disputes.map((d) => d.submissionId) } })
    .select("taskTitle payableAmount rejectionReason")
    .lean();
  const byId = new Map(subs.map((s) => [String(s._id), s]));
  return NextResponse.json({
    disputes: disputes.map((d) => ({ ...d, submission: byId.get(String(d.submissionId)) ?? null })),
  });
}

const ERRORS: Record<string, [string, number]> = {
  not_found: ["Not found", 404],
  window_closed: ["The time to appeal this rejection has ended", 409],
  already_disputed: ["This rejection has already been appealed", 409],
  statement_too_short: ["Explain why the rejection is unfair (at least 30 characters)", 400],
  too_many_open: ["You can have at most 3 appeals open at once", 409],
  invalid_evidence: ["Evidence must be up to 5 image links", 400],
};

export const POST = withRequestLogging("/api/v1/disputes", async function POST(req: NextRequest) {
  const session = await auth();
  const demo = refuseDemoAdmin(session);
  if (demo) return demo;
  if (!session || session.user.role !== "worker")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return withIdempotency(req, session.user.id, async () => {
    let body: { submissionId?: unknown; statement?: unknown; evidence?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (typeof body.submissionId !== "string" || typeof body.statement !== "string")
      return NextResponse.json({ error: "submissionId and statement are required" }, { status: 400 });
    const evidence = Array.isArray(body.evidence) ? body.evidence : [];

    await connectDB();
    const res = await openDispute({
      submissionId: body.submissionId,
      workerId: session.user.id,
      statement: body.statement,
      evidence: evidence as string[],
    });
    if (!res.ok) {
      const [error, status] = ERRORS[res.reason];
      return NextResponse.json({ error }, { status });
    }

    // The buyer's notice was queued with the appeal; send it now.
    await drainOutboxQuietly();
    return NextResponse.json(res.dispute, { status: 201 });
  });
});
