/* eslint-disable @typescript-eslint/no-explicit-any -- explain output and Mongoose query objects are untyped */
/**
 * Query performance evidence: `npm run perf:explain`.
 *
 * Starts a throwaway in-memory MongoDB, seeds a large data set, and for each
 * hot query records documents examined and wall-clock time WITHOUT the
 * indexes (all secondary indexes dropped) and WITH the indexes declared in the
 * models. Prints a Markdown table for docs/performance.md.
 *
 * Size: PERF_TASKS (default 100000), PERF_USERS (20000), PERF_SUBMISSIONS
 * (300000), PERF_LEDGER (200000). Numbers depend on the machine; record it.
 */
import os from "node:os";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Task from "@/models/Task";
import User from "@/models/User";
import Submission from "@/models/Submission";
import LedgerTransaction from "@/models/LedgerTransaction";

const N = (name: string, d: number) => Number(process.env[name] || d);
const TASKS = N("PERF_TASKS", 100_000);
const USERS = N("PERF_USERS", 20_000);
const SUBS = N("PERF_SUBMISSIONS", 300_000);
const LEDGER = N("PERF_LEDGER", 200_000);
const CATEGORIES = ["Writing", "Design", "Data Entry", "Testing", "Research", "Translation"];
const WORDS = ["write", "review", "translate", "survey", "photo", "data", "test", "video"];
// Seeded generator: repeatable runs, and no accidental correlation between fields.
let seed = 123456789;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(a: T[], _i?: number) => a[Math.floor(rnd() * a.length)];

async function insertInChunks(coll: mongoose.Collection, docs: () => Generator<object>, chunk = 5000) {
  let batch: object[] = [];
  for (const d of docs()) {
    batch.push(d);
    if (batch.length === chunk) {
      await coll.insertMany(batch as never, { ordered: false });
      batch = [];
    }
  }
  if (batch.length) await coll.insertMany(batch as never, { ordered: false });
}

type Probe = { name: string; run: () => Promise<unknown>; explain: () => Promise<{ docs: number; keys: number; stage: string }> };

function planInfo(exp: Record<string, any>) {
  const s = exp.executionStats;
  let stage = "";
  const walk = (p: any): void => {
    if (!p) return;
    stage += (stage ? " > " : "") + p.stage + (p.indexName ? `(${p.indexName})` : "");
    walk(p.inputStage ?? p.inputStages?.[0]);
  };
  walk(exp.queryPlanner.winningPlan.queryPlan ?? exp.queryPlanner.winningPlan);
  return { docs: s.totalDocsExamined as number, keys: s.totalKeysExamined as number, stage };
}

