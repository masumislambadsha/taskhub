/** How long a worker has to accept or appeal a rejection before the rejection becomes final. */
export const DEFAULT_DISPUTE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * `DISPUTE_WINDOW_MS` overrides the default (3 days). `0` settles a rejection
 * the moment it is made, as the app did before disputes existed; the test setup
 * uses that so older tests keep their meaning. Read on every call.
 */
export function disputeWindowMs(): number {
  const raw = process.env.DISPUTE_WINDOW_MS;
  const value = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_DISPUTE_WINDOW_MS;
}
