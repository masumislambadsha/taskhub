import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { requireAdmin as requireAdminRole, type AdminGuard } from "@/lib/roles";
import { getMfaState, mfaRequiredFor } from "@/lib/mfa";
import { connectDB } from "@/lib/db";

type SessionLike =
  | { user?: { id?: string; role?: string | null; sid?: string } | null }
  | null
  | undefined;

export type MfaProblem = "MFA_SETUP_REQUIRED" | "MFA_REQUIRED" | "STEP_UP_REQUIRED";

const MESSAGES: Record<MfaProblem, string> = {
  MFA_SETUP_REQUIRED: "Set up two-factor authentication to use the admin area",
  MFA_REQUIRED: "Enter your two-factor code to continue",
  STEP_UP_REQUIRED: "Enter your two-factor code to confirm this action",
};

/**
 * What stops this session from acting as an admin, or null when nothing does.
 * Admins must have two-factor set up and have proved it in this login; with
 * `stepUp` the code must also have been entered in the last 15 minutes. The
 * read-only demo admin is exempt. Checked on the server on every request.
 */
export async function mfaProblem(
  session: SessionLike,
  opts: { stepUp?: boolean } = {},
): Promise<MfaProblem | null> {
  const user = session?.user;
  if (!user || !mfaRequiredFor(user.role)) return null;
  await connectDB();
  const state = await getMfaState(user.id ?? "", user.sid);
  if (!state.enrolled) return "MFA_SETUP_REQUIRED";
  if (!state.verified) return "MFA_REQUIRED";
  if (opts.stepUp && !state.stepUpFresh) return "STEP_UP_REQUIRED";
  return null;
}

export function mfaResponse(problem: MfaProblem): NextResponse {
  return NextResponse.json({ error: MESSAGES[problem], code: problem }, { status: 403 });
}

/**
 * Guards an admin API route: the role check from `requireAdmin` in `roles.ts`
 * plus the two-factor check above. Pass `{ stepUp: true }` for sensitive
 * actions (money, roles, deleting users).
 */
export async function requireAdmin(
  session: SessionLike,
  access: "read" | "write",
  opts: { stepUp?: boolean } = {},
): Promise<AdminGuard> {
  const guard = requireAdminRole(session, access);
  if (!guard.ok) return guard;
  const problem = await mfaProblem(session, opts);
  if (problem) return { ok: false, response: mfaResponse(problem) };
  return guard;
}

/** For admin pages: sends an admin who has not finished two-factor to the security page. */
export async function requireAdminPageMfa(session: SessionLike): Promise<void> {
  const problem = await mfaProblem(session);
  if (problem) redirect("/admin/security");
}
