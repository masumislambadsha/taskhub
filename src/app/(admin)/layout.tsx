import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import { isAdminRole, isDemoAdmin } from "@/lib/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!isAdminRole(session.user.role)) redirect("/login");
  const demo = isDemoAdmin(session.user.role);
  return (
    <DashboardShell role={demo ? "demo_admin" : "admin"}>
      {demo && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
        >
          Read-only demo: you can look around, but changes are disabled.
        </div>
      )}
      {children}
    </DashboardShell>
  );
}
