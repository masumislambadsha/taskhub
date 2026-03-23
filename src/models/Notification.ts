import mongoose, { Schema, Document, Model } from "mongoose";

export interface INotificationDoc extends Document {
  toUserId: mongoose.Types.ObjectId;
  toEmail: string;
  message: string;
  actionRoute?: string;
  type: "info" | "success" | "warning";
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotificationDoc>(
  {
    toUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    toEmail: { type: String, required: true },
    message: { type: String, required: true },
    actionRoute: { type: String },
    type: {
      type: String,
      enum: ["info", "success", "warning"],
      default: "info",
    },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const Notification: Model<INotificationDoc> =
  mongoose.models.Notification ||
  mongoose.model<INotificationDoc>("Notification", NotificationSchema);

export default Notification;
