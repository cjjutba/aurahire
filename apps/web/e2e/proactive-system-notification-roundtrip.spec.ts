/**
 * Proactive-system E2E (Task 42 of the proactive-system plan):
 * Notification round-trip across two roles, verifying that a recruiter's
 * status-change push lands in the candidate's notification bell via realtime
 * within ~5s and that clicking the row navigates to the application detail.
 *
 * Flow under test
 * ───────────────
 * 1. Candidate context - sign in, snapshot bell unread state.
 * 2. Recruiter context - sign in, open the target application detail page.
 * 3. Recruiter clicks "Move to Screening" → confirm modal → confirm.
 * 4. Candidate page should see the bell badge auto-update via realtime within 5s.
 * 5. Candidate clicks the bell → popover opens → notification row visible in inbox.
 * 6. Candidate clicks the row → navigation to /candidate/applications/<id>.
 *
 * Prerequisites (human-managed)
 * ─────────────────────────────
 * - Local dev stack running (`pnpm dev` from repo root): Next.js (3000) +
 *   NestJS (3333) + Redis + Mailpit. Realtime relies on the BullMQ worker
 *   and Socket.IO adapter being up.
 *
 * - Two seeded users in the DB (or signed-up via the UI), connected by *one*
 *   live application:
 *     • Candidate     - TEST_CANDIDATE_EMAIL    / TEST_CANDIDATE_PASSWORD
 *                       suggested: cjjutba+candidate@test.aurahire.local
 *     • Recruiter     - TEST_RECRUITER_EMAIL    / TEST_RECRUITER_PASSWORD
 *                       suggested: cjjutba+recruiter@test.aurahire.local
 *     • The candidate must have an *application* (status: "applied" - not
 *       already advanced) on a published job owned by the recruiter's
 *       company. ("screening" was removed per panel revision May 2026.)
 *
 * - The application id (so we can deep-link the recruiter directly):
 *     • TEST_APPLICATION_ID  - uuid of the application to advance.
 *
 * - Notification fan-out for "application_status_changed" must be enabled
 *   for the candidate (the default; configurable per user via settings).
 *
 * Env flags
 * ─────────
 * - `E2E_SKIP_NOTIFICATION_ROUNDTRIP=true` - skip when realtime/Redis is unavailable.
 * - `TEST_CANDIDATE_EMAIL`, `TEST_CANDIDATE_PASSWORD`
 * - `TEST_RECRUITER_EMAIL`, `TEST_RECRUITER_PASSWORD`
 * - `TEST_APPLICATION_ID`
 *
 * How to run
 * ──────────
 *   TEST_CANDIDATE_EMAIL=... TEST_CANDIDATE_PASSWORD=... \
 *   TEST_RECRUITER_EMAIL=... TEST_RECRUITER_PASSWORD=... \
 *   TEST_APPLICATION_ID=<uuid> \
 *   pnpm -F @aurahire/web exec playwright test \
 *     e2e/proactive-system-notification-roundtrip.spec.ts
 *
 * Selector strategy
 * ─────────────────
 * - `data-testid="bell-button"`, `data-testid="bell-unread-dot"`,
 *   `data-testid="notification-row"` were added to the bottom-rail components
 *   for stable hooks. `aria-label="Notifications (N unread)"` is a fallback
 *   that already exists on the bell button.
 * - Recruiter's "Move to Screening" CTA is targeted by accessible name; the
 *   confirm modal's accept button is also targeted by accessible name.
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const SHOULD_SKIP =
  process.env.E2E_SKIP_NOTIFICATION_ROUNDTRIP === "true" ||
  !process.env.TEST_APPLICATION_ID ||
  !process.env.TEST_CANDIDATE_EMAIL ||
  !process.env.TEST_CANDIDATE_PASSWORD ||
  !process.env.TEST_RECRUITER_EMAIL ||
  !process.env.TEST_RECRUITER_PASSWORD;

const APPLICATION_ID = process.env.TEST_APPLICATION_ID ?? "";

interface LoginInputs {
  email: string;
  password: string;
}

/**
 * Logs the supplied account in via the UI and waits for the post-login redirect.
 * The dest depends on the user's role+profileCompleted; we accept any portal
 * landing URL.
 */
