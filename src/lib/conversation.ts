/**
 * Generates a deterministic conversationId for a task between two users.
 * Always produces the same ID regardless of argument order.
 */
export function getConversationId(
  taskId: string,
  userId1: string,
  userId2: string,
): string {
  const sorted = [userId1, userId2].sort().join("_");
  return `${taskId}_${sorted}`;
}
