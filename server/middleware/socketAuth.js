/**
 * Socket.io connection middleware.
 * NextAuth tokens are encrypted JWEs that can't be decoded server-side
 * without the NextAuth secret, so the client passes userId/userName directly.
 */
function socketAuth(socket, next) {
  const { userId, userName } = socket.handshake.auth;
  if (!userId) return next(new Error("Authentication required"));
  socket.userId = userId;
  socket.userName = userName || "Unknown";
  next();
}

module.exports = socketAuth;