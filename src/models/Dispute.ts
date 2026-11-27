import mongoose, { Schema, Model } from "mongoose";

export const DISPUTE_STATUSES = [
  "open",
  "under_review",
  "resolved_worker",
  "resolved_buyer",
  "withdrawn",
] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];
export const ACTIVE_DISPUTE_STATUSES: DisputeStatus[] = ["open", "under_review"];

export interface IDisputeDoc {
  _id: mongoose.Types.ObjectId;
  submissionId: mongoose.Types.ObjectId;
  taskId: mongoose.Types.ObjectId;
  workerId: mongoose.Types.ObjectId;
  buyerId: mongoose.Types.ObjectId;
  status: DisputeStatus;
  workerStatement: string;
  /** Extra screenshots the worker adds to the appeal (image URLs). */
  workerEvidence: string[];
  buyerStatement?: string;
  buyerStatementAt?: Date;
  adminId?: string;
  adminNote?: string;
  /** Set once admins have been told this dispute is older than 48 hours. */
  slaNotifiedAt?: Date;
  createdAt: Date;
  resolvedAt?: Date;
}

const DisputeSchema = new Schema<IDisputeDoc>(
  {
    // One dispute per submission, ever.
    submissionId: { type: Schema.Types.ObjectId, ref: "Submission", required: true, unique: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: DISPUTE_STATUSES, default: "open" },
    workerStatement: { type: String, required: true },
    workerEvidence: { type: [String], default: [] },
    buyerStatement: { type: String },
    buyerStatementAt: { type: Date },
    adminId: { type: String },
    adminNote: { type: String },
    slaNotifiedAt: { type: Date },
    createdAt: { type: Date, default: Date.now, immutable: true },
    resolvedAt: { type: Date },
  },
  { versionKey: false },
);

DisputeSchema.index({ status: 1, createdAt: 1 });
DisputeSchema.index({ workerId: 1, status: 1 });
DisputeSchema.index({ buyerId: 1, status: 1 });

const Dispute: Model<IDisputeDoc> =
  mongoose.models.Dispute || mongoose.model<IDisputeDoc>("Dispute", DisputeSchema);

export default Dispute;
