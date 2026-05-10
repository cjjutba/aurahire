/**
 * Skip-flow E2E: candidate skips the resume upload, fills the profile manually,
 * and completes all 4 onboarding steps.
 *
 * Prerequisites (human-managed):
 * - Local dev stack running (`pnpm dev` from repo root).
 * - A seeded candidate already logged in (see `e2e/README.md`).
 */
import { test, expect } from "@playwright/test";

test("candidate skips resume upload, fills profile manually, completes onboarding", async ({
  page,
}) => {
  await page.goto("/onboarding/candidate");

  // Click the "Skip — I'll fill in manually" link.
  await page.getByRole("button", { name: /Skip.*manually/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/candidate\/personal$/);

  // Manually fill required field.
  await page.getByLabel(/full name/i).fill("Test Candidate");
  await page.getByRole("button", { name: /^Continue$/ }).click();

  await expect(page).toHaveURL(/\/onboarding\/candidate\/review$/);
  // Skills cloud — add 3 skills to satisfy review-completion schema.
  const skillInput = page.getByPlaceholder(/Add a skill/i);
  for (const skill of ["TypeScript", "React", "Node.js"]) {
    await skillInput.fill(skill);
    await skillInput.press("Enter");
  }
  await page.getByRole("button", { name: /^Continue$/ }).click();

  await expect(page).toHaveURL(/\/onboarding\/candidate\/preferences$/);
  await page.getByLabel(/desired roles/i).fill("Software Engineer");
  await page.getByLabel(/^full-time$/i).check();
  await page.getByRole("button", { name: /^Finish$/ }).click();

  await expect(page).toHaveURL(/\/candidate$/, { timeout: 10_000 });
});
