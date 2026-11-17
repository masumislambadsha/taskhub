import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/roles";
import { connectDB } from "@/lib/db";
import { creditPayment } from "@/lib/payments/credit";
import { logger } from "@/lib/logger";
import { withRequestLogging } from "@/lib/with-request-logging";

export const POST = withRequestLogging("/api/v1/payments/admin-confirm", async function POST(req: NextRequest) {
  const session = await auth();
  const guard = requireAdmin(session, "write");
  if (!guard.ok) return guard.response;

  const { paymentId } = await req.json();
  await connectDB();

  const result = await creditPayment({
    paymentId: String(paymentId),
    gateway: { name: "admin", adminUserId: guard.userId },
  });
  if (!result.credited) {
    logger.warn(
      { paymentId: String(paymentId), adminUserId: guard.userId, reason: result.reason },
      "admin payment confirmation refused",
    );
    return NextResponse.json(
      { error: "Payment not found or already confirmed" },
      { status: 404 },
    );
  }

  logger.info(
    { paymentId: String(paymentId), adminUserId: guard.userId },
    "payment confirmed by admin",
  );
  return NextResponse.json({ ok: true });
});
