import Stripe from "stripe";

// Created on first use so `next build` doesn't need STRIPE_SECRET_KEY.
let stripeClient: Stripe | undefined;
export function getStripe(): Stripe {
  return (stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-02-25.clover",
  }));
}
