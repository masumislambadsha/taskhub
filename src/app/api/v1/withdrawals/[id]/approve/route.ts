import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { connectDB } from "@/lib/db";
import {
  approveWithdrawal,
  rejectWithdrawal,
} from "@/lib/ledger/flows/withdrawals";
import { createNotification } from "@/lib/notifications";
import { withRequestLogging } from "@/lib/with-request-logging";
import { withIdempotency } from "@/lib/idempotency";
import { auditContextFrom } from "@/lib/audit";

export const PATCH = withRequestLogging("/api/v1/withdrawals/[id]/approve", async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const guard = await requireAdmin(session, "write", { stepUp: true });
  if (!guard.ok) return guard.response;

  return withIdempotency(req, guard.userId, async () => {
    await connectDB();
    const { id } = await params;
    const { action, reason } = await req.json();

    let withdrawal;
    if (action === "approve") {
      const result = await approveWithdrawal({
        withdrawalId: id,
        adminId: guard.userId,
        audit: auditContextFrom(req, guard),
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
        message: `Your withdrawal of ${withdrawal.coinRequested} coins ($${withdrawal.amount}) has been approved. It will be paid shortly.`,
        actionRoute: "/worker/withdrawals",
        type: "success",
      });
    } else {
      const result = await rejectWithdrawal({
        withdrawalId: id,
        audit: auditContextFrom(req, guard),
        reason: typeof reason === "string" && reason.trim() ? reason.trim() : undefined,
      });
      if (!result.ok)
        return result.reason === "reason_required"
          ? NextResponse.json({ error: "A reason of at least 5 characters is required" }, { status: 400 })
          : NextResponse.json({ error: "Not found" }, { status: 404 });
      withdrawal = result.withdrawal;
      await createNotification({
        toUserId: withdrawal.workerId.toString(),
        toEmail: withdrawal.workerEmail,
        message: `Your withdrawal request of ${withdrawal.coinRequested} coins was rejected and the coins were returned.${reason?.trim() ? ` Reason: ${reason.trim()}` : ""}`,
        actionRoute: "/worker/messages",
        type: "warning",
      });
    }

    return NextResponse.json(withdrawal);
  });
});
