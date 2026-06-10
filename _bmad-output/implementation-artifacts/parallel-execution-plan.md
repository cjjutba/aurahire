# Parallel Execution Plan — Superset Worktrees

> How to run the serverless re-platform across parallel Superset workspaces (git worktrees), merging back to `dev`. Companion to `sprint-status.yaml` and `epics.md`. Date: 2026-06-10.

## TL;DR

- **Granularity: one worktree per EPIC** (not per story). Stories *within* an epic are sequential (each builds on the prior), so a single workspace works them in order. Per-story worktrees add merge overhead for no parallelism gain.
- **4 waves**, driven by the dependency graph. The big parallelism win is **Wave 1 (3 epics at once = 12 of 20 stories)**.
- **Not 100% autonomous:** code is written autonomously in each workspace, but every epic hits **human-only gates** (provisioning, DB migrations, deploys, billed AI/email tests, dev-server visual QA) per the project's hard rules. Plan around those checkpoints.
- **3 known merge-collision files** between parallel epics — handled by a coordination protocol (regen orval *after* merge, resolve 2 small wiring files on the second merge).

## Dependency graph → wave schedule

```
Wave 0 (solo) ── Epic 1: Neon + Upstash            → merge to dev   [foundation; everything needs it]
                       │
Wave 1 (3-way ∥) ──────┼── Epic 2: Clerk auth        ┐
                       ├── Epic 3: Vercel Blob        ├ all branch off dev@Wave0 → merge back
                       └── Epic 4: remove always-on   ┘
                       │
Wave 2 (solo) ── Epic 5: Vercel Function + Cron     → merge   [REQUIRES Epic 4 — can't run socket.io/BullMQ on a Function]
                       │
Wave 3 (solo) ── Epic 6: domain cutover + verify    → merge   [requires everything]
```

**Why these waves:** Epic 1 is the foundation (no epic functions without the DB on Neon). Epics 2/3/4 are independent *domains* (auth / storage / background-removal) → parallel. Epic 5 has a hard backward dependency on Epic 4. Epic 6 is the final cutover + demo gate.

## Wave 1 file-overlap map (the only real conflict zone)

| File | Epic 2 (Clerk) | Epic 3 (Blob) | Epic 4 (remove always-on) | Collision? |
|---|---|---|---|---|
| `apps/api/src/storage/*` | — | ✏️ rewrite | — | no (Epic 3 isolated) |
| `apps/api/src/app.module.ts` | ✏️ add webhooks, swap guard | — | ✏️ remove realtime/queue modules | **YES (2↔4)** |
| `apps/web/app/layout.tsx` | ✏️ ClerkProvider in, AuthTokenProvider out | — | ✏️ SocketProvider out | **YES (2↔4)** |
| `packages/shared/src/api-client/generated.ts` (orval) | ✏️ regen | — | ✏️ regen | **YES (2↔4)** — never hand-merge |
| `.env.example` (root + api) | ✏️ +CLERK_* | ✏️ +BLOB | ✏️ — | trivial (append different vars) |
| migrations | `0018` | — | — | no (Epic 1 owns `0017`, Epic 2 owns `0018`) |

**Epic 3 is conflict-free** with 2 & 4 → safest fully-parallel branch.

### Coordination rules for Wave 1
1. **orval `generated.ts`: regenerate ONCE on `dev` after the wave merges — never per-branch.** In each branch, change the Zod schemas/DTOs but don't commit a regen of `generated.ts` (or `.gitignore`-stage it). After Epics 2/4 land on `dev`, run `pnpm --filter @aurahire/shared codegen` once and commit.
2. **`app.module.ts` + `layout.tsx`: resolve on the *second* merge.** Merge Epic 3 first (clean), then Epic 4, then Epic 2 — the only real 3-way-line conflicts are these two small wiring files on the Epic 2 merge. ~5-minute resolution.
3. **Suggested merge order:** Epic 3 → Epic 4 → Epic 2 → then orval regen + type-check/build on `dev`.

## Per-workspace workflow (inside each epic worktree)

