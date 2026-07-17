"use client";

import { useState, useEffect } from "react";
import { MdLightMode, MdDarkMode } from "react-icons/md";

interface DarkModeToggleProps {
  dark?: boolean;
}

export default function DarkModeToggle({ dark }: DarkModeToggleProps) {
  const [isDark, setIsDark] = useState(false);

  // Initialize theme from localStorage or system preference on mount
  useEffect(() => {
    const html = document.documentElement;
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    const shouldBeDark = savedTheme === "dark" || (!savedTheme && prefersDark);
    
    if (shouldBeDark) {
      html.classList.add("dark");
      html.setAttribute("data-theme", "dark");
      setIsDark(true);
    } else {
      html.classList.remove("dark");
      html.removeAttribute("data-theme");
      setIsDark(false);
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
          : "text-primary/60 hover:text-primary hover:bg-primary/10"
      }`}
      aria-label="Toggle dark mode"
    >
      {isDark ? <MdLightMode size={20} /> : <MdDarkMode size={20} />}
    </button>
  );
}
