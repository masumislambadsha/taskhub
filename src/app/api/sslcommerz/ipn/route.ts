import { NextRequest, NextResponse } from "next/server";
import { receivePaymentEvent } from "@/lib/payments/events";
import { logger } from "@/lib/logger";
import { withRequestLogging } from "@/lib/with-request-logging";

export const POST = withRequestLogging("/api/sslcommerz/ipn", async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData) as Record<string, string>;

    await receivePaymentEvent({
      provider: "sslcommerz",
      eventId: `${data.tran_id}:${data.val_id}`,
      type: "ipn",
      payload: { tran_id: data.tran_id, val_id: data.val_id },
    });
  } catch (err) {
    logger.error({ err }, "SSLCommerz IPN error");
  }

  return NextResponse.json({ status: "received" });
});
