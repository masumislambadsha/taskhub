
export function getConversationId(
  taskId: string,
  userId1: string,
  userId2: string,
): string {
  const sorted = [userId1, userId2].sort().join("_");
  return `${taskId}_${sorted}`;
}

const OBJECT_ID = "[0-9a-fA-F]{24}";
const CONVERSATION_ID = new RegExp(
  `^(${OBJECT_ID})_(${OBJECT_ID})_(${OBJECT_ID})$`,
);

/**
 * Conversation IDs look like `${taskId}_${userA}_${userB}` (see
 * getConversationId). Returns { taskId, participants } for a well-formed ID,
 * otherwise null. Mirrors server/lib/conversations.js.
 */
export function parseConversationId(
  conversationId: unknown,
): { taskId: string; participants: [string, string] } | null {
  if (typeof conversationId !== "string") return null;
  const match = CONVERSATION_ID.exec(conversationId);
  if (!match) return null;
  return { taskId: match[1], participants: [match[2], match[3]] };
}

/** True when userId is one of the two participants of a well-formed ID. */
export function isParticipant(conversationId: unknown, userId: unknown): boolean {
  const parsed = parseConversationId(conversationId);
  if (!parsed || typeof userId !== "string") return false;
  const id = userId.toLowerCase();
  return parsed.participants.some((p) => p.toLowerCase() === id);
}
