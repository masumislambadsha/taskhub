import mongoose, { Schema, Model } from "mongoose";

export interface IMfaSessionDoc {
  userId: string;
  /** The random ID the login session carries; a session that never proved the second factor has no row. */
  sid: string;
  verifiedAt: Date;
  /** The last time a code was entered; sensitive actions need this within 15 minutes. */
  stepUpAt: Date;
  createdAt: Date;
}

/** How long a login stays verified before the code is asked for again. */
export const MFA_SESSION_TTL_SECONDS = 12 * 60 * 60;

const MfaSessionSchema = new Schema<IMfaSessionDoc>(
  {
    userId: { type: String, required: true },
    sid: { type: String, required: true },
    verifiedAt: { type: Date, required: true },
    stepUpAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: "mfa_sessions" },
);
MfaSessionSchema.index({ userId: 1, sid: 1 }, { unique: true });
MfaSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: MFA_SESSION_TTL_SECONDS });

const MfaSession: Model<IMfaSessionDoc> =
  mongoose.models.MfaSession || mongoose.model<IMfaSessionDoc>("MfaSession", MfaSessionSchema);

export default MfaSession;
