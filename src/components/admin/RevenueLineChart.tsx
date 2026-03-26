"use client";

import { useState } from "react";

interface Point {
  label: string;
  revenue: number;
  payments: number;
}

interface Props {
  data: Point[];
}

export default function RevenueLineChart({ data }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const W = 600;
  const H = 180;
  const PAD = { top: 16, right: 16, bottom: 32, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.map((d) => d.revenue), 1);
  const minVal = 0;

  function xPos(i: number) {
    return PAD.left + (i / Math.max(data.length - 1, 1)) * chartW;
  }
  function yPos(v: number) {
    return PAD.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;
  }

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xPos(i)} ${yPos(d.revenue)}`)
    .join(" ");

  const areaPath =
    linePath +
    ` L ${xPos(data.length - 1)} ${PAD.top + chartH} L ${xPos(0)} ${PAD.top + chartH} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    v: minVal + t * (maxVal - minVal),
    y: PAD.top + chartH - t * chartH,
  }));

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 180 }}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#004030" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#004030" stopOpacity="0" />
          </linearGradient>
        </defs>

        
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={t.y}
              y2={t.y}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 6}
              y={t.y + 4}
              textAnchor="end"
              fontSize="9"
              fill="#94a3b8"
              fontWeight="600"
            >
              {t.v >= 1000
                ? `$${(t.v / 1000).toFixed(1)}k`
                : `$${t.v.toFixed(0)}`}
            </text>
          </g>
        ))}

        
        <path d={areaPath} fill="url(#revGrad)" />

        
        <path
          d={linePath}
          fill="none"
          stroke="#004030"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        
        {data.map((d, i) => (
          <text
            key={i}
            x={xPos(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize="9"
            fill="#94a3b8"
            fontWeight="600"
          >
            {d.label}
          </text>
        ))}

        
        {data.map((d, i) => (
          <g key={i}>
            <rect
              x={xPos(i) - chartW / (2 * Math.max(data.length - 1, 1))}
              y={PAD.top}
              width={chartW / Math.max(data.length - 1, 1)}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
            />
            {hovered === i && (
              <>
                <line
                  x1={xPos(i)}
                  x2={xPos(i)}
                  y1={PAD.top}
                  y2={PAD.top + chartH}
                  stroke="#004030"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                  opacity="0.4"
                />
                <circle
                  cx={xPos(i)}
                  cy={yPos(d.revenue)}
                  r="5"
                  fill="#004030"
                  stroke="white"
                  strokeWidth="2"
                />
              </>
            )}
          </g>
        ))}
      </svg>

      
      {hovered !== null && (
        <div
          className="absolute pointer-events-none bg-primary text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10 -translate-x-1/2"
          style={{
            left: `${(hovered / Math.max(data.length - 1, 1)) * 100}%`,
            top: 0,
          }}
        >
          <p className="font-bold">{data[hovered].label}</p>
          <p className="text-white/80">${data[hovered].revenue.toFixed(2)}</p>
          <p className="text-white/60 text-[10px]">
            {data[hovered].payments} payments
          </p>
        </div>
      )}
    </div>
  );
}
