/**
 * Happy path E2E (DOCX): candidate uploads a DOCX resume → exercises the
 * LibreOffice-conversion path so the right-pane preview renders the
 * canonical PDF generated server-side.
 *
 * Prerequisites (human-managed):
 * - Local dev stack running (`pnpm dev` from repo root).
 * - A seeded candidate already logged in (see `e2e/README.md`).
 * - A real DOCX file at `e2e/fixtures/sample-resume.docx`.
 */
import { test, expect } from "@playwright/test";
import { join } from "node:path";

const SAMPLE_DOCX = join(__dirname, "fixtures", "sample-resume.docx");

test("candidate completes onboarding via DOCX resume upload (LibreOffice conversion path)", async ({
  page,
}) => {
  await page.goto("/onboarding/candidate");
  await page.locator('input[type="file"]').setInputFiles(SAMPLE_DOCX);
  await expect(page.getByText(/We've read your resume/i)).toBeVisible({
    timeout: 90_000,
  });
  await page.getByRole("link", { name: /^Continue$/ }).click();

  await expect(page).toHaveURL(/\/onboarding\/candidate\/personal$/);
  // The right pane should render PDF (canonical PDF from LibreOffice conversion).
  // PDF.js renders to canvas; check the canvas exists.
  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 30_000 });

  // Don't run the rest of the flow (covered by the PDF happy-path); this spec only
  // verifies the DOCX-specific path.
});
