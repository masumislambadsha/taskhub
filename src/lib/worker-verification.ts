import { createHmac, timingSafeEqual } from "node:crypto";
import { Readable } from "node:stream";
import mongoose, { Types } from "mongoose";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, type AuditContext } from "@/lib/audit";
import { inLedgerTransaction } from "@/lib/ledger/run";
import { queueNotification } from "@/lib/outbox";
import User from "@/models/User";
import WorkerApplication, { MAX_APPLICATION_ATTEMPTS, type IWorkerApplicationDoc } from "@/models/WorkerApplication";

export type WorkerStatus = "unverified" | "pending" | "approved" | "rejected";
const BUCKET = "worker_docs";
const MAX_DOC_BYTES = 5 * 1024 * 1024;
/** Rejected documents are deleted this many days after the decision. */
export const REJECTED_DOC_RETENTION_DAYS = 30;
const SIGNED_URL_TTL_MS = 5 * 60 * 1000;

/**
 * The worker's verification status. A worker with no stored status is an account
 * from before verification existed and counts as approved, so nobody loses
 * access when this ships. Other roles are not subject to it.
 */
export async function workerStatusOf(userId: string): Promise<WorkerStatus> {
  const u = await User.findById(userId).select("role workerStatus").lean();
  if (!u || u.role !== "worker") return "approved";
  return u.workerStatus ?? "approved";
}

/** The one server-side guard: returns a 403 response for a worker who is not approved, otherwise null. */
export async function requireApprovedWorker(userId: string): Promise<NextResponse | null> {
  const status = await workerStatusOf(userId);
  if (status === "approved") return null;
  const message =
    status === "pending"
      ? "Your application is being reviewed. You can start earning once it is approved."
      : status === "rejected"
        ? "Your application was not approved. Open Verification to fix it and apply again."
        : "Finish your verification to start earning.";
  return NextResponse.json({ error: message, code: "WORKER_NOT_APPROVED", status }, { status: 403 });
}

// ---------------------------------------------------------------- the form steps

export const profileSchema = z.object({
  fullName: z.string().trim().min(3).max(100),
  country: z.string().trim().min(2).max(60),
  birthYear: z.number().int().min(1930).max(new Date().getFullYear() - 16).optional(),
});
export const payoutSchema = z.object({
  paymentSystem: z.enum(["bkash", "nagad", "bank"]),
  accountNumber: z.string().trim().min(6).max(40),
});
export const skillsSchema = z.object({ skillsNote: z.string().trim().min(10).max(1000) });

/** The application is only editable while it is a draft or was rejected. */
async function editableApplication(userId: string): Promise<IWorkerApplicationDoc | null> {
  const status = await workerStatusOf(userId);
  if (status !== "unverified" && status !== "rejected") return null;
  return (
    (await WorkerApplication.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $setOnInsert: { userId: new Types.ObjectId(userId), status: "draft", attempts: 0, createdAt: new Date() } },
      { upsert: true, returnDocument: "after" },
    ).lean()) ?? null
  );
}

export type StepResult = { ok: true } | { ok: false; reason: "not_editable" | "invalid"; issues?: unknown };

export async function saveStep(userId: string, step: "profile" | "payout" | "skills", data: unknown): Promise<StepResult> {
  if (!(await editableApplication(userId))) return { ok: false, reason: "not_editable" };
  const schema = step === "profile" ? profileSchema : step === "payout" ? payoutSchema : skillsSchema;
  const parsed = schema.safeParse(data);
  if (!parsed.success) return { ok: false, reason: "invalid", issues: parsed.error.flatten() };
  const set = step === "skills" ? { skillsNote: (parsed.data as z.infer<typeof skillsSchema>).skillsNote } : { [step]: parsed.data };
  await WorkerApplication.updateOne({ userId }, { $set: set });
  return { ok: true };
}

// ---------------------------------------------------------------- private documents

function bucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: BUCKET });
}

function sniff(buf: Buffer): "jpeg" | "png" | "webp" | "pdf" | null {
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  if (buf.length > 5 && buf.subarray(0, 5).toString() === "%PDF-") return "pdf";
  return null;
}

