"use client";

import axios from "axios";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import type { ISubmission } from "@/types";
import { apiErrorMessage } from "@/lib/api-error";
import { useReadOnly } from "@/hooks/useReadOnly";
import { useIdempotencyKeys } from "@/lib/use-idempotency-keys";

const small =
  "text-[11px] px-2 py-1 rounded border border-primary/20 text-primary hover:border-secondary disabled:opacity-50";

/**
 * For a rejected submission whose reward is still held: when the rejection
 * becomes final, a button to accept it now so the slot reopens at once, and a
 * button to appeal. While an appeal is open it shows that and a way to withdraw.
 */
export default function RejectionHold({ submission }: { submission: ISubmission }) {
  const qc = useQueryClient();
  const { readOnly, readOnlyTitle } = useReadOnly();
  const idem = useIdempotencyKeys();
  const hold = submission.rejectionHold;
  const refresh = () => qc.invalidateQueries({ queryKey: ["worker-submissions"] });

  const accept = useMutation({
    mutationFn: () => axios.post(`/api/v1/submissions/${submission._id}/accept-rejection`),
    onSuccess: () => {
      toast.success("Rejection accepted");
      refresh();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not accept the rejection")),
  });

  const appeal = useMutation({
    mutationFn: (v: { statement: string; evidence: string[] }) =>
      axios.post("/api/v1/disputes", { submissionId: submission._id, ...v }, idem.config(submission._id)),
    onSuccess: () => {
      idem.done(submission._id);
      toast.success("Appeal sent. An admin will review it.");
      refresh();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not send the appeal")),
  });

  const withdraw = useMutation({
    mutationFn: () =>
      axios.post(`/api/v1/disputes/${hold?.disputeId}/withdraw`),
    onSuccess: () => {
      toast.success("Appeal withdrawn");
      refresh();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not withdraw the appeal")),
  });

  async function startAppeal() {
    const { value, isConfirmed } = await Swal.fire({
      title: "Appeal this rejection",
      html:
        '<textarea id="appeal-statement" class="swal2-textarea" placeholder="Explain why the rejection is unfair (at least 30 characters)"></textarea>' +
        '<input id="appeal-evidence" class="swal2-input" placeholder="Optional: link to an extra screenshot (https://…)">',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Send appeal",
      confirmButtonColor: "#1a4731",
      preConfirm: () => {
        const statement = (document.getElementById("appeal-statement") as HTMLTextAreaElement).value.trim();
        const link = (document.getElementById("appeal-evidence") as HTMLInputElement).value.trim();
        if (statement.length < 30) {
          Swal.showValidationMessage("Write at least 30 characters");
          return false;
        }
        return { statement, evidence: link ? [link] : [] };
      },
    });
    if (isConfirmed && value) appeal.mutate(value);
  }

  if (submission.status !== "rejected" || !hold || hold.settledAt) return null;

  if (hold.disputeId) {
    return (
      <div className="mt-1 space-y-1">
        <p className="text-[11px] text-amber-700">Appeal under review</p>
        <button
          onClick={() => withdraw.mutate()}
          disabled={readOnly || withdraw.isPending}
          title={readOnly ? readOnlyTitle : "Drop the appeal and accept the rejection"}
          className={small}
        >
          Withdraw appeal
        </button>
      </div>
    );
  }
  return (
    <div className="mt-1 space-y-1">
      <p className="text-[11px] text-primary/50">
        Final on {format(new Date(hold.windowEndsAt), "MMM d, HH:mm")}
      </p>
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={startAppeal}
          disabled={readOnly || appeal.isPending}
          title={readOnly ? readOnlyTitle : "Ask an admin to review this rejection"}
          className={small}
        >
          Appeal
        </button>
        <button
          onClick={() => accept.mutate()}
          disabled={readOnly || accept.isPending}
          title={readOnly ? readOnlyTitle : "Accept this rejection now"}
          className={small}
        >
          Accept rejection
        </button>
      </div>
    </div>
  );
}
