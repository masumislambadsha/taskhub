import mongoose from "mongoose";
import LedgerAccount from "@/models/LedgerAccount";
import LedgerTransaction, {
  LEDGER_TX_TYPES,
  type ILedgerTransactionDoc,
  type LedgerEntry,
  type LedgerMeta,
  type LedgerTxType,
} from "@/models/LedgerTransaction";
import User from "@/models/User";
import { parseAccount } from "./accounts";
import {
  InsufficientCoinsError,
  InvalidTransactionError,
  UnknownAccountError,
} from "./errors";

export type Session = mongoose.mongo.ClientSession;

export interface PostInput {
  type: LedgerTxType;
  idempotencyKey: string;
  entries: LedgerEntry[];
  meta?: LedgerMeta;
  /** The transaction this one corrects. */
  reversalOf?: mongoose.Types.ObjectId | string;
  /** A user ID, or "system". */
  createdBy: string;
}

/** Pure validation of the shape of a transaction. Throws InvalidTransactionError. */
export function validateInput(input: PostInput): void {
  const { type, idempotencyKey, entries, createdBy } = input;
  if (!LEDGER_TX_TYPES.includes(type)) {
    throw new InvalidTransactionError(`Unknown transaction type: ${String(type)}`);
  }
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length === 0 ||
    idempotencyKey.length > 200
  ) {
    throw new InvalidTransactionError("idempotencyKey must be a non-empty string");
  }
  if (typeof createdBy !== "string" || createdBy.length === 0) {
    throw new InvalidTransactionError("createdBy is required");
  }
  if (!Array.isArray(entries) || entries.length < 2) {
    throw new InvalidTransactionError("A transaction needs at least 2 entries");
  }
  const seen = new Set<string>();
  let sum = 0;
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry?.amount)) {
      throw new InvalidTransactionError(
        `Entry amounts must be integers, got ${String(entry?.amount)}`,
      );
    }
    if (entry.amount === 0) {
      throw new InvalidTransactionError("Entry amounts must not be 0");
    }
    if (!parseAccount(entry.accountId)) {
      throw new UnknownAccountError(String(entry.accountId));
    }
    if (seen.has(entry.accountId)) {
      throw new InvalidTransactionError(
        `Account ${entry.accountId} appears twice in one transaction`,
      );
    }
    seen.add(entry.accountId);
    sum += entry.amount;
  }
  if (sum !== 0) {
    throw new InvalidTransactionError(`Entries must sum to 0, got ${sum}`);
  }
  if (input.reversalOf !== undefined && !mongoose.isValidObjectId(input.reversalOf)) {
    throw new InvalidTransactionError("reversalOf must be a transaction ID");
  }
}

/**
 * Inserts the journal row and applies every balance change in `session`.
 * Low-level: callers validate the input, check idempotency and open accounts
 * first (see postTransaction and opening.ts). With `updateUserBalances: false`
 * the user entries are journal-only: used by opening entries, because
 * `User.coins` already holds those coins.
 */
export async function recordTransaction(
  input: PostInput,
  session: Session,
  options: { updateUserBalances: boolean },
): Promise<ILedgerTransactionDoc> {
  const [transaction] = await LedgerTransaction.create(
    [
      {
        type: input.type,
        idempotencyKey: input.idempotencyKey,
        entries: input.entries.map((e) => ({
          accountId: e.accountId,
          amount: e.amount,
        })),
        meta: input.meta ?? {},
        reversalOf: input.reversalOf,
        createdBy: input.createdBy,
      },
    ],
    { session },
  );

  for (const entry of input.entries) {
    const account = parseAccount(entry.accountId)!;
    const { amount } = entry;

    if (account.kind === "user") {
      if (!options.updateUserBalances) continue;
      if (amount < 0) {
        // Conditional debit: matches only if the balance covers it.
        const res = await User.updateOne(
          { _id: account.userId, coins: { $gte: -amount } },
          { $inc: { coins: amount } },
          { session },
        );
        if (res.matchedCount === 0) {
          throw new InsufficientCoinsError(entry.accountId, amount);
        }
      } else {
        const res = await User.updateOne(
          { _id: account.userId },
          { $inc: { coins: amount } },
          { session },
        );
        if (res.matchedCount === 0) throw new UnknownAccountError(entry.accountId);
      }
    } else if (account.kind === "escrow") {
      const filter =
        amount < 0
          ? { _id: entry.accountId, balance: { $gte: -amount } }
          : { _id: entry.accountId };
      const res = await LedgerAccount.updateOne(
        filter,
        { $inc: { balance: amount } },
        { session },
      );
      if (res.matchedCount === 0) {
        if (amount < 0 && (await LedgerAccount.exists({ _id: entry.accountId }).session(session))) {
          throw new InsufficientCoinsError(entry.accountId, amount);
        }
        throw new UnknownAccountError(entry.accountId);
      }
    } else {
      // System accounts may go negative and are created on first use.
      await LedgerAccount.updateOne(
        { _id: entry.accountId },
        {
          $inc: { balance: amount },
          $setOnInsert: { kind: "system", allowNegative: true },
        },
        { session, upsert: true },
      );
    }
  }
  return transaction;
}
