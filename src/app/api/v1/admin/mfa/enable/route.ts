import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { confirmEnrollment } from "@/lib/mfa";
import { mfaConfigError, readCode, requireMfaSubject } from "@/lib/mfa-route";
import { consume, rateLimitedResponse } from "@/lib/ratelimit";
import { auditContextFrom, recordAudit } from "@/lib/audit";

/** Confirms enrollment with a code from the authenticator app. Returns the recovery codes, once. */
export async function POST(req: NextRequest) {
  const session = await auth();
  const subject = requireMfaSubject(session);
  if (!subject.ok) return subject.response;
  const code = await readCode(req);
  if (!code) return NextResponse.json({ error: "A code is required" }, { status: 400 });
  // Shared by every instance, on top of the lockout stored with the credential.
  const limit = await consume("mfa", subject.userId);
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);

  await connectDB();
  let res;
  try {
    res = await confirmEnrollment(subject.userId, subject.sid, code);
  } catch (err) {
    const configured = mfaConfigError(err);
    if (configured) return configured;
    throw err;
  }
  if (!res.ok) {
    const message = {
      invalid: "That code is not right. Check your authenticator app and try again.",
      no_setup: "Start the setup first",
      already_enrolled: "Two-factor is already set up",
    }[res.reason];
    return NextResponse.json({ error: message }, { status: res.reason === "invalid" ? 400 : 409 });
  }
  await recordAudit(auditContextFrom(req, { userId: subject.userId, role: subject.role }), {
    action: "mfa.enroll",
    targetType: "user",
    targetId: subject.userId,
  });
  return NextResponse.json({ recoveryCodes: res.recoveryCodes });
}
