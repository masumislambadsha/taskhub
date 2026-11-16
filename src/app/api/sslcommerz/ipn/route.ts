import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyAndCreditSSL } from "@/lib/payments/sslcommerz";
import { logger } from "@/lib/logger";
import { withRequestLogging } from "@/lib/with-request-logging";

export const POST = withRequestLogging("/api/sslcommerz/ipn", async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData) as Record<string, string>;

    await connectDB();
    await verifyAndCreditSSL(data.tran_id, data.val_id, "ipn");
  } catch (err) {
    logger.error({ err }, "SSLCommerz IPN error");
  }

  return NextResponse.json({ status: "received" });
});
