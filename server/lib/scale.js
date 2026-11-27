const Redis = require("ioredis");
const { createAdapter } = require("@socket.io/redis-adapter");
const logger = require("../config/logger");

/**
 * Lets several realtime instances behave as one: an event emitted on instance A
 * reaches the users connected to instance B, through Redis. Without a Redis URL
 * the server runs alone (one instance), which is the old behaviour.
 *
 * Returns { pub, sub, close() }, or null when no URL is set.
 */
function attachRedisAdapter(io, redisUrl) {
  if (!redisUrl) {
    logger.warn("REDIS_URL is not set: running a single realtime instance, events will not cross instances");
    return null;
  }
  const options = { retryStrategy: (times) => Math.min(times * 500, 5000) };
  const pub = new Redis(redisUrl, options);
  const sub = pub.duplicate();
  for (const c of [pub, sub]) c.on("error", (err) => logger.warn({ err: err.message }, "redis adapter connection error"));
  io.adapter(createAdapter(pub, sub));
  return {
    pub,
    sub,
    async close() {
      pub.disconnect();
      sub.disconnect();
    },
  };
}

/**
 * Graceful shutdown for SIGTERM: stop accepting connections and close the
 * sockets, so clients reconnect (through Nginx) to the other instance, then
 * close Redis and exit. A timer forces the exit if something hangs.
 */
function createShutdown({ io, httpServer, closers = [], exit = (code) => process.exit(code), timeoutMs = 10_000 }) {
  let started = false;
  return async function shutdown(signal) {
    if (started) return;
    started = true;
    logger.info({ signal }, "signal received, shutting down");
    const force = setTimeout(() => {
      logger.error("shutdown timed out, forcing exit");
      exit(1);
    }, timeoutMs);
    force.unref?.();
    try {
      // io.close() disconnects every client and closes the HTTP server.
      await new Promise((resolve) => io.close(() => resolve()));
      for (const close of closers) await close();
      clearTimeout(force);
      logger.info("shutdown complete");
      exit(0);
    } catch (err) {
      logger.error({ err }, "error during shutdown");
      exit(1);
    }
    void httpServer;
  };
}

module.exports = { attachRedisAdapter, createShutdown };
