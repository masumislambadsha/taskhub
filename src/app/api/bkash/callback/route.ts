import { NextRequest, NextResponse } from "next/server";
import { receivePaymentEvent } from "@/lib/payments/events";
import { logger } from "@/lib/logger";
import { withRequestLogging } from "@/lib/with-request-logging";

const BASE = process.env.NEXTAUTH_URL!;

export const GET = withRequestLogging("/api/bkash/callback", async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const paymentID = searchParams.get("paymentID");
  const status = searchParams.get("status");

  if (status === "cancel" || status === "failure" || !paymentID) {
    return NextResponse.redirect(`${BASE}/buyer/coins?cancelled=1`);
  }

  try {
    const result = await receivePaymentEvent({
      provider: "bkash",
      eventId: paymentID,
      type: "callback",
      payload: { paymentID },
    });

    if (!result.ok) {
      return NextResponse.redirect(`${BASE}/buyer/coins?cancelled=1`);
    }

    return NextResponse.redirect(
      `${BASE}/buyer/coins?success=1&paymentId=${result.paymentId}`,
    );
  } catch (err) {
    logger.error({ err }, "bKash callback error");
    return NextResponse.redirect(`${BASE}/buyer/coins?cancelled=1`);
  }
});
