import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Payment, { IPaymentDoc } from "@/models/Payment";
import Stripe from "stripe";
import { COIN_PACKAGES } from "@/lib/constants";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "buyer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { packageId, gateway } = await req.json();
  const pkg = COIN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg)
    return NextResponse.json({ error: "Invalid package" }, { status: 400 });

  await connectDB();

  if (gateway === "stripe") {
    const payment = (await Payment.create({
      userId: session.user.id,
      userEmail: session.user.email ?? "",
      gateway: "stripe",
      coinsPurchased: pkg.coins,
      amount: pkg.price,
      currency: "usd",
      status: "pending",
    })) as IPaymentDoc;

    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `${pkg.coins} TaskHub Coins` },
            unit_amount: pkg.price * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXTAUTH_URL}/buyer/coins?success=1&paymentId=${payment._id}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/buyer/coins?cancelled=1`,
      metadata: { paymentId: payment._id.toString(), userId: session.user.id },
    });

    await Payment.findByIdAndUpdate(payment._id, {
      gatewayTransactionId: stripeSession.id,
    });
    return NextResponse.json({ url: stripeSession.url });
  }

  // bKash / SSLCommerz — sandbox stub
  const payment = await Payment.create({
    userId: session.user.id,
    userEmail: session.user.email ?? "",
    gateway,
    coinsPurchased: pkg.coins,
    amount: pkg.price,
    currency: "bdt",
    status: "pending",
  });

  return NextResponse.json({
    url: `${process.env.NEXTAUTH_URL}/buyer/coins?success=1&paymentId=${payment._id}&sandbox=1`,
  });
}
