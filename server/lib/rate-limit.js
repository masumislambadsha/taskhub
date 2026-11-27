const Redis = require("ioredis");
const logger = require("../config/logger");

// 20 chat messages per 10 seconds per user. Fails open: a Redis outage must not
// stop people chatting, so a message is allowed when the limiter cannot answer.
// (The web app has the same limit in src/lib/rate-limit-config.ts.)
const CHAT = { points: 20, windowSec: 10 };

// Counts one attempt atomically and starts the window on the first hit, so two
// realtime instances cannot both think a user is under the limit.
const SCRIPT = `
local c = redis.call('INCRBY', KEYS[1], ARGV[1])
if c == tonumber(ARGV[1]) then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then redis.call('EXPIRE', KEYS[1], ARGV[2]); ttl = tonumber(ARGV[2]) end
return {c, ttl}
`;

/**
 * Returns { consume(userId), close() }. With a Redis URL the count is shared by
 * every instance; without one it is kept in this process.
 */
function createChatLimiter({ redisUrl, spec = CHAT } = {}) {
  const memory = new Map();
  const client = redisUrl
    ? new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 1000, commandTimeout: 1000 })
    : null;
  client?.on("error", () => {});

  async function consume(userId, now = Date.now()) {
    if (!client) {
      const entry = memory.get(userId);
      if (!entry || entry.resetAt <= now) {
        memory.set(userId, { count: 1, resetAt: now + spec.windowSec * 1000 });
        return { ok: true, retryAfterSeconds: 0 };
      }
      if (entry.count >= spec.points) {
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
      }
      entry.count += 1;
      return { ok: true, retryAfterSeconds: 0 };
    }
    try {
      const [count, ttl] = await client.eval(SCRIPT, 1, `rl:chat:${userId}`, 1, spec.windowSec);
      if (count <= spec.points) return { ok: true, retryAfterSeconds: 0 };
      return { ok: false, retryAfterSeconds: Math.max(1, ttl) };
    } catch (err) {
      logger.warn({ err: err.message }, "chat rate limiter unavailable; allowing the message");
      return { ok: true, retryAfterSeconds: 0, degraded: true };
    }
  }

  return {
    consume,
    async close() {
      client?.disconnect();
    },
  };
}

module.exports = { createChatLimiter, CHAT };
