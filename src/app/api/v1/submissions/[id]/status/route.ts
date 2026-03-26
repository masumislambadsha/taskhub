import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Submission from "@/models/Submission";
import Task from "@/models/Task";
import User from "@/models/User";
import { createNotification } from "@/lib/notifications";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session || session.user.role !== "buyer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { id } = await params;
  const { action, reason } = await req.json(); 

  const submission = await Submission.findOne({
    _id: id,
    taskBuyerId: session.user.id,
    status: "pending",
  });
  if (!submission)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "approve") {
    submission.status = "approved";
    await submission.save();
    await User.findByIdAndUpdate(submission.workerId, {
      $inc: { coins: submission.payableAmount },
    });
    await createNotification({
      toUserId: submission.workerId.toString(),
      toEmail: submission.workerEmail,
      message: `Your submission for "${submission.taskTitle}" was approved! +${submission.payableAmount} coins`,
      actionRoute: "/worker/submissions",
      type: "success",
    });
  } else if (action === "reject") {
    submission.status = "rejected";
    if (reason?.trim()) submission.rejectionReason = reason.trim();
    await submission.save();
    await Task.findByIdAndUpdate(submission.taskId, {
      $inc: { filledWorkers: -1 },
      status: "open",
    });
    await createNotification({
      toUserId: submission.workerId.toString(),
      toEmail: submission.workerEmail,
      message: `Your submission for "${submission.taskTitle}" was rejected.${reason?.trim() ? ` Reason: ${reason.trim()}` : ""}`,
      actionRoute: "/worker/messages",
      type: "warning",
    });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json(submission);
}
