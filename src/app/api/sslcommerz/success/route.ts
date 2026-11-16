import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyAndCreditSSL } from "@/lib/payments/sslcommerz";
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

    await connectDB();
    const result = await verifyAndCreditSSL(tran_id, val_id, "success");

    // "already_processed": the IPN (or an earlier call) credited it first.
    if (!result.credited && result.reason !== "already_processed") {
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
