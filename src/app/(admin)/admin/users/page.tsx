"use client";
import {
  MdChevronLeft,
  MdChevronRight,
  MdClose,
  MdGroup,
  MdToll,
} from "react-icons/md";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { IUser, UserRole } from "@/types";
import Badge from "@/components/ui/Badge";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import { SkeletonTable } from "@/components/ui/Skeleton";
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

  async function handleRoleChange(
    u: IUser,
    newRole: string,
    el: HTMLSelectElement,
  ) {
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
      updateMutation.mutate({ id: u._id, update: { role: newRole } });
    } else {
      el.value = u.role;
    }
  }

  async function handleToggleStatus(u: IUser) {
    const isSuspending = u.status === "active";
    const result = await Swal.fire({
      title: isSuspending ? "Suspend User?" : "Activate User?",
      text: isSuspending
        ? `${u.name} will lose access to the platform.`
        : `${u.name} will regain access to the platform.`,
      icon: isSuspending ? "warning" : "question",
      showCancelButton: true,
      confirmButtonText: isSuspending ? "Yes, suspend" : "Yes, activate",
      cancelButtonText: "Cancel",
      ...(isSuspending ? dangerTheme : swalTheme),
    });
    if (result.isConfirmed) {
      updateMutation.mutate({
        id: u._id,
        update: { status: isSuspending ? "suspended" : "active" },
      });
    }
  }

  async function handleDelete(u: IUser) {
    const result = await Swal.fire({
      title: "Delete User?",
      text: `This will permanently delete ${u.name}. This cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      ...dangerTheme,
    });
    if (result.isConfirmed) deleteMutation.mutate(u._id);
  }

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
        <Dropdown>
           <Button
          variant="outline"
          className="bg-white border-primary/10 text-primary/60 h-10 px-4 pr-8 justify-between font-medium shadow-sm"
        >
            {role ? role.charAt(0).toUpperCase() + role.slice(1) : "All Roles"}
          </Button>
          <DropdownPopover className="min-w-[150px] bg-transparent backdrop-blur-sm">
            <DropdownMenu
              selectedKeys={new Set([role || ""])}
              selectionMode="single"
              onSelectionChange={(keys: Selection) => {
                setRole(Array.from(keys)[0] as string);
                setPage(1);
              }}
            >
              <DropdownSection>
                {[
                  { value: "", label: "All Roles" },
                  { value: "worker", label: "Worker" },
                  { value: "buyer", label: "Buyer" },
                  { value: "admin", label: "Admin" },
                ].map((o) => (
                  <DropdownItem key={o.value} id={o.value} textValue={o.label}>
                    <DropdownItemIndicator />
                    <Label>{o.label}</Label>
                  </DropdownItem>
                ))}
              </DropdownSection>
            </DropdownMenu>
          </DropdownPopover>
        </Dropdown>
        <Dropdown>
           <Button
          variant="outline"
          className="bg-white border-primary/10 text-primary/60 h-10 px-4 pr-6 justify-between font-medium shadow-sm"
        >
            {status
              ? status.charAt(0).toUpperCase() + status.slice(1)
              : "All Status"}
          </Button>
          <DropdownPopover className="min-w-[150px] bg-transparent backdrop-blur-sm">
            <DropdownMenu
              selectedKeys={new Set([status || ""])}
              selectionMode="single"
              onSelectionChange={(keys: Selection) => {
                setStatus(Array.from(keys)[0] as string);
                setPage(1);
              }}
            >
              <DropdownSection>
                {[
                  { value: "", label: "All Status" },
                  { value: "active", label: "Active" },
                  { value: "suspended", label: "Suspended" },
                ].map((o) => (
                  <DropdownItem key={o.value} id={o.value} textValue={o.label}>
                    <DropdownItemIndicator />
                    <Label>{o.label}</Label>
                  </DropdownItem>
                ))}
              </DropdownSection>
            </DropdownMenu>
          </DropdownPopover>
        </Dropdown>
        {(role || status) && (
          <button
            onClick={() => {
              setRole("");
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
          <SkeletonTable
            rows={8}
            cols={6}
            headers={["User", "Role", "Coins", "Status", "Joined", "Actions"]}
          />
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <MdGroup className="text-5xl text-primary/20 block mb-2 mx-auto" />
            <p className="text-primary/40 text-sm">No users found</p>
          </div>
        ) : (
          <div className="divide-y divide-primary/5">
            {users.map((u) => (
              <div
                key={u._id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-6 py-4 hover:bg-background/60 transition-colors"
              >
                
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 text-secondary font-bold text-sm">
                    {u.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-primary text-sm truncate">
                      {u.name}
                    </p>
                    <p className="text-xs text-primary/40 truncate">
                      {u.email}
                    </p>
                    <p className="text-[10px] text-primary/30 mt-0.5 sm:hidden">
                      Joined {format(new Date(u.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>

                
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  
                  <RoleDropdown user={u} onRoleChange={handleRoleChange} />

                  
                  <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1.5 rounded-lg">
                    <MdToll className="text-sm text-amber-500" />
                    <span className="text-xs font-bold text-primary">
                      {u.coins}
                    </span>
                  </div>

                  
                  <Badge status={u.status} />

                  
                  <div className="flex items-center gap-2 w-full sm:w-44 shrink-0">
                    <button
                      onClick={() => handleToggleStatus(u)}
                      className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                        u.status === "active"
                          ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200"
                          : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                      }`}
                    >
                      {u.status === "active" ? "Suspend" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      className="flex-1 text-xs py-1.5 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
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

function RoleDropdown({
  user,
  onRoleChange,
}: {
  user: IUser;
  onRoleChange: (u: IUser, role: string, el: HTMLSelectElement) => void;
}) {
  const [currentRole, setCurrentRole] = useState<UserRole>(user.role);
  const ROLES: UserRole[] = ["worker", "buyer", "admin"];
  return (
    <Dropdown>
      <Button
        variant="outline"
        className="text-xs border border-primary/15 rounded-lg px-2.5 py-1.5 bg-background text-primary capitalize"
      >
        {currentRole}
      </Button>
      <DropdownPopover className="min-w-[120px] bg-transparent backdrop-blur-sm">
        <DropdownMenu
          selectedKeys={new Set([currentRole])}
          selectionMode="single"
          onSelectionChange={(keys: Selection) => {
            const newRole = Array.from(keys)[0] as UserRole;
            const fakeEl = { value: currentRole } as HTMLSelectElement;
            onRoleChange(user, newRole, fakeEl);
            setCurrentRole(newRole);
          }}
        >
          <DropdownSection>
            {ROLES.map((r) => (
              <DropdownItem key={r} id={r} textValue={r}>
                <DropdownItemIndicator />
                <Label className="capitalize">{r}</Label>
              </DropdownItem>
            ))}
          </DropdownSection>
        </DropdownMenu>
      </DropdownPopover>
    </Dropdown>
  );
}
