import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPaymentDoc extends Document {
  userId: mongoose.Types.ObjectId;
  userEmail: string;
  gateway: "stripe" | "bkash" | "sslcommerz";
  coinsPurchased: number;
  amount: number;
  currency: string;
  status: "pending" | "success" | "failed";
  gatewayTransactionId?: string;
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
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

const Payment: Model<IPaymentDoc> =
  mongoose.models.Payment ||
  mongoose.model<IPaymentDoc>("Payment", PaymentSchema);

export default Payment;
