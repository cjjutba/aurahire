#!/usr/bin/env bash
#
# AuraHire — Pull, build, validate env, and reload the API on the droplet.
# Run as the deploy user from /home/deploy/aurahire:
#   bash deploy/deploy.sh

set -euo pipefail

cd "$(dirname "$0")/.."

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "==> Pull latest (${CURRENT_BRANCH})"
git pull origin "${CURRENT_BRANCH}"

echo "==> Install deps (frozen lockfile)"
pnpm install --frozen-lockfile

echo "==> Type-check API (no emit; runtime uses swc-node)"
pnpm --filter @aurahire/api type-check

# ─── Production env validation ────────────────────────────────────────
# Fail-fast if the production .env on the droplet is missing or has the
# wrong values for the small set of vars that DEFINE production behavior.
# Catches the "we forgot to flip USE_RESEND" / "APP_URL still says
# localhost" class of footgun before PM2 reloads with a broken config.
echo "==> Validate apps/api/.env"
ENV_FILE="apps/api/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "✗ ${ENV_FILE} not found. Copy deploy/env.api.production.example to ${ENV_FILE} and fill in real values."
  exit 1
fi

# Strip comments + blank lines, then assert each invariant.
declare -A REQUIRED=(
  ["NODE_ENV"]="production"
  ["USE_RESEND"]="true"
  ["APP_URL"]="https://aurahire.site"
)
for key in "${!REQUIRED[@]}"; do
  expected="${REQUIRED[$key]}"
  actual=$(grep -E "^${key}=" "${ENV_FILE}" | head -n 1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true)
  if [[ "${actual}" != "${expected}" ]]; then
    echo "✗ ${ENV_FILE}: expected ${key}=${expected}, got ${key}=${actual:-<missing>}"
    exit 1
  fi
done

# These must be present and non-empty (values are secrets / per-deployment
# strings, not asserted literally).
for key in RESEND_API_KEY FROM_EMAIL ALLOWED_ORIGINS SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY DATABASE_URL REDIS_URL OPENAI_API_KEY; do
  value=$(grep -E "^${key}=" "${ENV_FILE}" | head -n 1 | cut -d= -f2- | xargs || true)
  if [[ -z "${value}" || "${value}" == "re_..." || "${value}" == "sk-..." ]]; then
    echo "✗ ${ENV_FILE}: ${key} is missing or still set to a placeholder"
    exit 1
  fi
done

# ALLOWED_ORIGINS must include the production frontend.
if ! grep -E "^ALLOWED_ORIGINS=" "${ENV_FILE}" | grep -q "https://aurahire.site"; then
  echo "✗ ${ENV_FILE}: ALLOWED_ORIGINS must include https://aurahire.site"
  exit 1
fi

# FROM_EMAIL must be on the verified Resend domain (aurahire.site) — Resend
# rejects sends from unverified senders, so a mismatch surfaces as silent
# delivery failures in production logs rather than at deploy time.
from_email=$(grep -E "^FROM_EMAIL=" "${ENV_FILE}" | head -n 1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true)
if [[ ! "${from_email}" == *"@aurahire.site" ]]; then
  echo "✗ ${ENV_FILE}: FROM_EMAIL must use the @aurahire.site domain (got: ${from_email})"
  exit 1
fi

echo "  ✓ NODE_ENV=production, USE_RESEND=true, APP_URL=https://aurahire.site"
echo "  ✓ All required secrets present"
echo "  ✓ ALLOWED_ORIGINS includes https://aurahire.site"
echo "  ✓ FROM_EMAIL on @aurahire.site"

echo "==> Reload PM2"
if pm2 describe aurahire-api >/dev/null 2>&1; then
  pm2 reload aurahire-api --update-env
else
  pm2 start deploy/ecosystem.config.cjs
  pm2 save
fi

echo "==> Reload reverse proxy (iams-nginx on shared droplet, Caddy elsewhere)"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^iams-nginx$'; then
  # Shared iams-backend droplet: aurahire rides the IAMS nginx (see
  # deploy/nginx.aurahire.conf). A reload picks up any config tweaks
  # appended by an updated deploy.
  sudo docker exec iams-nginx nginx -s reload || true
else
  # Dedicated droplet (legacy): Caddy on the host.
  sudo systemctl reload caddy || true
fi

echo ""
echo "✅ Deploy complete"
pm2 status
