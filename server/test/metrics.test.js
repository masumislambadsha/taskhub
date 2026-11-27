const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const { createMetrics } = require("../lib/metrics");
const { metricsRoute } = require("../lib/metrics-route");

async function serve(metrics) {
  const app = express();
  app.get("/metrics", metricsRoute(metrics.registry));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((r) => server.close(r)) };
}

test("/metrics is off without a token, needs it with one, and reports the counters", async () => {
  const metrics = createMetrics();
  metrics.sockets.inc();
  metrics.sockets.inc();
  metrics.sockets.dec();
  metrics.messages.inc();
  metrics.denied.inc({ reason: "not a participant" });
  const s = await serve(metrics);
  try {
    delete process.env.METRICS_TOKEN;
    assert.equal((await fetch(`${s.base}/metrics`)).status, 404);

    process.env.METRICS_TOKEN = "scrape-me";
    assert.equal((await fetch(`${s.base}/metrics`)).status, 401);
    assert.equal((await fetch(`${s.base}/metrics`, { headers: { authorization: "Bearer wrong!!!" } })).status, 401);

    const res = await fetch(`${s.base}/metrics`, { headers: { authorization: "Bearer scrape-me" } });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /taskhub_sockets_active\{service="realtime"\} 1/);
    assert.match(text, /taskhub_chat_messages_total\{service="realtime"\} 1/);
    assert.match(text, /taskhub_socket_denied_total\{reason="not a participant",service="realtime"\} 1/);
    assert.match(text, /process_cpu_user_seconds_total/);
  } finally {
    delete process.env.METRICS_TOKEN;
    await s.close();
  }
});
