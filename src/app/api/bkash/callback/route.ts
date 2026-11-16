import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { executeBkashPayment } from "@/lib/bkash";
import { creditPayment } from "@/lib/payments/credit";
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
    const execData = await executeBkashPayment(paymentID);
    const dbPaymentId = execData.merchantInvoiceNumber;
    const ctx = { bkashPaymentId: paymentID, paymentId: dbPaymentId };

    if (
      execData.statusCode !== "0000" ||
      execData.transactionStatus !== "Completed"
    ) {
      logger.warn(
        {
          ...ctx,
          statusCode: execData.statusCode,
          transactionStatus: execData.transactionStatus,
        },
        "bKash payment not completed",
      );
      return NextResponse.redirect(`${BASE}/buyer/coins?cancelled=1`);
    }

    if (execData.paymentID !== paymentID || !execData.trxID) {
      logger.warn(
        { ...ctx, reason: "gateway_mismatch" },
        "payment credit refused",
      );
      return NextResponse.redirect(`${BASE}/buyer/coins?cancelled=1`);
    }

    await connectDB();
    const result = await creditPayment({
      paymentId: String(dbPaymentId),
      expected: {
        amount: Number(execData.amount),
        currency: execData.currency,
      },
      gateway: {
        name: "bkash",
        transactionId: execData.trxID,
        meta: execData,
      },
    });

    // "already_processed": an earlier callback for this payment credited it.
    if (!result.credited && result.reason !== "already_processed") {
      return NextResponse.redirect(`${BASE}/buyer/coins?cancelled=1`);
    }

    return NextResponse.redirect(
      `${BASE}/buyer/coins?success=1&paymentId=${dbPaymentId}`,
    );
  } catch (err) {
    logger.error({ err }, "bKash callback error");
    return NextResponse.redirect(`${BASE}/buyer/coins?cancelled=1`);
  }
});
