"use client";

import { useDispatch } from "react-redux";
import { toggleSidebar } from "@/store/uiSlice";
import Sidebar from "./Sidebar";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import NotificationBell from "@/components/notifications/NotificationBell";

interface DashboardShellProps {
  children: React.ReactNode;
  role: "worker" | "buyer" | "admin";
}

export default function DashboardShell({
  children,
  role,
}: DashboardShellProps) {
  const dispatch = useDispatch();
  const { data: session } = useSession();
  console.log(session);

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar role={role} />
      {/* spacer to offset fixed sidebar on desktop */}
      <div className="hidden lg:block w-64 shrink-0" />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg- border-b border-primary/5 flex items-center justify-between px-20 sticky top-0 z-20">
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="lg:hidden p-2 rounded-lg hover:bg-primary/5 text-primary"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg">
              <span
                className="material-symbols-outlined text-amber-500 text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
            >
                toll
              </span>
              <span className="text-sm font-bold text-primary">
                {session?.user?.coins ?? 0}
              </span>
            </div>
            <NotificationBell />
            <div className="flex items-center gap-2">
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white text-sm font-bold">
                  {session?.user?.name?.[0]?.toUpperCase()}
                </div>
              )}
              <span className="hidden md:block text-sm font-medium text-primary">
                {session?.user?.name}
              </span>
            </div>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center p-6 md:p-8">
          <div className="w-full max-w-[960px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
