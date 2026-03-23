"use client";

import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store";
import {
  toggleNotificationPanel,
  closeNotificationPanel,
} from "@/store/uiSlice";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { INotification } from "@/types";
import { formatDistanceToNow } from "date-fns";

export default function NotificationBell() {
  const dispatch = useDispatch();
  const open = useSelector((s: RootState) => s.ui.notificationPanelOpen);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const [pos, setPos] = useState<{
    top: number;
    left?: number;
    right?: number;
  }>({ top: 0, right: 0 });

  const { data } = useQuery<INotification[]>({
    queryKey: ["notifications"],
    queryFn: () => axios.get("/api/v1/notifications").then((r) => r.data),
    refetchInterval: 30000,
  });

  const readAll = useMutation({
    mutationFn: () => axios.post("/api/v1/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = data?.filter((n) => !n.isRead).length ?? 0;

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const dropdownWidth = Math.min(320, window.innerWidth - 16);
      const rightFromEdge = window.innerWidth - rect.right;
      // If dropdown would overflow left, anchor to left edge instead
      const wouldOverflowLeft = rect.right - dropdownWidth < 8;
      setPos(
        wouldOverflowLeft
          ? { top: rect.bottom + 8, left: 8 }
          : { top: rect.bottom + 8, right: rightFromEdge },
      );
    }
    dispatch(toggleNotificationPanel());
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropRef.current &&
        !dropRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        dispatch(closeNotificationPanel());
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, dispatch]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="relative p-2 pl-0 rounded-lg hover:bg-primary/5 text-primary transition-colors"
      >
        <span className="material-symbols-outlined text-xl">notifications</span>
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropRef}
          className="fixed bg-white rounded-xl shadow-2xl border border-primary/5 z-200 overflow-hidden"
          style={{
            top: pos.top,
            ...(pos.left !== undefined
              ? { left: pos.left }
              : { right: pos.right }),
            width: Math.min(
              320,
              (typeof window !== "undefined" ? window.innerWidth : 400) - 16,
            ),
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-primary/5">
            <span className="font-bold text-primary text-sm">
              Notifications
            </span>
            {unread > 0 && (
              <button
                onClick={() => readAll.mutate()}
                className="text-xs text-secondary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div
            className="max-h-80 overflow-y-auto"
            onWheel={(e) => e.stopPropagation()}
          >
            {!data?.length ? (
              <p className="text-center text-primary/40 text-sm py-8">
                No notifications
              </p>
            ) : (
              data.map((n) => (
                <div
                  key={n._id}
                  className={`px-4 py-3 border-b border-primary/5 last:border-0 ${!n.isRead ? "bg-secondary/5" : ""}`}
                >
                  <p className="text-sm text-primary leading-snug">
                    {n.message}
                  </p>
                  <p className="text-xs text-primary/40 mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
