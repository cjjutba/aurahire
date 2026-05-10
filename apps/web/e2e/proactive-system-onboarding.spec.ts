/**
 * Proactive-system E2E (Task 41 of the proactive-system plan):
 * Full candidate onboarding flow that exercises the inline-score "analyzing"
 * screen and the precomputed "Recommended for You" section on the dashboard.
 *
 * Flow under test
 * ───────────────
 * 1. Sign-in (already-completed via auth-state OR via UI with TEST_EMAIL/TEST_PASSWORD).
 * 2. /onboarding/candidate                    (Step 1 — resume upload)
 * 3. /onboarding/candidate/personal           (Step 2)
 * 4. /onboarding/candidate/review             (Step 3)
 * 5. /onboarding/candidate/preferences        (Step 4 — click "Finish")
 * 6. /onboarding/candidate/analyzing          (Computing your Profile Score…)
 * 7. /candidate                               (dashboard — Score Ring + Recommended jobs)
 *
 * Prerequisites (human-managed)
 * ─────────────────────────────
 * - Local dev stack running (`pnpm dev` from repo root): Next.js (3000) + NestJS (3333) + Redis + Mailpit.
 * - A *fresh* candidate account that has not yet completed onboarding. The spec
 *   walks the wizard end-to-end, so re-running it on the same account requires
 *   resetting `candidate_profiles.profile_completed = false` first (or seeding
 *   a new candidate). Sign in via UI by setting:
 *       TEST_EMAIL     = the candidate's email
 *       TEST_PASSWORD  = the candidate's password
 *   OR pre-populate `e2e/fixtures/auth-state.json` and configure `storageState`
 *   in `playwright.config.ts` (see e2e/README.md).
 * - A real PDF resume at `e2e/fixtures/sample-resume.pdf`.
 * - At least 3-5 published jobs visible to candidates so the precompute queue
 *   has something to score against. The `Recommended for You` assertion below
 *   tolerates a degraded/empty state via `RECOMMENDED_REQUIRED=false`.
 *
 * Env flags
 * ─────────
 * - `E2E_REQUIRE_RECOMMENDATIONS=true` — assert at least one Recommended job
 *   card renders. Set to `false` (default) to allow the empty/retry state when
 *   the precompute queue has no candidate jobs.
 * - `E2E_SKIP_AI=true`                — skip this spec entirely (e.g. CI without OPENAI).
 *
 * How to run
 * ──────────
 *   pnpm -F @aurahire/web exec playwright test e2e/proactive-system-onboarding.spec.ts
 *
 * Selector strategy
 * ─────────────────
 * - Score Ring exposes `role="progressbar"` with `aria-label="Score N out of 100"` —
 *   we target it via role instead of a brittle `data-testid`.
 * - Buttons targeted by accessible name (text/role).
 */
import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

const SAMPLE_PDF = join(__dirname, "fixtures", "sample-resume.pdf");

const SHOULD_SKIP = process.env.E2E_SKIP_AI === "true";
const REQUIRE_RECS = process.env.E2E_REQUIRE_RECOMMENDATIONS === "true";

/**
 * Sign in via UI when TEST_EMAIL/TEST_PASSWORD are present. Otherwise rely on
 * Playwright's `storageState` (configured separately by the operator). Mirrors
 * the half-implemented helper described in `e2e/README.md`.
 */
async function loginIfCredentialsPresent(page: Page): Promise<void> {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) return;

  await page.goto("/login");
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  // Either lands on /candidate (already onboarded — should not happen for this spec)
  // or /onboarding/candidate. Accept either; the test will fail loudly if the
  // candidate has already finished onboarding.
  await page.waitForURL(/\/(candidate|onboarding\/candidate)/, {
    timeout: 15_000,
  });
}

test.describe("proactive system — onboarding to dashboard", () => {
  test.skip(SHOULD_SKIP, "E2E_SKIP_AI=true — skipping AI-dependent flow");

  test("candidate completes onboarding, sees analyzing screen, lands on dashboard with score + recommendations", async ({
    page,
  }) => {
    await loginIfCredentialsPresent(page);

    // Step 1 — resume upload.
    await page.goto("/onboarding/candidate");
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF);

    // Parsing can take 30-60s on a cold backend. The success card is the gate.
    await expect(page.getByText(/We've read your resume/i)).toBeVisible({
      timeout: 60_000,
    });
    await page.getByRole("link", { name: /^Continue$/ }).click();

    // Step 2 — personal.
    await expect(page).toHaveURL(/\/onboarding\/candidate\/personal$/);
    // Resume parsing prefills full name; if not, the spec should still continue
    // because the inline-score path is what's under test here, not the parser.
    await expect(page.getByLabel(/full name/i)).toHaveValue(/.+/);
    await page.getByRole("button", { name: /^Continue$/ }).click();

    // Step 3 — review.
    await expect(page).toHaveURL(/\/onboarding\/candidate\/review$/);
    await expect(page.getByText(/Review what we found/i)).toBeVisible();
    await page.getByRole("button", { name: /^Continue$/ }).click();

    // Step 4 — preferences. Required fields then Finish.
    await expect(page).toHaveURL(/\/onboarding\/candidate\/preferences$/);
    await page.getByLabel(/desired roles/i).fill("Software Engineer");
    await page.getByLabel(/^full-time$/i).check();
    await page.getByRole("button", { name: /^Finish$/ }).click();

    // ─── Analyzing screen ────────────────────────────────────────────────
    // The button label is "Finish" today; the plan calls it "Complete setup".
    // Either way, the post-click URL is /onboarding/candidate/analyzing.
    await expect(page).toHaveURL(/\/onboarding\/candidate\/analyzing$/, {
      timeout: 10_000,
    });

    // The reducer's first kind is "computingProfileScore" → renders an AiShimmer
    // with caption "Computing your Profile Score…". The ellipsis is U+2026.
    await expect(page.getByText(/Computing your Profile Score/i)).toBeVisible({
      timeout: 5_000,
    });

    // ─── Dashboard ───────────────────────────────────────────────────────
    // ANALYZING_SCREEN_WALLCLOCK_MS bounds the analyzing screen; the redirect
    // fires shortly after the inline score lands. 30s headroom for cold AI.
    await page.waitForURL(/\/candidate(\?.*)?$/, { timeout: 30_000 });

    // Score Ring exposes role="progressbar" with aria-label="Score N out of 100".
    // The dashboard renders it inside the Profile Score card *and* the analyzing
    // screen rendered one too — by the time we're here the analyzing screen is
    // gone. We accept any progressbar matching the score pattern.
    await expect(
      page.getByRole("progressbar", { name: /Score \d+ out of 100/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // ─── Recommended for You ─────────────────────────────────────────────
    // Heading is the "Recommended for You" section label; presence of *the
    // section* is the minimum required. If the precompute queue has produced
    // at least one match preview, a "/100" score chip is visible too.
    await expect(page.getByText(/Recommended for You/i)).toBeVisible({
      timeout: 15_000,
    });

    if (REQUIRE_RECS) {
      // Each recommended job card surfaces its score as `<NN> / 100` in mono.
      // Targeting the "/ 100" label keeps the assertion stable across re-renders.
      await expect(page.locator("text=/ 100").first()).toBeVisible({
        timeout: 15_000,
      });
    }
  });
});
