import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { replayPaymentEvent } from "@/lib/payments/events";
import { auditContextFrom, recordAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { withRequestLogging } from "@/lib/with-request-logging";

export const POST = withRequestLogging(
  "/api/v1/admin/payment-events/[id]/replay",
  async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) {
    const guard = await requireAdmin(await auth(), "write", { stepUp: true });
    if (!guard.ok) return guard.response;

    const { id } = await params;
    if (!mongoose.isValidObjectId(id))
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    try {
      const replay = await replayPaymentEvent(id, guard.userId);
      if (!replay.found)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      // The replay talks to the payment provider, so it cannot share a database
      // transaction; its entry is written as soon as it finishes.
      await recordAudit(auditContextFrom(req, guard), {
        action: "payment.event_replay",
        targetType: "payment_event",
        targetId: id,
        after: { outcome: replay.result.outcome, ok: replay.result.ok },
      });
      return NextResponse.json(replay.result);
    } catch (err) {
      logger.error({ err, eventId: id }, "payment event replay failed");
      return NextResponse.json({ error: "Replay failed" }, { status: 502 });
    }
  },
);
