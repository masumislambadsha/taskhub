"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

export default function PaymentReturnPage() {
  const params = useSearchParams();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const status = params.get("status");
    const paymentId = params.get("paymentId");

    if (status === "success" && paymentId) {
      router.replace(
        `/buyer/coins?success=1&paymentId=${paymentId}&confirmed=1`,
      );
    } else {
      router.replace("/buyer/coins?cancelled=1");
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-primary/60">
        <AiOutlineLoading3Quarters className="animate-spin text-3xl text-secondary" />
        <p className="text-sm">Confirming your payment...</p>
      </div>
    </div>
  );
}
