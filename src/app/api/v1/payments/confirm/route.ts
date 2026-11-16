import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Payment from "@/models/Payment";
import { getStripe } from "@/lib/stripe";
import {
  creditStripeSession,
  storedStripeSessionId,
} from "@/lib/payments/stripe";
import { logger } from "@/lib/logger";
import { withRequestLogging } from "@/lib/with-request-logging";

/**
 * Called by the buyer's browser after returning from a gateway. It never
 * trusts the client: coins are only added for a Stripe payment that Stripe
 * itself reports as paid. bKash and SSLCommerz payments are credited by their
 * gateway callbacks, so for those this only reports the current status.
 */
export const POST = withRequestLogging("/api/v1/payments/confirm", async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const paymentId = body?.paymentId;
  if (typeof paymentId !== "string" || !mongoose.isValidObjectId(paymentId))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await connectDB();

  let payment = await Payment.findOne({
    _id: paymentId,
    userId: session.user.id,
  });
  if (!payment)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (payment.status === "pending" && payment.gateway === "stripe") {
    const stripeSessionId = storedStripeSessionId(payment);
    if (!stripeSessionId) {
      // Created before the session ID was stored: nothing to check with Stripe.
      logger.warn(
        { paymentId, userId: session.user.id },
        "payment confirm: no Stripe session stored, returning current status",
      );
    } else {
      try {
        const stripeSession =
          await getStripe().checkout.sessions.retrieve(stripeSessionId);
        if (stripeSession.metadata?.paymentId !== String(payment._id)) {
          logger.warn(
            { paymentId, userId: session.user.id, stripeSessionId },
            "payment credit refused: Stripe session does not belong to payment",
          );
        } else {
          await creditStripeSession(stripeSession, "confirm");
        }
      } catch (err) {
        logger.error(
          { err, paymentId, userId: session.user.id, stripeSessionId },
          "payment confirm: could not check Stripe session",
        );
        return NextResponse.json(
          { error: "Could not verify payment with Stripe" },
          { status: 502 },
        );
      }
      payment = (await Payment.findById(payment._id)) ?? payment;
    }
  } else if (payment.status === "pending") {
    logger.info(
      { paymentId, userId: session.user.id, gateway: payment.gateway },
      "payment confirm: still pending, gateway callback credits it",
    );
  }

  return NextResponse.json({
    status: payment.status,
    coins: payment.coinsPurchased,
  });
});
