# 0002. Deploy to a VPS with Docker Hub, host Nginx and an SSH deploy job

- Status: accepted
- Date: 2026-11-15

There is no earlier ADR in this repo, so this one uses the usual layout:
context, decision, consequences. The runbook is [deploy/README.md](../../deploy/README.md).

## Context

Production runs today on Vercel (web) and Render (realtime). ROADMAP 4.4 plans a VPS
with Docker, TLS and a CI/CD pipeline. The owner has no VPS or domain yet, so the
setup has to be complete and reviewable now, and stay switched off until secrets are added.

The local stack (`compose.yml`) runs Nginx, MongoDB and Redis in containers. Production
differs: MongoDB is Atlas, TLS is needed, and the server may host other apps.

## Decision

1. **Nginx runs on the VPS host in production.** Certbot (`certbot --nginx`) installs and
   renews Let's Encrypt certificates by editing host Nginx. The same Nginx can serve other
   apps on the same VPS by server name, which a containerized Nginx bound to ports 80 and 443
   would block. The app containers publish only to `127.0.0.1:3000` and `127.0.0.1:3001`.
   Local development keeps the containerized Nginx in `compose.yml`, because it needs no
   TLS and no host setup. `deploy/nginx/taskhub.conf` mirrors `docker/nginx/default.conf`
   (WebSocket upgrade for `/socket.io/`, 75 s read timeout) with localhost upstreams.
2. **Docker Hub holds the images**, `taskhub-web`, `taskhub-worker` and `taskhub-realtime`,
   tagged with the commit SHA and `latest`. Only the SHA tag is ever deployed, so a deploy
   is exactly one commit and a rollback is deploying an older SHA. The repositories are
   public so the VPS needs no registry login. Browser values (`NEXT_PUBLIC_*`, and
   `SENTRY_ENVIRONMENT`, which `next.config.ts` copies into the browser bundle) are build
   arguments taken from GitHub variables. The root Dockerfile gained a `SENTRY_ENVIRONMENT`
   build argument for that reason.
3. **Deploy by SSH to a non-root `deploy` user.** The `deploy` job connects with
   `appleboy/ssh-action`, updates the repo checkout, writes the two runtime env files from
   GitHub secrets, and runs `deploy/deploy.sh <sha>`. Secrets reach the server as
   environment variables, not inside the script text. Pushing to the VPS is the choice over
   a pull agent (Watchtower and similar) because the job can wait for health and fail visibly.
4. **Health-gated deploy with automatic rollback.** `deploy.sh` waits up to 120 s for web
   `/api/health/ready` and realtime `/health`. On failure it prints recent logs and redeploys
   the previously running tag. Rolling back by hand is `deploy.sh <older-sha>`.
5. **Two switches keep it off by default.** `publish` needs the variable `DOCKERHUB_USERNAME`
   and `deploy` needs `DEPLOY_ENABLED=true`. With neither set, both jobs are skipped and the
   existing CI is unchanged. `DEPLOY_ENABLED` is turned on by hand after a first manual deploy.
6. **Redis runs in Docker** with AOF and a named volume. MongoDB stays on Atlas, with the VPS
   IP allowed in Network Access.

## Consequences

- Good: TLS and multiple apps per VPS work with ordinary host tooling. Deploys are tied to
  a commit and a failed deploy goes back to the last good one without anyone logging in.
- **A short restart gap on each deploy.** There is one `web` instance, so recreating the
  container drops requests for a few seconds, and the Socket.io connections reconnect.
  Zero downtime comes with Phase 2 (two web instances and a rolling restart), which will
  extend `deploy.sh` to restart one instance at a time.
- Automatic rollback restores the previous images only. It does not undo database changes,
  so schema changes must stay backward compatible for one release.
- A single VPS is a single point of failure for the app tier. Atlas is separate, so data
  survives a lost server, but recovery means building a new VPS (`vps-setup.sh` makes that
  repeatable).
- Docker's published ports bypass ufw rules, which is why the compose file binds them to
  localhost and does not rely on the firewall alone.
- Anyone who can push to `main` can run code on the VPS through the deploy job. Branch
  protection and the `production` environment's reviewers are the controls.
- Nginx configuration lives in two places (local `docker/nginx/default.conf` and production
  `deploy/nginx/taskhub.conf`). Changes to routing must be made in both.
