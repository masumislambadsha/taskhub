"use client";
import { MdToll, MdLogout, MdSettings, MdAccountCircle, MdExpandMore } from 'react-icons/md';

import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store";
import { toggleSidebar } from "@/store/uiSlice";
import Sidebar from "./Sidebar";
import { useSession, signOut } from "next-auth/react";
import NotificationBell from "@/components/notifications/NotificationBell";
import HamburgerIcon from "@/components/ui/HamburgerIcon";
import DarkThemeToggle from "@/components/DarkThemeToggle";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { roleLabel } from "@/lib/roles";
import Badge from "@/components/ui/Badge";

interface DashboardShellProps {
  children: React.ReactNode;
  role: "worker" | "buyer" | "admin" | "demo_admin";
}

export default function DashboardShell({
  children,
  role,
}: DashboardShellProps) {
  const dispatch = useDispatch();
  const sidebarOpen = useSelector((s: RootState) => s.ui.sidebarOpen);
  const { data: session } = useSession();
  const [profileOpen, setProfileOpen] = useState(false);

  const profileHref =
    role === "worker"
      ? "/worker/profile"
      : role === "buyer"
        ? "/buyer/profile"
        : "/admin/profile";

  const settingsHref =
    role === "worker" ? "/worker/settings" : null;

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
            <div className="relative">
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-primary/5 transition-all"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
              >
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
                <MdExpandMore
                  className={`hidden md:block text-primary/40 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <>
                    <motion.div
                      className="fixed inset-0 z-30"
                      onClick={() => setProfileOpen(false)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    />
                    <motion.div
                      className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-primary/5 py-2 z-40"
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      role="menu"
                    >
                      <div className="px-4 py-2 border-b border-primary/5">
                        {session?.user?.role === "demo_admin" ? (
                          <Badge status="demo_admin" />
                        ) : (
                          <p className="text-xs text-primary/50 font-medium uppercase tracking-wider">
                            {roleLabel(session?.user?.role)}
                          </p>
                        )}
                        <p className="text-sm font-semibold text-primary truncate">
                          {session?.user?.email}
                        </p>
                      </div>
                      <Link
                        href={profileHref}
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-primary hover:bg-primary/5"
                      >
                        <MdAccountCircle className="text-lg" />
                        My Profile
                      </Link>
                      {settingsHref && (
                        <Link
                          href={settingsHref}
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-primary hover:bg-primary/5"
                        >
                          <MdSettings className="text-lg" />
                          Settings
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          signOut({ callbackUrl: "/" });
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                      >
                        <MdLogout className="text-lg" />
                        Sign out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
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
