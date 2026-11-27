import { Emitter } from "@socket.io/redis-emitter";
import Redis from "ioredis";
import { logger } from "@/lib/logger";

let emitter: Emitter | null = null;
let connection: Redis | null = null;
let connectedTo: string | undefined;

function getEmitter(): Emitter | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!emitter || connectedTo !== url) {
    connection?.disconnect();
    // The emitter only publishes. It never holds a socket, so the web app and the
    // worker can reach a user on whichever realtime instance they are connected to.
    connection = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 1000, commandTimeout: 1000 });
    connection.on("error", () => {});
    const redis = connection;
    // The emitter calls `publish` and drops the promise, so a Redis hiccup would
    // become an unhandled rejection (which can end the process). This client
    // catches it: a missed push is only logged, the data is already saved.
    const safeClient = {
      publish: (channel: string, message: string | Buffer) =>
        redis.publish(channel, message).catch((err: unknown) => {
          logger.warn({ err: err instanceof Error ? err.message : String(err) }, "realtime push dropped");
          return 0;
        }),
    };
    emitter = new Emitter(safeClient as unknown as Redis);
    connectedTo = url;
  }
  return emitter;
}

/**
 * Pushes an event to a user's room (`user:<id>`) on every realtime instance.
 * Best effort and never throws: a missed push only means the page shows the
 * change on its next refresh, and the data is already saved. Returns whether it
 * was published.
 */
export async function emitToUser(userId: string, event: string, payload: unknown): Promise<boolean> {
  const e = getEmitter();
  if (!e) return false;
  try {
    e.to(`user:${userId}`).emit(event, payload);
    return true;
  } catch (err) {
    logger.warn({ err, event }, "realtime push failed");
    return false;
  }
}

/** Closes the Redis connection. For tests and shutdown. */
export async function closeRealtimeEmitter(): Promise<void> {
  const c = connection;
  connection = null;
  emitter = null;
  connectedTo = undefined;
  c?.disconnect();
}
