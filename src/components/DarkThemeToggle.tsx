"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
import {
  getIsDarkServerSnapshot,
  getIsDarkSnapshot,
  notifyThemeChange,
  subscribeTheme,
} from "@/lib/theme-store";

interface DarkThemeToggleProps {
  dark?: boolean;
}

export default function DarkThemeToggle({ dark }: DarkThemeToggleProps) {
  const isDark = useSyncExternalStore(
    subscribeTheme,
    getIsDarkSnapshot,
    getIsDarkServerSnapshot,
  );

  // Apply the saved theme to <html> on mount (default: light)
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const html = document.documentElement;
    if (savedTheme === "dark") {
      html.classList.add("dark");
      html.setAttribute("data-theme", "dark");
    }
  }, []);

  const toggle = () => {
    const html = document.documentElement;
    const next = !isDark;
    if (next) {
      html.classList.add("dark");
      html.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      html.classList.remove("dark");
      html.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
    }
    notifyThemeChange();
  };

  return (
    <button
      onClick={toggle}
      className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${
        dark
          ? "text-slate-300 hover:text-white hover:bg-white/10"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10"
      }`}
      aria-label="Toggle dark mode"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
