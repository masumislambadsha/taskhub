# 0002. A double-entry coin ledger, with `User.coins` kept as the cached user balance

- Status: accepted
- Date: 2026-11-16

The VPS deployment ADR is numbered 0001 on the `phase-0-deploy` branch, so this one is
0002. Same layout: context, decision, consequences. This is ROADMAP item 1.1.

## Context

Coins were a single number, `User.coins`, changed directly by eight pieces of code:
payments, task creation, task edit and delete, submission approval, withdrawal approval,
and the signup bonuses. Several of them read the balance, did arithmetic in the app and
saved it back, so two requests at once could both pass the check ("20 task creations
from a buyer who can afford 2"). Others had no check at all:

- Editing a task never moved coins, so a buyer could raise the payout, delete the task and
  be refunded the larger amount.
- A submission could be approved twice at once and pay twice.
- A coin leaving or arriving left no record, so a wrong balance could not be explained.

Production is MongoDB Atlas, a replica set, so multi-document transactions work. Every
page, the session and the leaderboard read `User.coins`, and the app cannot be taken
offline to migrate.

## Decision

1. **A double-entry journal.** `ledger_transactions` holds one document per movement:
   `type`, a unique `idempotencyKey`, `entries: [{ accountId, amount }]` (integers, at
   least two, summing to exactly 0), `meta` (task, submission, payment, withdrawal),
   `reversalOf`, `createdBy` (a user ID or `"system"`) and `createdAt`. Entries are never
   edited or deleted (the model refuses it); a correction is a new transaction. Coins
   cannot appear or vanish, only move, so "sum of all balances is 0" is a check that can
   fail loudly.
2. **Cached balances, updated in the same transaction as the journal row.**
   - User accounts are `user:<userId>` and the cached balance **is `User.coins`**. Every
     existing read keeps working and nothing in the UI, the session or the mobile app had
     to change. A debit is a conditional update (`coins >= amount`); if nothing matches it
     throws `InsufficientCoinsError`, which aborts the whole transaction.
   - Everything else lives in `ledger_accounts`: system accounts (`system:issuance`,
     `system:promotions`, `system:adjustments`, `system:forfeited`, `system:migration`),
     which may go negative, and `escrow:task:<taskId>`, which may not.
3. **`postTransaction(input, session)` is the only code that changes a balance.** It
   validates the input, returns the existing transaction if the key was already posted
   (and refuses a reused key with different content), inserts the journal row and applies
   every balance change in the caller's transaction. Every flow runs in
   `mongoose.connection.transaction` together with its own state change: the status flip
   from `pending` is conditional, so a loser of a race finds nothing to flip and posts
   nothing. Account IDs and system account names live in one module
   (`src/lib/ledger/accounts.ts`).
4. **Lazy opening instead of a maintenance window.** The ROADMAP plan blocks money actions,
   runs a migration script and then switches over. That needs downtime and a flag day;
   this does not.
   - A user that has no `ledgerOpenedAt` is opened inside the first transaction that
     touches them: a journal-only entry `system:migration -coins, user +coins` (key
     `opening:user:<id>`) that does not touch `User.coins` (it already holds them), then
     `ledgerOpenedAt` is set. Because that transaction writes the user document, two
     concurrent postings conflict and retry, so the opening happens once. New users are
     created opened.
   - A task from before the ledger has no escrow account. It is opened on first touch with
     what it still holds under the rules the app had (below), as
     `system:migration -X, escrow +X`. Tasks created through the ledger are funded by
     `user -cost, escrow +cost`, so they never need opening.
   - `openAll({ dryRun })` (`npm run ledger:open`, `POST /api/v1/admin/ledger/open`) opens
     everything ahead of time, one account per transaction, idempotently. Dry run by
     default.
5. **What an escrow holds.** `escrow = max(0, requiredWorkers - filledWorkers) * payableAmount
   + the rewards of that task's pending submissions`. Creating a submission turns an open
   slot into a pending one and rejecting turns it back, so neither changes the total;
   approving pays one reward out; editing a task moves the buyer and the escrow by the change
   in the open-slot term; deleting refunds the open-slot term and marks the task
   `escrowReleasedAt`, after which the open slots are no longer backed. Two cases need an
   explicit posting: rejecting a submission after the task's payout was edited reprices the
   reopened slot (`reject-reprice:<id>`), and rejecting one on a deleted task refunds its
   reward (`reject-refund:<id>`). The reconciliation check compares each escrow with this
   formula, and the randomized test caught the repricing case.
6. **Reconciliation.** `reconcile()` recomputes every account from the journal and compares
   it with the cache, checks that journal and cache each sum to 0, that no user or escrow
   is negative, and each escrow against its task. It runs in one snapshot, so concurrent
   postings cannot cause false alarms. It is `npm run ledger:reconcile` and an admin-only
   `GET /api/v1/admin/ledger/reconcile`, and returns IDs and amounts only.
7. **Wallet history** is `GET /api/v1/wallet/transactions`: the signed-in user's own
   entries, newest first, cursor-paginated. The two coin pages show the latest few.

## Consequences

- Good: the three bugs above are closed and tested (20 concurrent creations, 10 concurrent
  approvals, insufficient withdrawals, and about 200 randomized operations per run), and
  every coin has a history. `User.coins` stayed, so no reader changed.
- **`User.coins` and `ledger_accounts.balance` are still caches.** Anyone who writes them
  outside `postTransaction` (a shell, an old deploy, a script) creates drift. Reconcile
  finds it; it does not prevent it. During a rolling deploy, an old instance that still
  does `$inc` on coins after a user was opened would cause a mismatch for that user.
- **Hot documents.** Every top-up, bonus and withdrawal updates `system:issuance` or
  `system:promotions`, so those transactions conflict and retry one after another. That is
  fine at the current volume; at much higher volume, shard those balances or compute them
  from the journal.
- **Pre-ledger data is trusted as it is.** Opening values come from today's task and user
  documents. If an old edit inflated a payout (the hole above), that value becomes real
  escrow. A user or task holding a fractional value cannot be opened (the ledger is
  integers only); `ledger:open` lists them in `failed` and the first touch returns an
  error until someone fixes the value. Run the dry run first.
- **Archived tasks are assumed refunded.** An old archived task opens with only its pending
  rewards, because the buyer's delete is what archives a task and it refunds. An admin
  can also archive a task without a refund, and old data cannot tell the two apart; such a
  task's open-slot value is not in the ledger.
- Admin status changes (block, archive, unarchive) still move no coins. Un-archiving a task
  the buyer deleted reopens slots that are not backed by escrow, so approvals past the
  funded ones are refused as `escrow_insufficient` instead of paying out of nothing.
- The worker submission route (`POST /api/v1/submissions`) still updates `filledWorkers`
  without a transaction. It does not touch coins, but two submissions at once can lose a
  count, and reconcile then reports that task's escrow as a mismatch, which is correct.
- Deleting a user does not refund the escrow of their tasks; their coins are forfeited.
- Withdrawals still take coins at approval, not at request, so a worker can have several
  pending requests that together exceed their balance; the approvals past the balance are
  refused.
- `reversalOf` and the `reversal` type exist, but there is no helper or screen to post a
  reversal yet, and the nightly reconciliation job and the admin Ledger page from the
  ROADMAP are not built (they depend on the worker from 1.3).
- Task payouts must now be whole numbers of coins (the API validates it).
