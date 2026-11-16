const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { getVersion } = require("../lib/version");
const healthRouter = require("../routes/health");

const FULL = "0123456789abcdef0123456789abcdef01234567";

test("getVersion returns dev when nothing is set", () => {
  assert.equal(getVersion({}), "dev");
});

test("getVersion prefers GIT_SHA and shortens to 7 characters", () => {
  assert.equal(getVersion({ GIT_SHA: FULL, RENDER_GIT_COMMIT: "bbbbbbbbbb" }), "0123456");
});

test("getVersion falls back to RENDER_GIT_COMMIT", () => {
  assert.equal(getVersion({ RENDER_GIT_COMMIT: FULL }), "0123456");
});

test("getVersion ignores empty values", () => {
  assert.equal(getVersion({ GIT_SHA: "", RENDER_GIT_COMMIT: "" }), "dev");
});

test("/health includes the version field", async () => {
  const prev = process.env.GIT_SHA;
  process.env.GIT_SHA = FULL;
  const app = express();
  app.use("/health", healthRouter);
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await res.json();
    assert.equal(body.version, "0123456");
    assert.equal(body.service, "taskhub-realtime");
    // mongoose is not connected in tests
    assert.equal(res.status, 503);
  } finally {
    server.close();
    if (prev === undefined) delete process.env.GIT_SHA;
    else process.env.GIT_SHA = prev;
  }
});
