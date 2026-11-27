import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getMfaState } from "@/lib/mfa";
import { requireMfaSubject } from "@/lib/mfa-route";

export async function GET() {
  const session = await auth();
  const subject = requireMfaSubject(session);
  if (!subject.ok) return subject.response;
  await connectDB();
  return NextResponse.json(await getMfaState(subject.userId, subject.sid));
}
