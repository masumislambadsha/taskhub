# Query performance

Measured with `npm run perf:explain` (`scripts/perf-explain.ts`). It starts a throwaway in-memory MongoDB, seeds a large data set from a seeded random generator (so runs are repeatable), drops every secondary index, measures each hot query, then creates the indexes declared in the models and measures again. Time is the median of five runs after a warm-up; "docs examined" comes from `explain("executionStats")`.

Hardware: 4 x Intel(R) Xeon(R) Processor @ 2.30GHz, 15.7 GB RAM, Node v22.23.5, MongoDB in-memory (mongodb-memory-server).
Data: 100,000 tasks, 20,000 users, 300,000 submissions, 200,000 ledger transactions.

| Query | Before: time | Before: docs examined | After: time | After: docs examined | After: plan |
|---|---|---|---|---|---|
| Task list, page 1 (open, newest first) | 34.8 ms | 100,000 | 1.3 ms | 12 | LIMIT > FETCH > IXSCAN(status_1_createdAt_-1) |
| Task list, page 5,000 (deep skip) | 53.5 ms | 100,000 | 39.8 ms | 12 | LIMIT > FETCH > SKIP > IXSCAN(status_1_createdAt_-1) |
| Task count for the list (open) | 19.0 ms | 100,000 | 9.2 ms | 90,000 | FETCH > IXSCAN(status_1_createdAt_-1) |
| Task list, category filter | 27.3 ms | 100,000 | 0.7 ms | 12 | LIMIT > FETCH > IXSCAN(status_1_category_1_createdAt_-1) |
| Task list, search by title (regex) | 58.1 ms | 100,000 | 0.7 ms | 62 | LIMIT > FETCH > IXSCAN(status_1_createdAt_-1) |
| Buyer's own tasks | 42.9 ms | 100,000 | 0.7 ms | 12 | LIMIT > FETCH > IXSCAN(buyerId_1_createdAt_-1) |
| Leaderboard: top 100 workers by coins | 12.8 ms | 20,000 | 1.3 ms | 100 | LIMIT > PROJECTION_SIMPLE > FETCH > IXSCAN(role_1_status_1_coins_-1) |
| Leaderboard: submission stats for those 100 | 66.4 ms | 300,000 | 1.9 ms | 0 | GROUP > PROJECTION_COVERED > IXSCAN(workerId_1_status_1_createdAt_-1) |
| Worker's submissions (pending) | 75.6 ms | 300,000 | 0.7 ms | 5 | LIMIT > FETCH > IXSCAN(workerId_1_status_1_createdAt_-1) |
| Buyer's submission queue (pending) | 84.6 ms | 300,000 | 0.8 ms | 20 | LIMIT > FETCH > IXSCAN(taskBuyerId_1_status_1_createdAt_-1) |
| Wallet history (ledger) | 0.9 ms | 20 | 0.8 ms | 20 | LIMIT > FETCH > IXSCAN(entries.accountId_1_createdAt_-1__id_-1) |

## What changed

Before this work the `tasks` collection had no indexes at all, and `users` and `submissions` had none that matched how they are queried, so every list, filter and leaderboard query read the whole collection. Added:

| Model | Index | Serves |
|---|---|---|
| Task | `{ status, createdAt: -1 }` | the public list, its count, title search |
| Task | `{ status, category, createdAt: -1 }` | the category filter |
| Task | `{ buyerId, createdAt: -1 }` | a buyer's own tasks |
| User | `{ role, status, coins: -1 }` | leaderboard |
| Submission | `{ workerId, status, createdAt: -1 }` | a worker's list, leaderboard counts (covered, no documents read) |
| Submission | `{ taskBuyerId, status, createdAt: -1 }` | a buyer's review queue |

The wallet history query already had a good index from the ledger work, and the table shows it unchanged.

## What the indexes do not fix

- **Deep pages.** `skip(59988)` still walks 60,000 index entries, so page 5,000 only improved from 54 ms to 40 ms even though it now reads 12 documents. Real fix: cursor pagination (`createdAt < lastSeen`), which needs an API change.
- **The count.** `countDocuments({ status: "open" })` now reads 90,000 index keys instead of 100,000 documents (19 ms to 9 ms). Real fix: cache the count for a few seconds, or stop showing an exact total.
- **Title search.** The regex is unanchored and case-insensitive, so no index can search it. It is fast in the table only because common words match early in the newest-first order and the query stops after 12 hits. A rare or misspelled word still scans every open task. Real fix: a text index, or Atlas Search.

## Caveats

In-memory MongoDB on a 4-core VM, not production hardware, with data that fits in memory. Absolute times will differ; the documents-examined column is the stable evidence. Unused indexes were not audited (that needs a few days of real traffic and `$indexStats`).
