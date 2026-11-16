import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import LedgerAccount from "@/models/LedgerAccount";
import LedgerTransaction from "@/models/LedgerTransaction";
import Payment from "@/models/Payment";
import Submission from "@/models/Submission";
import Task from "@/models/Task";
import User from "@/models/User";
import Withdrawal from "@/models/Withdrawal";

/**
 * Starts the MongoDB used by the payment integration tests. Transactions need
 * a replica set, so this is a one-node `MongoMemoryReplSet` (the binary is
 * downloaded on first use; CI can do that too).
 *
 * If the binary cannot be downloaded, point `MONGODB_TEST_URI` at any replica
 * set instead, for example:
 *   docker run -d --name tmongo -p 27099:27017 mongo:7 --replSet rs0 --bind_ip_all
 *   docker exec tmongo mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'
 *   MONGODB_TEST_URI='mongodb://localhost:27099/?directConnection=true' npm test
 * Each test file uses its own database name, so files can run in parallel.
 */
export async function startTestDb(dbName: string) {
  let replSet: MongoMemoryReplSet | undefined;
  let uri = process.env.MONGODB_TEST_URI;
  if (!uri) {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    uri = replSet.getUri();
  }
  await mongoose.connect(uri, { dbName });
  await Promise.all([
    Payment.init(),
    User.init(),
    LedgerAccount.init(),
    LedgerTransaction.init(),
    Task.init(),
    Submission.init(),
    Withdrawal.init(),
  ]);
  return {
    async stop() {
      if (process.env.MONGODB_TEST_URI) await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      await replSet?.stop();
    },
    async reset() {
      await Promise.all([
        Payment.deleteMany({}),
        User.deleteMany({}),
        LedgerAccount.deleteMany({}),
        Task.deleteMany({}),
        Submission.deleteMany({}),
        Withdrawal.deleteMany({}),
        // The journal model is append-only, so clear it through the driver.
        LedgerTransaction.collection.deleteMany({}),
      ]);
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

/**
 * A task exactly as the app stored it before the ledger existed: coins were
 * taken from the buyer when it was created and no ledger account was made.
 */
export async function createPreLedgerTask(
  buyerId: mongoose.Types.ObjectId | string,
  opts: {
    requiredWorkers?: number;
    filledWorkers?: number;
    payableAmount?: number;
    status?: "open" | "closed" | "blocked" | "archived";
    escrowReleasedAt?: Date;
  } = {},
) {
  counter += 1;
  return Task.create({
    title: `Pre-ledger task ${counter}`,
    details: "A task created before the coin ledger existed.",
    buyerId,
    buyerName: "Buyer",
    buyerEmail: "buyer@example.test",
    requiredWorkers: opts.requiredWorkers ?? 5,
    filledWorkers: opts.filledWorkers ?? 0,
    payableAmount: opts.payableAmount ?? 10,
    completionDate: new Date(Date.now() + 86_400_000),
    submissionInfo: "Send a screenshot.",
    status: opts.status ?? "open",
    escrowReleasedAt: opts.escrowReleasedAt,
  });
}

/**
 * A worker submission as `POST /api/v1/submissions` stores it: a pending
 * submission, one more filled slot, and the task closed once it is full.
 */
export async function createPendingSubmission(
  task: { _id: mongoose.Types.ObjectId; buyerId: mongoose.Types.ObjectId },
  workerId: mongoose.Types.ObjectId | string,
) {
  const t = await Task.findById(task._id);
  if (!t) throw new Error("task not found");
  const submission = await Submission.create({
    taskId: t._id,
    taskTitle: t.title,
    taskBuyerId: t.buyerId,
    taskBuyerName: t.buyerName,
    workerId,
    workerName: "Worker",
    workerEmail: "worker@example.test",
    payableAmount: t.payableAmount,
    details: "Done.",
  });
  t.filledWorkers += 1;
  if (t.filledWorkers >= t.requiredWorkers) t.status = "closed";
  await t.save();
  return submission;
}

export function taskInput(
  overrides: Partial<{
    requiredWorkers: number;
    payableAmount: number;
  }> = {},
) {
  return {
    title: "A task title",
    details: "Details that are long enough to pass validation.",
    requiredWorkers: overrides.requiredWorkers ?? 5,
    payableAmount: overrides.payableAmount ?? 10,
    completionDate: "2030-01-01",
    submissionInfo: "Send a screenshot of it",
  };
}
