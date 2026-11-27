// @vitest-environment node
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import FraudFlag from "@/models/FraudFlag";
import Submission from "@/models/Submission";
import { createFundedTask } from "@/lib/ledger/flows/tasks";
import { createPendingSubmission, createUser, startTestDb, taskInput } from "@/lib/payments/test-utils";
import { uiScreenshot } from "./test-images";
import { checkSubmissionProof, fetchProofImage, sweepUnhashedProofs } from "./duplicate-proof";

let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  db = await startTestDb("taskhub_duplicate_proof_test");
  await FraudFlag.init();
  await Submission.init();
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
});

const screenshot = (seed: number) => uiScreenshot(seed);

async function setup() {
  const buyer = await createUser(1000);
  const res = await createFundedTask({
    buyerId: String(buyer._id),
    buyerName: "Buyer",
    buyerEmail: "buyer@example.test",
    data: taskInput({ requiredWorkers: 10, payableAmount: 5 }),
  });
  if (!res.ok) throw new Error("setup failed");
  return { buyer, task: res.task as { _id: mongoose.Types.ObjectId; buyerId: mongoose.Types.ObjectId } };
}

/** A submission with a proof URL; the image bytes come from `images`. */
async function submit(task: Awaited<ReturnType<typeof setup>>["task"], worker: mongoose.Types.ObjectId, url: string) {
  const sub = await createPendingSubmission(task, worker);
  await Submission.updateOne({ _id: sub._id }, { $set: { proofImageUrl: url } });
  return String(sub._id);
}

describe("checkSubmissionProof", () => {
  it("flags both workers when a screenshot is copied (resized and recompressed), once", async () => {
    const { task } = await setup();
    const w1 = (await createUser(0))._id;
    const w2 = (await createUser(0))._id;
    const original = await screenshot(7);
    const copy = await sharp(original).resize(420).jpeg({ quality: 45 }).toBuffer();
    const images: Record<string, Buffer> = { "https://i.ibb.co/a/1.png": original, "https://i.ibb.co/b/2.jpg": copy };
    const fetchImage = async (u: string) => images[u];

    const first = await submit(task, w1, "https://i.ibb.co/a/1.png");
    expect(await checkSubmissionProof(first, { fetchImage })).toMatchObject({ status: "checked", flagsCreated: 0 });
    const second = await submit(task, w2, "https://i.ibb.co/b/2.jpg");
    const res = await checkSubmissionProof(second, { fetchImage });
    expect(res).toMatchObject({ status: "checked", flagsCreated: 2 });

    const flags = await FraudFlag.find({}).lean();
    const copyFlag = flags.find((f) => f.evidence.role === "copy")!;
    const originalFlag = flags.find((f) => f.evidence.role === "original")!;
    expect(String(copyFlag.userId)).toBe(String(w2));
    expect(String(copyFlag.submissionId)).toBe(second);
    expect(String(originalFlag.userId)).toBe(String(w1));
    expect(copyFlag.severity).toBe("medium");
    expect(copyFlag.status).toBe("open");
    expect(copyFlag.evidence.distance).toBeLessThanOrEqual(3);
    expect((await Submission.findById(second).lean())?.proofHashes?.chunks).toHaveLength(8);

    // Running the check again creates nothing new.
    expect(await checkSubmissionProof(second, { fetchImage })).toMatchObject({ flagsCreated: 0 });
    expect(await FraudFlag.countDocuments()).toBe(2);
  });

  it("an exact file is high severity; different screenshots are not flagged", async () => {
    const { task } = await setup();
    const [w1, w2, w3] = [(await createUser(0))._id, (await createUser(0))._id, (await createUser(0))._id];
    const a = await screenshot(1);
    const images: Record<string, Buffer> = { "https://i.ibb.co/1": a, "https://i.ibb.co/2": a, "https://i.ibb.co/3": await screenshot(2) };
    const fetchImage = async (u: string) => images[u];
    await checkSubmissionProof(await submit(task, w1, "https://i.ibb.co/1"), { fetchImage });
    const dup = await submit(task, w2, "https://i.ibb.co/2");
    await checkSubmissionProof(dup, { fetchImage });
    expect((await FraudFlag.findOne({ submissionId: dup }).lean())?.severity).toBe("high");
    expect((await FraudFlag.findOne({ submissionId: dup }).lean())?.evidence.distance).toBe(0);
    const other = await submit(task, w3, "https://i.ibb.co/3");
    expect(await checkSubmissionProof(other, { fetchImage })).toMatchObject({ flagsCreated: 0 });
    expect(await FraudFlag.countDocuments({ userId: w3 })).toBe(0);
  });

  it("the same worker reusing a screenshot gets one flag", async () => {
    const { task } = await setup();
    const w = (await createUser(0))._id;
    const a = await screenshot(5);
    const fetchImage = async () => a;
    await checkSubmissionProof(await submit(task, w, "https://i.ibb.co/x"), { fetchImage });
    const again = await submit(task, w, "https://i.ibb.co/y");
    expect(await checkSubmissionProof(again, { fetchImage })).toMatchObject({ flagsCreated: 1 });
    const flag = await FraudFlag.findOne({}).lean();
    expect(flag?.evidence.sameWorker).toBe(true);
    expect(String(flag?.userId)).toBe(String(w));
  });

  it("ignores screenshots older than 90 days, and reports missing or unreadable images", async () => {
    const { task } = await setup();
    const w1 = (await createUser(0))._id;
    const w2 = (await createUser(0))._id;
    const a = await screenshot(9);
    const fetchImage = async () => a;
    const old = await submit(task, w1, "https://i.ibb.co/old");
    await checkSubmissionProof(old, { fetchImage });
    await Submission.collection.updateOne({ _id: new mongoose.Types.ObjectId(old) }, { $set: { createdAt: new Date(Date.now() - 91 * 24 * 3600 * 1000) } });
    const recent = await submit(task, w2, "https://i.ibb.co/new");
    expect(await checkSubmissionProof(recent, { fetchImage })).toMatchObject({ status: "checked", flagsCreated: 0 });

    const noImage = await createPendingSubmission(task, w2);
    expect(await checkSubmissionProof(String(noImage._id))).toEqual({ status: "no_image" });
    expect(await checkSubmissionProof(String(new mongoose.Types.ObjectId()))).toEqual({ status: "not_found" });
    const broken = await submit(task, w2, "https://i.ibb.co/broken");
    const res = await checkSubmissionProof(broken, { fetchImage: async () => Buffer.from("not an image") });
    expect(res.status).toBe("failed");
  });

  it("the sweep hashes submissions whose job was lost", async () => {
    const { task } = await setup();
    const w = (await createUser(0))._id;
    const id = await submit(task, w, "https://nowhere.example/x.png"); // not an allowed host: fails, does not throw
    expect(await sweepUnhashedProofs()).toEqual({ checked: 1, failed: 1 });
    expect((await Submission.findById(id).lean())?.proofHashes).toBeUndefined();
  });
});

describe("fetchProofImage", () => {
  it("only fetches https images from allowed hosts", async () => {
    await expect(fetchProofImage("http://i.ibb.co/a.png")).rejects.toThrow(/not allowed/);
    await expect(fetchProofImage("https://evil.example/a.png")).rejects.toThrow(/not allowed/);
    await expect(fetchProofImage("https://169.254.169.254/latest/meta-data")).rejects.toThrow(/not allowed/);
    await expect(fetchProofImage("not a url")).rejects.toThrow(/not a URL/);
  });
});
