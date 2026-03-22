import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache;
}

const cached: MongooseCache = global.mongoose || { conn: null, promise: null };
global.mongoose = cached;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function connectWithRetry(
  retries = MAX_RETRIES,
): Promise<typeof mongoose> {
  try {
    return await mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
    });
  } catch (err) {
    if (retries > 0) {
      console.warn(
        `MongoDB connection failed. Retrying... (${retries} attempts left)`,
      );
      await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
      return connectWithRetry(retries - 1);
    }
    throw err;
  }
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = connectWithRetry().catch((err) => {
      // Clear the cached promise on failure so next call retries fresh
      cached.promise = null;
      throw err;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
