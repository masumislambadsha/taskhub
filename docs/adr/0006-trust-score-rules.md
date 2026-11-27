# ADR 0006: The worker trust score is a set of plain rules, not a model

Status: accepted

## Context

The platform needs to tell reliable workers from new or suspicious ones, to
gate high-paying tasks, to cap how fast a new account can earn and withdraw, and
to do it in a way a worker can understand and appeal. Money is involved, and a
wrong score blocks someone from earning.

## Decision

The score is 0 to 100, the sum of six components, each a small function of
counts the database already has (`src/lib/trust.ts`):

| Component | Points |
|---|---|
| Approval rate over 90 days, once there are 10 reviewed submissions | up to 40 |
| Approved submissions, on a log scale (200 earn the maximum) | up to 15 |
| Account age (180 days earn the maximum) | up to 10 |
| Verified email and phone | up to 10 (not available yet, so 0) |
| Lost disputes in 90 days | 10, minus 5 per lost dispute |
| No confirmed fraud flag | 15, and a confirmed flag caps the whole score at 20 |

Levels: New below 30, Regular 30 to 59, Skilled 60 to 79, Trusted 80 and above.
Approvals from a buyer linked to the worker by an open or confirmed
self-dealing flag do not count.

The score is stored on the user with a daily history, recomputed when it is an
hour old and someone needs the level (submission to a gated task, withdrawal),
when the worker opens it, and for every active worker about once a day by the
worker's sweep.

## Why rules and not machine learning

- **Explainable.** The worker sees every component and what would raise it. A
  model's score cannot be explained that way, and "the model said so" is not an
  answer to an appeal.
- **Fair and auditable.** Each rule can be argued about, tested and changed on
  purpose. A model trained on this platform's few thousand early decisions would
  learn the buyers' habits (including unfair rejections) and repeat them.
- **No training data yet.** There are no reliable labels for "a good worker".
- **Hard to game quietly.** The inputs are decisions by other people (buyers,
  admins), not signals a worker controls, and the cheap tricks (linked accounts,
  reused screenshots) have their own flags.
- **Cheap and fast.** A handful of indexed counts per worker.

## Consequences

- The weights are judgement calls. They are constants in one file with a test
  for each component, so they are easy to tune once real data exists.
- A new worker starts at 25 (clean record only) and reaches Regular after about
  10 approved tasks. That is intentional: it is slow enough to deter throwaway
  accounts and quick enough not to discourage honest ones.
- If real data later shows the rules misjudge people, a model can be added as
  one more input, not as a replacement, and only with a way to explain it.
