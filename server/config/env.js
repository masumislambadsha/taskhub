require("dotenv").config();

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://task-hub-io.vercel.app",
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean);

const PORT = process.env.PORT || process.env.SOCKET_PORT || 3001;

const MONGO_URI = process.env.MONGODB_URI;

// Shared with the web app, which signs the socket tokens (/api/v1/socket-token).
const SOCKET_JWT_SECRET_MIN_LENGTH = 32;

// Returns the secret, or null when it is missing or too short (fail closed:
// every connection is then rejected). Read at call time so tests can set it.
function getSocketJwtSecret() {
  const secret = process.env.SOCKET_JWT_SECRET;
  if (typeof secret !== "string" || secret.length < SOCKET_JWT_SECRET_MIN_LENGTH) {
    return null;
  }
  return secret;
}

module.exports = {
  ALLOWED_ORIGINS,
  PORT,
  MONGO_URI,
  SOCKET_JWT_SECRET_MIN_LENGTH,
  getSocketJwtSecret,
};
