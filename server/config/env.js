require("dotenv").config();

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://task-hub-io.vercel.app",
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean);

const PORT = process.env.PORT || process.env.SOCKET_PORT || 3001;

const MONGO_URI = process.env.MONGODB_URI;

module.exports = { ALLOWED_ORIGINS, PORT, MONGO_URI };