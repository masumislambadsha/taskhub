#!/usr/bin/env bash
# Deploy one image tag of the TaskHub stack on this server, with a health gate
# and automatic rollback. Runs on the VPS as the "deploy" user, from CI or by hand.
#
#   DOCKERHUB_USERNAME=your-dockerhub-user deploy/deploy.sh <image-tag>
#
# Roll back by hand: run it again with an older tag (a git SHA).
#
# Optional environment variables:
#   SKIP_PULL=1          do not pull images (local testing with locally built images)
#   HEALTH_TIMEOUT=120   seconds to wait for the health checks
set -euo pipefail

if [ "$#" -ne 1 ] || [ -z "$1" ]; then
  echo "Usage: DOCKERHUB_USERNAME=<user> $0 <image-tag>" >&2
  exit 2
fi
NEW_TAG="$1"

if [ -z "${DOCKERHUB_USERNAME:-}" ]; then
  echo "DOCKERHUB_USERNAME is not set. Use your Docker Hub user name." >&2
  exit 2
fi
export DOCKERHUB_USERNAME

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

for f in deploy/env/web.env deploy/env/realtime.env; do
  if [ ! -f "$f" ]; then
    echo "Missing $f. Copy ${f}.example to $f and fill it in." >&2
    exit 2
  fi
done

STATE_DIR=".deploy"
mkdir -p "$STATE_DIR"
CURRENT_FILE="$STATE_DIR/current_tag"
PREVIOUS_FILE="$STATE_DIR/previous_tag"
CURRENT_TAG="$(cat "$CURRENT_FILE" 2>/dev/null || true)"
PREVIOUS_TAG="$(cat "$PREVIOUS_FILE" 2>/dev/null || true)"

HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
SERVICES=(web realtime worker redis)

compose() { docker compose -f compose.prod.yml "$@"; }

wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:3000/api/health/ready \
      && curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:3001/health; then
      return 0
    fi
    sleep 3
  done
  return 1
}

# Start the stack with the given tag and wait until it is healthy.
deploy_tag() {
  export IMAGE_TAG="$1"
  if [ "${SKIP_PULL:-0}" != "1" ]; then
    echo "Pulling images for tag $IMAGE_TAG"
    compose pull || return 1
  fi
  echo "Starting tag $IMAGE_TAG"
  compose up -d --remove-orphans || return 1
  echo "Waiting up to ${HEALTH_TIMEOUT}s for /api/health/ready (web) and /health (realtime)"
  wait_healthy
}

print_logs() {
  local s
  for s in "${SERVICES[@]}"; do
    echo "----- last 100 log lines: $s -----"
    compose logs --no-color --tail=100 "$s" 2>&1 || true
  done
}

echo "Deploying $NEW_TAG (currently running: ${CURRENT_TAG:-none})"

if deploy_tag "$NEW_TAG"; then
  # Remember the tag that was running before, unless this is a redeploy of the same tag.
  if [ -n "$CURRENT_TAG" ] && [ "$CURRENT_TAG" != "$NEW_TAG" ]; then
    echo "$CURRENT_TAG" > "$PREVIOUS_FILE"
  fi
  echo "$NEW_TAG" > "$CURRENT_FILE"
  docker image prune -f >/dev/null
  echo "Deploy of $NEW_TAG succeeded."
  exit 0
fi

echo "Deploy of $NEW_TAG FAILED the health check." >&2
print_logs >&2

ROLLBACK_TAG=""
if [ -n "$CURRENT_TAG" ] && [ "$CURRENT_TAG" != "$NEW_TAG" ]; then
  ROLLBACK_TAG="$CURRENT_TAG"
elif [ -n "$PREVIOUS_TAG" ] && [ "$PREVIOUS_TAG" != "$NEW_TAG" ]; then
  ROLLBACK_TAG="$PREVIOUS_TAG"
fi

if [ -z "$ROLLBACK_TAG" ]; then
  echo "No earlier tag is recorded, so there is nothing to roll back to." >&2
  exit 1
fi

echo "Rolling back to $ROLLBACK_TAG" >&2
if deploy_tag "$ROLLBACK_TAG"; then
  echo "$ROLLBACK_TAG" > "$CURRENT_FILE"
  echo "Rolled back to $ROLLBACK_TAG. The failed tag $NEW_TAG is NOT running." >&2
else
  echo "Rollback to $ROLLBACK_TAG also failed. Check the logs above and the server by hand." >&2
fi
exit 1
