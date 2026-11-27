import mongoose, { Schema, Document, Model } from "mongoose";

export const FRAUD_FLAG_TYPES = ["duplicate_proof", "shared_device", "self_dealing"] as const;

export interface IFraudFlagDoc extends Document {
  userId: mongoose.Types.ObjectId;
  /** Set for proof flags; account-level flags (shared device, self-dealing) have none. */
  submissionId?: mongoose.Types.ObjectId;
  /** True for flags about accounts (shared device, self-dealing) rather than one submission. */
  accountLevel?: boolean;
  type: (typeof FRAUD_FLAG_TYPES)[number];
  severity: "low" | "medium" | "high";
  evidence: {
    otherSubmissionId?: mongoose.Types.ObjectId;
    otherUserId?: mongoose.Types.ObjectId;
    /** Differing bits between the two screenshots' dHashes (0 for byte-identical files). */
    distance?: number;
    sameWorker?: boolean;
    /** Account-level flags: how many accounts share the signal. */
    accounts?: number;
    /** "copy" is the later submission, "original" the earlier one it matches. */
    role?: "copy" | "original";
  };
  status: "open" | "dismissed" | "confirmed";
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
}

const FraudFlagSchema = new Schema<IFraudFlagDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submissionId: { type: Schema.Types.ObjectId, ref: "Submission" },
    accountLevel: { type: Boolean },
    type: { type: String, enum: FRAUD_FLAG_TYPES, required: true },
    severity: { type: String, enum: ["low", "medium", "high"], required: true },
    evidence: {
      otherSubmissionId: { type: Schema.Types.ObjectId, ref: "Submission" },
      otherUserId: { type: Schema.Types.ObjectId, ref: "User" },
      distance: { type: Number },
      sameWorker: { type: Boolean },
      accounts: { type: Number },
      role: { type: String, enum: ["copy", "original"] },
    },
    status: { type: String, enum: ["open", "dismissed", "confirmed"], default: "open" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "fraud_flags", versionKey: false },
);

// One flag per submission and pair, so re-running the check never duplicates, and
// a dismissed pair never fires again.
FraudFlagSchema.index(
  { submissionId: 1, type: 1, "evidence.otherSubmissionId": 1 },
  { unique: true, partialFilterExpression: { submissionId: { $exists: true } } },
);
// Account-level flags: one per user, type and other account.
FraudFlagSchema.index(
  { userId: 1, type: 1, "evidence.otherUserId": 1 },
  { unique: true, partialFilterExpression: { accountLevel: true } },
);
FraudFlagSchema.index({ status: 1, createdAt: 1 });
FraudFlagSchema.index({ userId: 1, status: 1 });

const FraudFlag: Model<IFraudFlagDoc> =
  mongoose.models.FraudFlag || mongoose.model<IFraudFlagDoc>("FraudFlag", FraudFlagSchema);

export default FraudFlag;
