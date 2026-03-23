"use client";

import React from "react";

interface HamburgerIconProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function HamburgerIcon({
  checked,
  onChange,
}: HamburgerIconProps) {
  return (
    <label className="hamburger-label" style={{ cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ display: "none" }}
      />
      <svg
        viewBox="0 0 32 32"
        style={{
          height: "2.2em",
          transition: "transform 600ms cubic-bezier(0.4, 0, 0.2, 1)",
          transform: checked ? "rotate(-45deg)" : "rotate(0deg)",
        }}
      >
        <path
          d="M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22"
          style={{
            fill: "none",
            stroke: "currentColor",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: 3,
            strokeDasharray: checked ? "20 300" : "12 63",
            strokeDashoffset: checked ? "-32.42" : "0",
            transition:
              "stroke-dasharray 600ms cubic-bezier(0.4, 0, 0.2, 1), stroke-dashoffset 600ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
        <path
          d="M7 16 27 16"
          style={{
            fill: "none",
            stroke: "currentColor",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: 3,
            transition:
              "stroke-dasharray 600ms cubic-bezier(0.4, 0, 0.2, 1), stroke-dashoffset 600ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </svg>
    </label>
  );
}
