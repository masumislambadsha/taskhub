import { isDemoAdmin } from "@/lib/roles";

/** "mohammad@gmail.com" becomes "m•••@gmail.com". */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.lastIndexOf("@");
  if (at === -1) return `${email[0]}•••`;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  return `${local ? local[0] : ""}•••${domain}`;
}

type Viewer = { id?: string; role?: string | null } | null | undefined;

/** A demo admin sees masked emails for everyone but themselves. */
export function shouldMaskEmails(viewer: Viewer): boolean {
  return isDemoAdmin(viewer?.role);
}

/**
 * Returns copies of `rows` with the given email fields masked when the viewer is
 * a demo admin. A row whose `_id` is the viewer's own id is left as it is.
 */
export function maskEmailFields<T extends object>(
  rows: T[],
  fields: string[],
  viewer: Viewer,
): T[] {
  if (!shouldMaskEmails(viewer)) return rows;
  return rows.map((row) => {
    const copy = { ...row } as Record<string, unknown>;
    if (viewer?.id && String(copy._id) === viewer.id) return copy as T;
    for (const f of fields) {
      if (typeof copy[f] === "string") copy[f] = maskEmail(copy[f] as string);
    }
    return copy as T;
  });
}
