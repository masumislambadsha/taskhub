"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { MdChevronLeft, MdChevronRight, MdReplay } from "react-icons/md";
import { apiErrorMessage } from "@/lib/api-error";
import { useReadOnly } from "@/hooks/useReadOnly";

interface PaymentEventRow {
  _id: string;
  provider: string;
  eventId: string;
  type: string;
  paymentId?: string;
  deliveries: number;
  receivedAt: string;
  outcome?: string;
  ok?: boolean;
  replays: number;
}

export default function AdminPaymentEventsPage() {
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState("");
  const [onlyFailed, setOnlyFailed] = useState(false);
  const qc = useQueryClient();
  const { readOnly, readOnlyTitle } = useReadOnly();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payment-events", page, provider, onlyFailed],
    queryFn: () =>
      axios
        .get("/api/v1/admin/payment-events", {
          params: { page, provider, ok: onlyFailed ? "false" : undefined },
        })
        .then((r) => r.data),
  });

  const replay = useMutation({
    mutationFn: (id: string) =>
      axios
        .post(`/api/v1/admin/payment-events/${id}/replay`)
        .then((r) => r.data),
    onSuccess: (result: { outcome: string }) => {
      toast.success(`Replayed: ${result.outcome}`);
      qc.invalidateQueries({ queryKey: ["admin-payment-events"] });
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Replay failed")),
  });

  const events: PaymentEventRow[] = data?.events ?? [];
  const pages: number = data?.pages ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          Payment Events
        </h1>
        <p className="text-primary/60 text-sm mt-1">
          Every webhook and callback from Stripe, bKash and SSLCommerz. Replaying
          one is safe: a payment is never credited twice.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg border border-primary/20 bg-white text-sm text-primary"
        >
          <option value="">All providers</option>
          <option value="stripe">Stripe</option>
          <option value="bkash">bKash</option>
          <option value="sslcommerz">SSLCommerz</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-primary">
          <input
            type="checkbox"
            checked={onlyFailed}
            onChange={(e) => {
              setOnlyFailed(e.target.checked);
              setPage(1);
            }}
          />
          Only events that did not credit
        </label>
      </div>

      <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-x-auto">
        {isLoading ? (
          <p className="p-6 text-sm text-primary/40">Loading…</p>
        ) : events.length === 0 ? (
          <p className="p-6 text-sm text-primary/40">No events found</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-primary/50 border-b border-primary/5">
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Deliveries</th>
                <th className="px-4 py-3">Replays</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e._id} className="border-b border-primary/5 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {format(new Date(e.receivedAt), "MMM d, HH:mm")}
                  </td>
                  <td className="px-4 py-3 capitalize">{e.provider}</td>
                  <td className="px-4 py-3" title={e.eventId}>
                    {e.type}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        e.ok
                          ? "text-green-700"
                          : e.outcome
                            ? "text-red-600"
                            : "text-primary/40"
                      }
                    >
                      {e.outcome ?? "pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{e.deliveries}</td>
                  <td className="px-4 py-3">{e.replays}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => replay.mutate(e._id)}
                      disabled={readOnly || replay.isPending}
                      title={readOnly ? readOnlyTitle : "Process this event again"}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-primary/20 text-primary hover:border-secondary disabled:opacity-50"
                    >
                      <MdReplay /> Replay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-3 justify-end text-sm text-primary">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-primary/20 disabled:opacity-40"
            aria-label="Previous page"
          >
            <MdChevronLeft />
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="p-2 rounded-lg border border-primary/20 disabled:opacity-40"
            aria-label="Next page"
          >
            <MdChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}
