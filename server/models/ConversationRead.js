const mongoose = require("mongoose");

// How far each participant has read a conversation. The unread count is the
// number of messages after `lastReadMessageId` that were sent to them, which the
// { conversationId, _id } index on messages answers without scanning the history.
const ConversationReadSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    lastReadMessageId: { type: mongoose.Schema.Types.ObjectId, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "conversation_reads", versionKey: false },
);

ConversationReadSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

delete mongoose.models.ConversationRead;

module.exports = mongoose.model("ConversationRead", ConversationReadSchema);