For each story in the epic, **in order**, in a fresh context window:
1. `[CS]` **Create Story** → writes `_bmad-output/implementation-artifacts/<story-key>.md` (status `backlog`→`ready-for-dev`)
2. `[DS]` **Dev Story** → implements (TDD), updates `sprint-status.yaml` (`in-progress`→`review`)
3. `[CR]` **Code Review** → approve (`review`→`done`) or send back to `[DS]`
4. Repeat for the next story. Epic flips `in-progress` on first story, `done` when all stories `done`.
5. Optional `[ER]` retrospective at epic end.

`sprint-status.yaml` is the shared tracker — each workspace updates its own story keys.

## Autonomous mode (CLAUDE.md §0b Standing Authorization, granted 2026-06-10)

Worktree agents run **hands-off**: they execute migrations, dev servers, tests, and deploys themselves using the keys you provide. The ONLY human task is **provisioning accounts + supplying keys** (agents cannot sign up for services or mint keys). Each agent operates on its OWN Neon branch + Vercel preview to avoid clobbering shared infra.

| Epic | You provide once (keys) | Agent then does autonomously |
|---|---|---|
| 1 | Neon pooled + unpooled URLs, Upstash `REDIS_URL` | create its Neon branch, run `drizzle-kit migrate` (0000–0016 + 0017), wire Upstash, test |
| 2 | Clerk secret/publishable/JWKS/webhook keys | apply `0018`, build auth, test sign-in on a preview |
| 3 | Vercel `BLOB_READ_WRITE_TOKEN` | rewrite storage, test upload/parse/download |
| 4 | (existing OpenAI key) | inline scoring, remove realtime/queue, test scoring + polling (billed AI ok) |
| 5 | Vercel project link | deploy the Function, set up cron, verify bundle/plan |
| 6 | `aurahire.cjjutba.com` on Vercel | domain cutover, production deploy, run the demo path |

**Production promotion is serialized:** migrating the primary Neon branch + the live-domain deploy happen one-at-a-time (never two worktrees promoting at once); the agent announces the exact prod command before running it. The git **safety floor** (no force-push `main`, no `--no-verify`, no destructive git over uncommitted work) still applies — see `CLAUDE.md` §0b.

## Merge-back protocol

1. Branch each epic worktree off the **latest `dev`**: `git switch -c feat/epic-N-<slug> dev`.
2. Run the story cycle to `done` for all stories; ensure type-check + lint + tests pass in the worktree.
3. Human completes the epic's gate (migrations/provisioning/deploy as applicable).
4. Merge worktree → `dev` (PR or `git merge`), following the Wave-1 order rules.
5. After each wave: regen orval on `dev`, `pnpm type-check && pnpm build`, then **test locally** (`pnpm dev` against the managed Neon/Upstash/Clerk — they're cloud-reachable from localhost, so local dev works end-to-end).
6. Next wave branches off the updated `dev`.

## Branch / workspace naming
`feat/epic-1-neon-upstash` · `feat/epic-2-clerk-auth` · `feat/epic-3-vercel-blob` · `feat/epic-4-remove-always-on` · `feat/epic-5-vercel-compute` · `feat/epic-6-domain-cutover`

## Start now
1. **Provision Neon + Upstash** and paste the keys into the Epic 1 workspace env.
2. Create the **Epic 1 worktree** in Superset off `dev`; paste the Epic 1 prompt — the agent runs the full story cycle AND the migrations/tests/deploys itself (per CLAUDE.md §0b).
3. Once Epic 1 merges to `dev`, **fan out Wave 1**: three Superset workspaces for Epics 2/3/4, each on its own Neon branch + preview.

> **Worktree self-sufficiency:** a fresh git worktree only contains *committed* files. For worktree agents to have the BMad skills + framework + these permissions, `.claude/settings.json`, `.claude/skills/`, and `_bmad/` must be committed to `dev` (the planning artifacts under `_bmad-output/` already are).

> Realistic parallelism: **Wave 1's 3-way fan-out is the payoff** (12 stories concurrently). Waves 0/2/3 are serial by dependency. Total critical path ≈ Epic 1 → (longest of 2/3/4) → Epic 5 → Epic 6.
