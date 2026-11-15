"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { IMessage } from "@/types";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  "https://task-hub-io.vercel.app" ||
  "http://localhost:3001";

let socketInstance: Socket | null = null;
// ID of the user the current socket belongs to, so we reconnect when it changes.
let socketUserId: string | null = null;

function getSocket(userId: string): Socket {
  if (socketInstance && socketUserId !== userId) {
    socketInstance.disconnect();
    socketInstance = null;
  }
  // `active` is true while connecting or reconnecting. Fetching the token makes
  // connecting slower, so only replace a socket that has given up (for example
  // after the server rejected its token).
  if (!socketInstance || !socketInstance.active) {
    socketInstance?.disconnect();
    socketUserId = userId;
    socketInstance = io(SOCKET_URL, {
      // A function, so every connect and reconnect fetches a fresh short-lived
      // token. The server takes the user's identity from the token only.
      auth: (cb) => {
        fetch("/api/v1/socket-token", { credentials: "include" })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => cb({ token: d?.token }))
          .catch(() => cb({}));
      },
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

    const socket = getSocket(session.user.id);
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
      senderPhoto?: string;
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
