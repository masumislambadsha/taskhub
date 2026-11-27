import { NextRequest, NextResponse } from "next/server";
import { metrics, metricsAuthorized } from "@/lib/metrics";

export const dynamic = "force-dynamic";

/**
 * Prometheus scrape endpoint. Off unless METRICS_TOKEN is set, needs it as a
 * Bearer token, and Nginx does not forward /api/metrics, so only Prometheus
 * (scraping the web containers directly on the internal network) can read it.
 */
export async function GET(req: NextRequest) {
  if (!process.env.METRICS_TOKEN) return new NextResponse("Not found", { status: 404 });
  if (!metricsAuthorized(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { registry } = metrics();
  return new NextResponse(await registry.metrics(), {
    headers: { "Content-Type": registry.contentType, "Cache-Control": "no-store" },
  });
}
