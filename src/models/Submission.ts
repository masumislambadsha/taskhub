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
    rejectionReason: { type: String },
    autoApproveAt: { type: Date },
    decidedAt: { type: Date },
    decidedBy: { type: String },
    autoApproveError: { type: String },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true },
);

SubmissionSchema.index({ taskId: 1, workerId: 1 });
// The auto-approve sweep looks for pending submissions that are due.
SubmissionSchema.index({ status: 1, autoApproveAt: 1 });

const Submission: Model<ISubmissionDoc> =
  mongoose.models.Submission ||
  mongoose.model<ISubmissionDoc>("Submission", SubmissionSchema);

export default Submission;
