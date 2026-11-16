import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Cached balance of a ledger account that is not a user.
 *
 * User accounts (`user:<userId>`) have no document here: their cached balance
 * is `User.coins`. System accounts are created on first use; escrow accounts
 * (`escrow:task:<taskId>`) are created when the task is funded or opened.
 * Balances are only ever changed by `postTransaction` (see src/lib/ledger).
 */
export type LedgerAccountKind = "system" | "escrow";

export interface ILedgerAccountDoc extends Document<string> {
  _id: string;
  kind: LedgerAccountKind;
  balance: number;
  allowNegative: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LedgerAccountSchema = new Schema<ILedgerAccountDoc>(
  {
    _id: { type: String, required: true },
    kind: { type: String, enum: ["system", "escrow"], required: true },
    balance: { type: Number, required: true, default: 0 },
    allowNegative: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, collection: "ledger_accounts" },
);

const LedgerAccount: Model<ILedgerAccountDoc> =
  mongoose.models.LedgerAccount ||
  mongoose.model<ILedgerAccountDoc>("LedgerAccount", LedgerAccountSchema);

export default LedgerAccount;
