import { useEffect, useRef, useCallback } from "react";
import { connectSocket, disconnectSocket, getSocket } from "../lib/socket";

export function useSocket(userId: string | undefined, userName: string | undefined) {
  const socketRef = useRef(getSocket());

  useEffect(() => {
    if (!userId || !userName) return;

    const socket = connectSocket(userId, userName);
    socketRef.current = socket;

    return () => {
      disconnectSocket();
    };
  }, [userId, userName]);

  const sendMessage = useCallback((data: {
    conversationId: string;
    receiverId: string;
    content: string;
    taskId: string;
    senderName: string;
  }) => {
    socketRef.current?.emit("message:send", data);
  }, []);

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit("join:conversation", conversationId);
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit("leave:conversation", conversationId);
  }, []);

  const sendTypingStart = useCallback((conversationId: string) => {
    socketRef.current?.emit("typing:start", conversationId);
  }, []);

  const sendTypingStop = useCallback((conversationId: string) => {
    socketRef.current?.emit("typing:stop", conversationId);
  }, []);

  const markRead = useCallback((conversationId: string) => {
    socketRef.current?.emit("messages:read", conversationId);
  }, []);

  return {
    socket: socketRef.current,
    sendMessage,
    joinConversation,
    leaveConversation,
    sendTypingStart,
    sendTypingStop,
    markRead,
  };
}
