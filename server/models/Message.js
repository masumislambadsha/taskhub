const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderName: { type: String, required: true },
    receiverName: { type: String, required: false, default: "Unknown" },
    content: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    // Reached the recipient's device, and was read by them. Both are set once.
    deliveredAt: { type: Date },
    readAt: { type: Date },
  },
  { timestamps: true },
);

// Unread counts and "mark read up to this message" both walk a conversation by _id.
MessageSchema.index({ conversationId: 1, _id: 1 });
MessageSchema.index({ receiverId: 1, deliveredAt: 1 });

// Clear any previously compiled model so schema updates apply on restart
delete mongoose.models.Message;

const Message = mongoose.model("Message", MessageSchema);

module.exports = Message;