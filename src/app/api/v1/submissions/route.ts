import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Submission from "@/models/Submission";
import Task from "@/models/Task";
import { submissionSchema } from "@/lib/validators/submission";
import { createNotification } from "@/lib/notifications";

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
    submissions,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
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
  const task = await Task.findById(body.taskId);
  if (!task || task.status !== "open") {
    return NextResponse.json({ error: "Task not available" }, { status: 400 });
  }

  const existing = await Submission.findOne({
    taskId: body.taskId,
    workerId: session.user.id,
    status: "pending",
  });
  if (existing)
    return NextResponse.json(
      { error: "Submission already pending review" },
      { status: 400 },
    );

  const remaining = task.requiredWorkers - task.filledWorkers;
  if (remaining <= 0)
    return NextResponse.json({ error: "Task is full" }, { status: 400 });

  const submission = await Submission.create({
    taskId: task._id,
    taskTitle: task.title,
    taskBuyerId: task.buyerId,
    taskBuyerName: task.buyerName,
    workerId: session.user.id,
    workerName: session.user.name,
    workerEmail: session.user.email,
    payableAmount: task.payableAmount,
    ...parsed.data,
  });

  task.filledWorkers += 1;
  if (task.filledWorkers >= task.requiredWorkers) task.status = "closed";
  await task.save();

  await createNotification({
    toUserId: task.buyerId.toString(),
    toEmail: task.buyerEmail,
    message: `New submission on "${task.title}" from ${session.user.name}`,
    actionRoute: "/buyer/submissions",
    type: "info",
  });

  return NextResponse.json(submission, { status: 201 });
}
