import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/roles";
import { connectDB } from "@/lib/db";
import Task from "@/models/Task";
import { maskEmailFields } from "@/lib/privacy";

export async function GET(req: NextRequest) {
  const session = await auth();
  const guard = requireAdmin(session, "read");
  if (!guard.ok) return guard.response;

  await connectDB();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 15;
  const status = searchParams.get("status");

  const query: Record<string, unknown> = {};
  if (status) query.status = status;

  const [tasks, total] = await Promise.all([
    Task.find(query)
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Task.countDocuments(query),
  ]);

  return NextResponse.json({
    tasks: maskEmailFields(tasks, ["buyerEmail"], guard.viewer),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const guard = requireAdmin(session, "write");
  if (!guard.ok) return guard.response;

  await connectDB();
  const { id, status } = await req.json();
  const task = await Task.findByIdAndUpdate(id, { status }, { new: true });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(task);
}
