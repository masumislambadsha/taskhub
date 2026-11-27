import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { dailyCapFor, dhakaDayStart, dhakaNextMidnight } from "@/lib/earning-limits";
import { ensureTrustLevel } from "@/lib/trust-data";
import Submission from "@/models/Submission";

/** What the worker may still take today (earned or waiting for review counts), and when it resets. */
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "worker") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const now = new Date();
  const level = await ensureTrustLevel(session.user.id);
  const [row] = await Submission.aggregate<{ total: number }>([
    { $match: { workerId: new mongoose.Types.ObjectId(session.user.id), status: { $in: ["pending", "approved"] }, createdAt: { $gte: dhakaDayStart(now) } } },
    { $group: { _id: null, total: { $sum: "$payableAmount" } } },
  ]);
  const cap = dailyCapFor(level);
  const used = row?.total ?? 0;
  return NextResponse.json({ level, cap, used, remaining: Math.max(0, cap - used), resetsAt: dhakaNextMidnight(now) });
}
