"use client";
import {
  MdCategory,
  MdChevronLeft,
  MdChevronRight,
  MdClose,
  MdGroup,
  MdTaskAlt,
  MdToll,
} from "react-icons/md";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ITask } from "@/types";
import Badge from "@/components/ui/Badge";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import Image from "next/image";
import type { Selection } from "@heroui/react";
import {
  Dropdown,
  DropdownMenu,
  DropdownPopover,
  DropdownSection,
  DropdownItem,
  DropdownItemIndicator,
  Button,
  Label,
} from "@heroui/react";

const swalTheme = {
  confirmButtonColor: "#4a9782",
  cancelButtonColor: "#004030",
  background: "#fff9e5",
  color: "#00281d",
};
const dangerTheme = {
  confirmButtonColor: "#dc2626",
  cancelButtonColor: "#004030",
  background: "#fff9e5",
  color: "#00281d",
};

export default function AdminTasksPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tasks", page, status],
    queryFn: () =>
      axios
        .get("/api/v1/admin/tasks", { params: { page, status } })
        .then((r) => r.data),
  });

  const tasks: ITask[] = data?.tasks ?? [];
  const pages: number = data?.pages ?? 1;

  const blockMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      axios.patch("/api/v1/admin/tasks", { id, status: newStatus }),
    onError: () => toast.error("Update failed"),
  });

  const handleBlockToggle = (t: ITask) => {
    const isBlocked = t.status === "blocked";
    Swal.fire({
      title: isBlocked ? "Unblock Task?" : "Block Task?",
      text: isBlocked
        ? "This will restore the task to open."
        : "Workers won't be able to see this task.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: isBlocked ? "Yes, unblock" : "Yes, block",
      cancelButtonText: "Cancel",
      ...(isBlocked ? swalTheme : dangerTheme),
    }).then((r) => {
      if (r.isConfirmed)
        blockMutation.mutate(
          { id: t._id, newStatus: isBlocked ? "open" : "blocked" },
          {
            onSuccess: () =>
              qc.invalidateQueries({ queryKey: ["admin-tasks"] }),
          },
        );
    });
  };

  const handleArchiveToggle = (t: ITask) => {
    const isArchived = t.status === "archived";
    Swal.fire({
      title: isArchived ? "Unarchive Task?" : "Archive Task?",
      text: isArchived
        ? "This will restore the task to open."
        : "This will archive the task.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: isArchived ? "Yes, unarchive" : "Yes, archive",
      cancelButtonText: "Cancel",
      ...swalTheme,
    }).then((r) => {
      if (r.isConfirmed)
        blockMutation.mutate(
          { id: t._id, newStatus: isArchived ? "open" : "archived" },
          {
            onSuccess: () =>
              qc.invalidateQueries({ queryKey: ["admin-tasks"] }),
          },
        );
    });
  };

  return (
    <div className="space-y-6">
      
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          Manage Tasks
        </h1>
        <p className="text-primary/60 text-sm mt-1">
          Monitor and moderate all platform tasks
        </p>
      </div>

      
      <div className="flex gap-3 flex-wrap">
        <Dropdown>
           <Button
          variant="outline"
          className="bg-white border-primary/10 text-primary/60 h-10 px-4 pr-8 justify-between font-medium shadow-sm"
        >
            {status
              ? status.charAt(0).toUpperCase() + status.slice(1)
              : "All Status"}
          </Button>
          <DropdownPopover className="min-w-[160px] bg-transparent backdrop-blur-sm">
            <DropdownMenu
              selectedKeys={new Set([status || ""])}
              selectionMode="single"
              onSelectionChange={(keys: Selection) => {
                const val = Array.from(keys)[0] as string;
                setStatus(val);
                setPage(1);
              }}
            >
              <DropdownSection>
                {[
                  { value: "", label: "All Status" },
                  { value: "open", label: "Open" },
                  { value: "closed", label: "Closed" },
                  { value: "blocked", label: "Blocked" },
                  { value: "archived", label: "Archived" },
                ].map((o) => (
                  <DropdownItem key={o.value} id={o.value} textValue={o.label}>
                    <DropdownItemIndicator />
                    <Label className="bg-transparent">{o.label}</Label>
                  </DropdownItem>
                ))}
              </DropdownSection>
            </DropdownMenu>
          </DropdownPopover>
        </Dropdown>
        {status && (
          <button
            onClick={() => {
              setStatus("");
              setPage(1);
            }}
            className="px-4 py-2.5 rounded-lg border border-primary/10 bg-white text-sm text-primary/50 hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <MdClose className="text-sm" />
            Clear
          </button>
        )}
      </div>

      
      <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-primary/5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <MdTaskAlt className="text-5xl text-primary/20" />
            <p className="text-primary/40 text-sm">No tasks found</p>
          </div>
        ) : (
          <div className="divide-y divide-primary/5">
            {tasks.map((t) => {
              const isExpanded = expandedId === t._id;
              return (
                <div key={t._id}>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-4 hover:bg-background/60 transition-colors">
                    
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                        <MdTaskAlt className="text-lg text-secondary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-primary text-sm truncate">
                          {t.title}
                        </p>
                        <p className="text-xs text-primary/40 mt-0.5">
                          by {t.buyerName} ·{" "}
                          {format(new Date(t.completionDate), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>

                    
                    <div className="flex items-center gap-2 sm:gap-5 flex-wrap sm:flex-nowrap">
                      
                      <div className="flex items-center gap-1 bg-primary/5 px-2.5 py-1.5 rounded-lg">
                        <MdGroup className="text-sm" />
                        <span className="text-xs font-semibold text-primary">
                          {t.filledWorkers}/{t.requiredWorkers}
                        </span>
                      </div>

                      
                      <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1.5 rounded-lg">
                        <MdToll className="text-sm text-amber-500" />
                        <span className="text-xs font-bold text-primary">
                          {t.payableAmount}
                        </span>
                      </div>

                      <Badge status={t.status} />

                      
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() =>
                            setExpandedId(isExpanded ? null : t._id)
                          }
                          className="flex-1 sm:flex-none text-xs px-3 py-1.5 rounded-lg font-medium bg-primary/5 text-primary hover:bg-primary/10 border border-primary/10 transition-colors flex items-center justify-center gap-1"
                        >
                          <MdCategory className="text-secondary text-xl" />
                          {isExpanded ? "Hide" : "Details"}
                        </button>
                        <button
                          onClick={() => handleBlockToggle(t)}
                          className={`flex-1 sm:flex-none text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                            t.status === "blocked"
                              ? "bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                              : "bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                          }`}
                        >
                          {t.status === "blocked" ? "Unblock" : "Block"}
                        </button>
                        <button
                          onClick={() => handleArchiveToggle(t)}
                          className={`flex-1 sm:flex-none text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                            t.status === "archived"
                              ? "bg-secondary/10 text-secondary hover:bg-secondary/20 border-secondary/20"
                              : "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200"
                          }`}
                        >
                          {t.status === "archived" ? "Unarchive" : "Archive"}
                        </button>
                      </div>
                    </div>
                  </div>

                  
                  {isExpanded && (
                    <div className="px-4 sm:px-5 pb-5 bg-background/40 border-t border-primary/5">
                      <div className="pt-4 space-y-4">
                        {t.imageUrl && (
                          <div className="relative w-full h-40 rounded-xl overflow-hidden">
                            <Image
                              src={t.imageUrl}
                              alt={t.title}
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                          <div className="bg-white rounded-lg p-3 border border-primary/5">
                            <p className="text-primary/40 text-[10px] uppercase font-semibold mb-1">
                              Buyer
                            </p>
                            <p className="text-primary font-medium text-sm truncate">
                              {t.buyerName}
                            </p>
                            <p className="text-primary/40 text-xs truncate">
                              {t.buyerEmail}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-primary/5">
                            <p className="text-primary/40 text-[10px] uppercase font-semibold mb-1">
                              Reward
                            </p>
                            <p className="text-primary font-medium">
                              {t.payableAmount} coins
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-primary/5">
                            <p className="text-primary/40 text-[10px] uppercase font-semibold mb-1">
                              Workers
                            </p>
                            <p className="text-primary font-medium">
                              {t.filledWorkers} / {t.requiredWorkers}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-primary/5">
                            <p className="text-primary/40 text-[10px] uppercase font-semibold mb-1">
                              Deadline
                            </p>
                            <p className="text-primary font-medium">
                              {format(
                                new Date(t.completionDate),
                                "MMM d, yyyy",
                              )}
                            </p>
                          </div>
                          {t.category && (
                            <div className="bg-white rounded-lg p-3 border border-primary/5">
                              <p className="text-primary/40 text-[10px] uppercase font-semibold mb-1">
                                Category
                              </p>
                              <p className="text-primary font-medium">
                                {t.category}
                              </p>
                            </div>
                          )}
                          <div className="bg-white rounded-lg p-3 border border-primary/5">
                            <p className="text-primary/40 text-[10px] uppercase font-semibold mb-1">
                              Created
                            </p>
                            <p className="text-primary font-medium">
                              {format(new Date(t.createdAt), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        {t.details && (
                          <div className="bg-white rounded-lg p-4 border border-primary/5">
                            <p className="text-primary/40 text-[10px] uppercase font-semibold mb-2">
                              Details
                            </p>
                            <p className="text-primary/80 text-sm leading-relaxed">
                              {t.details}
                            </p>
                          </div>
                        )}
                        {t.submissionInfo && (
                          <div className="bg-white rounded-lg p-4 border border-primary/5">
                            <p className="text-primary/40 text-[10px] uppercase font-semibold mb-2">
                              Submission Info
                            </p>
                            <p className="text-primary/80 text-sm leading-relaxed">
                              {t.submissionInfo}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      
      {pages > 1 && (
        <div className="flex justify-center gap-2 flex-wrap">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-9 h-9 rounded-lg text-sm font-semibold border border-primary/10 bg-white text-primary hover:border-secondary disabled:opacity-30 transition-colors flex items-center justify-center"
          >
            <MdChevronLeft className="text-xl" />
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                page === p
                  ? "bg-primary text-white"
                  : "bg-white border border-primary/10 text-primary hover:border-secondary"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="w-9 h-9 rounded-lg text-sm font-semibold border border-primary/10 bg-white text-primary hover:border-secondary disabled:opacity-30 transition-colors flex items-center justify-center"
          >
            <MdChevronRight className="text-xl" />
          </button>
        </div>
      )}
    </div>
  );
}
