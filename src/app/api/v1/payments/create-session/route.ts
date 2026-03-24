import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Payment, { IPaymentDoc } from "@/models/Payment";
import Stripe from "stripe";
import { COIN_PACKAGES } from "@/lib/constants";
import { getBkashToken, createBkashPayment } from "@/lib/bkash";
import { initSSLCommerz } from "@/lib/sslcommerz";

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

  // bKash
  if (gateway === "bkash") {
    const payment = await Payment.create({
      userId: session.user.id,
      userEmail: session.user.email ?? "",
      gateway: "bkash",
      coinsPurchased: pkg.coins,
      amount: pkg.price,
      currency: "bdt",
      status: "pending",
    });

    const amountBDT = (pkg.price * 110).toFixed(2);

    try {
      const token = await getBkashToken();
      const bkashURL = await createBkashPayment(
        token,
        amountBDT,
        payment._id.toString(),
      );
      return NextResponse.json({ url: bkashURL });
    } catch (err: unknown) {
      await Payment.findByIdAndDelete(payment._id);
      const msg = err instanceof Error ? err.message : "bKash failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // SSLCommerz
  if (gateway === "sslcommerz") {
    const payment = await Payment.create({
      userId: session.user.id,
      userEmail: session.user.email ?? "",
      gateway: "sslcommerz",
      coinsPurchased: pkg.coins,
      amount: pkg.price,
      currency: "bdt",
      status: "pending",
    });

    const amountBDT = (pkg.price * 110).toFixed(2);

    try {
      const gatewayUrl = await initSSLCommerz(
        amountBDT,
        payment._id.toString(),
        session.user.name ?? "Customer",
        session.user.email ?? "",
      );
      return NextResponse.json({ url: gatewayUrl });
    } catch (err: unknown) {
      await Payment.findByIdAndDelete(payment._id);
      const msg = err instanceof Error ? err.message : "SSLCommerz failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid gateway" }, { status: 400 });
}
