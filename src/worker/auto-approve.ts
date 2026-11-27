import { Worker, Queue, type Job } from "bullmq";
import type Redis from "ioredis";
import { createNotification } from "@/lib/notifications";
import User from "@/models/User";
import { createLogger } from "@/lib/logger";
import {
  autoApproveSubmission,
  sweepDueSubmissions,
  type AutoApproveResult,
} from "@/lib/ledger/flows/auto-approve";
import {
  AUTO_APPROVE_JOB,
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
  try {
    await createNotification({
      toUserId: s.workerId.toString(),
      toEmail: s.workerEmail,
      message: `Your submission for "${s.taskTitle}" was approved automatically. +${s.payableAmount} coins`,
      actionRoute: "/worker/submissions",
      type: "success",
    });
    const buyer = await User.findById(s.taskBuyerId).select("email").lean();
    if (buyer?.email) {
      await createNotification({
        toUserId: s.taskBuyerId.toString(),
        toEmail: buyer.email,
        message: `A submission for "${s.taskTitle}" was approved automatically because it was not reviewed in time.`,
        actionRoute: "/buyer/submissions",
        type: "info",
      });
    }
  } catch (err) {
    log.error({ err, submissionId }, "auto-approve notification failed");
  }
  return res;
}

export async function processAutoApproveJob(job: Job): Promise<unknown> {
  if (job.name === SWEEP_JOB) {
    const result = await sweepDueSubmissions({ approve: autoApproveAndNotify });
    log.info(
      {
        backfilled: result.backfilled,
        approved: result.approved.length,
        blocked: result.blocked.length,
        failed: result.failed.length,
      },
      "auto-approve sweep finished",
    );
    return result;
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
