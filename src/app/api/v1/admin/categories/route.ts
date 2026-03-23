import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Category from "@/models/Category";
import Task from "@/models/Task";
import { TASK_CATEGORIES } from "@/lib/constants";

async function seedDefaultCategories() {
  const count = await Category.countDocuments();
  if (count === 0) {
    const icons: Record<string, string> = {
      "Social Media": "share",
      "Video & Audio": "videocam",
      "Writing & Reviews": "edit_note",
      "App Testing": "bug_report",
      Research: "search",
      "Data Entry": "table_rows",
      Other: "category",
    };
    await Category.insertMany(
      TASK_CATEGORIES.map((name) => ({
        name,
        icon: icons[name] ?? "category",
      })),
    );
  }
}

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  await seedDefaultCategories();
  const [categories, taskStats] = await Promise.all([
    Category.find().sort("name").lean(),
    Task.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          open: { $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] } },
        },
      },
    ]),
  ]);
  return NextResponse.json({ categories, taskStats });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const { name, icon } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const existing = await Category.findOne({ name: name.trim() });
  if (existing) {
    return NextResponse.json(
      { error: "Category already exists" },
      { status: 409 },
    );
  }
  const category = await Category.create({
    name: name.trim(),
    icon: icon ?? "category",
  });
  return NextResponse.json({ category }, { status: 201 });
}
