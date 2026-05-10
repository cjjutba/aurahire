/**
 * Happy path E2E: candidate uploads PDF resume → completes all 4 steps → lands on /candidate.
 *
 * Prerequisites (human-managed):
 * - Local dev stack running (`pnpm dev` from repo root).
 * - A seeded candidate logged-in via `e2e/fixtures/auth-state.json` OR
 *   the test logs in via the UI at the start (set TEST_EMAIL / TEST_PASSWORD env).
 * - A real PDF file at `e2e/fixtures/sample-resume.pdf` (any standard resume).
 */
import { test, expect } from "@playwright/test";
import { join } from "node:path";

const SAMPLE_PDF = join(__dirname, "fixtures", "sample-resume.pdf");

test("candidate completes onboarding via PDF resume upload", async ({
  page,
}) => {
  // TODO: replace with auth state injection or a `loginAsCandidate()` helper.
  // For now, assume the test runs after a manual login.
  await page.goto("/onboarding/candidate");

  // Step 1: upload PDF.
  await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF);
  await expect(page.getByText(/We've read your resume/i)).toBeVisible({
    timeout: 60_000,
  });

  // Verify the success card shows item counts (chips).
  const continueButton = page.getByRole("link", { name: /^Continue$/ });
  await expect(continueButton).toBeVisible();
  await continueButton.click();

  // Step 2: Personal.
  await expect(page).toHaveURL(/\/onboarding\/candidate\/personal$/);
  await expect(page.getByLabel(/full name/i)).toHaveValue(/.+/);
  await page.getByRole("button", { name: /^Continue$/ }).click();

  // Step 3: Review.
  await expect(page).toHaveURL(/\/onboarding\/candidate\/review$/);
  await expect(page.getByText(/Review what we found/i)).toBeVisible();
  await page.getByRole("button", { name: /^Continue$/ }).click();

  // Step 4: Preferences — fill required fields then Finish.
  await expect(page).toHaveURL(/\/onboarding\/candidate\/preferences$/);
  await page.getByLabel(/desired roles/i).fill("Software Engineer");
  await page.getByLabel(/^full-time$/i).check();
  await page.getByRole("button", { name: /^Finish$/ }).click();

  // Lands on dashboard.
  await expect(page).toHaveURL(/\/candidate$/, { timeout: 10_000 });
});
