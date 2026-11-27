import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * requested -> `awaiting_confirmation` (the worker must confirm by email)
 *           -> `pending` (confirmed, in the admin queue)
 *           -> `approved` (an admin approved it; waiting to be paid by hand)
 *           -> `paid` (the admin entered the external transaction ID)
 * or ended early as `rejected` (admin) or `cancelled` (worker, or unconfirmed for 24 hours).
 * Older withdrawals only ever used pending, approved and rejected.
 */
export const WITHDRAWAL_STATUSES = [
  "awaiting_confirmation",
  "pending",
  "approved",
  "paid",
  "rejected",
  "cancelled",
] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

/** Statuses in which the coins are reserved in `system:payouts_pending`. */
export const RESERVED_STATUSES: WithdrawalStatus[] = ["awaiting_confirmation", "pending", "approved"];

export interface RiskFlag {
  code: string;
  level: "review" | "hold" | "high";
  message: string;
}

export interface IWithdrawalDoc extends Document {
  workerId: mongoose.Types.ObjectId;
  workerName: string;
  workerEmail: string;
  coinRequested: number;
  amount: number;
  paymentSystem: string;
  accountNumber: string;
  status: WithdrawalStatus;
  processedAt?: Date;
  /** Set when the coins moved to `system:payouts_pending`. Older withdrawals have none. */
  reservedAt?: Date;
  /** SHA-256 of the emailed confirmation token; the token itself is never stored. */
  confirmTokenHash?: string;
  confirmExpiresAt?: Date;
  confirmedAt?: Date;
  riskScore: number;
  riskFlags: RiskFlag[];
  approvedAt?: Date;
  approvedBy?: string;
  paidAt?: Date;
  paidBy?: string;
  /** The bKash, Nagad or bank reference the admin entered when paying. */
  externalTransactionId?: string;
  rejectionReason?: string;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalSchema = new Schema<IWithdrawalDoc>(
  {
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workerName: { type: String, required: true },
    workerEmail: { type: String, required: true },
    coinRequested: { type: Number, required: true, min: 200 },
    amount: { type: Number, required: true },
    paymentSystem: { type: String, required: true },
    accountNumber: { type: String, required: true },
    status: {
      type: String,
      enum: WITHDRAWAL_STATUSES,
      default: "pending",
    },
    processedAt: { type: Date },
    reservedAt: { type: Date },
    confirmTokenHash: { type: String },
    confirmExpiresAt: { type: Date },
    confirmedAt: { type: Date },
    riskScore: { type: Number, default: 0 },
    riskFlags: {
      type: [
        new Schema(
          {
            code: String,
            level: { type: String, enum: ["review", "hold", "high"] },
            message: String,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    approvedAt: { type: Date },
    approvedBy: { type: String },
    paidAt: { type: Date },
    paidBy: { type: String },
    externalTransactionId: { type: String },
    rejectionReason: { type: String },
    cancelledAt: { type: Date },
    cancelReason: { type: String },
  },
  { timestamps: true },
);

WithdrawalSchema.index({ status: 1, riskScore: -1, createdAt: 1 });
WithdrawalSchema.index({ workerId: 1, createdAt: -1 });

const Withdrawal: Model<IWithdrawalDoc> =
  mongoose.models.Withdrawal ||
  mongoose.model<IWithdrawalDoc>("Withdrawal", WithdrawalSchema);

export default Withdrawal;
