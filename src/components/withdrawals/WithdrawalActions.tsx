"use client";

import axios from "axios";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { IWithdrawal } from "@/types";
import { apiErrorMessage } from "@/lib/api-error";
import { useReadOnly } from "@/hooks/useReadOnly";

const small =
  "text-[11px] px-2 py-1 rounded border border-primary/20 text-primary hover:border-secondary disabled:opacity-50";

/**
 * What a worker can do with a withdrawal that has not been approved yet:
 * ask for a new confirmation email, or cancel it and get the coins back.
 */
export default function WithdrawalActions({ withdrawal }: { withdrawal: IWithdrawal }) {
  const qc = useQueryClient();
  const { readOnly, readOnlyTitle } = useReadOnly();
  const refresh = () => qc.invalidateQueries({ queryKey: ["withdrawals"] });

  const resend = useMutation({
    mutationFn: () => axios.post(`/api/v1/withdrawals/${withdrawal._id}/resend`),
    onSuccess: () => toast.success("A new confirmation email is on its way"),
    onError: (err) => toast.error(apiErrorMessage(err, "Could not send the email")),
  });
  const cancel = useMutation({
    mutationFn: () => axios.post(`/api/v1/withdrawals/${withdrawal._id}/cancel`),
    onSuccess: () => {
      toast.success("Withdrawal cancelled, your coins are back");
      refresh();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not cancel it")),
  });

  async function confirmCancel() {
    const { isConfirmed } = await Swal.fire({
      title: "Cancel this withdrawal?",
      text: "Your coins will be returned.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Cancel withdrawal",
      confirmButtonColor: "#dc2626",
    });
    if (isConfirmed) cancel.mutate();
  }

  const { status } = withdrawal;
  if (status !== "awaiting_confirmation" && status !== "pending") return null;
  return (
    <div className="mt-1 space-y-1">
      {status === "awaiting_confirmation" && (
        <p className="text-[11px] text-orange-700">Check your email and confirm within 30 minutes</p>
      )}
      <div className="flex gap-1 flex-wrap justify-end">
        {status === "awaiting_confirmation" && (
          <button
            onClick={() => resend.mutate()}
            disabled={readOnly || resend.isPending}
            title={readOnly ? readOnlyTitle : "Send a new confirmation email"}
            className={small}
          >
            Resend email
          </button>
        )}
        <button
          onClick={confirmCancel}
          disabled={readOnly || cancel.isPending}
          title={readOnly ? readOnlyTitle : "Cancel and get your coins back"}
          className={small}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
