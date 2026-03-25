"use client";
import { MdNotifications } from 'react-icons/md';

import { useEffect, useRef } from "react";
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
  const dropRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

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
    dispatch(toggleNotificationPanel());
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropRef.current &&
        !dropRef.current.contains(e.target as Node) &&
        !e.composedPath().some((el) => el instanceof HTMLButtonElement && el.classList.contains('bell-btn'))
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
        onClick={handleToggle}
        className="bell-btn relative p-2 rounded-lg hover:bg-primary/5 text-primary transition-colors"
      >
        <MdNotifications className="text-2xl" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          ref={dropRef}
          className="fixed sm:absolute top-16 sm:top-full left-0 right-0 sm:left-auto sm:right-0 sm:w-80 bg-white rounded-xl shadow-2xl border border-primary/5 z-200 overflow-hidden sm:mt-2"
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
