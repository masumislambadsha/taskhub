"use client";

import axios from "axios";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/lib/api-error";
import { useReadOnly } from "@/hooks/useReadOnly";

interface SubInfo {
  taskTitle: string;
  proofImageUrl?: string;
  workerName: string;
}
interface Flag {
  _id: string;
  severity: "low" | "medium" | "high";
  createdAt: string;
  userName: string | null;
  otherUserName: string | null;
  evidence: { distance?: number; sameWorker?: boolean; role?: "copy" | "original" };
  submission: SubInfo | null;
  otherSubmission: SubInfo | null;
}

const SEVERITY = { high: "bg-red-100 text-red-700", medium: "bg-amber-100 text-amber-700", low: "bg-primary/10 text-primary/70" };

export default function AdminFraudPage() {
  const qc = useQueryClient();
  const { readOnly, readOnlyTitle } = useReadOnly();
  const list = useQuery({
    queryKey: ["admin-fraud-flags"],
    queryFn: () => axios.get("/api/v1/admin/fraud-flags").then((r) => r.data),
  });
  const review = useMutation({
    mutationFn: (v: { id: string; status: "dismissed" | "confirmed" }) =>
      axios.patch(`/api/v1/admin/fraud-flags/${v.id}`, { status: v.status }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-fraud-flags"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not save")),
  });
  const flags: Flag[] = list.data?.flags ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">Fraud flags</h1>
        <p className="text-primary/60 text-sm mt-1">
          Screenshots that look the same as an earlier one. Highest severity first. The earlier worker is probably the
          original; a flag is a lead, not a verdict.
        </p>
      </div>
      <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-x-auto">
        {list.isLoading ? (
          <p className="p-6 text-sm text-primary/40">Loading…</p>
        ) : flags.length === 0 ? (
          <p className="p-6 text-sm text-primary/40">No open flags</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-primary/50 border-b border-primary/5">
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Matches</th>
                <th className="px-4 py-3">Screenshots</th>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f._id} className="border-b border-primary/5 last:border-0 align-top">
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SEVERITY[f.severity]}`}>{f.severity}</span>
                  </td>
                  <td className="px-4 py-3">
                    {f.userName}
                    <span className="block text-xs text-primary/40">{f.evidence.role === "original" ? "earlier submission" : "later submission"}</span>
                  </td>
                  <td className="px-4 py-3">{f.submission?.taskTitle}</td>
                  <td className="px-4 py-3">
                    {f.evidence.sameWorker ? "their own earlier proof" : f.otherUserName}
                    <span className="block text-xs text-primary/40">
                      {f.evidence.distance === 0 ? "identical file" : `${f.evidence.distance} of 64 bits differ`}
                    </span>
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    {f.submission?.proofImageUrl && (
                      <a href={f.submission.proofImageUrl} target="_blank" rel="noreferrer noopener" className="text-secondary underline">
                        this
                      </a>
                    )}
                    {f.otherSubmission?.proofImageUrl && (
                      <a href={f.otherSubmission.proofImageUrl} target="_blank" rel="noreferrer noopener" className="text-secondary underline">
                        other
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-primary/50">{format(new Date(f.createdAt), "MMM d, h:mm a")}</td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      disabled={readOnly || review.isPending}
                      title={readOnlyTitle}
                      onClick={() => review.mutate({ id: f._id, status: "dismissed" })}
                      className="px-3 py-1.5 rounded-lg border border-primary/20 text-primary hover:border-secondary disabled:opacity-40"
                    >
                      Dismiss
                    </button>
                    <button
                      disabled={readOnly || review.isPending}
                      title={readOnlyTitle}
                      onClick={() => review.mutate({ id: f._id, status: "confirmed" })}
                      className="px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-40"
                    >
                      Confirm
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
