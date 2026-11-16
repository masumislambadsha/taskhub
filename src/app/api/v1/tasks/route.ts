import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Task from "@/models/Task";
import { createFundedTask } from "@/lib/ledger/flows/tasks";
import { taskSchema } from "@/lib/validators/task";
import { withRequestLogging } from "@/lib/with-request-logging";

export async function GET(req: NextRequest) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "12");
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const minPayout = parseInt(searchParams.get("minPayout") || "0");
  const sort = searchParams.get("sort") || "-createdAt";

  const buyerOnly = searchParams.get("buyerOnly");
  const session = await auth();

  const query: Record<string, unknown> = {};
  if (buyerOnly && session) {
    query.buyerId = session.user.id;
  } else {
    query.status = "open";
  }
  if (search) query.title = { $regex: search, $options: "i" };
  if (category) query.category = category;
  if (minPayout > 0) query.payableAmount = { $gte: minPayout };

  const [tasks, total] = await Promise.all([
    Task.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Task.countDocuments(query),
  ]);

  return NextResponse.json({
    tasks,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export const POST = withRequestLogging("/api/v1/tasks", async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "buyer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = taskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await connectDB();
  const created = await createFundedTask({
    buyerId: session.user.id,
    buyerName: session.user.name || "Unknown",
    buyerEmail: session.user.email || "",
    data: parsed.data,
  });
  if (!created.ok) {
    return NextResponse.json({ error: "Insufficient coins" }, { status: 400 });
  }
  const task = created.task;

  return NextResponse.json(task, { status: 201 });
});
