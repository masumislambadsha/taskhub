# ADR 0003: A rejected reward is held in the task's escrow until the rejection is final

Status: accepted

## Context

A buyer can reject a worker's submission, and the worker can appeal (roadmap 1.4).
For an appeal to be fair, the reward must still be there when an admin decides:
if a rejection returned the coins to the buyer or reopened the slot at once, a
worker who wins would have to be paid from coins that had already moved on.

## Decision

Rejecting a submission **moves no coins**. The reward stays in the task's escrow
account, counted as *held*, and the slot stays taken (`filledWorkers` does not
drop). The hold ends when it is **settled**, which happens exactly once:

- the worker accepts the rejection (immediately),
- the dispute window ends (3 days, `DISPUTE_WINDOW_MS`, enforced by a
  `dispute-window-<submissionId>` job and a 15-minute sweep as the safety net), or
- an admin decides an appeal (next change).

Settling reopens the slot and the reward stays in escrow for it. If the payout
changed in the meantime the buyer is charged or refunded the difference. If no
slot can reopen (the task was deleted, or the buyer lowered the worker count) the
reward is refunded to the buyer. If the payout rose and the buyer cannot afford
it, the reward is refunded and the task loses that slot, because a slot without
funding must never be opened.

## Why not a separate `hold:submission:<id>` account

The roadmap first sketched a ledger account per held submission. The coins would
move escrow → hold on rejection and hold → escrow, worker or buyer on settlement.
That is an extra account kind to create, validate, reconcile and clean up, with
more transactions per rejection, for no extra guarantee: the coins are already
in escrow and the escrow check already says exactly what must be there.

Instead the escrow rule gained one term. A task's escrow must hold
`open slots × reward + pending rewards + held rewards`, where a held reward is a
rejected submission whose `rejectionHold.settledAt` is unset. The nightly
reconciliation, the randomized invariant test and task deletion all use the same
`pendingSubmissionValue`, so they stay consistent.

## Consequences

- The slot reopens up to 3 days after a rejection unless the worker accepts
  sooner. That is the price of a fair appeal.
- No new ledger transaction types: settlement uses the existing
  `task_reprice` and `submission_reject_refund` entries.
- `DISPUTE_WINDOW_MS=0` settles at once, which is how the app behaved before
  disputes and how most tests run.
- Deleting a task during a hold refunds only the open slots; the held reward is
  refunded when the hold settles.
