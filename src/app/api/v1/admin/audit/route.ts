import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/roles";
import { connectDB } from "@/lib/db";
import AuditLog from "@/models/AuditLog";
import { auditFilter } from "@/lib/audit-query";

/** Admin only. The log holds admin IP addresses, so the read-only demo admin does not get it. */
export async function GET(req: NextRequest) {
  const guard = requireAdmin(await auth(), "write");
  if (!guard.ok) return guard.response;

  await connectDB();
  const params = new URL(req.url).searchParams;
  const page = Math.max(1, parseInt(params.get("page") ?? "1") || 1);
  const limit = 25;
  const filter = auditFilter(params);

  const [entries, total] = await Promise.all([
    AuditLog.find(filter)
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return NextResponse.json({ entries, total, page, pages: Math.ceil(total / limit) });
}
