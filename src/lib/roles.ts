import { NextResponse } from "next/server";

export type AppRole = "worker" | "buyer" | "admin" | "demo_admin";

/** Every role a user document may hold. Self-registration only allows worker and buyer. */
export const USER_ROLES: readonly AppRole[] = [
  "worker",
  "buyer",
  "admin",
  "demo_admin",
];

/** Display names for roles; a stored role such as "demo_admin" is never shown raw. */
export const ROLE_LABELS: Record<string, string> = {
  worker: "Worker",
  buyer: "Buyer",
  admin: "Admin",
  demo_admin: "Demo Admin",
};

export function roleLabel(role: string | null | undefined): string {
  return (role && ROLE_LABELS[role]) || role || "";
}

export const DEMO_ADMIN_READ_ONLY_MESSAGE = "Demo admin is read-only";

/** True for admin and demo_admin: both may open the admin area and read. */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "demo_admin";
}

/** True for admin only: the only role that may change anything. */
export function canManage(role: string | null | undefined): boolean {
  return role === "admin";
}

export function isDemoAdmin(role: string | null | undefined): boolean {
  return role === "demo_admin";
}

type SessionLike = { user?: { id?: string; role?: string | null } | null } | null;

export type AdminGuard =
  | {
      ok: true;
      role: "admin" | "demo_admin";
      userId: string;
      /** The caller, in the shape the email masking helpers take. */
      viewer: { id: string; role: "admin" | "demo_admin" };
    }
  | { ok: false; response: NextResponse };

/**
 * Guards an admin route. "read" lets both admin roles through; "write" is admin
 * only. A demo admin on "write" gets 403, anyone who is not an admin role gets 401.
 */
export function requireAdmin(
  session: SessionLike | undefined,
  access: "read" | "write",
): AdminGuard {
  const role = session?.user?.role;
  if (!session?.user || !isAdminRole(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (access === "write" && !canManage(role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: DEMO_ADMIN_READ_ONLY_MESSAGE },
        { status: 403 },
      ),
    };
  }
  const id = session.user.id ?? "";
  const adminRole = role as "admin" | "demo_admin";
  return { ok: true, role: adminRole, userId: id, viewer: { id, role: adminRole } };
}

/**
 * For routes any signed-in user may call, but a demo admin may not change
 * anything. Returns a 403 response for a demo admin, otherwise null.
 */
export function refuseDemoAdmin(
  session: SessionLike | undefined,
): NextResponse | null {
  if (isDemoAdmin(session?.user?.role)) {
    return NextResponse.json(
      { error: DEMO_ADMIN_READ_ONLY_MESSAGE },
      { status: 403 },
    );
  }
  return null;
}
