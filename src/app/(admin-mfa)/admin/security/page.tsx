import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import SecurityClient from "./SecurityClient";

// Outside the admin layout on purpose: the layout sends an admin who has not
// finished two-factor here, so this page cannot require it.
export default async function AdminSecurityPage() {
  const session = await auth();
  if (!session || !isAdminRole(session.user.role)) redirect("/login");
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <SecurityClient demo={session.user.role === "demo_admin"} />
    </main>
  );
}
