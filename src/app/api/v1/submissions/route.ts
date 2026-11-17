import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Submission from "@/models/Submission";
import { submitWork } from "@/lib/ledger/flows/submissions";
import { submissionSchema } from "@/lib/validators/submission";
import { createNotification } from "@/lib/notifications";
import { maskEmailFields } from "@/lib/privacy";
import { withRequestLogging } from "@/lib/with-request-logging";

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
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Submission.countDocuments(query),
  ]);

  return NextResponse.json({
    submissions: maskEmailFields(submissions, ["workerEmail"], session.user),
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

  await createNotification({
    toUserId: task.buyerId.toString(),
    toEmail: task.buyerEmail,
    message: `New submission on "${task.title}" from ${session.user.name}`,
    actionRoute: "/buyer/submissions",
    type: "info",
  });

  return NextResponse.json(submission, { status: 201 });
});
