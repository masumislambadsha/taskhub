const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

// Obviously fake secrets, long enough to be accepted.
const SECRET = "test-secret-test-secret-test-secret-123456";
const OTHER_SECRET = "another-secret-another-secret-another-9876";
const USER = "65f0000000000000000000a1";
const EVIL_USER = "65f0000000000000000000ff";

process.env.SOCKET_JWT_SECRET = SECRET;
const socketAuth = require("../middleware/socketAuth");

function sign(overrides = {}, secret = SECRET, options = {}) {
  return jwt.sign(
    { name: "Ada", role: "worker", ...overrides },
    secret,
    {
      algorithm: "HS256",
      subject: USER,
      issuer: "taskhub-web",
      audience: "taskhub-realtime",
      expiresIn: 600,
      ...options,
    },
  );
}

function run(auth) {
  const socket = { handshake: { auth } };
  let error;
  let called = 0;
  socketAuth(socket, (err) => {
    called += 1;
    error = err;
  });
  assert.equal(called, 1);
  return { socket, error };
}

function assertRejected({ socket, error }) {
  assert.ok(error instanceof Error);
  assert.equal(error.message, "Unauthorized");
  assert.equal(socket.userId, undefined);
}

test("rejects a connection with no token, even with a userId", () => {
  assertRejected(run({}));
  assertRejected(run({ userId: EVIL_USER, userName: "Eve" }));
  assertRejected(run(undefined));
});

test("rejects a token signed with another secret", () => {
  assertRejected(run({ token: sign({}, OTHER_SECRET) }));
});

test("rejects the wrong audience or issuer", () => {
  assertRejected(run({ token: sign({}, SECRET, { audience: "someone-else" }) }));
  assertRejected(run({ token: sign({}, SECRET, { issuer: "someone-else" }) }));
});

test("rejects an expired token", () => {
  assertRejected(run({ token: sign({}, SECRET, { expiresIn: -10 }) }));
});

test("rejects an unsigned (alg none) token", () => {
  const none = jwt.sign({ sub: USER }, "", {
    algorithm: "none",
    issuer: "taskhub-web",
    audience: "taskhub-realtime",
  });
  assertRejected(run({ token: none }));
});

test("rejects a token whose subject is not an ObjectId", () => {
  assertRejected(run({ token: sign({}, SECRET, { subject: "admin" }) }));
});

test("accepts a valid token and ignores handshake userId/userName", () => {
  const { socket, error } = run({
    token: sign(),
    userId: EVIL_USER,
    userName: "Eve",
  });
  assert.equal(error, undefined);
  assert.equal(socket.userId, USER);
  assert.equal(socket.userName, "Ada");
  assert.equal(socket.userRole, "worker");
});

test("fails closed when the secret is missing or too short", () => {
  const token = sign();
  const saved = process.env.SOCKET_JWT_SECRET;
  try {
    delete process.env.SOCKET_JWT_SECRET;
    assertRejected(run({ token }));
    process.env.SOCKET_JWT_SECRET = "too-short";
    assertRejected(run({ token }));
  } finally {
    process.env.SOCKET_JWT_SECRET = saved;
  }
});
