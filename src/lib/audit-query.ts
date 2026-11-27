import mongoose from "mongoose";

/** Builds the Mongo filter from the audit log's search parameters. Unknown or malformed values are ignored. */
export function auditFilter(params: URLSearchParams): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  const actor = params.get("actor");
  if (actor) filter.actorId = actor;
  const action = params.get("action");
  // `withdrawal` matches `withdrawal.approve` and `withdrawal.reject`.
  if (action) {
    filter.action = action.includes(".")
      ? action
      : { $regex: `^${action.replace(/[^a-z_]/gi, "")}\\.` };
  }
  const targetType = params.get("targetType");
  if (targetType) filter.targetType = targetType;
  const target = params.get("target");
  if (target) filter.targetId = target;

  const range: Record<string, Date> = {};
  const from = params.get("from");
  const to = params.get("to");
  if (from && !Number.isNaN(Date.parse(from))) range.$gte = new Date(from);
  if (to && !Number.isNaN(Date.parse(to))) {
    const end = new Date(to);
    // A bare date means the whole day.
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) end.setUTCHours(23, 59, 59, 999);
    range.$lte = end;
  }
  if (Object.keys(range).length) filter.createdAt = range;
  return filter;
}

export const isObjectId = (v: string) => mongoose.isValidObjectId(v);
