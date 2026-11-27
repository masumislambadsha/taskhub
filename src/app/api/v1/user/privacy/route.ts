import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { refuseDemoAdmin } from "@/lib/roles";
import User from "@/models/User";

/** Privacy settings for chat: whether other people can see when you were last online. */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const user = await User.findById(session.user.id).select("hideLastSeen").lean();
  return NextResponse.json({ hideLastSeen: Boolean(user?.hideLastSeen) });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const refused = refuseDemoAdmin(session);
  if (refused) return refused;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.hideLastSeen !== "boolean") {
    return NextResponse.json({ error: "hideLastSeen must be true or false" }, { status: 400 });
  }
  await connectDB();
  await User.findByIdAndUpdate(session.user.id, { hideLastSeen: body.hideLastSeen });
  return NextResponse.json({ hideLastSeen: body.hideLastSeen });
}
