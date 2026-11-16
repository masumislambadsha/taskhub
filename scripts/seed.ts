/**
 * Development seed script: `npm run seed`.
 *
 * Creates 1 admin, 3 buyers, 10 workers, the default categories, 20 tasks and
 * some submissions. Everything is upserted by a fixed key, so re-running does
 * not duplicate anything. Coin balances are only set when a user is first
 * created (the ledger owns them afterwards, so re-running never overwrites them;
 * a fresh seed is "pre-ledger" data that the ledger opens on first use).
 * Seeded documents carry `isSeed: true` and use @seed.taskhub.local emails. The script never deletes anything.
 *
 * Safety: refuses to run when NODE_ENV=production, and refuses a MongoDB host
 * other than localhost, 127.0.0.1 or mongo unless SEED_ALLOW_REMOTE=1.
 */
import bcrypt from "bcryptjs";
import mongoose, { Types } from "mongoose";
import Category from "@/models/Category";
import Submission from "@/models/Submission";
import Task from "@/models/Task";
import User from "@/models/User";
import {
  BUYER_INITIAL_COINS,
  TASK_CATEGORIES,
  WORKER_INITIAL_COINS,
} from "@/lib/constants";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // file missing: fine
  }
}

const SEED_EMAIL_DOMAIN = "seed.taskhub.local";
const DEFAULT_PASSWORD = "TaskHub-dev-1234";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "mongo"]);
const DAY_MS = 24 * 60 * 60 * 1000;

// ── Safety checks ───────────────────────────────────────────────────────────

function mongoHosts(uri: string): string[] {
  const match = /^mongodb(\+srv)?:\/\/(?:[^/?]*@)?([^/?]+)/i.exec(uri);
  if (!match) return [];
  if (match[1]) return [`${match[2]} (srv)`];
  return match[2].split(",").map((h) => h.replace(/:\d+$/, "").toLowerCase());
}

function assertSafeToRun(uri: string | undefined): string {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: NODE_ENV is production.");
  }
  if (!uri) {
    throw new Error("MONGODB_URI is not set (put it in .env).");
  }
  const hosts = mongoHosts(uri);
  const local = hosts.length > 0 && hosts.every((h) => LOCAL_HOSTS.has(h));
  if (!local && process.env.SEED_ALLOW_REMOTE !== "1") {
    throw new Error(
      `Refusing to seed a non-local database (host: ${hosts.join(", ") || "unknown"}). ` +
        "Use localhost, 127.0.0.1 or mongo, or set SEED_ALLOW_REMOTE=1.",
    );
  }
  return uri;
}

// ── Seed data ───────────────────────────────────────────────────────────────

// Fixed ObjectIds ("5eed" prefix) so upserts always hit the same documents.
function seedId(kind: number, n: number): Types.ObjectId {
  const hex = `5eed${kind.toString(16).padStart(2, "0")}${n
    .toString(16)
    .padStart(18, "0")}`;
  return new Types.ObjectId(hex);
}

const email = (local: string) => `${local}@${SEED_EMAIL_DOMAIN}`;

const BUYER_START_COINS = 2000;
const WORKER_BONUS_COINS = 250; // first four workers can test withdrawals

const CATEGORY_ICONS: Record<string, string> = {
  "Social Media": "share",
  "Video & Audio": "videocam",
  "Writing & Reviews": "edit_note",
  "App Testing": "bug_report",
  Research: "search",
  "Data Entry": "table_rows",
  Other: "category",
};

