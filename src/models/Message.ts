import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMessageDoc extends Document {
  conversationId: string;
  taskId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  senderName: string;
  receiverName?: string;
  content: string;
  isRead: boolean;
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
    receiverName: { type: String, default: "Unknown" },
    content: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const Message: Model<IMessageDoc> =
  mongoose.models.Message ||
  mongoose.model<IMessageDoc>("Message", MessageSchema);

export default Message;
