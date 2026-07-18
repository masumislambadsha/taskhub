import { useEffect, useRef } from "react";
import { router, useLocalSearchParams } from "expo-router";
import Spinner from "../src/components/ui/Spinner";

export default function PaymentReturn() {
  const { status, paymentId } = useLocalSearchParams<{ status: string; paymentId: string }>();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const timer = setTimeout(() => {
      if (status === "success" && paymentId) {
        router.replace(`/(buyer)/coins?success=1&paymentId=${paymentId}&confirmed=1`);
      } else {
        router.replace("/(buyer)/coins?cancelled=1");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Spinner variant="hub" size="md" message="Confirming Payment..." />
  );
}


