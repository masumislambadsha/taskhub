const { persistMessage, markConversationRead } = require("./controllers/messageController");

module.exports = function registerSocketHandlers(io) {
  io.use(require("./middleware/socketAuth"));

  io.on("connection", (socket) => {
    console.log(`🔌 User connected: ${socket.userId}`);

    socket.on("join:conversation", (conversationId) => {
      socket.join(conversationId);
      console.log(`👥 ${socket.userId} joined room: ${conversationId}`);
    });

    socket.on("leave:conversation", (conversationId) => {
      socket.leave(conversationId);
    });

    socket.on("message:send", async (data) => {
      const { conversationId, taskId, receiverId, receiverName, content } = data;

      if (!conversationId || !taskId || !receiverId || !content?.trim()) return;

      try {
        const message = await persistMessage({
          conversationId,
          taskId,
          senderId: socket.userId,
          receiverId,
          senderName: socket.userName,
          receiverName,
          content,
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

        io.to(conversationId).emit("message:receive", payload);
      } catch (err) {
        console.error("Error saving message:", err);
        socket.emit("message:error", { error: "Failed to send message" });
      }
    });

    socket.on("typing:start", ({ conversationId }) => {
      socket.to(conversationId).emit("typing:start", {
        userId: socket.userId,
        name: socket.userName,
      });
    });

    socket.on("typing:stop", ({ conversationId }) => {
      socket.to(conversationId).emit("typing:stop", { userId: socket.userId });
    });

    socket.on("messages:read", async ({ conversationId }) => {
      try {
        await markConversationRead({
          conversationId,
          userId: socket.userId,
        });
        socket.to(conversationId).emit("messages:read", {
          userId: socket.userId,
        });
      } catch (err) {
        console.error("Error marking messages read:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log(`🔌 User disconnected: ${socket.userId}`);
    });
  });
};