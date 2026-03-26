"use client";
import {
  MdArrowBack,
  MdChatBubbleOutline,
  MdForum,
  MdSend,
} from "react-icons/md";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import { formatDistanceToNow, format } from "date-fns";
import { IConversation, IMessage } from "@/types";
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

export default function MessagesUI({
  role,
  emptyHint,
  selectHint,
}: MessagesUIProps) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const [selectedConv, setSelectedConv] = useState<IConversation | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: conversations = [] } = useQuery<IConversation[]>({
    queryKey: ["conversations"],
    queryFn: () => axios.get("/api/v1/messages").then((r) => r.data),
    refetchInterval: 15000,
  });

  useEffect(() => {
    const conv = searchParams.get("conv");
    const taskId = searchParams.get("taskId");
    const taskTitle = searchParams.get("taskTitle");
    const otherId = searchParams.get("otherId");
    const otherName = searchParams.get("otherName");
    if (conv && taskId && otherId && otherName) {
      const c: IConversation = {
        conversationId: conv,
        taskId,
        taskTitle: taskTitle ?? "Task",
        otherUserId: otherId,
        otherUserName: decodeURIComponent(otherName),
        lastMessage: "",
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
      };
      setSelectedConv(c);
      setMobileView("chat");
    }
  }, [searchParams]);

  const activeConv = selectedConv;

  const { data: fetchedMessages = [] } = useQuery<IMessage[]>({
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
      if (data.userId !== session?.user?.id) setTypingUser(data.name);
    },
    [session?.user?.id],
  );

  const handleTypingStop = useCallback(() => setTypingUser(null), []);

  const { sendMessage, sendTypingStart, sendTypingStop, markRead } = useSocket({
    conversationId: activeConv?.conversationId,
    onMessage: handleMessage,
    onTypingStart: handleTypingStart,
    onTypingStop: handleTypingStop,
  });

  useEffect(() => {
    if (activeConv?.conversationId) markRead(activeConv.conversationId);
  }, [activeConv?.conversationId, markRead]);

  function openConv(conv: IConversation) {
    setSelectedConv(conv);
    setMessages([]);
    setMobileView("chat");
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value);
    if (!activeConv) return;
    sendTypingStart(activeConv.conversationId);
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
    sendTypingStop(activeConv.conversationId);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const myId = session?.user?.id;
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
        </div>
      </div>

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
                  {isMe && (
                    <span className="ml-1">{msg.isRead ? "✓✓" : "✓"}</span>
                  )}
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
