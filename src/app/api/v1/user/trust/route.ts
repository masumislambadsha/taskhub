import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { recomputeTrust } from "@/lib/trust-data";
import { LEVELS, explainTrust, levelName } from "@/lib/trust";
import User from "@/models/User";

/** The worker's own score, explained: components, level, history and what would move them up. */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "worker") return NextResponse.json({ error: "Only workers have a trust level" }, { status: 403 });
  await connectDB();

  // Fresh when the worker looks at it.
  const res = await recomputeTrust(session.user.id);
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await User.findById(session.user.id).select("trustHistory").lean();
  return NextResponse.json({
    score: res.result.score,
    level: res.result.level,
    levelName: levelName(res.result.level),
    components: res.result.components,
    capped: res.result.capped,
    explanation: explainTrust(res.result, res.input),
    levels: LEVELS,
    history: user?.trustHistory ?? [],
  });
}
