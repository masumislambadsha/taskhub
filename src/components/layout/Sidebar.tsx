"use client";
import {
  MdAccountBalance,
  MdAccountCircle,
  MdAddCircle,
  MdAnalytics,
  MdAssignment,
  MdAssignmentTurnedIn,
  MdCategory,
  MdDashboard,
  MdGroup,
  MdHome,
  MdLogout,
  MdMail,
  MdPayments,
  MdRateReview,
  MdReceiptLong,
  MdSearch,
  MdSettings,
  MdTask,
  MdTaskAlt,
  MdToll,
} from "react-icons/md";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store";
import { setSidebarOpen } from "@/store/uiSlice";
import Logo from "@/components/ui/Logo";
import { signOut } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { IconType } from "react-icons";

interface NavItem {
  href: string;
  label: string;
  icon: IconType;
}

const workerNav: NavItem[] = [
  { href: "/worker/dashboard", label: "Dashboard", icon: MdDashboard },
  { href: "/worker/tasks", label: "Browse Tasks", icon: MdSearch },
  { href: "/worker/submissions", label: "My Submissions", icon: MdAssignment },
  { href: "/worker/earnings", label: "Earnings", icon: MdToll },
  { href: "/worker/withdrawals", label: "Withdrawals", icon: MdPayments },
  { href: "/worker/messages", label: "Messages", icon: MdMail },
  { href: "/worker/profile", label: "My Profile", icon: MdAccountCircle },
  { href: "/worker/settings", label: "Settings", icon: MdSettings },
];

const buyerNav: NavItem[] = [
  { href: "/buyer/dashboard", label: "Dashboard", icon: MdDashboard },
  { href: "/buyer/tasks", label: "My Tasks", icon: MdTask },
  { href: "/buyer/tasks/new", label: "Post Task", icon: MdAddCircle },
  {
    href: "/buyer/submissions",
    label: "Review Submissions",
    icon: MdRateReview,
  },
  { href: "/buyer/messages", label: "Messages", icon: MdMail },
  { href: "/buyer/coins", label: "Buy Coins", icon: MdToll },
  { href: "/buyer/payments", label: "Payment History", icon: MdReceiptLong },
  { href: "/buyer/profile", label: "My Profile", icon: MdAccountCircle },
];

const adminNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: MdDashboard },
  { href: "/admin/users", label: "Manage Users", icon: MdGroup },
  { href: "/admin/tasks", label: "Manage Tasks", icon: MdTaskAlt },
  {
    href: "/admin/submissions",
    label: "Submissions",
    icon: MdAssignmentTurnedIn,
  },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: MdAccountBalance },
  { href: "/admin/payments", label: "Payments", icon: MdPayments },
  { href: "/admin/stats", label: "Analytics", icon: MdAnalytics },
  { href: "/admin/categories", label: "Categories", icon: MdCategory },
  { href: "/admin/activity", label: "Activity Log", icon: MdReceiptLong },
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
      
      <aside className="hidden lg:flex fixed top-0 left-0 h-full w-64 bg-primary z-40 flex-col">
        <SidebarContent navItems={navItems} pathname={pathname} close={close} />
      </aside>

      
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="sidebar-mobile"
            className="lg:hidden fixed inset-x-0 top-16 h-[calc(100dvh-4rem)] z-40 bg-primary flex flex-col"
            initial={{ y: "-100%", opacity: 0 }}
            animate={{
              y: 0,
              opacity: 1,
              transition: { type: "spring", stiffness: 280, damping: 28 },
            }}
            exit={{
              y: "-100%",
              opacity: 0,
              transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
            }}
          >
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
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 28,
                      delay: 0.06 + i * 0.06,
                    }}
                  >
                    <Link
                      href={item.href}
                      onClick={close}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                        active
                          ? "bg-white/15 text-white"
                          : "text-white/60 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Icon className="text-xl" />
                      {item.label}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <motion.div
              className="px-4 py-4 border-t border-white/10 shrink-0 flex flex-col gap-1"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 28,
                delay: 0.38,
              }}
            >
              <Link
                href="/"
                onClick={close}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-all"
              >
                <MdHome className="text-xl" />
                Home
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium hover:bg-red-500/10 hover:text-red-500 transition-all w-full text-red-300"
              >
                <MdLogout className="text-xl" />
                Sign Out
              </button>
            </motion.div>
          </motion.div>
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
          const Icon = item.icon;

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
              <Icon className="text-xl" />
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

      <div className="px-4 py-4 border-t border-white/10 shrink-0 flex flex-col gap-1">
        <Link
          href="/"
          onClick={close}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-all"
        >
          <MdHome className="text-xl" />
          Home
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium hover:bg-red-500/10 hover:text-red-500 transition-all w-full text-red-300"
        >
          <MdLogout className="text-xl" />
          Sign Out
        </button>
      </div>
    </>
  );
}
