"use client";
import {
  MdArrowBack,
  MdChatBubbleOutline,
  MdForum,
  MdSend,
} from "react-icons/md";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import { formatDistanceToNow, format } from "date-fns";
import { IConversation, IMessage, PresenceState } from "@/types";
import { useSocket } from "@/hooks/useSocket";

interface MessagesUIProps {
  role: "buyer" | "worker";
  emptyHint: string;
  selectHint: string;
}

function Avatar({
  name,
  photo,
  size = 10,
}: {
  name: string;
  photo?: string | null;
  size?: number;
}) {
  const dim = `w-${size} h-${size}`;
  return (
    <div
      className={`${dim} rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm overflow-hidden`}
    >
      {photo ? (
        <img src={photo} alt={name} className="w-full h-full object-cover" />
      ) : (
        name[0]?.toUpperCase()
      )}
    </div>
  );
}

/** One tick sent, two grey ticks delivered, two blue ticks read. */
function Ticks({ state }: { state: "sent" | "delivered" | "read" }) {
  const label = { sent: "Sent", delivered: "Delivered", read: "Read" }[state];
  return (
    <span
      className={`ml-1 ${state === "read" ? "text-sky-500" : "text-primary/40"}`}
      title={label}
      aria-label={label}
    >
      {state === "sent" ? "✓" : "✓✓"}
    </span>
  );
}

function presenceLabel(p?: PresenceState): string | null {
  if (!p) return null;
  if (p.online) return "Online";
  return p.lastSeen ? `Last seen ${formatDistanceToNow(new Date(p.lastSeen), { addSuffix: true })}` : null;
}

const TYPING_SEND_EVERY_MS = 2000; // at most one typing:start per 2 seconds
const TYPING_HIDE_AFTER_MS = 3000; // hide the indicator if no update arrives
const READ_THROTTLE_MS = 1000; // at most one read update per second

function convFromSearchParams(
  searchParams: Pick<URLSearchParams, "get">,
): IConversation | null {
  const conv = searchParams.get("conv");
  const taskId = searchParams.get("taskId");
  const taskTitle = searchParams.get("taskTitle");
  const otherId = searchParams.get("otherId");
  const otherName = searchParams.get("otherName");
  if (!(conv && taskId && otherId && otherName)) return null;
  return {
    conversationId: conv,
    taskId,
    taskTitle: taskTitle ?? "Task",
    otherUserId: otherId,
    otherUserName: decodeURIComponent(otherName),
    lastMessage: "",
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0,
  };
}

