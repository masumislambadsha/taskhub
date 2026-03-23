"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import CountUp from "@/components/ui/CountUp";

const PACKAGES = [
  { coins: 10, price: 1, label: "Starter" },
  { coins: 150, price: 10, label: "Basic" },
  { coins: 500, price: 20, label: "Pro" },
  { coins: 1000, price: 35, label: "Elite" },
];

export default function CoinPackageCards() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleClick = () => {
    if (!session) {
      router.push("/login");
      return;
    }
    if (session.user.role === "buyer") router.push("/buyer/coins");
    else router.push("/buyer/coins");
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {PACKAGES.map((p) => (
        <button
          key={p.label}
          onClick={handleClick}
          data-gsap="coin-card"
          className="group p-5 rounded-xl border border-primary/10 bg-white text-center cursor-pointer transition-all duration-200 hover:bg-primary hover:border-primary hover:shadow-xl"
        >
          <div className="text-xs font-bold uppercase tracking-wider mb-2 text-primary/40 group-hover:text-secondary transition-colors">
            {p.label}
          </div>
          <div className="text-2xl font-bold font-headline text-primary group-hover:text-white transition-colors">
            <CountUp value={p.coins} />
          </div>
          <div className="text-xs mb-3 text-primary/50 group-hover:text-white/60 transition-colors">
            coins
          </div>
          <div className="text-lg font-bold text-secondary">
            $<CountUp value={p.price} />
          </div>
        </button>
      ))}
    </div>
  );
}
