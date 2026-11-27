const logger = require("../config/logger");

const PRESENCE_TTL_SEC = 60; // a user with no heartbeat for this long is offline
const HEARTBEAT_MS = 25_000; // refresh well inside the TTL
const OFFLINE_DELAY_MS = 10_000; // wait this long before announcing "offline" (reconnects, tab switches)
const DB_SAVE_EVERY_SEC = 300; // lastSeen is written to MongoDB at most this often per user

/**
 * Online status and last seen, in Redis, shared by every realtime instance.
 *
 * - Online means the key `presence:<id>` exists. Each connected socket refreshes it
 *   every 25 seconds with a 60-second TTL, so if an instance crashes its users go
 *   offline by themselves when the keys expire: there are no "ghost" online users.
 * - `lastSeen:<id>` is refreshed with every heartbeat and on disconnect, and saved
 *   to MongoDB at most every 5 minutes, and when the user goes offline.
 * - A change is announced only to people who share a conversation with the user,
 *   and "offline" is announced only after a delay, so a reconnect does not flicker.
 * - A user can hide their last seen. Whether they are online is still shown.
 *
 * Everything outside Redis is injected, so this module has no database of its own:
 *   getPartners(userId)      -> ids of people who share a conversation with the user
 *   isLastSeenHidden(userId) -> true if the user hides their last seen
 *   saveLastSeen(userId, at) -> persists the time
 *   hasOtherSockets(userId)  -> true if the user still has a connected socket anywhere
 *   announce(partnerId, event) -> delivers a presence:update to that partner
 */
function createPresence({
  redis,
  getPartners,
  isLastSeenHidden,
  saveLastSeen,
  hasOtherSockets,
  announce,
  offlineDelayMs = OFFLINE_DELAY_MS,
  heartbeatMs = HEARTBEAT_MS,
}) {
  const timers = new Map(); // userId -> pending "offline" timer
  const heartbeats = new Map(); // socketId -> interval

  const key = (id) => `presence:${id}`;
  const lastSeenKey = (id) => `lastSeen:${id}`;

  async function publicState(userId, online, lastSeen) {
    const hidden = await isLastSeenHidden(userId);
    return { userId, online, ...(!online && !hidden && lastSeen ? { lastSeen: new Date(lastSeen).toISOString() } : {}) };
  }

  async function tell(userId, online, lastSeen) {
    const event = await publicState(userId, online, lastSeen);
    for (const partner of await getPartners(userId)) announce(partner, event);
  }

  async function beat(userId) {
    const now = Date.now();
    await redis.set(key(userId), "1", "EX", PRESENCE_TTL_SEC);
    await redis.set(lastSeenKey(userId), String(now));
    // Save to MongoDB now and then, not on every heartbeat.
    const first = await redis.set(`lastSeen:saved:${userId}`, "1", "EX", DB_SAVE_EVERY_SEC, "NX");
    if (first) await saveLastSeen(userId, new Date(now)).catch((err) => logger.warn({ err: err.message }, "saving lastSeen failed"));
  }

  /** A socket connected. Starts its heartbeat, and announces "online" if the user was not. */
  async function connected(userId, socketId) {
    const pending = timers.get(userId);
    if (pending) {
      // Back before the offline delay ran out: nobody ever saw them leave.
      clearTimeout(pending);
      timers.delete(userId);
    }
    const wasOnline = (await redis.exists(key(userId))) === 1;
    await beat(userId);
    const interval = setInterval(() => beat(userId).catch(() => {}), heartbeatMs);
    interval.unref?.();
    heartbeats.set(socketId, interval);
    if (!wasOnline) await tell(userId, true);
  }

  /** A socket disconnected. After a short delay, if the user has no other socket, they are offline. */
  function disconnected(userId, socketId) {
    clearInterval(heartbeats.get(socketId));
    heartbeats.delete(socketId);
    if (timers.has(userId)) return;
    const timer = setTimeout(async () => {
      timers.delete(userId);
      try {
        if (await hasOtherSockets(userId)) return; // another tab, or reconnected to another instance
        const now = new Date();
        await redis.del(key(userId));
        await redis.set(lastSeenKey(userId), String(now.getTime()));
        await saveLastSeen(userId, now).catch(() => {});
        await tell(userId, false, now);
      } catch (err) {
        logger.warn({ err: err.message, userId }, "presence offline step failed");
      }
    }, offlineDelayMs);
    timer.unref?.();
    timers.set(userId, timer);
  }

  /** The current state of the given users, for people allowed to see them. */
  async function stateOf(userIds) {
    const out = {};
    for (const id of userIds) {
      const [online, seen] = await Promise.all([redis.exists(key(id)), redis.get(lastSeenKey(id))]);
      out[id] = await publicState(id, online === 1, seen ? Number(seen) : null);
    }
    return out;
  }

  function stop() {
    for (const t of timers.values()) clearTimeout(t);
    for (const i of heartbeats.values()) clearInterval(i);
    timers.clear();
    heartbeats.clear();
  }

  return { connected, disconnected, stateOf, stop, beat };
}

/**
 * The handful of Redis commands presence uses (set with EX and NX, get, exists,
 * del), kept in memory. For a single realtime instance without Redis.
 */
function createMemoryKv(now = () => Date.now()) {
  const store = new Map();
  const live = (k) => {
    const e = store.get(k);
    if (!e) return null;
    if (e.expiresAt && e.expiresAt <= now()) {
      store.delete(k);
      return null;
    }
    return e;
  };
  return {
    async set(k, v, ...opts) {
      const nx = opts.includes("NX");
      if (nx && live(k)) return null;
      const ex = opts.indexOf("EX");
      store.set(k, { v, expiresAt: ex >= 0 ? now() + Number(opts[ex + 1]) * 1000 : 0 });
      return "OK";
    },
    async get(k) {
      return live(k)?.v ?? null;
    },
    async exists(k) {
      return live(k) ? 1 : 0;
    },
    async del(k) {
      return store.delete(k) ? 1 : 0;
    },
  };
}

module.exports = {
  createPresence,
  createMemoryKv,
  PRESENCE_TTL_SEC,
  HEARTBEAT_MS,
  OFFLINE_DELAY_MS,
  DB_SAVE_EVERY_SEC,
};
