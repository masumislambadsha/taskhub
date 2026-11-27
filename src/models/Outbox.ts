import mongoose, { Schema, Model } from "mongoose";

export const OUTBOX_TYPES = ["notification", "email", "webhook"] as const;
export type OutboxType = (typeof OUTBOX_TYPES)[number];

export interface IOutboxDoc {
  _id: mongoose.Types.ObjectId;
  type: OutboxType;
  payload: Record<string, unknown>;
  status: "pending" | "sent" | "failed";
  attempts: number;
  nextAttemptAt: Date;
  /** Unique: the same side effect queued twice is stored once, and receivers use it to ignore a repeat. */
  idempotencyKey: string;
  /** Set while a worker holds the row; a row held for too long is taken over (the worker crashed). */
  claimedAt?: Date;
  lastError?: string;
  sentAt?: Date;
  createdAt: Date;
}

const OutboxSchema = new Schema<IOutboxDoc>(
  {
    type: { type: String, enum: OUTBOX_TYPES, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["pending", "sent", "failed"], default: "pending" },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    idempotencyKey: { type: String, required: true, unique: true },
    claimedAt: { type: Date },
    lastError: { type: String },
    sentAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: "outbox" },
);

OutboxSchema.index({ status: 1, nextAttemptAt: 1 });
// Sent rows are only history; MongoDB removes them after 14 days. Failed ones stay for an admin.
OutboxSchema.index(
  { sentAt: 1 },
  { expireAfterSeconds: 14 * 24 * 3600, partialFilterExpression: { status: "sent" } },
);

const Outbox: Model<IOutboxDoc> =
  mongoose.models.Outbox || mongoose.model<IOutboxDoc>("Outbox", OutboxSchema);

export default Outbox;
