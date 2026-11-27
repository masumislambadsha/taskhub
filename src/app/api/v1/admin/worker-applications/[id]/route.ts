import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { connectDB } from "@/lib/db";
import { signDocumentUrl } from "@/lib/worker-verification";
import WorkerApplication from "@/models/WorkerApplication";
import User from "@/models/User";

/** One application with the form answers and short-lived signed links to the documents (valid 5 minutes, for this admin only). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(await auth(), "write");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await connectDB();
  const app = await WorkerApplication.findById(id).lean();
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await User.findById(app.userId).select("name email createdAt").lean();
  return NextResponse.json({
    _id: app._id,
    status: app.status,
    attempts: app.attempts,
    submittedAt: app.submittedAt,
    user: { name: user?.name, email: user?.email, createdAt: user?.createdAt },
    profile: app.profile ?? null,
    payout: app.payout ?? null,
    skillsNote: app.skillsNote ?? null,
    idDocumentUrl: app.idDocumentId ? signDocumentUrl(String(app.idDocumentId), guard.userId) : null,
    selfieUrl: app.selfieId ? signDocumentUrl(String(app.selfieId), guard.userId) : null,
    // Filled in by the AI pre-review when it exists (not built yet).
    aiSummary: null,
  });
}
