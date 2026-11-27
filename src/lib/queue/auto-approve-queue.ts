import { Queue } from "bullmq";
import Redis from "ioredis";
import { logger } from "@/lib/logger";

export const AUTO_APPROVE_QUEUE = "auto-approve";
export const AUTO_APPROVE_JOB = "auto-approve";
export const DISPUTE_WINDOW_JOB = "dispute-window";
export const SWEEP_JOB = "sweep";
export const PROOF_HASH_JOB = "proof-hash";
/** Wait a moment after the submission so the image host has the file. */
export const PROOF_HASH_DELAY_MS = 2000;
export const OUTBOX_DRAIN_JOB = "outbox-drain";
export const OUTBOX_EVERY_MS = 30 * 1000;
export const SWEEP_EVERY_MS = 15 * 60 * 1000;
/** A queue call that takes longer than this is given up on; the sweep covers the gap. */
const ENQUEUE_TIMEOUT_MS = 3000;

/** BullMQ job IDs must not contain colons. */
export function autoApproveJobId(submissionId: string): string {
  return `auto-approve-${submissionId}`;
}

/** BullMQ job IDs must not contain colons. */
export function disputeWindowJobId(submissionId: string): string {
  return `dispute-window-${submissionId}`;
}

export const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 30_000 },
  removeOnComplete: true,
  removeOnFail: { age: 7 * 24 * 3600 },
};

let producer: { queue: Queue; connection: Redis } | null = null;

function getProducer(): Queue | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!producer) {
    // Fail fast when Redis is down: the request must not hang on a queue call.
    const connection = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });
    connection.on("error", () => {});
    producer = {
      connection,
      queue: new Queue(AUTO_APPROVE_QUEUE, { connection, defaultJobOptions }),
    };
  }
  return producer.queue;
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("queue timeout")), ENQUEUE_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Schedules the automatic approval of a submission. The job ID is fixed per
 * submission, so adding it twice schedules it once. Never throws: if Redis is
 * unreachable or not configured, the 15-minute sweep approves the submission
 * on time anyway. Call it after the submission is committed.
 */
export async function scheduleAutoApprove(
  submissionId: string,
  runAt: Date,
): Promise<boolean> {
  const queue = getProducer();
  if (!queue) return false;
  try {
    await withTimeout(
      queue.add(
        AUTO_APPROVE_JOB,
        { submissionId },
        {
          jobId: autoApproveJobId(submissionId),
          delay: Math.max(0, runAt.getTime() - Date.now()),
        },
      ),
    );
    return true;
  } catch (err) {
    logger.warn({ err, submissionId }, "could not schedule auto-approve; the sweep will cover it");
    return false;
  }
}

/** Schedules the end of a rejection's dispute window. One job per submission; never throws (the sweep covers a miss). */
export async function scheduleDisputeWindow(submissionId: string, runAt: Date): Promise<boolean> {
  const queue = getProducer();
  if (!queue) return false;
  try {
    await withTimeout(
      queue.add(
        DISPUTE_WINDOW_JOB,
        { submissionId },
        {
          jobId: disputeWindowJobId(submissionId),
          delay: Math.max(0, runAt.getTime() - Date.now()),
        },
      ),
    );
    return true;
  } catch (err) {
    logger.warn({ err, submissionId }, "could not schedule dispute window; the sweep will cover it");
    return false;
  }
}

/** BullMQ job IDs must not contain colons. */
export function proofHashJobId(submissionId: string): string {
  return `proof-hash-${submissionId}`;
}

/** Schedules the screenshot fingerprint check. One job per submission; never throws (the sweep covers a miss). */
export async function scheduleProofHash(submissionId: string): Promise<boolean> {
  const queue = getProducer();
  if (!queue) return false;
  try {
    await withTimeout(
      queue.add(PROOF_HASH_JOB, { submissionId }, { jobId: proofHashJobId(submissionId), delay: PROOF_HASH_DELAY_MS }),
    );
    return true;
  } catch (err) {
    logger.warn({ err, submissionId }, "could not schedule proof hashing; the sweep will cover it");
    return false;
  }
}

/** Removes the window job once the hold is settled some other way. Never throws. */
export async function cancelDisputeWindow(submissionId: string): Promise<void> {
  const queue = getProducer();
  if (!queue) return;
  try {
    await withTimeout(queue.remove(disputeWindowJobId(submissionId)));
  } catch (err) {
    logger.warn({ err, submissionId }, "could not cancel dispute window job");
  }
}

/** Removes the delayed job once a person has decided. Never throws. */
export async function cancelAutoApprove(submissionId: string): Promise<void> {
  const queue = getProducer();
  if (!queue) return;
  try {
    await withTimeout(queue.remove(autoApproveJobId(submissionId)));
  } catch (err) {
    // The job finds the submission already decided and does nothing.
    logger.warn({ err, submissionId }, "could not cancel auto-approve job");
  }
}

/** Closes the producer connection. For tests and shutdown. */
export async function closeAutoApproveProducer(): Promise<void> {
  if (!producer) return;
  const { queue, connection } = producer;
  producer = null;
  await queue.close().catch(() => {});
  connection.disconnect();
}
