import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isParticipant, parseConversationId } from "@/lib/conversation";
import Message from "@/models/Message";

interface Props {
  params: Promise<{ conversationId: string }>;
}


export async function GET(_req: Request, { params }: Props) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;
  if (!parseConversationId(conversationId)) {
    return NextResponse.json(
      { error: "Invalid conversation ID" },
      { status: 400 },
    );
  }

  const userId = session.user.id;
  if (!isParticipant(conversationId, userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();

  // Loading the history does not mark it read: the open, visible chat tells the
  // realtime server how far it has read (conversation:read), which also lets the
  // sender see blue ticks only when the message was actually seen.
  const messages = await Message.find({ conversationId })
    .sort("createdAt")
    .lean();

  return NextResponse.json(messages);
}
