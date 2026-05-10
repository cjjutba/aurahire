/**
 * Mobile E2E: on a phone viewport, the right-pane resume preview collapses into
 * a slide-in sheet triggered by a "View resume" button. Verifies the sheet opens,
 * renders the PDF canvas, and closes via Escape with focus restored.
 *
 * Runs only under the `mobile-safari` Playwright project (iPhone 13).
 *
 * Prerequisites (human-managed):
 * - Local dev stack running (`pnpm dev` from repo root).
 * - A seeded candidate already logged in (see `e2e/README.md`).
 * - A real PDF file at `e2e/fixtures/sample-resume.pdf`.
 */
import { test, expect } from "@playwright/test";
import { join } from "node:path";

const SAMPLE_PDF = join(__dirname, "fixtures", "sample-resume.pdf");

test("mobile candidate uses slide-in resume sheet", async ({ page }) => {
  await page.goto("/onboarding/candidate");
  await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF);
  await expect(page.getByText(/We've read your resume/i)).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("link", { name: /^Continue$/ }).click();

  await expect(page).toHaveURL(/\/onboarding\/candidate\/personal$/);

  // The "View resume" button is only visible on mobile viewports.
  const viewResume = page.getByRole("button", { name: /View resume/i });
  await expect(viewResume).toBeVisible();
  await viewResume.click();

  // Sheet should open with the resume preview content.
  // PDF.js canvas takes a moment to render.
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });

  // Close via Escape and verify focus returns.
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: /View resume/i }),
  ).toBeFocused();
});
