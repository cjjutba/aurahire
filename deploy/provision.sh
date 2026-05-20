#!/usr/bin/env bash
#
# AuraHire — One-shot droplet provisioning (run as root on a fresh Ubuntu 24.04 droplet).
#
# What this does:
#   1. System update
#   2. Create non-root `deploy` user with sudo + your SSH key
#   3. Harden SSH (disable root login + password auth)
#   4. UFW firewall (22, 80, 443 only)
#   5. fail2ban (SSH brute-force protection)
#   6. Docker + Docker Compose plugin
#   7. Node 20 LTS + pnpm (via corepack)
#   8. PM2 (process manager)
#   9. Caddy (reverse proxy with auto-HTTPS via Let's Encrypt)
#
# Usage from your Mac:
#   scp deploy/provision.sh root@167.71.217.44:/root/
#   ssh root@167.71.217.44 'bash /root/provision.sh'

set -euo pipefail

DEPLOY_USER="deploy"

echo "==> 1/9 System update"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y

echo "==> 2/9 Creating ${DEPLOY_USER} user"
if ! id -u "${DEPLOY_USER}" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "${DEPLOY_USER}"
  usermod -aG sudo "${DEPLOY_USER}"
  # Passwordless sudo — needed by deploy.sh to reload caddy
  echo "${DEPLOY_USER} ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/${DEPLOY_USER}"
  chmod 0440 "/etc/sudoers.d/${DEPLOY_USER}"
fi

# Mirror root's authorized_keys to the deploy user so the same SSH key works
mkdir -p "/home/${DEPLOY_USER}/.ssh"
if [[ -f /root/.ssh/authorized_keys ]]; then
  cp /root/.ssh/authorized_keys "/home/${DEPLOY_USER}/.ssh/authorized_keys"
fi
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"
chmod 700 "/home/${DEPLOY_USER}/.ssh"
chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"

echo "==> 3/9 Hardening SSH"
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
systemctl restart ssh

echo "==> 4/9 UFW firewall"
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP (Caddy)'
ufw allow 443/tcp comment 'HTTPS (Caddy)'
ufw --force enable

echo "==> 5/9 fail2ban"
apt-get install -y fail2ban
systemctl enable --now fail2ban

echo "==> 6/9 Docker + Compose"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
usermod -aG docker "${DEPLOY_USER}"
systemctl enable --now docker

echo "==> 7/9 Node 20 LTS + pnpm"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
corepack enable
corepack prepare pnpm@latest --activate

echo "==> 8/9 PM2"
npm install -g pm2

echo "==> 9/9 Caddy"
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi
mkdir -p /var/log/caddy
chown -R caddy:caddy /var/log/caddy

PUBLIC_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "✅ Provisioning complete."
echo ""
echo "Next steps (run from your Mac):"
echo "  ssh deploy@${PUBLIC_IP}"
echo ""
echo "Then on the droplet, follow deploy/README-STEPS.md (or the steps your assistant gave you)."
