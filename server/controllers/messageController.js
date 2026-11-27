const mongoose = require("mongoose");
const Message = require("../models/Message");
const ConversationRead = require("../models/ConversationRead");

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const oid = (id) => new mongoose.Types.ObjectId(id);

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

/**
 * A message reached the recipient's device. Only the recipient can say so (the
 * user comes from the verified token, never from the payload), and only once:
 * the update is conditional on `deliveredAt` being unset. Returns the message,
 * or null if there was nothing to change.
 */
async function markDelivered({ messageId, userId }) {
  if (typeof messageId !== "string" || !OBJECT_ID.test(messageId)) return null;
  return Message.findOneAndUpdate(
    { _id: oid(messageId), receiverId: oid(userId), deliveredAt: { $exists: false } },
    { $set: { deliveredAt: new Date() } },
    { returnDocument: "after" },
  ).lean();
}

/**
 * Messages sent to the user while they were away are delivered when they
 * reconnect (or open the conversation). Returns the ones just marked, grouped by
 * sender and conversation, so the senders can be told.
 */
async function markBacklogDelivered({ userId, conversationId, limit = 500 }) {
  const filter = { receiverId: oid(userId), deliveredAt: { $exists: false } };
  if (conversationId) filter.conversationId = conversationId;
  const pending = await Message.find(filter).select("_id senderId conversationId").limit(limit).lean();
  if (!pending.length) return [];
  const now = new Date();
  await Message.updateMany(
    { _id: { $in: pending.map((m) => m._id) }, deliveredAt: { $exists: false } },
    { $set: { deliveredAt: now } },
  );
  const groups = new Map();
  for (const m of pending) {
    const k = `${m.senderId}|${m.conversationId}`;
    if (!groups.has(k)) groups.set(k, { senderId: String(m.senderId), conversationId: m.conversationId, messageIds: [], deliveredAt: now });
    groups.get(k).messageIds.push(String(m._id));
  }
  return [...groups.values()];
}

/**
 * The user has read the conversation up to a message. One `updateMany` sets
 * `readAt` on every unread message sent to them up to that ID (and `deliveredAt`
 * if it was missing), and their read position moves forward, never backward.
 * Without `upToMessageId` it means everything so far. Returns what changed.
 */
async function markRead({ conversationId, userId, upToMessageId }) {
  let upTo;
  if (upToMessageId !== undefined && upToMessageId !== null) {
    if (typeof upToMessageId !== "string" || !OBJECT_ID.test(upToMessageId)) return { modified: 0, upToMessageId: null };
    upTo = oid(upToMessageId);
  } else {
    const latest = await Message.findOne({ conversationId, receiverId: oid(userId) }).sort({ _id: -1 }).select("_id").lean();
    if (!latest) return { modified: 0, upToMessageId: null };
    upTo = latest._id;
  }
  const now = new Date();
  const res = await Message.updateMany(
    { conversationId, receiverId: oid(userId), _id: { $lte: upTo }, readAt: { $exists: false } },
    [{ $set: { readAt: now, isRead: true, deliveredAt: { $ifNull: ["$deliveredAt", now] } } }],
    { updatePipeline: true },
  );
  await ConversationRead.findOneAndUpdate(
    { conversationId, userId: oid(userId) },
    [
      {
        $set: {
          lastReadMessageId: { $max: [{ $ifNull: ["$lastReadMessageId", upTo] }, upTo] },
          updatedAt: now,
        },
      },
    ],
    { upsert: true, updatePipeline: true },
  );
  return { modified: res.modifiedCount, upToMessageId: String(upTo), readAt: now };
}

/** Legacy "mark the whole conversation read" (older clients). */
async function markConversationRead({ conversationId, userId }) {
  return markRead({ conversationId, userId });
}

/** Messages sent to the user after their read position, answered by the { conversationId, _id } index. */
async function unreadCount({ conversationId, userId }) {
  const pos = await ConversationRead.findOne({ conversationId, userId: oid(userId) }).lean();
  const filter = { conversationId, receiverId: oid(userId) };
  if (pos) filter._id = { $gt: pos.lastReadMessageId };
  return Message.countDocuments(filter);
}

/** Everyone who shares a conversation with the user: they send or receive messages with each other. */
async function conversationPartners(userId) {
  const [sentTo, receivedFrom] = await Promise.all([
    Message.distinct("receiverId", { senderId: oid(userId) }),
    Message.distinct("senderId", { receiverId: oid(userId) }),
  ]);
  return [...new Set([...sentTo, ...receivedFrom].map(String))].filter((id) => id !== userId);
}

module.exports = {
  persistMessage,
  markDelivered,
  markBacklogDelivered,
  markRead,
  markConversationRead,
  unreadCount,
  conversationPartners,
};
