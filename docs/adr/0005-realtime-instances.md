# ADR 0005: Two realtime instances joined by Redis, WebSocket-only, with sticky routing as a safety net

Status: accepted

## Context

One realtime server is a single point of failure and a ceiling on connections.
With two instances, a message emitted on instance A must still reach a user
connected to instance B, and if one instance stops, its users must end up on the
other without losing messages.

Socket.io normally starts with HTTP long-polling and upgrades to WebSocket. The
polling requests of one session must all reach the same instance, or the server
answers "Session ID unknown". That is the reason for sticky sessions.

## Decision

- **Redis adapter** (`@socket.io/redis-adapter`): every emit is published through
  Redis, so rooms behave as one across instances. Without `REDIS_URL` the server
  runs alone and logs a warning.
- **Every user joins a room `user:<id>` on connect**, after the signed token is
  verified. The web app and the worker never hold a socket; they publish with
  `@socket.io/redis-emitter` (`src/lib/realtime-emit.ts`), for example
  `notification:new` when the outbox delivers a notification. The emitter's
  `publish` is wrapped so a Redis hiccup is logged, not an unhandled rejection.
- **Transport:** the web and mobile clients connect with `transports: ["websocket"]`
  only, so no stickiness is needed for them. The cost is that networks which block
  WebSockets get no polling fallback.
- **Nginx still hashes by client IP (`hash $remote_addr consistent`)** for
  `/socket.io/`. It costs nothing, and it keeps the setup correct if long-polling
  is ever turned back on. Behind Cloudflare the real client IP must be restored
  first (`set_real_ip_from`, `real_ip_header`), or every user hashes to one instance.
- **Named services** (`realtime1`, `realtime2`, `web1`, `web2`) with fixed ports, so
  the Nginx upstreams stay a plain list. Web uses `least_conn`, and an instance that
  fails 3 times in 10 seconds is skipped, so stopping one never takes the site down.
- **Graceful stop:** on SIGTERM an instance stops accepting connections and
  closes its sockets (`io.close()`), then Redis, then exits, with a 10-second
  timer as a guard. The compose file gives it 15 seconds. Clients reconnect, and
  Nginx sends them to the instance that is left.
- **Catching up after a reconnect:** the client shows "Reconnecting…" and, when the
  connection is back, fetches the conversation over REST. A message sent during the
  gap was saved by the server, so nothing is lost; it just was not pushed live.
- **Rolling restart** (`deploy/deploy.sh`): Redis and the worker first, then
  `web1`, `web2`, `realtime1`, `realtime2` one at a time, waiting for each to be
  healthy before the next, so there is always a working instance.
- **Chat rate limit** (20 messages per 10 seconds per user) is counted in Redis by
  the realtime server and fails open: a Redis outage must not stop people talking.

## Consequences

- A user can be connected to either instance; nothing in the app may assume which.
- Redis is now needed for realtime to work across instances, and the realtime
  instance depends on it at start-up in the compose files.
- Presence and read receipts (2.4) build on the same rooms and Redis.
- Not verified here: the "stop an instance mid-chat" demo with Docker and a browser
  (this environment cannot run containers). The same behaviour is covered by
  automated tests that run two real server instances against a real Redis.
