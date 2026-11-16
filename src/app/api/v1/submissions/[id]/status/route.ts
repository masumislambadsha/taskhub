import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Submission from "@/models/Submission";
import { approveSubmission, rejectSubmission } from "@/lib/ledger/flows/submissions";
import { createNotification } from "@/lib/notifications";
import { withRequestLogging } from "@/lib/with-request-logging";

export const PATCH = withRequestLogging("/api/v1/submissions/[id]/status", async function PATCH(
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

  if (action !== "approve" && action !== "reject") {
    // Same outcome as before for an unknown action on a pending submission,
    // but without touching anything.
    const exists = await Submission.exists({
      _id: id,
      taskBuyerId: session.user.id,
      status: "pending",
    });
    if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const escrowProblem = () =>
    NextResponse.json(
      { error: "Task escrow is out of balance; contact support" },
      { status: 409 },
    );

  let submission;
  if (action === "approve") {
    const result = await approveSubmission({ submissionId: id, buyerId: session.user.id });
    if (!result.ok) {
      if (result.reason === "not_found")
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (result.reason === "worker_missing")
        return NextResponse.json(
          { error: "The worker's account no longer exists" },
          { status: 409 },
        );
      return escrowProblem();
    }
    submission = result.submission;
    await createNotification({
      toUserId: submission.workerId.toString(),
      toEmail: submission.workerEmail,
      message: `Your submission for "${submission.taskTitle}" was approved! +${submission.payableAmount} coins`,
      actionRoute: "/worker/submissions",
      type: "success",
    });
  } else {
    const result = await rejectSubmission({
      submissionId: id,
      buyerId: session.user.id,
      reason: reason?.trim() || undefined,
    });
    if (!result.ok) {
      if (result.reason === "not_found")
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (result.reason === "insufficient_coins")
        return NextResponse.json(
          { error: "Insufficient coins to reopen this slot at the task's current payout" },
          { status: 400 },
        );
      return escrowProblem();
    }
    submission = result.submission;
    await createNotification({
      toUserId: submission.workerId.toString(),
      toEmail: submission.workerEmail,
      message: `Your submission for "${submission.taskTitle}" was rejected.${reason?.trim() ? ` Reason: ${reason.trim()}` : ""}`,
      actionRoute: "/worker/messages",
      type: "warning",
    });
  }

  return NextResponse.json(submission);
});
