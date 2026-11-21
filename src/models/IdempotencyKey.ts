import mongoose, { Schema, Model } from "mongoose";

export interface IIdempotencyKeyDoc {
  userId: string;
  key: string;
  /** SHA-256 of the method, path and body of the request that claimed the key. */
  requestHash: string;
  status: "in_progress" | "completed";
  /** When the request that holds the key started; an old one is treated as crashed. */
  lockedAt: Date;
  responseStatus?: number;
  responseBody?: string;
  responseContentType?: string;
  createdAt: Date;
}

/** Keys are kept for 24 hours, then MongoDB removes them. */
export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

const IdempotencyKeySchema = new Schema<IIdempotencyKeyDoc>({
  userId: { type: String, required: true },
  key: { type: String, required: true },
  requestHash: { type: String, required: true },
  status: {
    type: String,
    enum: ["in_progress", "completed"],
    default: "in_progress",
  },
  lockedAt: { type: Date, required: true },
  responseStatus: { type: Number },
  responseBody: { type: String },
  responseContentType: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// One key per user; a second insert with the same pair fails, which is what
// makes claiming a key atomic.
IdempotencyKeySchema.index({ userId: 1, key: 1 }, { unique: true });
IdempotencyKeySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: IDEMPOTENCY_TTL_SECONDS },
);

const IdempotencyKey: Model<IIdempotencyKeyDoc> =
  mongoose.models.IdempotencyKey ||
  mongoose.model<IIdempotencyKeyDoc>("IdempotencyKey", IdempotencyKeySchema);

export default IdempotencyKey;
