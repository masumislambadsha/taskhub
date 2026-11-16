const mongoose = require("mongoose");

const OBJECT_ID = "[0-9a-fA-F]{24}";
const CONVERSATION_ID = new RegExp(`^(${OBJECT_ID})_(${OBJECT_ID})_(${OBJECT_ID})$`);

/**
 * Conversation IDs look like `${taskId}_${userA}_${userB}` (see
 * src/lib/conversation.ts in the web app). Returns { taskId, participants }
 * for a well-formed ID, otherwise null.
 */
function parseConversationId(conversationId) {
  if (typeof conversationId !== "string") return null;
  const match = CONVERSATION_ID.exec(conversationId);
  if (!match) return null;
  return { taskId: match[1], participants: [match[2], match[3]] };
}

function isParticipant(conversationId, userId) {
  const parsed = parseConversationId(conversationId);
  if (!parsed || typeof userId !== "string") return false;
  const id = userId.toLowerCase();
  return parsed.participants.some((p) => p.toLowerCase() === id);
}

/** The other participant's ID (lower-case), or null if userId is not in it. */
function otherParticipant(conversationId, userId) {
  const parsed = parseConversationId(conversationId);
  if (!parsed || typeof userId !== "string") return null;
  const id = userId.toLowerCase();
  const [a, b] = parsed.participants.map((p) => p.toLowerCase());
  if (id === a) return b;
  if (id === b) return a;
  return null;
}

/**
 * The web app lets any signed-in worker open a chat with a task's buyer
 * ("Message Buyer" on the task pages), and the buyer replies in it. So a
 * conversation is legitimate when the task exists and one participant is the
 * task's buyer. Read-only query; the realtime server has no Task model.
 * `db` is a native MongoDB Db (mongoose.connection.db).
 */
async function isLegitimateConversation(db, conversationId) {
  const parsed = parseConversationId(conversationId);
  if (!parsed || !db) return false;
  const task = await db
    .collection("tasks")
    .findOne(
      { _id: new mongoose.Types.ObjectId(parsed.taskId) },
      { projection: { buyerId: 1 } },
    );
  if (!task || !task.buyerId) return false;
  const buyerId = String(task.buyerId).toLowerCase();
  return parsed.participants.some((p) => p.toLowerCase() === buyerId);
}

module.exports = {
  parseConversationId,
  isParticipant,
  otherParticipant,
  isLegitimateConversation,
};
