"use client";

import { useEffect, useSyncExternalStore } from "react";
import { MdLightMode, MdDarkMode } from "react-icons/md";
import {
  getIsDarkServerSnapshot,
  getIsDarkSnapshot,
  notifyThemeChange,
  subscribeTheme,
} from "@/lib/theme-store";

interface DarkModeToggleProps {
  dark?: boolean;
}

export default function DarkModeToggle({ dark }: DarkModeToggleProps) {
  const isDark = useSyncExternalStore(
    subscribeTheme,
    getIsDarkSnapshot,
    getIsDarkServerSnapshot,
  );

  // Apply the saved theme to <html> on mount (default: light)
  useEffect(() => {
    const html = document.documentElement;
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark") {
      html.classList.add("dark");
      html.setAttribute("data-theme", "dark");
    } else {
      html.classList.remove("dark");
      html.removeAttribute("data-theme");
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
          : "text-primary/60 hover:text-primary hover:bg-primary/10"
      }`}
      aria-label="Toggle dark mode"
    >
      {isDark ? <MdLightMode size={20} /> : <MdDarkMode size={20} />}
    </button>
  );
}
