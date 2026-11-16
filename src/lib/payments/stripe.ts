import type Stripe from "stripe";
import mongoose from "mongoose";
import Payment from "@/models/Payment";
import { creditPayment, type CreditResult } from "@/lib/payments/credit";
import { logger } from "@/lib/logger";

/** The Checkout Session ID stored on a payment (older payments kept it in gatewayTransactionId). */
export function storedStripeSessionId(payment: {
  stripeSessionId?: string;
  gatewayTransactionId?: string;
}): string | undefined {
  if (payment.stripeSessionId) return payment.stripeSessionId;
  if (payment.gatewayTransactionId?.startsWith("cs_"))
    return payment.gatewayTransactionId;
  return undefined;
}

/**
 * Credits the payment named in a Stripe Checkout Session, but only if Stripe
 * says it is paid, the session is the one created for that payment, and the
 * amount and currency match. `session` must come from Stripe (a verified
 * webhook event or `checkout.sessions.retrieve`), never from the client.
 */
export async function creditStripeSession(
  session: Stripe.Checkout.Session,
  source: string,
): Promise<CreditResult> {
  const paymentId = session.metadata?.paymentId;
  const ctx = { source, paymentId, stripeSessionId: session.id };

  const refuse = (reason: CreditResult["reason"]): CreditResult => {
    logger.warn({ ...ctx, reason }, "payment credit refused");
    return { credited: false, reason };
  };

  if (!paymentId || !mongoose.isValidObjectId(paymentId))
    return refuse("not_found");

  if (session.payment_status !== "paid") {
    logger.warn(
      { ...ctx, paymentStatus: session.payment_status },
      "payment credit refused: Stripe session not paid",
    );
    return { credited: false, reason: "not_paid" };
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) return refuse("not_found");

  const stored = storedStripeSessionId(payment);
  if (stored && stored !== session.id) {
    logger.warn(
      { ...ctx, storedSessionId: stored },
      "payment credit refused: Stripe session does not belong to payment",
    );
    return { credited: false, reason: "gateway_mismatch" };
  }

  if (session.amount_total == null || !session.currency) return refuse("amount_mismatch");

  return creditPayment({
    paymentId,
    expected: { amount: session.amount_total / 100, currency: session.currency },
    gateway: { name: "stripe", transactionId: session.id },
  });
}
