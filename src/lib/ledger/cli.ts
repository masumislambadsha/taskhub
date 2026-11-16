import mongoose from "mongoose";

/**
 * Connects a script (scripts/ledger-*.ts) to the database in MONGODB_URI,
 * loading .env.local and .env first, and returns a description of the target
 * with credentials removed. Scripts print it before doing anything so the
 * operator can see which database they are about to touch.
 */
export async function connectForScript(): Promise<string> {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // file missing: fine
    }
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (put it in .env).");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  const host = /^mongodb(?:\+srv)?:\/\/(?:[^/?]*@)?([^/?]+)/i.exec(uri)?.[1] ?? "unknown host";
  return `${host}/${mongoose.connection.name}`;
}
