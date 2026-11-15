import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { validateSSLPayment } from "@/lib/sslcommerz";
import { logger } from "@/lib/logger";
import { withRequestLogging } from "@/lib/with-request-logging";

export const POST = withRequestLogging("/api/sslcommerz/ipn", async function POST(req: NextRequest) {
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
        logger.info(
          {
            paymentId: String(payment._id),
            userId: String(payment.userId),
            coins: payment.coinsPurchased,
          },
          "payment credited",
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "SSLCommerz IPN error");
  }

  return NextResponse.json({ status: "received" });
});
