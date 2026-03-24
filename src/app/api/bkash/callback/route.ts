import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { executeBkashPayment } from "@/lib/bkash";

const BASE = process.env.NEXTAUTH_URL!;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const paymentID = searchParams.get("paymentID");
  const status = searchParams.get("status");

  if (status === "cancel" || status === "failure" || !paymentID) {
    return NextResponse.redirect(`${BASE}/buyer/coins?cancelled=1`);
  }

  try {
    const execData = await executeBkashPayment(paymentID);

    if (
      execData.statusCode !== "0000" ||
      execData.transactionStatus !== "Completed"
    ) {
      return NextResponse.redirect(`${BASE}/buyer/coins?cancelled=1`);
    }

    const dbPaymentId = execData.merchantInvoiceNumber;

    await connectDB();
    const payment = await Payment.findOne({
      _id: dbPaymentId,
      status: "pending",
    });

    if (payment) {
      payment.status = "success";
      payment.gatewayTransactionId = execData.trxID;
      payment.meta = execData;
      await payment.save();
      await User.findByIdAndUpdate(payment.userId, {
        $inc: { coins: payment.coinsPurchased },
      });
    }

    return NextResponse.redirect(
      `${BASE}/buyer/coins?success=1&paymentId=${dbPaymentId}`,
    );
  } catch (err) {
    console.error("bKash callback error:", err);
    return NextResponse.redirect(`${BASE}/buyer/coins?cancelled=1`);
  }
}
