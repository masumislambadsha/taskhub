/** How long a buyer has to review a submission before it is approved automatically. */
export const DEFAULT_AUTO_APPROVE_AFTER_MS = 72 * 60 * 60 * 1000;

/**
 * `AUTO_APPROVE_AFTER_MS` overrides the default so tests (and a staging site)
 * can use seconds instead of 72 hours. Read on every call, never cached.
 */
export function autoApproveAfterMs(): number {
  const raw = process.env.AUTO_APPROVE_AFTER_MS;
  const value = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_AUTO_APPROVE_AFTER_MS;
}

/** When a submission made now will be approved automatically. */
export function autoApproveAtFrom(now: number = Date.now()): Date {
  return new Date(now + autoApproveAfterMs());
}
