#!/usr/bin/env bash
# One-time bootstrap of a fresh Ubuntu 22.04 / 24.04 VPS for TaskHub.
# Run once as root:   bash vps-setup.sh
# Safe to run again: every step checks the current state first.
#
# Installs Docker Engine + Compose plugin (Docker's official apt repository),
# Nginx, certbot, ufw, fail2ban, unattended-upgrades; creates a non-root
# "deploy" user; opens ports 22/80/443; creates /opt/apps/taskhub.
# It does NOT turn off SSH password login (lockout risk): the steps are printed at the end.
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="${APP_DIR:-/opt/apps/taskhub}"

log() { printf '\n==> %s\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root (for example: sudo bash $0)." >&2
  exit 1
fi

if [ ! -r /etc/os-release ]; then
  echo "Cannot detect the operating system." >&2
  exit 1
fi
# shellcheck disable=SC1091
. /etc/os-release
if [ "${ID:-}" != "ubuntu" ]; then
  echo "This script is written for Ubuntu 22.04 / 24.04 (found: ${PRETTY_NAME:-unknown})." >&2
  exit 1
fi
case "${VERSION_ID:-}" in
  22.04|24.04) ;;
  *) echo "Warning: untested Ubuntu version ${VERSION_ID:-unknown}. Continuing." >&2 ;;
esac

export DEBIAN_FRONTEND=noninteractive

log "Updating packages"
apt-get update
apt-get -y upgrade

log "Installing base packages"
apt-get install -y \
  ca-certificates curl gnupg git nginx certbot python3-certbot-nginx \
  ufw fail2ban unattended-upgrades

log "Adding Docker's official apt repository"
install -m 0755 -d /etc/apt/keyrings
if [ ! -s /etc/apt/keyrings/docker.asc ]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi
ARCH="$(dpkg --print-architecture)"
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update

log "Installing Docker Engine and the Compose plugin"
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

log "Enabling automatic security updates"
echo 'APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";' > /etc/apt/apt.conf.d/20auto-upgrades

log "Creating the ${DEPLOY_USER} user"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"

DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
if [ -s /root/.ssh/authorized_keys ]; then
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_HOME/.ssh"
  touch "$DEPLOY_HOME/.ssh/authorized_keys"
  # Append only keys that are not there yet, so a second run adds nothing.
  while IFS= read -r key; do
    [ -n "$key" ] || continue
    grep -qxF "$key" "$DEPLOY_HOME/.ssh/authorized_keys" || echo "$key" >> "$DEPLOY_HOME/.ssh/authorized_keys"
  done < /root/.ssh/authorized_keys
  chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.ssh/authorized_keys"
  chmod 600 "$DEPLOY_HOME/.ssh/authorized_keys"
  echo "Copied root's authorized_keys to ${DEPLOY_USER}."
else
  echo "No /root/.ssh/authorized_keys found. Add a public key to ${DEPLOY_HOME}/.ssh/authorized_keys yourself."
fi

log "Configuring the firewall (ufw)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

log "Creating ${APP_DIR}"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$(dirname "$APP_DIR")"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"

log "Enabling services"
systemctl enable --now docker
systemctl enable --now nginx
systemctl enable --now fail2ban

docker --version
docker compose version
nginx -v

cat <<NEXT

Bootstrap finished.

Next steps
 1. From your own computer, check that the ${DEPLOY_USER} user can log in with your key
    (keep this root session open until it works):
        ssh ${DEPLOY_USER}@<this-server-ip>
 2. Only after that works, turn off SSH password login and root login:
        sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
        sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
        sudo sshd -t && sudo systemctl reload ssh
    On Ubuntu 22.04 / 24.04 files in /etc/ssh/sshd_config.d/ can override these lines:
    run "sudo sshd -T | grep -E 'passwordauthentication|permitrootlogin'" and fix any file
    that still says yes. Test a new SSH login in a second window before closing the first.
 3. Point your DNS A record (taskhub.<your-domain>) at this server's IP.
 4. As ${DEPLOY_USER}, clone the repo into the (empty) app directory:
        git clone https://github.com/masumislambadsha/taskhub.git ${APP_DIR}
 5. Create deploy/env/web.env and deploy/env/realtime.env from the .example files,
    then run the first deploy by hand:
        cd ${APP_DIR} && DOCKERHUB_USERNAME=<user> deploy/deploy.sh <image-tag>
 6. Install the Nginx site and run: sudo certbot --nginx -d taskhub.<your-domain>
NEXT
