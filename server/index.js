// Must stay first: initialises Sentry before other modules load.
require("./instrument");

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const Sentry = require("@sentry/node");

const { ALLOWED_ORIGINS, PORT } = require("./config/env");
const { connectDB } = require("./config/db");
const logger = require("./config/logger");
const registerSocketHandlers = require("./socket");
const { attachRedisAdapter, createShutdown } = require("./lib/scale");
const { createChatLimiter } = require("./lib/rate-limit");
const Redis = require("ioredis");
const mongoose = require("mongoose");
const { createPresence, createMemoryKv } = require("./lib/presence");
const { createMetrics } = require("./lib/metrics");
const { metricsRoute } = require("./lib/metrics-route");
const { conversationPartners } = require("./controllers/messageController");
const healthRouter = require("./routes/health");

const app = express();
app.use(express.json());
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ── Redis: lets several realtime instances behave as one ─────────────────────
const adapter = attachRedisAdapter(io, process.env.REDIS_URL);
const chatLimiter = createChatLimiter({ redisUrl: process.env.REDIS_URL });

// ── Database ─────────────────────────────────────────────────────────────────
connectDB();

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/health", healthRouter);
const metrics = createMetrics();
// Prometheus scrapes this on the internal network; Nginx does not forward it.
app.get("/metrics", metricsRoute(metrics.registry));

// Reports unhandled Express errors. Does nothing when Sentry is disabled.
Sentry.setupExpressErrorHandler(app);

// ── Socket.io handlers ───────────────────────────────────────────────────────
// Presence: online status and last seen, in Redis (or in memory for a single instance).
const presenceRedis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, commandTimeout: 1000 })
  : null;
presenceRedis?.on("error", () => {});
const usersCollection = () => mongoose.connection.db?.collection("users");
const asObjectId = (id) => new mongoose.Types.ObjectId(id);
const presence = createPresence({
  redis: presenceRedis ?? createMemoryKv(),
  getPartners: (id) => conversationPartners(id),
  isLastSeenHidden: async (id) => {
    const user = await usersCollection()?.findOne({ _id: asObjectId(id) }, { projection: { hideLastSeen: 1 } });
    return Boolean(user?.hideLastSeen);
  },
  saveLastSeen: (id, at) => usersCollection()?.updateOne({ _id: asObjectId(id) }, { $set: { lastSeenAt: at } }),
  hasOtherSockets: async (id) => (await io.in(`user:${id}`).fetchSockets()).length > 0,
  announce: (partnerId, event) => io.to(`user:${partnerId}`).emit("presence:update", event),
});

registerSocketHandlers(io, { chatLimiter, presence, metrics });

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, "Socket.io server listening");
});

// On SIGTERM stop taking connections and close the sockets, so clients move to
// the other instance (Nginx routes them) instead of waiting for a timeout.
const shutdown = createShutdown({
  io,
  httpServer,
  closers: [() => presence.stop(), () => chatLimiter.close(), () => adapter?.close(), () => presenceRedis?.disconnect()],
});
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));