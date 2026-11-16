const jwt = require("jsonwebtoken");
const { getSocketJwtSecret } = require("../config/env");
const logger = require("../config/logger");

const ISSUER = "taskhub-web";
const AUDIENCE = "taskhub-realtime";
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/**
 * Socket.io connection middleware.
 * Identity comes only from the signed token in `handshake.auth.token`, issued
 * by the web app at /api/v1/socket-token. userId/userName sent by the client
 * are never read. With no valid SOCKET_JWT_SECRET every connection is rejected.
 */
function socketAuth(socket, next) {
  const secret = getSocketJwtSecret();
  if (!secret) return next(new Error("Unauthorized"));

  const token = socket.handshake && socket.handshake.auth && socket.handshake.auth.token;
  if (typeof token !== "string" || token.length === 0) {
    return next(new Error("Unauthorized"));
  }

  let claims;
  try {
    claims = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  } catch (err) {
    logger.warn({ reason: err && err.name }, "socket token rejected");
    return next(new Error("Unauthorized"));
  }

  if (typeof claims.sub !== "string" || !OBJECT_ID.test(claims.sub)) {
    logger.warn({ reason: "bad subject" }, "socket token rejected");
    return next(new Error("Unauthorized"));
  }

  socket.userId = claims.sub.toLowerCase();
  socket.userName = typeof claims.name === "string" && claims.name ? claims.name : "Unknown";
  socket.userRole = typeof claims.role === "string" ? claims.role : "";
  next();
}

module.exports = socketAuth;
