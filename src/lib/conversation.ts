
export function getConversationId(
  taskId: string,
  userId1: string,
  userId2: string,
): string {
  const sorted = [userId1, userId2].sort().join("_");
  return `${taskId}_${sorted}`;
}
