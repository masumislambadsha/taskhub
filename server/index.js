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

// Reports unhandled Express errors. Does nothing when Sentry is disabled.
Sentry.setupExpressErrorHandler(app);

// ── Socket.io handlers ───────────────────────────────────────────────────────
registerSocketHandlers(io, { chatLimiter });

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, "Socket.io server listening");
});

// On SIGTERM stop taking connections and close the sockets, so clients move to
// the other instance (Nginx routes them) instead of waiting for a timeout.
const shutdown = createShutdown({
  io,
  httpServer,
  closers: [() => chatLimiter.close(), () => adapter?.close()],
});
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));