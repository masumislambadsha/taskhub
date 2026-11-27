"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface TrustData {
  score: number;
  level: number;
  levelName: string;
  components: Record<string, number>;
  explanation: string[];
  levels: Array<{ level: number; name: string; min: number }>;
}

const PARTS: Array<[string, string, number]> = [
  ["approvalRate", "Approval rate (90 days)", 40],
  ["volume", "Approved submissions", 15],
  ["accountAge", "Account age", 10],
  ["verified", "Verified email and phone", 10],
  ["disputes", "No lost disputes (90 days)", 10],
  ["fraud", "No confirmed fraud flags", 15],
];

/** The worker's level and score, with every component, and what would move them up. */
export default function TrustCard() {
  const { data } = useQuery<TrustData>({
    queryKey: ["trust"],
    queryFn: () => axios.get("/api/v1/user/trust").then((r) => r.data),
    staleTime: 60_000,
  });
  const limits = useQuery<{ cap: number; used: number; remaining: number; resetsAt: string }>({
    queryKey: ["earning-limits"],
    queryFn: () => axios.get("/api/v1/user/earning-limits").then((r) => r.data),
    staleTime: 30_000,
  }).data;
  if (!data) return null;

  return (
    <section className="bg-white rounded-xl border border-primary/5 shadow-sm p-5 space-y-4" aria-label="Your level">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-headline text-lg font-bold text-primary">
          Your level: {data.levelName} <span className="text-primary/50 font-normal">({data.score}/100)</span>
        </h2>
        <p className="text-xs text-primary/50">
          {data.levels.map((l) => `${l.name} ${l.min}+`).join(" · ")}
        </p>
      </div>
      <ul className="text-sm text-primary/70 space-y-1">
        {data.explanation.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {limits && (
        <div>
          <div className="flex justify-between text-sm text-primary/70">
            <span>Today&apos;s limit (resets at midnight, Dhaka time)</span>
            <span>
              {limits.used} / {limits.cap} coins
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-primary/10 mt-1">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, (limits.used / limits.cap) * 100)}%` }} />
          </div>
          <p className="text-xs text-primary/50 mt-1">
            {limits.remaining > 0 ? `${limits.remaining} coins of work left today. Work waiting for review counts.` : "Daily limit reached. It resets at midnight, Dhaka time."}
          </p>
        </div>
      )}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {PARTS.map(([key, label, max]) => (
          <div key={key}>
            <div className="flex justify-between text-primary/70">
              <dt>{label}</dt>
              <dd>
                {data.components[key]} / {max}
              </dd>
            </div>
            <div className="h-1.5 rounded-full bg-primary/10 mt-1">
              <div className="h-full rounded-full bg-secondary" style={{ width: `${Math.min(100, (data.components[key] / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
