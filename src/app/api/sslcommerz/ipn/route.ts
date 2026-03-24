import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { validateSSLPayment } from "@/lib/sslcommerz";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData) as Record<string, string>;

    const valid = await validateSSLPayment(data.val_id);
    if (valid) {
      await connectDB();
      const payment = await Payment.findOne({
        _id: data.tran_id,
        status: "pending",
      });
      if (payment) {
        payment.status = "success";
        payment.gatewayTransactionId = data.bank_tran_id;
        payment.meta = data;
        await payment.save();
        await User.findByIdAndUpdate(payment.userId, {
          $inc: { coins: payment.coinsPurchased },
        });
      }
    }
  } catch (err) {
    console.error("SSLCommerz IPN error:", err);
  }

  return NextResponse.json({ status: "received" });
}
