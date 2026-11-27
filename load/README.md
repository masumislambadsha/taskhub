# Load tests

Scenarios (see ROADMAP.md 2.5):

| Scenario | Tool | File | Status |
|---|---|---|---|
| Browse (list, search, filter, detail) | k6 | `browse.js` | written, not yet run |
| Chat (Socket.io messages) | Artillery | `chat.yml` | written, needs `chat-users.csv` of valid tokens |
| Work (submit and approve, ledger transactions) | k6 | not written | needs a login helper for the session cookie |

Seed realistic data first: `npm run seed` for the base data, then `npm run load:seed` for 1,000 users and 10,000 tasks.

## Results

No numbers yet. The author's environment for this change could not run containers or install k6, so nothing was measured, and the table in the README stays empty until it is. Fill it from a real run on the target VPS, with the hardware written next to it:

| Scenario | Web instances | Requests/s | p95 | Error rate | Hardware |
|---|---|---|---|---|---|
| (to be measured) | | | | | |

Likely first bottleneck: `GET /api/v1/tasks?search=` uses an unanchored case-insensitive `$regex`, which cannot use an index. Measure it with `explain()` before and after switching to a text index, and record both.
