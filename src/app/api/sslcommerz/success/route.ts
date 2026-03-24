import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { validateSSLPayment } from "@/lib/sslcommerz";

const BASE = process.env.NEXTAUTH_URL!;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData) as Record<string, string>;

    const { tran_id, val_id, status } = data;

    if (status !== "VALID" && status !== "VALIDATED") {
      return NextResponse.redirect(`${BASE}/payment-return?status=cancelled`);
    }

    const valid = await validateSSLPayment(val_id);
    if (!valid) {
      return NextResponse.redirect(`${BASE}/payment-return?status=cancelled`);
    }

    await connectDB();
    const payment = await Payment.findOne({ _id: tran_id, status: "pending" });

    if (payment) {
      payment.status = "success";
      payment.gatewayTransactionId = data.bank_tran_id;
      payment.meta = data;
      await payment.save();
      await User.findByIdAndUpdate(payment.userId, {
        $inc: { coins: payment.coinsPurchased },
      });
    }

    // Redirect to public page — SSLCommerz POSTs from their server so the
    // browser has no session cookie on this response. The public page then
    // bounces the user (with their cookies) into /buyer/coins.
    return NextResponse.redirect(
      `${BASE}/payment-return?status=success&paymentId=${tran_id}`,
    );
  } catch (err) {
    console.error("SSLCommerz success error:", err);
    return NextResponse.redirect(`${BASE}/payment-return?status=cancelled`);
  }
}
