import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { connectDB } from "@/lib/db";
import { disputeContext } from "@/lib/dispute-context";

/** One dispute with the task, the proof, both statements and both users' history. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(await auth(), "read");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await connectDB();
  const context = await disputeContext(id);
  if (!context) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(context);
}
