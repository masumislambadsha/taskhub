"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import NotificationBell from "@/components/notifications/NotificationBell";
import Logo from "@/components/ui/Logo";
import HamburgerIcon from "@/components/ui/HamburgerIcon";

export default function Navbar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const dashboardHref =
    session?.user?.role === "admin"
      ? "/admin/dashboard"
      : session?.user?.role === "buyer"
        ? "/buyer/dashboard"
        : "/worker/dashboard";

  return (
    <div className="bg-transparent sticky z-50 top-0 backdrop-blur-xl border-b border-primary/5">
      <nav className="max-w-7xl mx-auto w-full z-50 flex justify-between backdrop-blur-xl items-center px-6 md:px-8 h-20">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center">
            <Logo size={34} />
          </Link>
          {/* Desktop nav links */}
          <div className="hidden lg:flex gap-6 items-center">
            <Link
              href="/how-it-works"
              className="text-primary/70 hover:text-primary text-sm font-medium transition-all"
            >
              How it Works
            </Link>
            <Link
              href="/tasks"
              className="text-primary/70 hover:text-primary text-sm font-medium transition-all"
            >
              Browse Tasks
            </Link>
            <Link
              href="/leaderboard"
              className="text-primary/70 hover:text-primary text-sm font-medium transition-all"
            >
              Leaderboard
            </Link>
            <Link
              href="/faq"
              className="text-primary/70 hover:text-primary text-sm font-medium transition-all"
            >
              FAQ
            </Link>
            <Link
              href="/support"
              className="text-primary/70 hover:text-primary text-sm font-medium transition-all"
            >
              Support
            </Link>
          </div>
        </div>

        {/* Desktop right side */}
        <div className="hidden lg:flex items-center gap-3">
          {session ? (
            <>
              <NotificationBell />
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-primary/5 transition-all"
                >
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white text-sm font-bold">
                      {session.user.name?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium text-primary">
                    {session.user.name}
                  </span>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-primary/5 py-2 z-50">
                    <div className="px-4 py-2 border-b border-primary/5">
                      <p className="text-xs text-primary/50 font-medium uppercase tracking-wider">
                        {session.user.role}
                      </p>
                      <p className="text-sm font-semibold text-primary truncate">
                        {session.user.email}
                      </p>
                    </div>
                    <Link
                      href={dashboardHref}
                      className="block px-4 py-2 text-sm text-primary hover:bg-primary/5"
                      onClick={() => setMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href={
                        session.user.role === "worker"
                          ? "/worker/profile"
                          : session.user.role === "buyer"
                            ? "/buyer/profile"
                            : "/admin/dashboard"
                      }
                      className="block px-4 py-2 text-sm text-primary hover:bg-primary/5"
                      onClick={() => setMenuOpen(false)}
                    >
                      My Profile
                    </Link>
                    {session.user.role === "worker" && (
                      <Link
                        href="/worker/settings"
                        className="block px-4 py-2 text-sm text-primary hover:bg-primary/5"
                        onClick={() => setMenuOpen(false)}
                      >
                        Settings
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        signOut({ callbackUrl: "/" });
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-5 py-2 text-sm font-semibold text-primary hover:bg-primary/5 rounded-lg transition-all"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="px-5 py-2 text-sm font-semibold bg-primary text-white rounded-lg shadow-lg shadow-primary/20 hover:scale-95 transition-all"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile: notification + hamburger */}
        <div className="flex lg:hidden items-center gap-1 text-primary">
          {session && <NotificationBell />}
          <HamburgerIcon checked={mobileOpen} onChange={setMobileOpen} />
        </div>
      </nav>

      {/* Mobile menu dropdown */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-primary/5 bg-white/95 backdrop-blur-xl px-6 py-4 flex flex-col gap-1">
          <Link
            href="/how-it-works"
            className="py-2 text-sm font-medium text-primary/70 hover:text-primary transition-all"
            onClick={() => setMobileOpen(false)}
          >
            How it Works
          </Link>
          <Link
            href="/tasks"
            className="py-2 text-sm font-medium text-primary/70 hover:text-primary transition-all"
            onClick={() => setMobileOpen(false)}
          >
            Browse Tasks
          </Link>
          <Link
            href="/leaderboard"
            className="py-2 text-sm font-medium text-primary/70 hover:text-primary transition-all"
            onClick={() => setMobileOpen(false)}
          >
            Leaderboard
          </Link>
          <Link
            href="/faq"
            className="py-2 text-sm font-medium text-primary/70 hover:text-primary transition-all"
            onClick={() => setMobileOpen(false)}
          >
            FAQ
          </Link>
          <Link
            href="/support"
            className="py-2 text-sm font-medium text-primary/70 hover:text-primary transition-all"
            onClick={() => setMobileOpen(false)}
          >
            Support
          </Link>

          <div className="border-t border-primary/5 mt-2 pt-3">
            {session ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-white text-sm font-bold">
                      {session.user.name?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      {session.user.name}
                    </p>
                    <p className="text-xs text-primary/50">
                      {session.user.email}
                    </p>
                  </div>
                </div>
                <Link
                  href={dashboardHref}
                  className="block py-2 text-sm text-primary hover:text-primary/70 transition-all"
                  onClick={() => setMobileOpen(false)}
                >
                  Dashboard
                </Link>
                <Link
                  href={
                    session.user.role === "worker"
                      ? "/worker/profile"
                      : session.user.role === "buyer"
                        ? "/buyer/profile"
                        : "/admin/dashboard"
                  }
                  className="block py-2 text-sm text-primary hover:text-primary/70 transition-all"
                  onClick={() => setMobileOpen(false)}
                >
                  My Profile
                </Link>
                {session.user.role === "worker" && (
                  <Link
                    href="/worker/settings"
                    className="block py-2 text-sm text-primary hover:text-primary/70 transition-all"
                    onClick={() => setMobileOpen(false)}
                  >
                    Settings
                  </Link>
                )}
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    signOut({ callbackUrl: "/" });
                  }}
                  className="mt-1 w-full text-left py-2 text-sm text-red-600"
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  href="/login"
                  className="py-2 text-center text-sm font-semibold text-primary border border-primary/20 rounded-lg hover:bg-primary/5 transition-all"
                  onClick={() => setMobileOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="py-2 text-center text-sm font-semibold bg-primary text-white rounded-lg shadow-lg shadow-primary/20 transition-all"
                  onClick={() => setMobileOpen(false)}
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
