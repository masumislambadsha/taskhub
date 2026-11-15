const mongoose = require("mongoose");
const { MONGO_URI } = require("./env");

// Backoff between failed attempts: 5s, 10s, 20s, then every 30s.
const RETRY_DELAYS_MS = [5000, 10000, 20000];
const MAX_RETRY_DELAY_MS = 30000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Error messages can echo the connection string; never log it.
function safeMessage(err) {
  return String((err && err.message) || err).replace(
    /mongodb(\+srv)?:\/\/\S+/gi,
    "[redacted-uri]",
  );
}

// Keeps trying until MongoDB is connected. The HTTP server is already up, so
// /health returns 503 until this resolves. Once connected, mongoose reconnects
// by itself if the connection drops later.
async function connectDB() {
  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
      console.log("✅ Socket server connected to MongoDB");
      return;
    } catch (err) {
      const delay =
        RETRY_DELAYS_MS[attempt - 1] !== undefined
          ? RETRY_DELAYS_MS[attempt - 1]
          : MAX_RETRY_DELAY_MS;
      console.error(
        `MongoDB connection failed (attempt ${attempt}): ${err && err.name}: ${safeMessage(err)}. Retrying in ${delay / 1000}s`,
      );
      await sleep(delay);
    }
  }
}

module.exports = { connectDB };
