import { NextResponse } from "next/server";
import { getUptimeSeconds, getVersion } from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Liveness: returns 200 whenever the process is running. No database calls.
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      version: getVersion(),
      uptimeSeconds: getUptimeSeconds(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