const TASK_TEMPLATES: { title: string; category: string; details: string }[] = [
  { title: "Subscribe to a YouTube channel", category: "Social Media", details: "Subscribe to the channel linked below and keep the page open for 30 seconds." },
  { title: "Like and comment on an Instagram post", category: "Social Media", details: "Like the post and leave a relevant comment of at least five words." },
  { title: "Follow a Facebook page", category: "Social Media", details: "Follow the page and send a screenshot showing the Following button." },
  { title: "Watch a product demo video", category: "Video & Audio", details: "Watch the whole video and write two sentences about what it shows." },
  { title: "Transcribe a 2 minute audio clip", category: "Video & Audio", details: "Listen to the clip and type what is said, word for word." },
  { title: "Write a short app store review", category: "Writing & Reviews", details: "Install the app, use it for a few minutes and write an honest review." },
  { title: "Write a 100 word product description", category: "Writing & Reviews", details: "Write a clear product description for the item described in the link." },
  { title: "Proofread a one page article", category: "Writing & Reviews", details: "Fix spelling and grammar in the article and send back the corrected text." },
  { title: "Test a signup flow on Android", category: "App Testing", details: "Create an account in the app and list any bug or confusing step you find." },
  { title: "Test a checkout page on mobile web", category: "App Testing", details: "Go through the checkout on your phone and report problems with screenshots." },
  { title: "Find the pricing of five competitors", category: "Research", details: "Collect the monthly price of five similar tools and put them in a short list." },
  { title: "Find contact emails for ten local shops", category: "Research", details: "Find a public contact email for ten shops in the city named in the brief." },
  { title: "Copy business cards into a sheet", category: "Data Entry", details: "Type the details from twenty business card photos into the sheet." },
  { title: "Tag fifty product photos", category: "Data Entry", details: "Add one colour tag and one type tag to each of fifty product photos." },
  { title: "Join a Telegram announcement channel", category: "Social Media", details: "Join the public channel and send a screenshot that shows you joined." },
  { title: "Rate a podcast episode", category: "Video & Audio", details: "Listen to the first ten minutes and write one paragraph of feedback." },
  { title: "Answer a five question survey", category: "Research", details: "Complete the survey honestly and paste the confirmation code." },
  { title: "Check ten links on a landing page", category: "App Testing", details: "Click every link on the page and list the ones that are broken." },
  { title: "Write three tagline ideas", category: "Writing & Reviews", details: "Write three short taglines for the product described in the brief." },
  { title: "Sort a contact list by city", category: "Data Entry", details: "Sort the list by city and fix obvious spelling mistakes in city names." },
];

const SUBMISSION_STATUSES = ["approved", "pending", "approved", "rejected", "pending"] as const;

// ── Main ────────────────────────────────────────────────────────────────────

type SeedFlag = { isSeed: true };
const SEED: SeedFlag = { isSeed: true };
// strict: false lets us store the `isSeed` marker, which is not in the schemas.
const UPSERT = { upsert: true, strict: false } as const;

