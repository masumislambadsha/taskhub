import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITaskDoc extends Document {
  title: string;
  details: string;
  category?: string;
  buyerId: mongoose.Types.ObjectId;
  buyerName: string;
  buyerEmail: string;
  requiredWorkers: number;
  filledWorkers: number;
  payableAmount: number;
  completionDate: Date;
  submissionInfo: string;
  imageUrl?: string;
  status: "open" | "closed" | "blocked" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITaskDoc>(
  {
    title: { type: String, required: true },
    details: { type: String, required: true },
    category: { type: String },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    buyerName: { type: String, required: true },
    buyerEmail: { type: String, required: true },
    requiredWorkers: { type: Number, required: true, min: 1 },
    filledWorkers: { type: Number, default: 0 },
    payableAmount: { type: Number, required: true, min: 1 },
    completionDate: { type: Date, required: true },
    submissionInfo: { type: String, required: true },
    imageUrl: { type: String },
    status: {
      type: String,
      enum: ["open", "closed", "blocked", "archived"],
      default: "open",
    },
  },
  { timestamps: true },
);

const Task: Model<ITaskDoc> =
  mongoose.models.Task || mongoose.model<ITaskDoc>("Task", TaskSchema);

export default Task;
