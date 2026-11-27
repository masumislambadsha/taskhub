import LedgerAccount from "@/models/LedgerAccount";
import { countLedgerTransaction } from "@/lib/metrics";
import LedgerTransaction, {
  type ILedgerTransactionDoc,
  type LedgerEntry,
} from "@/models/LedgerTransaction";
import { parseAccount } from "./accounts";
import { IdempotencyConflictError, InvalidTransactionError, UnknownAccountError } from "./errors";
import {
  recordTransaction,
  validateInput,
  type PostInput,
  type Session,
} from "./journal";
import { ensureUserOpen } from "./opening";

export type { PostInput } from "./journal";

export interface PostResult {
  transaction: ILedgerTransactionDoc;
  /** True if the idempotency key was already posted: nothing changed. */
  replayed: boolean;
}

function sameEntries(a: LedgerEntry[], b: LedgerEntry[]): boolean {
  if (a.length !== b.length) return false;
  const key = (e: LedgerEntry) => `${e.accountId}=${e.amount}`;
  const left = a.map(key).sort();
  const right = b.map(key).sort();
  return left.every((k, i) => k === right[i]);
}

/**
 * The only function that changes coin balances.
 *
 * Validates the input (integer non-zero amounts, at least 2 entries, sum
 * exactly 0, known accounts), returns the existing transaction untouched if
 * the idempotency key was already posted, opens any pre-ledger user account it
 * touches, inserts the journal row and applies every balance change, all in
 * the caller's `session`. A debit that the balance can't cover throws
 * `InsufficientCoinsError`, which aborts the whole transaction.
 *
 * `session` must come from `inLedgerTransaction` (or
 * `mongoose.connection.transaction`). Escrow accounts are created by the
 * caller before posting (see `createEscrowAccount` and `ensureEscrowOpen`).
 */
export async function postTransaction(
  input: PostInput,
  session: Session,
): Promise<PostResult> {
  if (!session || !session.inTransaction()) {
    throw new InvalidTransactionError(
      "postTransaction needs a session inside a MongoDB transaction",
    );
  }
  validateInput(input);
  if (input.type === "opening") {
    throw new InvalidTransactionError(
      'Opening entries are posted by the ledger itself, not through postTransaction',
    );
  }

  const existing = await LedgerTransaction.findOne({
    idempotencyKey: input.idempotencyKey,
  }).session(session);
  if (existing) {
    if (existing.type !== input.type || !sameEntries(existing.entries, input.entries)) {
      throw new IdempotencyConflictError(input.idempotencyKey);
    }
    return { transaction: existing, replayed: true };
  }

  // Open pre-ledger users first, in a stable order, then check escrow accounts.
  const accounts = input.entries
    .map((e) => parseAccount(e.accountId)!)
    .sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
  for (const account of accounts) {
    if (account.kind === "user") await ensureUserOpen(account.userId, session);
  }
  for (const entry of input.entries) {
    if (parseAccount(entry.accountId)!.kind === "escrow") {
      const exists = await LedgerAccount.exists({ _id: entry.accountId }).session(session);
      if (!exists) throw new UnknownAccountError(entry.accountId);
    }
  }

  const transaction = await recordTransaction(input, session, {
    updateUserBalances: true,
  });
  countLedgerTransaction(input.type);
  return { transaction, replayed: false };
}
