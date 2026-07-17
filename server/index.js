import dotenv from "dotenv";
dotenv.config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

const httpServer = http.createServer(app);

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://task-hub-io.vercel.app",
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean);

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ── MongoDB connection ──────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Socket server connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ── Message schema (mirrors Next.js model) ──────────────────────────────────
const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderName: { type: String, required: true },
    receiverName: { type: String, required: false, default: "Unknown" },
    content: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Delete cached model to pick up schema changes on restart
delete mongoose.models.Message;
const Message = mongoose.model("Message", MessageSchema);

// ── Socket.io auth middleware ────────────────────────────────────────────────
io.use((socket, next) => {
  // NextAuth tokens are encrypted JWEs — we can't decode them server-side
  // without the secret. Instead, the client passes userId and userName directly.
  const { userId, userName } = socket.handshake.auth;
  if (!userId) return next(new Error("Authentication required"));
  socket.userId = userId;
  socket.userName = userName || "Unknown";
  next();
});

// ── Socket.io events ─────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.userId}`);

  // Join a conversation room
  socket.on("join:conversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`👥 ${socket.userId} joined room: ${conversationId}`);
  });

  // Leave a conversation room
  socket.on("leave:conversation", (conversationId) => {
    socket.leave(conversationId);
  });

  // Send a message
  socket.on("message:send", async (data) => {
    const { conversationId, taskId, receiverId, receiverName, content } = data;

    if (!conversationId || !taskId || !receiverId || !content?.trim()) return;

    try {
      const message = await Message.create({
        conversationId,
        taskId,
        senderId: new mongoose.Types.ObjectId(socket.userId),
        receiverId: new mongoose.Types.ObjectId(receiverId),
        senderName: socket.userName,
        receiverName: receiverName || "Unknown",
        content: content.trim(),
      });

      const payload = {
        _id: message._id.toString(),
        conversationId,
        taskId,
        senderId: socket.userId,
        receiverId,
        senderName: socket.userName,
        content: message.content,
        isRead: false,
        createdAt: message.createdAt,
      };

      // Emit to everyone in the room (including sender for confirmation)
      io.to(conversationId).emit("message:receive", payload);
    } catch (err) {
      console.error("Error saving message:", err);
      socket.emit("message:error", { error: "Failed to send message" });
    }
  });

  // Typing indicator
  socket.on("typing:start", ({ conversationId }) => {
    socket.to(conversationId).emit("typing:start", {
      userId: socket.userId,
      name: socket.userName,
    });
  });

  socket.on("typing:stop", ({ conversationId }) => {
    socket.to(conversationId).emit("typing:stop", { userId: socket.userId });
  });

  // Mark messages as read
  socket.on("messages:read", async ({ conversationId }) => {
    await Message.updateMany(
      { conversationId, receiverId: socket.userId, isRead: false },
      { isRead: true },
    );
    socket.to(conversationId).emit("messages:read", { userId: socket.userId });
  });

  socket.on("disconnect", () => {
    console.log(`🔌 User disconnected: ${socket.userId}`);
  });
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || process.env.SOCKET_PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Socket.io server running on port ${PORT}`);
});
