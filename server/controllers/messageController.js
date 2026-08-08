const mongoose = require("mongoose");
const Message = require("../models/Message");

async function persistMessage({ conversationId, taskId, senderId, receiverId, senderName, receiverName, content }) {
  return Message.create({
    conversationId,
    taskId: new mongoose.Types.ObjectId(taskId),
    senderId: new mongoose.Types.ObjectId(senderId),
    receiverId: new mongoose.Types.ObjectId(receiverId),
    senderName,
    receiverName: receiverName || "Unknown",
    content: content.trim(),
  });
}

async function markConversationRead({ conversationId, userId }) {
  return Message.updateMany(
    { conversationId, receiverId: userId, isRead: false },
    { isRead: true },
  );
}

module.exports = { persistMessage, markConversationRead };