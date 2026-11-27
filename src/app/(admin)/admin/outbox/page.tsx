"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { MdReplay } from "react-icons/md";
import { apiErrorMessage } from "@/lib/api-error";

interface Row {
  _id: string;
  type: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  nextAttemptAt: string;
  lastError?: string;
  createdAt: string;
  payload: { message?: string; subject?: string; url?: string };
}

export default function AdminOutboxPage() {
  const [status, setStatus] = useState("");
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-outbox", status],
    queryFn: () => axios.get("/api/v1/admin/outbox", { params: { status: status || undefined } }).then((r) => r.data),
    retry: false,
  });
  const retry = useMutation({
    mutationFn: (id: string) => axios.post(`/api/v1/admin/outbox/${id}/retry`),
    onSuccess: () => {
      toast.success("Queued again");
      qc.invalidateQueries({ queryKey: ["admin-outbox"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not retry it")),
  });

  const rows: Row[] = data?.rows ?? [];
  const counts: Record<string, number> = data?.counts ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">Outbox</h1>
        <p className="text-primary/60 text-sm mt-1">
          Notifications, emails and webhooks are queued with the change that causes them and sent
          by the worker. A row that fails 8 times stops here until you retry it.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap items-center text-sm">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-primary/20 bg-white text-primary"
        >
          <option value="">Failed and waiting</option>
          <option value="failed">Failed</option>
          <option value="pending">Waiting to send</option>
          <option value="sent">Sent</option>
        </select>
        <span className="text-primary/60">
          {counts.failed ?? 0} failed · {counts.pending ?? 0} waiting · {counts.sent ?? 0} sent
        </span>
      </div>

      <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-x-auto">
        {error ? (
          <p className="p-6 text-sm text-red-600">{apiErrorMessage(error, "Could not load the outbox")}</p>
        ) : isLoading ? (
          <p className="p-6 text-sm text-primary/40">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-primary/40">Nothing here</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-primary/50 border-b border-primary/5">
                <th className="px-4 py-3">Queued</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">What</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="border-b border-primary/5 last:border-0 align-top">
                  <td className="px-4 py-3 whitespace-nowrap">{format(new Date(r.createdAt), "MMM d, HH:mm")}</td>
                  <td className="px-4 py-3">{r.type}</td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="truncate" title={r.payload.message ?? r.payload.subject ?? r.payload.url}>
                      {r.payload.message ?? r.payload.subject ?? r.payload.url}
                    </div>
                    {r.lastError && <div className="text-xs text-red-600">{r.lastError}</div>}
                  </td>
                  <td className="px-4 py-3">{r.status}</td>
                  <td className="px-4 py-3">{r.attempts}</td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "failed" && (
                      <button
                        onClick={() => retry.mutate(r._id)}
                        disabled={retry.isPending}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-primary/20 text-primary hover:border-secondary disabled:opacity-50"
                      >
                        <MdReplay /> Retry
                      </button>
                    )}
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
