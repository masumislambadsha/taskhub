import mongoose, { Schema, Model } from "mongoose";

export type PaymentProvider = "stripe" | "sslcommerz" | "bkash";

export interface IPaymentEventDoc {
  _id: mongoose.Types.ObjectId;
  provider: PaymentProvider;
  /** The provider's own ID for the event (Stripe event ID, bKash paymentID, SSLCommerz tran_id:val_id). */
  eventId: string;
  /** Stripe event type, or "ipn", "success" or "callback" for the others. */
  type: string;
  /** Only the fields needed to process the event again. No emails or card data. */
  payload: Record<string, unknown>;
  /** The Payment this event was about, once known. */
  paymentId?: string;
  deliveries: number;
  receivedAt: Date;
  lastReceivedAt: Date;
  processedAt?: Date;
  /** A `CreditReason`, a bKash reason, or `error`. Unset until processed. */
  outcome?: string;
  /** True when the event credited the payment or it was already credited. */
  ok?: boolean;
  replays: number;
  lastReplayedAt?: Date;
  lastReplayedBy?: string;
}

const PaymentEventSchema = new Schema<IPaymentEventDoc>({
  provider: {
    type: String,
    enum: ["stripe", "sslcommerz", "bkash"],
    required: true,
  },
  eventId: { type: String, required: true },
  type: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, default: {} },
  paymentId: { type: String },
  deliveries: { type: Number, default: 1 },
  receivedAt: { type: Date, default: Date.now },
  lastReceivedAt: { type: Date, default: Date.now },
  processedAt: { type: Date },
  outcome: { type: String },
  ok: { type: Boolean },
  replays: { type: Number, default: 0 },
  lastReplayedAt: { type: Date },
  lastReplayedBy: { type: String },
});

// One row per provider event, however many times it is delivered.
PaymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
PaymentEventSchema.index({ receivedAt: -1 });

const PaymentEvent: Model<IPaymentEventDoc> =
  mongoose.models.PaymentEvent ||
  mongoose.model<IPaymentEventDoc>("PaymentEvent", PaymentEventSchema);

export default PaymentEvent;
