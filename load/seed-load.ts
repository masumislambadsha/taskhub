/**
 * Bulk data for load tests: `npm run load:seed` adds 1,000 users and 10,000 open
 * tasks (marked isSeed, @load.taskhub.local). Same safety rules as scripts/seed.ts:
 * not in production, and only a local database unless SEED_ALLOW_REMOTE=1.
 */
import { Types } from "mongoose";
import mongoose from "mongoose";
import Task from "@/models/Task";
import User from "@/models/User";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // missing: fine
  }
}

const uri = process.env.MONGODB_URI;
if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed: NODE_ENV is production.");
if (!uri) throw new Error("MONGODB_URI is not set.");
if (!/^mongodb:\/\/(?:[^/?]*@)?(localhost|127\.0\.0\.1|mongo)[:/?,]/i.test(uri) && process.env.SEED_ALLOW_REMOTE !== "1") {
  throw new Error("Refusing to seed a non-local database. Set SEED_ALLOW_REMOTE=1 to override.");
}

const USERS = Number(process.env.LOAD_USERS || 1000);
const TASKS = Number(process.env.LOAD_TASKS || 10000);
const CATEGORIES = ["Writing", "Design", "Data Entry", "Testing"];
const WORDS = ["write", "review", "translate", "survey", "photo", "data", "test", "video"];

async function main() {
  await mongoose.connect(uri!);
  const buyers: Types.ObjectId[] = [];
  const users = Array.from({ length: USERS }, (_, i) => {
    const _id = new Types.ObjectId();
    if (i % 10 === 0) buyers.push(_id);
    return {
      insertOne: {
        document: {
          _id,
          name: `Load User ${i}`,
          email: `load${i}@load.taskhub.local`,
          role: i % 10 === 0 ? "buyer" : "worker",
          coins: 1000,
          isSeed: true,
        },
      },
    };
  });
  await User.bulkWrite(users as never, { ordered: false }).catch((e) => {
    if (!/E11000/.test(String(e))) throw e;
  });

  const now = Date.now();
  const tasks = Array.from({ length: TASKS }, (_, i) => ({
    insertOne: {
      document: {
        title: `${WORDS[i % WORDS.length]} job ${i}`,
        details: "Load test task",
        category: CATEGORIES[i % CATEGORIES.length],
        status: "open",
        requiredWorkers: 10,
        filledWorkers: 0,
        payableAmount: 5 + (i % 50),
        completionDate: new Date(now + 30 * 24 * 3600 * 1000),
        submissionInfo: "Send a screenshot",
        buyerId: buyers[i % buyers.length],
        buyerName: "Load Buyer",
        buyerEmail: "load@load.taskhub.local",
        isSeed: true,
        createdAt: new Date(now - i * 60_000),
        updatedAt: new Date(now - i * 60_000),
      },
    },
  }));
  for (let i = 0; i < tasks.length; i += 1000) {
    await Task.bulkWrite(tasks.slice(i, i + 1000) as never, { ordered: false, strict: false } as never);
  }
  console.log(`Added up to ${USERS} users and ${TASKS} tasks.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
