import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireAdmin } from "@/lib/admin-guard";
import { resetMfa } from "@/lib/mfa";
import { auditContextFrom, recordAudit } from "@/lib/audit";

/**
 * Lost phone: an admin who has verified and just stepped up can clear another
 * admin's second factor. That admin must set it up again at their next login.
 * Nobody can reset their own (the fix for the only admin is the
 * `npm run mfa:reset` script on the server). Always audit-logged.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const guard = await requireAdmin(session, "write", { stepUp: true });
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (id === guard.userId) {
    return NextResponse.json({ error: "Ask another admin to reset your two-factor" }, { status: 400 });
  }
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await connectDB();
  const target = await User.findById(id).select("role email").lean();
  if (!target || target.role !== "admin") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const removed = await resetMfa(id);
  if (!removed) {
    return NextResponse.json({ error: "That admin has no two-factor set up" }, { status: 404 });
  }
  await recordAudit(auditContextFrom(req, guard), {
    action: "mfa.reset",
    targetType: "user",
    targetId: id,
    before: { mfa: "enabled" },
    after: { mfa: "reset" },
  });
  return NextResponse.json({ ok: true });
}
