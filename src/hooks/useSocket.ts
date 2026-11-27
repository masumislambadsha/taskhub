"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { IMessage, PresenceState } from "@/types";

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
  /** Our messages reached the other person's device (grey ticks). */
  onDelivered?: (data: { conversationId: string; messageIds: string[]; deliveredAt: string }) => void;
  /** The other person read up to this message (blue ticks). */
  onRead?: (data: { conversationId: string; userId: string; upToMessageId: string; readAt: string }) => void;
  /** Someone we share a conversation with came online or went offline. */
  onPresence?: (data: PresenceState) => void;
  /** A notification was pushed to this user (the worker or the web app queued it). */
  onNotification?: () => void;
  /**
   * The socket lost its connection and is back (for example the realtime
   * instance restarted and Nginx sent us to the other one). Messages sent in
   * between were not delivered live, so fetch them over REST here.
   */
  onReconnect?: () => void;
}

export type ConnectionState = "connecting" | "connected" | "reconnecting";

export function useSocket({
  conversationId,
  onMessage,
  onTypingStart,
  onTypingStop,
  onDelivered,
  onRead,
  onPresence,
  onNotification,
  onReconnect,
}: UseSocketOptions = {}) {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  // Kept in a ref so a new callback each render does not tear down the listeners.
  const onReconnectRef = useRef(onReconnect);
  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    if (!session?.user?.id) return;

    const socket = getSocket(session.user.id);
    socketRef.current = socket;

    if (conversationId) {
      socket.emit("join:conversation", conversationId);
    }

    // Every message that reaches this device is acknowledged, so the sender sees
    // two grey ticks. The server only accepts it from the message's recipient.
    const ackDelivered = (msg: IMessage) => {
      if (msg.receiverId === session.user.id) socket.emit("message:delivered", { messageId: msg._id });
    };
    socket.on("message:receive", ackDelivered);
    if (onMessage) socket.on("message:receive", onMessage);
    if (onTypingStart) socket.on("typing:start", onTypingStart);
    if (onTypingStop) socket.on("typing:stop", onTypingStop);
    if (onDelivered) socket.on("message:delivered", onDelivered);
    if (onRead) socket.on("conversation:read", onRead);
    if (onPresence) socket.on("presence:update", onPresence);
    if (onNotification) socket.on("notification:new", onNotification);

    // Track the connection so the page can say "Reconnecting…", and catch up
    // after a reconnect (anything missed while away comes from the server over REST).
    let wasDisconnected = false;
    // Not set synchronously in the effect: the socket may already be connected.
    queueMicrotask(() => setConnection(socket.connected ? "connected" : "connecting"));
    const handleConnect = () => {
      setConnection("connected");
      if (conversationId) socket.emit("join:conversation", conversationId);
      if (wasDisconnected) {
        wasDisconnected = false;
        onReconnectRef.current?.();
      }
    };
    const handleDisconnect = () => {
      wasDisconnected = true;
      setConnection("reconnecting");
    };
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleDisconnect);
      if (onNotification) socket.off("notification:new", onNotification);
      if (conversationId) socket.emit("leave:conversation", conversationId);
      socket.off("message:receive", ackDelivered);
      if (onMessage) socket.off("message:receive", onMessage);
      if (onTypingStart) socket.off("typing:start", onTypingStart);
      if (onTypingStop) socket.off("typing:stop", onTypingStop);
      if (onDelivered) socket.off("message:delivered", onDelivered);
      if (onRead) socket.off("conversation:read", onRead);
      if (onPresence) socket.off("presence:update", onPresence);
    };
  }, [
    session,
    conversationId,
    onMessage,
    onTypingStart,
    onTypingStop,
    onDelivered,
    onRead,
    onPresence,
    onNotification,
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

  /** The chat is open and visible: everything up to this message is read. */
  const markRead = useCallback((convId: string, upToMessageId?: string) => {
    socketRef.current?.emit("conversation:read", { conversationId: convId, upToMessageId });
  }, []);

  /** Online status of people we share a conversation with. */
  const getPresence = useCallback(
    (userIds: string[]) =>
      new Promise<Record<string, PresenceState>>((resolve) => {
        const socket = socketRef.current;
        if (!socket || userIds.length === 0) return resolve({});
        socket.timeout(4000).emit("presence:get", { userIds }, (err: Error | null, res?: { ok: boolean; states?: Record<string, PresenceState> }) => {
          resolve(!err && res?.ok ? (res.states ?? {}) : {});
        });
      }),
    [],
  );

  return { sendMessage, sendTypingStart, sendTypingStop, markRead, getPresence, connection };
}
