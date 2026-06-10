/**
 * Re-upload E2E (partial): candidate uploads a resume, advances to Personal,
 * makes an edit, and verifies the dirty edit is preserved while the form stays
 * on Step 2.
 *
 * NOTE: This spec is intentionally a partial implementation. The full
 * "Replace resume" affordance is a future capability not yet built. The TODO
 * below describes the intended assertions once that affordance ships.
 *
 * Prerequisites (human-managed):
 * - Local dev stack running (`pnpm dev` from repo root).
 * - A seeded candidate already logged in (see `e2e/README.md`).
 * - A real PDF file at `e2e/fixtures/sample-resume.pdf`.
 */
import { test, expect } from "@playwright/test";
import { join } from "node:path";

const SAMPLE_PDF = join(__dirname, "fixtures", "sample-resume.pdf");

test("candidate can re-upload resume mid-flow", async ({ page }) => {
  await page.goto("/onboarding/candidate");
  await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF);
  await expect(page.getByText(/We've read your resume/i)).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("link", { name: /^Continue$/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/candidate\/personal$/);

  // Verify Personal form is prefilled.
  await expect(page.getByLabel(/full name/i)).toHaveValue(/.+/);

  // Edit a field (mark it dirty so re-upload should preserve the user's edit).
  await page.getByLabel(/headline/i).fill("Custom Headline I Edited");

  // TODO: trigger the "Replace resume" affordance from the right pane header.
  // The implementation of that affordance is in Task 24+ - once present, click it,
  // upload a different fixture, and assert:
  //   - the dirty "Custom Headline" field is preserved
  //   - other fields refresh from new AI suggestions
  // For now, this spec asserts only the basic edit-and-stay-on-step behavior.
  await expect(page.getByLabel(/headline/i)).toHaveValue(
    "Custom Headline I Edited",
  );
});
