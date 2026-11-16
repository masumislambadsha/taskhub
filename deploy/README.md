# TaskHub production deployment (VPS + Docker Hub + GitHub Actions)

This is the runbook for running TaskHub on one VPS. Everything here is ready to
use but switched off: nothing is published or deployed until you add the
GitHub secrets and variables listed in section 8.

The structure follows the Apollo course's VPS guide (Docker Hub images tagged by
commit SHA, a production compose file, Nginx on the host, an SSH deploy job),
with these differences: a non-root `deploy` user instead of root, HTTPS with
certbot, a health-gated deploy that rolls back by itself, log rotation, and
secrets passed as environment variables instead of being pasted into the SSH script.

Files:

| File | What it is |
|---|---|
| `compose.prod.yml` | Production stack: web, realtime, worker, redis. Uses prebuilt images. |
| `deploy/env/*.env.example` | Runtime settings templates (real `*.env` files are gitignored). |
| `deploy/nginx/taskhub.conf` | Nginx site for the VPS host. |
| `deploy/vps-setup.sh` | One-time server bootstrap (run as root). |
| `deploy/deploy.sh` | Deploys one image tag, checks health, rolls back on failure. |
| `scripts/set-github-secrets.sh` / `.ps1` | Uploads the GitHub secrets and variables. |
| `.github/workflows/ci.yml` | Jobs `publish` (Docker Hub) and `deploy` (SSH to the VPS). |
| `docs/adr/0001-vps-deployment.md` | Why it is built this way. |

## 1. What runs where

```
                       Internet
                          |
            80 / 443 (ufw allows 22, 80, 443 only)
                          |
              +-----------v-----------+
              |   Nginx on the host   |  TLS from certbot (Let's Encrypt)
              +-----+-----------+-----+
         /socket.io/ |           | everything else
                     v           v
        127.0.0.1:3001     127.0.0.1:3000          (bound to localhost only)
        +------------+     +------------+     +------------+
        |  realtime  |     |    web     |     |   worker   |   Docker containers
        +-----+------+     +-----+------+     +-----+------+   (compose.prod.yml)
              |                  |                  |
              |                  +-------+  +-------+
              |                          v  v
              |                      +-------+
              |                      | redis |  volume: redis-data (AOF)
              |                      +-------+
              v
      MongoDB Atlas  (outside the VPS; allow the VPS IP in Network Access)

   GitHub Actions:  push to main -> check + docker -> publish (Docker Hub)
                                                   -> deploy (SSH -> deploy/deploy.sh)
```

- Images: `your-dockerhub-user/taskhub-web`, `taskhub-worker`, `taskhub-realtime`,
  tagged with the full 40-character commit SHA (and `latest`).
- The compose file starts the exact tag you give it. `latest` is never deployed.
- Ports 3000 and 3001 are published on `127.0.0.1` only. Docker can bypass
  ufw for published ports, so binding to localhost is what keeps them private.

## 2. One-time VPS setup

You need an Ubuntu 22.04 or 24.04 VPS and root SSH access with your key.

```bash
# from your computer
scp deploy/vps-setup.sh root@203.0.113.10:/root/
ssh root@203.0.113.10 'bash /root/vps-setup.sh'
```

