# GitHub Actions — CI/CD

Two workflows, one job each:

| File | Trigger | What it does |
|---|---|---|
| `ci.yml` | PR opened against `main`, push to `main`/`dev` | Format check, type-check, lint (best-effort), API tests, web tests. **Does not deploy.** |
| `deploy.yml` | Push to `main` (i.e. PR merged), or manual dispatch | Re-runs validation → SSHes into the Droplet → `bash deploy/deploy.sh` → health probe. |

Tests run twice on a merge (once on the PR run, once on the deploy run). The duplication is intentional — the deploy run is the one that *gates* the SSH step, and pinning it to `main` after merge guarantees we don't deploy a stale validation result.

## One-time setup — repository secrets

GitHub: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value | How to get it |
|---|---|---|
| `DROPLET_HOST` | `165.232.x.x` or `api.aurahire.site` | `doctl compute droplet list` (column `PUBLIC IPV4`) — or paste the FQDN you point Caddy at |
| `DROPLET_USER` | `deploy` | The non-root deploy user created by `deploy/provision.sh` |
| `DROPLET_SSH_PRIVATE_KEY` | full PEM | `ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/aurahire_ci` then `cat ~/.ssh/aurahire_ci`. Paste the **whole file** including BEGIN/END lines. |
| `DROPLET_SSH_KNOWN_HOSTS` | one line | `ssh-keyscan -H <DROPLET_HOST>` — paste the entire output (usually 3 lines, one per host-key algorithm) |

Then, on the Droplet, add the matching public key to the deploy user:

```bash
# On your local machine:
cat ~/.ssh/aurahire_ci.pub
# Copy the line.

# SSH into the droplet:
ssh deploy@<DROPLET_HOST>
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo 'ssh-ed25519 AAAA...github-actions' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
exit
```

## Optional repository variables

GitHub: **Settings → Secrets and variables → Actions → Variables tab**

| Variable | Default | Use |
|---|---|---|
| `DROPLET_DEPLOY_PATH` | `/home/deploy/aurahire` | Where the repo is cloned on the Droplet. Override only if you provisioned a different path. |
| `DROPLET_DEPLOY_BRANCH` | `main` | Branch to check out on the Droplet before running `deploy.sh`. |

## Optional environment protection

The `deploy` job declares `environment: production`. Visit **Settings → Environments → production** to:

- Require reviewer approval before any deploy runs (recommended for two-engineer setups).
- Restrict deploys to specific branches (already pinned to `main` by the workflow, but belt-and-suspenders is fine).
- Add environment-scoped secrets/variables that override repo-level ones for production.

If you don't need any of that, leave the environment empty and the workflow runs unblocked.

## Verifying the setup

1. Open a PR with a no-op change. Confirm `CI / Format · Type-check · Lint · Test` runs green.
2. Merge the PR. A `Deploy to Droplet` run should kick off automatically.
3. The deploy job should:
   - Re-run validation (green)
   - Sanity-check SSH (prints `connected as deploy on <hostname>`)
   - Run `deploy.sh` (with the env-validation guardrails added in commit `5f93b3f`)
   - Probe `https://api.aurahire.site/api/v1/health` (best-effort)

If the SSH step fails with `Host key verification failed`, your `DROPLET_SSH_KNOWN_HOSTS` is stale — re-run `ssh-keyscan -H <DROPLET_HOST>` and update the secret.

If the deploy step fails inside `deploy.sh` at the `==> Validate apps/api/.env` block, log into the Droplet and check `/home/deploy/aurahire/apps/api/.env` against `deploy/env.api.production.example` — the script prints the exact line that's wrong.

## Re-running a failed deploy

**Actions tab → Deploy to Droplet → most recent run → "Re-run jobs"**.

For a deploy without a code change (e.g. after rotating a secret on the Droplet), use **Actions tab → Deploy to Droplet → "Run workflow" → main**. That dispatches the workflow on the current `main` HEAD without forcing a no-op commit.
