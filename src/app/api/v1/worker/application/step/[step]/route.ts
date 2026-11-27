import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { saveStep } from "@/lib/worker-verification";

/** Saves one step of the form (profile, payout or skills) on its own. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ step: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "worker") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { step } = await params;
  if (step !== "profile" && step !== "payout" && step !== "skills") return NextResponse.json({ error: "Not found" }, { status: 404 });
  await connectDB();
  const res = await saveStep(session.user.id, step, await req.json().catch(() => null));
  if (res.ok) return NextResponse.json({ ok: true });
  if (res.reason === "not_editable") return NextResponse.json({ error: "Your application cannot be edited right now." }, { status: 409 });
  return NextResponse.json({ error: "Please check the form.", issues: res.issues }, { status: 400 });
}
