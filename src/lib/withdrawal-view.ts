/**
 * What a worker may see of a withdrawal. The confirmation token hash and the
 * risk assessment stay on the server: telling a fraudster why a request was
 * flagged helps them avoid the flags next time.
 */
export function workerWithdrawalView<T extends { toObject?: () => unknown }>(w: T): Record<string, unknown> {
  const plain = (typeof w.toObject === "function" ? w.toObject() : w) as Record<string, unknown>;
  const rest = { ...plain };
  for (const key of ["confirmTokenHash", "riskScore", "riskFlags", "approvedBy", "paidBy"]) delete rest[key];
  return rest;
}
