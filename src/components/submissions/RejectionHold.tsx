"use client";

import axios from "axios";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import type { ISubmission } from "@/types";
import { apiErrorMessage } from "@/lib/api-error";
import { useReadOnly } from "@/hooks/useReadOnly";

/**
 * For a rejected submission whose reward is still held: when the rejection
 * becomes final, and a button to accept it now so the slot reopens at once.
 */
export default function RejectionHold({ submission }: { submission: ISubmission }) {
  const qc = useQueryClient();
  const { readOnly, readOnlyTitle } = useReadOnly();
  const hold = submission.rejectionHold;
  const accept = useMutation({
    mutationFn: () => axios.post(`/api/v1/submissions/${submission._id}/accept-rejection`),
    onSuccess: () => {
      toast.success("Rejection accepted");
      qc.invalidateQueries({ queryKey: ["worker-submissions"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not accept the rejection")),
  });

  if (submission.status !== "rejected" || !hold || hold.settledAt) return null;
  return (
    <div className="mt-1 space-y-1">
      <p className="text-[11px] text-primary/50">
        Final on {format(new Date(hold.windowEndsAt), "MMM d, HH:mm")}
      </p>
      <button
        onClick={() => accept.mutate()}
        disabled={readOnly || accept.isPending}
        title={readOnly ? readOnlyTitle : "Accept this rejection now"}
        className="text-[11px] px-2 py-1 rounded border border-primary/20 text-primary hover:border-secondary disabled:opacity-50"
      >
        Accept rejection
      </button>
    </div>
  );
}
