import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { connectDB } from "@/lib/db";
import { markWithdrawalPaid } from "@/lib/ledger/flows/withdrawals";
import { auditContextFrom } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { withRequestLogging } from "@/lib/with-request-logging";

/**
 * The admin paid the worker by hand and enters the external transaction ID.
 * Admin only, with a two-factor step-up. Marks the withdrawal paid and retires
 * the coins, once.
 */
export const POST = withRequestLogging(
  "/api/v1/withdrawals/[id]/pay",
  async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireAdmin(await auth(), "write", { stepUp: true });
    if (!guard.ok) return guard.response;

    const { transactionId } = (await req.json().catch(() => ({}))) as { transactionId?: unknown };
    if (typeof transactionId !== "string")
      return NextResponse.json({ error: "transactionId is required" }, { status: 400 });

    await connectDB();
    const res = await markWithdrawalPaid({
      withdrawalId: (await params).id,
      adminId: guard.userId,
      transactionId,
      audit: auditContextFrom(req, guard),
    });
    if (!res.ok) {
      return res.reason === "transaction_id_required"
        ? NextResponse.json({ error: "Enter the bKash, Nagad or bank transaction ID" }, { status: 400 })
        : NextResponse.json({ error: "Not found, or not approved yet" }, { status: 404 });
    }
    await createNotification({
      toUserId: String(res.withdrawal.workerId),
      toEmail: res.withdrawal.workerEmail,
      message: `Your withdrawal of ${res.withdrawal.coinRequested} coins ($${res.withdrawal.amount}) was paid. Reference: ${res.withdrawal.externalTransactionId}.`,
      actionRoute: "/worker/withdrawals",
      type: "success",
    }).catch(() => {});
    return NextResponse.json(res.withdrawal);
  },
);
