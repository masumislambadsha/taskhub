import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, image } = await req.json();
  if (!name?.trim())
    return NextResponse.json({ error: "Name is required" }, { status: 400 });

  await connectDB();
  await User.findByIdAndUpdate(session.user.id, {
    ...(name && { name: name.trim() }),
    ...(image && { photoUrl: image }),
  });

  return NextResponse.json({ ok: true });
}
