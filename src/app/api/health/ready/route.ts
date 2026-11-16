import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import {
  checkRedis,
  getUptimeSeconds,
  getVersion,
  checkMongo,
} from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Readiness: checks MongoDB (up to 5 seconds to connect, 1 second to ping) and,
// when REDIS_URL is set, Redis (1 second).
// Responses never include error messages or stack traces.
export async function GET() {
  const [mongo, redis] = await Promise.all([
    checkMongo(
      () => connectDB(),
      () => mongoose.connection.db!.admin().ping(),
    ),
    checkRedis(),
  ]);

  const redisOk = "skipped" in redis || redis.ok;
  const ok = mongo.ok && redisOk;

  return NextResponse.json(
    {
      status: ok ? "ok" : "error",
      version: getVersion(),
      uptimeSeconds: getUptimeSeconds(),
      checks: { mongo, redis },
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
