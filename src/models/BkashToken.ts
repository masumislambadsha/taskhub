import mongoose, { Schema, Model } from "mongoose";

export interface IBkashTokenDoc {
  _id: string;
  idToken: string;
  expiresAt: Date;
}

// A single document (`_id: "grant"`) holding the current bKash grant token, so
// every serverless instance can reuse it instead of asking bKash again.
const BkashTokenSchema = new Schema<IBkashTokenDoc>(
  {
    _id: { type: String },
    idToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: "bkash_tokens" },
);

const BkashToken: Model<IBkashTokenDoc> =
  mongoose.models.BkashToken ||
  mongoose.model<IBkashTokenDoc>("BkashToken", BkashTokenSchema);

export default BkashToken;
