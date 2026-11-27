import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMessageDoc extends Document {
  conversationId: string;
  taskId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  senderName: string;
  senderPhoto?: string;
  receiverName?: string;
  receiverPhoto?: string;
  content: string;
  isRead: boolean;
  /** When the recipient's device received it (two grey ticks). */
  deliveredAt?: Date;
  /** When the recipient read it (two blue ticks). */
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessageDoc>(
  {
    conversationId: { type: String, required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderName: { type: String, required: true },
    senderPhoto: { type: String },
    receiverName: { type: String, default: "Unknown" },
    receiverPhoto: { type: String },
    content: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    deliveredAt: { type: Date },
    readAt: { type: Date },
  },
  { timestamps: true },
);

const Message: Model<IMessageDoc> =
  mongoose.models.Message ||
  mongoose.model<IMessageDoc>("Message", MessageSchema);

export default Message;
