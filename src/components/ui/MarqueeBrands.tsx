"use client";

import Marquee from "react-fast-marquee";

const BRANDS = [
  "DATASTREAM",
  "CLOUDCORE",
  "NOVUS AI",
  "VECTOR LABS",
  "METRIC",
  "SYNAPSE",
  "ORBIT",
];

export default function MarqueeBrands() {
  const items = [...BRANDS, ...BRANDS, ...BRANDS];
  return (
    <Marquee
      gradient={false}
      speed={50}
      pauseOnHover
      className="grayscale opacity-40"
    >
      {items.map((name, i) => (
        <span
          key={i}
          className="font-black text-xl tracking-tighter text-primary mx-10"
        >
          {name}
        </span>
      ))}
    </Marquee>
  );
}
