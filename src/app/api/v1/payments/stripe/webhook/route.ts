import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { receivePaymentEvent, stripePayload } from "@/lib/payments/events";
import { withRequestLogging } from "@/lib/with-request-logging";

export const POST = withRequestLogging("/api/v1/payments/stripe/webhook", async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // `completed` can fire before an asynchronous payment has settled; only
  // credit when Stripe says the session is paid, or when it later succeeds.
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const s = event.data.object as Stripe.Checkout.Session;
    await receivePaymentEvent({
      provider: "stripe",
      eventId: event.id,
      type: event.type,
      payload: stripePayload(s),
    });
  }

  return NextResponse.json({ ok: true });
});
