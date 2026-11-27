import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Submission from "@/models/Submission";
import FraudFlag from "@/models/FraudFlag";
import { evaluateLinks, recordSighting } from "@/lib/fraud/signals";
import { submitWork } from "@/lib/ledger/flows/submissions";
import { submissionSchema } from "@/lib/validators/submission";
import { drainOutboxQuietly } from "@/lib/outbox";
import { redactEmailFields } from "@/lib/privacy";
import { withRequestLogging } from "@/lib/with-request-logging";
import { withIdempotency } from "@/lib/idempotency";
import { scheduleAutoApprove, scheduleProofHash } from "@/lib/queue/auto-approve-queue";
import { consume, rateLimitedResponse } from "@/lib/ratelimit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "10");
  const status = searchParams.get("status");

  const query: Record<string, unknown> = {};
  if (session.user.role === "worker") query.workerId = session.user.id;
  if (session.user.role === "buyer") query.taskBuyerId = session.user.id;
  if (status && status !== "all") query.status = status;

  const [submissions, total] = await Promise.all([
    Submission.find(query)
      // Pending work is a to-do list: the one closest to auto-approving comes first.
      .sort(status === "pending" ? "autoApproveAt createdAt" : "-createdAt")
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Submission.countDocuments(query),
  ]);

  // Buyers see a "Possible duplicate proof" badge. Workers never see fraud flags.
  let flagged = new Set<string>();
  if (session.user.role === "buyer" && submissions.length) {
    const flags = await FraudFlag.find({
      submissionId: { $in: submissions.map((s) => s._id) },
      type: "duplicate_proof",
      status: { $in: ["open", "confirmed"] },
    })
      .select("submissionId")
      .lean();
    flagged = new Set(flags.map((f) => String(f.submissionId)));
  }

  return NextResponse.json({
    submissions: redactEmailFields(
      submissions.map((s) => (session.user.role === "buyer" ? { ...s, possibleDuplicateProof: flagged.has(String(s._id)) } : s)),
      ["workerEmail"],
      session.user,
      "workerId",
    ),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export const POST = withRequestLogging("/api/v1/submissions", async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "worker") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await recordSighting(session.user.id, req.headers, "submit");
  await evaluateLinks(session.user.id);

  return withIdempotency(req, session.user.id, async () => {
    // Counted here, so a replayed request does not use up the hour's 30.
    const limit = await consume("submit", session.user.id);
    if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);

    const body = await req.json();
    const parsed = submissionSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );

    await connectDB();
    const result = await submitWork({
      taskId: body.taskId,
      worker: {
        id: session.user.id,
        name: session.user.name ?? "",
        email: session.user.email ?? "",
      },
      data: parsed.data,
    });
    if (!result.ok) {
      const error = {
        not_available: "Task not available",
        pending_exists: "Submission already pending review",
        full: "Task is full",
      }[result.reason];
      return NextResponse.json({ error }, { status: 400 });
    }
    const { submission, task } = result;

    // After the commit. If Redis is down the 15-minute sweep approves on time.
    if (submission.autoApproveAt) {
      await scheduleAutoApprove(String(submission._id), submission.autoApproveAt);
    }

    // Fingerprint the screenshot in the worker; the sweep covers a lost job.
    if (submission.proofImageUrl) await scheduleProofHash(String(submission._id));

    // The buyer's notice was queued with the submission; send it now.
    await drainOutboxQuietly();

    return NextResponse.json(submission, { status: 201 });
  });
});
