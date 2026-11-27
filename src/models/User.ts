import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUserDoc extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  photoUrl?: string;
  about?: string;
  role: "worker" | "buyer" | "admin" | "demo_admin";
  /**
   * Cached balance of the ledger account `user:<id>`. Only
   * `postTransaction` (src/lib/ledger) may change it.
   */
  coins: number;
  /**
   * Set when the user's account was opened in the ledger (an opening entry
   * posted for any coins held before the ledger existed). New users get it at
   * creation.
   */
  ledgerOpenedAt?: Date;
  /** Last time the user was seen online (written by the realtime server). */
  lastSeenAt?: Date;
  /** When true, other people see whether the user is online but never when they were last seen. */
  hideLastSeen?: boolean;
  /** Email with Gmail dots and +tags removed, to catch one inbox signing up twice. */
  emailNormalized?: string;
  /** Written on every submission so two of a worker's submissions at once conflict and the daily cap is exact. */
  lastSubmitAt?: Date;
  /** The worker trust score (roadmap 3.4), recomputed by `ensureTrust` and the nightly sweep. */
  trust?: { score: number; level: 0 | 1 | 2 | 3; components: Record<string, number>; capped: boolean; computedAt: Date };
  /** One entry per day at most, for the chart; the newest 90 are kept. */
  trustHistory?: Array<{ score: number; level: number; at: Date }>;
  status: "active" | "suspended";
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDoc>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String },
    photoUrl: { type: String },
    about: { type: String },
    role: {
      type: String,
      enum: ["worker", "buyer", "admin", "demo_admin"],
      default: "worker",
    },
    coins: { type: Number, default: 0 },
    ledgerOpenedAt: { type: Date },
    lastSeenAt: { type: Date },
    hideLastSeen: { type: Boolean, default: false },
    emailNormalized: { type: String },
    lastSubmitAt: { type: Date },
    trust: {
      type: new Schema(
        {
          score: { type: Number, required: true },
          level: { type: Number, enum: [0, 1, 2, 3], required: true },
          components: { type: Schema.Types.Mixed },
          capped: { type: Boolean, default: false },
          computedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
    },
    trustHistory: [{ _id: false, score: Number, level: Number, at: Date }],
    status: { type: String, enum: ["active", "suspended"], default: "active" },
  },
  { timestamps: true },
);

// The leaderboard: active workers by coins, highest first.
UserSchema.index({ role: 1, status: 1, coins: -1 });
// The nightly trust recompute: workers whose score is oldest or missing.
UserSchema.index({ role: 1, status: 1, "trust.computedAt": 1 });
// One account per inbox. Only accounts that have the field take part, so older accounts are unaffected.
UserSchema.index({ emailNormalized: 1 }, { unique: true, partialFilterExpression: { emailNormalized: { $type: "string" } } });

const User: Model<IUserDoc> =
  mongoose.models.User || mongoose.model<IUserDoc>("User", UserSchema);

export default User;
