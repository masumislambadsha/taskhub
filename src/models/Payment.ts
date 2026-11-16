import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPaymentDoc extends Document {
  userId: mongoose.Types.ObjectId;
  userEmail: string;
  gateway: "stripe" | "bkash" | "sslcommerz";
  coinsPurchased: number;
  amount: number;
  currency: string;
  status: "pending" | "success" | "failed";
  /** Provider transaction ID, set when the payment is credited. */
  gatewayTransactionId?: string;
  /** Provider validation ID (SSLCommerz val_id). Unique across payments. */
  gatewayValidationId?: string;
  /** Stripe Checkout Session ID, stored when the session is created. */
  stripeSessionId?: string;
  paidAt?: Date;
  /** How the payment was credited: a gateway name or "admin". */
  creditedVia?: string;
  /** Admin who confirmed the payment by hand. */
  confirmedBy?: mongoose.Types.ObjectId;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPaymentDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userEmail: { type: String, required: true },
    gateway: {
      type: String,
      enum: ["stripe", "bkash", "sslcommerz"],
      required: true,
    },
    coinsPurchased: { type: Number, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "usd" },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    gatewayTransactionId: { type: String },
    gatewayValidationId: { type: String },
    stripeSessionId: { type: String },
    paidAt: { type: Date },
    creditedVia: { type: String },
    confirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

// One provider transaction can never credit two payments. Both indexes are
// partial (only documents that actually have a string value are indexed), so
// they are safe to build on existing collections where most documents have
// neither field.
PaymentSchema.index(
  { gatewayValidationId: 1 },
  {
    unique: true,
    partialFilterExpression: { gatewayValidationId: { $type: "string" } },
  },
);
PaymentSchema.index(
  { gateway: 1, gatewayTransactionId: 1 },
  {
    unique: true,
    partialFilterExpression: { gatewayTransactionId: { $type: "string" } },
  },
);

const Payment: Model<IPaymentDoc> =
  mongoose.models.Payment ||
  mongoose.model<IPaymentDoc>("Payment", PaymentSchema);

export default Payment;