The script is safe to run again. It installs Docker Engine and the Compose
plugin from Docker's apt repository, Nginx, certbot, ufw, fail2ban,
unattended-upgrades and git. It creates the `deploy` user (in the `docker`
group, with root's `authorized_keys` copied), opens ports 22, 80 and 443, and
creates `/opt/apps/taskhub` owned by `deploy`.

It does not turn off SSH password login, because a mistake there locks you out.
When it finishes it prints the exact steps. In short: open a second terminal,
confirm `ssh deploy@203.0.113.10` works with your key, then set
`PasswordAuthentication no` and `PermitRootLogin no` and reload `ssh`.

Clone the repo as the `deploy` user (it is public, so no credentials are needed):

```bash
ssh deploy@203.0.113.10
git clone https://github.com/masumislambadsha/taskhub.git /opt/apps/taskhub
```

Create a separate SSH key for GitHub Actions on your computer and authorise it:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/taskhub_ci -C taskhub-ci -N ""
ssh-copy-id -i ~/.ssh/taskhub_ci.pub deploy@203.0.113.10
```

## 3. DNS

At your DNS provider add an A record:

| Type | Name | Value |
|---|---|---|
| A | `taskhub.<your-domain>` | the VPS IP, for example `203.0.113.10` |

Check it with `dig +short taskhub.<your-domain>` before running certbot.
Run the VPS next to Vercel and Render on its own subdomain first (see section 16).

## 4. Nginx site and HTTPS

On the VPS, as a user with sudo (or root):

```bash
cd /opt/apps/taskhub
sudo cp deploy/nginx/taskhub.conf /etc/nginx/sites-available/taskhub
sudo sed -i 's/taskhub.example.com/taskhub.<your-domain>/' /etc/nginx/sites-available/taskhub
sudo ln -sf /etc/nginx/sites-available/taskhub /etc/nginx/sites-enabled/taskhub
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Then get the certificate. certbot edits the site file: it adds the HTTPS server
block and redirects HTTP to HTTPS.

```bash
sudo certbot --nginx -d taskhub.<your-domain>
sudo certbot renew --dry-run        # renewal runs from a systemd timer; this proves it works
```

Once HTTPS works, open `/etc/nginx/sites-available/taskhub` and remove the `#` in
front of the `Strict-Transport-Security` line, then `sudo nginx -t && sudo systemctl reload nginx`.
Only do that when you are sure the site will stay on HTTPS.

Until the app is running, Nginx answers `502 Bad Gateway`. That is expected.

## 5. MongoDB Atlas

1. In Atlas open Security, Network Access, Add IP Address, and add the VPS IP.
2. Use the same database as production, or a copy for the first test.
3. Put the connection string in `MONGODB_URI` in both env files (section 7).

While Vercel and Render are still live they connect from their own addresses, so
leave their entries (or `0.0.0.0/0`) in place until the switch-over is done.

## 6. Docker Hub

1. Create an account at hub.docker.com. Your user name is `DOCKERHUB_USERNAME`.
2. Account settings, Personal access tokens, New token, access permissions
   **Read & Write**. Copy it once. It becomes the secret `DOCKERHUB_TOKEN`.
3. The first push creates the repositories `taskhub-web`, `taskhub-worker` and
   `taskhub-realtime`. Set them to **Public** (Repository settings). The VPS then
   pulls without logging in.

Private images: log in once on the VPS as `deploy` with a token that has
**Read-only** access, using `docker login -u your-dockerhub-user` (it stores the
credential in `~/.docker/config.json`). `deploy.sh` then pulls with it. Do not
put the token in the GitHub workflow for this.

## 7. Runtime env files on the VPS

```bash
cd /opt/apps/taskhub
cp deploy/env/web.env.example deploy/env/web.env
cp deploy/env/realtime.env.example deploy/env/realtime.env
chmod 600 deploy/env/web.env deploy/env/realtime.env
nano deploy/env/web.env deploy/env/realtime.env
```

Points to get right:

- `SOCKET_JWT_SECRET` must be identical in both files (`openssl rand -base64 48`).
- `NEXTAUTH_URL` and the realtime `NEXT_PUBLIC_APP_URL` are the public HTTPS
  address, with no trailing slash. The realtime one is its CORS allow-list.
- `MONGODB_URI` is the Atlas string. `REDIS_URL` is set by the compose file.
- `SENTRY_ENVIRONMENT=production-vps` separates VPS errors from Vercel's.
- **`NEXT_PUBLIC_*` values do not belong in these files.** Next.js bakes them into
  the browser bundle when the web image is built, so they come from GitHub
  repository variables (section 8). Changing one means publishing a new image.

When CI/CD is on, the deploy job rewrites both files from the GitHub secrets on
every deploy. From then on edit the secret (or rerun the upload script), not the
file on the server.

## 8. GitHub secrets and variables

Settings, Secrets and variables, Actions. Or run the upload script (section 9).

**Secrets**

| Name | Needed for | Where the value comes from |
|---|---|---|
| `DOCKERHUB_TOKEN` | publish | Docker Hub access token, Read & Write (section 6) |
| `VPS_HOST` | deploy | VPS IP address or host name |
| `VPS_USER` | deploy | `deploy` |
| `VPS_SSH_KEY` | deploy | private key file made in section 2 (`~/.ssh/taskhub_ci`) |
| `VPS_PORT` | deploy, optional | SSH port, only if it is not 22 |
| `WEB_ENV_PRODUCTION` | deploy | whole content of `deploy/env/web.env` |
| `REALTIME_ENV_PRODUCTION` | deploy | whole content of `deploy/env/realtime.env` |

**Variables**

| Name | Needed for | Where the value comes from |
|---|---|---|
| `DOCKERHUB_USERNAME` | publish (this is the on/off switch) | your Docker Hub user name |
| `NEXT_PUBLIC_SOCKET_URL` | publish (required) | public realtime URL, `https://taskhub.<your-domain>` (Nginx sends `/socket.io/` to realtime) |
| `NEXT_PUBLIC_APP_URL` | publish (required) | `https://taskhub.<your-domain>` |
| `NEXT_PUBLIC_SENTRY_DSN` | publish, optional | Sentry project DSN (empty turns browser Sentry off) |
| `NEXT_PUBLIC_IMGBB_API_KEY` | publish, optional | imgbb key used by the browser forms |
| `SENTRY_ENVIRONMENT` | publish, optional | defaults to `production-vps`; baked into the browser bundle |
| `VPS_APP_DIR` | deploy, optional | defaults to `/opt/apps/taskhub` |
| `DEPLOY_ENABLED` | deploy (second on/off switch) | set to `true` by hand, section 10 |

What turns what on:

- With **no variables at all**, the existing `check` and `docker` jobs run as before and
  `publish` and `deploy` are skipped.
- **Publish only:** `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `NEXT_PUBLIC_SOCKET_URL`,
  `NEXT_PUBLIC_APP_URL` (the rest of the build variables are optional). Every push to `main`
  then pushes images.
- **Full deploy:** also `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `WEB_ENV_PRODUCTION`,
  `REALTIME_ENV_PRODUCTION`, and finally `DEPLOY_ENABLED=true`.
- The deploy job runs in the GitHub Environment `production`. GitHub creates it on
  first use. You can add required reviewers there if you want a manual approval.

## 9. Upload the secrets with a script

On your computer, with the GitHub CLI installed and `gh auth login` done:

```bash
cp deploy/github-secrets.input.env.example deploy/github-secrets.input.env
cp deploy/env/web.env.example deploy/env/web.env
cp deploy/env/realtime.env.example deploy/env/realtime.env
# fill in all three files, then:
scripts/set-github-secrets.sh --dry-run        # shows names only
scripts/set-github-secrets.sh
```

On Windows use `./scripts/set-github-secrets.ps1 -DryRun` and then without `-DryRun`.
Both scripts read the three files above, check that `SOCKET_JWT_SECRET` matches and
the placeholders are gone, and send values to `gh` on standard input. Values are
never printed. They do not set `DEPLOY_ENABLED`. All three files are gitignored.

## 10. First deploy

1. Upload the secrets and variables (sections 8 and 9), but **not** `DEPLOY_ENABLED`.
2. Merge the deployment branch into `main`. The `publish` job pushes the three
   images. Copy the commit SHA from the run (or from `git rev-parse main`).
3. On the VPS, deploy that SHA by hand:

   ```bash
   cd /opt/apps/taskhub
   git fetch origin && git reset --hard <full-sha>
   DOCKERHUB_USERNAME=your-dockerhub-user deploy/deploy.sh <full-sha>
   ```

   The script pulls the images, starts the stack, waits up to 120 seconds for
   `http://127.0.0.1:3000/api/health/ready` and `http://127.0.0.1:3001/health`,
   and writes `.deploy/current_tag`. If a health check fails it prints the last 100
   log lines of every service and, if an earlier tag is recorded, redeploys it.
4. Run the verify steps (section 11).
5. Turn on automatic deploys: Settings, Secrets and variables, Variables,
   `DEPLOY_ENABLED` = `true` (or `gh variable set DEPLOY_ENABLED --body true`).
   From the next push to `main`, CI deploys by itself.

## 11. Verify

```bash
# on the VPS
cd /opt/apps/taskhub
cat .deploy/current_tag
DOCKERHUB_USERNAME=your-dockerhub-user IMAGE_TAG=$(cat .deploy/current_tag) docker compose -f compose.prod.yml ps
curl -fsS http://127.0.0.1:3000/api/health/ready
curl -fsS http://127.0.0.1:3001/health

# from anywhere
curl -fsS https://taskhub.<your-domain>/api/health/ready
curl -sI https://taskhub.<your-domain>/ | head -5
```

Then open the site, sign in, and send a chat message to check the WebSocket path
(browser dev tools, Network, WS: `/socket.io/` should stay connected).

Tip: export the two variables once per shell so later compose commands work:
`export DOCKERHUB_USERNAME=your-dockerhub-user IMAGE_TAG=$(cat .deploy/current_tag)`.

## 12. Day-2 operations

All commands run in `/opt/apps/taskhub` on the VPS, with the two variables from the tip above.

```bash
docker compose -f compose.prod.yml ps                  # status and health
docker compose -f compose.prod.yml logs -f --tail=100 web
docker compose -f compose.prod.yml logs --tail=200 realtime worker redis
docker compose -f compose.prod.yml restart web         # or realtime, worker, redis
docker stats --no-stream
df -h /; docker system df                              # disk space
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl status nginx fail2ban --no-pager
```

- Logs rotate by themselves (3 files of 10 MB per container).
- Redis keeps its data in the `redis-data` volume with AOF on.
- `deploy.sh` runs `docker image prune -f` after every good deploy, so old images do not fill the disk.
- Back up Atlas on its own schedule. The free tier has no automated backups,
  so plan a nightly `mongodump` (ROADMAP 4.4).

## 13. Rollback

Automatic: if the new tag fails its health check, `deploy.sh` redeploys the tag
that was running before and exits with an error, so the CI job turns red.

By hand: deploy any earlier commit SHA.

```bash
cd /opt/apps/taskhub
cat .deploy/previous_tag            # the one before the current deploy
DOCKERHUB_USERNAME=your-dockerhub-user deploy/deploy.sh <older-sha>
```

The old images are pulled from Docker Hub if they are no longer on the server.
If `DEPLOY_ENABLED` is on, the next push to `main` deploys forward again. To stay on the
older version, set `DEPLOY_ENABLED` to `false` first and fix forward when ready.

Database changes are not rolled back by this. Keep schema changes backward compatible
for one release.

## 14. Troubleshooting

| Symptom | Check |
|---|---|
| `publish` fails: variable not set | Add `NEXT_PUBLIC_SOCKET_URL` and `NEXT_PUBLIC_APP_URL` as repository variables. |
| Docker Hub push says `insufficient scopes` / 401 | Make a new token with Read & Write and update `DOCKERHUB_TOKEN`. |
| `deploy` job: `Permission denied (publickey)` | `VPS_SSH_KEY` must be the private key whose `.pub` is in `/home/deploy/.ssh/authorized_keys`; `VPS_USER` must be `deploy`. |
| `deploy` job: `permission denied` on the Docker socket | `id deploy` must list `docker`. Log out and in again after `vps-setup.sh`. |
| `pull access denied` / `manifest unknown` | The tag was never published (check the `publish` run), or the repo is private (section 6). |
| `required variable DOCKERHUB_USERNAME is missing` | Run `deploy.sh` with `DOCKERHUB_USERNAME=...`, or export both variables before using `docker compose`. |
| `Missing deploy/env/web.env` | Section 7. |
| Health check times out | Read the logs the script printed. Usual causes: wrong `MONGODB_URI`, the VPS IP not allowed in Atlas, a missing `NEXTAUTH_SECRET`. `/api/health/ready` fails when MongoDB or Redis is unreachable. |
| Nginx `502 Bad Gateway` | `curl -I http://127.0.0.1:3000` on the VPS. If that fails the web container is down, see logs. |
| Chat does not connect | `NEXT_PUBLIC_SOCKET_URL` build variable wrong (needs a new image), realtime `NEXT_PUBLIC_APP_URL` does not match the site URL (CORS), `SOCKET_JWT_SECRET` differs between the two files, or the Nginx `/socket.io/` block was edited. |
| Login loops or redirects to localhost | `NEXTAUTH_URL` and `AUTH_TRUST_HOST=true` in `web.env`. |
| certbot fails | DNS not pointing at the VPS yet, or port 80 blocked. `sudo ufw status`. |
| Disk full | `docker system df`, then `docker image prune -af` and `docker builder prune -f`. |

## 15. Security notes

- Log in as `deploy`, never as root. After section 2, SSH passwords and root login are off.
- ufw allows only 22, 80 and 443. fail2ban watches SSH. Security updates install automatically.
- Use a dedicated SSH key for CI. If it leaks, remove its line from `authorized_keys` and make a new one.
- Runtime env files are mode 600 and owned by `deploy`. They are never in images or in git.
  The deploy job writes them with `umask 077` and receives them as environment variables,
  not as text inside the SSH script.
- GitHub masks secrets in logs, but a multi-line secret is masked line by line. Do not print the env files in CI.
- `deploy/deploy.sh` and the compose file come from the repo. Anyone who can push to `main`
  can run code on the VPS through the deploy job, so protect `main` with branch protection
  and use the `production` environment's required reviewers if more people get write access.
- Rotate any token that was ever pasted into a chat, a screenshot or a commit.
- Docker Hub tokens: Read & Write in GitHub only. A VPS login for private images uses a Read-only token.

## 16. Switch-over checklist: Vercel + Render to the VPS

Run the VPS in parallel on its own subdomain first, and only then move the real address.

1. Finish sections 2 to 11 with a test subdomain such as `vps.<your-domain>` (or the final subdomain). Keep Vercel and Render untouched.
2. Both deployments use the same Atlas database, so test with a test account. Two workers will run against the same data while both are live: check what the worker does, and stop the old one before you rely on the new one if its jobs must run only once.
3. **Google OAuth:** in the Google Cloud console add `https://<new-host>/api/auth/callback/google` to Authorised redirect URIs and `https://<new-host>` to Authorised JavaScript origins. Keep the old entries until the end.
4. **Stripe:** add a new webhook endpoint `https://<new-host>/api/v1/payments/stripe/webhook`. It has its own signing secret: put it in `STRIPE_WEBHOOK_SECRET` in `web.env`, then redeploy. Keep the old endpoint active until the switch.
5. **bKash and SSLCommerz:** the callback URLs are built from `NEXTAUTH_URL`: `/api/bkash/callback` and `/api/sslcommerz/success`, `fail`, `cancel` and `ipn`. If the provider portal whitelists callback or IPN URLs, add the new host. Do one sandbox payment on the VPS.
6. **`NEXTAUTH_URL`:** set it to the final public URL in `web.env` (and the `WEB_ENV_PRODUCTION` secret).
7. **`NEXT_PUBLIC_*` build variables:** set `NEXT_PUBLIC_SOCKET_URL` and `NEXT_PUBLIC_APP_URL` to the final URL, then push to `main` so a new web image is built. Editing `web.env` is not enough, these values are in the browser bundle.
8. **Realtime CORS:** `NEXT_PUBLIC_APP_URL` in `realtime.env` must equal the final site URL. The server also always allows the old Vercel origin.
9. **Sentry:** confirm events arrive with environment `production-vps`. Adjust alert rules to the new environment name.
10. **Mobile app:** if the Expo app has the API and socket URLs built in, ship a build that uses the new address, or keep the old host alive until it is updated.
11. **Cutover:** lower the DNS TTL a day ahead. Point the real domain's A record at the VPS (or change the Vercel domain to the new one). Run `certbot --nginx` for the final name.
12. **Watch** logs and Sentry for a day. Keep Vercel and Render running, and do not delete them until the VPS has been verified. Rolling back the switch is a DNS change.
13. Afterwards: remove the old Stripe endpoint and OAuth redirect URIs, shut down Vercel and Render, remove their Atlas IP entries, and redirect the old Vercel URL to the new domain (ROADMAP 4.4).
