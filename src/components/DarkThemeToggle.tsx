"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

interface DarkThemeToggleProps {
  dark?: boolean;
}

export default function DarkThemeToggle({ dark }: DarkThemeToggleProps) {
  const [isDark, setIsDark] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const html = document.documentElement;
    if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      html.classList.add("dark");
      html.setAttribute("data-theme", "dark");
      setIsDark(true);
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
    setIsDark(next);
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
