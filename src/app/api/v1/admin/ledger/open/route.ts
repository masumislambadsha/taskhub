import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/roles";
import { connectDB } from "@/lib/db";
import { openAll } from "@/lib/ledger/open-all";
import { withRequestLogging } from "@/lib/with-request-logging";
import { auditContextFrom, recordAudit } from "@/lib/audit";

/**
 * Admin only (a demo admin gets 403). Opens every user and active task in the coin ledger. A dry run by
 * default (counts only); pass `?apply=1` to write. Optional `?limit=N` stops
 * after N accounts, so a large database can be opened over several calls.
 * Idempotent.
 */
export const POST = withRequestLogging(
  "/api/v1/admin/ledger/open",
  async function POST(req: NextRequest) {
    const session = await auth();
    const guard = requireAdmin(session, "write");
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const apply = searchParams.get("apply") === "1";
    const limitParam = searchParams.get("limit");
    const limit = limitParam === null ? undefined : Number(limitParam);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
      return NextResponse.json({ error: "limit must be a positive integer" }, { status: 400 });
    }

    await connectDB();
    const report = await openAll({ dryRun: !apply, limit });
    // A dry run changes nothing, so only a real run is logged.
    if (apply) {
      await recordAudit(auditContextFrom(req, guard), {
        action: "ledger.open",
        targetType: "ledger",
        targetId: "all",
        after: { limit: limit ?? null, report: JSON.parse(JSON.stringify(report)) },
      });
    }
    return NextResponse.json(report);
  },
);
