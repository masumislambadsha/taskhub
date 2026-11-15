import http from "node:http";
import mongoose from "mongoose";
import Redis from "ioredis";
import { connectDB } from "@/lib/db";

const HEALTH_PORT = Number(process.env.WORKER_HEALTH_PORT) || 4100;
const REDIS_URL = process.env.REDIS_URL;
const RECONNECT_DELAY_MS = 5000;
const SHUTDOWN_TIMEOUT_MS = 10000;

let shuttingDown = false;

const redis = REDIS_URL
  ? new Redis(REDIS_URL, {
      // BullMQ (Phase 1) needs null here; keep retrying while Redis is down.
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    })
  : null;

redis?.on("error", () => {
  // Reported through /health. ioredis keeps reconnecting on its own.
});
redis?.on("ready", () => console.log("[worker] redis connected"));
redis?.on("close", () => {
  if (!shuttingDown) console.warn("[worker] redis connection closed");
});

function mongoOk(): boolean {
  return mongoose.connection.readyState === 1;
}

function redisOk(): boolean {
  return redis !== null && redis.status === "ready";
}

async function connectMongoWithRetry(): Promise<void> {
  while (!shuttingDown) {
    try {
      await connectDB();
      console.log("[worker] mongodb connected");
      return;
    } catch {
      console.warn(
        `[worker] mongodb connection failed, retrying in ${RECONNECT_DELAY_MS / 1000}s`,
      );
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
    }
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    const checks = {
      mongo: { ok: mongoOk() },
      redis: { ok: redisOk(), configured: redis !== null },
    };
    const ok = checks.mongo.ok && checks.redis.ok;
    res.writeHead(ok ? 200 : 503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: ok ? "ok" : "error", checks }));
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] ${signal} received, shutting down`);

  const forceExit = setTimeout(() => {
    console.error("[worker] shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
    if (redis) {
      if (redis.status === "ready") await redis.quit();
      else redis.disconnect();
    }
    // Disconnecting while a connection attempt is in flight would hang.
    if (mongoOk()) await mongoose.disconnect();
    console.log("[worker] shutdown complete");
    process.exit(0);
  } catch (err) {
    console.error("[worker] error during shutdown", err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

server.listen(HEALTH_PORT, () => {
  console.log(
    `[worker] started, health on :${HEALTH_PORT}, version ${process.env.GIT_SHA || "dev"}`,
  );
  if (!REDIS_URL) console.warn("[worker] REDIS_URL is not set");
});

void connectMongoWithRetry();