async function main() {
  const uri = assertSafeToRun(process.env.MONGODB_URI);
  const password = process.env.SEED_PASSWORD || DEFAULT_PASSWORD;

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const dbName = mongoose.connection.name;
  console.log(`Seeding database "${dbName}"...`);

  const passwordHash = await bcrypt.hash(password, 12);

  // Plan tasks and submissions first, so coin balances can be derived from them.
  const buyers = [1, 2, 3].map((n) => ({
    id: seedId(1, n),
    name: `Seed Buyer ${n}`,
    email: email(`buyer${n}`),
  }));
  const workers = Array.from({ length: 10 }, (_, i) => ({
    id: seedId(2, i + 1),
    name: `Seed Worker ${i + 1}`,
    email: email(`worker${i + 1}`),
  }));

  const now = Date.now();
  const tasks = TASK_TEMPLATES.map((t, i) => {
    const buyer = buyers[i % buyers.length];
    const requiredWorkers = 2 + (i % 4); // 2..5
    const payableAmount = 5 + (i % 5) * 5; // 5..25
    return {
      ...t,
      id: seedId(3, i + 1),
      buyer,
      requiredWorkers,
      payableAmount,
      completionDate: new Date(now + (7 + i) * DAY_MS),
      baseStatus: (i === 18 ? "blocked" : i === 19 ? "archived" : "open") as
        | "open"
        | "blocked"
        | "archived",
    };
  });

  const submissions: {
    id: Types.ObjectId;
    task: (typeof tasks)[number];
    worker: (typeof workers)[number];
    status: (typeof SUBMISSION_STATUSES)[number];
  }[] = [];
  // Tasks 0..15 get 1-3 submissions each, from different workers.
  tasks.slice(0, 16).forEach((task, ti) => {
    const count = 1 + (ti % 3);
    for (let k = 0; k < count && k < task.requiredWorkers; k++) {
      const worker = workers[(ti + k * 3) % workers.length];
      const n = submissions.length;
      submissions.push({
        id: seedId(4, n + 1),
        task,
        worker,
        status: SUBMISSION_STATUSES[n % SUBMISSION_STATUSES.length],
      });
    }
  });

  // Derived numbers (the app keeps them in step the same way).
  const filledByTask = new Map<string, number>();
  const earnedByWorker = new Map<string, number>();
  for (const s of submissions) {
    if (s.status !== "rejected") {
      filledByTask.set(s.task.id.toString(), (filledByTask.get(s.task.id.toString()) ?? 0) + 1);
    }
    if (s.status === "approved") {
      earnedByWorker.set(s.worker.id.toString(), (earnedByWorker.get(s.worker.id.toString()) ?? 0) + s.task.payableAmount);
    }
  }
  const escrowByBuyer = new Map<string, number>();
  for (const t of tasks) {
    const key = t.buyer.id.toString();
    escrowByBuyer.set(key, (escrowByBuyer.get(key) ?? 0) + t.requiredWorkers * t.payableAmount);
  }

  // Users
  await User.updateOne(
    { email: email("admin") },
    {
      $set: { name: "Seed Admin", role: "admin", passwordHash, status: "active", ...SEED },
      $setOnInsert: { coins: 0 },
    },
    UPSERT,
  );
  for (const b of buyers) {
    const coins = Math.max(BUYER_START_COINS - (escrowByBuyer.get(b.id.toString()) ?? 0), BUYER_INITIAL_COINS);
    await User.updateOne(
      { email: b.email },
      { $set: { name: b.name, role: "buyer", passwordHash, status: "active", ...SEED }, $setOnInsert: { _id: b.id, coins } },
      UPSERT,
    );
  }
  for (const [i, w] of workers.entries()) {
    const coins =
      WORKER_INITIAL_COINS +
      (earnedByWorker.get(w.id.toString()) ?? 0) +
      (i < 4 ? WORKER_BONUS_COINS : 0);
    await User.updateOne(
      { email: w.email },
      { $set: { name: w.name, role: "worker", passwordHash, status: "active", ...SEED }, $setOnInsert: { _id: w.id, coins } },
      UPSERT,
    );
  }

  // Categories: only inserted when missing, never modified.
  for (const name of TASK_CATEGORIES) {
    await Category.updateOne(
      { name },
      { $setOnInsert: { name, icon: CATEGORY_ICONS[name] ?? "category", ...SEED } },
      UPSERT,
    );
  }

  // Resolve the real user ids (an existing seed user keeps its original _id).
  const userIdByEmail = new Map(
    (await User.find({ email: { $in: [...buyers, ...workers].map((u) => u.email) } }).select("_id email").lean()).map(
      (u) => [u.email, u._id as Types.ObjectId],
    ),
  );

  for (const t of tasks) {
    const filled = filledByTask.get(t.id.toString()) ?? 0;
    const status = t.baseStatus === "open" && filled >= t.requiredWorkers ? "closed" : t.baseStatus;
    await Task.updateOne(
      { _id: t.id },
      {
        $set: {
          title: t.title,
          details: t.details,
          category: t.category,
          buyerId: userIdByEmail.get(t.buyer.email),
          buyerName: t.buyer.name,
          buyerEmail: t.buyer.email,
          requiredWorkers: t.requiredWorkers,
          filledWorkers: filled,
          payableAmount: t.payableAmount,
          completionDate: t.completionDate,
          submissionInfo: "Send a screenshot or a link as proof, plus a short note about what you did.",
          status,
          ...SEED,
        },
      },
      UPSERT,
    );
  }

  for (const s of submissions) {
    await Submission.updateOne(
      { _id: s.id },
      {
        $set: {
          taskId: s.task.id,
          taskTitle: s.task.title,
          taskBuyerId: userIdByEmail.get(s.task.buyer.email),
          taskBuyerName: s.task.buyer.name,
          workerId: userIdByEmail.get(s.worker.email),
          workerName: s.worker.name,
          workerEmail: s.worker.email,
          payableAmount: s.task.payableAmount,
          details: `Seed proof for "${s.task.title}".`,
          proofLinks: [`https://example.com/proof/${s.id.toString()}`],
          status: s.status,
          ...(s.status === "rejected" ? { rejectionReason: "Proof did not match the task requirements." } : {}),
          ...SEED,
        },
      },
      UPSERT,
    );
  }

  console.log(
    `Done: 1 admin, ${buyers.length} buyers, ${workers.length} workers, ` +
      `${TASK_CATEGORIES.length} categories, ${tasks.length} tasks, ${submissions.length} submissions.`,
  );
  console.log("Accounts: admin@, buyer1@..buyer3@, worker1@..worker10@ (all @" + SEED_EMAIL_DOMAIN + ").");
  console.log(
    process.env.SEED_PASSWORD
      ? "Password: the value of SEED_PASSWORD."
      : `Password: ${DEFAULT_PASSWORD}`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
