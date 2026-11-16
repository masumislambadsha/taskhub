#!/usr/bin/env bash
# Upload the deployment secrets and variables to GitHub with the gh CLI.
#
#   gh auth login                                  (once)
#   cp deploy/github-secrets.input.env.example deploy/github-secrets.input.env   (then edit)
#   cp deploy/env/web.env.example deploy/env/web.env                              (then edit)
#   cp deploy/env/realtime.env.example deploy/env/realtime.env                    (then edit)
#   scripts/set-github-secrets.sh [--repo owner/name] [--input FILE] [--dry-run]
#
# Secret values are piped to gh on stdin and never printed or put on a command line.
# DEPLOY_ENABLED is NOT set here: turn it on by hand after the first good manual deploy.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INPUT="$ROOT_DIR/deploy/github-secrets.input.env"
WEB_ENV="$ROOT_DIR/deploy/env/web.env"
REALTIME_ENV="$ROOT_DIR/deploy/env/realtime.env"
REPO=""
DRY_RUN=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo)    REPO="${2:-}"; shift 2 ;;
    --input)   INPUT="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

die() { echo "Error: $*" >&2; exit 1; }

[ -f "$INPUT" ] || die "Input file not found: $INPUT (copy deploy/github-secrets.input.env.example)"
[ -f "$WEB_ENV" ] || die "Missing $WEB_ENV (copy web.env.example and fill it in)"
[ -f "$REALTIME_ENV" ] || die "Missing $REALTIME_ENV (copy realtime.env.example and fill it in)"
if [ "$DRY_RUN" -eq 0 ]; then
  command -v gh >/dev/null 2>&1 || die "GitHub CLI (gh) is required. Install it and run 'gh auth login'."
fi

# Read KEY from an env-style file without executing it. Last assignment wins.
get() {
  local file="$1" key="$2" line value
  line="$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$file" | tail -n 1 || true)"
  value="${line#*=}"
  value="${value%$'\r'}"
  # trim surrounding whitespace
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  # strip one pair of matching quotes
  case "$value" in
    \"*\") value="${value#\"}"; value="${value%\"}" ;;
    \'*\') value="${value#\'}"; value="${value%\'}" ;;
  esac
  printf '%s' "$value"
}

repo_args=()
if [ -z "$REPO" ]; then REPO="$(get "$INPUT" GITHUB_REPO)"; fi
if [ -n "$REPO" ]; then repo_args=(--repo "$REPO"); fi

require() {
  local key="$1"
  [ -n "$(get "$INPUT" "$key")" ] || die "$key is empty in $INPUT"
}
for k in DOCKERHUB_USERNAME DOCKERHUB_TOKEN VPS_HOST VPS_USER VPS_SSH_KEY_FILE VPS_APP_DIR NEXT_PUBLIC_SOCKET_URL NEXT_PUBLIC_APP_URL; do
  require "$k"
done

# Sanity checks on the runtime env files (names only, never values).
web_jwt="$(get "$WEB_ENV" SOCKET_JWT_SECRET)"
rt_jwt="$(get "$REALTIME_ENV" SOCKET_JWT_SECRET)"
[ "${#web_jwt}" -ge 32 ] || die "SOCKET_JWT_SECRET in web.env must be at least 32 characters"
[ "$web_jwt" = "$rt_jwt" ] || die "SOCKET_JWT_SECRET differs between web.env and realtime.env"
[ -n "$(get "$WEB_ENV" NEXTAUTH_SECRET)" ] || die "NEXTAUTH_SECRET is empty in web.env"
for f in "$WEB_ENV" "$REALTIME_ENV"; do
  if grep -q 'USER:PASSWORD@' "$f"; then die "$(basename "$f") still has the placeholder MONGODB_URI"; fi
done

key_file="$(get "$INPUT" VPS_SSH_KEY_FILE)"
case "$key_file" in "~"/*) key_file="$HOME/${key_file#\~/}" ;; esac
[ -r "$key_file" ] || die "SSH key file not readable: $key_file"
grep -q 'PRIVATE KEY' "$key_file" || die "$key_file does not look like a private key"

set_secret_from() { # name, source ("file:<path>" or "value:<text>")
  local name="$1" src="$2"
  if [ "$DRY_RUN" -eq 1 ]; then echo "[dry-run] would set secret   $name"; return; fi
  case "$src" in
    file:*) gh secret set "$name" "${repo_args[@]}" < "${src#file:}" >/dev/null ;;
    value:*) printf '%s' "${src#value:}" | gh secret set "$name" "${repo_args[@]}" >/dev/null ;;
  esac
  echo "Set secret   $name"
}

set_variable() { # name
  local name="$1" value
  value="$(get "$INPUT" "$name")"
  if [ -z "$value" ]; then echo "Skipped variable $name (empty)"; return; fi
  if [ "$DRY_RUN" -eq 1 ]; then echo "[dry-run] would set variable $name"; return; fi
  printf '%s' "$value" | gh variable set "$name" "${repo_args[@]}" >/dev/null
  echo "Set variable $name"
}

echo "Target repository: ${REPO:-current git folder}"

# Secrets
set_secret_from DOCKERHUB_TOKEN "value:$(get "$INPUT" DOCKERHUB_TOKEN)"
set_secret_from VPS_HOST "value:$(get "$INPUT" VPS_HOST)"
set_secret_from VPS_USER "value:$(get "$INPUT" VPS_USER)"
if [ -n "$(get "$INPUT" VPS_PORT)" ]; then
  set_secret_from VPS_PORT "value:$(get "$INPUT" VPS_PORT)"
else
  echo "Skipped secret   VPS_PORT (empty, SSH port 22 is used)"
fi
set_secret_from VPS_SSH_KEY "file:$key_file"
set_secret_from WEB_ENV_PRODUCTION "file:$WEB_ENV"
set_secret_from REALTIME_ENV_PRODUCTION "file:$REALTIME_ENV"

# Variables
for v in DOCKERHUB_USERNAME VPS_APP_DIR NEXT_PUBLIC_SOCKET_URL NEXT_PUBLIC_APP_URL \
         NEXT_PUBLIC_SENTRY_DSN NEXT_PUBLIC_IMGBB_API_KEY SENTRY_ENVIRONMENT; do
  set_variable "$v"
done

cat <<'DONE'

Done. Not set on purpose: the variable DEPLOY_ENABLED.
After the first successful manual deploy on the VPS, turn automatic deploys on with:
  gh variable set DEPLOY_ENABLED --body true
DONE
