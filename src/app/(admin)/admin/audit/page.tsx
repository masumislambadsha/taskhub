"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { format } from "date-fns";
import { MdChevronLeft, MdChevronRight, MdDownload } from "react-icons/md";
import { apiErrorMessage } from "@/lib/api-error";

interface AuditRow {
  _id: string;
  createdAt: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  ip?: string;
}

const EMPTY = { actor: "", action: "", target: "", from: "", to: "" };

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);

  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-audit", page, filters],
    queryFn: () =>
      axios.get("/api/v1/admin/audit", { params: { ...params, page } }).then((r) => r.data),
    retry: false,
  });

  const entries: AuditRow[] = data?.entries ?? [];
  const pages: number = data?.pages ?? 1;
  const exportHref = `/api/v1/admin/audit/export?${new URLSearchParams(params).toString()}`;

  const field = (name: keyof typeof EMPTY, label: string, type = "text") => (
    <label className="text-xs text-primary/60 flex flex-col gap-1">
      {label}
      <input
        type={type}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        className="px-3 py-2 rounded-lg border border-primary/20 bg-white text-sm text-primary"
      />
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-headline text-2xl font-bold text-primary">Audit Log</h1>
          <p className="text-primary/60 text-sm mt-1">
            Who did what, when and why. Entries are written with the action itself and can
            never be changed.
          </p>
        </div>
        <a
          href={exportHref}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-primary/20 text-sm text-primary hover:border-secondary"
        >
          <MdDownload /> Export CSV
        </a>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setFilters(form);
        }}
        className="flex flex-wrap gap-3 items-end"
      >
        {field("actor", "Actor ID")}
        {field("action", "Action (e.g. withdrawal)")}
        {field("target", "Target ID")}
        {field("from", "From", "date")}
        {field("to", "To", "date")}
        <button className="px-4 py-2 rounded-lg bg-primary text-white text-sm">Filter</button>
        <button
          type="button"
          onClick={() => {
            setForm(EMPTY);
            setFilters(EMPTY);
            setPage(1);
          }}
          className="px-4 py-2 rounded-lg border border-primary/20 text-sm text-primary"
        >
          Clear
        </button>
      </form>

      <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-x-auto">
        {error ? (
          <p className="p-6 text-sm text-red-600">
            {apiErrorMessage(error, "Could not load the audit log")}
          </p>
        ) : isLoading ? (
          <p className="p-6 text-sm text-primary/40">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="p-6 text-sm text-primary/40">No entries found</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-primary/50 border-b border-primary/5">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Change</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e._id} className="border-b border-primary/5 last:border-0 align-top">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {format(new Date(e.createdAt), "MMM d, HH:mm:ss")}
                  </td>
                  <td className="px-4 py-3" title={e.ip}>
                    <span className="font-mono text-xs">{e.actorId}</span>
                    <div className="text-xs text-primary/50">{e.actorRole}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">{e.action}</td>
                  <td className="px-4 py-3">
                    <div>{e.targetType}</div>
                    <div className="font-mono text-xs text-primary/50">{e.targetId}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-primary/70">
                    {e.before && <div>before: {JSON.stringify(e.before)}</div>}
                    {e.after && <div>after: {JSON.stringify(e.after)}</div>}
                    {e.reason && <div>reason: {e.reason}</div>}
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
