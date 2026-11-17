import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Task from "@/models/Task";
import { deleteFundedTask, updateFundedTask } from "@/lib/ledger/flows/tasks";
import { redactEmailFields } from "@/lib/privacy";
import { taskSchema } from "@/lib/validators/task";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connectDB();
  const { id } = await params;
  if (!mongoose.isValidObjectId(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const task = await Task.findById(id).lean();
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const session = await auth();
  const [safe] = redactEmailFields([task], ["buyerEmail"], session?.user, "buyerId");
  return NextResponse.json(safe);
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
  if (!mongoose.isValidObjectId(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = taskSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  const result = await updateFundedTask({
    taskId: id,
    buyerId: session.user.id,
    data: parsed.data,
  });
  if (!result.ok) {
    if (result.reason === "insufficient_coins")
      return NextResponse.json({ error: "Insufficient coins" }, { status: 400 });
    if (result.reason === "escrow_insufficient")
      return NextResponse.json(
        { error: "Task escrow is out of balance; contact support" },
        { status: 409 },
      );
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(result.task);
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
  if (!mongoose.isValidObjectId(id))
    return NextResponse.json(
      { error: "Not found or not deletable" },
      { status: 404 },
    );
  const result = await deleteFundedTask({ taskId: id, buyerId: session.user.id });
  if (!result.ok)
    return NextResponse.json(
      { error: "Not found or not deletable" },
      { status: 404 },
    );
  return NextResponse.json({ ok: true });
}
