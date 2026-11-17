"use client";

import { useSession } from "next-auth/react";
import { isDemoAdmin } from "@/lib/roles";

export const READ_ONLY_TITLE = "Read-only demo: changes are disabled";

/** True for a demo admin. Use it to disable the main action buttons; the server still refuses with 403. */
export function useReadOnly() {
  const { data: session } = useSession();
  return {
    readOnly: isDemoAdmin(session?.user?.role),
    readOnlyTitle: READ_ONLY_TITLE,
    userId: session?.user?.id,
  };
}
