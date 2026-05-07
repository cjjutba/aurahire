#!/usr/bin/env bash
#
# AuraHire — Pull, build, and reload the API on the droplet.
# Run as the deploy user from /home/deploy/aurahire:
#   bash deploy/deploy.sh

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Pull latest"
git pull origin main

echo "==> Install deps (frozen lockfile)"
pnpm install --frozen-lockfile

echo "==> Build packages + API"
pnpm turbo build --filter=@aurahire/api

echo "==> Reload PM2"
if pm2 describe aurahire-api >/dev/null 2>&1; then
  pm2 reload aurahire-api --update-env
else
  pm2 start deploy/ecosystem.config.cjs
  pm2 save
fi

echo "==> Reload Caddy"
sudo systemctl reload caddy || true

echo ""
echo "✅ Deploy complete"
pm2 status
