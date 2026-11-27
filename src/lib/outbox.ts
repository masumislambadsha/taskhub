import type mongoose from "mongoose";
import Notification from "@/models/Notification";
import Outbox, { type IOutboxDoc, type OutboxType } from "@/models/Outbox";
import { connectDB } from "@/lib/db";
import { emitToUser } from "@/lib/realtime-emit";
import { logger } from "@/lib/logger";

type Session = mongoose.mongo.ClientSession;

/** After this many failed attempts a row stops retrying and waits for an admin. */
export const MAX_ATTEMPTS = 8;
/** A row claimed longer ago than this is taken to belong to a crashed worker. */
export const CLAIM_LOCK_MS = 5 * 60 * 1000;
const BASE_BACKOFF_MS = 30 * 1000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;

/** 30s, 1m, 2m, 4m ... capped at an hour. */
export function backoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

/**
 * Queues a side effect (a notification, an email, a webhook). Call it with the
 * `session` of the transaction that causes it: the row is written in the same
 * transaction as the change, so the two exist together or not at all, and a
 * crash after the commit cannot lose the side effect. Queuing the same
 * `idempotencyKey` again is a no-op.
 */
export async function queueOutbox(
  entry: { type: OutboxType; payload: Record<string, unknown>; idempotencyKey: string },
  session?: Session,
): Promise<void> {
  try {
    await Outbox.create([{ ...entry }], session ? { session } : {});
  } catch (err) {
    // The same effect was queued before. Inside a transaction a duplicate key
    // aborts it, so callers pass keys that are unique per cause.
    if (!isDuplicateKey(err) || session) throw err;
  }
}

export interface QueuedNotification {
  toUserId: string;
  toEmail: string;
  message: string;
  actionRoute?: string;
  type?: "info" | "success" | "warning";
}

/** Queues an in-app notification, written with the change that causes it. */
export function queueNotification(
  n: QueuedNotification,
  idempotencyKey: string,
  session?: Session,
): Promise<void> {
  return queueOutbox({ type: "notification", payload: { ...n }, idempotencyKey }, session);
}

export interface OutboxHandlers {
  notification(payload: Record<string, unknown>, key: string): Promise<void>;
  email(payload: Record<string, unknown>, key: string): Promise<void>;
  webhook(payload: Record<string, unknown>, key: string): Promise<void>;
}

/**
 * The real senders. Every one is safe to call twice with the same key, because
 * the outbox delivers at least once: a crash between "sent" and "marked sent"
 * means a repeat.
 */
export const defaultHandlers: OutboxHandlers = {
  async notification(payload, key) {
    const p = payload as unknown as QueuedNotification;
    const res = await Notification.updateOne(
      { outboxKey: key },
      {
        $setOnInsert: {
          toUserId: p.toUserId,
          toEmail: p.toEmail,
          message: p.message,
          actionRoute: p.actionRoute,
          type: p.type ?? "info",
          isRead: false,
        },
      },
      { upsert: true },
    );
    // Only a notification created now is pushed, so a repeated delivery does not
    // make the bell ring twice. Best effort: the page also refreshes on its own.
    if (res.upsertedCount === 1) {
      await emitToUser(p.toUserId, "notification:new", {
        message: p.message,
        actionRoute: p.actionRoute,
        type: p.type ?? "info",
      });
    }
  },
  async email(payload, key) {
    const { sendRawEmail } = await import("@/lib/email");
    const p = payload as { to: string; subject: string; html: string };
    await sendRawEmail(p, key);
  },
  async webhook(payload, key) {
    const p = payload as { url: string; body: unknown };
    const res = await fetch(p.url, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(p.body),
    });
    if (!res.ok) throw new Error(`webhook answered ${res.status}`);
  },
};

export interface DrainResult {
  sent: number;
  /** Failed this time and scheduled to try again. */
  retried: number;
  /** Used up all attempts and now wait for an admin. */
  failed: number;
}

/**
 * Sends queued side effects. Each row is claimed with one atomic update (so two
 * workers never send the same row at once), sent, then marked `sent`. A failure
 * schedules a retry with exponential backoff, and after 8 attempts the row is
 * `failed` and shows up on the admin page. A row whose claimant crashed is
 * taken over once the claim is older than 5 minutes.
 */
export async function drainOutbox(
  opts: { now?: Date; limit?: number; handlers?: Partial<OutboxHandlers> } = {},
): Promise<DrainResult> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 100;
  const handlers = { ...defaultHandlers, ...opts.handlers };
  const result: DrainResult = { sent: 0, retried: 0, failed: 0 };

  for (let i = 0; i < limit; i++) {
    const row = await Outbox.findOneAndUpdate(
      {
        status: "pending",
        nextAttemptAt: { $lte: now },
        $or: [{ claimedAt: { $exists: false } }, { claimedAt: { $lt: new Date(now.getTime() - CLAIM_LOCK_MS) } }],
      },
      { $set: { claimedAt: now }, $inc: { attempts: 1 } },
      { sort: { nextAttemptAt: 1 }, returnDocument: "after" },
    ).lean<IOutboxDoc>();
    if (!row) break;

    try {
      await handlers[row.type](row.payload, row.idempotencyKey);
      await Outbox.updateOne(
        { _id: row._id },
        { $set: { status: "sent", sentAt: new Date() }, $unset: { claimedAt: "", lastError: "" } },
      );
      result.sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const exhausted = row.attempts >= MAX_ATTEMPTS;
      await Outbox.updateOne(
        { _id: row._id },
        {
          $set: {
            lastError: message.slice(0, 500),
            ...(exhausted
              ? { status: "failed" }
              : { nextAttemptAt: new Date(now.getTime() + backoffMs(row.attempts)) }),
          },
          $unset: { claimedAt: "" },
        },
      );
      if (exhausted) {
        result.failed++;
        logger.error({ outboxId: String(row._id), type: row.type, err: message }, "outbox row failed for good");
      } else {
        result.retried++;
      }
    }
  }
  return result;
}

/**
 * For a route or flow that just committed: send what was queued right away so
 * the user sees it without waiting for the worker. Never throws; anything
 * missed is picked up by the worker's drain job.
 */
export async function drainOutboxQuietly(): Promise<void> {
  try {
    await connectDB();
    await drainOutbox({ limit: 25 });
  } catch (err) {
    logger.warn({ err }, "immediate outbox drain failed; the worker will send it");
  }
}

/** Puts a failed row back in the queue with a fresh set of attempts. */
export async function retryOutboxRow(id: string): Promise<boolean> {
  const res = await Outbox.updateOne(
    { _id: id, status: "failed" },
    { $set: { status: "pending", attempts: 0, nextAttemptAt: new Date() }, $unset: { claimedAt: "", lastError: "" } },
  );
  return res.modifiedCount === 1;
}
