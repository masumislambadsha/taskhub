import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISubmissionDoc extends Document {
  taskId: mongoose.Types.ObjectId;
  taskTitle: string;
  taskBuyerId: mongoose.Types.ObjectId;
  taskBuyerName: string;
  workerId: mongoose.Types.ObjectId;
  workerName: string;
  workerEmail: string;
  payableAmount: number;
  details: string;
  proofLinks?: string[];
  proofImageUrl?: string;
  proofHashes?: { sha256: string; dhash: string; chunks: string[]; computedAt?: Date };
  rejectionReason?: string;
  status: "pending" | "approved" | "rejected";
  /** When the system approves it if the buyer has not decided (set when submitted). */
  autoApproveAt?: Date;
  /** When the status left pending. */
  decidedAt?: Date;
  /** The buyer's user ID, or "system" for an automatic approval. */
  decidedBy?: string;
  /** Why automatic approval gave up (for example the escrow could not cover it). */
  autoApproveError?: string;
  /**
   * Set when the buyer rejects. The reward stays in the task's escrow as a
   * hold and the slot stays taken until the hold is settled: the worker
   * accepts, the window ends, or (with disputes) an admin decides.
   */
  rejectionHold?: {
    windowEndsAt: Date;
    settledAt?: Date;
    settledAs?: "accepted" | "window" | "buyer_won" | "worker_won";
    /** The worker's appeal. While it is open the hold is not settled by the window or by accepting. */
    disputeId?: mongoose.Types.ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionSchema = new Schema<ISubmissionDoc>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    taskTitle: { type: String, required: true },
    taskBuyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    taskBuyerName: { type: String, required: true },
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workerName: { type: String, required: true },
    workerEmail: { type: String, required: true },
    payableAmount: { type: Number, required: true },
    details: { type: String, required: true },
    proofLinks: [{ type: String }],
    proofImageUrl: { type: String },
    /** Fingerprints of the proof screenshot, computed by the worker (roadmap 3.1). */
    proofHashes: {
      type: new Schema(
        {
          sha256: { type: String, required: true },
          dhash: { type: String, required: true },
          chunks: [{ type: String }],
          computedAt: { type: Date, default: Date.now },
        },
        { _id: false },
      ),
    },
    rejectionReason: { type: String },
    autoApproveAt: { type: Date },
    decidedAt: { type: Date },
    decidedBy: { type: String },
    autoApproveError: { type: String },
    rejectionHold: {
      type: new Schema(
        {
          windowEndsAt: { type: Date, required: true },
          settledAt: { type: Date },
          settledAs: { type: String, enum: ["accepted", "window", "buyer_won", "worker_won"] },
          disputeId: { type: Schema.Types.ObjectId, ref: "Dispute" },
        },
        { _id: false },
      ),
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true },
);

SubmissionSchema.index({ taskId: 1, workerId: 1 });
// Finding near-duplicate screenshots: submissions that share any dHash chunk,
// and exact duplicates by SHA-256.
SubmissionSchema.index({ "proofHashes.chunks": 1, createdAt: -1 });
SubmissionSchema.index({ "proofHashes.sha256": 1 });
// A worker's and a buyer's submission lists: owner, optional status, newest first.
// The worker index also answers the leaderboard's per-worker counts.
SubmissionSchema.index({ workerId: 1, status: 1, createdAt: -1 });
SubmissionSchema.index({ taskBuyerId: 1, status: 1, createdAt: -1 });
// The auto-approve sweep looks for pending submissions that are due.
SubmissionSchema.index({ status: 1, autoApproveAt: 1 });
// The settlement sweep looks for holds whose window has ended.
SubmissionSchema.index({ status: 1, "rejectionHold.windowEndsAt": 1 });

const Submission: Model<ISubmissionDoc> =
  mongoose.models.Submission ||
  mongoose.model<ISubmissionDoc>("Submission", SubmissionSchema);

export default Submission;
