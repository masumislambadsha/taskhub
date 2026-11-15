const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const { ALLOWED_ORIGINS, PORT } = require("./config/env");
const { connectDB } = require("./config/db");
const logger = require("./config/logger");
const registerSocketHandlers = require("./socket");
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

// ── Database ─────────────────────────────────────────────────────────────────
connectDB();

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/health", healthRouter);

// ── Socket.io handlers ───────────────────────────────────────────────────────
registerSocketHandlers(io);

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, "Socket.io server listening");
});