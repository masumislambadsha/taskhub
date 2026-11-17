import { canManage, isDemoAdmin } from "@/lib/roles";

/** "mohammad@gmail.com" becomes "m•••@gmail.com". */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.lastIndexOf("@");
  if (at === -1) return `${email[0]}•••`;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  return `${local ? local[0] : ""}•••${domain}`;
}

/**
 * "01929686694" becomes "019•••••694": the first 3 and last 3 characters stay.
 * A value of 6 characters or fewer would be shown whole, so it is bulleted entirely.
 */
export function maskAccount(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 6) return "•".repeat(value.length);
  return `${value.slice(0, 3)}${"•".repeat(value.length - 6)}${value.slice(-3)}`;
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

/** Same as `maskEmailFields`, for payout account numbers. */
export function maskAccountFields<T extends object>(
  rows: T[],
  fields: string[],
  viewer: Viewer,
): T[] {
  if (!shouldMaskEmails(viewer)) return rows;
  return rows.map((row) => {
    const copy = { ...row } as Record<string, unknown>;
    for (const f of fields) {
      if (typeof copy[f] === "string") copy[f] = maskAccount(copy[f] as string);
    }
    return copy as T;
  });
}

/**
 * For routes that anyone signed in (or not) may call. An admin gets the rows as
 * they are, a demo admin gets the fields masked, and everyone else gets them
 * only on rows they own (`row[ownerKey]` is their id); on other rows the fields
 * are left out.
 */
export function redactEmailFields<T extends object>(
  rows: T[],
  fields: string[],
  viewer: Viewer,
  ownerKey: string,
): T[] {
  if (canManage(viewer?.role)) return rows;
  if (shouldMaskEmails(viewer)) return maskEmailFields(rows, fields, viewer);
  return rows.map((row) => {
    const copy = { ...row } as Record<string, unknown>;
    if (viewer?.id && String(copy[ownerKey]) === viewer.id) return copy as T;
    for (const f of fields) delete copy[f];
    return copy as T;
  });
}
