import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Task from "@/models/Task";
import TaskView from "@/models/TaskView";

/**
 * A worker opened the task. Records the first time only (the minimum time on
 * task counts from then), so reopening or refreshing never restarts the clock.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "worker") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await connectDB();
  if (!(await Task.exists({ _id: id }))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await TaskView.updateOne(
    { taskId: id, workerId: session.user.id },
    { $setOnInsert: { viewedAt: new Date() } },
    { upsert: true },
  );
  return NextResponse.json({ ok: true });
}
