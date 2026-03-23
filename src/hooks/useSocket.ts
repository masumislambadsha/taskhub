"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { IMessage } from "@/types";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

let socketInstance: Socket | null = null;

function getSocket(userId: string, userName: string): Socket {
  // Reconnect if disconnected or user changed
  if (socketInstance && socketInstance.auth) {
    const auth = socketInstance.auth as { userId?: string };
    if (auth.userId !== userId) {
      socketInstance.disconnect();
      socketInstance = null;
    }
  }
  if (!socketInstance || !socketInstance.connected) {
    socketInstance = io(SOCKET_URL, {
      auth: { userId, userName },
      transports: ["websocket"],
      autoConnect: true,
    });
  }
  return socketInstance;
}

interface UseSocketOptions {
  conversationId?: string;
  onMessage?: (msg: IMessage) => void;
  onTypingStart?: (data: { userId: string; name: string }) => void;
  onTypingStop?: (data: { userId: string }) => void;
  onMessagesRead?: (data: { userId: string }) => void;
}

export function useSocket({
  conversationId,
  onMessage,
  onTypingStart,
  onTypingStop,
  onMessagesRead,
}: UseSocketOptions = {}) {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    const socket = getSocket(session.user.id, session.user.name ?? "Unknown");
    socketRef.current = socket;

    if (conversationId) {
      socket.emit("join:conversation", conversationId);
    }

    if (onMessage) socket.on("message:receive", onMessage);
    if (onTypingStart) socket.on("typing:start", onTypingStart);
    if (onTypingStop) socket.on("typing:stop", onTypingStop);
    if (onMessagesRead) socket.on("messages:read", onMessagesRead);

    return () => {
      if (conversationId) socket.emit("leave:conversation", conversationId);
      if (onMessage) socket.off("message:receive", onMessage);
      if (onTypingStart) socket.off("typing:start", onTypingStart);
      if (onTypingStop) socket.off("typing:stop", onTypingStop);
      if (onMessagesRead) socket.off("messages:read", onMessagesRead);
    };
  }, [
    session,
    conversationId,
    onMessage,
    onTypingStart,
    onTypingStop,
    onMessagesRead,
  ]);

  const sendMessage = useCallback(
    (data: {
      conversationId: string;
      taskId: string;
      receiverId: string;
      receiverName: string;
      content: string;
    }) => {
      socketRef.current?.emit("message:send", data);
    },
    [],
  );

  const sendTypingStart = useCallback((convId: string) => {
    socketRef.current?.emit("typing:start", { conversationId: convId });
  }, []);

  const sendTypingStop = useCallback((convId: string) => {
    socketRef.current?.emit("typing:stop", { conversationId: convId });
  }, []);

  const markRead = useCallback((convId: string) => {
    socketRef.current?.emit("messages:read", { conversationId: convId });
  }, []);

  return { sendMessage, sendTypingStart, sendTypingStop, markRead };
}
