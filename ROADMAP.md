# TaskHub upgrade plan

Version 1, 9 November 2026. Goal: turn TaskHub into a flagship project that proves you can build reliable money flows, scale real-time features, use AI responsibly and ship with tests and monitoring. That is what remote employers paying around 150K BDT look for.

---

## How to use this plan

- **Work top to bottom.** Later items depend on earlier ones. Every coin feature depends on the ledger (1.1), the 72-hour auto-approve needs the job queue (Phase 0 worker + 1.3), and the MCP server needs the API keys from 5.5.
- **Each item has the same parts:** Goal, Why it matters, Design, Steps, Watch out for, Tests, Done when.
- **One branch and one pull request per item.** Merge only when CI is green and every "Done when" line is true.
- **Don't claim it before it's done.** A feature goes on your resume, portfolio or in an application email only after its "Done when" is met, with real numbers.
- **Time.** The schedule assumes about 15–20 hours a week next to your job. With less time, keep the order and stretch the weeks. If you fall behind, cut from Phase 5, never from tests.

## What TaskHub has today

- Next.js 16 (App Router) and TypeScript at the repo root, deployed on Vercel at task-hub-io.vercel.app.
- Auth.js (next-auth v5 beta) with Google and email/password sign-in and JWT sessions. `@auth/mongodb-adapter` is installed but not used: users are stored in the `User` model.
- MongoDB through Mongoose. Models in `src/models`: Category, Contact, Message, Notification, PasswordResetToken, Payment, Submission, Task, User and Withdrawal.
- Three roles: buyer, worker, admin.
- Payments: Stripe Checkout with a webhook, bKash, and SSLCommerz (with IPN).
- Coins are stored in the `coins` field on the user document and the code increases and decreases it directly. Buy and withdrawal rates are in `src/lib/coins.ts` (with the constants in `src/lib/constants.ts`), and the minimum withdrawal is 200 coins.
- A separate Express + Socket.io realtime server in `server/` (JavaScript, its own package.json, its own Message model). Clients pass their `userId` in the socket handshake and the server does not verify a token yet. It is deployed on Render's free plan (`server/render.yaml`), which sleeps when idle.
- Image uploads go through imgbb (public URLs).
- Email goes through Resend.
- The Expo app lives in a separate repo, `taskhub-mobile-app`.
- There are no tests and no CI. The only check is `npm run lint`.

## Decide these before Phase 0

1. **Where does Socket.io run today?** Answered: Socket.io runs as the separate `server/` service on Render's free plan. Phase 0 containerizes it as-is.
2. **Hosting.** From Phase 0 on, plan to run the whole stack on one VPS with Docker and Nginx. Vercel can't run the realtime server, the job worker or Nginx load balancing, and those are the point of this project.
3. **AI budget.** Pick a monthly cap (for example $5–10) before Phase 3. Every AI feature gets a daily spending limit.

## Target architecture (end of Phase 4)

```
Browser / PWA / Expo app
          |
        Nginx  (TLS, reverse proxy, load balancer, sticky sessions for /socket.io)
       /       \
  web1, web2    realtime1, realtime2
  (Next.js)     (Socket.io + Redis adapter)
       \       /
        Redis  (Socket.io adapter, BullMQ queues, rate limits, presence, leaderboard)
          |
        worker (BullMQ jobs: auto-approve, notifications, emails, AI checks,
                embeddings, reconciliation, webhooks)
          |
        MongoDB  (Atlas in production, mongodb-atlas-local in Docker for dev)

External: Stripe / bKash / SSLCommerz, Claude API, embeddings provider, Sentry, email
```

## Suggested repo layout

```
taskhub/
  src/app/                 Next.js pages and API routes
  src/lib/                 shared code: ledger/, escrow/, risk/, ai/, auth/, db/
  server/                  Socket.io realtime server (plain JavaScript, own Dockerfile, no build step)
  src/worker/              BullMQ worker entry point (bundled with esbuild)
  docker/nginx/            Nginx config
  compose.yml              base stack
  compose.dev.yml          hot reload, open DB ports
  compose.ci.yml           settings for CI and E2E
  scripts/                 seed, migrations, deploy
  load/                    k6 / Artillery scripts
  e2e/                     Playwright tests
  content/help/            help articles for the RAG bot
  docs/adr/                architecture decision records
```

---

# Phase 0: Foundation (week 1)

**Phase goal:** one command (`docker compose up`) starts the whole app the same way on any machine, and you can see when something breaks.

## 0.1 Prepare the repo

**Goal:** a clean starting point you can measure against.

**Steps**
1. Create a GitHub Project board with one issue per item in this plan, labelled by phase.
2. Protect `main`: changes only through pull requests, and CI must pass.
3. Add `.env.example` listing every environment variable with a one-line comment and no real values. Confirm `.env` is in `.gitignore`.
4. Keep three processes. The first two already exist or are close to it:
   - **web**: the Next.js app (pages, API routes, payment webhooks).
   - **realtime**: the Express + Socket.io server that already lives in `server/`. It is plain JavaScript with its own `package.json` and Dockerfile, and it has no build step.
   - **worker**: a Node process that runs BullMQ jobs. It lives in `src/worker/` inside the root project, so it can import `src/models` and `src/lib`. Bundle it with `esbuild` into `dist/worker/`. It starts empty and fills up from Phase 1.
5. Write a seed script (`npm run seed`) that creates 1 admin, 3 buyers, 10 workers, 20 tasks and some submissions, with dev-only passwords listed in the README.
6. Start `docs/adr/`. Write a short Architecture Decision Record for every big choice (ledger, queue, sticky sessions, AI policy). Interviewers like these because they show your reasoning.

**Done when:** a fresh clone plus `.env` plus `npm run seed` gives a working local app, and the board holds every item.

## 0.2 Dockerfile

**Goal:** small, secure production images.

**Design:** one multi-stage `Dockerfile` with these stages:
- `deps`: runs `npm ci`.
- `build`: runs `next build` with `output: 'standalone'` in `next.config`, and `esbuild` for the worker.
- `web` (runtime): copies `.next/standalone`, `.next/static` and `public`, then runs `node server.js`.
- `worker` (runtime): copies `dist/worker` and production `node_modules`.
- The realtime server has its own `server/Dockerfile` (no build step): `npm ci --omit=dev`, then `node index.js`.

**Steps**
1. Use a slim image of the same Node LTS version you develop on (for example `node:<lts>-slim`).
2. Run as a non-root user (`USER node`).
3. Add `.dockerignore`: `node_modules`, `.next`, `.git`, `.env*`, `coverage`, test reports.
4. `NEXT_PUBLIC_*` values are baked in at build time, so pass them as build arguments. Secrets are runtime environment variables only, never in the image.
5. Set `HOSTNAME=0.0.0.0` and `PORT=3000` for the web stage. The Next.js standalone server otherwise may not listen on the container's network interface.
6. Add a `HEALTHCHECK` that calls `/api/health` (see 0.5).
7. Write the final image sizes in the README.

**Watch out for:** `sharp` (used for images from Phase 3) has platform-specific binaries. Install it inside the image, never copy `node_modules` from your machine.

**Done when:** `docker build --target web .` works, the container starts, and `docker exec <container> whoami` prints `node`.

## 0.3 Docker Compose

**Goal:** the full stack in one command.

**Services:** `nginx`, `web1`, `realtime1`, `worker`, `mongo`, `redis`, plus `mailpit` (catches dev emails) and later `k6` under a `loadtest` profile.

**Key choices**
- **MongoDB:** use the `mongodb/mongodb-atlas-local` image in development. It runs as a single-node replica set, which MongoDB transactions require (Phase 1), and it supports Atlas Search and Vector Search locally (Phase 4). Production uses MongoDB Atlas.
- **Redis:** run with `--appendonly yes` so queued jobs survive restarts, and `--maxmemory-policy noeviction` because BullMQ requires that Redis never deletes keys to free memory.
- **Only Nginx publishes ports.** Everything else stays on the internal Docker network.
- Use `depends_on` with `condition: service_healthy` so services start in the right order.
- Keep three files: `compose.yml` (base), `compose.dev.yml` (hot reload, open database ports), `compose.ci.yml` (test settings).

**Example (base file, shortened)**

```yaml
services:
  nginx:
    image: nginx:stable-alpine
    ports: ["80:80"]
    volumes:
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      web1: { condition: service_healthy }

  web1:
    build: { context: ., target: web }
    env_file: .env
    environment: { HOSTNAME: "0.0.0.0", PORT: "3000" }
    depends_on:
      redis: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 3s
      retries: 5

  realtime1:
    build: ./server
    env_file: .env
    # add a healthcheck like web1's, against the realtime /health port (3001)

  worker:
    build: { context: ., target: worker }
    env_file: .env

  mongo:
    image: mongodb/mongodb-atlas-local
    # add a data volume and a healthcheck that pings the database (see the image docs)

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes", "--maxmemory-policy", "noeviction"]
    volumes: ["redis-data:/data"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 10

volumes:
  redis-data:
```

**Done when:** `docker compose up -d --wait` brings everything up healthy, and `docker compose down -v` followed by `up` rebuilds from nothing.

## 0.4 Nginx reverse proxy

**Goal:** one entry point. `/socket.io/` goes to realtime, everything else goes to web.

**Config (single instances now, Phase 2 adds more)**

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

