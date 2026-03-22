"use client";

import { useEffect, useRef } from "react";
import {
  useMotionValue,
  useTransform,
  animate,
  motion,
  useInView,
} from "framer-motion";

interface CountUpProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  duration?: number;
}

export default function CountUp({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
  duration = 2,
}: CountUpProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(
    count,
    (v) => prefix + v.toFixed(decimals) + suffix,
  );
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (!inView) return;
    const controls = animate(count, value, { duration, ease: "easeOut" });
    return controls.stop;
  }, [inView, value, count, duration]);

  return (
    <motion.span ref={ref} className={className}>
      {rounded}
    </motion.span>
  );
}
