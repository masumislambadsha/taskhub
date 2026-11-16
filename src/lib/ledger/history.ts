import mongoose from "mongoose";
import LedgerTransaction, { type LedgerTxType } from "@/models/LedgerTransaction";
import { userAccount } from "./accounts";

export interface WalletItem {
  id: string;
  type: LedgerTxType;
  /** The change to this user's balance: positive adds coins, negative removes them. */
  amount: number;
  createdAt: string;
  taskId?: string;
  submissionId?: string;
  paymentId?: string;
  withdrawalId?: string;
}

export interface WalletPage {
  items: WalletItem[];
  /** Pass it back as `cursor` for the next page; null on the last page. */
  nextCursor: string | null;
}

export const WALLET_PAGE_SIZE_MAX = 50;

function encodeCursor(createdAt: Date, id: unknown): string {
  return Buffer.from(`${createdAt.getTime()}_${String(id)}`).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: mongoose.Types.ObjectId } | null {
  try {
    const [ms, id] = Buffer.from(cursor, "base64url").toString().split("_");
    if (!/^\d+$/.test(ms) || !mongoose.isValidObjectId(id)) return null;
    return { createdAt: new Date(Number(ms)), id: new mongoose.Types.ObjectId(id) };
  } catch {
    return null;
  }
}

export class InvalidCursorError extends Error {}

/**
 * The signed-in user's own coin history, newest first, cursor-paginated. Only
 * entries on `user:<userId>` are returned, each with the amount for that user.
 * Opening entries (bookkeeping for coins held before the ledger) are left out.
 */
export async function getWalletHistory(
  userId: string,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<WalletPage> {
  const limit = Math.min(Math.max(1, Math.floor(options.limit ?? 20)), WALLET_PAGE_SIZE_MAX);
  const account = userAccount(userId);

  const filter: Record<string, unknown> = {
    "entries.accountId": account,
    type: { $ne: "opening" },
  };
  if (options.cursor) {
    const c = decodeCursor(options.cursor);
    if (!c) throw new InvalidCursorError("Invalid cursor");
    filter.$or = [
      { createdAt: { $lt: c.createdAt } },
      { createdAt: c.createdAt, _id: { $lt: c.id } },
    ];
  }

  const rows = await LedgerTransaction.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const page = rows.slice(0, limit);
  const items: WalletItem[] = page.map((row) => ({
    id: String(row._id),
    type: row.type,
    amount: row.entries.find((e) => e.accountId === account)?.amount ?? 0,
    createdAt: row.createdAt.toISOString(),
    ...(row.meta?.taskId && { taskId: row.meta.taskId }),
    ...(row.meta?.submissionId && { submissionId: row.meta.submissionId }),
    ...(row.meta?.paymentId && { paymentId: row.meta.paymentId }),
    ...(row.meta?.withdrawalId && { withdrawalId: row.meta.withdrawalId }),
  }));
  const last = page[page.length - 1];
  return {
    items,
    nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last._id) : null,
  };
}
