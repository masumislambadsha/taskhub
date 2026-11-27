import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * The journal. One document per posted transaction; its entries always add up
 * to exactly 0. Documents are never edited or deleted: a correction is a new
 * transaction with `reversalOf` set. The model refuses updates and deletes
 * through Mongoose; only `postTransaction` inserts.
 */
export const LEDGER_TX_TYPES = [
  "topup",
  "signup_bonus",
  "task_fund",
  "task_adjust",
  "task_reprice",
  "task_refund",
  "submission_payout",
  "submission_reject_refund",
  "dispute_won",
  "withdrawal",
  "admin_adjustment",
  "forfeit",
  "opening",
  "reversal",
] as const;
export type LedgerTxType = (typeof LEDGER_TX_TYPES)[number];

export interface LedgerEntry {
  accountId: string;
  amount: number;
}

export interface LedgerMeta {
  taskId?: string;
  submissionId?: string;
  paymentId?: string;
  withdrawalId?: string;
  userId?: string;
  /** Opening entries for archived tasks: the task was assumed already refunded. */
  assumeReleased?: boolean;
  note?: string;
}

export interface ILedgerTransactionDoc extends Document {
  type: LedgerTxType;
  idempotencyKey: string;
  entries: LedgerEntry[];
  meta: LedgerMeta;
  reversalOf?: mongoose.Types.ObjectId;
  createdBy: string;
  createdAt: Date;
}

const EntrySchema = new Schema<LedgerEntry>(
  {
    accountId: { type: String, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false },
);

const MetaSchema = new Schema<LedgerMeta>(
  {
    taskId: String,
    submissionId: String,
    paymentId: String,
    withdrawalId: String,
    userId: String,
    assumeReleased: Boolean,
    note: String,
  },
  { _id: false },
);

const LedgerTransactionSchema = new Schema<ILedgerTransactionDoc>(
  {
    type: { type: String, enum: LEDGER_TX_TYPES, required: true },
    idempotencyKey: { type: String, required: true },
    entries: { type: [EntrySchema], required: true },
    meta: { type: MetaSchema, default: () => ({}) },
    reversalOf: { type: Schema.Types.ObjectId, ref: "LedgerTransaction" },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "ledger_transactions", versionKey: false },
);

LedgerTransactionSchema.index({ idempotencyKey: 1 }, { unique: true });
// Wallet history: transactions that contain an account, newest first.
LedgerTransactionSchema.index({
  "entries.accountId": 1,
  createdAt: -1,
  _id: -1,
});
LedgerTransactionSchema.index({ "meta.taskId": 1, type: 1 });

// Append-only: refuse every Mongoose path that edits or deletes a journal row.
const IMMUTABLE_OPS = [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "replaceOne",
  "findOneAndDelete",
  "deleteOne",
  "deleteMany",
] as const;
for (const op of IMMUTABLE_OPS) {
  LedgerTransactionSchema.pre(op, function () {
    throw new Error(
      `ledger_transactions is append-only: ${op} is not allowed. Post a reversing transaction instead.`,
    );
  });
}
LedgerTransactionSchema.pre("save", function () {
  if (!this.isNew) {
    throw new Error(
      "ledger_transactions is append-only: existing entries cannot be saved again.",
    );
  }
});

const LedgerTransaction: Model<ILedgerTransactionDoc> =
  mongoose.models.LedgerTransaction ||
  mongoose.model<ILedgerTransactionDoc>(
    "LedgerTransaction",
    LedgerTransactionSchema,
  );

export default LedgerTransaction;
