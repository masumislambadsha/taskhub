import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Task from "@/models/Task";
import User from "@/models/User";
import { taskSchema } from "@/lib/validators/task";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connectDB();
  const { id } = await params;
  const task = await Task.findById(id).lean();
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(task);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session || session.user.role !== "buyer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const { id } = await params;
  const task = await Task.findOne({ _id: id, buyerId: session.user.id });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = taskSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  Object.assign(task, parsed.data);
  await task.save();
  return NextResponse.json(task);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session || session.user.role !== "buyer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const { id } = await params;
  const task = await Task.findOne({
    _id: id,
    buyerId: session.user.id,
    status: "open",
  });
  if (!task)
    return NextResponse.json(
      { error: "Not found or not deletable" },
      { status: 404 },
    );

  const remaining = task.requiredWorkers - task.filledWorkers;
  const refund = remaining * task.payableAmount;
  if (refund > 0) {
    await User.findByIdAndUpdate(session.user.id, { $inc: { coins: refund } });
  }

  task.status = "archived";
  await task.save();
  return NextResponse.json({ ok: true });
}
