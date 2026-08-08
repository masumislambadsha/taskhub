const mongoose = require("mongoose");
const { MONGO_URI } = require("./env");

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Socket server connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exitCode = 1;
  }
}

module.exports = { connectDB };