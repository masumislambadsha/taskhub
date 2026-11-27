import { Worker, Queue, type Job } from "bullmq";
import type Redis from "ioredis";
import { drainOutbox, drainOutboxQuietly } from "@/lib/outbox";
import { expireUnconfirmedWithdrawals } from "@/lib/ledger/flows/withdrawals";
import { createLogger } from "@/lib/logger";
import { recomputeStaleTrust } from "@/lib/trust-data";
import { checkSubmissionProof, sweepUnhashedProofs } from "@/lib/fraud/duplicate-proof";
import { notifyOverdueDisputes } from "@/lib/dispute-sla";
import { sweepDueHolds } from "@/lib/ledger/flows/rejection-settlement";
import { settleRejection, type SettleRejectionResult } from "@/lib/ledger/flows/submissions";
import {
  autoApproveSubmission,
  sweepDueSubmissions,
  type AutoApproveResult,
} from "@/lib/ledger/flows/auto-approve";
import {
  AUTO_APPROVE_JOB,
  DISPUTE_WINDOW_JOB,
  OUTBOX_DRAIN_JOB,
  OUTBOX_EVERY_MS,
  PROOF_HASH_JOB,
  AUTO_APPROVE_QUEUE,
  SWEEP_EVERY_MS,
  SWEEP_JOB,
  defaultJobOptions,
} from "@/lib/queue/auto-approve-queue";

const log = createLogger("worker");

/** A delayed job may fire a little before the web server's clock says it is due. */
const DUE_TOLERANCE_MS = 60_000;

/**
 * Approves one submission and tells both people. Notification failures never
 * undo or retry the approval: the coins have moved.
 */
export async function autoApproveAndNotify(
  submissionId: string,
  opts: { now?: Date; toleranceMs?: number } = {},
): Promise<AutoApproveResult> {
  const res = await autoApproveSubmission(submissionId, opts);

  if (res.status === "blocked") {
    log.warn({ submissionId, reason: res.reason }, "auto-approve blocked; needs a person");
    return res;
  }
  if (res.status === "skipped") {
    if (res.reason === "not_due") {
      // Not due even with tolerance: let BullMQ retry later.
      throw new Error(`submission ${submissionId} is not due yet`);
    }
    return res;
  }

  const s = res.submission;
  log.info(
    { submissionId, taskId: String(s.taskId), workerId: String(s.workerId), coins: s.payableAmount },
    "submission auto-approved",
  );
  // The worker's and the buyer's notices were queued with the approval.
  await drainOutboxQuietly();
  return res;
}

/** Settles one rejection hold and tells the worker. Notification failures never undo the settlement. */
export async function settleAndNotify(
  submissionId: string,
  via: "accepted" | "window" | "buyer_won",
): Promise<SettleRejectionResult> {
  const res = await settleRejection({ submissionId, via });
  if (!res.ok) {
    if (res.reason === "buyer_missing") {
      log.warn({ submissionId }, "rejection hold cannot settle: the buyer's account is gone");
    }
    return res;
  }
  log.info({ submissionId, outcome: res.outcome, via }, "rejection settled");
  // The worker's "now final" notice was queued with the settlement.
  await drainOutboxQuietly();
  return res;
}

export async function processAutoApproveJob(job: Job): Promise<unknown> {
  if (job.name === DISPUTE_WINDOW_JOB) {
    const id = (job.data as { submissionId?: string }).submissionId;
    if (!id) return { skipped: "no submissionId" };
    const res = await settleAndNotify(id, "window");
    return { ok: res.ok };
  }
  if (job.name === PROOF_HASH_JOB) {
    const id = (job.data as { submissionId?: string }).submissionId;
    if (!id) return { skipped: "no submissionId" };
    const res = await checkSubmissionProof(id);
    // A download that failed is retried by BullMQ (backoff), then by the sweep.
    if (res.status === "failed") throw new Error(`proof check failed: ${res.reason}`);
    return { status: res.status };
  }
  if (job.name === SWEEP_JOB) {
    // Trust scores are recomputed for everyone about once a day, a batch per sweep.
    const trusted = await recomputeStaleTrust();
    if (trusted) log.info({ recomputed: trusted }, "trust scores recomputed");
    const hashed = await sweepUnhashedProofs();
    if (hashed.checked) log.info(hashed, "proof hash sweep finished");
    const holds = await sweepDueHolds({ settle: (id) => settleAndNotify(id, "window") });
    // The workers' notices are queued with each cancellation.
    const expired = await expireUnconfirmedWithdrawals();
    if (expired.length) log.info({ count: expired.length }, "unconfirmed withdrawals cancelled");
    const overdueDisputes = await notifyOverdueDisputes();
    if (overdueDisputes.length) log.info({ count: overdueDisputes.length }, "admins reminded about overdue disputes");
    const result = await sweepDueSubmissions({ approve: autoApproveAndNotify });
    log.info({ holdsSettled: holds.settled.length, holdsFailed: holds.failed.length }, "dispute-window sweep finished");
    log.info(
      {
        backfilled: result.backfilled,
        approved: result.approved.length,
        blocked: result.blocked.length,
        failed: result.failed.length,
      },
      "auto-approve sweep finished",
    );
    await drainOutbox();
    return result;
  }
  if (job.name === OUTBOX_DRAIN_JOB) {
    const drained = await drainOutbox();
    if (drained.sent || drained.retried || drained.failed) log.info(drained, "outbox drained");
    return drained;
  }

  const submissionId = (job.data as { submissionId?: string }).submissionId;
  if (!submissionId) return { skipped: "no submissionId" };
  const res = await autoApproveAndNotify(submissionId, { toleranceMs: DUE_TOLERANCE_MS });
  return { status: res.status };
}

export interface AutoApproveRuntime {
  worker: Worker;
  queue: Queue;
  close(): Promise<void>;
}

/**
 * Starts the worker that processes auto-approve jobs and registers the
 * repeating sweep. `connection` must have `maxRetriesPerRequest: null`.
 */
export async function startAutoApproveWorker(connection: Redis): Promise<AutoApproveRuntime> {
  const queue = new Queue(AUTO_APPROVE_QUEUE, { connection, defaultJobOptions });
  const worker = new Worker(AUTO_APPROVE_QUEUE, processAutoApproveJob, {
    connection,
    concurrency: 5,
  });
  worker.on("failed", (job, err) =>
    log.error({ err, jobId: job?.id, attemptsMade: job?.attemptsMade }, "auto-approve job failed"),
  );
  worker.on("error", (err) => log.error({ err }, "auto-approve worker error"));

  // One repeating job, however many workers start. Also runs once soon after
  // start, so submissions that came due while the worker was down are caught.
  await queue.upsertJobScheduler(SWEEP_JOB, { every: SWEEP_EVERY_MS }, { name: SWEEP_JOB });
  await queue.add(SWEEP_JOB, {}, { jobId: `${SWEEP_JOB}-startup-${Date.now()}`, removeOnComplete: true });
  // Sends queued notifications, emails and webhooks every 30 seconds.
  await queue.upsertJobScheduler(OUTBOX_DRAIN_JOB, { every: OUTBOX_EVERY_MS }, { name: OUTBOX_DRAIN_JOB });

  return {
    worker,
    queue,
    async close() {
      await worker.close();
      await queue.close();
    },
  };
}

export { AUTO_APPROVE_JOB };
