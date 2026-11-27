import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/roles";
import { replayPaymentEvent } from "@/lib/payments/events";
import { logger } from "@/lib/logger";
import { withRequestLogging } from "@/lib/with-request-logging";

export const POST = withRequestLogging(
  "/api/v1/admin/payment-events/[id]/replay",
  async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) {
    const guard = requireAdmin(await auth(), "write");
    if (!guard.ok) return guard.response;

    const { id } = await params;
    if (!mongoose.isValidObjectId(id))
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    try {
      const replay = await replayPaymentEvent(id, guard.userId);
      if (!replay.found)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(replay.result);
    } catch (err) {
      logger.error({ err, eventId: id }, "payment event replay failed");
      return NextResponse.json({ error: "Replay failed" }, { status: 502 });
    }
  },
);
