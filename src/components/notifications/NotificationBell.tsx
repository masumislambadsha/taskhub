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
  const [pos, setPos] = useState({ top: 0, right: 0 });

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

  // Calculate fixed position when opening
  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
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
          className="fixed w-80 left-0 bg-white rounded-xl shadow-2xl border border-primary/5 z-[200] overflow-hidden"
          style={{
            top: pos.top,
            right: Math.max(pos.right, 8), // never closer than 8px from right edge
            maxWidth: "calc(100vw - 1rem)",
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
