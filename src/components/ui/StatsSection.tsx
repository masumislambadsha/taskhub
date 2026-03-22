"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useTransform, animate, motion } from "framer-motion";
import { useInView } from "framer-motion";

const STATS = [
  { value: 450, suffix: "k+", label: "Workers registered" },
  { value: 1.2, suffix: "M+", label: "Tasks completed", decimal: true },
  { value: 15, suffix: "M+", label: "USD paid out", prefix: "$" },
  { value: 99.8, suffix: "%", label: "Success rate", decimal: true },
];

function CountUp({
  end,
  suffix = "",
  prefix = "",
  decimal = false,
}: {
  end: number;
  suffix?: string;
  prefix?: string;
  decimal?: boolean;
}) {
  const count = useMotionValue(0);
  const rounded = useTransform(
    count,
    (latest) =>
      prefix + (decimal ? latest.toFixed(1) : Math.round(latest)) + suffix,
  );

  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!inView) return;
    const controls = animate(count, end, { duration: 2.5, ease: "easeOut" });
    return controls.stop;
  }, [inView, count, end]);

  return (
    <motion.span ref={ref} className="tabular-nums">
      {rounded}
    </motion.span>
  );
}

export default function StatsSection() {
  return (
    <section className="bg-primary py-24 text-white overflow-hidden relative">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute -left-20 -top-20 w-96 h-96 bg-secondary rounded-full blur-[120px]" />
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-accent rounded-full blur-[120px]" />
      </div>
      <div className="max-w-7xl mx-auto px-8 relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-12 text-center">
        {STATS.map((s) => (
          <div key={s.label} data-gsap="stat" className="space-y-2">
            <div className="text-5xl font-headline font-extrabold">
              <CountUp
                end={s.value}
                suffix={s.suffix}
                prefix={s.prefix ?? ""}
                decimal={s.decimal}
              />
            </div>
            <div className="text-xs font-bold uppercase tracking-widest text-secondary">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
