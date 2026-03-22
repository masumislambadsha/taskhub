import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Task from "@/models/Task";
import User from "@/models/User";
import { taskSchema } from "@/lib/validators/task";

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

export async function POST(req: NextRequest) {
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
  const { requiredWorkers, payableAmount } = parsed.data;
  const totalCost = requiredWorkers * payableAmount;

  const buyer = await User.findById(session.user.id);
  if (!buyer || buyer.coins < totalCost) {
    return NextResponse.json({ error: "Insufficient coins" }, { status: 400 });
  }

  buyer.coins -= totalCost;
  await buyer.save();

  const task = await Task.create({
    ...parsed.data,
    buyerId: session.user.id,
    buyerName: session.user.name || "Unknown",
    buyerEmail: session.user.email || "",
    filledWorkers: 0,
  });

  return NextResponse.json(task, { status: 201 });
}
