import mongoose, { Schema, Model } from "mongoose";
import type { EncryptedSecret } from "@/lib/mfa-crypto";

export interface IMfaCredentialDoc {
  _id: mongoose.Types.ObjectId;
  userId: string;
  /** The active TOTP secret, encrypted. Set when enrollment is confirmed. */
  secret?: EncryptedSecret;
  /** A secret shown during setup that has not been confirmed with a code yet. */
  pendingSecret?: EncryptedSecret;
  enabledAt?: Date;
  /** The latest 30-second step accepted. A code for this step or an earlier one is refused, so a code works once. */
  lastUsedStep: number;
  failedAttempts: number;
  failWindowStart?: Date;
  lockedUntil?: Date;
  /** bcrypt hashes of the recovery codes; `usedAt` is set when one is spent. */
  recoveryCodes: { hash: string; usedAt?: Date }[];
  createdAt: Date;
}

const enc = { iv: String, tag: String, data: String };

const MfaCredentialSchema = new Schema<IMfaCredentialDoc>(
  {
    userId: { type: String, required: true, unique: true },
    secret: { type: enc, _id: false },
    pendingSecret: { type: enc, _id: false },
    enabledAt: { type: Date },
    lastUsedStep: { type: Number, default: 0 },
    failedAttempts: { type: Number, default: 0 },
    failWindowStart: { type: Date },
    lockedUntil: { type: Date },
    recoveryCodes: {
      type: [new Schema({ hash: String, usedAt: Date }, { _id: false })],
      default: [],
    },
    createdAt: { type: Date, default: Date.now },
  },
  // Kept apart from users so no ordinary user query can ever return a secret.
  { versionKey: false, collection: "mfa_credentials" },
);

const MfaCredential: Model<IMfaCredentialDoc> =
  mongoose.models.MfaCredential ||
  mongoose.model<IMfaCredentialDoc>("MfaCredential", MfaCredentialSchema);

export default MfaCredential;
