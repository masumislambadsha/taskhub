import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { connectDB } from "@/lib/db";
import Payment from "@/models/Payment";
import User from "@/models/User";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    const paymentId = s.metadata?.paymentId;
    if (!paymentId) return NextResponse.json({ ok: true });

    await connectDB();
    const payment = await Payment.findById(paymentId);
    if (payment && payment.status === "pending") {
      payment.status = "success";
      payment.gatewayTransactionId = s.payment_intent as string;
      await payment.save();
      await User.findByIdAndUpdate(payment.userId, {
        $inc: { coins: payment.coinsPurchased },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
