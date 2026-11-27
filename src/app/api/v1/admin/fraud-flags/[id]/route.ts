import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { connectDB } from "@/lib/db";
import { auditContextFrom, recordAudit } from "@/lib/audit";
import FraudFlag from "@/models/FraudFlag";

/**
 * Reviews a flag: dismiss it (it never fires again for that pair, because flags
 * are unique per pair) or confirm it. A flag can only leave "open" once, and the
 * decision and its audit entry are written together.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(await auth(), "write");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (status !== "dismissed" && status !== "confirmed") {
    return NextResponse.json({ error: "status must be dismissed or confirmed" }, { status: 400 });
  }
  await connectDB();

  const ctx = auditContextFrom(req, { userId: guard.userId, role: guard.role });
  const session = await mongoose.startSession();
  try {
    let done = false;
    await session.withTransaction(async () => {
      const res = await FraudFlag.findOneAndUpdate(
        { _id: id, status: "open" },
        { $set: { status, reviewedBy: guard.userId, reviewedAt: new Date() } },
        { session, returnDocument: "after" },
      );
      done = Boolean(res);
      if (res) {
        await recordAudit(ctx, { action: `fraud_flag.${status}`, targetType: "fraud_flag", targetId: id, after: { status, type: res.type } }, session);
      }
    });
    if (!done) return NextResponse.json({ error: "Not found or already reviewed" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } finally {
    await session.endSession();
  }
}