async function loginViaUi(
  page: Page,
  { email, password }: LoginInputs,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(candidate|recruiter|admin|onboarding)/, {
    timeout: 15_000,
  });
}

test.describe("proactive system - notification round-trip", () => {
  test.skip(
    SHOULD_SKIP,
    "Skipping: requires TEST_CANDIDATE_*/TEST_RECRUITER_* env vars and TEST_APPLICATION_ID, plus a running realtime stack.",
  );

  test("recruiter status change auto-updates candidate's bell within 5s; row navigates to application", async ({
    browser,
  }) => {
    // ─── Candidate context (the receiver) ───────────────────────────────
    const candidateCtx: BrowserContext = await browser.newContext();
    const candidatePage = await candidateCtx.newPage();
    await loginViaUi(candidatePage, {
      email: process.env.TEST_CANDIDATE_EMAIL!,
      password: process.env.TEST_CANDIDATE_PASSWORD!,
    });
    // Make sure we're parked on a portal page so the realtime hook is mounted.
    await candidatePage.goto("/candidate");
    await candidatePage.waitForLoadState("networkidle");

    const bell = candidatePage.getByTestId("bell-button");
    await expect(bell).toBeVisible({ timeout: 10_000 });

    // Snapshot the unread state. We assert it CHANGES - not that it goes from
    // a specific number to another - so the spec works regardless of any
    // pre-existing notifications on the seeded account.
    const initialUnreadCount = await bell.getAttribute("data-unread-count");

    // ─── Recruiter context (the sender) ─────────────────────────────────
    const recruiterCtx: BrowserContext = await browser.newContext();
    const recruiterPage = await recruiterCtx.newPage();
    await loginViaUi(recruiterPage, {
      email: process.env.TEST_RECRUITER_EMAIL!,
      password: process.env.TEST_RECRUITER_PASSWORD!,
    });
    await recruiterPage.goto(`/recruiter/applications/${APPLICATION_ID}`);
    await recruiterPage.waitForLoadState("networkidle");

    // Advance status - per thesis panel revision (May 2026) "Screening"
    // stage was removed. The first positive action from "applied" is now
    // "Move to Interview".
    await recruiterPage
      .getByRole("button", { name: /Move to Interview/i })
      .click();

    // Confirm dialog uses the same label for its accept button.
    await recruiterPage
      .getByRole("button", { name: /^Move to Interview$/i })
      .click();

    // ─── Realtime assertion on the candidate side ────────────────────────
    // Two acceptable signals that the bell ticked:
    //  (a) data-unread-count attribute changed, OR
    //  (b) the unread dot appeared (it only renders when unreadCount > 0).
    await expect(async () => {
      const current = await bell.getAttribute("data-unread-count");
      expect(current).not.toBe(initialUnreadCount);
    }).toPass({ timeout: 5_000 });

    // The unread dot should now be present.
    await expect(candidatePage.getByTestId("bell-unread-dot")).toBeVisible({
      timeout: 2_000,
    });

    // ─── Open popover, find the new notification ─────────────────────────
    await bell.click();

    // The popover lazily renders rows for the inbox tab (default tab). The
    // new notification advances to the interview stage.
    const firstRow = candidatePage.getByTestId("notification-row").first();
    await expect(firstRow).toBeVisible({ timeout: 5_000 });
    await expect(firstRow).toHaveText(/Interview/i);

    // ─── Click the row → navigate to /candidate/applications/<id> ────────
    await firstRow.click();
    await expect(candidatePage).toHaveURL(
      new RegExp(`/candidate/applications/${APPLICATION_ID}`),
      { timeout: 5_000 },
    );

    await candidateCtx.close();
    await recruiterCtx.close();
  });
});
