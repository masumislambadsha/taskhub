const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const jwt = require("jsonwebtoken");
const Redis = require("ioredis");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { Server } = require("socket.io");
const { io: connect } = require("socket.io-client");

const SECRET = "test-secret-test-secret-test-secret-123456";
process.env.SOCKET_JWT_SECRET = SECRET;
process.env.LOG_LEVEL = "silent";

const registerSocketHandlers = require("../socket");
const { attachRedisAdapter } = require("../lib/scale");
const { createPresence, createMemoryKv, PRESENCE_TTL_SEC } = require("../lib/presence");
const { conversationPartners, unreadCount } = require("../controllers/messageController");
const Message = require("../models/Message");
const ConversationRead = require("../models/ConversationRead");

const BASE = process.env.TEST_REDIS_URL;
const REDIS_URL = BASE ? `${BASE}/8` : undefined;
const needsRedis = { skip: !REDIS_URL && "TEST_REDIS_URL is not set" };

const ALICE = "65f0000000000000000000a1"; // the task's buyer
const BOB = "65f0000000000000000000b2";
const CAROL = "65f0000000000000000000d4"; // not in the conversation
const TASK = "65f0000000000000000000c3";
const CONVERSATION = `${TASK}_${ALICE}_${BOB}`;

let mongod;
test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "taskhub_chat_test" });
  await Message.init();
  await ConversationRead.init();
});
test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
test.beforeEach(async () => {
  await Promise.all([Message.deleteMany({}), ConversationRead.deleteMany({})]);
  const db = mongoose.connection.db;
  await db.collection("tasks").deleteMany({});
  await db.collection("users").deleteMany({});
  // The task whose buyer is Alice: what makes the conversation legitimate.
  await db.collection("tasks").insertOne({ _id: new mongoose.Types.ObjectId(TASK), buyerId: new mongoose.Types.ObjectId(ALICE) });
});

const token = (sub) =>
  jwt.sign({ name: sub === ALICE ? "Alice" : sub === BOB ? "Bob" : "Carol", role: "worker" }, SECRET, {
    algorithm: "HS256",
    subject: sub,
    issuer: "taskhub-web",
    audience: "taskhub-realtime",
    expiresIn: 600,
  });

const usersCollection = () => mongoose.connection.db.collection("users");
const oid = (id) => new mongoose.Types.ObjectId(id);

/** One realtime instance wired like index.js. `redisUrl` joins it to others. */
async function startInstance({ redisUrl, offlineDelayMs = 80, kv } = {}) {
  const httpServer = http.createServer();
  const io = new Server(httpServer, { transports: ["websocket"] });
  const adapter = attachRedisAdapter(io, redisUrl);
  const store = kv ?? (redisUrl ? new Redis(redisUrl) : createMemoryKv());
  const presence = createPresence({
    redis: store,
    getPartners: (id) => conversationPartners(id),
    isLastSeenHidden: async (id) => Boolean((await usersCollection().findOne({ _id: oid(id) }))?.hideLastSeen),
    saveLastSeen: (id, at) => usersCollection().updateOne({ _id: oid(id) }, { $set: { lastSeenAt: at } }, { upsert: true }),
    hasOtherSockets: async (id) => (await io.in(`user:${id}`).fetchSockets()).length > 0,
    announce: (partner, event) => io.to(`user:${partner}`).emit("presence:update", event),
    offlineDelayMs,
    heartbeatMs: 50,
  });
  registerSocketHandlers(io, { presence });
  await new Promise((resolve) => httpServer.listen(0, resolve));
  return {
    io,
    adapter,
    presence,
    store,
    url: `http://127.0.0.1:${httpServer.address().port}`,
    async close() {
      presence.stop();
      await new Promise((resolve) => io.close(() => resolve()));
      await adapter?.close();
      if (store instanceof Redis) store.disconnect();
    },
  };
}