export type UploadResult =
  | { ok: true; fileId: string }
  | { ok: false; reason: "not_editable" | "too_large" | "bad_type" };

/**
 * Stores an ID document or selfie in the private bucket. The type is checked by
 * content, images are re-encoded (which removes metadata and hidden payloads), and
 * the old file for that slot is deleted. PDFs are kept as uploaded (ID documents only).
 */
export async function uploadDocument(userId: string, kind: "id" | "selfie", data: Buffer): Promise<UploadResult> {
  const app = await editableApplication(userId);
  if (!app) return { ok: false, reason: "not_editable" };
  if (data.length > MAX_DOC_BYTES) return { ok: false, reason: "too_large" };
  const type = sniff(data);
  if (!type || (type === "pdf" && kind === "selfie")) return { ok: false, reason: "bad_type" };

  let body = data;
  let contentType = "application/pdf";
  if (type !== "pdf") {
    try {
      body = await sharp(data, { failOn: "none" }).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    } catch {
      return { ok: false, reason: "bad_type" };
    }
    contentType = "image/jpeg";
  }

  const id = await new Promise<Types.ObjectId>((resolve, reject) => {
    const up = bucket().openUploadStream(`${kind}-${userId}`, { metadata: { userId, kind, contentType } });
    Readable.from(body).pipe(up).on("error", reject).on("finish", () => resolve(up.id as Types.ObjectId));
  });
  const field = kind === "id" ? "idDocumentId" : "selfieId";
  const previous = app[field];
  await WorkerApplication.updateOne({ userId }, { $set: { [field]: id } });
  if (previous) await bucket().delete(previous).catch(() => {});
  return { ok: true, fileId: String(id) };
}

export async function readDocument(fileId: string): Promise<{ data: Buffer; contentType: string; userId?: string } | null> {
  if (!Types.ObjectId.isValid(fileId)) return null;
  const id = new Types.ObjectId(fileId);
  const [file] = await bucket().find({ _id: id }).toArray();
  if (!file) return null;
  const chunks: Buffer[] = [];
  for await (const c of bucket().openDownloadStream(id)) chunks.push(c as Buffer);
  return { data: Buffer.concat(chunks), contentType: (file.metadata?.contentType as string) ?? "application/octet-stream", userId: file.metadata?.userId as string | undefined };
}

// ---------------------------------------------------------------- signed, short-lived document links

function signingKey(): string {
  const key = process.env.DOC_SIGNING_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("DOC_SIGNING_SECRET (or AUTH_SECRET) is required");
    return "dev-only-doc-signing-key";
  }
  return key;
}
const sig = (fileId: string, exp: number, adminId: string) => createHmac("sha256", signingKey()).update(`${fileId}.${exp}.${adminId}`).digest("hex");

/** A link good for 5 minutes and only for the admin it was issued to. */
export function signDocumentUrl(fileId: string, adminId: string, now = Date.now()): string {
  const exp = now + SIGNED_URL_TTL_MS;
  return `/api/v1/admin/worker-documents/${fileId}?exp=${exp}&sig=${sig(fileId, exp, adminId)}`;
}

export function verifyDocumentSignature(fileId: string, adminId: string, exp: string | null, signature: string | null, now = Date.now()): boolean {
  const e = Number(exp);
  if (!signature || !Number.isFinite(e) || e < now || e > now + SIGNED_URL_TTL_MS + 1000) return false;
  const want = Buffer.from(sig(fileId, e, adminId));
  const got = Buffer.from(signature);
  return want.length === got.length && timingSafeEqual(want, got);
}

// ---------------------------------------------------------------- submitting and deciding

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: "not_editable" | "incomplete" | "too_many_attempts"; missing?: string[] };

export async function submitApplication(userId: string): Promise<SubmitResult> {
  const app = await editableApplication(userId);
  if (!app) return { ok: false, reason: "not_editable" };
  if (app.attempts >= MAX_APPLICATION_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };
  const missing = [
    !app.profile && "profile",
    !app.idDocumentId && "id document",
    !app.payout && "payout account",
    !app.skillsNote && "skills note",
  ].filter(Boolean) as string[];
  if (missing.length) return { ok: false, reason: "incomplete", missing };

  const now = new Date();
  const res = await WorkerApplication.updateOne(
    { userId, status: { $in: ["draft", "rejected"] } },
    { $set: { status: "pending", submittedAt: now }, $inc: { attempts: 1 }, $unset: { rejectionReason: "", decidedAt: "", decidedBy: "", purgeAfter: "" } },
  );
  if (!res.modifiedCount) return { ok: false, reason: "not_editable" };
  await User.updateOne({ _id: userId }, { $set: { workerStatus: "pending" }, $unset: { workerRejectionReason: "" } });
  return { ok: true };
}

