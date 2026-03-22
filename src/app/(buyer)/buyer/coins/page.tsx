"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import axios from "axios";
import toast from "react-hot-toast";
import { COIN_PACKAGES, PAYMENT_GATEWAYS } from "@/lib/constants";
import { CoinPackage } from "@/types";

export default function BuyCoinsPage() {
  const { data: session, update } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const [selectedGateway, setSelectedGateway] = useState<string>("stripe");

  // Handle success redirect
  useEffect(() => {
    const paymentId = params.get("paymentId");
    const success = params.get("success");
    const sandbox = params.get("sandbox");

    if (success && paymentId) {
      axios
        .post("/api/v1/payments/confirm", { paymentId })
        .then((r) => {
          toast.success(`${r.data.coins} coins added to your account!`);
          update();
          router.replace("/buyer/coins");
        })
        .catch(() => {
          // Webhook may have already confirmed it
          toast.success("Payment successful! Coins added.");
          update();
          router.replace("/buyer/coins");
        });
    } else if (params.get("cancelled")) {
      toast.error("Payment cancelled.");
      router.replace("/buyer/coins");
    }
  }, []);

  const buyMutation = useMutation({
    mutationFn: ({
      packageId,
      gateway,
    }: {
      packageId: string;
      gateway: string;
    }) =>
      axios
        .post("/api/v1/payments/create-session", { packageId, gateway })
        .then((r) => r.data),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: () => toast.error("Failed to initiate payment"),
  });

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          Purchase Coins
        </h1>
        <p className="text-primary/60 text-sm mt-1">
          Current balance:{" "}
          <span className="font-semibold text-secondary">
            {session?.user?.coins ?? 0} coins
          </span>
        </p>
      </div>

      {/* Gateway selector */}
      <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-5">
        <p className="text-sm font-medium text-primary mb-3">Payment Method</p>
        <div className="flex gap-3 flex-wrap">
          {PAYMENT_GATEWAYS.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGateway(g)}
              className={`px-5 py-2.5 rounded-lg border-2 text-sm font-semibold capitalize transition-all ${selectedGateway === g ? "border-secondary bg-secondary/5 text-primary" : "border-primary/10 text-primary/60 hover:border-secondary/50"}`}
            >
              {g === "stripe"
                ? "💳 Stripe"
                : g === "bkash"
                  ? "📱 bKash"
                  : "🏦 SSLCommerz"}
            </button>
          ))}
        </div>
        {selectedGateway !== "stripe" && (
          <p className="text-xs text-amber-600 mt-2">
            ⚠️ {selectedGateway} is in sandbox mode for this portfolio project.
          </p>
        )}
      </div>

      {/* Packages */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {COIN_PACKAGES.map((pkg: CoinPackage) => (
          <div
            key={pkg.id}
            className="bg-white rounded-xl border-2 border-primary/5 shadow-sm p-5 text-center flex flex-col gap-3 transition-all"
          >
            <div className="text-xs font-bold uppercase tracking-wider text-primary/40">
              {pkg.label}
            </div>
            <div className="flex items-center justify-center gap-1">
              <span
                className="material-symbols-outlined text-amber-500"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                toll
              </span>
              <span className="text-3xl font-bold font-headline text-primary">
                {pkg.coins}
              </span>
            </div>
            <div className="text-xs text-primary/50">coins</div>
            <div className="text-xl font-bold text-secondary">${pkg.price}</div>
            <button
              onClick={() =>
                buyMutation.mutate({
                  packageId: pkg.id,
                  gateway: selectedGateway,
                })
              }
              disabled={buyMutation.isPending}
              className="w-full py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-60 bg-primary text-white hover:bg-primary/90"
            >
              {buyMutation.isPending ? "…" : "Buy Now"}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-background rounded-xl border border-primary/10 p-4 text-sm text-primary/60">
        <p>
          <strong className="text-primary">Note:</strong> 10 coins = $1 USD.
          Coins are non-refundable once used to post tasks.
        </p>
      </div>
    </div>
  );
}
