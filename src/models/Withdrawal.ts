import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWithdrawalDoc extends Document {
  workerId: mongoose.Types.ObjectId;
  workerName: string;
  workerEmail: string;
  coinRequested: number;
  amount: number;
  paymentSystem: string;
  accountNumber: string;
  status: "pending" | "approved" | "rejected";
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalSchema = new Schema<IWithdrawalDoc>(
  {
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workerName: { type: String, required: true },
    workerEmail: { type: String, required: true },
    coinRequested: { type: Number, required: true, min: 200 },
    amount: { type: Number, required: true },
    paymentSystem: { type: String, required: true },
    accountNumber: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    processedAt: { type: Date },
  },
  { timestamps: true },
);

const Withdrawal: Model<IWithdrawalDoc> =
  mongoose.models.Withdrawal ||
  mongoose.model<IWithdrawalDoc>("Withdrawal", WithdrawalSchema);

export default Withdrawal;
