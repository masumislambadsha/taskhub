const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const jwt = require("jsonwebtoken");
const Redis = require("ioredis");
const { Server } = require("socket.io");
const { io: connect } = require("socket.io-client");

const SECRET = "test-secret-test-secret-test-secret-123456";
process.env.SOCKET_JWT_SECRET = SECRET;
process.env.LOG_LEVEL = "silent";

const registerSocketHandlers = require("../socket");
const { attachRedisAdapter, createShutdown } = require("../lib/scale");
const { createChatLimiter } = require("../lib/rate-limit");

// Needs a real Redis: set TEST_REDIS_URL (CI does). Each test file uses its own database number.
const BASE = process.env.TEST_REDIS_URL;
const REDIS_URL = BASE ? `${BASE}/5` : undefined;
const needsRedis = { skip: !REDIS_URL && "TEST_REDIS_URL is not set" };

/** Empties this file's Redis database, and does not leave a connection open (it would keep the test run alive). */
async function flush() {
  const r = new Redis(REDIS_URL);
  await r.flushdb();
  r.disconnect();
}

const ALICE = "65f0000000000000000000a1";
const BOB = "65f0000000000000000000b2";
const TASK = "65f0000000000000000000c3";
const CONVERSATION = `${TASK}_${ALICE}_${BOB}`;

const token = (sub) =>
  jwt.sign({ name: "Tester", role: "worker" }, SECRET, {
    algorithm: "HS256",
    subject: sub,
    issuer: "taskhub-web",
    audience: "taskhub-realtime",
    expiresIn: 600,
  });

/** One realtime instance on a free port, wired like index.js. */
async function startInstance({ redisUrl, chatLimiter } = {}) {
  const httpServer = http.createServer();
  const io = new Server(httpServer, { transports: ["websocket"] });
  const adapter = attachRedisAdapter(io, redisUrl);
  registerSocketHandlers(io, { chatLimiter });
  await new Promise((resolve) => httpServer.listen(0, resolve));
  const port = httpServer.address().port;
  return { io, httpServer, adapter, port, url: `http://127.0.0.1:${port}` };
}

/** Waits until both instances have subscribed to Redis and can see each other (they start long before traffic in production). */
async function waitForPeers(first, second) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const [a, b] = await Promise.all([first.io.of("/").adapter.serverCount(), second.io.of("/").adapter.serverCount()]);
    if (a === 2 && b === 2) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("the two instances never saw each other through Redis");
}

/** Waits until `count` sockets, on any instance, are in the room. */
async function waitForRoom(instance, room, count) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if ((await instance.io.in(room).fetchSockets()).length === count) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`the room never had ${count} members`);
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

const nothing = (socket, event, ms = 400) =>
  new Promise((resolve, reject) => {
    const handler = () => reject(new Error(`unexpected "${event}"`));
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, ms);
  });

async function cleanup(...things) {
  for (const t of things) {
    if (!t) continue;
    if (typeof t.disconnect === "function") t.disconnect();
    else if (t.io) {
      await new Promise((resolve) => t.io.close(() => resolve()));
      await t.adapter?.close();
    }
  }
}

test("without a Redis URL the server runs alone and says so", () => {
  const io = new Server(http.createServer());
  assert.equal(attachRedisAdapter(io, undefined), null);
  io.close();
});

test("an event emitted on one instance reaches a user connected to the other", needsRedis, async () => {
  await flush();
  const one = await startInstance({ redisUrl: REDIS_URL });
  const two = await startInstance({ redisUrl: REDIS_URL });
  await waitForPeers(one, two);
  const alice = await client(one.url, ALICE); // on instance one
  const bob = await client(two.url, BOB); // on instance two
  try {
    // Every user is in a room of their own, on whichever instance they landed.
    const received = once(bob, "notification:new");
    one.io.to(`user:${BOB}`).emit("notification:new", { message: "hello Bob" });
    assert.deepEqual(await received, { message: "hello Bob" });

    // And the room of one user does not leak to another.
    await nothing(alice, "notification:new");
  } finally {
    await cleanup(alice, bob, one, two);
  }
});

