import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { creditPayment } from "@/lib/payments/credit";
import { logger } from "@/lib/logger";
import { withRequestLogging } from "@/lib/with-request-logging";

export const POST = withRequestLogging("/api/v1/payments/admin-confirm", async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { paymentId } = await req.json();
  await connectDB();

  const result = await creditPayment({
    paymentId: String(paymentId),
    gateway: { name: "admin", adminUserId: session.user.id },
  });
  if (!result.credited) {
    logger.warn(
      { paymentId: String(paymentId), adminUserId: session.user.id, reason: result.reason },
      "admin payment confirmation refused",
    );
    return NextResponse.json(
      { error: "Payment not found or already confirmed" },
      { status: 404 },
    );
  }

  logger.info(
    { paymentId: String(paymentId), adminUserId: session.user.id },
    "payment confirmed by admin",
  );
  return NextResponse.json({ ok: true });
});
