import mongoose, { Schema, Model } from "mongoose";

export interface IPayoutAccountDoc {
  userId: string;
  paymentSystem: string;
  /** Normalised: letters and digits only, lower case. */
  accountNumber: string;
  firstSeenAt: Date;
}

const PayoutAccountSchema = new Schema<IPayoutAccountDoc>(
  {
    userId: { type: String, required: true },
    paymentSystem: { type: String, required: true },
    accountNumber: { type: String, required: true },
    firstSeenAt: { type: Date, required: true },
  },
  { versionKey: false, collection: "payout_accounts" },
);

// One row per user and number, remembering when the user first used it.
PayoutAccountSchema.index({ userId: 1, paymentSystem: 1, accountNumber: 1 }, { unique: true });
// "Is this number used by another account?"
PayoutAccountSchema.index({ paymentSystem: 1, accountNumber: 1 });

const PayoutAccount: Model<IPayoutAccountDoc> =
  mongoose.models.PayoutAccount ||
  mongoose.model<IPayoutAccountDoc>("PayoutAccount", PayoutAccountSchema);

export default PayoutAccount;
