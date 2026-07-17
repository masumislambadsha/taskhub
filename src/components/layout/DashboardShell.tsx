"use client";
import { MdToll } from 'react-icons/md';

import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store";
import { toggleSidebar } from "@/store/uiSlice";
import Sidebar from "./Sidebar";
import { useSession } from "next-auth/react";
import NotificationBell from "@/components/notifications/NotificationBell";
import HamburgerIcon from "@/components/ui/HamburgerIcon";
import DarkThemeToggle from "@/components/DarkThemeToggle";

interface DashboardShellProps {
  children: React.ReactNode;
  role: "worker" | "buyer" | "admin";
}

export default function DashboardShell({
  children,
  role,
}: DashboardShellProps) {
  const dispatch = useDispatch();
  const sidebarOpen = useSelector((s: RootState) => s.ui.sidebarOpen);
  const { data: session } = useSession();

  return (
    <div className="min-h-screen flex bg-background dark:bg-black/65 transition-all duration-500">
      <Sidebar role={role} />

      <div className="hidden lg:block w-64 shrink-0" />
      <div className="flex-1 flex flex-col min-w-0">

        <header className="h-16 bg- border-b border-primary/5 flex items-center justify-between px-4 md:px-6 sticky top-0 z-20 backdrop-blur-sm">
          <div className="lg:hidden">
            <HamburgerIcon
              checked={sidebarOpen}
              onChange={() => dispatch(toggleSidebar())}
            />
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2 sm:gap-4">
            <DarkThemeToggle dark />
            <div className="flex items-center gap-2   py-1.5 rounded-lg">
              <MdToll className="text-amber-500 text-lg" />
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
        <main className="flex-1 flex flex-col items-center p-4 md:p-8">
          <div className="w-full max-w-[960px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
