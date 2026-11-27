import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { connectDB } from "@/lib/db";
import { decideDispute } from "@/lib/ledger/flows/disputes";
import { auditContextFrom } from "@/lib/audit";
import { drainOutboxQuietly } from "@/lib/outbox";
import { withRequestLogging } from "@/lib/with-request-logging";

/**
 * Decides an appeal: `{ winner: "worker" | "buyer", note }`. Admin only, needs a
 * two-factor code from the last 15 minutes, and a note of at least 10
 * characters. Deciding twice is refused.
 */
export const POST = withRequestLogging(
  "/api/v1/admin/disputes/[id]/decide",
  async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireAdmin(await auth(), "write", { stepUp: true });
    if (!guard.ok) return guard.response;

    const body = (await req.json().catch(() => ({}))) as { winner?: unknown; note?: unknown };
    if ((body.winner !== "worker" && body.winner !== "buyer") || typeof body.note !== "string")
      return NextResponse.json({ error: "winner (worker or buyer) and note are required" }, { status: 400 });

    await connectDB();
    const res = await decideDispute({
      disputeId: (await params).id,
      winner: body.winner,
      note: body.note,
      adminId: guard.userId,
      audit: auditContextFrom(req, guard),
    });
    if (!res.ok) {
      const map = {
        not_found: ["Not found or already decided", 404],
        note_too_short: ["Write a note of at least 10 characters", 400],
        buyer_missing: ["The buyer's account no longer exists", 409],
        worker_missing: ["The worker's account no longer exists", 409],
      } as const;
      const [error, status] = map[res.reason];
      return NextResponse.json({ error }, { status });
    }

    // Both notices were queued with the decision; send them now.
    await drainOutboxQuietly();
    return NextResponse.json({ ok: true, winner: res.winner, outcome: res.outcome });
  },
);
