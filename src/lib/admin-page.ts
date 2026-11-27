import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { requireAdminPageMfa } from "@/lib/admin-guard";

/**
 * For admin server components that read the DB directly. Returns the caller
 * (admin or demo admin) so the page can mask emails, or sends anyone else to
 * the login page. The admin layout checks this too; a page must not rely on it.
 */
export async function getAdminViewer(): Promise<{
  id: string;
  role: string;
}> {
  const session = await auth();
  if (!session || !isAdminRole(session.user.role)) redirect("/login");
  await requireAdminPageMfa(session);
  return { id: session.user.id, role: session.user.role };
}
