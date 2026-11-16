/** Base class for every error the ledger throws on purpose. */
export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The input is malformed: amounts, sums, entry count, keys. */
export class InvalidTransactionError extends LedgerError {}

/** An entry names an account that does not exist (or is not a valid account ID). */
export class UnknownAccountError extends LedgerError {
  constructor(public accountId: string) {
    super(`Unknown ledger account: ${accountId}`);
  }
}

/** A debit would take a non-negative account below zero. Aborts the transaction. */
export class InsufficientCoinsError extends LedgerError {
  constructor(
    public accountId: string,
    public amount: number,
  ) {
    super(`Insufficient coins in ${accountId} for a debit of ${Math.abs(amount)}`);
  }
}

/** The same idempotency key was reused with different content. */
export class IdempotencyConflictError extends LedgerError {
  constructor(public idempotencyKey: string) {
    super(`Idempotency key ${idempotencyKey} was already used for a different transaction`);
  }
}
