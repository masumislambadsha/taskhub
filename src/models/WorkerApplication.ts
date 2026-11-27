import mongoose, { Schema, Model } from "mongoose";

export const MAX_APPLICATION_ATTEMPTS = 3;

export interface IWorkerApplicationDoc {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** Each step saves on its own, so a worker can come back later. */
  profile?: { fullName: string; country: string; birthYear?: number };
  payout?: { paymentSystem: "bkash" | "nagad" | "bank"; accountNumber: string };
  skillsNote?: string;
  /** GridFS file IDs in the private `worker_docs` bucket. Never public URLs. */
  idDocumentId?: mongoose.Types.ObjectId;
  selfieId?: mongoose.Types.ObjectId;
  status: "draft" | "pending" | "approved" | "rejected";
  attempts: number;
  submittedAt?: Date;
  decidedAt?: Date;
  decidedBy?: string;
  rejectionReason?: string;
  /** Rejected documents are deleted after this date. */
  purgeAfter?: Date;
  createdAt: Date;
}

const WorkerApplicationSchema = new Schema<IWorkerApplicationDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    profile: { type: new Schema({ fullName: String, country: String, birthYear: Number }, { _id: false }) },
    payout: { type: new Schema({ paymentSystem: { type: String, enum: ["bkash", "nagad", "bank"] }, accountNumber: String }, { _id: false }) },
    skillsNote: { type: String, maxlength: 1000 },
    idDocumentId: { type: Schema.Types.ObjectId },
    selfieId: { type: Schema.Types.ObjectId },
    status: { type: String, enum: ["draft", "pending", "approved", "rejected"], default: "draft" },
    attempts: { type: Number, default: 0 },
    submittedAt: { type: Date },
    decidedAt: { type: Date },
    decidedBy: { type: String },
    rejectionReason: { type: String },
    purgeAfter: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "worker_applications", versionKey: false },
);
// The admin queue: pending applications, longest waiting first.
WorkerApplicationSchema.index({ status: 1, submittedAt: 1 });
WorkerApplicationSchema.index({ purgeAfter: 1 }, { partialFilterExpression: { purgeAfter: { $type: "date" } } });

const WorkerApplication: Model<IWorkerApplicationDoc> =
  mongoose.models.WorkerApplication || mongoose.model<IWorkerApplicationDoc>("WorkerApplication", WorkerApplicationSchema);
export default WorkerApplication;
