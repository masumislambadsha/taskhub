const mongoose = require("mongoose");
const Sentry = require("@sentry/node");
const logger = require("./config/logger");
const { getSocketJwtSecret } = require("./config/env");
const {
  persistMessage,
  markDelivered,
  markBacklogDelivered,
  markRead,
  unreadCount,
  conversationPartners,
} = require("./controllers/messageController");
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

module.exports = function registerSocketHandlers(io, { chatLimiter, presence, metrics } = {}) {
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
    metrics?.sockets.inc();
    metrics?.connections.inc();

    // Online status, and anything sent while this user was away is now delivered.
    presence?.connected(socket.userId, socket.id).catch((err) => logger.warn({ err: err.message }, "presence connect failed"));
    deliverBacklog();

    // Tells senders their messages reached this user (grey double ticks).
    function tellSenders(groups) {
      for (const g of groups) {
        io.to(`user:${g.senderId}`).emit("message:delivered", {
          conversationId: g.conversationId,
          messageIds: g.messageIds,
          deliveredAt: g.deliveredAt,
        });
      }
    }

    async function deliverBacklog(conversationId) {
      if (mongoose.connection.readyState !== 1) return;
      try {
        tellSenders(await markBacklogDelivered({ userId: socket.userId, conversationId }));
      } catch (err) {
        logger.error({ err, userId: socket.userId }, "delivering backlog failed");
        Sentry.captureException(err);
      }
    }

    // People who share a conversation with this user, refreshed at most once a minute.
    let partners = null;
    let partnersAt = 0;
    async function partnerSet() {
      if (!partners || Date.now() - partnersAt > 60_000) {
        partners = new Set(await conversationPartners(socket.userId));
        partnersAt = Date.now();
      }
      return partners;
    }

    // Conversations already confirmed in the database for this socket.
    const verified = new Set();

    function deny(event, conversationId, reason) {
      metrics?.denied.inc({ reason: String(reason).slice(0, 40) });
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
      await deliverBacklog(conversationId);
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
        // The recipient's device answers with message:delivered once it has it.

        io.to(conversationId).emit("message:receive", out);
        metrics?.messages.inc();
      } catch (err) {
        metrics?.handlerErrors.inc();
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

    // The recipient's device acknowledges a message (their user comes from the
    // token, never from the payload). The sender then sees two grey ticks.
    socket.on("message:delivered", async (payload) => {
      const messageId = payload && typeof payload === "object" ? payload.messageId : undefined;
      try {
        const message = await markDelivered({ messageId, userId: socket.userId });
        if (!message) return;
        tellSenders([
          {
            senderId: String(message.senderId),
            conversationId: message.conversationId,
            messageIds: [String(message._id)],
            deliveredAt: message.deliveredAt,
          },
        ]);
      } catch (err) {
        logger.error({ err, userId: socket.userId }, "error marking message delivered");
        Sentry.captureException(err);
      }
    });

    // The conversation is open and the tab is visible: read up to this message.
    // One update marks everything up to it, and the sender sees two blue ticks.
    async function handleRead(event, payload, ack) {
      const conversationId = conversationIdOf(payload);
      if (!allowedParticipant(event, conversationId)) return ack?.({ ok: false });
      try {
        const upToMessageId = payload && typeof payload === "object" ? payload.upToMessageId : undefined;
        const res = await markRead({ conversationId, userId: socket.userId, upToMessageId });
        if (res.modified > 0) {
          const out = { conversationId, userId: socket.userId, upToMessageId: res.upToMessageId, readAt: res.readAt };
          io.to(`user:${otherParticipant(conversationId, socket.userId)}`).emit("conversation:read", out);
          // Older clients listen for this in the conversation room.
          socket.to(conversationId).emit("messages:read", { userId: socket.userId });
        }
        ack?.({ ok: true, modified: res.modified, unread: await unreadCount({ conversationId, userId: socket.userId }) });
      } catch (err) {
        logger.error({ err, userId: socket.userId, roomId: conversationId }, "error marking messages read");
        Sentry.captureException(err);
        ack?.({ ok: false });
      }
    }
    socket.on("conversation:read", (payload, ack) => handleRead("conversation:read", payload, ack));
    socket.on("messages:read", (payload, ack) => handleRead("messages:read", payload, ack));

    socket.on("conversation:unread", async (payload, ack) => {
      const conversationId = conversationIdOf(payload);
      if (!allowedParticipant("conversation:unread", conversationId)) return ack?.({ ok: false });
      try {
        ack?.({ ok: true, unread: await unreadCount({ conversationId, userId: socket.userId }) });
      } catch (err) {
        logger.error({ err, userId: socket.userId }, "error counting unread");
        ack?.({ ok: false });
      }
    });

    // Online status of people this user shares a conversation with. Anyone else is not shown.
    socket.on("presence:get", async (payload, ack) => {
      if (!presence || typeof ack !== "function") return;
      const ids = payload && Array.isArray(payload.userIds) ? payload.userIds.slice(0, 100) : [];
      try {
        const allowed = await partnerSet();
        const visible = ids.filter((id) => typeof id === "string" && allowed.has(id.toLowerCase())).map((id) => id.toLowerCase());
        ack({ ok: true, states: await presence.stateOf(visible) });
      } catch (err) {
        logger.error({ err, userId: socket.userId }, "presence lookup failed");
        ack({ ok: false });
      }
    });

    socket.on("disconnect", () => {
      logger.info({ userId: socket.userId }, "user disconnected");
      presence?.disconnected(socket.userId, socket.id);
      metrics?.sockets.dec();
    });
  });
};
