import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 15;
  const role = searchParams.get("role");
  const status = searchParams.get("status");

  const query: Record<string, unknown> = {};
  if (role) query.role = role;
  if (status) query.status = status;

  const [users, total] = await Promise.all([
    User.find(query)
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-passwordHash")
      .lean(),
    User.countDocuments(query),
  ]);

  return NextResponse.json({
    users,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