async function main() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "perf" });
  const db = mongoose.connection.db!;
  const now = Date.now();
  const userIds = Array.from({ length: USERS }, () => new Types.ObjectId());
  const buyerIds = userIds.filter((_, i) => i % 20 === 0);
  const workerIds = userIds.filter((_, i) => i % 20 !== 0);
  console.error(`seeding ${TASKS} tasks, ${USERS} users, ${SUBS} submissions, ${LEDGER} ledger transactions...`);

  await insertInChunks(mongoose.connection.collection("users"), function* () {
    for (let i = 0; i < USERS; i++)
      yield { _id: userIds[i], name: `U${i}`, email: `u${i}@x.local`, role: i % 20 === 0 ? "buyer" : "worker", status: i % 50 === 0 ? "suspended" : "active", coins: (i * 7919) % 100000, createdAt: new Date(now - i * 1000) };
  });
  await insertInChunks(mongoose.connection.collection("tasks"), function* () {
    for (let i = 0; i < TASKS; i++)
      yield { title: `${pick(WORDS, i)} job ${i}`, details: "d", category: pick(CATEGORIES, i * 3), status: i % 10 === 0 ? "closed" : "open", requiredWorkers: 10, filledWorkers: 0, payableAmount: 5 + (i % 200), completionDate: new Date(now + 1e9), submissionInfo: "s", buyerId: pick(buyerIds, i), buyerName: "B", buyerEmail: "b@x.local", createdAt: new Date(now - i * 60_000), updatedAt: new Date(now - i * 60_000) };
  });
  const taskIds = (await db.collection("tasks").find({}, { projection: { _id: 1 } }).limit(5000).toArray()).map((t) => t._id);
  await insertInChunks(mongoose.connection.collection("submissions"), function* () {
    for (let i = 0; i < SUBS; i++)
      yield { taskId: pick(taskIds, i), taskBuyerId: pick(buyerIds, i * 7), workerId: pick(workerIds, i * 13), status: pick(["pending", "approved", "approved", "rejected"], i), createdAt: new Date(now - i * 30_000) };
  });
  const walletUser = `user:${workerIds[0]}`;
  await insertInChunks(mongoose.connection.collection("ledger_transactions"), function* () {
    for (let i = 0; i < LEDGER; i++) {
      const w = pick(workerIds, i * 11);
      yield { idempotencyKey: `perf-${i}`, type: "task_payout", entries: [{ accountId: `user:${w}`, amount: 10 }, { accountId: `escrow:${pick(taskIds, i)}`, amount: -10 }], meta: { taskId: pick(taskIds, i) }, createdAt: new Date(now - i * 5000) };
    }
  });
  // Make sure the wallet user has history.
  await db.collection("ledger_transactions").insertMany(
    Array.from({ length: 300 }, (_, i) => ({ idempotencyKey: `perf-w-${i}`, type: "task_payout", entries: [{ accountId: walletUser, amount: 1 }, { accountId: "system:fees", amount: -1 }], meta: {}, createdAt: new Date(now - i * 777_000) })),
  );

  const buyer = buyerIds[3];
  const worker = workerIds[5];
  const topWorkers = workerIds.slice(0, 100);
  const probes: Probe[] = [
    { name: "Task list, page 1 (open, newest first)", ...q(Task.find({ status: "open" }).sort("-createdAt").skip(0).limit(12)) },
    { name: "Task list, page 5,000 (deep skip)", ...q(Task.find({ status: "open" }).sort("-createdAt").skip(59988).limit(12)) },
    { name: "Task count for the list (open)", ...q(Task.countDocuments({ status: "open" }), true) },
    { name: "Task list, category filter", ...q(Task.find({ status: "open", category: "Design" }).sort("-createdAt").limit(12)) },
    { name: "Task list, search by title (regex)", ...q(Task.find({ status: "open", title: { $regex: "survey", $options: "i" } }).sort("-createdAt").limit(12)) },
    { name: "Buyer's own tasks", ...q(Task.find({ buyerId: buyer }).sort("-createdAt").limit(12)) },
    { name: "Leaderboard: top 100 workers by coins", ...q(User.find({ role: "worker", status: "active" }).select("name coins").sort({ coins: -1 }).limit(100)) },
    { name: "Leaderboard: submission stats for those 100", ...agg(Submission.aggregate([{ $match: { workerId: { $in: topWorkers } } }, { $group: { _id: "$workerId", total: { $sum: 1 } } }])) },
    { name: "Worker's submissions (pending)", ...q(Submission.find({ workerId: worker, status: "pending" }).sort("-createdAt").limit(20)) },
    { name: "Buyer's submission queue (pending)", ...q(Submission.find({ taskBuyerId: buyer, status: "pending" }).sort("-createdAt").limit(20)) },
    { name: "Wallet history (ledger)", ...q(LedgerTransaction.find({ "entries.accountId": walletUser }).sort({ createdAt: -1, _id: -1 }).limit(20)) },
  ];

  const measure = async (): Promise<Array<{ ms: number; docs: number; keys: number; stage: string }>> => {
    const out = [];
    for (const p of probes) {
      await p.run(); // warm up
      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t = process.hrtime.bigint();
        await p.run();
        times.push(Number(process.hrtime.bigint() - t) / 1e6);
      }
      times.sort((a, b) => a - b);
      out.push({ ms: times[2], ...(await p.explain()) });
    }
    return out;
  };

  for (const m of [Task, User, Submission, LedgerTransaction]) {
    // Drop everything except _id, then add back only what a model declares: first none, then all.
    await m.collection.dropIndexes().catch(() => {});
  }
  // The ledger's own indexes are part of its design (unique key, wallet history); keep them in both runs.
  await LedgerTransaction.syncIndexes();
  console.error("measuring without indexes...");
  const before = await measure();
  for (const m of [Task, User, Submission, LedgerTransaction]) await m.syncIndexes();
  console.error("measuring with indexes...");
  const after = await measure();

  const rows = probes.map((p, i) => {
    const b = before[i], a = after[i];
    return `| ${p.name} | ${b.ms.toFixed(1)} ms | ${b.docs.toLocaleString("en")} | ${a.ms.toFixed(1)} ms | ${a.docs.toLocaleString("en")} | ${a.stage} |`;
  });
  console.log(`Hardware: ${os.cpus().length} x ${os.cpus()[0].model}, ${(os.totalmem() / 2 ** 30).toFixed(1)} GB RAM, Node ${process.version}, MongoDB in-memory (mongodb-memory-server).`);
  console.log(`Data: ${TASKS.toLocaleString("en")} tasks, ${USERS.toLocaleString("en")} users, ${SUBS.toLocaleString("en")} submissions, ${LEDGER.toLocaleString("en")} ledger transactions.\n`);
  console.log("| Query | Before: time | Before: docs examined | After: time | After: docs examined | After: plan |");
  console.log("|---|---|---|---|---|---|");
  console.log(rows.join("\n"));
  await mongoose.disconnect();
  await mongod.stop();
}

function q(query: any, isCount = false) {
  return {
    run: async () => (isCount ? query.clone().exec() : query.clone().lean().exec()),
    explain: async () => planInfo(await (isCount ? mongoose.connection.collection(query.mongooseCollection.name).find(query.getFilter()).explain("executionStats") : query.clone().explain("executionStats"))),
  };
}
function agg(a: any) {
  return {
    run: async () => a.model().aggregate(a.pipeline()).exec(),
    explain: async () => {
      const exp = await a.model().aggregate(a.pipeline()).explain("executionStats");
      const cursor = exp.stages?.[0]?.$cursor ?? exp;
      return planInfo(cursor);
    },
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
