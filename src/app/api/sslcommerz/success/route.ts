import { NextRequest, NextResponse } from "next/server";
import { receivePaymentEvent } from "@/lib/payments/events";
import { logger } from "@/lib/logger";

const BASE = process.env.NEXTAUTH_URL!;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData) as Record<string, string>;

    const { tran_id, val_id, status } = data;

    if (status !== "VALID" && status !== "VALIDATED") {
      return NextResponse.redirect(`${BASE}/payment-return?status=cancelled`);
    }

    const result = await receivePaymentEvent({
      provider: "sslcommerz",
      eventId: `${tran_id}:${val_id}`,
      type: "success",
      payload: { tran_id, val_id },
    });

    // `ok` includes "already_processed": the IPN (or an earlier call) credited it first.
    if (!result.ok) {
      return NextResponse.redirect(`${BASE}/payment-return?status=cancelled`);
    }

    return NextResponse.redirect(
      `${BASE}/payment-return?status=success&paymentId=${tran_id}`,
    );
  } catch (err) {
    logger.error({ err }, "SSLCommerz success error");
    return NextResponse.redirect(`${BASE}/payment-return?status=cancelled`);
  }
}
