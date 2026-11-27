import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { connectDB } from "@/lib/db";
import { pendingQueue } from "@/lib/worker-verification";
import User from "@/models/User";

/**
 * Worker applications waiting for review, longest waiting first. Needs a full admin:
 * the read-only demo admin is refused, because applications hold personal data.
 */
export async function GET() {
  const guard = await requireAdmin(await auth(), "write");
  if (!guard.ok) return guard.response;
  await connectDB();
  const apps = await pendingQueue();
  const users = await User.find({ _id: { $in: apps.map((a) => a.userId) } }).select("name email createdAt").lean();
  const by = new Map(users.map((u) => [String(u._id), u]));
  return NextResponse.json({
    applications: apps.map((a) => ({
      _id: a._id,
      attempts: a.attempts,
      submittedAt: a.submittedAt,
      waitingHours: a.submittedAt ? Math.floor((Date.now() - a.submittedAt.getTime()) / 3_600_000) : 0,
      user: { name: by.get(String(a.userId))?.name, email: by.get(String(a.userId))?.email },
    })),
  });
}
