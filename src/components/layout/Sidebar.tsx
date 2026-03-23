"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store";
import { setSidebarOpen } from "@/store/uiSlice";
import Logo from "@/components/ui/Logo";
import { signOut } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const workerNav: NavItem[] = [
  { href: "/worker/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/worker/tasks", label: "Browse Tasks", icon: "search" },
  { href: "/worker/submissions", label: "My Submissions", icon: "assignment" },
  { href: "/worker/earnings", label: "Earnings", icon: "toll" },
  { href: "/worker/withdrawals", label: "Withdrawals", icon: "payments" },
  { href: "/worker/messages", label: "Messages", icon: "mail" },
  { href: "/worker/profile", label: "My Profile", icon: "account_circle" },
  { href: "/worker/settings", label: "Settings", icon: "settings" },
];

const buyerNav: NavItem[] = [
  { href: "/buyer/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/buyer/tasks", label: "My Tasks", icon: "task" },
  { href: "/buyer/tasks/new", label: "Post Task", icon: "add_circle" },
  {
    href: "/buyer/submissions",
    label: "Review Submissions",
    icon: "rate_review",
  },
  { href: "/buyer/messages", label: "Messages", icon: "mail" },
  { href: "/buyer/coins", label: "Buy Coins", icon: "toll" },
  { href: "/buyer/payments", label: "Payment History", icon: "receipt_long" },
  { href: "/buyer/profile", label: "My Profile", icon: "account_circle" },
];

const adminNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/users", label: "Manage Users", icon: "group" },
  { href: "/admin/tasks", label: "Manage Tasks", icon: "task_alt" },
  {
    href: "/admin/submissions",
    label: "Submissions",
    icon: "assignment_turned_in",
  },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: "account_balance" },
  { href: "/admin/payments", label: "Payments", icon: "payments" },
  { href: "/admin/stats", label: "Analytics", icon: "analytics" },
  { href: "/admin/categories", label: "Categories", icon: "category" },
  { href: "/admin/activity", label: "Activity Log", icon: "receipt_long" },
];

interface SidebarProps {
  role: "worker" | "buyer" | "admin";
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const dispatch = useDispatch();
  const sidebarOpen = useSelector((s: RootState) => s.ui.sidebarOpen);

  const navItems =
    role === "admin" ? adminNav : role === "buyer" ? buyerNav : workerNav;

  const close = () => dispatch(setSidebarOpen(false));

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="sidebar-backdrop"
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.25 } }}
            exit={{
              opacity: 0,
              transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
            }}
            onClick={close}
          />
        )}
      </AnimatePresence>

      {/* Desktop sidebar — always visible, no animation needed */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-full w-64 bg-primary z-40 flex-col">
        <SidebarContent navItems={navItems} pathname={pathname} close={close} />
      </aside>

      {/* Mobile sidebar — animated */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            key="sidebar-mobile"
            className="lg:hidden fixed top-0 left-0 h-full w-64 bg-primary z-40 flex flex-col"
            initial={{ x: "-100%" }}
            animate={{
              x: 0,
              transition: { type: "spring", stiffness: 320, damping: 32 },
            }}
            exit={{
              x: "-100%",
              transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
            }}
          >
            <SidebarContent
              navItems={navItems}
              pathname={pathname}
              close={close}
              animated
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

function SidebarContent({
  navItems,
  pathname,
  close,
  animated = false,
}: {
  navItems: NavItem[];
  pathname: string;
  close: () => void;
  animated?: boolean;
}) {
  return (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-white/10 shrink-0">
        <Link href="/" onClick={close}>
          <Logo size={32} light />
        </Link>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item, i) => {
          let active = pathname === item.href;
          if (!active && item.href === "/buyer/tasks") {
            active =
              pathname.startsWith("/buyer/tasks/") &&
              !pathname.startsWith("/buyer/tasks/new");
          } else if (!active) {
            active = pathname.startsWith(item.href + "/");
          }

          const linkEl = (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-xl">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );

          if (!animated) return linkEl;

          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
                delay: 0.04 + i * 0.045,
              }}
            >
              {linkEl}
            </motion.div>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-4 py-4 border-t border-white/10 shrink-0">
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium hover:bg-red-500/10 hover:text-red-500 transition-all w-full text-red-300"
        >
          <span className="material-symbols-outlined text-xl">logout</span>
          Sign Out
        </button>
      </div>
    </>
  );
}
