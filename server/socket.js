const mongoose = require("mongoose");
const Sentry = require("@sentry/node");
const logger = require("./config/logger");
const { getSocketJwtSecret } = require("./config/env");
const { persistMessage, markConversationRead } = require("./controllers/messageController");
const {
  parseConversationId,
  isParticipant,
  otherParticipant,
  isLegitimateConversation,
} = require("./lib/conversations");

const MAX_CONTENT_LENGTH = 2000;
const MAX_RECEIVER_NAME_LENGTH = 100;

// Reads `conversationId` from an event payload without throwing on junk input.
function conversationIdOf(payload) {
  return payload && typeof payload === "object" ? payload.conversationId : undefined;
}

module.exports = function registerSocketHandlers(io, { chatLimiter } = {}) {
  if (!getSocketJwtSecret()) {
    logger.error(
      "SOCKET_JWT_SECRET is missing or shorter than 32 characters: every socket connection will be rejected",
    );
  }
  io.use(require("./middleware/socketAuth"));

  io.on("connection", (socket) => {
    logger.info({ userId: socket.userId }, "user connected");

    // Every user has a room of their own, so the web app and the worker can reach
    // them from anywhere (through the Redis emitter) without knowing which
    // instance their socket is on.
    socket.join(`user:${socket.userId}`);

    // Conversations already confirmed in the database for this socket.
    const verified = new Set();

    function deny(event, conversationId, reason) {
      logger.warn(
        {
          userId: socket.userId,
          event,
          conversationId: typeof conversationId === "string" ? conversationId.slice(0, 100) : undefined,
          reason,
        },
        "socket event denied",
      );
    }

    // True when the user is in the conversation ID.
    function allowedParticipant(event, conversationId) {
      if (isParticipant(conversationId, socket.userId)) return true;
      deny(event, conversationId, "not a participant");
      return false;
    }

    // True when the conversation is a real one: the task exists and one
    // participant is its buyer (the same rule the web app follows).
    async function allowedConversation(event, conversationId) {
      if (verified.has(conversationId)) return true;
      try {
        const ok =
          mongoose.connection.readyState === 1 &&
          (await isLegitimateConversation(mongoose.connection.db, conversationId));
        if (!ok) {
          deny(event, conversationId, "not a valid conversation");
          return false;
        }
        verified.add(conversationId);
        return true;
      } catch (err) {
        logger.error({ err, userId: socket.userId, event }, "conversation check failed");
        Sentry.captureException(err);
        return false;
      }
    }

    socket.on("join:conversation", async (conversationId) => {
      if (!allowedParticipant("join:conversation", conversationId)) return;
      if (!(await allowedConversation("join:conversation", conversationId))) return;
      socket.join(conversationId);
      logger.debug({ userId: socket.userId, roomId: conversationId }, "joined room");
    });

    socket.on("leave:conversation", (conversationId) => {
      if (!allowedParticipant("leave:conversation", conversationId)) return;
      socket.leave(conversationId);
    });

    socket.on("message:send", async (data) => {
      const payload = data && typeof data === "object" ? data : {};
      const { conversationId, taskId, receiverId, receiverName } = payload;
      const parsed = parseConversationId(conversationId);

      if (!parsed || typeof taskId !== "string" || typeof receiverId !== "string") {
        deny("message:send", conversationId, "malformed payload");
        return;
      }
      if (!allowedParticipant("message:send", conversationId)) return;
      if (taskId.toLowerCase() !== parsed.taskId.toLowerCase()) {
        deny("message:send", conversationId, "taskId does not match conversation");
        return;
      }
      if (receiverId.toLowerCase() !== otherParticipant(conversationId, socket.userId)) {
        deny("message:send", conversationId, "receiverId is not the other participant");
        return;
      }
      const content = typeof payload.content === "string" ? payload.content.trim() : "";
      if (!content) return;
      // 20 messages per 10 seconds per user, shared by every instance.
      if (chatLimiter) {
        const limit = await chatLimiter.consume(socket.userId);
        if (!limit.ok) {
          deny("message:send", conversationId, "rate limited");
          socket.emit("message:error", {
            error: "You are sending messages too fast. Wait a moment.",
            retryAfterSeconds: limit.retryAfterSeconds,
          });
          return;
        }
      }
      if (content.length > MAX_CONTENT_LENGTH) {
        deny("message:send", conversationId, "content too long");
        socket.emit("message:error", { error: "Message is too long" });
        return;
      }
      if (!(await allowedConversation("message:send", conversationId))) return;

      try {
        const message = await persistMessage({
          conversationId,
          taskId: parsed.taskId,
          senderId: socket.userId,
          receiverId: receiverId.toLowerCase(),
          senderName: socket.userName,
          receiverName:
            typeof receiverName === "string"
              ? receiverName.slice(0, MAX_RECEIVER_NAME_LENGTH)
              : undefined,
          content,
        });

        const out = {
          _id: message._id.toString(),
          conversationId,
          taskId: parsed.taskId,
          senderId: socket.userId,
          receiverId: receiverId.toLowerCase(),
          senderName: socket.userName,
          content: message.content,
          isRead: false,
          createdAt: message.createdAt,
        };

        io.to(conversationId).emit("message:receive", out);
      } catch (err) {
        logger.error({ err, userId: socket.userId, roomId: conversationId }, "error saving message");
        Sentry.captureException(err);
        socket.emit("message:error", { error: "Failed to send message" });
      }
    });

    socket.on("typing:start", (payload) => {
      const conversationId = conversationIdOf(payload);
      if (!allowedParticipant("typing:start", conversationId)) return;
      socket.to(conversationId).emit("typing:start", {
        userId: socket.userId,
        name: socket.userName,
      });
    });

    socket.on("typing:stop", (payload) => {
      const conversationId = conversationIdOf(payload);
      if (!allowedParticipant("typing:stop", conversationId)) return;
      socket.to(conversationId).emit("typing:stop", { userId: socket.userId });
    });

    socket.on("messages:read", async (payload) => {
      const conversationId = conversationIdOf(payload);
      if (!allowedParticipant("messages:read", conversationId)) return;
      try {
        await markConversationRead({
          conversationId,
          userId: socket.userId,
        });
        socket.to(conversationId).emit("messages:read", {
          userId: socket.userId,
        });
      } catch (err) {
        logger.error({ err, userId: socket.userId, roomId: conversationId }, "error marking messages read");
        Sentry.captureException(err);
      }
    });

    socket.on("disconnect", () => {
      logger.info({ userId: socket.userId }, "user disconnected");
    });
  });
};