export type DecideResult = { ok: true } | { ok: false; reason: "not_found" | "not_pending" | "reason_required" };

/**
 * An admin approves or rejects. Needs the admin's two-factor step-up (checked by
 * the route). The decision, the audit entry and the worker's notice are written
 * in one transaction, and a pending application can only be decided once.
 */
export async function decideApplication(args: {
  applicationId: string;
  decision: "approved" | "rejected";
  reason?: string;
  ctx: AuditContext;
}): Promise<DecideResult> {
  const { applicationId, decision, ctx } = args;
  const reason = args.reason?.trim();
  if (!Types.ObjectId.isValid(applicationId)) return { ok: false, reason: "not_found" };
  if (decision === "rejected" && (!reason || reason.length < 5)) return { ok: false, reason: "reason_required" };

  return inLedgerTransaction(async (session): Promise<DecideResult> => {
    const now = new Date();
    const app = await WorkerApplication.findOneAndUpdate(
      { _id: applicationId, status: "pending" },
      {
        $set: {
          status: decision,
          decidedAt: now,
          decidedBy: ctx.actorId,
          ...(decision === "rejected" ? { rejectionReason: reason, purgeAfter: new Date(now.getTime() + REJECTED_DOC_RETENTION_DAYS * 86400000) } : {}),
        },
      },
      { session, returnDocument: "after" },
    );
    if (!app) return { ok: false, reason: (await WorkerApplication.exists({ _id: applicationId }).session(session)) ? "not_pending" : "not_found" };

    const user = await User.findByIdAndUpdate(
      app.userId,
      {
        $set: { workerStatus: decision, workerReviewedBy: ctx.actorId, workerReviewedAt: now, ...(decision === "rejected" ? { workerRejectionReason: reason } : {}) },
        ...(decision === "approved" ? { $unset: { workerRejectionReason: "" } } : {}),
      },
      { session, returnDocument: "after" },
    ).select("email");

    await recordAudit(
      ctx,
      { action: `worker_application.${decision}`, targetType: "worker_application", targetId: applicationId, after: { status: decision, userId: String(app.userId) }, ...(reason ? { reason } : {}) },
      session,
    );
    if (user?.email) {
      await queueNotification(
        {
          toUserId: String(app.userId),
          toEmail: user.email,
          message:
            decision === "approved"
              ? "Your worker application was approved. You can start earning now."
              : `Your worker application was not approved: ${reason}. You can fix it and apply again.`,
          actionRoute: decision === "approved" ? "/worker/tasks" : "/worker/verification",
          type: decision === "approved" ? "success" : "warning",
        },
        // One notice per attempt: a worker may be rejected, reapply and be decided again.
        `worker-application:${applicationId}:${app.attempts}:${decision}`,
        session,
      );
    }
    return { ok: true };
  });
}

/** Deletes the documents of applications rejected more than the retention period ago. Run by the worker's sweep. */
export async function purgeRejectedDocuments(now = new Date()): Promise<number> {
  const due = await WorkerApplication.find({ status: "rejected", purgeAfter: { $lte: now }, $or: [{ idDocumentId: { $exists: true } }, { selfieId: { $exists: true } }] }).limit(100).lean();
  for (const app of due) {
    for (const id of [app.idDocumentId, app.selfieId]) if (id) await bucket().delete(id).catch(() => {});
    await WorkerApplication.updateOne({ _id: app._id }, { $unset: { idDocumentId: "", selfieId: "" } });
  }
  return due.length;
}

/** Applications waiting for review, longest waiting first. */
export function pendingQueue(limit = 100) {
  return WorkerApplication.find({ status: "pending" }).sort({ submittedAt: 1 }).limit(limit).lean();
}