test("a conversation room spans instances: both people get the same message", needsRedis, async () => {
  await flush();
  const one = await startInstance({ redisUrl: REDIS_URL });
  const two = await startInstance({ redisUrl: REDIS_URL });
  await waitForPeers(one, two);
  const alice = await client(one.url, ALICE);
  const bob = await client(two.url, BOB);
  try {
    // Join through the server side, as the real handler does after its checks.
    one.io.in(`user:${ALICE}`).socketsJoin(CONVERSATION);
    two.io.in(`user:${BOB}`).socketsJoin(CONVERSATION);
    await waitForRoom(two, CONVERSATION, 2);
    const gotAlice = once(alice, "message:receive");
    const gotBob = once(bob, "message:receive");
    two.io.to(CONVERSATION).emit("message:receive", { content: "hi from instance two" });
    assert.equal((await gotAlice).content, "hi from instance two");
    assert.equal((await gotBob).content, "hi from instance two");
  } finally {
    await cleanup(alice, bob, one, two);
  }
});

test("when an instance shuts down its clients are disconnected and the other instance keeps serving", needsRedis, async () => {
  await flush();
  const one = await startInstance({ redisUrl: REDIS_URL });
  const two = await startInstance({ redisUrl: REDIS_URL });
  await waitForPeers(one, two);
  const alice = await client(one.url, ALICE);
  const bob = await client(two.url, BOB);
  let exitCode;
  let closed = 0;
  const shutdown = createShutdown({
    io: one.io,
    httpServer: one.httpServer,
    closers: [async () => { closed += 1; }, () => one.adapter.close()],
    exit: (code) => { exitCode = code; },
  });
  try {
    const dropped = once(alice, "disconnect");
    await shutdown("SIGTERM");
    await shutdown("SIGTERM"); // a second signal does nothing
    // Either reason makes the client reconnect, which is what Nginx then routes to the other instance.
    assert.ok(["io server disconnect", "transport close"].includes(await dropped));
    assert.equal(exitCode, 0);
    assert.equal(closed, 1);

    // Alice reconnects (Nginx now sends her to the instance that is left) and chat still reaches Bob.
    const aliceAgain = await client(two.url, ALICE);
    const heard = once(bob, "notification:new");
    two.io.to(`user:${BOB}`).emit("notification:new", { message: "still here" });
    assert.equal((await heard).message, "still here");
    aliceAgain.disconnect();
  } finally {
    await cleanup(alice, bob, two);
  }
});

test("a failing closer still ends in exit code 1", async () => {
  const io = new Server(http.createServer());
  let exitCode;
  const shutdown = createShutdown({
    io,
    closers: [async () => { throw new Error("boom"); }],
    exit: (code) => { exitCode = code; },
  });
  await shutdown("SIGTERM");
  assert.equal(exitCode, 1);
});

test("the chat limit is 20 messages in 10 seconds per user, and the 21st is refused with the wait", async () => {
  const limiter = createChatLimiter({});
  const instance = await startInstance({ chatLimiter: limiter });
  const alice = await client(instance.url, ALICE);
  try {
    const errors = [];
    alice.on("message:error", (e) => errors.push(e));
    for (let i = 0; i < 25; i++) {
      alice.emit("message:send", { conversationId: CONVERSATION, taskId: TASK, receiverId: BOB, content: `m${i}` });
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
    const limited = errors.filter((e) => /too fast/.test(e.error));
    assert.equal(limited.length, 5);
    assert.ok(limited.every((e) => e.retryAfterSeconds >= 1 && e.retryAfterSeconds <= 10));
  } finally {
    await cleanup(alice, instance);
    await limiter.close();
  }
});

test("the chat limit is shared: alternating between two instances still stops at 20", needsRedis, async () => {
  await flush();
  const a = createChatLimiter({ redisUrl: REDIS_URL });
  const b = createChatLimiter({ redisUrl: REDIS_URL });
  try {
    const results = [];
    for (let i = 0; i < 22; i++) results.push((i % 2 ? a : b).consume(ALICE));
    const settled = await Promise.all(results);
    assert.equal(settled.filter((r) => r.ok).length, 20);
    const other = await a.consume(BOB);
    assert.equal(other.ok, true);
  } finally {
    await a.close();
    await b.close();
  }
});

test("a chat limiter whose Redis is down lets messages through (fails open)", async () => {
  const limiter = createChatLimiter({ redisUrl: "redis://127.0.0.1:1" });
  try {
    const res = await limiter.consume(ALICE);
    assert.equal(res.ok, true);
    assert.equal(res.degraded, true);
  } finally {
    await limiter.close();
  }
});

test("the in-memory limiter opens a new window", async () => {
  const limiter = createChatLimiter({});
  const t0 = 1_000_000;
  for (let i = 0; i < 20; i++) assert.equal((await limiter.consume(ALICE, t0)).ok, true);
  assert.equal((await limiter.consume(ALICE, t0 + 1000)).ok, false);
  assert.equal((await limiter.consume(ALICE, t0 + 10_001)).ok, true);
  await limiter.close();
});
