# ADR 0004: Rate limits live in Redis, and each one decides what happens when Redis is down

Status: accepted

## Context

Several routes need limits (signing in, signing up, two-factor codes, withdrawals,
submissions, uploads, chat, AI, the public API). With more than one web instance
a counter kept in each process lets a client multiply its allowance by the
number of instances, so the limits must be shared. Redis is already part of the
stack (queues, health checks).

Some of these limits protect money or accounts. Others only protect a service
from being overloaded. They should not all react the same way when the limiter
itself is unavailable.

## Decision

- One config file, `src/lib/rate-limit-config.ts`, holds every limit: the number
  of attempts, the window, and the failure mode. One function, `consume()`,
  counts an attempt; every block is logged (with a hash of the key, never an
  email address).
- Counting is one atomic Redis script (add, and start the window on the first
  hit), so simultaneous requests on different instances cannot both slip under
  the limit. It is a fixed window: simple, cheap, and good enough for
  protection rather than billing. A client can burst up to twice the limit
  across a window edge.
- **If Redis is configured but does not answer:**
  - `closed` (refuse): signing in, signing up, two-factor codes, withdrawals and
    AI. These must never run unchecked: an attacker who can knock Redis over
    must not gain unlimited password guesses or free AI spend.
  - `open` (allow): chat, task submission, uploads and the confirmation-email
    resend. Blocking real workers because a cache is down is worse than the
    abuse it prevents for a few minutes.
  - The answer is flagged `degraded` and logged either way, and a Redis call
    never takes more than a second.
- **If Redis is not configured at all** (local development, a deployment
  without it), limits are counted in the process. That is the pre-Redis
  behaviour and is not "down".
- **Client IP:** behind our Nginx only `X-Real-IP` is trusted, because Nginx
  overwrites it. A client can send any `X-Forwarded-For`, so that header is read
  only on Vercel, whose edge writes it. With neither, requests share the bucket
  `unknown`, which is strict, not open.
- **IP limits are generous, account limits strict**, because many mobile users
  in Bangladesh share one carrier IP. Sign-up is limited per IP *and* device.
- **Login** counts every attempt for the account and the IP, including
  attempts on emails that do not exist, so the limit reveals nothing about who
  is registered. A correct password clears the account's count.
- **Idempotent replays do not count.** Withdrawal and submission limits are
  taken inside the idempotent handler, so a double click answered from the
  stored response does not use up the day's allowance.

## Consequences

- A Redis outage makes sign-in, sign-up, two-factor and withdrawals unavailable
  (with a clear 429 and a short `Retry-After`) while chat and submissions keep
  working. That is deliberate.
- The chat limit is enforced by the realtime server, not these routes.
- Moving to a sliding window or per-plan limits later means changing only
  `ratelimit.ts` and the config.
