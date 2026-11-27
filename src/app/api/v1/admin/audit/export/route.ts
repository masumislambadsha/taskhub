import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { connectDB } from "@/lib/db";
import AuditLog from "@/models/AuditLog";
import { auditFilter } from "@/lib/audit-query";
import { toCsv } from "@/lib/csv";

const MAX_ROWS = 10_000;

/** Admin only. Exports the entries matching the same filters as the list, newest first, up to 10,000. */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(await auth(), "write");
  if (!guard.ok) return guard.response;

  await connectDB();
  const entries = await AuditLog.find(auditFilter(new URL(req.url).searchParams))
    .sort("-createdAt")
    .limit(MAX_ROWS)
    .lean();

  const csv = toCsv(entries, [
    { header: "time", value: (e) => e.createdAt },
    { header: "actor", value: (e) => e.actorId },
    { header: "role", value: (e) => e.actorRole },
    { header: "action", value: (e) => e.action },
    { header: "target_type", value: (e) => e.targetType },
    { header: "target_id", value: (e) => e.targetId },
    { header: "before", value: (e) => e.before },
    { header: "after", value: (e) => e.after },
    { header: "reason", value: (e) => e.reason },
    { header: "ip", value: (e) => e.ip },
    { header: "request_id", value: (e) => e.requestId },
  ]);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="audit-log.csv"',
    },
  });
}
