import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Withdrawal from "@/models/Withdrawal";
import User from "@/models/User";
import { createNotification } from "@/lib/notifications";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { id } = await params;
  const { action, reason } = await req.json(); 

  const withdrawal = await Withdrawal.findOne({ _id: id, status: "pending" });
  if (!withdrawal)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "approve") {
    const worker = await User.findById(withdrawal.workerId);
    if (!worker || worker.coins < withdrawal.coinRequested) {
      return NextResponse.json(
        { error: "Worker has insufficient coins" },
        { status: 400 },
      );
    }
    worker.coins -= withdrawal.coinRequested;
    await worker.save();
    withdrawal.status = "approved";
    withdrawal.processedAt = new Date();
    await withdrawal.save();
    await createNotification({
      toUserId: withdrawal.workerId.toString(),
      toEmail: withdrawal.workerEmail,
      message: `Your withdrawal of ${withdrawal.coinRequested} coins ($${withdrawal.amount}) has been approved.`,
      actionRoute: "/worker/withdrawals",
      type: "success",
    });
  } else {
    withdrawal.status = "rejected";
    withdrawal.processedAt = new Date();
    await withdrawal.save();
    await createNotification({
      toUserId: withdrawal.workerId.toString(),
      toEmail: withdrawal.workerEmail,
      message: `Your withdrawal request of ${withdrawal.coinRequested} coins was rejected.${reason?.trim() ? ` Reason: ${reason.trim()}` : ""}`,
      actionRoute: "/worker/messages",
      type: "warning",
    });
  }

  return NextResponse.json(withdrawal);
}
