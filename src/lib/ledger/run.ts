import mongoose from "mongoose";

type Session = mongoose.mongo.ClientSession;

function isIdempotencyKeyDuplicate(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: number; message?: string; keyPattern?: object };
  return (
    e.code === 11000 &&
    (Boolean(e.keyPattern && "idempotencyKey" in e.keyPattern) ||
      /idempotencyKey/.test(e.message ?? ""))
  );
}

/**
 * Runs `fn` in a MongoDB transaction (snapshot reads, majority writes). Mongoose
 * retries it automatically on write conflicts. If the transaction loses a race
 * on a ledger idempotency key (a duplicate-key error, which is not retried by
 * the driver), it runs again once so the replay check sees the winner.
 *
 * Keep `fn` short and free of network calls.
 */
export async function inLedgerTransaction<T>(
  fn: (session: Session) => Promise<T>,
): Promise<T> {
  const options = {
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
  } as const;
  for (let attempt = 1; ; attempt++) {
    try {
      return await mongoose.connection.transaction(fn, options);
    } catch (err) {
      if (attempt < 3 && isIdempotencyKeyDuplicate(err)) continue;
      throw err;
    }
  }
}
