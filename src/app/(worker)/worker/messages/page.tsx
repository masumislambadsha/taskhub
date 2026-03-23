"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import { formatDistanceToNow, format } from "date-fns";
import { IConversation, IMessage } from "@/types";
import { useSocket } from "@/hooks/useSocket";

export default function WorkerMessagesPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [activeConv, setActiveConv] = useState<IConversation | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch conversation list
  const { data: conversations = [] } = useQuery<IConversation[]>({
    queryKey: ["conversations"],
    queryFn: () => axios.get("/api/v1/messages").then((r) => r.data),
    refetchInterval: 15000,
  });

  // Auto-open conversation from URL params (e.g. coming from task page)
  useEffect(() => {
    const conv = searchParams.get("conv");
    const taskId = searchParams.get("taskId");
    const taskTitle = searchParams.get("taskTitle");
    const otherId = searchParams.get("otherId");
    const otherName = searchParams.get("otherName");
    if (conv && taskId && otherId && otherName) {
      setActiveConv({
        conversationId: conv,
        taskId,
        taskTitle: taskTitle ?? "Task",
        otherUserId: otherId,
        otherUserName: decodeURIComponent(otherName),
        lastMessage: "",
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
      });
    }
  }, [searchParams]);

  // Fetch history when conversation changes
  useEffect(() => {
    if (!activeConv) return;
    setMessages([]);
    axios
      .get(`/api/v1/messages/${activeConv.conversationId}`)
      .then((r) => setMessages(r.data));
  }, [activeConv?.conversationId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleMessage = useCallback(
    (msg: IMessage) => {
      if (msg.conversationId === activeConv?.conversationId) {
        setMessages((prev) => {
          // avoid duplicates (sender already sees optimistic message)
          if (prev.find((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
      qc.invalidateQueries({ queryKey: ["conversations"] });
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

  // Mark as read when opening conversation
  useEffect(() => {
    if (activeConv) markRead(activeConv.conversationId);
  }, [activeConv?.conversationId]);

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
    });
    setInput("");
    sendTypingStop(activeConv.conversationId);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const myId = session?.user?.id;

  return (
    <div className="fixed top-16 bottom-0 left-64 right-0 flex bg-white border-t border-primary/5 overflow-hidden">
      {/* Conversations sidebar */}
      <aside className="w-80 sticky top-0 shrink-0 border-r border-primary/5 flex flex-col">
        <div className="p-4 border-b border-primary/5">
          <h2 className="font-headline text-lg font-bold text-primary">
            Messages
          </h2>
          <p className="text-xs text-primary/40 mt-0.5">
            Task-related conversations
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-8 text-center">
              <span className="material-symbols-outlined text-primary/20 text-4xl block mb-2">
                chat_bubble_outline
              </span>
              <p className="text-sm text-primary/40">No conversations yet</p>
              <p className="text-xs text-primary/30 mt-1">
                Start by messaging a buyer from a task page
              </p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.conversationId}
                onClick={() => setActiveConv(conv)}
                className={`w-full text-left px-4 py-4 border-b border-primary/5 hover:bg-background transition-colors ${
                  activeConv?.conversationId === conv.conversationId
                    ? "bg-secondary/5 border-l-2 border-l-secondary"
                    : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
                    {conv.otherUserName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm text-primary truncate">
                        {conv.otherUserName}
                      </span>
                      <span className="text-[10px] text-primary/30 shrink-0 ml-2">
                        {formatDistanceToNow(new Date(conv.lastMessageAt), {
                          addSuffix: true,
                        })}
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

      {/* Chat area */}
      {activeConv ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat header */}
          <div className="h-16 px-6 border-b border-primary/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {activeConv.otherUserName[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm text-primary">
                  {activeConv.otherUserName}
                </p>
                <p className="text-xs text-secondary truncate max-w-[200px]">
                  {activeConv.taskTitle}
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => {
              const isMe = msg.senderId === myId;
              return (
                <div
                  key={msg._id}
                  className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}
                >
                  {!isMe && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                      {msg.senderName[0]?.toUpperCase()}
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] space-y-1 ${isMe ? "items-end" : "items-start"} flex flex-col`}
                  >
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? "bg-primary text-white rounded-br-sm"
                          : "bg-background text-primary rounded-bl-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-primary/30 px-1">
                      {format(new Date(msg.createdAt), "h:mm a")}
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
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  {typingUser[0]?.toUpperCase()}
                </div>
                <div className="bg-background px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-primary/5 shrink-0">
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
                <span
                  className="material-symbols-outlined text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  send
                </span>
              </button>
            </label>
            <p className="text-[10px] text-primary/30 mt-2 text-center">
              Press Enter to send
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-outlined text-primary/10 text-6xl block mb-3">
              forum
            </span>
            <p className="text-primary/40 font-medium">Select a conversation</p>
            <p className="text-xs text-primary/30 mt-1">
              Or start one from a task page
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
