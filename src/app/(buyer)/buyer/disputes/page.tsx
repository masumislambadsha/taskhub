"use client";

import { useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/lib/api-error";

interface Row {
  _id: string;
  status: string;
  workerStatement: string;
  workerEvidence: string[];
  buyerStatement?: string;
  adminNote?: string;
  createdAt: string;
  submission: { taskTitle: string; payableAmount: number; rejectionReason?: string } | null;
}

const REPLY_MS = 48 * 3600 * 1000;
const LABEL: Record<string, string> = {
  open: "Waiting for an admin",
  under_review: "Under review",
  resolved_worker: "Decided for the worker",
  resolved_buyer: "Decided for you",
  withdrawn: "Withdrawn by the worker",
};

export default function BuyerDisputesPage() {
  const qc = useQueryClient();
  // Read once per visit; it only decides whether the 48-hour reply window is still open.
  const [now] = useState(() => Date.now());
  const { data, isLoading } = useQuery({
    queryKey: ["buyer-disputes"],
    queryFn: () => axios.get("/api/v1/disputes").then((r) => r.data),
  });
  const reply = useMutation({
    mutationFn: (v: { id: string; statement: string }) =>
      axios.post(`/api/v1/disputes/${v.id}/buyer-statement`, { statement: v.statement }),
    onSuccess: () => {
      toast.success("Your reply was added");
      qc.invalidateQueries({ queryKey: ["buyer-disputes"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not add your reply")),
  });

  async function addReply(id: string) {
    const { value, isConfirmed } = await Swal.fire({
      title: "Your side",
      input: "textarea",
      inputPlaceholder: "Explain why you rejected it (at least 30 characters)",
      showCancelButton: true,
      confirmButtonColor: "#1a4731",
      inputValidator: (v) => (v.trim().length < 30 ? "Write at least 30 characters" : undefined),
    });
    if (isConfirmed && value) reply.mutate({ id, statement: value });
  }

  const rows: Row[] = data?.disputes ?? [];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">Disputes</h1>
        <p className="text-primary/60 text-sm mt-1">
          Workers can appeal a rejection. You have 48 hours to add your side before an admin decides.
        </p>
      </div>
      {isLoading ? (
        <p className="text-sm text-primary/40">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-primary/40">No disputes</p>
      ) : (
        <div className="space-y-4">
          {rows.map((d) => {
            const active = d.status === "open" || d.status === "under_review";
            const canReply = active && !d.buyerStatement && now - new Date(d.createdAt).getTime() < REPLY_MS;
            return (
              <div key={d._id} className="bg-white rounded-xl border border-primary/5 shadow-sm p-5 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <p className="font-semibold text-primary">{d.submission?.taskTitle ?? "Task"}</p>
                  <span className="text-xs text-primary/60">{LABEL[d.status] ?? d.status}</span>
                </div>
                <p className="text-xs text-primary/50">
                  Appealed {format(new Date(d.createdAt), "MMM d, HH:mm")} · {d.submission?.payableAmount} coins
                </p>
                {d.submission?.rejectionReason && <p><b>Your reason:</b> {d.submission.rejectionReason}</p>}
                <p><b>Worker says:</b> {d.workerStatement}</p>
                {d.workerEvidence.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="block text-secondary underline break-all">{u}</a>
                ))}
                {d.buyerStatement && <p><b>Your reply:</b> {d.buyerStatement}</p>}
                {d.adminNote && <p><b>Admin note:</b> {d.adminNote}</p>}
                {canReply && (
                  <button onClick={() => addReply(d._id)} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs">
                    Add your side
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
