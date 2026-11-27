"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { apiErrorMessage } from "@/lib/api-error";

/**
 * The page the email link opens. It only confirms when the worker presses the
 * button, so a mail scanner that opens the link cannot confirm for them.
 */
function ConfirmForm() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const token = params.get("token");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function confirm() {
    setState("busy");
    try {
      await axios.post(`/api/v1/withdrawals/${id}/confirm`, { token });
      setState("done");
    } catch (err) {
      setMessage(apiErrorMessage(err, "Could not confirm the withdrawal"));
      setState("error");
    }
  }

  if (!id || !token) {
    return <p className="text-sm text-primary/60">This confirmation link is incomplete. Open the link from your email again.</p>;
  }
  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-primary/5 p-8 space-y-4">
      <h1 className="font-headline text-xl font-bold text-primary">Confirm your withdrawal</h1>
      {state === "done" ? (
        <>
          <p className="text-sm text-primary/70">Confirmed. An admin will review it and pay you.</p>
          <button
            className="w-full bg-primary text-white py-3 rounded-lg font-bold"
            onClick={() => router.push("/worker/withdrawals")}
          >
            See my withdrawals
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-primary/70">
            Only confirm if you asked for this withdrawal. If you did not, do not press the button and
            change your password.
          </p>
          {state === "error" && <p className="text-sm text-red-600">{message}</p>}
          <button
            className="w-full bg-primary text-white py-3 rounded-lg font-bold disabled:opacity-60"
            onClick={confirm}
            disabled={state === "busy"}
          >
            {state === "busy" ? "Confirming…" : "Confirm withdrawal"}
          </button>
        </>
      )}
    </div>
  );
}

export default function ConfirmWithdrawalPage() {
  return (
    <div className="flex justify-center py-10">
      <Suspense fallback={null}>
        <ConfirmForm />
      </Suspense>
    </div>
  );
}
