import type Stripe from "stripe";
import { connectDB } from "@/lib/db";
import PaymentEvent, {
  type IPaymentEventDoc,
  type PaymentProvider,
} from "@/models/PaymentEvent";
import { creditStripeSession } from "@/lib/payments/stripe";
import { verifyAndCreditSSL } from "@/lib/payments/sslcommerz";
import { verifyAndCreditBkash } from "@/lib/payments/bkash";
import { logger } from "@/lib/logger";

export interface ProcessResult {
  ok: boolean;
  outcome: string;
  paymentId?: string;
}

function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

/** The few Stripe Checkout Session fields processing needs; nothing personal is stored. */
export function stripePayload(s: Stripe.Checkout.Session): Record<string, unknown> {
  return {
    id: s.id,
    payment_status: s.payment_status,
    amount_total: s.amount_total,
    currency: s.currency,
    metadata: {
      paymentId: s.metadata?.paymentId,
      userId: s.metadata?.userId,
    },
  };
}

/**
 * Runs the credit logic for one stored event. The credit functions verify with
 * the provider (or the Stripe session) and are safe to call any number of
 * times: a payment is credited once.
 */
export async function processPaymentEvent(
  event: Pick<IPaymentEventDoc, "provider" | "type" | "payload">,
): Promise<ProcessResult> {
  const p = event.payload as Record<string, string | undefined>;

  if (event.provider === "stripe") {
    const result = await creditStripeSession(
      event.payload as unknown as Stripe.Checkout.Session,
      event.type,
    );
    const metadata = event.payload.metadata as { paymentId?: string } | undefined;
    return {
      ok: result.credited || result.reason === "already_processed",
      outcome: result.reason,
      paymentId: metadata?.paymentId,
    };
  }

  if (event.provider === "sslcommerz") {
    const result = await verifyAndCreditSSL(
      p.tran_id,
      p.val_id,
      event.type === "success" ? "success" : "ipn",
    );
    return {
      ok: result.credited || result.reason === "already_processed",
      outcome: result.reason,
      paymentId: p.tran_id,
    };
  }

  if (!p.paymentID) return { ok: false, outcome: "not_found" };
  const result = await verifyAndCreditBkash(p.paymentID);
  return { ok: result.ok, outcome: result.reason, paymentId: result.paymentId };
}

/** Stores one delivery of an event. A repeat delivery bumps `deliveries` and keeps one row. */
async function recordDelivery(input: {
  provider: PaymentProvider;
  eventId: string;
  type: string;
  payload: Record<string, unknown>;
}) {
  const now = new Date();
  const run = () =>
    PaymentEvent.findOneAndUpdate(
      { provider: input.provider, eventId: input.eventId },
      {
        $setOnInsert: {
          type: input.type,
          payload: input.payload,
          receivedAt: now,
          replays: 0,
        },
        $set: { lastReceivedAt: now },
        $inc: { deliveries: 1 },
      },
      { upsert: true, returnDocument: "after" },
    );
  try {
    return await run();
  } catch (err) {
    // Two deliveries raced to insert the same event; the second one now updates.
    if (isDuplicateKey(err)) return run();
    throw err;
  }
}

/**
 * Logs a provider event, processes it, and stores the outcome. Logging never
 * stops processing: if the log write fails, the payment is still handled. If
 * processing throws, the outcome is stored as `error` and the error is rethrown
 * so the caller can answer with a failure and the provider retries.
 */
export async function receivePaymentEvent(input: {
  provider: PaymentProvider;
  eventId: string;
  type: string;
  payload: Record<string, unknown>;
}): Promise<ProcessResult> {
  await connectDB();
  let row: Awaited<ReturnType<typeof recordDelivery>> | null = null;
  try {
    row = await recordDelivery(input);
  } catch (err) {
    logger.error({ err, provider: input.provider }, "payment event log failed");
  }

  let result: ProcessResult;
  try {
    result = await processPaymentEvent(input);
  } catch (err) {
    if (row) {
      await PaymentEvent.updateOne(
        { _id: row._id },
        { $set: { processedAt: new Date(), outcome: "error", ok: false } },
      ).catch(() => {});
    }
    throw err;
  }

  if (row) {
    await PaymentEvent.updateOne(
      { _id: row._id },
      {
        $set: {
          processedAt: new Date(),
          outcome: result.outcome,
          ok: result.ok,
          ...(result.paymentId ? { paymentId: result.paymentId } : {}),
        },
      },
    ).catch((err) =>
      logger.error({ err }, "payment event outcome update failed"),
    );
  }
  return result;
}

/**
 * Processes a stored event again, for an admin. Safe because crediting is
 * idempotent: an event that already credited reports `already_processed`, and
 * one that was refused earlier is checked against the provider afresh.
 */
export async function replayPaymentEvent(
  eventId: string,
  adminId: string,
): Promise<{ found: false } | { found: true; result: ProcessResult }> {
  await connectDB();
  const row = await PaymentEvent.findById(eventId).lean();
  if (!row) return { found: false };

  let result: ProcessResult;
  try {
    result = await processPaymentEvent(row);
  } catch (err) {
    await PaymentEvent.updateOne(
      { _id: row._id },
      {
        $set: { outcome: "error", ok: false, lastReplayedAt: new Date(), lastReplayedBy: adminId },
        $inc: { replays: 1 },
      },
    );
    throw err;
  }

  await PaymentEvent.updateOne(
    { _id: row._id },
    {
      $set: {
        processedAt: new Date(),
        outcome: result.outcome,
        ok: result.ok,
        lastReplayedAt: new Date(),
        lastReplayedBy: adminId,
        ...(result.paymentId ? { paymentId: result.paymentId } : {}),
      },
      $inc: { replays: 1 },
    },
  );
  logger.info(
    { eventId: String(row._id), provider: row.provider, outcome: result.outcome, adminId },
    "payment event replayed",
  );
  return { found: true, result };
}
