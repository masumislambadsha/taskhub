"use client";

import { useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/lib/api-error";
import { useReadOnly } from "@/hooks/useReadOnly";

interface Row {
  _id: string;
  status: string;
  createdAt: string;
  ageHours: number;
  overdue: boolean;
  submission: { taskTitle: string; payableAmount: number; workerName: string; taskBuyerName: string } | null;
}

const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);

export default function AdminDisputesPage() {
  const [open, setOpen] = useState<string | null>(null);
  const qc = useQueryClient();
  const { readOnly, readOnlyTitle } = useReadOnly();

  const list = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: () => axios.get("/api/v1/admin/disputes").then((r) => r.data),
  });
  const detail = useQuery({
    queryKey: ["admin-dispute", open],
    enabled: Boolean(open),
    queryFn: () => axios.get(`/api/v1/admin/disputes/${open}`).then((r) => r.data),
  });

  const claim = useMutation({
    mutationFn: (id: string) => axios.post(`/api/v1/admin/disputes/${id}/claim`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-disputes"] });
      qc.invalidateQueries({ queryKey: ["admin-dispute"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not claim it")),
  });
  const decide = useMutation({
    mutationFn: (v: { id: string; winner: "worker" | "buyer"; note: string }) =>
      axios.post(`/api/v1/admin/disputes/${v.id}/decide`, { winner: v.winner, note: v.note }),
    onSuccess: () => {
      toast.success("Decision saved");
      setOpen(null);
      qc.invalidateQueries({ queryKey: ["admin-disputes"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not save the decision")),
  });

  async function choose(id: string, winner: "worker" | "buyer") {
    const { value, isConfirmed } = await Swal.fire({
      title: winner === "worker" ? "Decide for the worker" : "Decide for the buyer",
      text: winner === "worker" ? "The held reward is paid to the worker." : "The rejection stands and the slot reopens.",
      input: "textarea",
      inputPlaceholder: "Note for the record (at least 10 characters)",
      showCancelButton: true,
      confirmButtonColor: "#1a4731",
      inputValidator: (v) => (v.trim().length < 10 ? "Write at least 10 characters" : undefined),
    });
    if (isConfirmed && value) decide.mutate({ id, winner, note: value });
  }

  const rows: Row[] = list.data?.disputes ?? [];
  const d = detail.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">Disputes</h1>
        <p className="text-primary/60 text-sm mt-1">Oldest first. Anything older than 48 hours is marked overdue.</p>
      </div>

      <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-x-auto">
        {list.isLoading ? (
          <p className="p-6 text-sm text-primary/40">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-primary/40">No open disputes</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-primary/50 border-b border-primary/5">
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Coins</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="border-b border-primary/5 last:border-0">
                  <td className="px-4 py-3">{r.submission?.taskTitle}</td>
                  <td className="px-4 py-3">{r.submission?.workerName}</td>
                  <td className="px-4 py-3">{r.submission?.taskBuyerName}</td>
                  <td className="px-4 py-3">{r.submission?.payableAmount}</td>
                  <td className={`px-4 py-3 ${r.overdue ? "text-red-600 font-semibold" : ""}`}>
                    {r.ageHours}h{r.overdue ? " overdue" : ""}
                  </td>
                  <td className="px-4 py-3">{r.status.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setOpen(r._id)} className="px-3 py-1.5 rounded-lg border border-primary/20 text-primary hover:border-secondary">
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && d && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start gap-4">
              <div>
                <h2 className="font-bold text-primary text-lg">{d.task?.title}</h2>
                <p className="text-xs text-primary/50">
                  Appealed {format(new Date(d.dispute.createdAt), "MMM d, HH:mm")} · {d.submission?.payableAmount} coins held
                </p>
              </div>
              <button onClick={() => setOpen(null)} className="text-primary/40 hover:text-primary" aria-label="Close">✕</button>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <section className="space-y-1">
                <h3 className="font-semibold text-primary">Task requirements</h3>
                <p>{d.task?.details}</p>
                <p className="text-primary/60"><b>Proof asked:</b> {d.task?.submissionInfo}</p>
              </section>
              <section className="space-y-1">
                <h3 className="font-semibold text-primary">Worker&apos;s proof</h3>
                <p>{d.submission?.details}</p>
                {d.submission?.proofLinks?.map((u: string) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="block text-secondary underline break-all">{u}</a>
                ))}
                {d.submission?.proofImageUrl && (
                  <a href={d.submission.proofImageUrl} target="_blank" rel="noreferrer" className="block text-secondary underline break-all">Proof image</a>
                )}
              </section>
              <section className="space-y-1">
                <h3 className="font-semibold text-primary">Buyer: {d.buyer.name}</h3>
                <p><b>Rejected because:</b> {d.submission?.rejectionReason || "No reason given"}</p>
                <p><b>Reply:</b> {d.dispute.buyerStatement || "None yet"}</p>
                <p className="text-xs text-primary/60">
                  Rejection rate {pct(d.buyer.history.rejectionRate)} · overturned on appeal {pct(d.buyer.history.overturnedRate)}
                  {d.buyer.history.harshReviewer && <b className="text-red-600"> · flagged: often overturned</b>}
                </p>
              </section>
              <section className="space-y-1">
                <h3 className="font-semibold text-primary">Worker: {d.worker.name}</h3>
                <p><b>Appeal:</b> {d.dispute.workerStatement}</p>
                {d.dispute.workerEvidence.map((u: string) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="block text-secondary underline break-all">{u}</a>
                ))}
                <p className="text-xs text-primary/60">
                  Approval rate {pct(d.worker.history.approvalRate)} · disputes won {d.worker.history.disputes.won}, lost {d.worker.history.disputes.lost}
                </p>
              </section>
            </div>

            {(d.dispute.status === "open" || d.dispute.status === "under_review") && (
              <div className="flex gap-2 flex-wrap pt-2 border-t border-primary/5">
                {d.dispute.status === "open" && (
                  <button onClick={() => claim.mutate(open)} disabled={readOnly} title={readOnly ? readOnlyTitle : undefined} className="px-4 py-2 rounded-lg border border-primary/20 text-sm disabled:opacity-50">
                    Start review
                  </button>
                )}
                <button onClick={() => choose(open, "worker")} disabled={readOnly} title={readOnly ? readOnlyTitle : undefined} className="px-4 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-50">
                  Worker wins
                </button>
                <button onClick={() => choose(open, "buyer")} disabled={readOnly} title={readOnly ? readOnlyTitle : undefined} className="px-4 py-2 rounded-lg bg-secondary text-white text-sm disabled:opacity-50">
                  Buyer wins
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