upstream web      { server web1:3000; }
upstream realtime { server realtime1:3001; }

server {
    listen 80;
    client_max_body_size 6m;          # proof screenshots
    gzip on;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location /socket.io/ {
        proxy_pass http://realtime;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Request-ID $request_id;
        proxy_read_timeout 75s;       # longer than Socket.io's ping cycle
    }

    location / {
        proxy_pass http://web;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
    }
}
```

TLS comes in 4.4.

**Done when:** the site and the chat both work through `http://localhost`.

## 0.5 Health endpoints

**Goal:** machines (Docker, the uptime monitor, the deploy script) can tell whether each service works.

**Steps**
1. `GET /api/health` (liveness): returns 200 whenever the process runs. No database calls.
2. `GET /api/health/ready` (readiness): pings MongoDB and Redis with 1-second timeouts and returns:
   `{ status, version (git SHA), uptimeSeconds, checks: { mongo: { ok, ms }, redis: { ok, ms } } }`.
   It returns 503 if any check fails.
3. Realtime and worker each expose a tiny `/health` on an internal port. The worker's also reports whether it is connected to Redis.
4. Never put error messages or stack traces in a public health response.

**Know this:** open-source Nginx only does passive health checks (`max_fails` and `fail_timeout`), and active checks are an NGINX Plus feature. So Docker healthchecks and the uptime monitor do the active checking.

**Done when:** stopping Redis turns `/api/health/ready` into 503 while `/api/health` stays 200.

## 0.6 Structured logs

**Goal:** follow one request across all services.

