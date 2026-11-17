import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/roles";

// Admin-only route to confirm that error reporting works end to end. It creates
// a Sentry event, so it counts as a write: a demo admin gets 403 and anyone who
// is not an admin role gets 401.
export async function GET() {
  const session = await auth();
  const guard = requireAdmin(session, "write");
  if (!guard.ok) return guard.response;

  throw new Error("Sentry test error from /api/v1/admin/debug-error");
}
