"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { IUser } from "@/types";
import Badge from "@/components/ui/Badge";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import { SkeletonTable } from "@/components/ui/Skeleton";

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

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, role, status],
    queryFn: () =>
      axios
        .get("/api/v1/admin/users", { params: { page, role, status } })
        .then((r) => r.data),
  });

  const users: IUser[] = data?.users ?? [];
  const pages: number = data?.pages ?? 1;

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      update,
    }: {
      id: string;
      update: Record<string, string>;
    }) => axios.patch(`/api/v1/admin/users/${id}`, update),
    onSuccess: () => {
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast.error("Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/v1/admin/users/${id}`),
    onSuccess: () => {
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast.error("Delete failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          Manage Users
        </h1>
        <p className="text-primary/60 text-sm mt-1">
          View and manage all platform users
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2.5 rounded-lg border border-primary/20 bg-white text-sm text-primary focus:outline-none focus:ring-2 focus:ring-secondary"
        >
          <option value="">All Roles</option>
          <option value="worker">Worker</option>
          <option value="buyer">Buyer</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2.5 rounded-lg border border-primary/20 bg-white text-sm text-primary focus:outline-none focus:ring-2 focus:ring-secondary"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
        {isLoading ? (
          <SkeletonTable
            rows={8}
            cols={6}
            headers={["User", "Role", "Coins", "Status", "Joined", "Actions"]}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-primary/5">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    User
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Role
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Coins
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Joined
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {users.map((u) => (
                  <tr
                    key={u._id}
                    className="hover:bg-background/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-primary">{u.name}</div>
                      <div className="text-xs text-primary/50">{u.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        defaultValue={u.role}
                        onChange={async (e) => {
                          const newRole = e.target.value;
                          const result = await Swal.fire({
                            title: "Change Role?",
                            text: `Change ${u.name}'s role to "${newRole}"?`,
                            icon: "question",
                            showCancelButton: true,
                            confirmButtonText: "Yes, change it",
                            cancelButtonText: "Cancel",
                            ...swalTheme,
                          });
                          if (result.isConfirmed) {
                            updateMutation.mutate({
                              id: u._id,
                              update: { role: newRole },
                            });
                          } else {
                            // reset select visually
                            e.target.value = u.role;
                          }
                        }}
                        className="text-xs border border-primary/20 rounded px-2 py-1 bg-background text-primary"
                      >
                        <option value="worker">Worker</option>
                        <option value="buyer">Buyer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 font-semibold text-primary">
                      {u.coins}
                    </td>
                    <td className="px-6 py-4">
                      <Badge status={u.status} />
                    </td>
                    <td className="px-6 py-4 text-primary/50">
                      {format(new Date(u.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            const isSuspending = u.status === "active";
                            const result = await Swal.fire({
                              title: isSuspending
                                ? "Suspend User?"
                                : "Activate User?",
                              text: isSuspending
                                ? `${u.name} will lose access to the platform.`
                                : `${u.name} will regain access to the platform.`,
                              icon: isSuspending ? "warning" : "question",
                              showCancelButton: true,
                              confirmButtonText: isSuspending
                                ? "Yes, suspend"
                                : "Yes, activate",
                              cancelButtonText: "Cancel",
                              ...(isSuspending ? dangerTheme : swalTheme),
                            });
                            if (result.isConfirmed) {
                              updateMutation.mutate({
                                id: u._id,
                                update: {
                                  status: isSuspending ? "suspended" : "active",
                                },
                              });
                            }
                          }}
                          className={`text-xs px-2 py-1 rounded ${u.status === "active" ? "bg-yellow-100 font-medium text-yellow-700 hover:bg-yellow-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}
                        >
                          {u.status === "active" ? "Suspend" : "Activate"}
                        </button>
                        <button
                          onClick={async () => {
                            const result = await Swal.fire({
                              title: "Delete User?",
                              text: `This will permanently delete ${u.name}. This cannot be undone.`,
                              icon: "warning",
                              showCancelButton: true,
                              confirmButtonText: "Yes, delete",
                              cancelButtonText: "Cancel",
                              ...dangerTheme,
                            });
                            if (result.isConfirmed) {
                              deleteMutation.mutate(u._id);
                            }
                          }}
                          className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${page === p ? "bg-primary text-white" : "bg-white border border-primary/10 text-primary hover:border-secondary"}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
