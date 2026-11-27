import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { beginEnrollment } from "@/lib/mfa";
import { requireMfaSubject } from "@/lib/mfa-route";

/** Starts enrollment: returns a QR code and the manual key. Nothing counts until a code is confirmed at /enable. */
export async function POST() {
  const session = await auth();
  const subject = requireMfaSubject(session);
  if (!subject.ok) return subject.response;
  await connectDB();
  const res = await beginEnrollment(subject.userId, subject.email);
  if (!res.ok) {
    return NextResponse.json({ error: "Two-factor is already set up" }, { status: 409 });
  }
  return NextResponse.json({
    manualKey: res.manualKey,
    otpauthUri: res.otpauthUri,
    qrDataUrl: res.qrDataUrl,
  });
}