**Steps**
1. Use `pino` in all three processes: JSON in production, `pino-pretty` in development.
2. Every log line carries: time, level, service (`web`, `realtime`, `worker`), `requestId` (from Nginx's `X-Request-ID`), `userId` when known, route, status and `durationMs`.
3. Wrap API route handlers in a small `withRequestLogging(handler)` helper.
4. Put the `requestId` into every job you queue, so worker logs link back to the request.
5. Redact secrets with pino's `redact` option: `authorization`, `cookie`, `password`, `token`, `otp`, card data. Log IDs, never full webhook bodies.
6. Read the log level from `LOG_LEVEL`.

**Done when:** you can search one `requestId` and see the Nginx line, the web log and the worker job log for the same action.

## 0.7 Sentry

**Goal:** you hear about errors before users report them.

**Steps**
1. Web: run `npx @sentry/wizard@latest -i nextjs`. Realtime and worker: `@sentry/node`.
2. Set release to the git SHA and environment to `development`, `staging` or `production`. Upload source maps in CI with a token stored as a GitHub secret.
3. Set `sendDefaultPii: false`, and attach `userId` (not email) to the scope.
4. Use a low trace sample rate in production (for example 0.1).
5. Turn on email alerts for new issues.
6. Add an admin-only route `/api/admin/debug-error` that throws, for testing.

**Done when:** the test error shows up in Sentry with a readable TypeScript stack trace.

## 0.8 CI skeleton (GitHub Actions)

**Goal:** every pull request is checked automatically.

**Steps** (`.github/workflows/ci.yml`, on `pull_request` and pushes to `main`):
1. Checkout, `actions/setup-node` with npm cache, `npm ci`.
2. `npm run lint` and `npm run typecheck` (`tsc --noEmit`).
3. `npm test` with Vitest. Add the first unit tests now, for example coin conversion helpers.
4. `next build`.
5. `docker build` with Buildx and the GitHub Actions cache. No push yet.

Later phases add integration tests (Phase 1), E2E (4.3), and image push plus deploy (4.4).

**Done when:** a pull request shows green checks and a failing test blocks the merge.

**Phase 0 interview story:** "I split a Next.js + Socket.io app into web, realtime and worker services behind Nginx, with health checks, structured logs, Sentry and CI."

---

# Phase 1: Money (weeks 2–4)

**Rules for all money code**
- Coins are integers. Money is integer minor units (paisa, cents). Never floats.
- Every money change runs inside a MongoDB transaction. Native driver: `session.withTransaction(...)`. Mongoose: `mongoose.connection.transaction(async (session) => ...)`. Both retry automatically when two transactions conflict.
- Keep transactions short. No network calls (Stripe, email, AI) inside them.
- Every money change has an idempotency key (1.2) and leaves a record. Nothing is ever edited or deleted. Mistakes are fixed with a reversing entry.

## 1.1 Double-entry coin ledger

**Goal:** every coin has a traceable history, and balances can never drift or go negative, even under many requests at once.

**Why it matters:** "How do you prevent double-spending?" is a classic interview question. This is your answer, backed by tests. It also covers your "transaction rollback" item: a failed step aborts the whole MongoDB transaction, and a business-level undo is a reversing entry.

**Design: collections**

`ledger_accounts`
- `_id`: for example `user:<userId>:available`
- `ownerId`, `kind` (`user_available`, `task_escrow`, `submission_hold` or `system`)
- `balance` (a cached number, kept in sync inside each transaction)
- `allowNegative` (false for users, true for system accounts)
- `createdAt`

System accounts (may go negative):
- `system:issuance`: where every sold coin comes from. Its negative balance equals the coins in circulation.
- `system:promotions`: signup bonuses, referral rewards, prizes.
- `system:payouts_pending`: coins waiting to be paid out.
- `system:migration`: opening balances when you switch over.

Per-object accounts: `escrow:task:<taskId>` and `hold:submission:<submissionId>`.

`ledger_transactions`
- `_id`, `type`, `idempotencyKey` (unique index)
- `entries`: a list of `{ accountId, amount }`, where a positive amount adds to an account and a negative amount subtracts
- `meta`: `{ taskId, submissionId, paymentId, withdrawalId }` as relevant
- `reversalOf` (for corrections), `createdBy` (a user ID or `system`), `createdAt`

**The core rule:** the entries in one transaction always add up to 0. Coins never appear or disappear, they only move.

**Transaction types**

| Event | Entries |
|---|---|
| Top-up paid (N coins) | `system:issuance` −N, buyer available +N |
| Signup bonus | `system:promotions` −N, user available +N |
| Task posted (W workers × R reward) | buyer available −W·R, `escrow:task:T` +W·R |
| Submission approved | `escrow:task:T` −R, worker available +R |
| Submission rejected (held during the dispute window, 1.4) | `escrow:task:T` −R, `hold:submission:S` +R |
| No appeal, or buyer wins dispute | `hold:submission:S` −R, `escrow:task:T` +R |
| Worker wins dispute | `hold:submission:S` −R, worker available +R |
| Task closed, leftover refunded | `escrow:task:T` −X, buyer available +X |
| Withdrawal requested | worker available −N, `system:payouts_pending` +N |
| Withdrawal paid | `system:payouts_pending` −N, `system:issuance` +N (coins retired) |
| Withdrawal rejected | `system:payouts_pending` −N, worker available +N |
| Any correction | a reversing transaction with `reversalOf` set |

**Revenue note:** if TaskHub earns from the gap between the buy rate and the withdrawal rate (for example 10 coins per $1 bought, 20 coins per $1 withdrawn), coins move 1:1 here and revenue shows on the money side (payments received minus payouts made). If you also take a fee in coins, add a `system:revenue` entry to the approval transaction.

**The posting function:** `postTransaction({ type, idempotencyKey, entries, meta, createdBy }, session)`
1. Validate: all amounts are integers, at least 2 entries, the sum is 0, every account exists.
2. Insert into `ledger_transactions`. A duplicate `idempotencyKey` means this was already done, so return the existing transaction and change nothing.
3. For each entry:
   - If the account can't go negative and the amount is negative, run
     `updateOne({ _id, balance: { $gte: -amount } }, { $inc: { balance: amount } }, { session })`.
     If no document matched, throw `InsufficientCoins`, which aborts everything.
   - Otherwise a plain `$inc`.

**Why this is safe:** two withdrawals that touch the same account at once conflict inside MongoDB. One transaction retries and re-checks the balance condition, so the second fails cleanly instead of overdrawing.

**Reading:** `getBalance(accountId)` reads the cached balance. `getHistory(accountId)` lists transactions that contain the account (index on `entries.accountId` plus `createdAt`).

**Nightly reconciliation job** (BullMQ, from 1.3):
1. Recompute every account's balance from `ledger_transactions` with an aggregation and compare it with the cached balance.
2. Check that the sum of all balances is 0.
3. Check each task's escrow (the invariant in 1.3).
4. Any mismatch sends a Sentry alert and shows a warning on the admin dashboard.

**Migrating from the `coins` field**
1. Add a maintenance-mode flag that blocks money actions and shows a banner.
2. Run a script that, for every user, creates the account and posts a `migration` transaction from `system:migration` equal to their current coins (key `migration:<userId>`). For every active task, post its remaining value (open slots × reward) into `escrow:task:<id>` the same way.
3. Verify: every user's ledger balance equals the old `coins` value, and the sum of all accounts is 0.
4. Switch reads and writes to the ledger (flag `LEDGER_ENABLED`), then turn off maintenance mode.
5. Keep the old `coins` field read-only for a week as a backup, then remove it.
6. Do a full dry run on a copy of the production database first.

**UI**
- Wallet page: balance and history (Top-up, Task funded, Earned, Refund, Withdrawal, Bonus) with links to the task or submission.
- Admin Ledger page: search transactions by user, type or date, a trial-balance widget (the total must be 0), and the reconciliation status.

**Tests** (Vitest with `mongodb-memory-server`'s `MongoMemoryReplSet`, because transactions need a replica set)
- Entries that don't sum to 0 are rejected.
- The same `idempotencyKey` twice creates one transaction.
- 20 withdrawals of 50 coins at the same moment from a 100-coin balance: exactly 2 succeed, the balance ends at 0 and is never negative.
- 1,000 random operations: the sum of all balances is always 0, no user goes below 0, and the cache equals the recomputed values.

**Done when:** every coin movement goes through `postTransaction`, no code writes `coins` directly (search the code to prove it), the tests pass and nightly reconciliation shows zero mismatches.

## 1.2 Idempotency keys

**Goal:** a retry (network glitch, double-click, a provider resending a webhook) can never credit or pay twice.

**Layer A: payment webhooks and callbacks**
- **Stripe:** in the route handler, read the raw body (`await req.text()`) and verify it with `stripe.webhooks.constructEvent(rawBody, signature, secret)`. Reject anything invalid. Credit coins on `checkout.session.completed` only when `payment_status` is `paid`, and on `checkout.session.async_payment_succeeded` for delayed payment methods. Key: `stripe:<checkout_session_id>`, the session rather than the event, so two different events for one payment still credit once.
- **SSLCommerz:** never trust the browser redirect. On the IPN, call SSLCommerz's validation API with the `val_id` and check the status, amount, currency and your own `tran_id` before crediting. Key: `sslcommerz:<tran_id>`.
- **bKash:** after the callback, call execute or query payment from your server and check the status is Completed and the amount matches. Key: `bkash:<paymentID>`.
- Save every incoming event in `payment_events` (`provider`, `eventId`, `type`, `receivedAt`, `processedAt`, `outcome`) with a unique index on `{ provider, eventId }`. It helps debugging and lets you replay safely.
- Credit through `postTransaction` with the key. A duplicate does nothing and still returns 200.
- Return 2xx quickly. Send notifications and emails through the queue, not inline.
- **Out-of-order events:** handlers check the current state first. For example, a refund event for a payment you haven't recorded yet goes back on the queue to retry later.

**Layer B: user actions** (withdrawal request, task posting, approve, reject, appeal, starting a top-up)
1. The client creates a UUID when the form opens, sends it as an `Idempotency-Key` header, reuses it on retries, and makes a new one after success.
2. Server helper `withIdempotency(handler)`:
   - Hash the method, path and body into `requestHash`.
   - Insert `{ userId, key, requestHash, status: "in_progress", createdAt }` into `idempotency_keys`, with a unique index on `{ userId, key }` and a 24-hour TTL index.
   - If the key exists, is completed and has the same hash, return the stored response. Same key with a different hash returns 422. Still in progress returns 409 ("already processing").
   - After the handler runs, store the status, response code and response body.
3. **Second guard:** ledger transactions also carry unique keys, such as `withdraw:<userId>:<key>` and `approve:<submissionId>`.
4. **UI:** disable buttons while a request is pending, and on 409 show "Still processing…".

**Tests**
- The same webhook sent twice at the same moment credits once.
- Replaying an old event changes nothing.
- A double-clicked withdrawal creates one withdrawal.
- The same key with a different amount returns 422.

**Done when:** every money endpoint and webhook uses keys, the tests pass, and an admin "Replay event" button proves that replaying a stored event is safe.

## 1.3 Escrow with 72-hour auto-approve (BullMQ)

**Goal:** the buyer's coins lock when a task is posted, the worker is paid on approval, and a buyer who never reviews can't block payment.

**Depends on:** 1.1, 1.2 and the worker process.

**Data**
- Submission: `status` (`pending`, `approved`, `rejected` or `disputed`), `submittedAt`, `autoApproveAt`, `decidedAt`, `decidedBy` (a user ID or `system`), `rejectionReason`.
- Task: `requiredWorkers`, `rewardPerWorker`, `deadline`, `status` (`active`, `paused` or `closed`).
- A slot counts as taken when a submission is pending, approved or held.

**Escrow invariant** (checked nightly): for each task, *funded = paid to workers + held + still in escrow (+ refunded after close)*.

**Flow**
1. **Post task:** validate with Zod, then in one transaction create the task and post `task_funded`. Not enough coins returns 422 with the error code `INSUFFICIENT_COINS`.
2. **Worker submits** (only if a slot is free): create the submission with `autoApproveAt = now + 72h`. After the commit, add a BullMQ job named `auto-approve` with `jobId: auto-approve-<submissionId>` and a 72-hour delay. BullMQ won't add a second job with the same ID, so a retry can't double-schedule. (Use dashes in job IDs, not colons.)
3. **Buyer approves:** in one transaction, `updateOne({ _id: S, status: "pending" }, { $set: { status: "approved", decidedBy, decidedAt } })`. If nothing matched, someone (the timer) already decided, so return 409. Otherwise post `submission_approved` with key `approve:<S>`. After the commit, remove the delayed job and notify the worker.
4. **Auto-approve job:** load the submission. If it's not pending, finish without doing anything. Otherwise run the same approval function with `decidedBy: "system"`, write an audit entry, and notify both users. Use `attempts: 5` with exponential backoff.
5. **Safety net:** a repeating BullMQ job every 15 minutes approves any pending submission whose `autoApproveAt` has passed, in case a delayed job was lost. It calls the same function, so running both is safe.
6. **Buyer rejects:** a reason of at least 10 characters is required. Set status to `rejected`, move R from escrow to `hold:submission:S`, and start the dispute window (1.4).
7. **Task close** (deadline passed, buyer closes it, or all slots approved): stop new submissions. Pending and held submissions still finish. When none are left, refund the leftover escrow to the buyer (`task_refund`) and set the task to `closed`. A `task-close` job at the deadline keeps re-checking until done. "Delete task" becomes "close task".

**UI**
- The buyer sees a countdown: "Auto-approves in 2d 5h".
- The worker sees an "Approved automatically" badge.
- The buyer dashboard has a "Needs review" list, oldest first.

**Testability:** make 72 hours configurable (`AUTO_APPROVE_AFTER_MS`) so tests can use 3 seconds.

**Queue dashboard:** run Bull Board (`@bull-board/api` with the Express adapter) inside the worker process on an internal port. Expose it through Nginx at `/admin/queues`, protected by basic auth plus your admin check, to watch waiting, delayed and failed jobs.

**Tests**
- Buyer approval and auto-approve at the same moment pay once.
- A worker can't submit when the slots are full.
- The refund after close equals the remaining slots × reward.
- The escrow invariant holds after random sequences of actions.
- Restart Redis while a job is delayed, and the submission is still auto-approved (AOF plus the safety net).

**Done when:** no coins move outside escrow, auto-approve survives a Redis restart, and nightly reconciliation passes.

## 1.4 Dispute flow

**Goal:** a worker can appeal an unfair rejection, an admin decides, and the coins move automatically.

**Design**
- When a buyer rejects, the reward moves into `hold:submission:S` instead of straight back into escrow, and the slot stays taken until the dispute window (3 days, configurable) ends. This keeps every coin accounted for, so a worker who wins is always paid from the held coins. The trade-off is that the slot reopens up to 3 days later. Write that in an ADR.
- `disputes` collection: `submissionId`, `taskId`, `workerId`, `buyerId`, `status` (`open`, `under_review`, `resolved_worker`, `resolved_buyer` or `withdrawn`), `workerStatement`, `workerEvidence` (image URLs), `buyerStatement`, `adminId`, `adminNote`, `createdAt`, `resolvedAt`.

**Flow**
1. On rejection: hold the coins (1.3 step 6) and schedule a `dispute-window` job (`jobId: dispute-window-<S>`) at +3 days.
2. The worker chooses:
   - **Accept rejection:** the hold goes back to escrow right away and the slot reopens.
   - **Appeal:** a statement of at least 30 characters and an optional extra screenshot. The submission becomes `disputed` and the dispute `open`, and the window job no longer releases the hold.
3. The buyer is notified and may add a statement within 48 hours.
4. **Admin queue** (oldest first), side by side: the task requirements, the worker's proof, the AI check result (3.5), the buyer's reason, the worker's appeal, and both users' history (approval rate, past disputes and outcomes, fraud flags). Deciding requires a note and a 2FA step-up (1.6).
5. **Worker wins:** the hold goes to the worker (`dispute_won`) and the submission becomes `approved`. **Buyer wins:** the hold goes back to escrow and the slot reopens, or the buyer is refunded if the task has closed.
6. Both users are notified, and an audit entry is written.
7. If the window ends with no appeal, the hold goes back to escrow and the slot reopens.

**Abuse controls**
- At most 3 open disputes per worker.
- Lost disputes lower the trust score (3.4).
- Buyers whose rejections are often overturned get flagged as harsh reviewers, and their future rejections go to admin review.

**Admin service level:** show each dispute's age, and notify admins when one is older than 48 hours.

**Tests:** a dispute can't be resolved twice (conditional update on status); "accept rejection" racing with the window job resolves once; hold balances end at 0 after resolution.

**Done when:** appeal, decision and payout all work end to end, with audit entries and notifications.

## 1.5 Audit log of admin actions

**Goal:** answer "who did what, when and why" for every sensitive action.

**Collection `audit_logs`:** `actorId` (or `system`), `actorRole`, `action`, `targetType`, `targetId`, `before`, `after` (only the changed fields), `reason`, `ip`, `userAgent`, `requestId`, `createdAt`.

**Log these actions:** withdrawal approve, reject and mark-paid; dispute decisions; user ban, unban and role changes; manual coin adjustments (always as a ledger transaction plus a log entry); task removal; settings changes (rates, limits); 2FA resets; system auto-approvals.

**Rules**
1. Write the log entry inside the same transaction as the action, so an action can never happen without its log.
2. **Append-only:** the app never updates or deletes entries. Give the app's MongoDB user a custom role that only allows `insert` and `find` on `audit_logs`. This shows you understand least privilege.
3. **Tamper evidence (optional):** a nightly job hashes all of the previous day's entries in order and stores `{ date, count, digest }` in a separate collection. A "Verify" button recomputes the digests and flags any day that changed. A daily digest avoids the ordering problems of chaining every single entry.

**Admin UI:** filters (actor, action, target, date) and CSV export.

**Done when:** every admin action creates exactly one entry (one test per endpoint), and a test shows the app's database user can't update or delete audit entries.

## 1.6 Two-factor authentication (TOTP) for admins

**Goal:** a stolen admin password isn't enough to do damage.

**Steps**
1. **Enrollment:** generate a secret with `otplib`, show it as a QR code (`qrcode` package) and as a manual key, and confirm with one 6-digit code.
2. **Storage:** encrypt the secret with AES-256-GCM (`node:crypto`), using a 32-byte key from the `MFA_ENCRYPTION_KEY` environment variable. Store the IV, auth tag and ciphertext. Never store the secret in plain text.
3. **Recovery codes:** show 10 codes once. Store only their hashes (bcrypt or argon2), and let each work once.
4. **Login:** after the password, an admin's session is marked "2FA pending". Every admin page and admin API route checks `mfaVerifiedAt` on the server, on every request.
5. **Step-up:** sensitive actions (approve a withdrawal, decide a dispute, adjust coins, change roles or settings) need a code verified in the last 15 minutes. Otherwise ask for a code again.
6. **Limits:** after 5 wrong codes in 15 minutes, lock for 15 minutes (a database counter now, Redis in 2.3). Reject reuse of the same code within its 30-second window by storing the last used time step.
7. **Lost phone:** another admin with 2FA can reset it, and the reset is audit-logged.
8. **Mandatory:** an admin can't open the admin panel until 2FA is set up.

**Later option:** passkeys (WebAuthn).

**Tests:** wrong code, reused code, expired step-up, each recovery code works only once. Playwright can generate valid codes from a seeded secret with `otplib`.

**Done when:** no admin action is possible without a verified second factor.

## 1.7 Withdrawal safeguards

**Goal:** stop stolen accounts and fraud rings from cashing out.

**Flow**
1. The worker requests a withdrawal: the amount must meet the minimum, they choose a payout method (bKash, Nagad or bank) and number, the coins move to `system:payouts_pending` (1.1), and the status becomes `requested`.
2. At request time, compute a `riskScore` with readable reasons:
   - Account younger than 7 days: hold.
   - Payout number changed in the last 48 hours: hold. This is the classic account-takeover pattern.
   - The same payout number used by another account: high risk (multi-account signal, also used in 3.2).
   - Today's earnings above 5× the 30-day daily average: review.
   - Open fraud flags or recently lost disputes: review.
   - Daily and weekly limits by trust level (3.4).
3. **Worker confirmation:** an email link ("Confirm this withdrawal", valid for 30 minutes), or a TOTP code if the worker turned on 2FA. Unconfirmed requests are cancelled after 24 hours and the coins return.
4. **Admin queue** sorted by risk, showing the reasons. Approving requires a 2FA step-up. The admin pays manually through bKash, Nagad or the bank and enters the external transaction ID, which sets the status to `paid` and posts `withdrawal_paid`. Rejecting requires a reason, and the coins return.
5. Notify the worker at every step, and audit-log every admin action.

**Note:** Stripe doesn't support Bangladesh-based merchant accounts, so payouts stay manual and Stripe stays in test mode for the portfolio. bKash and SSLCommerz are your local rails.

**Tests**
- Changing the number and then withdrawing gets held.
- The same number on two accounts gets flagged.
- A double request with the same idempotency key creates one withdrawal.
- A rejection returns exactly the requested coins.

**Done when:** every withdrawal has a risk score with reasons, and nothing is paid without an admin's 2FA.

**Phase 1 interview story:** "Coins live in a double-entry ledger on MongoDB transactions. Tasks are funded through escrow, payment webhooks and user actions are idempotent, and a BullMQ job auto-approves after 72 hours. A concurrency test with many parallel withdrawals shows zero double-spends."

---

# Phase 2: Scale (weeks 5–6)

**Phase goal:** two of everything behind Nginx, and the app still behaves as one.

## 2.1 Socket.io Redis adapter and sticky sessions

**Goal:** run two realtime instances. Chat and notifications reach everyone, and if one instance dies, users reconnect to the other.

**Why it matters**
- With two instances and no adapter, a message emitted on instance A never reaches a user connected to instance B. The Redis adapter shares events between instances.
- Socket.io usually starts with HTTP long-polling and then upgrades to WebSocket. Without sticky sessions, those first requests land on different instances and fail with "Session ID unknown".

**Steps**
1. Install `@socket.io/redis-adapter` and a Redis client, and set `io.adapter(createAdapter(pubClient, subClient))`.
2. **Authenticate on connect:** in `io.use()`, verify the session cookie or a short-lived token and reject anything else. Join the user to the room `user:<id>`, and join conversation rooms only after checking membership.
3. **Emit from web and worker without a socket connection:** use `@socket.io/redis-emitter`, so for example the worker can emit `notification:new` to `user:<id>`.
4. **Compose:** add `realtime1` and `realtime2` as named services. Named services keep the Nginx config simple.
5. **Nginx sticky sessions:**
   ```nginx
   upstream realtime {
       hash $remote_addr consistent;
       server realtime1:3001;
       server realtime2:3001;
   }
   ```
   If you later put Cloudflare in front, first restore the real client IP (`set_real_ip_from` and `real_ip_header`), or every user hashes to the same instance.
   **The alternative:** clients use `transports: ["websocket"]` only, so no stickiness is needed, but networks that block WebSockets lose the polling fallback. Record your choice in an ADR. Both the web client (`src/hooks/useSocket.ts`) and the mobile client (in the separate `taskhub-mobile-app` repo) already connect with `transports: ["websocket"]`, so sticky sessions only matter if long-polling is re-enabled.
6. **Reconnection:** the client shows "Reconnecting…", and on reconnect it fetches messages newer than the last one it has, over REST, so nothing is lost. (Optional: the Redis Streams adapter supports Socket.io's connection state recovery.)
7. **Graceful shutdown:** on SIGTERM, stop accepting connections and call `io.close()`, so clients move to the other instance.

**Tests:** two clients on different instances exchange messages; `docker compose stop realtime1` mid-chat, and clients reconnect to `realtime2` within seconds and catch up.

**Done when:** the "kill an instance" demo works reliably. Record it for the demo video.

## 2.2 Load-balanced web instances

**Goal:** two Next.js instances, and stopping one doesn't take the site down.

**Steps**
1. Add `web2`. In Nginx use `least_conn` and `max_fails=3 fail_timeout=10s` on both servers.
2. **Make web stateless:** sessions in signed cookies or the database, uploads to Cloudinary or S3 (never local disk), and anything shared in Redis rather than in memory.
3. **Next.js cache:** if you use ISR or `revalidateTag`, both instances need a shared cache through a Redis-backed `cacheHandler`. If you don't, skip it. Run identical images so the build IDs match.
4. **Rolling restart script:** restart `web1`, wait until healthy, then `web2`. The deploy (4.4) reuses this.

**Done when:** stopping `web1` doesn't break the site, and the Nginx logs show both instances serving.

## 2.3 Redis rate limiting

**Goal:** stop brute force, spam and runaway AI costs, with limits shared by every instance.

**Tool:** `rate-limiter-flexible` with a Redis store (or a small Lua script).

| Action | Limit | Key |
|---|---|---|
| Login | 5 per 15 min per account, 30 per 15 min per IP | `rl:login:acct:<email>`, `rl:login:ip:<ip>` |
| Signup | 5 per hour per IP and device | `rl:signup:<ip>:<deviceId>` |
| 2FA code | 5 per 15 min per user | `rl:mfa:<userId>` |
| Task submission | 30 per hour per worker | `rl:submit:<userId>` |
| Withdrawal request | 3 per day per worker | `rl:withdraw:<userId>` |
| Chat message (socket event) | 20 per 10 s per user | `rl:chat:<userId>` |
| AI features | 20 per day per user | `rl:ai:<feature>:<userId>` |
| Public API (5.5) | per key, set per plan | `rl:api:<keyId>` |

**Rules**
- Take the client IP from Nginx's `X-Real-IP` only. Never trust an `X-Forwarded-For` header sent by the client.
- Many mobile users in Bangladesh share IP addresses through their carrier, so keep IP limits generous and account limits strict.
- Respond with 429 and a `Retry-After` header, and have the UI show "Try again in 2 minutes".
- **If Redis is down:** allow requests through for chat and reading (fail open), block login and withdrawals (fail closed). Write it in an ADR.
- Keep all limits in one config file, and log every block.

**Tests:** the 6th login attempt gets 429 even when the requests alternate between `web1` and `web2`. This proves the limit is shared.

**Done when:** every row in the table is enforced and covered by a test.

## 2.4 Presence and read receipts

**Presence (online / last seen)**
1. While a socket is connected, refresh the Redis key `presence:<userId>` with a 60-second TTL every 25 seconds. Online means the key exists. If an instance crashes, its users go offline automatically when the keys expire, so there are no "ghost" online users.
2. Update `lastSeen:<userId>` on each heartbeat and on disconnect, and save it to MongoDB periodically.
3. Send presence changes only to people who share a conversation with the user. Wait about 10 seconds before announcing "offline", so reconnects and tab switches don't flicker.
4. Add a privacy setting to hide "last seen".

**Read receipts (1:1 chat)**
1. Messages get `deliveredAt` and `readAt`.
2. **Delivered:** the recipient's client acknowledges receipt with a Socket.io acknowledgement callback. Set `deliveredAt` and tell the sender (two grey ticks).
3. **Read:** when the conversation is open and the tab is visible (`document.visibilityState === "visible"`), the client sends `conversation:read { conversationId, upToMessageId }`, throttled. The server sets `readAt` on all unread messages up to that ID with one `updateMany`, then tells the sender (two blue ticks).
4. **Unread counts:** store `lastReadMessageId` per participant and count the messages after it, using an index on `{ conversationId: 1, _id: 1 }`.
5. **Typing indicator** (existing): throttle to one event per 2 seconds and auto-hide after 3 seconds without updates.

**Tests:** two Playwright browser contexts check online, offline after closing, and the read receipt after the tab is focused, across both realtime instances.

**Done when:** all of it works with users on different instances.

## 2.5 Load tests (k6)

**Goal:** real numbers in the README, and at least one performance problem you found and fixed.

**Setup**
- Put the scripts in `load/`. Run k6 as a Compose service under a `loadtest` profile, inside the Docker network.
- Give the containers resource limits close to your VPS (for example 1 CPU and 1 GB per web container), and write the hardware next to the numbers. Numbers without hardware mean nothing.
- Seed realistic data (for example 10,000 tasks and 1,000 users), and use a fake payment provider. Never load test Stripe or bKash.

**Scenarios**
1. **Browse:** task list, task details, search. Read-heavy.
2. **Work:** workers submit proofs and buyers approve them. This exercises the ledger transactions.
3. **Chat:** many socket connections sending messages. k6's WebSocket module speaks raw WebSocket, so you would have to hand-write Socket.io's message format. Artillery has built-in Socket.io support and is easier for this scenario.

**Thresholds (example):** `http_req_failed: ['rate<0.01']`, `http_req_duration: ['p(95)<300']`.

**Method**
1. Ramp up until errors appear or p95 breaks the threshold. That is your maximum sustainable requests per second.
2. Run with 1 web instance, then 2, to build a scaling table.
3. Find the bottleneck (MongoDB `explain()`, the slow query log, CPU). Fix one thing, for example a missing index or caching the first page of the task list in Redis for 15–30 seconds. Re-run and record the before and after.

**README table:** scenario, instances, requests per second, p95, error rate, hardware.

**Done when:** the table has real numbers and at least one before-and-after fix story.

**Phase 2 interview story:** "I ran Socket.io across two instances with a Redis adapter and sticky sessions, made rate limits shared through Redis, and load-tested to X requests per second at p95 Y ms. I found a missing index that cut p95 from A to B."

---

# Phase 3: Fraud, trust and first AI (weeks 7–9)

## 3.1 Perceptual hashing of proof screenshots

**Goal:** catch reused or copied proof screenshots.

**How it works:** a perceptual hash turns an image into a 64-bit fingerprint that barely changes when the image is resized or recompressed. The Hamming distance (the number of bits that differ) measures how similar two images are.

**Steps**
1. **On upload:** check the file type by its content (not the extension), enforce a maximum size (for example 5 MB), and re-encode with `sharp`, which strips metadata and hidden payloads.
2. Compute a SHA-256 hash (exact duplicates) and a dHash: resize to 9×8 grayscale and compare neighbouring pixels to get 64 bits. That's about 30 lines with `sharp`, and writing it yourself is good learning. A pHash (DCT-based) is a little more robust, and packages exist for it.
3. Store on the submission: `proofHashes: { sha256, dhash, chunks }`, where `chunks` holds the 8 bytes of the dHash labelled by position (for example `"0:a3"`, `"1:5f"`) with a multikey index.
4. **Finding near-duplicates:** if two hashes differ by 7 bits or fewer, at least one of the 8 bytes must be identical. So query submissions that share any chunk, then compute the exact distance in code. Search the last 90 days.
5. **Rules**
   - An exact or near-exact match (distance of 3 or less) from a different worker: flag both. The earlier submitter is probably the original.
   - The same worker reusing one screenshot on different tasks: flag.
   - **Important:** on tasks where everyone screenshots the same page (for example "follow this page"), honest proofs look alike. Keep the threshold strict, and compare the visible username (read by the AI check in 3.5) before flagging.
6. **Flags** go to `fraud_flags` (`userId`, `submissionId`, `type: "duplicate_proof"`, `severity`, `evidence: { otherSubmissionId, distance }`, `status` of open, dismissed or confirmed, `reviewedBy`). The buyer sees a "Possible duplicate proof" badge, and admins get a fraud queue.

**Tests:** the same image resized and recompressed matches; two screenshots of the same screen with different usernames are not flagged once the username check is on; tune the threshold on a set of about 30 image pairs.

**Done when:** the flag appears within seconds of a submission (computed in the worker), with its accuracy measured on your test set.

## 3.2 Device and IP signals (multiple accounts)

**Goal:** find one person running many accounts.

**Signals, collected at signup, login, submission and withdrawal**
- **Device ID:** a random UUID in a long-lived httpOnly cookie, with a copy in localStorage so it survives cookie clearing.
- IP address (from Nginx) and user agent. Optionally a browser fingerprint (the open-source FingerprintJS library, which is weaker than the paid version).
- Payout numbers, phone numbers and normalized emails (lowercase; for Gmail, remove dots and `+tags`).

**Storage:** `device_sightings` (`userId`, `deviceId`, `ipHash`, `userAgent`, `firstSeen`, `lastSeen`). Hash IPs with a secret salt and keep them for 90 days.

**Rules (by strength)**
- The same payout number on 2 or more accounts: high.
- The same device ID on 3 or more accounts: high.
- The same normalized email or phone: blocked at signup.
- A worker and a buyer on the same device doing tasks for each other (self-dealing): high.
- The same IP: weak on its own, because mobile carriers and offices share IPs. Only use it together with other signals.

**Admin "Linked accounts" panel:** accounts that share signals, with actions to dismiss, warn, or ban the whole group (which also freezes their withdrawals).

**Privacy:** mention this in your privacy policy, and never show these signals to other users.

**Done when:** two accounts made on one browser get flagged, and a dismissed pair doesn't fire again.

## 3.3 Earning-speed limits

**Goal:** stop bots and farms from draining tasks faster than a human could.

**Rules**
1. **Daily earning cap by level** (3.4), for example L0 100 coins, L1 300, L2 800, L3 2,000. Tune these to your economy. Enforce the cap at submission time: a worker can't submit new work once today's approved plus pending rewards reach the cap. Show "Daily limit reached, resets at midnight (Dhaka time)".
2. **Minimum time on task:** record `viewedAt` when the worker opens the task. The buyer can set `minSeconds` (for example 120 for "watch a 2-minute video"). If `submittedAt − viewedAt` is shorter, block the submission with a clear message.
3. **Submission rate:** the per-hour limit from 2.3.
4. **Velocity anomaly:** today's earnings above 5× the worker's 30-day average put withdrawals on hold for review (1.7).

**Implementation:** Redis counters such as `earn:<userId>:<YYYY-MM-DD>` with a 48-hour TTL.

**Transparency:** show the worker their limits on the dashboard.

**Done when:** the limits are enforced on the server, shown in the UI, and configurable per level in settings.

## 3.4 Worker trust score and levels

**Goal:** reward reliable workers and limit risk from new or suspicious accounts.

**Score (0–100):** recomputed after relevant events (approval, rejection, dispute result, fraud flag), debounced, and for everyone nightly.

| Component | Points |
|---|---|
| Approval rate over the last 90 days (minimum 10 submissions) | up to 40 |
| Number of approved submissions (log scale) | up to 15 |
| Account age | up to 10 |
| Verified email and phone | up to 10 |
| No lost disputes in 90 days | up to 10 |
| No confirmed fraud flags | up to 15 (a confirmed flag also caps the score at 20) |

**Levels:** L0 New (below 30), L1 Regular (30–59), L2 Skilled (60–79), L3 Trusted (80 and above).

**Effects**
- Buyers can set a minimum level on a task (`minLevel`), so higher-paying tasks unlock only for trusted workers.
- Earning caps (3.3) and withdrawal limits (1.7) depend on the level.

**Anti-gaming:** approvals from linked accounts (3.2) don't count.

**Transparency:** a worker page such as "Your level: Skilled (72). To reach Trusted, keep your approval rate above 95% for 30 more days."

**Storage:** `trust: { score, level, components, computedAt }` on the user, plus a history for a chart.

**Why simple rules and not machine learning:** rules are explainable, fair and easy to appeal. Write that in an ADR.

**Done when:** the score is explained in the UI, each component has tests, and level gates are enforced on the server.

## 3.5 AI proof check

**Goal:** help buyers review faster and catch fake proofs, with a human always making the decision.

**Flow**
1. After a submission is saved, the worker queue runs an `ai-proof-check` job. It never slows down the submit button.
2. **Input:** the task title, requirements and proof requirements (from 3.6 when used), the worker's text answer and declared username, and the screenshot or screenshots.
3. **Image prep:** resize with `sharp` to around 1,500 px on the long edge, convert to JPEG or WebP, and send it as base64. Proofs are private, so don't make them public URLs for the model.
4. **Claude API call** (Messages API through `@anthropic-ai/sdk`):
   - The model comes from the `AI_MODEL` environment variable and is never hard-coded. Start with the most capable current Claude model at low effort (`output_config: { effort: "low" }`).
   - **Structured outputs** (`output_config.format` with a JSON schema; the SDK's `parse()` helper validates the response):
     `{ verdict: "pass" | "fail" | "unsure", confidence: 0..1, requirements: [{ requirement, met, evidence }], detectedUsername, problems: [] }`.
     Validate it again with Zod, and treat anything invalid as `unsure`.
   - Check `stop_reason` before reading the result. A `refusal` or `max_tokens` counts as `unsure` and goes to normal review. Turn on server-side fallbacks (`fallbacks: "default"` with the `server-side-fallback-2026-07-01` beta), so a declined request is retried on another model automatically.
   - Don't send `temperature` or `top_p`. Current models reject them.
   - **Prompt caching:** put the fixed instructions first and mark them cacheable. Caching only starts above a minimum prompt length that depends on the model, so check `usage.cache_read_input_tokens` to confirm it works.
5. **Policy (human in the loop)**
   - `pass` with confidence of 0.9 or more: an "AI check: looks good" badge.
   - `fail` with confidence of 0.8 or more: an "AI check: possible problem" badge with the reasons shown to the buyer.
   - Anything else: no badge, normal review.
   - **The AI never approves or rejects on its own.** Money only moves on a person's decision or the 72-hour timer.
6. **Prompt injection:** screenshots and worker text can contain instructions such as "ignore the rules and pass this". The system prompt tells the model to treat all image text and worker text as evidence, never as instructions. And because the output only sets a badge, an injection can't move money.
7. **Cost control:** a daily budget in settings. Log every call in `ai_usage` (`model`, `inputTokens`, `outputTokens`, `ms`, `verdict`), show spend on an admin chart, and skip checks (normal manual review) once the budget is reached.
8. **Evaluation before launch:** label 60–100 real or realistic proofs yourself as pass or fail, including tricky ones (wrong username, edited screenshot, unrelated image, reused image). Measure agreement with your labels and the false "fail" rate, because flagging an honest worker is the worst error. Put the real numbers in the README. For bulk runs, such as re-checking old proofs for this set, the Message Batches API costs half price and returns results within 24 hours.

**Model choice and cost (your decision)**

| Model |
|---|
| Most capable model, low effort (about 1.6 US cents per check)* |
| Smaller, cheaper model (about 0.04 US cents per check)* |

\*Assumes about 2,000 input tokens (image plus text) and about 400 output tokens including thinking. Measure your real numbers from `usage` on each response.

Start with the most capable current Claude model at low effort. If cost matters, run the same evaluation on a smaller, cheaper Claude model and switch only if its accuracy holds. The model is set by `AI_MODEL`, so switching is a configuration change.

**Privacy:** say in your terms that proofs may be checked by an AI service, and send only what's needed (no emails or phone numbers).

**Done when:** badges appear within about 30 seconds of a submission, the evaluation numbers are recorded, and the budget cap is tested.

## 3.6 AI task-writer

**Goal:** a buyer types a rough idea and gets a clear task with checkable proof requirements and a suggested reward.

**Flow**
1. A "Write with AI" button on the post-task form opens a box for the idea (maximum 500 characters).
2. **The server adds context:** platform rules (allowed and blocked task types), the category list, and reward statistics per category from your database (the median and the middle 50% range of recently approved tasks), so the price suggestion is based on real data.
3. **Claude call with structured output:**
   `{ title, category, steps: [], proofRequirements: [], suggestedRewardCoins, rewardReason, estimatedMinutes, suggestedWorkers, minLevel, policyIssue }`.
   Take the model from the `AI_MODEL` environment variable (never hard-coded). Start with the most capable current Claude model at effort `low`, and raise it to `medium` only if the drafts are weak. Evaluate a smaller, cheaper Claude model on the same sample ideas before switching.
4. **Policy:** if the idea breaks the rules (fake reviews, account farming, anything illegal or against another platform's terms), `policyIssue` explains why and the form stays empty. Optionally run the same policy check on every task at posting time, not only AI-written ones.
5. The answer fills the form as an editable draft. The buyer must review it, and nothing posts automatically. Mark such tasks internally as "drafted with AI".
6. **Proof requirements are short, checkable sentences,** for example "Screenshot shows the channel name 'X' and the Subscribed button". That is exactly what 3.5 checks. **This is the story:** the writer produces checkable requirements, and the checker verifies them.
7. Rate limit (20 per day per buyer), the daily budget, and usage logging, as in 3.5.

**Done when:** 10 sample ideas produce usable drafts, the policy refusals are tested, and usage is logged.

**Phase 3 interview story:** "I added fraud detection with perceptual hashing and device linking, an explainable trust score, and an AI proof checker that only labels submissions while people decide. It agreed with human decisions on Z% of N labeled proofs."

---

# Phase 4: AI search, end-to-end tests, deploy (weeks 10–12)

## 4.1 Semantic search and recommendations (Atlas Vector Search)

**Goal:** workers find relevant tasks by meaning, not just exact words, and get personal recommendations.

**Embeddings**
1. When a task is created or edited, the worker queue embeds `title + category + steps` with an embeddings model (for example Voyage AI, now part of MongoDB, or another provider). Store `embedding` (an array of numbers), `embeddingModel` and `embeddedAt`.
2. Store the model name because changing models later means re-embedding everything.
3. Run a backfill job for existing tasks.

**Vector index** (Atlas Vector Search, which also works locally in `mongodb-atlas-local`):

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 1024, "similarity": "cosine" },
    { "type": "filter", "path": "status" },
    { "type": "filter", "path": "minLevel" },
    { "type": "filter", "path": "category" }
  ]
}
```

Set `numDimensions` to your embedding model's actual size.

**Search**
1. Embed the user's query, then run `$vectorSearch` with `queryVector`, `numCandidates` about 10–20× the `limit`, a `limit` of 20, and a `filter` such as `{ status: "active", minLevel: { $lte: userLevel } }`.
2. **Hybrid search:** also run normal keyword search (Atlas Search `$search`, or a text index), and merge the two lists with reciprocal rank fusion (each result scores the sum of `1 / (60 + rank)` across both lists). Keywords catch exact names, and vectors catch meaning: "youtube" finds "watch my channel trailer".
3. Cache embeddings of popular queries in Redis for 24 hours.

**Recommendations**
1. **Worker profile vector:** the average embedding of the tasks they had approved in the last 60 days, recomputed nightly.
2. **"Recommended for you":** `$vectorSearch` with the profile vector, filtered to tasks they can actually do (level, targeting, not already submitted, not their own).
3. **Re-rank** by similarity, freshness and reward. With no history yet (cold start), show the newest and most popular tasks.

**Measure it**
- Log impressions and clicks for "Recommended" and "Latest", and compare click-through and completion rates.
- **Offline check:** hide each worker's last 5 approved tasks and count how many appear in their top 10 recommendations (hit rate at 10).

**Done when:** 20 test queries you wrote return relevant results, and the recommendation metrics are recorded.

## 4.2 RAG help bot

**Goal:** a help chat that answers from your own rules and FAQ, cites its sources, and says "I don't know" instead of inventing policy.

**Knowledge base:** markdown files in `content/help/` covering rules, FAQ, coin rates, withdrawals, disputes, levels, fees and safety. You write them, they live in git, and a Bangla version comes later.

**Ingestion** (a worker job on every deploy)
1. Split each article by headings into chunks of about 300–500 words, with a small overlap.
2. Embed the chunks and store them in `help_chunks` (`docSlug`, `heading`, `text`, `embedding`, `version`), with a vector index.

**Answering**
1. Embed the question and get the top 5 chunks (vector plus keyword hybrid, as in 4.1).
2. Send the chunks to Claude as `document` content blocks with `citations: { enabled: true }`. The answer then comes back with citations pointing to the exact chunk, which you show as links to that help section. Citations can't be combined with structured outputs, so this answer is plain text.
3. **Instructions:** answer only from the provided documents. If they don't answer the question, say so and offer "Contact support".
4. **Personal questions** ("why is my withdrawal pending?"): give the model read-only tools such as `get_my_withdrawals` and `get_my_submission_status`, using the SDK's tool runner with `strict: true` schemas. The server fills in the logged-in user's ID, and the model never chooses whose data to read. No tool can move money.
5. Stream the answer (`client.messages.stream`) so it feels like a chat.
6. Take the model from the `AI_MODEL` environment variable (never hard-coded). Start with the most capable current Claude model at low effort, evaluate a smaller, cheaper Claude model on the same evaluation set before switching, and use the same budget, fallbacks and usage logging as 3.5.
7. **Feedback:** thumbs up or down on each answer. "Talk to a human" creates a support ticket with the conversation attached.

**Evaluation:** 40 questions with expected answers, including some the docs don't answer, where the bot must decline. Check that each answer is correct, grounded in the docs and cited. Re-run whenever the docs change.

**Done when:** the evaluation meets the target you set (for example 90% correct and zero invented policies), and the limits and budget work.

## 4.3 Playwright end-to-end tests

**Goal:** prove the whole product works, automatically, on every change.

**Main test** (several users in one test file)
1. Seed a fresh database.
2. **Buyer:** logs in, tops up through a fake payment provider in the E2E environment, and posts a task. Check that the escrow balance changes.
3. **Worker:** finds the task through search, submits proof (a fixture image) and sees "pending".
4. **Buyer:** receives a live notification and approves.
5. **Worker:** sees the balance increase and "Earned" in the history.
6. **Worker:** requests a withdrawal and confirms it through the emailed link, read from Mailpit's API.
7. **Admin:** logs in with 2FA (the test generates the code with `otplib` from the seeded secret), approves, and marks it paid.
8. **Worker:** sees "Paid" and a notification.

**More tests:** auto-approve with `AUTO_APPROVE_AFTER_MS=3000`; a dispute won and a dispute lost; the rate-limit message; chat with read receipts between two browser contexts.

**A separate nightly test:** a real Stripe test-mode payment, with `stripe listen` forwarding webhooks.

**Good practice**
- Save each role's login as `storageState` in a setup project.
- Use web-first assertions (`await expect(locator).toHaveText(...)`) and never fixed sleeps.
- Use unique data per run.
- Set `trace: "retain-on-failure"`.

**In CI:** start the stack with `docker compose -f compose.yml -f compose.ci.yml up -d --wait`, run the tests, and upload the HTML report and traces only when something fails.

**Done when:** the main flow passes 10 runs in a row both locally and in CI, with no flaky failures.

## 4.4 Deploy

**Goal:** a merge to `main` deploys itself with zero downtime, and you can roll back in one command.

**Tip:** you can do a first rough deploy right after Phase 0 to find hosting problems early, then automate it here.

**Server**
1. A VPS with Ubuntu LTS. 2 vCPUs and 4 GB of RAM is plenty to start (for example Hetzner or DigitalOcean, or a free tier such as Oracle Cloud).
2. **Hardening:** a non-root deploy user with SSH keys only (password login off), a firewall (`ufw` allowing 22, 80 and 443), `fail2ban`, and automatic security updates.
3. Install Docker Engine and the Compose plugin.
4. Point your domain's A record at the VPS. Set up TLS with Let's Encrypt (`certbot`) with automatic renewal, redirect HTTP to HTTPS, then add the HSTS header.

**Data**
- **MongoDB Atlas** for production (managed, and it has Vector Search). The free tier has no automated backups, so run a nightly `mongodump` to object storage (for example Cloudflare R2 or Backblaze B2), keep 14 days, and test a restore once.
- **Redis** on the VPS with AOF.

**CI/CD**
1. On a merge to `main` with green CI, build the `web`, `realtime` and `worker` images, tag them with the git SHA and push them to GitHub Container Registry (GHCR).
2. **Deploy job** (a GitHub Environment named "production" holding the secrets): SSH to the VPS, `docker compose pull`, run migrations (scripted and safe to re-run), then a rolling restart: `web1`, wait healthy, `web2`, the same for realtime, and the worker last. Finish with a smoke test of `/api/health/ready`.
3. **Rollback:** redeploy the previous SHA (`IMAGE_TAG=<sha> ./scripts/deploy.sh`). Write it in a README runbook and test it once.

**Secrets:** a `.env` file on the server owned by the deploy user with `chmod 600`. Never in images or in git.

**Monitoring:** an uptime monitor (for example UptimeRobot or Better Stack, both with free tiers) on `/api/health/ready`, Sentry alerts, Bull Board for the queues, and a disk-space alert.

**Old URL:** redirect task-hub-io.vercel.app to the new domain.

**Done when:** a merge deploys with no downtime, and a rollback has been tested.

## 4.5 README and demo video

**Goal:** a hiring manager understands the project in 2 minutes and can verify your claims.

**README sections**
1. One-line pitch, live link and demo video link.
2. **Demo accounts** (buyer and worker), with data reset nightly by running the seed. Show the admin side only in the video and never give the public admin access.
3. Architecture diagram (Mermaid) and a short explanation of each service.
4. **Key engineering decisions,** linking the ADRs: ledger, escrow and auto-approve, idempotency, sticky sessions, rate limits, human-in-the-loop AI.
5. **Numbers:** the load-test table with hardware, AI evaluation results, test counts, Lighthouse scores.
6. **Run locally:** `cp .env.example .env`, `docker compose up -d --wait`, `npm run seed`.
7. How to run unit, integration, E2E and load tests.
8. Security notes: 2FA, audit log, rate limits, upload checks.
9. Screenshots or GIFs, and the roadmap.

**Demo video** (2–3 minutes, unedited, as some employers ask)

| Time | Show |
|---|---|
| 0:00 | What TaskHub is, in one sentence |
| 0:15 | A buyer drafts a task with the AI writer, and the escrow balance moves |
| 0:40 | A worker finds it through search or recommendations, submits proof, and the AI check badge appears |
| 1:05 | The buyer approves, and the ledger history updates on both sides |
| 1:25 | Chat between two browsers with typing, presence and read receipts; stop one realtime container live and the chat reconnects |
| 1:55 | Admin: a dispute decision and a withdrawal approval with 2FA, then the audit log entry |
| 2:20 | Architecture diagram, k6 numbers, the green CI pipeline; close |

Record with OBS Studio. Upload to YouTube as unlisted and to Google Drive set to "Anyone with the link can view".

**Then** write a LinkedIn post about one hard problem (for example "How I made double payouts impossible") with the diagram. It brings recruiters to you.

**Done when:** a friend can run the project locally from the README in 10 minutes without asking you anything.

**Phase 4 interview story:** "I shipped semantic search and recommendations on Atlas Vector Search and a RAG help bot with citations, covered the main flow with Playwright, and deploy with zero downtime from GitHub Actions to a VPS."

---

# Phase 5: Polish (as time allows)

**Order:** 5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6 → 5.7 (needs 5.5's API keys) → 5.8 last.

## 5.1 Bangla and English

**Steps**
1. Use `next-intl` (it supports the App Router). Keep messages in `messages/en.json` and `messages/bn.json`.
2. Choose the locale from the user's setting, then a cookie, then the browser. Decide between URL prefixes (`/en/...`, `/bn/...`) or cookie-only, and record it in an ADR.
3. Format numbers, dates and currency with `Intl` using `bn-BD` (Bangla digits) or `en-BD`, with times in Asia/Dhaka.
4. Load a Bangla font (Noto Sans Bengali or Hind Siliguri) with `next/font`, and check line heights for Bangla text.
5. The API returns error codes (`INSUFFICIENT_COINS`), never sentences, and the client translates them.
6. Send emails, push notifications and help articles (4.2) in the user's language. The help bot answers in the language of the question.
7. Task content stays as the buyer wrote it, with an optional "Translate" button using Claude.
8. Add a lint rule or a review checklist item to catch hard-coded strings.

**Done when:** every screen works in both languages, and switching keeps you on the same page.

## 5.2 PWA and web push

**Steps**
1. Add `app/manifest.ts` (name, 192 px and 512 px icons including a maskable one, theme colour, `display: "standalone"`).
2. Add a service worker with Serwist (`@serwist/next`): cache static files and an offline page. **Never cache balance or ledger responses**, because stale money data is dangerous.
3. **Web push:** generate VAPID keys with the `web-push` package. Show an "Enable notifications" button only after a meaningful action, never on page load. Store a subscription per device, send from the worker's notification job, and delete subscriptions that return 404 or 410.
4. **iPhone:** web push only works after "Add to Home Screen" (iOS 16.4 and later), so show instructions.
5. **Settings per notification type:** chat, approvals and payouts on by default; promotions off.
6. If the Expo app exists, send Expo push from the same notification job.

**Done when:** Lighthouse says the app is installable, and push arrives with the tab closed (tested on Android and desktop).

## 5.3 Referral program with anti-abuse

**Steps**
1. Each user gets a code and a link. `referredBy` is set at signup and can't be changed later.
2. **Reward only real activity:** pay when the referred worker has 5 approved submissions from unlinked buyers, or when a referred buyer makes their first paid top-up. Both users get coins from `system:promotions` through the ledger.
3. Hold the reward for 7 days, and reverse it if the referred account is banned for fraud.
4. **Block:** no reward when the two accounts share a device, payout number or phone (3.2), and cap rewards per referrer per month.
5. **Dashboard:** invited, qualified and rewards earned. Admins see the total cost of promotions.

**Done when:** a farming test (10 accounts from one device) earns nothing.

## 5.4 Badges, streaks and a weekly leaderboard

**Steps**
1. **Badges** are rules in code: First Task, 100 Approved, 30-Day Streak, Zero Disputes in 90 Days, Top 10 This Week. Store them in `user_badges` and evaluate them in the worker after approvals.
2. **Streaks:** days (Asia/Dhaka time) with at least one approved submission. Store `currentStreak`, `longestStreak` and `lastActiveDate`.
3. **Weekly leaderboard:** a Redis sorted set `lb:week:<year>-W<week>`. Add approved coins with `ZINCRBY`, show the top 10 and "your rank" (`ZREVRANK`), and start a new key each week with about a 5-week expiry.
4. **Anti-gaming:** only level L1 and above appear, and only coins from unlinked buyers count.
5. **Optional:** weekly prizes paid from `system:promotions` through the ledger.

**Done when:** the leaderboard updates live, and the anti-gaming rules have tests.

## 5.5 Public API with API keys and webhooks

**Goal:** buyers can post tasks and review submissions from their own systems.

**API keys**
- Format `th_live_` plus 32 random bytes. Store only a SHA-256 hash and the first 8 characters for display.
- **Scopes:** `tasks:read`, `tasks:write`, `submissions:read`, `submissions:review`.
- Track "last used". Keys can be revoked, and the full key is shown only once.

**Endpoints (`/api/v1`)**
- Tasks: list, create, get, close. Submissions: list, get, approve, reject.
- They call the same business functions as the UI (escrow, ledger, idempotency through the `Idempotency-Key` header, rate limits per key).
- Errors use the RFC 9457 "problem details" JSON format, and lists use cursor pagination.
- **Docs:** generate an OpenAPI spec from your Zod schemas (`@asteasolutions/zod-to-openapi`) and show it with Scalar or Swagger UI.

**Outgoing webhooks**
1. The buyer adds an endpoint URL and receives a signing secret.
2. **Events:** `submission.created`, `submission.approved`, `submission.rejected`, `task.completed`.
3. **Signature header:** `TaskHub-Signature: t=<timestamp>,v1=<HMAC-SHA256 of "timestamp.body" with the secret>`. Receivers reject timestamps older than 5 minutes, which blocks replays.
4. Deliver through BullMQ with exponential backoff for up to 24 hours. Keep a delivery log with a "Redeliver" button.
5. **SSRF protection:** resolve the endpoint's DNS and refuse localhost and private or internal addresses (10.x, 172.16–31.x, 192.168.x, 169.254.x and local IPv6). Use a 10-second timeout and don't follow redirects.

**Done when:** a sample script in the docs creates a task and receives a signed webhook.

## 5.6 Task targeting, templates and bulk creation

**Targeting**
- Task fields: `countries` (from the verified phone country, not the IP), `devices` (mobile and/or desktop, checked from the user agent at submission), `minLevel`.
- Enforce them in the task list query and again on the server at submission.

**Templates**
- Buyers can save any task as a template.
- Platform templates for legitimate categories: app testing feedback, surveys, data labelling, website usability tests.

**Bulk creation**
1. Upload a CSV (title, steps, proof requirements, reward, workers, deadline), with a downloadable template.
2. Validate every row with Zod and show a preview table with the errors per row.
3. On confirm, one ledger transaction funds all the tasks (all or nothing), then the tasks are created. Limit 500 rows.

**Done when:** a 200-row CSV posts correctly, and one bad row blocks the whole batch with a clear error.

## 5.7 TaskHub MCP server

**Goal:** Claude (or any MCP client) can post and review tasks for a buyer. Few portfolios have this.

**Steps**
1. Add `/api/mcp` with the MCP TypeScript SDK (`@modelcontextprotocol/sdk`, Streamable HTTP transport), the same pattern as JobDesk's.
2. **Auth:** the API keys from 5.5 as a Bearer token. The key's scopes decide which tools appear.
3. **Tools:** `get_balance`, `list_my_tasks`, `create_task_draft` (the buyer publishes it in the UI) or `create_task` (needs `tasks:write`), `list_pending_submissions`, `get_submission` (includes the AI check result), `approve_submission`, `reject_submission(reason)`.
4. The tools call the same functions as the UI and API (escrow, ledger, idempotency, rate limits). Every call is audit-logged with the actor `api_key:<prefix>`.
5. **Demo:** in Claude, "Review the pending submissions for task X, approve the ones the AI check passed with high confidence, and show me the rest."

**Done when:** it works from Claude with a scoped key, and a key without `submissions:review` can't approve.

## 5.8 Voice and video calls (WebRTC), last

**Steps**
1. 1:1 voice or video inside an existing conversation (the two users must have chatted first).
2. **Signaling over Socket.io:** `call:invite`, `call:accept`, `call:reject`, `call:offer`, `call:answer`, `call:ice`, `call:end`. A 30-second ring timeout, a "busy" state and a missed-call notification.
3. **STUN and TURN:** run `coturn` on the VPS. TURN relays the media when a direct connection fails, which is common behind mobile-carrier networks. Your server issues short-lived TURN credentials.
4. Clear camera and microphone permission screens, an audio-only toggle, and testing on mobile browsers.
5. No recording.
6. **Alternative:** LiveKit (an open-source media server) if you want reliability more than the learning.

**Done when:** a call works between mobile data and Wi-Fi, and through TURN when the direct connection is blocked.

---

# Appendix A: Weekly schedule (about 15–20 hours a week)

| Week | Work |
|---|---|
| 1 | Phase 0 (all of it) |
| 2 | 1.1 Ledger and migration |
| 3 | 1.2 Idempotency, 1.3 Escrow and auto-approve |
| 4 | 1.4 Disputes, 1.5 Audit log, 1.6 Admin 2FA, 1.7 Withdrawal safeguards |
| 5 | 2.1 Redis adapter and sticky sessions, 2.2 Load-balanced web, 2.3 Rate limiting |
| 6 | 2.4 Presence and read receipts, 2.5 Load tests |
| 7 | 3.1 Perceptual hashing, 3.2 Device and IP signals, 3.3 Earning limits |
| 8 | 3.4 Trust score; start labelling proofs for the 3.5 evaluation |
| 9 | 3.5 AI proof check, 3.6 AI task-writer |
| 10 | 4.1 Semantic search and recommendations |
| 11 | 4.2 RAG help bot, 4.3 Playwright |
| 12 | 4.4 Deploy, 4.5 README and demo video |
| 13+ | Phase 5, about one item a week |

Weeks 4 and 5 are the heaviest. This is a tight schedule. If you have fewer hours, multiply every week by 1.5 and keep the order.

# Appendix B: Security checklist for every pull request

- Every input is validated with Zod: API bodies, socket events and job data.
- Every route and socket event checks authorization on the server: the role and the ownership (a buyer can only approve submissions on their own task).
- No secrets in code, images or logs.
- Uploads: type checked by content, size limited, re-encoded with `sharp`.
- Headers: CSP, HSTS (after TLS), `nosniff`, `frame-ancestors`.
- Dependabot on, and `npm audit` in CI failing on high and critical issues.
- Money code: integers, transactions, idempotency keys, audit entries.
- Backups exist and a restore has been tested.

# Appendix C: Test layers

| Layer | Tool | What it covers |
|---|---|---|
| Unit | Vitest | Pure logic: coin math, trust score, risk score, hash distance |
| Integration | Vitest with `MongoMemoryReplSet`, or the Compose stack | Ledger, escrow, idempotency, rate limits, queues |
| End to end | Playwright | The main flows across buyer, worker and admin |
| Load | k6 and Artillery | Phase 2 numbers |
| AI evaluation | Your labelled sets | Proof check, help bot, task-writer samples |

# Appendix D: Resume lines (only after "Done when", with your real numbers)

- **Phase 0:** "Containerized a Next.js and Socket.io app into web, realtime and worker services behind Nginx, with health checks, structured logging, Sentry and CI."
- **Phase 1:** "Built a double-entry coin ledger on MongoDB transactions with escrow, idempotent payment webhooks and 72-hour auto-approval through BullMQ; concurrency tests show zero double-spends across [N] parallel withdrawals."
- **Phase 2:** "Scaled real-time chat across two Socket.io instances with a Redis adapter and sticky sessions; load-tested to [X] requests per second at p95 [Y] ms."
- **Phase 3:** "Added fraud detection (perceptual hashing, device linking) and an AI proof checker with human review, agreeing with human decisions on [Z]% of [N] labelled proofs."
- **Phase 4:** "Shipped semantic search, recommendations and a RAG help bot on Atlas Vector Search; zero-downtime deploys from GitHub Actions to a VPS."

Update your resume and application materials only after a phase's 'Done when' list is met.

# Appendix E: Short glossary

- **Idempotency:** doing the same request twice has the same effect as doing it once.
- **Escrow:** coins locked for a task until the work is approved or the task closes.
- **Double-entry ledger:** every movement is recorded as entries that add up to zero, so coins can't appear or disappear.
- **Sticky session:** the load balancer keeps sending one client to the same server.
- **p95 latency:** 95% of requests are faster than this number.
- **Hamming distance:** the number of bits that differ between two hashes.
- **Embedding:** a list of numbers that represents the meaning of a text, so similar meanings are close together.
- **RAG (retrieval-augmented generation):** find the relevant documents first, then have the model answer only from them.
- **TOTP:** the 6-digit codes from an authenticator app that change every 30 seconds.
- **SSRF:** tricking a server into calling internal addresses. Webhook URLs must be checked for it.
