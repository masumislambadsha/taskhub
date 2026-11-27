import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { confirmEnrollment } from "@/lib/mfa";
import { readCode, requireMfaSubject } from "@/lib/mfa-route";
import { auditContextFrom, recordAudit } from "@/lib/audit";

/** Confirms enrollment with a code from the authenticator app. Returns the recovery codes, once. */
export async function POST(req: NextRequest) {
  const session = await auth();
  const subject = requireMfaSubject(session);
  if (!subject.ok) return subject.response;
  const code = await readCode(req);
  if (!code) return NextResponse.json({ error: "A code is required" }, { status: 400 });

  await connectDB();
  const res = await confirmEnrollment(subject.userId, subject.sid, code);
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