export default function MessagesUI({
  role,
  emptyHint,
  selectHint,
}: MessagesUIProps) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const [selectedConv, setSelectedConv] = useState<IConversation | null>(() =>
    convFromSearchParams(searchParams),
  );
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  // Receipts and presence arriving live, on top of what the history already has.
  const [deliveredIds, setDeliveredIds] = useState<Set<string>>(() => new Set());
  const [readUpTo, setReadUpTo] = useState<string | null>(null);
  const [presence, setPresence] = useState<Record<string, PresenceState>>({});
  const [mobileView, setMobileView] = useState<"list" | "chat">(() =>
    convFromSearchParams(searchParams) ? "chat" : "list",
  );

  // When the URL changes to point at a conversation (?conv=...), open it.
  const [seenSearchParams, setSeenSearchParams] = useState(searchParams);
  if (seenSearchParams !== searchParams) {
    setSeenSearchParams(searchParams);
    const fromUrl = convFromSearchParams(searchParams);
    if (fromUrl) {
      setSelectedConv(fromUrl);
      setMobileView("chat");
    }
  }

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const lastReadSent = useRef({ at: 0, id: "" });
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: conversations = [] } = useQuery<IConversation[]>({
    queryKey: ["conversations"],
    queryFn: () => axios.get("/api/v1/messages").then((r) => r.data),
    refetchInterval: 15000,
  });

  const activeConv = selectedConv;
  const myId = session?.user?.id;

  // Privacy: other people always see when you are online, and see when you were
  // last online unless you turn that off here.
  const { data: privacy } = useQuery<{ hideLastSeen: boolean }>({
    queryKey: ["chat-privacy"],
    queryFn: () => axios.get("/api/v1/user/privacy").then((r) => r.data),
  });
  const togglePrivacy = useMutation({
    mutationFn: (hideLastSeen: boolean) =>
      axios.patch("/api/v1/user/privacy", { hideLastSeen }).then((r) => r.data),
    onSuccess: (data) => qc.setQueryData(["chat-privacy"], data),
  });

  const { data: fetchedMessages = [], refetch: refetchMessages } = useQuery<IMessage[]>({
    queryKey: ["messages", activeConv?.conversationId],
    queryFn: () =>
      axios
        .get(`/api/v1/messages/${activeConv!.conversationId}`)
        .then((r) => r.data),
    enabled: !!activeConv?.conversationId,
  });

  const allMessages = [
    ...fetchedMessages,
    ...messages.filter(
      (m) => !fetchedMessages.find((f: IMessage) => f._id === m._id),
    ),
  ];

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    if (activeConv?.conversationId) {
      scrollToBottom("auto");
    }
  }, [activeConv?.conversationId, scrollToBottom]);

  useEffect(() => {
    if (allMessages.length > 0) {
      scrollToBottom();
    }
  }, [allMessages.length, scrollToBottom]);

  const handleMessage = useCallback(
    (msg: IMessage) => {
      if (msg.conversationId === activeConv?.conversationId) {
        setMessages((prev) => {
          if (prev.find((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["messages", msg.conversationId] });
    },
    [activeConv?.conversationId, qc],
  );

  const handleTypingStart = useCallback(
    (data: { userId: string; name: string }) => {
      if (data.userId === session?.user?.id) return;
      setTypingUser(data.name);
      // The sender stops sending updates when they stop typing, so hide the
      // indicator ourselves if no further update arrives.
      if (typingHideTimer.current) clearTimeout(typingHideTimer.current);
      typingHideTimer.current = setTimeout(() => setTypingUser(null), TYPING_HIDE_AFTER_MS);
    },
    [session?.user?.id],
  );

  const handleTypingStop = useCallback(() => {
    if (typingHideTimer.current) clearTimeout(typingHideTimer.current);
    setTypingUser(null);
  }, []);

  const handleDelivered = useCallback((data: { conversationId: string; messageIds: string[] }) => {
    setDeliveredIds((prev) => {
      const next = new Set(prev);
      data.messageIds.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const handleRead = useCallback(
    (data: { conversationId: string; upToMessageId: string }) => {
      if (data.conversationId === activeConv?.conversationId) {
        setReadUpTo((prev) => (!prev || data.upToMessageId > prev ? data.upToMessageId : prev));
      }
    },
    [activeConv?.conversationId],
  );

  const handlePresence = useCallback((p: PresenceState) => {
    setPresence((prev) => ({ ...prev, [p.userId]: p }));
  }, []);

  // After the connection comes back, fetch what was sent while it was down.
  const otherId = activeConv?.otherUserId;
  const [reconnects, setReconnects] = useState(0);
  const handleReconnect = useCallback(() => {
    refetchMessages();
    qc.invalidateQueries({ queryKey: ["conversations"] });
    setReconnects((n) => n + 1); // presence is looked up again below
  }, [refetchMessages, qc]);

  const { sendMessage, sendTypingStart, sendTypingStop, markRead, getPresence, connection } = useSocket({
    conversationId: activeConv?.conversationId,
    onMessage: handleMessage,
    onTypingStart: handleTypingStart,
    onTypingStop: handleTypingStop,
    onDelivered: handleDelivered,
    onRead: handleRead,
    onPresence: handlePresence,
    onReconnect: handleReconnect,
  });

  // Opening a conversation (or coming back after a reconnect): who is online right now.
  useEffect(() => {
    if (!otherId || connection !== "connected") return;
    let cancelled = false;
    getPresence([otherId]).then((states) => {
      if (!cancelled) setPresence((prev) => ({ ...prev, ...states }));
    });
    return () => {
      cancelled = true;
    };
  }, [otherId, connection, reconnects, getPresence]);

  // The newest message sent to us in the open conversation.
  const latestIncomingId = [...allMessages].reverse().find((m) => m.senderId !== myId)?._id;

  // Mark messages read only while the chat is open and the tab is visible, and
  // at most once a second, even if many messages arrive.
  const conversationId = activeConv?.conversationId;
  useEffect(() => {
    if (!conversationId || !latestIncomingId) return;
    const send = () => {
      readTimer.current = null;
      if (document.visibilityState !== "visible") return;
      if (lastReadSent.current.id === latestIncomingId) return;
      lastReadSent.current = { at: Date.now(), id: latestIncomingId };
      markRead(conversationId, latestIncomingId);
      // The unread badge in the list updates once the server has the new position.
      setTimeout(() => qc.invalidateQueries({ queryKey: ["conversations"] }), 500);
    };
    const schedule = () => {
      if (readTimer.current) return;
      const wait = Math.max(0, READ_THROTTLE_MS - (Date.now() - lastReadSent.current.at));
      readTimer.current = setTimeout(send, wait);
    };
    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      document.removeEventListener("visibilitychange", schedule);
      if (readTimer.current) clearTimeout(readTimer.current);
      readTimer.current = null;
    };
  }, [conversationId, latestIncomingId, markRead, qc]);

  function openConv(conv: IConversation) {
    setSelectedConv(conv);
    setMessages([]);
    setReadUpTo(null);
    setDeliveredIds(new Set());
    lastReadSent.current = { at: 0, id: "" };
    setMobileView("chat");
  }

  function tickState(msg: IMessage): "sent" | "delivered" | "read" {
    if (msg.readAt || msg.isRead || (readUpTo && msg._id <= readUpTo)) return "read";
    if (msg.deliveredAt || deliveredIds.has(msg._id)) return "delivered";
    return "sent";
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value);
    if (!activeConv) return;
    // Typing starts are sent at most once every 2 seconds, not on every key.
    if (Date.now() - lastTypingSent.current >= TYPING_SEND_EVERY_MS) {
      lastTypingSent.current = Date.now();
      sendTypingStart(activeConv.conversationId);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(
      () => sendTypingStop(activeConv.conversationId),
      1500,
    );
  }

  function handleSend() {
    if (!input.trim() || !activeConv || !session?.user) return;
    sendMessage({
      conversationId: activeConv.conversationId,
      taskId: activeConv.taskId,
      receiverId: activeConv.otherUserId,
      receiverName: activeConv.otherUserName,
      content: input.trim(),
      senderPhoto: session.user.image ?? undefined,
    });
    setInput("");
    lastTypingSent.current = 0;
    sendTypingStop(activeConv.conversationId);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const myPhoto = session?.user?.image ?? undefined;


  const ConvList = (
    <aside className="flex flex-col h-full">
      <div className="p-4 border-b border-primary/5">
        <h2 className="font-headline text-lg font-bold text-primary">
          Messages
        </h2>
        <p className="text-xs text-primary/40 mt-0.5">
          {role === "buyer"
            ? "Worker conversations"
            : "Task-related conversations"}
        </p>
        <label className="mt-2 flex items-center gap-2 text-[11px] text-primary/50 cursor-pointer">
          <input
            type="checkbox"
            checked={privacy?.hideLastSeen ?? false}
            disabled={!privacy || togglePrivacy.isPending}
            onChange={(e) => togglePrivacy.mutate(e.target.checked)}
          />
          Hide my last seen
        </label>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <MdChatBubbleOutline className="text-primary/20 text-4xl block mb-2" />
            <p className="text-sm text-primary/40">No conversations yet</p>
            <p className="text-xs text-primary/30 mt-1">{emptyHint}</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.conversationId}
              onClick={() => openConv(conv)}
              className={`w-full text-left px-4 py-4 border-b border-primary/5 hover:bg-background transition-colors ${
                activeConv?.conversationId === conv.conversationId
                  ? "bg-secondary/5 border-l-2 border-l-secondary"
                  : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <Avatar
                  name={conv.otherUserName}
                  photo={conv.otherUserPhoto}
                  size={10}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-semibold text-sm text-primary truncate">
                      {conv.otherUserName}
                    </span>
                    <span className="text-[10px] text-primary/30 shrink-0">
                      {conv.lastMessageAt
                        ? formatDistanceToNow(new Date(conv.lastMessageAt), {
                            addSuffix: true,
                          })
                        : ""}
                    </span>
                  </div>
                  <p className="text-xs text-secondary font-medium truncate mt-0.5">
                    {conv.taskTitle}
                  </p>
                  <p className="text-xs text-primary/50 truncate mt-0.5">
                    {conv.lastMessage}
                  </p>
                </div>
                {conv.unreadCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-secondary text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );


  const ChatPanel = activeConv ? (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="h-14 sm:h-16 px-4 sm:px-6 border-b border-primary/5 flex items-center gap-3 shrink-0">
        <button
          className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-primary/5 text-primary transition-colors"
          onClick={() => setMobileView("list")}
        >
          <MdArrowBack className="text-xl" />
        </button>
        <Avatar
          name={activeConv.otherUserName}
          photo={activeConv.otherUserPhoto}
          size={9}
        />
        <div className="min-w-0">
          <p className="font-semibold text-sm text-primary truncate">
            {activeConv.otherUserName}
          </p>
          <p className="text-xs text-secondary truncate max-w-[200px]">
            {activeConv.taskTitle}
          </p>
          {presenceLabel(presence[activeConv.otherUserId]) && (
            <p
              className={`text-[11px] truncate ${presence[activeConv.otherUserId]?.online ? "text-emerald-600 font-medium" : "text-primary/40"}`}
            >
              {presenceLabel(presence[activeConv.otherUserId])}
            </p>
          )}
        </div>
      </div>

      {connection === "reconnecting" && (
        <div
          role="status"
          className="bg-amber-50 text-amber-800 text-xs font-medium px-4 py-1.5 border-b border-amber-200"
        >
          Reconnecting… messages sent in the meantime will appear when you are back.
        </div>
      )}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4"
        onWheel={(e) => {
          e.stopPropagation();
          e.currentTarget.scrollTop += e.deltaY;
        }}
      >
        {allMessages.map((msg) => {
          const isMe = msg.senderId === myId;
          return (
            <div
              key={msg._id}
              className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}
            >
              {!isMe && (
                <Avatar
                  name={msg.senderName}
                  photo={msg.senderPhoto}
                  size={7}
                />
              )}
              {isMe && (
                <Avatar
                  name={session?.user?.name ?? "Me"}
                  photo={myPhoto}
                  size={7}
                />
              )}
              <div
                style={{ width: "200px" }}
                className={`max-w-[280px] sm:max-w-[70%] space-y-1 flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div
                  style={{ maxWidth: "250px" }}
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? "bg-primary text-white rounded-br-sm"
                      : "bg-background text-primary rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-primary/30 px-1">
                  {format(new Date(msg.createdAt), "h:mm a")}{" "}
                  {isMe && <Ticks state={tickState(msg)} />}
                </span>
              </div>
            </div>
          );
        })}

        {typingUser && (
          <div className="flex items-end gap-2">
            <Avatar name={typingUser} size={7} />
            <div className="bg-background px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 sm:p-4 border-t border-primary/5 shrink-0">
        <label className="flex items-center gap-3 bg-background rounded-xl px-4 py-2 border border-primary/10 focus-within:border-secondary/40 transition-colors cursor-text w-full">
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${activeConv.otherUserName}…`}
            className="flex-1 bg-transparent border-none focus:outline-none text-sm text-primary placeholder:text-primary/30 min-w-0"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MdSend className="text-sm" />
          </button>
        </label>
        <p className="text-[10px] text-primary/30 mt-2 text-center">
          Press Enter to send
        </p>
      </div>
    </div>
  ) : (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="text-center flex flex-col items-center justify-center">
        <MdForum className="text-primary/10 text-6xl block mb-3" />
        <p className="text-primary/40 font-medium">Select a conversation</p>
        <p className="text-xs text-primary/30 mt-1">{selectHint}</p>
      </div>
    </div>
  );

  return (
    <div
      className="border border-primary/5 rounded-xl bg-white overflow-hidden"
      style={{ height: "calc(100vh - 64px - 48px)" }}
    >
      <div className="hidden md:flex h-full">
        <div className="w-80 shrink-0 border-r border-primary/5 h-full overflow-hidden">
          {ConvList}
        </div>
        <div className="flex-1 overflow-hidden">{ChatPanel}</div>
      </div>
      <div className="md:hidden h-full">
        {mobileView === "list" ? ConvList : ChatPanel}
      </div>
    </div>
  );
}
