import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { submitApplication } from "@/lib/worker-verification";

/** Sends the finished application for review (status becomes pending). A rejected worker may apply again, up to 3 times. */
export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== "worker") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const res = await submitApplication(session.user.id);
  if (res.ok) return NextResponse.json({ ok: true });
  if (res.reason === "incomplete") return NextResponse.json({ error: `Still missing: ${res.missing?.join(", ")}.`, missing: res.missing }, { status: 400 });
  if (res.reason === "too_many_attempts") return NextResponse.json({ error: "You have used all 3 attempts. Contact support." }, { status: 403 });
  return NextResponse.json({ error: "Your application cannot be submitted right now." }, { status: 409 });
}
