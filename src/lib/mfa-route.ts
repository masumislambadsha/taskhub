import { NextResponse } from "next/server";
import { requireAdmin as requireAdminRole } from "@/lib/roles";
import { mfaRequiredFor } from "@/lib/mfa";

type SessionLike = { user?: { id?: string; role?: string | null; email?: string | null; sid?: string } | null } | null | undefined;

/**
 * Guard for the two-factor endpoints themselves. They must work for an admin
 * who has not verified yet (that is their whole purpose), so they check the
 * role but not the second factor. The read-only demo admin has no second factor.
 */
export function requireMfaSubject(
  session: SessionLike,
):
  | { ok: true; userId: string; email: string; sid: string | undefined; role: "admin" }
  | { ok: false; response: NextResponse } {
  const guard = requireAdminRole(session, "write");
  if (!guard.ok) return guard;
  if (!mfaRequiredFor(guard.role)) {
    return { ok: false, response: NextResponse.json({ error: "Two-factor is not required for this account" }, { status: 400 }) };
  }
  return {
    ok: true,
    userId: guard.userId,
    email: session?.user?.email ?? guard.userId,
    sid: session?.user?.sid,
    role: "admin",
  };
}

/**
 * A server that is missing MFA_ENCRYPTION_KEY cannot store or read any
 * authenticator secret. The admin area stays closed (it fails closed, it does
 * not skip the check), and this says why instead of a bare 500.
 */
export function mfaConfigError(err: unknown): NextResponse | null {
  if (err instanceof Error && err.message.includes("MFA_ENCRYPTION_KEY")) {
    return NextResponse.json(
      { error: "Two-factor is not configured on the server (MFA_ENCRYPTION_KEY is missing or invalid)", code: "MFA_NOT_CONFIGURED" },
      { status: 503 },
    );
  }
  return null;
}

export async function readCode(req: Request): Promise<string | null> {
  try {
    const body = (await req.json()) as { code?: unknown };
    return typeof body.code === "string" && body.code.length <= 32 ? body.code : null;
  } catch {
    return null;
  }
}
