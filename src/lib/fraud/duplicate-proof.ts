import { Types } from "mongoose";
import { logger } from "@/lib/logger";
import FraudFlag from "@/models/FraudFlag";
import Submission from "@/models/Submission";
import { hammingDistance, hashImage, type ImageHashes } from "./image-hash";

const log = logger.child({ module: "duplicate-proof" });

/**
 * Two screenshots this close (in differing bits out of 64) count as the same
 * picture. Tuned on 15 matching and 15 different synthetic UI screenshots (see
 * image-hash.test.ts): copies were 0 to 6 bits apart, different ones at least 12.
 * It must stay at 7 or below, because the chunk index only guarantees finding
 * pairs within 7 bits. Retune on about 30 pairs of real screenshots.
 */
export const NEAR_DUPLICATE_MAX_DISTANCE = 6;
/** How far back a new screenshot is compared. */
export const LOOKBACK_MS = 90 * 24 * 3600 * 1000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

/** Hosts a proof screenshot may be fetched from (uploads go to imgbb). Extend with PROOF_IMAGE_HOSTS=a.com,b.com. */
function allowedHosts(): Set<string> {
  const extra = (process.env.PROOF_IMAGE_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  return new Set(["i.ibb.co", "ibb.co", ...extra]);
}

/**
 * Downloads a proof image. Only https URLs on the allowed hosts, no redirects
 * (a redirect could point at an internal address), at most 5 MB, 10 seconds.
 */
export async function fetchProofImage(url: string): Promise<Buffer> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("proof URL is not a URL");
  }
  if (parsed.protocol !== "https:" || !allowedHosts().has(parsed.hostname.toLowerCase())) {
    throw new Error(`proof host not allowed: ${parsed.hostname}`);
  }
  const res = await fetch(parsed, { redirect: "error", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`proof download failed: ${res.status}`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_IMAGE_BYTES) throw new Error("proof image too large");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw new Error("proof image too large");
  return buf;
}

export interface DuplicateMatch {
  submissionId: string;
  workerId: string;
  /** 0 for byte-identical files. */
  distance: number;
  createdAt: Date;
}

/**
 * Earlier submissions within the last 90 days whose screenshot looks the same
 * as these hashes. If two hashes differ by 7 bits or fewer, at least one of
 * the 8 bytes is identical, so the chunk index finds every candidate; the exact
 * distance is then computed here.
 */
export async function findNearDuplicates(
  hashes: ImageHashes,
  opts: { excludeSubmissionId: string; before: Date; maxDistance?: number },
): Promise<DuplicateMatch[]> {
  const max = opts.maxDistance ?? NEAR_DUPLICATE_MAX_DISTANCE;
  const candidates = await Submission.find({
    _id: { $ne: new Types.ObjectId(opts.excludeSubmissionId) },
    createdAt: { $gte: new Date(opts.before.getTime() - LOOKBACK_MS), $lte: opts.before },
    $or: [{ "proofHashes.sha256": hashes.sha256 }, { "proofHashes.chunks": { $in: hashes.chunks } }],
  })
    .select("workerId createdAt proofHashes")
    .limit(500)
    .lean();

  const out: DuplicateMatch[] = [];
  for (const c of candidates) {
    if (!c.proofHashes) continue;
    const distance = c.proofHashes.sha256 === hashes.sha256 ? 0 : hammingDistance(hashes.dhash, c.proofHashes.dhash);
    if (distance <= max) {
      out.push({ submissionId: String(c._id), workerId: String(c.workerId), distance, createdAt: c.createdAt });
    }
  }
  return out.sort((a, b) => a.distance - b.distance || a.createdAt.getTime() - b.createdAt.getTime());
}

export type ProofCheckResult =
  | { status: "no_image" | "not_found" }
  | { status: "failed"; reason: string }
  | { status: "checked"; hashes: ImageHashes; matches: DuplicateMatch[]; flagsCreated: number };

/**
 * Hashes a submission's proof screenshot, stores the fingerprints on the
 * submission, and flags matches. Run by the worker a few seconds after the
 * submission. Safe to run again: flags are unique per pair.
 *
 * Flags: for a match, the later submission's worker is flagged as "copy" and the
 * earlier one as "original" (probably the honest one; the admin decides). The
 * same worker reusing one screenshot is flagged as well. An exact file match is
 * high severity, a near match medium.
 *
 * Not done here: comparing the visible username (roadmap 3.5), so tasks where
 * everyone screenshots the same page can produce false flags; the strict
 * threshold keeps that rare.
 */
export async function checkSubmissionProof(
  submissionId: string,
  deps: { fetchImage?: (url: string) => Promise<Buffer> } = {},
): Promise<ProofCheckResult> {
  const sub = await Submission.findById(submissionId).lean();
  if (!sub) return { status: "not_found" };
  if (!sub.proofImageUrl) return { status: "no_image" };

  let hashes: ImageHashes;
  try {
    hashes = await hashImage(await (deps.fetchImage ?? fetchProofImage)(sub.proofImageUrl));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log.warn({ submissionId, reason }, "could not hash proof image");
    return { status: "failed", reason };
  }

  await Submission.updateOne({ _id: sub._id }, { $set: { proofHashes: { ...hashes, computedAt: new Date() } } });
  const matches = await findNearDuplicates(hashes, { excludeSubmissionId: submissionId, before: sub.createdAt });

  let flagsCreated = 0;
  for (const m of matches) {
    const sameWorker = m.workerId === String(sub.workerId);
    const severity = m.distance === 0 ? "high" : "medium";
    const rows = [
      { userId: sub.workerId, submissionId: sub._id, other: new Types.ObjectId(m.submissionId), otherUser: new Types.ObjectId(m.workerId), role: "copy" as const },
      { userId: new Types.ObjectId(m.workerId), submissionId: new Types.ObjectId(m.submissionId), other: sub._id, otherUser: sub.workerId, role: "original" as const },
    ];
    for (const r of rows) {
      if (sameWorker && r.role === "original") continue; // one flag is enough when it is the same person
      const res = await FraudFlag.updateOne(
        { submissionId: r.submissionId, type: "duplicate_proof", "evidence.otherSubmissionId": r.other },
        {
          $setOnInsert: {
            userId: r.userId,
            severity,
            status: "open",
            createdAt: new Date(),
            evidence: { otherSubmissionId: r.other, otherUserId: r.otherUser, distance: m.distance, sameWorker, role: r.role },
          },
        },
        { upsert: true },
      );
      if (res.upsertedCount) flagsCreated++;
    }
  }
  if (flagsCreated) log.info({ submissionId, matches: matches.length, flagsCreated }, "duplicate proof flagged");
  return { status: "checked", hashes, matches, flagsCreated };
}

/** Submissions from the last day that have a screenshot but no fingerprints yet (the job was lost). */
export async function sweepUnhashedProofs(limit = 50): Promise<{ checked: number; failed: number }> {
  const rows = await Submission.find({
    proofImageUrl: { $exists: true, $ne: "" },
    proofHashes: { $exists: false },
    createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) },
  })
    .sort({ createdAt: 1 })
    .select("_id")
    .limit(limit)
    .lean();
  let failed = 0;
  for (const r of rows) {
    const res = await checkSubmissionProof(String(r._id));
    if (res.status === "failed") failed++;
  }
  return { checked: rows.length, failed };
}
