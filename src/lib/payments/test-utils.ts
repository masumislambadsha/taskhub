import mongoose from "mongoose";
import { inject } from "vitest";
import Payment from "@/models/Payment";
import User from "@/models/User";

/**
 * Connects to the MongoDB used by the payment integration tests. Transactions
 * need a replica set, so the global setup (`global-setup.ts`) starts one
 * one-node `MongoMemoryReplSet` for the whole run (the binary is downloaded on
 * first use; CI can do that too) and shares its URI with every test file
 * through Vitest's `inject`. A file that only needs the helpers in here still
 * works on its own, because the global setup runs for every Vitest run.
 *
 * If the binary cannot be downloaded, point `MONGODB_TEST_URI` at any replica
 * set instead, for example:
 *   docker run -d --name tmongo -p 27099:27017 mongo:7 --replSet rs0 --bind_ip_all
 *   docker exec tmongo mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'
 *   MONGODB_TEST_URI='mongodb://localhost:27099/?directConnection=true' npm test
 * In that case the global setup starts nothing and the tests use that URI.
 *
 * The server is shared, so each test file must use its own database name, and
 * `stop()` only drops that database and disconnects. The global setup stops the
 * server when the run ends.
 */
export async function startTestDb(dbName: string) {
  await mongoose.connect(inject("mongoUri"), { dbName });
  await Promise.all([Payment.init(), User.init()]);
  return {
    async stop() {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    },
    async reset() {
      await Promise.all([Payment.deleteMany({}), User.deleteMany({})]);
    },
  };
}

let counter = 0;

export async function createUser(coins = 0) {
  counter += 1;
  return User.create({
    name: `Buyer ${counter}`,
    email: `buyer${counter}-${Date.now()}@example.test`,
    role: "buyer",
    coins,
  });
}

/** A pending payment for a coin package: price in USD, as create-session stores it. */
export async function createPayment(
  userId: mongoose.Types.ObjectId | string,
  opts: {
    gateway?: "stripe" | "bkash" | "sslcommerz";
    price?: number;
    coins?: number;
    stripeSessionId?: string;
    gatewayTransactionId?: string;
  } = {},
) {
  const gateway = opts.gateway ?? "sslcommerz";
  return Payment.create({
    userId,
    userEmail: "buyer@example.test",
    gateway,
    coinsPurchased: opts.coins ?? 150,
    amount: opts.price ?? 10,
    currency: gateway === "stripe" ? "usd" : "bdt",
    status: "pending",
    stripeSessionId: opts.stripeSessionId,
    gatewayTransactionId: opts.gatewayTransactionId,
  });
}

export async function coinsOf(userId: mongoose.Types.ObjectId | string): Promise<number> {
  const user = await User.findById(userId);
  return user?.coins ?? 0;
}

/** A JSON `Response`, for mocked provider HTTP calls. */
export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
