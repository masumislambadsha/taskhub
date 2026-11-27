import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { verifyMfa } from "@/lib/mfa";
import { mfaConfigError, readCode, requireMfaSubject } from "@/lib/mfa-route";
import { auditContextFrom, recordAudit } from "@/lib/audit";

/**
 * Checks an authenticator code or a recovery code. This both finishes login
 * (marks the session verified) and confirms a sensitive action (renews the
 * 15-minute step-up), so one endpoint serves both.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const subject = requireMfaSubject(session);
  if (!subject.ok) return subject.response;
  const code = await readCode(req);
  if (!code) return NextResponse.json({ error: "A code is required" }, { status: 400 });

  await connectDB();
  let res;
  try {
    res = await verifyMfa(subject.userId, subject.sid, code);
  } catch (err) {
    const configured = mfaConfigError(err);
    if (configured) return configured;
    throw err;
  }
  if (!res.ok) {
    if (res.reason === "locked") {
      return NextResponse.json(
        { error: "Too many wrong codes. Try again later.", retryAfterSeconds: res.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(res.retryAfterSeconds ?? 900) } },
      );
    }
    if (res.reason === "not_enrolled") {
      return NextResponse.json({ error: "Set up two-factor first", code: "MFA_SETUP_REQUIRED" }, { status: 403 });
    }
    return NextResponse.json({ error: "That code is not right" }, { status: 401 });
  }
  if (res.usedRecoveryCode) {
    await recordAudit(auditContextFrom(req, { userId: subject.userId, role: subject.role }), {
      action: "mfa.recovery_used",
      targetType: "user",
      targetId: subject.userId,
      after: { recoveryCodesLeft: res.recoveryCodesLeft },
    });
  }
  return NextResponse.json({ ok: true, recoveryCodesLeft: res.recoveryCodesLeft });
}
