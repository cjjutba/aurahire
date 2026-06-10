# Candidate Onboarding E2E Tests

Playwright specs for the new 4-step onboarding flow. Run against a live dev stack.

## Setup (one time)

```bash
pnpm --filter web add -D @playwright/test  # already done
pnpm --filter web exec playwright install   # downloads browsers
```

## Required fixtures

Drop these into `apps/web/e2e/fixtures/`:

- `sample-resume.pdf` - any standard resume (used by happy-pdf, reupload, mobile)
- `sample-resume.docx` - any standard resume in DOCX (used by happy-docx; LibreOffice path)

## Running

```bash
# Start dev stack first (separate terminal):
pnpm dev

# Then in another terminal:
pnpm --filter web e2e               # headless
pnpm --filter web e2e:headed        # headed (browsers visible)
pnpm --filter web e2e:ui            # Playwright UI mode
pnpm --filter web e2e:debug         # debug mode
```

## Auth setup

The specs currently assume a manually logged-in candidate session. To make them self-sufficient:

1. Create `e2e/fixtures/auth-state.json` via Playwright's `storageState` after a manual login.
2. Set `use: { storageState: "./e2e/fixtures/auth-state.json" }` in `playwright.config.ts`.
3. OR add a `globalSetup` that does a programmatic login via the API.

## Specs

| File                                              | Covers                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `onboarding-happy-pdf.spec.ts`                    | Full happy path with PDF upload                                                                              |
| `onboarding-happy-docx.spec.ts`                   | DOCX upload (verifies LibreOffice→PDF render)                                                                |
| `onboarding-skip.spec.ts`                         | Skip resume, manual fill                                                                                     |
| `onboarding-reupload.spec.ts`                     | Re-upload mid-flow (partial - full "Replace resume" affordance pending)                                      |
| `onboarding-mobile.spec.ts`                       | Mobile drawer (iPhone 13 viewport)                                                                           |
| `proactive-system-onboarding.spec.ts`             | Full onboarding → analyzing screen → dashboard with Score Ring + recommendations (Plan Task 41)              |
| `proactive-system-notification-roundtrip.spec.ts` | Recruiter advances status → candidate's bell auto-updates via realtime → click row → navigate (Plan Task 42) |

### Proactive-system specs (env-gated)

The two `proactive-system-*` specs require seeded test data and are gated
behind env vars so CI without OPENAI / Redis can skip them cleanly.

`proactive-system-onboarding.spec.ts` - set:

- `TEST_EMAIL`, `TEST_PASSWORD` - fresh candidate (onboarding incomplete)
- `E2E_REQUIRE_RECOMMENDATIONS=true` - strict mode (default off allows degraded recs)
- `E2E_SKIP_AI=true` - skip when AI is unavailable

`proactive-system-notification-roundtrip.spec.ts` - set:

- `TEST_CANDIDATE_EMAIL`, `TEST_CANDIDATE_PASSWORD`
- `TEST_RECRUITER_EMAIL`, `TEST_RECRUITER_PASSWORD`
- `TEST_APPLICATION_ID` - uuid of an `applied`-status application owned by
  the recruiter's company and submitted by the candidate.
- `E2E_SKIP_NOTIFICATION_ROUNDTRIP=true` - skip when realtime is unavailable.

Run only these specs:

```bash
pnpm -F @aurahire/web exec playwright test e2e/proactive-system-*.spec.ts
```
