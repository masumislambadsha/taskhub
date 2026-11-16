import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  approveWithdrawal,
  rejectWithdrawal,
} from "@/lib/ledger/flows/withdrawals";
import { createNotification } from "@/lib/notifications";
import { withRequestLogging } from "@/lib/with-request-logging";

export const PATCH = withRequestLogging("/api/v1/withdrawals/[id]/approve", async function PATCH(
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

  let withdrawal;
  if (action === "approve") {
    const result = await approveWithdrawal({
      withdrawalId: id,
      adminId: session.user.id,
    });
    if (!result.ok) {
      if (result.reason === "insufficient_coins")
        return NextResponse.json(
          { error: "Worker has insufficient coins" },
          { status: 400 },
        );
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    withdrawal = result.withdrawal;
    await createNotification({
      toUserId: withdrawal.workerId.toString(),
      toEmail: withdrawal.workerEmail,
      message: `Your withdrawal of ${withdrawal.coinRequested} coins ($${withdrawal.amount}) has been approved.`,
      actionRoute: "/worker/withdrawals",
      type: "success",
    });
  } else {
    const result = await rejectWithdrawal({ withdrawalId: id });
    if (!result.ok)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    withdrawal = result.withdrawal;
    await createNotification({
      toUserId: withdrawal.workerId.toString(),
      toEmail: withdrawal.workerEmail,
      message: `Your withdrawal request of ${withdrawal.coinRequested} coins was rejected.${reason?.trim() ? ` Reason: ${reason.trim()}` : ""}`,
      actionRoute: "/worker/messages",
      type: "warning",
    });
  }

  return NextResponse.json(withdrawal);
});
