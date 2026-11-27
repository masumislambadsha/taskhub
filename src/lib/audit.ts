import type mongoose from "mongoose";
import AuditLog from "@/models/AuditLog";

type Session = mongoose.mongo.ClientSession;

/** Who did it and from where. Built once per request. */
export interface AuditContext {
  actorId: string;
  actorRole: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

export interface AuditEntry {
  action: string;
  targetType: string;
  targetId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
}

/** For things the platform does by itself, such as an automatic approval. */
export const SYSTEM_AUDIT: AuditContext = { actorId: "system", actorRole: "system" };

/** The client IP behind the proxy: the first `x-forwarded-for` address, else `x-real-ip`. */
export function clientIp(headers: Headers): string | undefined {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || undefined;
}

export function auditContextFrom(
  req: Request,
  actor: { userId: string; role: string },
): AuditContext {
  return {
    actorId: actor.userId,
    actorRole: actor.role,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent")?.slice(0, 300) || undefined,
    requestId: req.headers.get("x-request-id") || undefined,
  };
}

/** Keeps only the named fields, so `before` and `after` hold just what changed. */
export function pick<T extends Record<string, unknown>>(
  source: T | null | undefined,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) if (source && key in source) out[key] = source[key];
  return out;
}

/**
 * Writes one audit entry. Pass the `session` of the transaction that makes the
 * change, so the action and its log commit or roll back together: an action
 * can never happen without its entry, and a refused action leaves none.
 */
export async function recordAudit(
  ctx: AuditContext,
  entry: AuditEntry,
  session?: Session,
): Promise<void> {
  await AuditLog.create(
    [
      {
        ...ctx,
        ...entry,
        targetId: String(entry.targetId),
      },
    ],
    session ? { session } : {},
  );
}
