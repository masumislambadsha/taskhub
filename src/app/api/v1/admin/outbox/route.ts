import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { connectDB } from "@/lib/db";
import Outbox from "@/models/Outbox";

const STATUSES = ["pending", "sent", "failed"];

/**
 * Queued notifications, emails and webhooks. Failed ones come first by default,
 * since those need a person. Admin only: the payloads hold email addresses.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(await auth(), "write");
  if (!guard.ok) return guard.response;
  await connectDB();

  const params = new URL(req.url).searchParams;
  const status = params.get("status");
  const filter = status && STATUSES.includes(status) ? { status } : { status: { $in: ["failed", "pending"] } };
  const [rows, counts] = await Promise.all([
    Outbox.find(filter).sort("status -createdAt").limit(100).lean(),
    Outbox.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  return NextResponse.json({
    rows,
    counts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
  });
}