function client(url, userId) {
  const socket = connect(url, { transports: ["websocket"], auth: { token: token(userId) }, reconnection: false });
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

const once = (socket, event, ms = 4000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no "${event}" within ${ms} ms`)), ms);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

const nothing = (socket, event, ms = 350) =>
  new Promise((resolve, reject) => {
    const handler = (d) => reject(new Error(`unexpected "${event}": ${JSON.stringify(d)}`));
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, ms);
  });

const emitAck = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Alice sends Bob a message; both are in the conversation. Returns the message Bob received. */
async function exchange(alice, bob, content = "hello") {
  const received = once(bob, "message:receive");
  alice.emit("message:send", { conversationId: CONVERSATION, taskId: TASK, receiverId: BOB, receiverName: "Bob", content });
  return received;
}

async function joinBoth(alice, bob) {
  alice.emit("join:conversation", CONVERSATION);
  bob.emit("join:conversation", CONVERSATION);
  await sleep(150);
}

// --------------------------------------------------------------------- read receipts

test("delivered: the recipient's device acknowledges, the sender is told once, and a stranger cannot", async () => {
  const inst = await startInstance();
  const alice = await client(inst.url, ALICE);
  const bob = await client(inst.url, BOB);
  const carol = await client(inst.url, CAROL);
  try {
    await joinBoth(alice, bob);
    const msg = await exchange(alice, bob);
    assert.equal(msg.deliveredAt, undefined);

    // Carol cannot say Bob received it.
    carol.emit("message:delivered", { messageId: msg._id });
    await nothing(alice, "message:delivered");
    assert.equal((await Message.findById(msg._id)).deliveredAt, undefined);

    const told = once(alice, "message:delivered");
    bob.emit("message:delivered", { messageId: msg._id });
    const event = await told;
    assert.deepEqual(event.messageIds, [msg._id]);
    assert.equal(event.conversationId, CONVERSATION);
    assert.ok((await Message.findById(msg._id)).deliveredAt instanceof Date);

    // Acknowledging again changes nothing and tells nobody.
    bob.emit("message:delivered", { messageId: msg._id });
    await nothing(alice, "message:delivered");

    // The sender cannot acknowledge their own message either.
    const second = await exchange(alice, bob, "second");
    alice.emit("message:delivered", { messageId: second._id });
    await sleep(200);
    assert.equal((await Message.findById(second._id)).deliveredAt, undefined);
  } finally {
    [alice, bob, carol].forEach((s) => s.disconnect());
    await inst.close();
  }
});

test("messages sent while the recipient was away are delivered when they reconnect", async () => {
  const inst = await startInstance();
  const alice = await client(inst.url, ALICE);
  try {
    alice.emit("join:conversation", CONVERSATION);
    await sleep(100);
    alice.emit("message:send", { conversationId: CONVERSATION, taskId: TASK, receiverId: BOB, content: "while you were out" });
    await sleep(250);
    const stored = await Message.findOne({});
    assert.equal(stored.deliveredAt, undefined);

    const told = once(alice, "message:delivered");
    const bob = await client(inst.url, BOB);
    const event = await told;
    assert.deepEqual(event.messageIds, [String(stored._id)]);
    assert.ok((await Message.findById(stored._id)).deliveredAt instanceof Date);
    bob.disconnect();
  } finally {
    alice.disconnect();
    await inst.close();
  }
});

test("read: one update marks everything up to the message, the sender is told, and the position never moves back", async () => {
  const inst = await startInstance();
  const alice = await client(inst.url, ALICE);
  const bob = await client(inst.url, BOB);
  try {
    await joinBoth(alice, bob);
    const m1 = await exchange(alice, bob, "one");
    const m2 = await exchange(alice, bob, "two");
    const m3 = await exchange(alice, bob, "three");

    const told = once(alice, "conversation:read");
    const ack = await emitAck(bob, "conversation:read", { conversationId: CONVERSATION, upToMessageId: m2._id });
    assert.deepEqual({ ok: ack.ok, modified: ack.modified, unread: ack.unread }, { ok: true, modified: 2, unread: 1 });
    const event = await told;
    assert.equal(event.upToMessageId, m2._id);
    assert.equal(event.userId, BOB);

    const rows = Object.fromEntries((await Message.find({}).lean()).map((m) => [String(m._id), m]));
    assert.ok(rows[m1._id].readAt && rows[m2._id].readAt);
    assert.equal(rows[m3._id].readAt, undefined);
    // Reading also counts as delivered, even if the acknowledgement never arrived.
    assert.ok(rows[m1._id].deliveredAt && rows[m2._id].deliveredAt);
    assert.equal(rows[m1._id].isRead, true);

    // Reading an earlier message later does not move the position back.
    await emitAck(bob, "conversation:read", { conversationId: CONVERSATION, upToMessageId: m1._id });
    const pos = await ConversationRead.findOne({ conversationId: CONVERSATION, userId: oid(BOB) });
    assert.equal(String(pos.lastReadMessageId), m2._id);

    // Reading the rest, and asking for the unread count.
    const all = await emitAck(bob, "conversation:read", { conversationId: CONVERSATION, upToMessageId: m3._id });
    assert.equal(all.unread, 0);
    assert.equal((await emitAck(bob, "conversation:unread", { conversationId: CONVERSATION })).unread, 0);
    // Nothing left to change: no event.
    const again = await emitAck(bob, "conversation:read", { conversationId: CONVERSATION, upToMessageId: m3._id });
    assert.equal(again.modified, 0);
  } finally {
    alice.disconnect();
    bob.disconnect();
    await inst.close();
  }
});

test("read: the sender's own messages are never marked, and only participants can read or count", async () => {
  const inst = await startInstance();
  const alice = await client(inst.url, ALICE);
  const bob = await client(inst.url, BOB);
  const carol = await client(inst.url, CAROL);
  try {
    await joinBoth(alice, bob);
    const m1 = await exchange(alice, bob, "from alice");
    // Alice marking her own message read does nothing: it was sent by her, not to her.
    const own = await emitAck(alice, "conversation:read", { conversationId: CONVERSATION, upToMessageId: m1._id });
    assert.equal(own.modified, 0);
    assert.equal((await Message.findById(m1._id)).readAt, undefined);

    // A stranger is refused, and a malformed ID is a no-op.
    assert.equal((await emitAck(carol, "conversation:read", { conversationId: CONVERSATION, upToMessageId: m1._id })).ok, false);
    assert.equal((await emitAck(carol, "conversation:unread", { conversationId: CONVERSATION })).ok, false);
    assert.equal((await emitAck(bob, "conversation:read", { conversationId: CONVERSATION, upToMessageId: "nope" })).modified, 0);
    assert.equal((await Message.findById(m1._id)).readAt, undefined);
  } finally {
    [alice, bob, carol].forEach((s) => s.disconnect());
    await inst.close();
  }
});

test("the unread count walks the conversation from the saved read position", async () => {
  const inst = await startInstance();
  const alice = await client(inst.url, ALICE);
  const bob = await client(inst.url, BOB);
  try {
    await joinBoth(alice, bob);
    for (const c of ["a", "b", "c", "d"]) await exchange(alice, bob, c);
    assert.equal(await unreadCount({ conversationId: CONVERSATION, userId: BOB }), 4);
    const [first, second] = await Message.find({}).sort({ _id: 1 }).limit(2).lean();
    await emitAck(bob, "conversation:read", { conversationId: CONVERSATION, upToMessageId: String(second._id) });
    assert.equal(await unreadCount({ conversationId: CONVERSATION, userId: BOB }), 2);
    assert.equal(await unreadCount({ conversationId: CONVERSATION, userId: ALICE }), 0);
    void first;
    // The index the count relies on exists.
    const indexes = await Message.collection.indexes();
    assert.ok(indexes.some((i) => i.key.conversationId === 1 && i.key._id === 1));
  } finally {
    alice.disconnect();
    bob.disconnect();
    await inst.close();
  }
});

test("receipts cross instances: a message sent on one is delivered and read on the other", needsRedis, async () => {
  const flush = new Redis(REDIS_URL);
  await flush.flushdb();
  flush.disconnect();
  const one = await startInstance({ redisUrl: REDIS_URL });
  const two = await startInstance({ redisUrl: REDIS_URL });
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && (await one.io.of("/").adapter.serverCount()) !== 2) await sleep(50);
  const alice = await client(one.url, ALICE);
  const bob = await client(two.url, BOB);
  try {
    await joinBoth(alice, bob);
    const msg = await exchange(alice, bob, "across");
    const delivered = once(alice, "message:delivered");
    bob.emit("message:delivered", { messageId: msg._id });
    assert.deepEqual((await delivered).messageIds, [msg._id]);
    const read = once(alice, "conversation:read");
    await emitAck(bob, "conversation:read", { conversationId: CONVERSATION, upToMessageId: msg._id });
    assert.equal((await read).upToMessageId, msg._id);
  } finally {
    alice.disconnect();
    bob.disconnect();
    await one.close();
    await two.close();
  }
});

// ------------------------------------------------------------------------- presence

async function becomePartners(inst) {
  const alice = await client(inst.url, ALICE);
  const bob = await client(inst.url, BOB);
  await joinBoth(alice, bob);
  await exchange(alice, bob, "hi");
  alice.disconnect();
  bob.disconnect();
  await sleep(600); // longer than any offline delay used below, so both are really offline
}

test("presence: a partner coming online is announced, going offline only after a delay, and a quick reconnect does not flicker", async () => {
  const inst = await startInstance({ offlineDelayMs: 250 });
  try {
    await becomePartners(inst);
    const alice = await client(inst.url, ALICE);
    const online = once(alice, "presence:update");
    const bob = await client(inst.url, BOB);
    assert.deepEqual(await online, { userId: BOB, online: true });

    // Bob drops and is back before the delay ends: Alice never hears he left.
    bob.disconnect();
    await sleep(80);
    const back = await client(inst.url, BOB);
    await nothing(alice, "presence:update", 450);

    // Now he really leaves: after the delay Alice is told, with when he was last seen.
    const offline = once(alice, "presence:update", 2000);
    back.disconnect();
    const event = await offline;
    assert.equal(event.userId, BOB);
    assert.equal(event.online, false);
    assert.ok(Date.now() - Date.parse(event.lastSeen) < 2000);
    alice.disconnect();
  } finally {
    await inst.close();
  }
});

test("presence: a second tab keeps the user online, and strangers hear nothing", async () => {
  const inst = await startInstance({ offlineDelayMs: 100 });
  try {
    await becomePartners(inst);
    const alice = await client(inst.url, ALICE);
    const carol = await client(inst.url, CAROL);
    const tab1 = await client(inst.url, BOB);
    const tab2 = await client(inst.url, BOB);
    await sleep(150);
    tab1.disconnect();
    await nothing(alice, "presence:update", 400);
    await nothing(carol, "presence:update", 100);
    const offline = once(alice, "presence:update", 2000);
    tab2.disconnect();
    assert.equal((await offline).online, false);
    alice.disconnect();
    carol.disconnect();
  } finally {
    await inst.close();
  }
});

test("presence: a user who hides last seen is still shown online but never with a time", async () => {
  const inst = await startInstance({ offlineDelayMs: 100 });
  try {
    await becomePartners(inst);
    await usersCollection().updateOne({ _id: oid(BOB) }, { $set: { hideLastSeen: true } }, { upsert: true });
    const alice = await client(inst.url, ALICE);
    const online = once(alice, "presence:update");
    const bob = await client(inst.url, BOB);
    assert.deepEqual(await online, { userId: BOB, online: true });
    const offline = once(alice, "presence:update", 2000);
    bob.disconnect();
    assert.deepEqual(await offline, { userId: BOB, online: false });
    // The lookup does not reveal it either.
    const res = await emitAck(alice, "presence:get", { userIds: [BOB] });
    assert.deepEqual(res.states[BOB], { userId: BOB, online: false });
    alice.disconnect();
  } finally {
    await inst.close();
  }
});

test("presence: only people you share a conversation with can be looked up", async () => {
  const inst = await startInstance({ offlineDelayMs: 100 });
  try {
    await becomePartners(inst);
    const alice = await client(inst.url, ALICE);
    const carol = await client(inst.url, CAROL);
    const bob = await client(inst.url, BOB);
    await sleep(150);
    const seen = await emitAck(alice, "presence:get", { userIds: [BOB, CAROL, "not-an-id"] });
    assert.equal(seen.ok, true);
    assert.deepEqual(Object.keys(seen.states), [BOB]);
    assert.equal(seen.states[BOB].online, true);
    // Carol shares nothing with Bob: she gets nothing.
    const none = await emitAck(carol, "presence:get", { userIds: [BOB, ALICE] });
    assert.deepEqual(none.states, {});
    [alice, carol, bob].forEach((s) => s.disconnect());
  } finally {
    await inst.close();
  }
});

test("presence: last seen is saved to MongoDB when a user goes offline", async () => {
  const inst = await startInstance({ offlineDelayMs: 80 });
  try {
    await becomePartners(inst);
    const bob = await client(inst.url, BOB);
    await sleep(100);
    bob.disconnect();
    await sleep(500);
    const saved = (await usersCollection().findOne({ _id: oid(BOB) })).lastSeenAt;
    assert.ok(saved instanceof Date);
    assert.ok(Date.now() - saved.getTime() < 3000);
  } finally {
    await inst.close();
  }
});

test("presence: with no heartbeat the key expires by itself, so a crashed instance leaves no ghost online users", async () => {
  let clock = 1_000_000;
  const kv = createMemoryKv(() => clock);
  const inst = await startInstance({ kv });
  try {
    await inst.presence.beat(BOB);
    assert.equal((await inst.presence.stateOf([BOB]))[BOB].online, true);
    // The instance dies: no more heartbeats. After the TTL the user is offline, with no announcement needed.
    clock += (PRESENCE_TTL_SEC - 1) * 1000;
    assert.equal((await inst.presence.stateOf([BOB]))[BOB].online, true);
    clock += 2000;
    const state = (await inst.presence.stateOf([BOB]))[BOB];
    assert.equal(state.online, false);
  } finally {
    await inst.close();
  }
});

test("presence: heartbeats keep refreshing the 60-second key while connected", needsRedis, async () => {
  const flush = new Redis(REDIS_URL);
  await flush.flushdb();
  const inst = await startInstance({ redisUrl: REDIS_URL });
  try {
    const bob = await client(inst.url, BOB);
    await sleep(200);
    assert.ok((await flush.ttl(`presence:${BOB}`)) > PRESENCE_TTL_SEC - 5);
    await flush.expire(`presence:${BOB}`, 5);
    await sleep(250); // the test heartbeat runs every 50 ms
    assert.ok((await flush.ttl(`presence:${BOB}`)) > PRESENCE_TTL_SEC - 5);
    bob.disconnect();
  } finally {
    flush.disconnect();
    await inst.close();
  }
});

test("presence announcements cross instances", needsRedis, async () => {
  const flush = new Redis(REDIS_URL);
  await flush.flushdb();
  flush.disconnect();
  const one = await startInstance({ redisUrl: REDIS_URL });
  const two = await startInstance({ redisUrl: REDIS_URL });
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && (await one.io.of("/").adapter.serverCount()) !== 2) await sleep(50);
  try {
    await becomePartners(one);
    const alice = await client(one.url, ALICE); // watching on instance one
    const online = once(alice, "presence:update");
    const bob = await client(two.url, BOB); // arrives on instance two
    assert.deepEqual(await online, { userId: BOB, online: true });
    const offline = once(alice, "presence:update", 3000);
    bob.disconnect();
    assert.equal((await offline).online, false);
    alice.disconnect();
  } finally {
    await one.close();
    await two.close();
  }
});
