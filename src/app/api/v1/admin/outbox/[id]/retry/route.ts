import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { connectDB } from "@/lib/db";
import { auditContextFrom, recordAudit } from "@/lib/audit";
import { drainOutboxQuietly, retryOutboxRow } from "@/lib/outbox";
import { withRequestLogging } from "@/lib/with-request-logging";

/** Puts a failed row back in the queue with a fresh set of attempts, and tries it now. Audit-logged. */
export const POST = withRequestLogging(
  "/api/v1/admin/outbox/[id]/retry",
  async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireAdmin(await auth(), "write");
    if (!guard.ok) return guard.response;
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await connectDB();
    if (!(await retryOutboxRow(id))) {
      return NextResponse.json({ error: "Not found, or not failed" }, { status: 404 });
    }
    await recordAudit(auditContextFrom(req, guard), {
      action: "outbox.retry",
      targetType: "outbox",
      targetId: id,
    });
    await drainOutboxQuietly();
    return NextResponse.json({ ok: true });
  },
);
