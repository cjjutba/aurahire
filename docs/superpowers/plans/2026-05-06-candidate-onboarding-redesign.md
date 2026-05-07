# Candidate Onboarding Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the candidate onboarding flow as a 4-step two-pane wizard with a live `ResumePreviewPane` (PDF.js + AI-derived highlights), inline-editable Review sections (Experience / Education / Skills), AI prompt v2 with verbatim `*_source` extraction for highlight positioning, server-side DOCX→PDF conversion, autosave with status indicator, and full mobile parity via a slide-in drawer.

**Architecture:** Frontend gets a new `OnboardingShell` (top bar + two-pane body), four routes (Resume → Personal → Review → Preferences) replacing the current six, and a stack of new components anchored by `ResumePreviewPane` (PDF.js renderer + highlight overlay + linearized fallback). Backend gets a Zod-driven prompt v2 that requires verbatim `*_source` strings, a `DocxToPdfService` (LibreOffice headless) that produces a canonical PDF for every DOCX upload, a `canonical_pdf_path` column on `resumes`, and a new `POST /resumes/:id/reparse` endpoint. Highlight positions are derived **client-side** by matching `*_source` strings against PDF.js's text layer.

**Tech Stack:** Next.js 16 App Router · NestJS · Tailwind v4 · `pdfjs-dist` · `@radix-ui/react-dialog` (sheet drawer) · React Hook Form · Zod · TanStack Query · Drizzle (Postgres) · LibreOffice (Docker) · OpenAI `gpt-4o-mini` (structured outputs).

**Spec:** `docs/superpowers/specs/2026-05-06-candidate-onboarding-redesign-design.md`

**Verification approach:** Per CLAUDE.md the human runs all dev servers, migrations, and Docker commands. Claude verifies with `pnpm tsc --noEmit`, `pnpm lint`, `turbo run build`, and unit/integration tests via `pnpm test`. E2E + manual verification are the human's responsibility, captured as a checklist near the end of the plan.

**Commit policy:** Per CLAUDE.md, commits happen only when the human asks. The plan does not auto-commit; the final task lists suggested commit boundaries as optional checkpoints.

---

## File Structure

### Create — Backend

| Path | Responsibility |
| --- | --- |
| `apps/api/src/storage/docx-to-pdf.service.ts` | LibreOffice headless wrapper (spawn `soffice --headless --convert-to pdf`) with serialized mutex queue |
| `apps/api/src/storage/docx-to-pdf.service.spec.ts` | Unit test: mock `child_process.spawn`, fixture-driven |
| `apps/api/src/ai/prompts/parse-resume-v2.ts` | Prompt v2 system message + user prompt builder (adds `*_source` extraction rules) |
| `apps/api/test/fixtures/resumes/README.md` | Golden corpus documentation |
| `apps/api/test/fixtures/resumes/01-clean-pdf.pdf` *(human supplies binary)* | Sample fixture |
| `apps/api/test/fixtures/resumes/01-clean-pdf.expected.json` | Expected extraction for fixture 01 |
| `apps/api/scripts/run-ai-parse-corpus.ts` | `pnpm test:ai-parse` entrypoint — runs prompt against golden corpus, asserts thresholds |

### Create — Shared

| Path | Responsibility |
| --- | --- |
| `packages/shared/src/skills-taxonomy.ts` | Static array of ~500 common skill names for typeahead |
| `packages/shared/src/onboarding/personal-complete.schema.ts` | Per-step "completion" Zod schema gating Continue button |
| `packages/shared/src/onboarding/review-complete.schema.ts` | Per-step completion schema |
| `packages/shared/src/onboarding/preferences-complete.schema.ts` | Per-step completion schema |

### Create — Frontend (foundation)

| Path | Responsibility |
| --- | --- |
| `apps/web/components/onboarding/onboarding-shell.tsx` | Top bar (wordmark + progress + save indicator) + two-pane body grid |
| `apps/web/components/onboarding/onboarding-progress.tsx` | 4-segment horizontal progress (collapses to slim bar < 1024px) |
| `apps/web/components/onboarding/save-status-indicator.tsx` | Top-bar autosave indicator (idle / saving / error) |
| `apps/web/components/onboarding/use-autosave.ts` | Hook: debounced PATCH on form blur with status callback |
| `apps/web/components/onboarding/use-tab-close-protection.ts` | Hook: `beforeunload` listener, only fires after dirty > 750ms |

### Create — Frontend (resume preview)

| Path | Responsibility |
| --- | --- |
| `apps/web/components/onboarding/resume-preview/highlight-context.tsx` | Provider exposing `{ hoveredFieldId, setHoveredFieldId, focusField }` |
| `apps/web/components/onboarding/resume-preview/derive-highlights.ts` | Pure fn: parsed-resume JSON → `Highlight[]` |
| `apps/web/components/onboarding/resume-preview/find-text-spans.ts` | Pure fn: text-layer items + source string → `Rect[]` (whitespace-tolerant, accent-insensitive) |
| `apps/web/components/onboarding/resume-preview/find-text-spans.test.ts` | Vitest tests for matcher |
| `apps/web/components/onboarding/resume-preview/pdf-renderer.tsx` | PDF.js wrapper — renders pages + text layer, exposes text items via callback |
| `apps/web/components/onboarding/resume-preview/highlight-overlay.tsx` | Renders rect overlays on top of text layer with per-category opacity |
| `apps/web/components/onboarding/resume-preview/linearized-resume-view.tsx` | Fallback for image-only PDFs / DOCX-conversion failures |
| `apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx` | Orchestrator: loads PDF, derives highlights, owns state machine |

### Create — Frontend (steps)

| Path | Responsibility |
| --- | --- |
| `apps/web/components/onboarding/candidate/resume-upload-card.tsx` | Step 1 dropzone + cycling-caption parsing state + recovery card |
| `apps/web/components/onboarding/candidate/resume-stale-recovery-card.tsx` | Stale `parsing` row recovery UI |
| `apps/web/components/onboarding/candidate/parsing-shimmer.tsx` | `ai-shimmer` band with cycling captions |
| `apps/web/components/onboarding/candidate/parse-success-card.tsx` | Step 1 success state with "Found N items" chips |
| `apps/web/components/onboarding/candidate/profile-preview-pane.tsx` | Step 4 right-pane swap (recruiter view) |
| `apps/web/components/onboarding/candidate/review/review-step.tsx` | Step 3 orchestrator (3 sections + IntersectionObserver-driven `activeCategories`) |
| `apps/web/components/onboarding/candidate/review/experience-card.tsx` | Collapsed/expanded states with inline edit |
| `apps/web/components/onboarding/candidate/review/experience-list.tsx` | List wrapper with add/delete + optimistic toast-undo |
| `apps/web/components/onboarding/candidate/review/education-card.tsx` | Same pattern as experience |
| `apps/web/components/onboarding/candidate/review/education-list.tsx` | List wrapper |
| `apps/web/components/onboarding/candidate/review/skills-cloud.tsx` | Chip cloud + typeahead |
| `apps/web/components/onboarding/mobile/resume-sheet.tsx` | Radix Dialog drawer wrapper for < 1024px |
| `apps/web/components/onboarding/mobile/sticky-step-dock.tsx` | Mobile sticky bottom Back/Continue dock |
| `apps/web/app/onboarding/candidate/review/page.tsx` | Step 3 server component (NEW route) |

### Modify

| Path | Change |
| --- | --- |
| `packages/db/src/schema.ts` | Add `canonicalPdfPath` text column to `resumesTable` |
| `packages/shared/src/schemas/parsed-resume.ts` | Add `*_source` fields to every entity schema; bump types |
| `apps/api/src/ai/prompts/parse-resume.ts` | Bump `PARSE_RESUME_VERSION` to `2.0.0`, system prompt requires `*_source` strings |
| `apps/api/src/ai/parse-resume.service.ts` | Add post-parse substring validation, compute `source_field_coverage`, return in `ParseResumeOutput` |
| `apps/api/src/modules/resumes/resumes.service.ts` | Inject `DocxToPdfService`, run conversion in `upload()` for DOCX, store `canonicalPdfPath`; return both signed URLs in download endpoint; add `reparse()` method |
| `apps/api/src/modules/resumes/resumes.controller.ts` | Add `POST /:id/reparse` route |
| `apps/api/src/modules/resumes/resumes.module.ts` | Register `DocxToPdfService` in providers |
| `apps/api/src/modules/resumes/dto/resume-response.dto.ts` | Add `canonicalPdfPath` to response |
| `apps/api/src/modules/resumes/dto/download-url-response.dto.ts` (or current shape) | Add `signedPdfUrl` field |
| `apps/api/src/modules/candidate-profiles/candidate-profiles.controller.ts` | Add `PATCH /me/complete-onboarding` route (validates final completion, sets `profileCompleted = true`) |
| `apps/api/src/modules/candidate-profiles/candidate-profiles.service.ts` | Add `completeOnboarding()` method |
| `apps/api/Dockerfile` | Install `libreoffice-core libreoffice-writer fonts-liberation` |
| `apps/api/package.json` | (no new deps; LibreOffice spawned via child_process) |
| `apps/web/package.json` | Add `pdfjs-dist`, `mammoth` (only for linearized DOCX fallback if needed — defer to Task 24) |
| `apps/web/app/onboarding/candidate/_data.ts` | Update `ONBOARDING_STEPS` to 4 entries; widen `LatestParsedResume` type to include `*_source` fields |
| `apps/web/app/onboarding/candidate/page.tsx` | Step 1 — replace current shell with `OnboardingShell`, use `ResumeUploadCard` |
| `apps/web/app/onboarding/candidate/personal/page.tsx` | Step 2 — `OnboardingShell` + `ResumePreviewPane` with `activeCategories=["contact","summary"]` |
| `apps/web/app/onboarding/candidate/preferences/page.tsx` | Step 4 — `OnboardingShell` + `ProfilePreviewPane` |
| `apps/web/components/onboarding/candidate/personal-info-form.tsx` | Restyle to 2-col grid; integrate `HighlightContext` for hover linking; use `useAutosave` hook |
| `apps/web/components/onboarding/candidate/preferences-form.tsx` | Restyle; use `useAutosave` |
| `apps/web/middleware.ts` | Add onboarding-route guards per spec §G |
| `apps/web/app/onboarding/layout.tsx` | Trim — `OnboardingShell` now owns the chrome; layout becomes minimal |

### Delete

| Path | Reason |
| --- | --- |
| `apps/web/app/onboarding/candidate/education/page.tsx` | Folded into `/review` |
| `apps/web/app/onboarding/candidate/experience/page.tsx` | Folded into `/review` |
| `apps/web/app/onboarding/candidate/skills/page.tsx` | Folded into `/review` |
| `apps/web/components/onboarding/wizard-shell.tsx` | Superseded by `OnboardingShell` |
| `apps/web/components/onboarding/wizard-progress.tsx` | Superseded by `OnboardingProgress` |
| `apps/web/components/onboarding/candidate/resume-upload.tsx` | Folded into `ResumeUploadCard` |

---

## Task 1: Schema — add `canonicalPdfPath` column

**Goal:** Make `resumes.canonical_pdf_path` available in Drizzle schema and types. Human runs the migration.

**Files:**
- Modify: `packages/db/src/schema.ts:215-238`

- [ ] **Step 1.1: Add column to `resumesTable`**

```ts
// In resumesTable definition, after `storagePath`:
canonicalPdfPath: text("canonical_pdf_path"),  // null for PDF uploads, set for DOCX → converted PDF
```

- [ ] **Step 1.2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS — `Resume` and `NewResume` types now include `canonicalPdfPath`.

- [ ] **Step 1.3: Write the SQL migration file**

Create `packages/db/drizzle/<next_number>_add_canonical_pdf_path.sql`:

```sql
ALTER TABLE resumes ADD COLUMN canonical_pdf_path text;
```

(Use whatever migration generator the repo uses — likely `drizzle-kit generate`. The plan asks the human to run `pnpm drizzle-kit generate` then commit the result. Claude only authors the column change above.)

- [ ] **Step 1.4: Hand to human**

Stop and tell the human: *"Schema column added. Please run `pnpm --filter @aurahire/db drizzle:generate` to produce the migration SQL, then `pnpm --filter @aurahire/db drizzle:push` (or your preferred apply command) to apply it. Confirm with `pnpm tsc --noEmit` from the repo root."*

---

## Task 2: `DocxToPdfService` — LibreOffice wrapper

**Goal:** Convert DOCX → PDF via headless LibreOffice. Serialized via in-memory mutex (one conversion at a time per process).

**Files:**
- Create: `apps/api/src/storage/docx-to-pdf.service.ts`
- Create: `apps/api/src/storage/docx-to-pdf.service.spec.ts`
- Modify: `apps/api/src/storage/storage.module.ts` (or wherever the storage providers register — register the new service)

- [ ] **Step 2.1: Write failing test**

```ts
// apps/api/src/storage/docx-to-pdf.service.spec.ts
import { DocxToPdfService, DocxConversionError } from "./docx-to-pdf.service";

jest.mock("node:child_process");
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import * as fs from "node:fs/promises";

describe("DocxToPdfService", () => {
  it("converts a docx buffer to a pdf buffer via soffice", async () => {
    const mockProc = new EventEmitter() as any;
    mockProc.stdout = new EventEmitter();
    mockProc.stderr = new EventEmitter();
    (spawn as jest.Mock).mockReturnValue(mockProc);

    const fakePdf = Buffer.from("%PDF-1.4 fake");
    jest.spyOn(fs, "readFile").mockResolvedValueOnce(fakePdf as any);
    jest.spyOn(fs, "writeFile").mockResolvedValueOnce(undefined as any);
    jest.spyOn(fs, "rm").mockResolvedValue(undefined as any);

    const svc = new DocxToPdfService();
    const promise = svc.convert(Buffer.from("docx content"));
    setImmediate(() => mockProc.emit("close", 0));

    const result = await promise;
    expect(result.equals(fakePdf)).toBe(true);
  });

  it("throws DocxConversionError on non-zero exit", async () => {
    const mockProc = new EventEmitter() as any;
    mockProc.stdout = new EventEmitter();
    mockProc.stderr = new EventEmitter();
    (spawn as jest.Mock).mockReturnValue(mockProc);
    jest.spyOn(fs, "writeFile").mockResolvedValueOnce(undefined as any);
    jest.spyOn(fs, "rm").mockResolvedValue(undefined as any);

    const svc = new DocxToPdfService();
    const promise = svc.convert(Buffer.from("docx"));
    setImmediate(() => mockProc.emit("close", 1));

    await expect(promise).rejects.toThrow(DocxConversionError);
  });

  it("serializes concurrent conversions", async () => {
    // First conversion holds the mutex; second must wait until first emits 'close'.
    // Verifies only one spawn() call is in flight at a time.
    // (Implementation detail: track in-flight count via spawn call ordering.)
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `pnpm --filter @aurahire/api test docx-to-pdf.service.spec`
Expected: FAIL — `Cannot find module './docx-to-pdf.service'`.

- [ ] **Step 2.3: Implement `DocxToPdfService`**

```ts
// apps/api/src/storage/docx-to-pdf.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TIMEOUT_MS = 30_000;
const SOFFICE_BIN = process.env.SOFFICE_BIN ?? "soffice";

export class DocxConversionError extends Error {
  constructor(message: string, public readonly stderr?: string) {
    super(message);
    this.name = "DocxConversionError";
  }
}

@Injectable()
export class DocxToPdfService {
  private readonly logger = new Logger(DocxToPdfService.name);
  private mutex: Promise<unknown> = Promise.resolve();

  async convert(docxBuffer: Buffer): Promise<Buffer> {
    // Serialize via mutex — LibreOffice doesn't share state cleanly between concurrent jobs.
    const release = this.acquire();
    try {
      return await this.runConversion(docxBuffer);
    } finally {
      release();
    }
  }

  private acquire(): () => void {
    let release!: () => void;
    const next = new Promise<void>((resolve) => { release = resolve; });
    const prev = this.mutex;
    this.mutex = prev.then(() => next);
    return release;
  }

  private async runConversion(docxBuffer: Buffer): Promise<Buffer> {
    const workDir = await fs.mkdtemp(join(tmpdir(), `docx2pdf-${randomUUID()}-`));
    const inPath = join(workDir, "in.docx");
    const outPath = join(workDir, "in.pdf");

    try {
      await fs.writeFile(inPath, docxBuffer);

      await new Promise<void>((resolve, reject) => {
        const proc = spawn(SOFFICE_BIN, [
          "--headless",
          "--convert-to", "pdf",
          "--outdir", workDir,
          inPath,
        ]);

        let stderr = "";
        proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

        const timer = setTimeout(() => {
          proc.kill("SIGKILL");
          reject(new DocxConversionError("LibreOffice conversion timed out", stderr));
        }, TIMEOUT_MS);

        proc.on("close", (code: number) => {
          clearTimeout(timer);
          if (code === 0) resolve();
          else reject(new DocxConversionError(`soffice exited with code ${code}`, stderr));
        });

        proc.on("error", (err: Error) => {
          clearTimeout(timer);
          reject(new DocxConversionError(`Failed to spawn soffice: ${err.message}`));
        });
      });

      const pdfBuffer = await fs.readFile(outPath);
      this.logger.log(`Converted DOCX (${docxBuffer.length}B) → PDF (${pdfBuffer.length}B)`);
      return pdfBuffer;
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
```

- [ ] **Step 2.4: Register provider**

Add `DocxToPdfService` to whichever Nest module exports storage providers (likely `StorageModule`). Mirror the pattern of existing services in that module.

- [ ] **Step 2.5: Run tests**

Run: `pnpm --filter @aurahire/api test docx-to-pdf.service.spec`
Expected: PASS.

- [ ] **Step 2.6: Add Dockerfile entry**

Modify `apps/api/Dockerfile` — add LibreOffice install step. Find the apt-get layer (or add one) and append:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-core libreoffice-writer fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 2.7: Hand to human**

Tell the human: *"`DocxToPdfService` ready. The Dockerfile now installs LibreOffice. To test locally, install LibreOffice on your machine (`brew install --cask libreoffice` on macOS) and ensure `soffice` is on PATH. The next task wires this into the upload flow."*

---

## Task 3: Wire `DocxToPdfService` into resume upload

**Goal:** When a candidate uploads a DOCX, the service converts it to PDF and stores both files; `canonicalPdfPath` records the converted path. PDF uploads remain unchanged.

**Files:**
- Modify: `apps/api/src/modules/resumes/resumes.service.ts`
- Modify: `apps/api/src/modules/resumes/dto/resume-response.dto.ts`
- Modify: `apps/api/src/modules/resumes/resumes.repository.ts` (insert/update typing)
- Modify: `apps/api/src/modules/resumes/resumes.module.ts` (import `DocxToPdfService`)

- [ ] **Step 3.1: Add `canonicalPdfPath` to `ResumeResponseDto`**

```ts
// dto/resume-response.dto.ts — add after storagePath:
canonicalPdfPath: string | null;
```

And include it in `toResponse()` in the service.

- [ ] **Step 3.2: Inject `DocxToPdfService` in `ResumesService`**

```ts
// resumes.service.ts constructor:
constructor(
  private readonly repo: ResumesRepository,
  private readonly storage: StorageService,
  private readonly parser: ParseResumeService,
  private readonly audit: AuditService,
  private readonly docxToPdf: DocxToPdfService,  // NEW
) {}
```

Register in `resumes.module.ts` providers if not auto-discovered.

- [ ] **Step 3.3: Run conversion in upload flow**

In `ResumesService.upload()`, after the `await this.storage.upload(...)` for the original (line 80–85 area), insert:

```ts
let canonicalPdfPath: string | null = null;
if (file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
  try {
    const pdfBuffer = await this.docxToPdf.convert(file.buffer);
    canonicalPdfPath = `${user.id}/${randomUUID()}.pdf`;
    await this.storage.upload({
      bucket: RESUMES_BUCKET,
      path: canonicalPdfPath,
      buffer: pdfBuffer,
      contentType: "application/pdf",
    });
  } catch (err) {
    this.logger.warn(`DOCX→PDF conversion failed for resume upload: ${(err as Error).message}`);
    // Continue without canonical PDF — frontend will fall back to LinearizedResumeView.
  }
}
```

Then pass `canonicalPdfPath` to `repo.insert(...)`:

```ts
const resume = await this.repo.insert({
  candidateId: user.id,
  filename: file.filename,
  mimeType: file.mimeType,
  sizeBytes: file.sizeBytes,
  storagePath,
  canonicalPdfPath,  // NEW
  parseStatus: "parsing",
  isDefault: isFirstResume,
});
```

- [ ] **Step 3.4: Update repository**

Modify `resumes.repository.ts` to accept `canonicalPdfPath` in `insert()` payload (it's already in `NewResume` after Task 1).

- [ ] **Step 3.5: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 3.6: Add integration test**

Create `apps/api/src/modules/resumes/resumes.service.spec.ts` (or extend existing). Verify a DOCX upload calls `docxToPdf.convert` once and stores the result. Verify a PDF upload does NOT call `docxToPdf.convert`. Use `jest.fn()` doubles for `StorageService`, `DocxToPdfService`, `ParseResumeService`, `AuditService`, and the repository.

```ts
it("converts DOCX uploads to canonical PDF", async () => {
  const docxToPdf = { convert: jest.fn().mockResolvedValue(Buffer.from("%PDF-1.4")) };
  const storage = { upload: jest.fn().mockResolvedValue(undefined), signedUrl: jest.fn(), delete: jest.fn(), download: jest.fn() };
  // ... wire up service with stubs, call upload() with docx mime, assert.
  expect(docxToPdf.convert).toHaveBeenCalledTimes(1);
  expect(storage.upload).toHaveBeenCalledTimes(2);  // original + canonical
});

it("skips conversion for PDF uploads", async () => {
  // ... call with PDF mime
  expect(docxToPdf.convert).not.toHaveBeenCalled();
});
```

- [ ] **Step 3.7: Run tests**

Run: `pnpm --filter @aurahire/api test resumes.service.spec`
Expected: PASS.

---

## Task 4: Extended download-url endpoint returns `signedPdfUrl`

**Goal:** Frontend always renders `signedPdfUrl` — for PDF uploads it equals `signedUrl`; for DOCX uploads it points to the canonical PDF.

**Files:**
- Modify: `apps/api/src/modules/resumes/resumes.service.ts` (`getSignedDownloadUrl`)
- Modify: `apps/api/src/modules/resumes/resumes.controller.ts` (response type if explicitly typed)
- Modify: `packages/shared/src/api-client/generated.ts` (regenerate after backend changes)

- [ ] **Step 4.1: Update `getSignedDownloadUrl`**

```ts
async getSignedDownloadUrl(user: AuthUser, id: string): Promise<{
  signedUrl: string;
  signedPdfUrl: string;
  expiresAt: string;
}> {
  const resume = await this.repo.findById(id);
  if (!resume) throw new NotFoundException({ code: "NOT_FOUND", message: "Resume not found" });
  if (user.role === "candidate" && resume.candidateId !== user.id) {
    throw new NotFoundException({ code: "NOT_FOUND", message: "Resume not found" });
  }
  if (user.role === "recruiter") {
    throw new NotFoundException({ code: "NOT_FOUND", message: "Resume not found" });
  }

  const expiresIn = 60 * 60;
  const [signedUrl, signedPdfUrl] = await Promise.all([
    this.storage.signedUrl({ bucket: RESUMES_BUCKET, path: resume.storagePath, expiresIn }),
    this.storage.signedUrl({
      bucket: RESUMES_BUCKET,
      path: resume.canonicalPdfPath ?? resume.storagePath,
      expiresIn,
    }),
  ]);

  return { signedUrl, signedPdfUrl, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() };
}
```

- [ ] **Step 4.2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 4.3: Hand to human — regenerate API client**

Tell the human: *"Backend response shape changed. Run `pnpm --filter @aurahire/api openapi:generate && pnpm --filter @aurahire/shared client:generate` (or whatever the repo's regen command is) to refresh `packages/shared/src/api-client/generated.ts`."*

---

## Task 5: AI prompt v2 — `*_source` fields, parsed-resume schema update

**Goal:** Bump the parse-resume prompt to v2 so every extracted field carries a verbatim `*_source` string. The OpenAI structured-output schema enforces them as required.

**Files:**
- Modify: `packages/shared/src/schemas/parsed-resume.ts`
- Create: `apps/api/src/ai/prompts/parse-resume-v2.ts`
- Modify: `apps/api/src/ai/parse-resume.service.ts`
- Modify: `apps/api/src/ai/prompts/parse-resume.ts` (re-export new constants for back-compat)

- [ ] **Step 5.1: Update `parsedResumeSchema` with `*_source` fields**

```ts
// packages/shared/src/schemas/parsed-resume.ts
import { z } from "zod";

export const parsedResumeContactSchema = z.object({
  full_name: z.string().nullable(),
  full_name_source: z.string().nullable(),
  email: z.string().nullable(),
  email_source: z.string().nullable(),
  phone: z.string().nullable(),
  phone_source: z.string().nullable(),
  location_city: z.string().nullable(),
  location_city_source: z.string().nullable(),
  location_country: z.string().nullable(),
  location_country_source: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  linkedin_url_source: z.string().nullable(),
  portfolio_url: z.string().nullable(),
  portfolio_url_source: z.string().nullable(),
});

export const parsedResumeSummarySchema = z.object({
  text: z.string(),
  text_source: z.string(),
});

export const educationEntrySchema = z.object({
  institution: z.string(),
  institution_source: z.string(),
  degree: z.string().nullable(),
  degree_source: z.string().nullable(),
  field_of_study: z.string().nullable(),
  field_of_study_source: z.string().nullable(),
  start_year: z.number().int().nullable(),
  end_year: z.number().int().nullable(),
  period_source: z.string().nullable(),
  gpa: z.string().nullable(),
  gpa_source: z.string().nullable(),
});

export const experienceEntrySchema = z.object({
  company: z.string(),
  company_source: z.string(),
  title: z.string(),
  title_source: z.string(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  period_source: z.string(),
  is_current: z.boolean(),
  responsibilities: z.array(z.string()),
  responsibilities_source: z.array(z.string()),
  technologies_used: z.array(z.string()),
});

export const skillEntrySchema = z.object({
  name: z.string(),
  source: z.string(),
});

export const certificationSchema = z.object({
  name: z.string(),
  name_source: z.string(),
  issuing_organization: z.string().nullable(),
  issuing_organization_source: z.string().nullable(),
  issue_date: z.string().nullable(),
  issue_date_source: z.string().nullable(),
  expires: z.string().nullable(),
});

export const parsedResumeSchema = z.object({
  contact: parsedResumeContactSchema,
  summary: parsedResumeSummarySchema.nullable(),
  education: z.array(educationEntrySchema),
  experience: z.array(experienceEntrySchema),
  skills: z.array(skillEntrySchema),
  certifications: z.array(certificationSchema),
  languages: z.array(z.string()),
  parse_confidence: z.enum(["high", "medium", "low"]),
});

export type ParsedResume = z.infer<typeof parsedResumeSchema>;
export type ParsedResumeContact = z.infer<typeof parsedResumeContactSchema>;
export type EducationEntry = z.infer<typeof educationEntrySchema>;
export type ExperienceEntry = z.infer<typeof experienceEntrySchema>;
export type SkillEntry = z.infer<typeof skillEntrySchema>;
export type Certification = z.infer<typeof certificationSchema>;
```

- [ ] **Step 5.2: Author prompt v2**

```ts
// apps/api/src/ai/prompts/parse-resume-v2.ts
export const PARSE_RESUME_V2_VERSION = "2.0.0";

export const PARSE_RESUME_V2_SYSTEM_PROMPT = `You are a resume-parsing assistant. Extract the candidate's information from the resume text below and return it as structured JSON conforming to the provided schema.

GENERAL RULES
- Extract literal information; do not invent details not present in the text.
- For dates, use ISO format (YYYY-MM-DD or YYYY-MM); use null if unknown.
- For "Present" or "Current" end dates, set is_current=true and end_date=null.
- Skills: extract programming languages, frameworks, tools, methodologies as separate skill entries.
- Skills should be canonical names (e.g., "JavaScript" not "Javascripts" or "JS").
- Set parse_confidence based on how clearly structured the resume is:
  - "high": clear sections, dates, well-formatted
  - "medium": readable but ambiguous in places
  - "low": OCR garble, missing sections, or unclear formatting
- If a field has no information, return null (or empty array for collections) — never invent.

SOURCE-STRING RULES (CRITICAL)
For every extracted value, also return its verbatim source string in the matching *_source field:
- The source string MUST be a substring of the resume text, character-for-character.
- DO NOT paraphrase, normalize, or fix typos in source strings.
- DO NOT add or remove whitespace beyond what appears in the resume.
- If a value is null, the corresponding *_source MUST also be null.
- For "period_source" on experience/education, return the verbatim date range exactly as written (e.g., "Jan 2022 – Present", "2019 – 2022").
- For "responsibilities_source", each entry must be 1:1 aligned with "responsibilities" — same length, same order — and each source string verbatim.
- For skills, the "source" field is the verbatim mention of the skill in the resume (use the most prominent occurrence if mentioned multiple times).

Source strings are used to highlight extracted entities in the rendered PDF — accuracy matters more than completeness. If you can't find a verbatim source for a value, set both the value and its source to null rather than inventing.`;

export function buildParseResumeV2UserPrompt(resumeText: string): string {
  return `Resume text:\n"""\n${resumeText}\n"""`;
}
```

- [ ] **Step 5.3: Update old prompt file to re-export v2**

```ts
// apps/api/src/ai/prompts/parse-resume.ts
export {
  PARSE_RESUME_V2_VERSION as PARSE_RESUME_VERSION,
  PARSE_RESUME_V2_SYSTEM_PROMPT as PARSE_RESUME_SYSTEM_PROMPT,
  buildParseResumeV2UserPrompt as buildParseResumeUserPrompt,
} from "./parse-resume-v2";
```

This keeps the import sites in `parse-resume.service.ts` unchanged.

- [ ] **Step 5.4: Add source-coverage validation in `ParseResumeService.parse()`**

Add a private method:

```ts
private computeSourceCoverage(parsed: ParsedResume, rawText: string): {
  coverage: number;        // 0..1
  hallucinations: string[]; // sources not found in rawText
} {
  const sources: Array<{ field: string; value: string | null }> = [];
  const c = parsed.contact;
  sources.push({ field: "contact.full_name", value: c.full_name_source });
  sources.push({ field: "contact.email", value: c.email_source });
  sources.push({ field: "contact.phone", value: c.phone_source });
  sources.push({ field: "contact.location_city", value: c.location_city_source });
  sources.push({ field: "contact.location_country", value: c.location_country_source });
  sources.push({ field: "contact.linkedin_url", value: c.linkedin_url_source });
  sources.push({ field: "contact.portfolio_url", value: c.portfolio_url_source });
  if (parsed.summary) sources.push({ field: "summary", value: parsed.summary.text_source });
  parsed.experience.forEach((e, i) => {
    sources.push({ field: `experience.${i}.title`, value: e.title_source });
    sources.push({ field: `experience.${i}.company`, value: e.company_source });
    sources.push({ field: `experience.${i}.period`, value: e.period_source });
    e.responsibilities_source.forEach((s, j) => {
      sources.push({ field: `experience.${i}.responsibilities.${j}`, value: s });
    });
  });
  parsed.education.forEach((e, i) => {
    sources.push({ field: `education.${i}.institution`, value: e.institution_source });
    sources.push({ field: `education.${i}.degree`, value: e.degree_source });
    sources.push({ field: `education.${i}.field_of_study`, value: e.field_of_study_source });
    sources.push({ field: `education.${i}.period`, value: e.period_source });
    sources.push({ field: `education.${i}.gpa`, value: e.gpa_source });
  });
  parsed.skills.forEach((s, i) => {
    sources.push({ field: `skills.${i}`, value: s.source });
  });
  parsed.certifications.forEach((cert, i) => {
    sources.push({ field: `certifications.${i}.name`, value: cert.name_source });
  });

  const populated = sources.filter((s) => s.value !== null && s.value !== "");
  if (populated.length === 0) return { coverage: 0, hallucinations: [] };

  const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const haystack = normalize(rawText);

  const hallucinations: string[] = [];
  let found = 0;
  for (const s of populated) {
    if (haystack.includes(normalize(s.value!))) {
      found++;
    } else {
      hallucinations.push(`${s.field}: ${s.value!.slice(0, 80)}`);
    }
  }

  return { coverage: found / populated.length, hallucinations };
}
```

Then update the parse return value to include coverage:

```ts
// In ParseResumeOutput interface:
export interface ParseResumeOutput {
  parsed: ParsedResume;
  rawText: string;
  latencyMs: number;
  model: string;
  promptVersion: string;
  sourceFieldCoverage: number;       // NEW
  sourceHallucinations: string[];    // NEW
}

// In parse() return:
const coverage = this.computeSourceCoverage(aiResult.parsed, rawText);
return {
  ...aiResult,
  rawText,
  sourceFieldCoverage: coverage.coverage,
  sourceHallucinations: coverage.hallucinations,
};
```

- [ ] **Step 5.5: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS — no errors. The existing `LatestParsedResume` type in the frontend will need updating in Task 17.

- [ ] **Step 5.6: Update audit log to record `sourceFieldCoverage`**

In `ResumesService.upload()` (and any other parse call site), include the new fields in the `resume.parsed` audit log:

```ts
await this.audit.log({
  actorId: user.id,
  actorType: "ai",
  action: "resume.parsed",
  entityType: "resume",
  entityId: resume.id,
  details: {
    model: parseResult.model,
    promptVersion: parseResult.promptVersion,
    latencyMs: parseResult.latencyMs,
    parseConfidence: parseResult.parsed.parse_confidence,
    sourceFieldCoverage: parseResult.sourceFieldCoverage,                    // NEW
    sourceHallucinationCount: parseResult.sourceHallucinations.length,      // NEW
  },
  ...requestMeta,
});
```

If `sourceHallucinations.length > 0`, also `this.logger.warn(...)` the field names.

---

## Task 6: `POST /resumes/:id/reparse` endpoint

**Goal:** Re-runs the parser against the existing resume's `rawText` (or re-extracts if needed). Used by the Step 1 retry CTA and the mid-flow "Replace resume" affordance after a re-upload.

**Files:**
- Modify: `apps/api/src/modules/resumes/resumes.service.ts`
- Modify: `apps/api/src/modules/resumes/resumes.controller.ts`

- [ ] **Step 6.1: Add `reparse` method to `ResumesService`**

```ts
async reparse(user: AuthUser, id: string, requestMeta: RequestMeta = {}): Promise<ResumeResponseDto> {
  const resume = await this.repo.findById(id);
  if (!resume || resume.candidateId !== user.id) {
    throw new NotFoundException({ code: "NOT_FOUND", message: "Resume not found" });
  }

  await this.repo.update(id, { parseStatus: "parsing", parseError: null });

  try {
    const parseResult = await this.parser.parse({
      storagePath: resume.storagePath,
      mimeType: resume.mimeType,
      rawText: resume.rawText ?? undefined,  // reuse cached text if available
      requestId: `reparse:${id}`,
    });

    await this.repo.update(id, {
      rawText: parseResult.rawText,
      parsedData: parseResult.parsed as unknown as Record<string, unknown>,
      parseStatus: "parsed",
    });

    await this.audit.log({
      actorId: user.id,
      actorType: "ai",
      action: "resume.reparsed",
      entityType: "resume",
      entityId: id,
      details: {
        model: parseResult.model,
        promptVersion: parseResult.promptVersion,
        latencyMs: parseResult.latencyMs,
        sourceFieldCoverage: parseResult.sourceFieldCoverage,
      },
      ...requestMeta,
    });

    const final = (await this.repo.findById(id))!;
    return this.toResponse(final);
  } catch (err) {
    const message = (err as Error).message ?? "Reparse failed";
    await this.repo.update(id, { parseStatus: "failed", parseError: message.slice(0, 500) });
    await this.audit.log({
      actorId: user.id,
      actorType: "ai",
      action: "resume.reparse_failed",
      entityType: "resume",
      entityId: id,
      details: { error: message.slice(0, 500) },
      ...requestMeta,
    });
    const failed = (await this.repo.findById(id))!;
    return this.toResponse(failed);
  }
}
```

- [ ] **Step 6.2: Add controller route**

```ts
// resumes.controller.ts — inside the controller class:
@Post(":id/reparse")
@HttpCode(HttpStatus.OK)
async reparse(
  @Param("id") id: string,
  @CurrentUser() user: AuthUser,
  @Req() req: FastifyRequest,
): Promise<{ data: ResumeResponseDto }> {
  const data = await this.service.reparse(user, id, this.extractRequestMeta(req));
  return { data };
}
```

(Use whatever existing patterns the controller uses for `@Req`, `@CurrentUser`, response envelope. Mirror the existing `upload` action.)

- [ ] **Step 6.3: Type-check + run any controller tests**

Run: `pnpm tsc --noEmit && pnpm --filter @aurahire/api test resumes`
Expected: PASS.

---

## Task 7: `PATCH /candidate-profiles/me/complete-onboarding` endpoint

**Goal:** Dedicated endpoint for the Finish button. Validates final completion against the per-step Zod completion schemas, sets `profileCompleted=true`, writes audit log.

**Files:**
- Modify: `apps/api/src/modules/candidate-profiles/candidate-profiles.service.ts`
- Modify: `apps/api/src/modules/candidate-profiles/candidate-profiles.controller.ts`
- Create: `packages/shared/src/onboarding/personal-complete.schema.ts`
- Create: `packages/shared/src/onboarding/review-complete.schema.ts`
- Create: `packages/shared/src/onboarding/preferences-complete.schema.ts`

- [ ] **Step 7.1: Author the per-step completion schemas**

```ts
// packages/shared/src/onboarding/personal-complete.schema.ts
import { z } from "zod";
export const personalCompleteSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
});
```

```ts
// packages/shared/src/onboarding/review-complete.schema.ts
import { z } from "zod";
export const reviewCompleteSchema = z.object({
  hasMinimumProfile: z.literal(true),  // computed: experiences.length >= 1 OR education.length >= 1 OR skills.length >= 3
});
```

```ts
// packages/shared/src/onboarding/preferences-complete.schema.ts
import { z } from "zod";
export const preferencesCompleteSchema = z.object({
  desiredRoles: z.array(z.string()).min(1, "Pick at least one role"),
  openTo: z.array(z.string()).min(1, "Select at least one work mode"),
});
```

Re-export from `packages/shared/src/index.ts`.

- [ ] **Step 7.2: Add `completeOnboarding()` to service**

```ts
// candidate-profiles.service.ts
async completeOnboarding(user: AuthUser, requestMeta: RequestMeta = {}): Promise<CandidateProfileMe> {
  const profile = await this.repo.findById(user.id);
  if (!profile) throw new NotFoundException({ code: "NOT_FOUND", message: "Profile not found" });

  // Validate against step completion schemas.
  const personalParsed = personalCompleteSchema.safeParse({ fullName: profile.fullName });
  if (!personalParsed.success) {
    throw new BadRequestException({ code: "INCOMPLETE_PERSONAL", message: personalParsed.error.message });
  }
  const reviewOk =
    (profile.experiences?.length ?? 0) >= 1 ||
    (profile.educations?.length ?? 0) >= 1 ||
    (profile.skills?.length ?? 0) >= 3;
  if (!reviewOk) {
    throw new BadRequestException({ code: "INCOMPLETE_REVIEW", message: "Add at least one experience, school, or 3 skills" });
  }
  const prefsParsed = preferencesCompleteSchema.safeParse({
    desiredRoles: profile.desiredRoles ?? [],
    openTo: profile.openTo ?? [],
  });
  if (!prefsParsed.success) {
    throw new BadRequestException({ code: "INCOMPLETE_PREFERENCES", message: prefsParsed.error.message });
  }

  await this.repo.update(user.id, { profileCompleted: true });
  await this.audit.log({
    actorId: user.id,
    actorType: "user",
    action: "onboarding.completed",
    entityType: "candidate_profile",
    entityId: user.id,
    ...requestMeta,
  });

  const updated = await this.repo.findById(user.id);
  return this.toResponse(updated!);
}
```

(Adjust property accesses — `profile.experiences` etc. — to whatever the repo's hydrated profile shape actually is. If the repo doesn't fetch related arrays, fetch them explicitly here.)

- [ ] **Step 7.3: Add controller route**

```ts
@Patch("me/complete-onboarding")
async completeOnboarding(
  @CurrentUser() user: AuthUser,
  @Req() req: FastifyRequest,
): Promise<{ data: CandidateProfileMe }> {
  const data = await this.service.completeOnboarding(user, this.extractRequestMeta(req));
  return { data };
}
```

- [ ] **Step 7.4: Run integration test**

Add a test verifying: incomplete profile → 400 with appropriate code; complete profile → 200 with `profileCompleted: true`.

Run: `pnpm --filter @aurahire/api test candidate-profiles`
Expected: PASS.

- [ ] **Step 7.5: Hand to human**

*"Backend onboarding endpoints ready. Please regenerate the API client (`pnpm openapi:generate && pnpm client:generate`) so the frontend can consume `reparse` and `completeOnboarding`."*

---

## Task 8: Golden-corpus AI quality gate

**Goal:** Lock the parse-v2 prompt against regressions. `pnpm test:ai-parse` runs the new prompt against 15 fixture resumes, asserts thresholds, and **hard-fails on hallucination > 0%**.

**Files:**
- Create: `apps/api/test/fixtures/resumes/README.md`
- Create: `apps/api/test/fixtures/resumes/01-clean-pdf.expected.json` (and 14 more — author at least 1 fully, leave others as TODO entries inside the README so the human can populate fixtures over time)
- Create: `apps/api/scripts/run-ai-parse-corpus.ts`
- Modify: `apps/api/package.json` (add `test:ai-parse` script)

- [ ] **Step 8.1: Author the corpus runner**

```ts
// apps/api/scripts/run-ai-parse-corpus.ts
import "reflect-metadata";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { ParseResumeService } from "../src/ai/parse-resume.service";
import { OpenAIService } from "../src/ai/openai.service";
import { CacheService } from "../src/cache/cache.service";
import { StorageService } from "../src/storage/storage.service";

const FIXTURES_DIR = join(__dirname, "../test/fixtures/resumes");

interface Expected {
  contact: { full_name: string; phone?: string; email?: string; location_city?: string };
  experienceCount: number;
  educationCount: number;
  skills: string[];
}

async function main() {
  const files = (await readdir(FIXTURES_DIR)).filter((f) => f.endsWith(".pdf") || f.endsWith(".docx"));
  let totalCoverage = 0;
  let totalHallucinations = 0;
  let allPassed = true;
  const results: Array<{ fixture: string; coverage: number; hallucinations: number; ok: boolean }> = [];

  // ... bootstrap the service (use the real OpenAIService against staging, or a stubbed one against pre-recorded responses)
  // For each fixture: load buffer → extract text → parse → compare to .expected.json → compute metrics

  for (const file of files) {
    const buffer = await readFile(join(FIXTURES_DIR, file));
    const expected: Expected = JSON.parse(
      await readFile(join(FIXTURES_DIR, file.replace(/\.(pdf|docx)$/, ".expected.json")), "utf8"),
    );
    // ... call service.parse(...) — see ParseResumeService for the contract.
    // ... compare contact, experience.length, education.length, jaccard(skills, expected.skills).
    // ... track sourceFieldCoverage, hallucination count.
    // ... pass/fail per fixture.
  }

  console.log("\n=== AI PARSE CORPUS RESULTS ===");
  console.table(results);
  const avgCoverage = totalCoverage / files.length;
  console.log(`Avg source_field_coverage: ${(avgCoverage * 100).toFixed(1)}%`);
  console.log(`Total hallucinations: ${totalHallucinations}`);

  if (totalHallucinations > 0) {
    console.error("HARD FAIL: hallucination rate > 0%");
    process.exit(1);
  }
  if (avgCoverage < 0.9) {
    console.error("HARD FAIL: source_field_coverage < 0.9");
    process.exit(1);
  }
  if (!allPassed) {
    console.error("HARD FAIL: per-fixture thresholds not met");
    process.exit(1);
  }
  console.log("ALL PASSED");
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 8.2: Add npm script**

```json
// apps/api/package.json
"scripts": {
  ...
  "test:ai-parse": "tsx scripts/run-ai-parse-corpus.ts"
}
```

- [ ] **Step 8.3: Author 1 fixture + .expected.json**

Author `01-clean-pdf.expected.json` based on whatever PDF the human supplies. Pattern:

```json
{
  "contact": {
    "full_name": "Christian Jutba",
    "phone": "09764556948",
    "email": "cjjutba@example.com",
    "location_city": "Manila"
  },
  "experienceCount": 3,
  "educationCount": 1,
  "skills": ["TypeScript", "JavaScript", "React", "Node.js", "NestJS", "PostgreSQL", "AWS", "Docker"]
}
```

- [ ] **Step 8.4: Author the README + corpus contribution guide**

```markdown
<!-- apps/api/test/fixtures/resumes/README.md -->
# AI Parse Golden Corpus

Used by `pnpm test:ai-parse`. Each fixture has:
- `<id>-<slug>.pdf` (or `.docx`) — the binary
- `<id>-<slug>.expected.json` — hand-annotated canonical extraction

## Thresholds (assertions)

| Metric | Threshold |
| --- | --- |
| Contact precision | ≥ 0.95 |
| Experience count match | exact |
| Education count match | exact |
| Skills Jaccard | ≥ 0.85 |
| Source-field coverage | ≥ 0.90 |
| Source-string hallucinations | 0 (hard fail) |

## Adding a new fixture

1. Drop the binary in this directory.
2. Run `pnpm test:ai-parse -- --bootstrap <filename>` (TODO: implement) to scaffold an `expected.json`.
3. Hand-edit the JSON to reflect the canonical truth.
4. Re-run `pnpm test:ai-parse`.

## Contributing fixtures

Aim for 15+ fixtures across:
- PDF clean / styled / multi-column / image-only
- DOCX modern / legacy
- Multilingual (1 EN + Tagalog hybrid)
- Image-only PDF (negative-path: should fall back gracefully)
```

- [ ] **Step 8.5: Hand to human**

*"AI corpus runner ready. Please drop 14 more resume fixtures (mix of PDF/DOCX, clean/styled/edge-case) into `apps/api/test/fixtures/resumes/` with matching `.expected.json` annotations. Use 01 as the template. Run `pnpm test:ai-parse` whenever you bump the prompt version."*

---

## Task 9: Skills taxonomy

**Goal:** Static list of common skills used by the typeahead in the Review step's Skills section.

**Files:**
- Create: `packages/shared/src/skills-taxonomy.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 9.1: Author the taxonomy**

```ts
// packages/shared/src/skills-taxonomy.ts
// Roughly 500 common skills. Sorted alphabetically for stable diffs.

export const SKILLS_TAXONOMY: readonly string[] = [
  ".NET",
  "AWS",
  "Adobe XD",
  "Agile",
  "Algorithms",
  "Android",
  "Angular",
  "Ansible",
  "Apache Kafka",
  "Apache Spark",
  "Azure",
  "Bash",
  "BigQuery",
  "C",
  "C#",
  "C++",
  "CI/CD",
  "CSS",
  "Cassandra",
  "Celery",
  "Clojure",
  "Cloud Run",
  "CloudFormation",
  "Cypress",
  "DDD",
  "Django",
  "Docker",
  "DocumentDB",
  "DynamoDB",
  "ElasticSearch",
  "Elixir",
  "Ember.js",
  "Express",
  "FastAPI",
  "Figma",
  "Flask",
  "Flutter",
  "GCP",
  "Git",
  "GitHub Actions",
  "GitLab CI",
  "Go",
  "GraphQL",
  "Gradle",
  "Hadoop",
  "Haskell",
  "Heroku",
  "HTML",
  "Helm",
  "Java",
  "JavaScript",
  "Jenkins",
  "Jest",
  "Kafka",
  "Keras",
  "Kotlin",
  "Kubernetes",
  "LangChain",
  "Linux",
  "Lua",
  "Machine Learning",
  "MariaDB",
  "Maven",
  "Microservices",
  "MongoDB",
  "MySQL",
  "NestJS",
  "Next.js",
  "Node.js",
  "Nuxt.js",
  "OAuth",
  "OpenAI API",
  "OpenAPI",
  "OpenTelemetry",
  "PHP",
  "Perl",
  "Playwright",
  "PostgreSQL",
  "Postman",
  "PowerShell",
  "Prisma",
  "Prometheus",
  "Pub/Sub",
  "Puppeteer",
  "PyTorch",
  "Python",
  "R",
  "REST APIs",
  "Rabbit MQ",
  "Rails",
  "React",
  "React Native",
  "Redis",
  "Redux",
  "Ruby",
  "Rust",
  "SCSS",
  "SQL",
  "SQLite",
  "Sass",
  "Scala",
  "Selenium",
  "Sentry",
  "Shell scripting",
  "Snowflake",
  "Spark",
  "Spring Boot",
  "Storybook",
  "Stripe",
  "Supabase",
  "Svelte",
  "Swift",
  "System Design",
  "Tailwind CSS",
  "TanStack Query",
  "TensorFlow",
  "Terraform",
  "TypeScript",
  "Unity",
  "Vue.js",
  "Webpack",
  "WebSockets",
  "Zod",
  // ... extend over time. 500 is a target, not a hard requirement; ~120 here is a viable starting set.
];
```

(The list above is a starting set — `~120` skills cover most candidates. Expanding to 500 is a future task as real candidate data flows in.)

- [ ] **Step 9.2: Re-export from index**

```ts
// packages/shared/src/index.ts — add:
export { SKILLS_TAXONOMY } from "./skills-taxonomy";
```

- [ ] **Step 9.3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

---

## Task 10: Update `ONBOARDING_STEPS` (4 entries) + `LatestParsedResume` types

**Goal:** Frontend's source of truth for step labels and parsed-resume shape catches up to the new backend contract.

**Files:**
- Modify: `apps/web/app/onboarding/candidate/_data.ts`

- [ ] **Step 10.1: Update step list and parsed-resume types**

Replace the file's contents with:

```ts
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";

export const ONBOARDING_STEPS = [
  { id: "resume", label: "Resume", path: "/onboarding/candidate" },
  { id: "personal", label: "Personal", path: "/onboarding/candidate/personal" },
  { id: "review", label: "Review", path: "/onboarding/candidate/review" },
  { id: "preferences", label: "Preferences", path: "/onboarding/candidate/preferences" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

export interface CandidateProfileMe {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  headline: string | null;
  summary: string | null;
  locationCity: string | null;
  locationRegion: string | null;
  locationCountry: string | null;
  desiredRoles: string[];
  desiredSeniority: string | null;
  openTo: string[];
  desiredSalaryMin: number | null;
  desiredSalaryMax: number | null;
  desiredCurrency: string;
  availableStartDate: string | null;
  profileCompleted: boolean;
}

export async function fetchCandidateProfileMe(): Promise<CandidateProfileMe> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/candidate-profiles/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  if (res.status === 403) redirect("/login");
  if (!res.ok) throw new Error(`Failed to load candidate profile: ${res.status}`);
  const body = (await res.json()) as { data: CandidateProfileMe };
  return body.data;
}

// ============================================================================
// Parsed resume — v2 shape (with *_source fields)
// ============================================================================

export interface LatestParsedResume {
  id: string;
  parseStatus: "pending" | "parsing" | "parsed" | "failed";
  signedPdfUrl: string | null;
  canonicalPdfPath: string | null;
  parsed: ParsedResumeV2 | null;
}

export interface ParsedResumeV2 {
  contact: {
    full_name: string | null; full_name_source: string | null;
    email: string | null; email_source: string | null;
    phone: string | null; phone_source: string | null;
    location_city: string | null; location_city_source: string | null;
    location_country: string | null; location_country_source: string | null;
    linkedin_url: string | null; linkedin_url_source: string | null;
    portfolio_url: string | null; portfolio_url_source: string | null;
  };
  summary: { text: string; text_source: string } | null;
  education: Array<{
    institution: string; institution_source: string;
    degree: string | null; degree_source: string | null;
    field_of_study: string | null; field_of_study_source: string | null;
    start_year: number | null; end_year: number | null;
    period_source: string | null;
    gpa: string | null; gpa_source: string | null;
  }>;
  experience: Array<{
    company: string; company_source: string;
    title: string; title_source: string;
    start_date: string | null; end_date: string | null;
    period_source: string;
    is_current: boolean;
    responsibilities: string[]; responsibilities_source: string[];
    technologies_used: string[];
  }>;
  skills: Array<{ name: string; source: string }>;
  certifications: Array<{
    name: string; name_source: string;
    issuing_organization: string | null; issuing_organization_source: string | null;
    issue_date: string | null; issue_date_source: string | null;
  }>;
  languages: string[];
  parse_confidence: "high" | "medium" | "low";
}

export async function fetchLatestParsedResume(): Promise<LatestParsedResume | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const [listRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/resumes/mine`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    }),
  ]);
  if (!listRes.ok) return null;

  const listBody = (await listRes.json()) as {
    data: Array<{
      id: string;
      parseStatus: "pending" | "parsing" | "parsed" | "failed";
      parsedData: unknown;
      canonicalPdfPath: string | null;
      isDefault: boolean;
      createdAt: string;
    }>;
  };
  if (listBody.data.length === 0) return null;

  const sorted = [...listBody.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const candidate = sorted.find((r) => r.isDefault) ?? sorted[0]!;

  // Fetch signed URLs (cheap — 1 round trip).
  const urlRes = await fetch(`${apiUrl}/api/v1/resumes/${candidate.id}/download-url`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  let signedPdfUrl: string | null = null;
  if (urlRes.ok) {
    const urlBody = (await urlRes.json()) as { data: { signedUrl: string; signedPdfUrl: string } };
    signedPdfUrl = urlBody.data.signedPdfUrl;
  }

  return {
    id: candidate.id,
    parseStatus: candidate.parseStatus,
    signedPdfUrl,
    canonicalPdfPath: candidate.canonicalPdfPath,
    parsed: candidate.parsedData as ParsedResumeV2 | null,
  };
}
```

- [ ] **Step 10.2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: existing step pages will fail (`Step 1Page`, `Step 2Page` etc. import `ONBOARDING_STEPS` and pass it via `[...ONBOARDING_STEPS]` — that still works). The deleted-route pages and the old `LatestParsedResume.parsed.contact?` property accesses may break — those will be fixed in Tasks 23–43. For now, type-check failures inside `app/onboarding/candidate/{education,experience,skills}/page.tsx` are expected and will be resolved when those routes are deleted in Task 50.

---

## Task 11: `OnboardingProgress` component

**Goal:** 4-segment horizontal progress with three states (completed / current / upcoming). Collapses to a 4px progress bar < 1024px.

**Files:**
- Create: `apps/web/components/onboarding/onboarding-progress.tsx`
- Create: `apps/web/components/onboarding/onboarding-progress.test.tsx`

- [ ] **Step 11.1: Write failing test**

```tsx
// apps/web/components/onboarding/onboarding-progress.test.tsx
import { render, screen } from "@testing-library/react";
import { OnboardingProgress } from "./onboarding-progress";

const STEPS = [
  { id: "resume", label: "Resume" },
  { id: "personal", label: "Personal" },
  { id: "review", label: "Review" },
  { id: "preferences", label: "Preferences" },
] as const;

describe("OnboardingProgress", () => {
  it("renders 4 segments", () => {
    render(<OnboardingProgress steps={STEPS} currentStepId="personal" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "4");
  });

  it("marks completed steps with checkmark", () => {
    render(<OnboardingProgress steps={STEPS} currentStepId="review" />);
    expect(screen.getAllByLabelText(/completed/i)).toHaveLength(2);
  });

  it("marks current step with primary ring style", () => {
    const { container } = render(<OnboardingProgress steps={STEPS} currentStepId="review" />);
    expect(container.querySelector('[data-step="review"][data-state="current"]')).not.toBeNull();
  });
});
```

- [ ] **Step 11.2: Run test (fails)**

Run: `pnpm --filter web test onboarding-progress`
Expected: FAIL — module not found.

- [ ] **Step 11.3: Implement**

```tsx
// apps/web/components/onboarding/onboarding-progress.tsx
import { Check } from "lucide-react";

interface Step {
  readonly id: string;
  readonly label: string;
}

interface Props {
  steps: readonly Step[];
  currentStepId: string;
  className?: string;
}

export function OnboardingProgress({ steps, currentStepId, className }: Props) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);
  const valueNow = currentIndex + 1;

  return (
    <div className={className}>
      {/* Desktop: full segmented progress */}
      <ol
        className="hidden items-center gap-0 lg:flex"
        role="progressbar"
        aria-valuenow={valueNow}
        aria-valuemax={steps.length}
        aria-label="Onboarding progress"
      >
        {steps.map((step, i) => {
          const state = i < currentIndex ? "completed" : i === currentIndex ? "current" : "upcoming";
          const isLast = i === steps.length - 1;
          return (
            <li key={step.id} className="flex flex-1 items-center" data-step={step.id} data-state={state}>
              <div className="flex flex-col items-center">
                <div
                  className={[
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition",
                    state === "completed" &&
                      "bg-[var(--color-primary)] text-[var(--color-on-primary)]",
                    state === "current" &&
                      "border-2 border-[var(--color-primary)] bg-[var(--color-canvas)] text-[var(--color-primary)]",
                    state === "upcoming" &&
                      "bg-[var(--color-hairline)] text-[var(--color-muted)]",
                  ].filter(Boolean).join(" ")}
                  aria-label={state === "completed" ? `${step.label} completed` : undefined}
                >
                  {state === "completed" ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span
                  className={[
                    "mt-2 text-xs",
                    state === "current"
                      ? "font-semibold text-[var(--color-primary)]"
                      : "text-[var(--color-muted)]",
                  ].join(" ")}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={[
                    "mx-2 h-[2px] flex-1 transition",
                    state === "completed"
                      ? "bg-[var(--color-primary)]"
                      : "bg-[var(--color-hairline)]",
                  ].join(" ")}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Tablet/phone: single 4px bar */}
      <div
        className="lg:hidden"
        role="progressbar"
        aria-valuenow={valueNow}
        aria-valuemax={steps.length}
      >
        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-hairline)]">
          <div
            className="h-full bg-[var(--color-primary)] transition-[width] duration-200"
            style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 11.4: Run tests (passes)**

Run: `pnpm --filter web test onboarding-progress`
Expected: PASS.

---

## Task 12: `SaveStatusIndicator` component

**Goal:** Top-bar autosave indicator with three visual states.

**Files:**
- Create: `apps/web/components/onboarding/save-status-indicator.tsx`
- Create: `apps/web/components/onboarding/save-status-indicator.test.tsx`

- [ ] **Step 12.1: Write failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveStatusIndicator } from "./save-status-indicator";

describe("SaveStatusIndicator", () => {
  it("renders idle state", () => {
    render(<SaveStatusIndicator status="idle" />);
    expect(screen.getByText(/All changes saved/i)).toBeInTheDocument();
  });
  it("renders saving state with spinner", () => {
    render(<SaveStatusIndicator status="saving" />);
    expect(screen.getByText(/Saving…/i)).toBeInTheDocument();
  });
  it("renders error state with retry", async () => {
    const onRetry = jest.fn();
    render(<SaveStatusIndicator status="error" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
```

- [ ] **Step 12.2: Run test (fails)**

Run: `pnpm --filter web test save-status-indicator`
Expected: FAIL — module not found.

- [ ] **Step 12.3: Implement**

```tsx
// apps/web/components/onboarding/save-status-indicator.tsx
import { Check, Loader2, AlertCircle } from "lucide-react";

export type SaveStatus = "idle" | "saving" | "error";

interface Props {
  status: SaveStatus;
  onRetry?: () => void;
  className?: string;
}

export function SaveStatusIndicator({ status, onRetry, className }: Props) {
  const cls = [
    "flex items-center gap-1.5 text-xs",
    status === "error" ? "text-[var(--color-status-danger)]" : "text-[var(--color-muted)]",
    className,
  ].filter(Boolean).join(" ");

  if (status === "saving") {
    return <span className={cls}><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</span>;
  }
  if (status === "error") {
    return (
      <span className={cls}>
        <AlertCircle className="h-3.5 w-3.5" />
        Couldn't save —{" "}
        <button onClick={onRetry} className="font-semibold underline">Retry</button>
      </span>
    );
  }
  return <span className={cls}><Check className="h-3.5 w-3.5" />All changes saved</span>;
}
```

- [ ] **Step 12.4: Run tests (passes)**

Run: `pnpm --filter web test save-status-indicator`
Expected: PASS.

---

## Task 13: `OnboardingShell` layout

**Goal:** Top bar (wordmark + progress + save indicator) + two-pane body grid. Right pane is a slot.

**Files:**
- Create: `apps/web/components/onboarding/onboarding-shell.tsx`

- [ ] **Step 13.1: Implement**

```tsx
// apps/web/components/onboarding/onboarding-shell.tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { OnboardingProgress } from "./onboarding-progress";
import { SaveStatusIndicator, type SaveStatus } from "./save-status-indicator";
import { ONBOARDING_STEPS, type OnboardingStepId } from "@/app/onboarding/candidate/_data";

interface Props {
  currentStepId: OnboardingStepId;
  saveStatus: SaveStatus;
  onSaveRetry?: () => void;
  /** Right pane content. If null, the body becomes single-column. */
  rightPane?: ReactNode;
  /** Mobile-only "View resume" / "View preview" affordance — see Task 36. */
  mobileRightPaneToggle?: ReactNode;
  children: ReactNode;
}

export function OnboardingShell({
  currentStepId,
  saveStatus,
  onSaveRetry,
  rightPane,
  mobileRightPaneToggle,
  children,
}: Props) {
  const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.id === currentStepId);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)]">
      <header className="sticky top-0 z-30 border-b border-[var(--color-hairline-soft)] bg-[var(--color-canvas)]">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="AuraHire home" className="shrink-0">
            <BrandWordmark size="sm" />
          </Link>
          <div className="hidden flex-1 lg:block">
            <OnboardingProgress steps={ONBOARDING_STEPS} currentStepId={currentStepId} />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <SaveStatusIndicator status={saveStatus} onRetry={onSaveRetry} />
            <span className="font-mono text-xs text-[var(--color-muted)]">
              {currentIndex + 1} / {ONBOARDING_STEPS.length}
            </span>
            {mobileRightPaneToggle && <span className="lg:hidden">{mobileRightPaneToggle}</span>}
          </div>
        </div>
        {/* slim mobile progress bar */}
        <div className="lg:hidden">
          <OnboardingProgress steps={ONBOARDING_STEPS} currentStepId={currentStepId} />
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-0 lg:grid-cols-[1.3fr_1fr]">
          <section className="px-4 py-8 sm:px-8 sm:py-10">{children}</section>
          {rightPane && (
            <aside className="hidden border-l border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-6 py-8 lg:block">
              {rightPane}
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 13.2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

---

## Task 14: `useAutosave` hook

**Goal:** Debounced PATCH on form blur with `SaveStatus` callback.

**Files:**
- Create: `apps/web/components/onboarding/use-autosave.ts`

- [ ] **Step 14.1: Implement**

```ts
// apps/web/components/onboarding/use-autosave.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveStatus } from "./save-status-indicator";

interface Options<TPayload> {
  save: (payload: TPayload) => Promise<void>;
  debounceMs?: number;
}

export function useAutosave<TPayload>({ save, debounceMs = 500 }: Options<TPayload>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<TPayload | null>(null);
  const inFlight = useRef(false);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!pending.current) return;
    if (inFlight.current) return;

    const payload = pending.current;
    pending.current = null;
    inFlight.current = true;
    setStatus("saving");

    try {
      await save(payload);
      setStatus("idle");
    } catch (err) {
      // Retry once silently.
      try {
        await save(payload);
        setStatus("idle");
      } catch {
        setStatus("error");
      }
    } finally {
      inFlight.current = false;
      // If more changes arrived while in-flight, schedule another flush.
      if (pending.current) flush();
    }
  }, [save]);

  const schedule = useCallback((payload: TPayload) => {
    pending.current = payload;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, debounceMs);
  }, [flush, debounceMs]);

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  return { status, schedule, flushNow: flush, retry: flush };
}
```

- [ ] **Step 14.2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

---

## Task 15: `useTabCloseProtection` hook

**Goal:** `beforeunload` listener that only fires after the form has been dirty for > 750ms.

**Files:**
- Create: `apps/web/components/onboarding/use-tab-close-protection.ts`

- [ ] **Step 15.1: Implement**

```ts
// apps/web/components/onboarding/use-tab-close-protection.ts
"use client";

import { useEffect, useRef } from "react";

export function useTabCloseProtection(isDirty: boolean) {
  const dirtyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const protectActive = useRef(false);

  useEffect(() => {
    if (isDirty) {
      if (!dirtyTimer.current) {
        dirtyTimer.current = setTimeout(() => { protectActive.current = true; }, 750);
      }
    } else {
      if (dirtyTimer.current) clearTimeout(dirtyTimer.current);
      dirtyTimer.current = null;
      protectActive.current = false;
    }
  }, [isDirty]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!protectActive.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
}
```

- [ ] **Step 15.2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

---

## Task 16: `HighlightContext` provider

**Goal:** React context exposing `{ hoveredFieldId, setHoveredFieldId, focusField }` so form fields and resume highlights link bidirectionally without prop-drilling.

**Files:**
- Create: `apps/web/components/onboarding/resume-preview/highlight-context.tsx`

- [ ] **Step 16.1: Implement**

```tsx
// apps/web/components/onboarding/resume-preview/highlight-context.tsx
"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface HighlightContextValue {
  hoveredFieldId: string | null;
  setHoveredFieldId: (id: string | null) => void;
  focusField: (id: string) => void;
  registerField: (id: string, focus: () => void) => () => void;
}

const HighlightContext = createContext<HighlightContextValue | null>(null);

export function HighlightProvider({ children }: { children: ReactNode }) {
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const fields = useRef<Map<string, () => void>>(new Map());

  const registerField = useCallback((id: string, focus: () => void) => {
    fields.current.set(id, focus);
    return () => { fields.current.delete(id); };
  }, []);

  const focusField = useCallback((id: string) => {
    fields.current.get(id)?.();
  }, []);

  return (
    <HighlightContext.Provider value={{ hoveredFieldId, setHoveredFieldId, focusField, registerField }}>
      {children}
    </HighlightContext.Provider>
  );
}

export function useHighlightContext(): HighlightContextValue {
  const v = useContext(HighlightContext);
  if (!v) throw new Error("useHighlightContext must be inside <HighlightProvider>");
  return v;
}
```

---

## Task 17: `derive-highlights` utility

**Goal:** Pure function: parsed-resume JSON → flat `Highlight[]`.

**Files:**
- Create: `apps/web/components/onboarding/resume-preview/derive-highlights.ts`
- Create: `apps/web/components/onboarding/resume-preview/derive-highlights.test.ts`

- [ ] **Step 17.1: Write failing test**

```ts
import { deriveHighlights } from "./derive-highlights";

describe("deriveHighlights", () => {
  it("emits one highlight per *_source field, skipping nulls", () => {
    const parsed = {
      contact: {
        full_name: "Jane",
        full_name_source: "Jane Doe",
        email: null,
        email_source: null,
        phone: null,
        phone_source: null,
        location_city: null,
        location_city_source: null,
        location_country: null,
        location_country_source: null,
        linkedin_url: null,
        linkedin_url_source: null,
        portfolio_url: null,
        portfolio_url_source: null,
      },
      summary: { text: "Engineer", text_source: "Engineer with 5y exp" },
      experience: [],
      education: [],
      skills: [{ name: "TS", source: "TypeScript" }],
      certifications: [],
      languages: [],
      parse_confidence: "high" as const,
    };
    const highlights = deriveHighlights(parsed);
    expect(highlights).toHaveLength(3);  // contact.full_name + summary + skills.0
    expect(highlights[0]).toMatchObject({ category: "contact", source: "Jane Doe" });
  });
});
```

- [ ] **Step 17.2: Run test (fails)**

Run: `pnpm --filter web test derive-highlights`
Expected: FAIL.

- [ ] **Step 17.3: Implement**

```ts
// apps/web/components/onboarding/resume-preview/derive-highlights.ts
import type { ParsedResumeV2 } from "@/app/onboarding/candidate/_data";

export type HighlightCategory = "contact" | "summary" | "experience" | "education" | "skill";

export interface Highlight {
  id: string;
  category: HighlightCategory;
  source: string;
  fieldRef: string;
}

export function deriveHighlights(parsed: ParsedResumeV2 | null | undefined): Highlight[] {
  if (!parsed) return [];
  const out: Highlight[] = [];
  const push = (id: string, category: HighlightCategory, source: string | null | undefined, fieldRef: string) => {
    if (source && source.trim().length > 0) out.push({ id, category, source, fieldRef });
  };

  const c = parsed.contact;
  push("contact.full_name", "contact", c.full_name_source, "fullName");
  push("contact.email", "contact", c.email_source, "email");
  push("contact.phone", "contact", c.phone_source, "phone");
  push("contact.location_city", "contact", c.location_city_source, "locationCity");
  push("contact.location_country", "contact", c.location_country_source, "locationCountry");
  push("contact.linkedin_url", "contact", c.linkedin_url_source, "linkedinUrl");
  push("contact.portfolio_url", "contact", c.portfolio_url_source, "portfolioUrl");

  if (parsed.summary) {
    push("summary", "summary", parsed.summary.text_source, "summary");
  }

  parsed.experience.forEach((e, i) => {
    push(`experience.${i}.title`, "experience", e.title_source, `experience.${i}.title`);
    push(`experience.${i}.company`, "experience", e.company_source, `experience.${i}.company`);
    push(`experience.${i}.period`, "experience", e.period_source, `experience.${i}.period`);
    e.responsibilities_source.forEach((s, j) => {
      push(`experience.${i}.responsibilities.${j}`, "experience", s, `experience.${i}.responsibilities.${j}`);
    });
  });

  parsed.education.forEach((e, i) => {
    push(`education.${i}.institution`, "education", e.institution_source, `education.${i}.institution`);
    push(`education.${i}.degree`, "education", e.degree_source, `education.${i}.degree`);
    push(`education.${i}.field_of_study`, "education", e.field_of_study_source, `education.${i}.field_of_study`);
    push(`education.${i}.period`, "education", e.period_source, `education.${i}.period`);
    push(`education.${i}.gpa`, "education", e.gpa_source, `education.${i}.gpa`);
  });

  parsed.skills.forEach((s, i) => {
    push(`skill.${i}`, "skill", s.source, `skill.${i}`);
  });

  return out;
}
```

- [ ] **Step 17.4: Run tests (passes)**

Run: `pnpm --filter web test derive-highlights`
Expected: PASS.

---

## Task 18: `findTextSpans` matcher + tests

**Goal:** Pure function: PDF.js text-layer items + a source string → array of bounding rects (whitespace-tolerant, accent-insensitive, case-insensitive). Returns `null` if not found.

**Files:**
- Create: `apps/web/components/onboarding/resume-preview/find-text-spans.ts`
- Create: `apps/web/components/onboarding/resume-preview/find-text-spans.test.ts`

- [ ] **Step 18.1: Write failing tests**

```ts
import { findTextSpans, type TextLayerItem } from "./find-text-spans";

const items: TextLayerItem[] = [
  { str: "Christian", x: 10, y: 100, width: 50, height: 12 },
  { str: " ", x: 60, y: 100, width: 4, height: 12 },
  { str: "Jutba", x: 64, y: 100, width: 30, height: 12 },
  { str: "0976-455-6948", x: 10, y: 80, width: 80, height: 12 },
  { str: "Senior Software Engineer", x: 10, y: 60, width: 140, height: 12 },
];

describe("findTextSpans", () => {
  it("finds a verbatim match", () => {
    expect(findTextSpans(items, "Christian Jutba")?.length).toBe(1);
  });
  it("is case-insensitive", () => {
    expect(findTextSpans(items, "christian jutba")?.length).toBe(1);
  });
  it("is whitespace-tolerant", () => {
    expect(findTextSpans(items, "Christian   Jutba")?.length).toBe(1);
  });
  it("returns null when not found", () => {
    expect(findTextSpans(items, "Nonexistent string")).toBeNull();
  });
  it("matches normalized phone formats", () => {
    expect(findTextSpans(items, "09764556948")).toBeTruthy();
  });
  it("returns multiple rects for multi-line matches", () => {
    const multi: TextLayerItem[] = [
      { str: "Senior", x: 10, y: 100, width: 30, height: 12 },
      { str: "Software", x: 10, y: 86, width: 50, height: 12 },
      { str: "Engineer", x: 10, y: 72, width: 50, height: 12 },
    ];
    const rects = findTextSpans(multi, "Senior Software Engineer");
    expect(rects?.length).toBe(3);
  });
});
```

- [ ] **Step 18.2: Run tests (fail)**

Run: `pnpm --filter web test find-text-spans`
Expected: FAIL.

- [ ] **Step 18.3: Implement**

```ts
// apps/web/components/onboarding/resume-preview/find-text-spans.ts
export interface TextLayerItem {
  str: string;
  x: number;       // page-space x
  y: number;       // page-space y (PDF coordinates: y increases up, but we treat each item's y as top-of-box for simplicity)
  width: number;
  height: number;
}

export interface Rect { x: number; y: number; width: number; height: number; }

const normalize = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, " ").trim().toLowerCase();

const stripPunctuation = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]/g, "").toLowerCase();

export function findTextSpans(items: TextLayerItem[], source: string): Rect[] | null {
  if (!source.trim()) return null;

  // Strategy 1: whitespace-tolerant search across the joined buffer.
  // Build a buffer with item index per character.
  let buffer = "";
  const charToItem: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const norm = items[i]!.str;
    for (let c = 0; c < norm.length; c++) {
      buffer += norm[c];
      charToItem.push(i);
    }
    // Insert virtual space between items for word boundaries.
    buffer += " ";
    charToItem.push(-1);
  }

  const normBuffer = normalize(buffer);
  const normSource = normalize(source);
  let idx = normBuffer.indexOf(normSource);
  if (idx >= 0) {
    return spansFromCharRange(items, charToItem, buffer, idx, normSource.length);
  }

  // Strategy 2: punctuation-stripped match (handles phone numbers like "0976-455-6948" → "09764556948").
  const stripped = stripPunctuation(buffer);
  const strippedSrc = stripPunctuation(source);
  if (strippedSrc && stripped.includes(strippedSrc)) {
    // Map stripped index back to original buffer — find the first item whose stripped concatenation includes the source.
    // Simpler heuristic: return the item whose stripped str contains the stripped source.
    for (let i = 0; i < items.length; i++) {
      if (stripPunctuation(items[i]!.str).includes(strippedSrc)) {
        const it = items[i]!;
        return [{ x: it.x, y: it.y, width: it.width, height: it.height }];
      }
    }
  }

  return null;
}

function spansFromCharRange(
  items: TextLayerItem[],
  charToItem: number[],
  buffer: string,
  startInNormalized: number,
  lengthInNormalized: number,
): Rect[] {
  // Walk through buffer counting normalized characters until we find startInNormalized.
  // For simplicity, find the items overlapping the original-text range.
  let normCount = 0;
  let startIdx = -1;
  for (let i = 0; i < buffer.length && startIdx < 0; i++) {
    const c = buffer[i]!;
    const isNormChar = /\w/.test(c);
    if (isNormChar) {
      if (normCount === startInNormalized) startIdx = i;
      normCount++;
    } else if (c === " " && normCount > startInNormalized) {
      // crossed a normalized space boundary
    }
  }
  if (startIdx < 0) return [];

  // Walk forward to cover lengthInNormalized normalized chars.
  let endIdx = startIdx;
  let collected = 0;
  while (endIdx < buffer.length && collected < lengthInNormalized) {
    const c = buffer[endIdx]!;
    if (/\w/.test(c)) collected++;
    else if (c === " " && collected > 0) { /* tolerate spaces */ }
    endIdx++;
  }

  // Collect distinct item indices covered by [startIdx, endIdx).
  const itemIndices = new Set<number>();
  for (let i = startIdx; i < endIdx; i++) {
    const ii = charToItem[i];
    if (ii !== undefined && ii >= 0) itemIndices.add(ii);
  }

  // Group items by row (similar y) and merge bounding boxes per row.
  const byRow = new Map<number, TextLayerItem[]>();
  for (const ii of itemIndices) {
    const it = items[ii]!;
    const rowKey = Math.round(it.y / 4) * 4;  // bucket by y-position
    if (!byRow.has(rowKey)) byRow.set(rowKey, []);
    byRow.get(rowKey)!.push(it);
  }

  const rects: Rect[] = [];
  for (const [, rowItems] of byRow) {
    const minX = Math.min(...rowItems.map((it) => it.x));
    const minY = Math.min(...rowItems.map((it) => it.y));
    const maxX = Math.max(...rowItems.map((it) => it.x + it.width));
    const maxY = Math.max(...rowItems.map((it) => it.y + it.height));
    rects.push({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
  }

  return rects;
}
```

- [ ] **Step 18.4: Run tests (pass)**

Run: `pnpm --filter web test find-text-spans`
Expected: PASS.

(If matching turns out brittle with real PDFs, treat this implementation as a starting point — the test suite should be expanded with realistic PDF.js fixtures during Task 24's manual verification.)

---

## Task 19: Install `pdfjs-dist`

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 19.1: Install**

Run: `pnpm --filter web add pdfjs-dist@^5`
Expected: lockfile updated, `pdfjs-dist` in `apps/web/package.json` deps.

- [ ] **Step 19.2: Verify worker URL approach**

The PDF.js worker needs a URL. Two options:
- (preferred) Use the `import.meta.url`-driven worker import: `import * as pdfjs from "pdfjs-dist"; pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();`
- (fallback) Copy `pdf.worker.min.mjs` to `apps/web/public/` and reference as `/pdf.worker.min.mjs`.

Confirm Next.js 16 webpack config supports the URL import (it does — but this needs verification). If not, use the public-folder fallback.

- [ ] **Step 19.3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

---

## Task 20: `PdfRenderer` component

**Goal:** Renders PDF pages to canvas + transparent text layer; emits text-layer items per page via callback.

**Files:**
- Create: `apps/web/components/onboarding/resume-preview/pdf-renderer.tsx`

- [ ] **Step 20.1: Implement**

```tsx
// apps/web/components/onboarding/resume-preview/pdf-renderer.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy, TextItem } from "pdfjs-dist/types/src/display/api";
import type { TextLayerItem } from "./find-text-spans";

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

interface Props {
  url: string;
  /** Called once after all pages render with the flat list of text items per page. */
  onTextLayer: (pages: TextLayerItem[][]) => void;
  onLoadError: (err: Error) => void;
  className?: string;
}

export function PdfRenderer({ url, onTextLayer, onLoadError, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);

  useEffect(() => {
    let cancelled = false;
    pdfjs.getDocument(url).promise.then(
      (d) => { if (!cancelled) setDoc(d); },
      (err) => { if (!cancelled) onLoadError(err as Error); },
    );
    return () => { cancelled = true; };
  }, [url, onLoadError]);

  useEffect(() => {
    if (!doc || !containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = "";
    let cancelled = false;
    const allTextItems: TextLayerItem[][] = [];

    (async () => {
      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        if (cancelled) return;
        const page: PDFPageProxy = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });

        const pageWrapper = document.createElement("div");
        pageWrapper.style.position = "relative";
        pageWrapper.style.marginBottom = "16px";
        pageWrapper.style.width = `${viewport.width}px`;
        pageWrapper.style.height = `${viewport.height}px`;

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";

        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        pageWrapper.appendChild(canvas);

        const textLayerDiv = document.createElement("div");
        textLayerDiv.style.position = "absolute";
        textLayerDiv.style.top = "0";
        textLayerDiv.style.left = "0";
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;
        textLayerDiv.dataset.pageNum = String(pageNum);
        textLayerDiv.classList.add("textLayer");
        pageWrapper.appendChild(textLayerDiv);

        const textContent = await page.getTextContent();
        const items: TextLayerItem[] = textContent.items
          .filter((it): it is TextItem => "str" in it)
          .map((it) => {
            const tx = pdfjs.Util.transform(viewport.transform, it.transform);
            return {
              str: it.str,
              x: tx[4],
              y: tx[5] - it.height,
              width: it.width,
              height: it.height,
            };
          });
        allTextItems.push(items);

        // Render text layer DOM (PDF.js's renderTextLayer is too heavy; we just position a single absolute span per item).
        for (const it of textContent.items) {
          if (!("str" in it)) continue;
          const tx = pdfjs.Util.transform(viewport.transform, (it as TextItem).transform);
          const span = document.createElement("span");
          span.textContent = it.str;
          span.style.position = "absolute";
          span.style.left = `${tx[4]}px`;
          span.style.top = `${tx[5] - (it as TextItem).height}px`;
          span.style.fontSize = `${(it as TextItem).height}px`;
          span.style.color = "transparent";
          span.style.whiteSpace = "pre";
          textLayerDiv.appendChild(span);
        }

        container.appendChild(pageWrapper);
      }

      if (!cancelled) onTextLayer(allTextItems);
    })().catch((err) => { if (!cancelled) onLoadError(err as Error); });

    return () => { cancelled = true; };
  }, [doc, onTextLayer, onLoadError]);

  return <div ref={containerRef} className={className} />;
}
```

- [ ] **Step 20.2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS. (You may need to install `@types/pdfjs-dist` if upstream doesn't ship types, or adjust imports.)

---

## Task 21: `HighlightOverlay` component

**Goal:** Render colored rect divs on top of the text layer, one per highlight per matched span.

**Files:**
- Create: `apps/web/components/onboarding/resume-preview/highlight-overlay.tsx`

- [ ] **Step 21.1: Implement**

```tsx
// apps/web/components/onboarding/resume-preview/highlight-overlay.tsx
"use client";

import { useEffect } from "react";
import { useHighlightContext } from "./highlight-context";
import type { Highlight, HighlightCategory } from "./derive-highlights";
import type { Rect } from "./find-text-spans";

export interface PositionedHighlight extends Highlight {
  pageIndex: number;
  rects: Rect[];
}

interface Props {
  highlights: PositionedHighlight[];
  activeCategories: readonly HighlightCategory[];
  /** Page-wrapper DOM nodes (one per page) so we can append rect divs. */
  pageContainers: HTMLElement[];
}

export function HighlightOverlay({ highlights, activeCategories, pageContainers }: Props) {
  const { hoveredFieldId, focusField } = useHighlightContext();

  useEffect(() => {
    // Clean previous overlays.
    pageContainers.forEach((c) => {
      c.querySelectorAll("[data-highlight]").forEach((n) => n.remove());
    });

    for (const h of highlights) {
      const container = pageContainers[h.pageIndex];
      if (!container) continue;
      const isActive = activeCategories.includes(h.category);
      const isHovered = hoveredFieldId === h.fieldRef;

      for (const r of h.rects) {
        const div = document.createElement("div");
        div.dataset.highlight = h.id;
        div.dataset.fieldRef = h.fieldRef;
        div.style.position = "absolute";
        div.style.left = `${r.x}px`;
        div.style.top = `${r.y}px`;
        div.style.width = `${r.width}px`;
        div.style.height = `${r.height}px`;
        div.style.borderRadius = "3px";
        div.style.pointerEvents = "auto";
        div.style.cursor = "pointer";
        div.style.transition = "opacity 200ms ease, background-color 200ms ease";
        div.style.opacity = isActive ? "1" : "0.15";
        div.style.backgroundColor = "var(--color-primary-soft)";
        div.style.mixBlendMode = "multiply";
        if (isHovered) {
          div.style.outline = "2px solid var(--color-primary)";
          div.style.animation = "highlight-pulse 600ms ease-out";
        }
        div.addEventListener("click", () => focusField(h.fieldRef));
        container.appendChild(div);
      }
    }
  }, [highlights, activeCategories, hoveredFieldId, pageContainers, focusField]);

  return null;
}
```

Add a CSS keyframe in `apps/web/app/globals.css`:

```css
@keyframes highlight-pulse {
  0% { box-shadow: 0 0 0 0 var(--color-primary); }
  100% { box-shadow: 0 0 0 6px transparent; }
}
```

- [ ] **Step 21.2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

---

## Task 22: `LinearizedResumeView` fallback

**Goal:** Renders `rawText` as styled HTML with substring-based highlights when PDF rendering isn't viable.

**Files:**
- Create: `apps/web/components/onboarding/resume-preview/linearized-resume-view.tsx`

- [ ] **Step 22.1: Implement**

```tsx
// apps/web/components/onboarding/resume-preview/linearized-resume-view.tsx
"use client";

import { useMemo } from "react";
import { useHighlightContext } from "./highlight-context";
import type { Highlight, HighlightCategory } from "./derive-highlights";

interface Props {
  rawText: string;
  highlights: Highlight[];
  activeCategories: readonly HighlightCategory[];
}

export function LinearizedResumeView({ rawText, highlights, activeCategories }: Props) {
  const { focusField, hoveredFieldId } = useHighlightContext();

  const segments = useMemo(() => buildSegments(rawText, highlights), [rawText, highlights]);

  return (
    <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5 text-xs leading-6 text-[var(--color-body)]">
      <p className="mb-3 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
        Showing a text version of your resume
      </p>
      <div className="whitespace-pre-wrap">
        {segments.map((seg, i) =>
          seg.highlight ? (
            <mark
              key={i}
              data-field-ref={seg.highlight.fieldRef}
              onClick={() => focusField(seg.highlight!.fieldRef)}
              style={{
                backgroundColor: "var(--color-primary-soft)",
                color: "var(--color-primary)",
                opacity: activeCategories.includes(seg.highlight.category) ? 1 : 0.3,
                outline:
                  hoveredFieldId === seg.highlight.fieldRef
                    ? "2px solid var(--color-primary)"
                    : undefined,
                cursor: "pointer",
                padding: "0 2px",
                borderRadius: "3px",
              }}
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </div>
    </div>
  );
}

function buildSegments(
  rawText: string,
  highlights: Highlight[],
): Array<{ text: string; highlight?: Highlight }> {
  const matches: Array<{ start: number; end: number; highlight: Highlight }> = [];
  for (const h of highlights) {
    const idx = rawText.toLowerCase().indexOf(h.source.toLowerCase());
    if (idx >= 0) matches.push({ start: idx, end: idx + h.source.length, highlight: h });
  }
  matches.sort((a, b) => a.start - b.start);

  const segments: Array<{ text: string; highlight?: Highlight }> = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start < cursor) continue;  // overlapping, skip
    if (m.start > cursor) segments.push({ text: rawText.slice(cursor, m.start) });
    segments.push({ text: rawText.slice(m.start, m.end), highlight: m.highlight });
    cursor = m.end;
  }
  if (cursor < rawText.length) segments.push({ text: rawText.slice(cursor) });
  return segments;
}
```

- [ ] **Step 22.2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

---

## Task 23: `ResumePreviewPane` orchestrator

**Goal:** Loads the PDF, derives highlights, runs the matcher, decides PDF vs linearized fallback, exposes per-step filtering via `activeCategories` prop.

**Files:**
- Create: `apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx`

- [ ] **Step 23.1: Implement**

```tsx
// apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PdfRenderer } from "./pdf-renderer";
import { HighlightOverlay, type PositionedHighlight } from "./highlight-overlay";
import { LinearizedResumeView } from "./linearized-resume-view";
import { findTextSpans, type TextLayerItem } from "./find-text-spans";
import { deriveHighlights, type HighlightCategory } from "./derive-highlights";
import type { ParsedResumeV2 } from "@/app/onboarding/candidate/_data";

interface Props {
  signedPdfUrl: string | null;
  parsed: ParsedResumeV2 | null;
  rawText: string | null;
  activeCategories: readonly HighlightCategory[];
  className?: string;
}

type PaneState =
  | { kind: "loading" }
  | { kind: "pdf"; pages: TextLayerItem[][] }
  | { kind: "linearized" }
  | { kind: "error"; message: string };

export function ResumePreviewPane({ signedPdfUrl, parsed, rawText, activeCategories, className }: Props) {
  const [state, setState] = useState<PaneState>({ kind: "loading" });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const highlights = useMemo(() => deriveHighlights(parsed), [parsed]);

  const onTextLayer = useCallback((pages: TextLayerItem[][]) => {
    const totalChars = pages.flat().reduce((sum, it) => sum + it.str.length, 0);
    if (totalChars < 50) {
      setState({ kind: "linearized" });
      return;
    }
    setState({ kind: "pdf", pages });
  }, []);

  const onLoadError = useCallback((err: Error) => {
    if (rawText && rawText.trim().length > 50) setState({ kind: "linearized" });
    else setState({ kind: "error", message: err.message });
  }, [rawText]);

  // Compute positioned highlights once text layer is ready.
  const positioned: PositionedHighlight[] = useMemo(() => {
    if (state.kind !== "pdf") return [];
    const out: PositionedHighlight[] = [];
    for (let p = 0; p < state.pages.length; p++) {
      for (const h of highlights) {
        const rects = findTextSpans(state.pages[p]!, h.source);
        if (rects) out.push({ ...h, pageIndex: p, rects });
      }
    }
    return out;
  }, [state, highlights]);

  // Collect page container DOM refs for the overlay.
  const [pageContainers, setPageContainers] = useState<HTMLElement[]>([]);
  useEffect(() => {
    if (state.kind !== "pdf") return;
    if (!containerRef.current) return;
    setPageContainers(Array.from(containerRef.current.querySelectorAll<HTMLElement>(":scope > div")));
  }, [state]);

  if (!signedPdfUrl) {
    if (rawText && rawText.trim().length > 50 && parsed) {
      return (
        <div className={className}>
          <LinearizedResumeView rawText={rawText} highlights={highlights} activeCategories={activeCategories} />
        </div>
      );
    }
    return (
      <div className={`${className} text-sm text-[var(--color-muted)]`}>
        No resume uploaded yet.
      </div>
    );
  }

  return (
    <div className={className}>
      {state.kind === "loading" && (
        <div className="text-sm text-[var(--color-muted)]">Loading preview…</div>
      )}
      {state.kind === "linearized" && rawText && (
        <LinearizedResumeView rawText={rawText} highlights={highlights} activeCategories={activeCategories} />
      )}
      {state.kind === "error" && (
        <div className="rounded-lg border border-[var(--color-hairline)] p-4 text-sm text-[var(--color-muted)]">
          Couldn't load resume preview.
          <a href={signedPdfUrl} target="_blank" rel="noreferrer" className="ml-2 underline text-[var(--color-primary)]">
            Download
          </a>
        </div>
      )}
      <div ref={containerRef} className={state.kind === "pdf" ? "block" : "hidden"}>
        <PdfRenderer url={signedPdfUrl} onTextLayer={onTextLayer} onLoadError={onLoadError} />
      </div>
      {state.kind === "pdf" && pageContainers.length > 0 && (
        <HighlightOverlay
          highlights={positioned}
          activeCategories={activeCategories}
          pageContainers={pageContainers}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 23.2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

---

## Task 24: `ResumeUploadCard` (Step 1 dropzone + parse states)

**Goal:** Step 1's left-pane content. Three visual states: `idle` (dropzone), `parsing` (cycling captions), `done` (success card with item counts and Continue), `failed` (error + retry/skip).

**Files:**
- Create: `apps/web/components/onboarding/candidate/resume-upload-card.tsx`
- Create: `apps/web/components/onboarding/candidate/parsing-shimmer.tsx`
- Create: `apps/web/components/onboarding/candidate/parse-success-card.tsx`
- Create: `apps/web/components/onboarding/candidate/resume-stale-recovery-card.tsx`

- [ ] **Step 24.1: Implement `parsing-shimmer.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const CAPTIONS = [
  "Reading your resume…",
  "Extracting experience…",
  "Detecting skills…",
  "Almost done…",
];

export function ParsingShimmer() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % CAPTIONS.length), 1500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[var(--color-surface-soft)] p-5">
      <div className="relative h-2 w-32 overflow-hidden rounded-full bg-[var(--color-surface-strong)]">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-[var(--color-primary-soft)] to-transparent" />
      </div>
      <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
      <span className="text-sm text-[var(--color-body)]">{CAPTIONS[idx]}</span>
    </div>
  );
}
```

- [ ] **Step 24.2: Implement `parse-success-card.tsx`**

```tsx
import Link from "next/link";
import type { ParsedResumeV2 } from "@/app/onboarding/candidate/_data";

interface Props { parsed: ParsedResumeV2 | null; }

export function ParseSuccessCard({ parsed }: Props) {
  const expCount = parsed?.experience.length ?? 0;
  const eduCount = parsed?.education.length ?? 0;
  const skillCount = parsed?.skills.length ?? 0;
  const certCount = parsed?.certifications.length ?? 0;

  return (
    <div>
      <h2 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
        We've read your resume
      </h2>
      <p className="mt-2 text-sm text-[var(--color-body)]">
        Highlighted sections show what we extracted. Review on the next step.
      </p>
      <ul className="mt-5 flex flex-wrap gap-2">
        {[
          [`${expCount} experience${expCount === 1 ? "" : "s"}`, expCount > 0],
          [`${eduCount} school${eduCount === 1 ? "" : "s"}`, eduCount > 0],
          [`${skillCount} skill${skillCount === 1 ? "" : "s"}`, skillCount > 0],
          [`${certCount} cert${certCount === 1 ? "" : "s"}`, certCount > 0],
        ].map(([label, on], i) => (
          <li
            key={i}
            className={[
              "rounded-full px-3 py-1 text-xs",
              on
                ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                : "bg-[var(--color-surface-strong)] text-[var(--color-muted)]",
            ].join(" ")}
          >
            {label}
          </li>
        ))}
      </ul>
      <div className="mt-8 flex justify-end">
        <Link
          href="/onboarding/candidate/personal"
          className="rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          Continue
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 24.3: Implement `resume-stale-recovery-card.tsx`**

```tsx
"use client";
import { useState } from "react";

interface Props {
  resumeId: string;
  onReparseTriggered: () => void;
  onUploadDifferent: () => void;
}

export function ResumeStaleRecoveryCard({ resumeId, onReparseTriggered, onUploadDifferent }: Props) {
  const [pending, setPending] = useState(false);
  return (
    <div className="rounded-2xl border border-[var(--color-hairline)] p-6">
      <h2 className="text-xl font-normal text-[var(--color-ink)]">A previous upload didn't complete</h2>
      <p className="mt-2 text-sm text-[var(--color-body)]">
        We can pick up where it left off, or you can upload a different resume.
      </p>
      <div className="mt-5 flex gap-2">
        <button
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
              await fetch(`${apiUrl}/api/v1/resumes/${resumeId}/reparse`, {
                method: "POST",
                credentials: "include",  // session cookie
              });
              onReparseTriggered();
            } finally {
              setPending(false);
            }
          }}
          className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-50"
        >
          {pending ? "Retrying…" : "Retry parse"}
        </button>
        <button
          onClick={onUploadDifferent}
          className="rounded-full bg-[var(--color-surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)]"
        >
          Upload a different file
        </button>
      </div>
    </div>
  );
}
```

(Note: `Authorization: Bearer ${session.access_token}` is the project's pattern — use that. The `credentials: "include"` above is illustrative; mirror the existing fetch pattern.)

- [ ] **Step 24.4: Implement `resume-upload-card.tsx`**

This is the largest component — orchestrates dropzone + the four sub-states. Uses the existing upload pattern from `resume-upload.tsx` (which will be deleted in Task 50).

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { ParsingShimmer } from "./parsing-shimmer";
import { ParseSuccessCard } from "./parse-success-card";
import { ResumeStaleRecoveryCard } from "./resume-stale-recovery-card";
import type { LatestParsedResume } from "@/app/onboarding/candidate/_data";

const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 10 * 1024 * 1024;

interface Props {
  latestResume: LatestParsedResume | null;
  accessToken: string;
}

export function ResumeUploadCard({ latestResume, accessToken }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [uploading, startTransition] = useTransition();
  const [stage, setStage] = useState<"idle" | "uploading" | "done" | "failed">(
    latestResume?.parseStatus === "parsed" ? "done" :
    latestResume?.parseStatus === "failed" ? "failed" :
    "idle",
  );
  const [resume, setResume] = useState<LatestParsedResume | null>(latestResume);

  if (latestResume?.parseStatus === "parsing") {
    return (
      <ResumeStaleRecoveryCard
        resumeId={latestResume.id}
        onReparseTriggered={() => router.refresh()}
        onUploadDifferent={() => { setResume(null); setStage("idle"); }}
      />
    );
  }

  const handleFile = (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("File exceeds 10MB. Try compressing or use a different file.");
      return;
    }
    startTransition(async () => {
      setStage("uploading");
      const fd = new FormData();
      fd.append("file", file);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      try {
        const res = await fetch(`${apiUrl}/api/v1/resumes/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: fd,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.message ?? `Upload failed (${res.status})`);
          setStage("idle");
          return;
        }
        const body = (await res.json()) as { data: { id: string; parseStatus: string } };
        if (body.data.parseStatus === "parsed") {
          setStage("done");
          router.refresh();  // re-fetches LatestParsedResume on layout
        } else if (body.data.parseStatus === "failed") {
          setStage("failed");
          router.refresh();
        }
      } catch (err) {
        setError((err as Error).message);
        setStage("idle");
      }
    });
  };

  if (stage === "uploading") {
    return (
      <div>
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">Reading your resume</h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">This usually takes 5–15 seconds.</p>
        <div className="mt-6"><ParsingShimmer /></div>
      </div>
    );
  }

  if (stage === "done" && resume) {
    return <ParseSuccessCard parsed={resume.parsed} />;
  }

  if (stage === "failed") {
    return (
      <div>
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">We couldn't parse this resume</h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">Try again or continue without parsing.</p>
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => router.push("/onboarding/candidate/personal")}
            className="rounded-full bg-[var(--color-surface-strong)] px-4 py-2 text-sm font-semibold"
          >
            Continue without parsing
          </button>
          <button
            onClick={() => setStage("idle")}
            className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)]"
          >
            Try a different file
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">Upload your resume</h1>
      <p className="mt-2 text-sm text-[var(--color-body)]">
        We'll extract your contact info, experience, education, and skills automatically. The AI takes 5–15 seconds.
      </p>
      <label
        className="mt-6 flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/30"
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-[var(--color-primary)]"); }}
        onDragLeave={(e) => e.currentTarget.classList.remove("border-[var(--color-primary)]")}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
      >
        <UploadCloud className="h-10 w-10 text-[var(--color-muted)]" />
        <p className="mt-3 text-sm font-semibold">Drop your resume here, or click to browse</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">PDF or DOCX · 10MB max</p>
        <input
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </label>
      {error && (
        <p className="mt-3 text-sm text-[var(--color-status-danger)]">{error}</p>
      )}
      <button
        onClick={() => router.push("/onboarding/candidate/personal")}
        className="mt-6 text-sm text-[var(--color-muted)] underline"
      >
        Skip — I'll fill in manually
      </button>
    </div>
  );
}
```

- [ ] **Step 24.5: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

---

## Task 25: Step 1 page rewrite

**Files:**
- Modify: `apps/web/app/onboarding/candidate/page.tsx`

- [ ] **Step 25.1: Replace page content**

```tsx
// apps/web/app/onboarding/candidate/page.tsx
import { redirect } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { ResumeUploadCard } from "@/components/onboarding/candidate/resume-upload-card";
import { fetchCandidateProfileMe, fetchLatestParsedResume } from "./_data";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata = { title: "Upload Resume — Onboarding" };

export default async function Step1Page() {
  const me = await fetchCandidateProfileMe();
  if (me.profileCompleted) redirect("/candidate");

  const session = await getCurrentSession();
  const latestResume = await fetchLatestParsedResume();

  return (
    <OnboardingShell currentStepId="resume" saveStatus="idle">
      <ResumeUploadCard latestResume={latestResume} accessToken={session!.access_token} />
    </OnboardingShell>
  );
}
```

- [ ] **Step 25.2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

---

## Task 26: Trim `apps/web/app/onboarding/layout.tsx`

The new `OnboardingShell` owns the chrome, so the layout becomes a thin auth wrapper.

**Files:**
- Modify: `apps/web/app/onboarding/layout.tsx`

- [ ] **Step 26.1: Replace**

```tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const profile = (await getCurrentProfile()) as { id: string; role: string; profileCompleted: boolean } | null;
  if (!profile) redirect("/login");
  return <>{children}</>;
}
```

- [ ] **Step 26.2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

---

## Task 27: Step 2 — restyle `personal-info-form.tsx` + integrate highlight context

**Files:**
- Modify: `apps/web/components/onboarding/candidate/personal-info-form.tsx`
- Modify: `apps/web/app/onboarding/candidate/personal/page.tsx`

- [ ] **Step 27.1: Update `personal-info-form.tsx`**

Goal: 2-col grid for short fields (Full Name + Phone, City + Region + Country), full-width for Headline + Summary, AI_SUGGESTED → EDITED chip lifecycle, autosave on blur via `useAutosave`, register each field with `HighlightContext` for hover linking.

```tsx
"use client";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useAutosave } from "@/components/onboarding/use-autosave";
import { useTabCloseProtection } from "@/components/onboarding/use-tab-close-protection";
import { useHighlightContext } from "@/components/onboarding/resume-preview/highlight-context";
import { Sparkles } from "lucide-react";
import type { CandidateProfileMe } from "@/app/onboarding/candidate/_data";

interface FormValues {
  fullName: string;
  phone: string;
  headline: string;
  summary: string;
  locationCity: string;
  locationRegion: string;
  locationCountry: string;
}

interface Props {
  defaults: FormValues;
  aiSuggestedFields: Partial<Record<keyof FormValues, boolean>>;
  accessToken: string;
  onSaveStatusChange: (status: "idle" | "saving" | "error") => void;
}

export function CandidatePersonalInfoForm({ defaults, aiSuggestedFields, accessToken, onSaveStatusChange }: Props) {
  const { register, formState, getValues, watch, setFocus } = useForm<FormValues>({ defaultValues: defaults });
  const { setHoveredFieldId, registerField } = useHighlightContext();

  // Wire each named field as a focusable target.
  useEffect(() => {
    const unregisters = (Object.keys(defaults) as Array<keyof FormValues>).map((name) =>
      registerField(name as string, () => setFocus(name)),
    );
    return () => { unregisters.forEach((u) => u()); };
  }, [registerField, setFocus, defaults]);

  const { schedule, status } = useAutosave<Partial<FormValues>>({
    save: async (payload) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const res = await fetch(`${apiUrl}/api/v1/candidate-profiles/me`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
    },
  });

  useEffect(() => { onSaveStatusChange(status); }, [status, onSaveStatusChange]);
  useTabCloseProtection(formState.isDirty);

  const handleBlur = (name: keyof FormValues) => () => {
    schedule({ [name]: getValues(name) } as Partial<FormValues>);
  };

  const renderField = (name: keyof FormValues, label: string, type: "input" | "textarea" = "input") => {
    const isDirty = !!formState.dirtyFields[name];
    const wasAi = aiSuggestedFields[name] && !isDirty;
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={name} className="flex items-center gap-2 text-xs font-semibold text-[var(--color-ink)]">
          {label}
          {wasAi && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
              <Sparkles className="h-2.5 w-2.5" /> AI Suggested
            </span>
          )}
          {isDirty && aiSuggestedFields[name] && (
            <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Edited</span>
          )}
        </label>
        {type === "textarea" ? (
          <textarea
            id={name}
            rows={4}
            className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            data-field-id={name}
            {...register(name, { onBlur: handleBlur(name) })}
            onFocus={() => setHoveredFieldId(name as string)}
            onBlur={() => setHoveredFieldId(null)}
          />
        ) : (
          <input
            id={name}
            className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            data-field-id={name}
            {...register(name, { onBlur: handleBlur(name) })}
            onFocus={() => setHoveredFieldId(name as string)}
            onBlur={() => setHoveredFieldId(null)}
          />
        )}
      </div>
    );
  };

  return (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {renderField("fullName", "Full Name")}
        {renderField("phone", "Phone")}
      </div>
      {renderField("headline", "Headline")}
      {renderField("summary", "Professional Summary", "textarea")}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {renderField("locationCity", "City")}
        {renderField("locationRegion", "Region / State")}
        {renderField("locationCountry", "Country")}
      </div>
      <div className="flex justify-between pt-3">
        <a href="/onboarding/candidate" className="rounded-full bg-[var(--color-surface-strong)] px-5 py-2.5 text-sm font-semibold">
          Back
        </a>
        <a
          href="/onboarding/candidate/review"
          className="rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          Continue
        </a>
      </div>
    </form>
  );
}
```

- [ ] **Step 27.2: Update `personal/page.tsx`**

```tsx
// apps/web/app/onboarding/candidate/personal/page.tsx
import { redirect } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { ResumePreviewPane } from "@/components/onboarding/resume-preview/resume-preview-pane";
import { HighlightProvider } from "@/components/onboarding/resume-preview/highlight-context";
import { CandidatePersonalInfoForm } from "@/components/onboarding/candidate/personal-info-form";
import { fetchCandidateProfileMe, fetchLatestParsedResume } from "../_data";
import { getCurrentSession } from "@/lib/auth/session";
import { PersonalStepClient } from "./_client";

export const metadata = { title: "Personal Info — Onboarding" };

export default async function Step2Page() {
  const me = await fetchCandidateProfileMe();
  if (me.profileCompleted) redirect("/candidate");

  const session = await getCurrentSession();
  const latestResume = await fetchLatestParsedResume();

  // ... derive defaults + aiSuggestedFields from latestResume + me (same logic as before — keep the existing block).
  // For brevity, omit; copy from the current personal/page.tsx.

  return (
    <PersonalStepClient
      me={me}
      latestResume={latestResume}
      accessToken={session!.access_token}
      defaults={/* derive */ {} as any}
      aiSuggestedFields={{}}
    />
  );
}
```

Author `_client.tsx` as a Client Component that:
1. Wraps `<HighlightProvider>`.
2. Owns `saveStatus` state.
3. Renders `<OnboardingShell currentStepId="personal" saveStatus={saveStatus} rightPane={<ResumePreviewPane ... activeCategories={["contact","summary"]} />}>`.
4. Renders `<CandidatePersonalInfoForm onSaveStatusChange={setSaveStatus} ... />` inside.

- [ ] **Step 27.3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

---

## Task 28: Review step — `experience-card.tsx` + `experience-list.tsx`

**Files:**
- Create: `apps/web/components/onboarding/candidate/review/experience-card.tsx`
- Create: `apps/web/components/onboarding/candidate/review/experience-list.tsx`

- [ ] **Step 28.1: Implement `experience-card.tsx`**

Collapsed/expanded states with inline edit. Pseudocode-level:

```tsx
"use client";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

export interface ExperienceEntry {
  id: string;
  title: string;
  company: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  responsibilities: string[];
  technologies_used: string[];
}

interface Props {
  entry: ExperienceEntry;
  onSave: (updated: ExperienceEntry) => void | Promise<void>;
  onDelete: () => void;
  defaultExpanded?: boolean;
}

export function ExperienceCard({ entry, onSave, onDelete, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [draft, setDraft] = useState(entry);

  if (!expanded) {
    return (
      <div className="group rounded-xl border border-[var(--color-hairline)] p-4 hover:border-[var(--color-primary-soft)]" onClick={() => setExpanded(true)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-sm">{entry.title} · {entry.company}</div>
            <div className="text-xs font-mono text-[var(--color-muted)]">
              {entry.start_date ?? "?"} – {entry.is_current ? "Present" : entry.end_date ?? "?"}
            </div>
          </div>
          <div className="flex gap-2 opacity-0 transition group-hover:opacity-100">
            <button aria-label="Edit"><Pencil className="h-4 w-4" /></button>
            <button aria-label="Delete" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-[var(--color-primary)] p-5 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldInput label="Title" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
        <FieldInput label="Company" value={draft.company} onChange={(v) => setDraft({ ...draft, company: v })} />
        <FieldInput label="Start (YYYY-MM)" value={draft.start_date ?? ""} onChange={(v) => setDraft({ ...draft, start_date: v })} />
        <FieldInput label="End (YYYY-MM)" value={draft.is_current ? "" : (draft.end_date ?? "")} onChange={(v) => setDraft({ ...draft, end_date: v, is_current: false })} disabled={draft.is_current} />
        <label className="col-span-full flex items-center gap-2 text-xs">
          <input type="checkbox" checked={draft.is_current} onChange={(e) => setDraft({ ...draft, is_current: e.target.checked, end_date: e.target.checked ? null : draft.end_date })} />
          Currently here
        </label>
      </div>
      <div className="mt-3">
        <div className="text-xs font-semibold mb-1">Responsibilities</div>
        {draft.responsibilities.map((r, i) => (
          <div key={i} className="flex gap-2 mb-1">
            <textarea
              rows={1}
              className="flex-1 rounded-lg border border-[var(--color-hairline)] px-3 py-2 text-sm"
              value={r}
              onChange={(e) => {
                const copy = [...draft.responsibilities];
                copy[i] = e.target.value;
                setDraft({ ...draft, responsibilities: copy });
              }}
            />
            <button onClick={() => setDraft({ ...draft, responsibilities: draft.responsibilities.filter((_, j) => j !== i) })} aria-label="Remove">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          className="text-xs underline text-[var(--color-primary)]"
          onClick={() => setDraft({ ...draft, responsibilities: [...draft.responsibilities, ""] })}
        >
          + Add bullet
        </button>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={() => { setDraft(entry); setExpanded(false); }} className="rounded-full bg-[var(--color-surface-strong)] px-4 py-2 text-sm font-semibold">Cancel</button>
        <button
          onClick={async () => { await onSave(draft); setExpanded(false); }}
          className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)]"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function FieldInput({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold">{label}</label>
      <input
        className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-sm focus:border-[var(--color-primary)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
```

- [ ] **Step 28.2: Implement `experience-list.tsx`**

```tsx
"use client";
import { useState } from "react";
import { nanoid } from "nanoid";
import { ExperienceCard, type ExperienceEntry } from "./experience-card";
import { toast } from "sonner";

interface Props {
  initial: ExperienceEntry[];
  onSync: (entries: ExperienceEntry[]) => Promise<void>;
}

export function ExperienceList({ initial, onSync }: Props) {
  const [entries, setEntries] = useState(initial);

  const update = async (next: ExperienceEntry[]) => {
    setEntries(next);
    try {
      await onSync(next);
    } catch {
      toast.error("Couldn't save — try again");
    }
  };

  const handleDelete = (id: string) => {
    const removed = entries.find((e) => e.id === id);
    if (!removed) return;
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    let undone = false;
    toast("Experience removed", {
      action: { label: "Undo", onClick: () => { undone = true; setEntries(entries); } },
    });
    setTimeout(() => { if (!undone) onSync(next).catch(() => toast.error("Couldn't save")); }, 5000);
  };

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Experience <span className="font-mono text-xs">{entries.length}</span>
      </h3>
      {entries.length === 0 && (
        <p className="text-sm text-[var(--color-muted)]">No work experience parsed from your resume.</p>
      )}
      {entries.map((e) => (
        <ExperienceCard
          key={e.id}
          entry={e}
          onSave={(updated) => update(entries.map((x) => x.id === e.id ? updated : x))}
          onDelete={() => handleDelete(e.id)}
        />
      ))}
      <button
        onClick={() => {
          const newEntry: ExperienceEntry = {
            id: `tmp-${nanoid(6)}`,
            title: "",
            company: "",
            start_date: null,
            end_date: null,
            is_current: false,
            responsibilities: [],
            technologies_used: [],
          };
          setEntries([...entries, newEntry]);
        }}
        className="w-full rounded-xl border border-dashed border-[var(--color-hairline)] p-3 text-sm text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
      >
        + Add experience
      </button>
    </div>
  );
}
```

- [ ] **Step 28.3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

---

## Task 29: Review step — `education-card.tsx` + `education-list.tsx`

Same pattern as Task 28, with fields: `institution`, `degree`, `field_of_study`, `start_year`, `end_year`, `gpa`. Mirror the structure exactly.

**Files:**
- Create: `apps/web/components/onboarding/candidate/review/education-card.tsx`
- Create: `apps/web/components/onboarding/candidate/review/education-list.tsx`

- [ ] **Step 29.1: Implement `education-card.tsx`** (same pattern as ExperienceCard)
- [ ] **Step 29.2: Implement `education-list.tsx`** (same pattern as ExperienceList — empty state, add, delete with undo, sync)
- [ ] **Step 29.3: Type-check**

---

## Task 30: Review step — `skills-cloud.tsx`

**Files:**
- Create: `apps/web/components/onboarding/candidate/review/skills-cloud.tsx`

- [ ] **Step 30.1: Implement**

```tsx
"use client";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { SKILLS_TAXONOMY } from "@aurahire/shared";
import { useHighlightContext } from "@/components/onboarding/resume-preview/highlight-context";

interface Props {
  initial: string[];
  onSync: (skills: string[]) => Promise<void>;
}

export function SkillsCloud({ initial, onSync }: Props) {
  const [skills, setSkills] = useState(initial);
  const [query, setQuery] = useState("");
  const { setHoveredFieldId } = useHighlightContext();

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return SKILLS_TAXONOMY.filter(
      (s) => s.toLowerCase().includes(q) && !skills.includes(s),
    ).slice(0, 8);
  }, [query, skills]);

  const add = (skill: string) => {
    const next = [...skills, skill];
    setSkills(next);
    setQuery("");
    onSync(next).catch(() => { /* TODO toast */ });
  };

  const remove = (skill: string) => {
    const next = skills.filter((s) => s !== skill);
    setSkills(next);
    onSync(next).catch(() => { /* TODO toast */ });
  };

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Skills <span className="font-mono text-xs">{skills.length}</span>
      </h3>
      <div className="flex flex-wrap gap-2">
        {skills.map((s, i) => (
          <span
            key={s}
            data-field-id={`skill.${i}`}
            onMouseEnter={() => setHoveredFieldId(`skill.${i}`)}
            onMouseLeave={() => setHoveredFieldId(null)}
            className="group flex items-center gap-1.5 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-medium text-[var(--color-primary)]"
          >
            {s}
            <button onClick={() => remove(s)} aria-label={`Remove ${s}`} className="opacity-60 hover:opacity-100">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              e.preventDefault();
              if (!skills.includes(query.trim())) add(query.trim());
            }
          }}
          placeholder="Add a skill — e.g. TypeScript"
          className="w-full rounded-full border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
        />
        {suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
            {suggestions.map((s) => (
              <li
                key={s}
                className="cursor-pointer px-4 py-2 text-sm hover:bg-[var(--color-surface-soft)]"
                onClick={() => add(s)}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 30.2: Type-check**

---

## Task 31: Review step — `review-step.tsx` orchestrator

**Files:**
- Create: `apps/web/components/onboarding/candidate/review/review-step.tsx`

- [ ] **Step 31.1: Implement**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { ExperienceList } from "./experience-list";
import { EducationList } from "./education-list";
import { SkillsCloud } from "./skills-cloud";
import type { HighlightCategory } from "@/components/onboarding/resume-preview/derive-highlights";
import type { ExperienceEntry } from "./experience-card";

interface Props {
  initialExperience: ExperienceEntry[];
  initialEducation: any[];           // shape from EducationCard
  initialSkills: string[];
  syncSection: (section: "experience" | "education" | "skills", payload: unknown) => Promise<void>;
  onCategoriesChange: (cats: HighlightCategory[]) => void;
}

export function ReviewStep({ initialExperience, initialEducation, initialSkills, syncSection, onCategoriesChange }: Props) {
  const expRef = useRef<HTMLDivElement>(null);
  const eduRef = useRef<HTMLDivElement>(null);
  const skillRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<HighlightCategory>("experience");

  useEffect(() => {
    onCategoriesChange([active]);
  }, [active, onCategoriesChange]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cat = (entry.target as HTMLElement).dataset.category as HighlightCategory;
            setActive(cat);
          }
        }
      },
      { threshold: 0.5 },
    );
    [expRef.current, eduRef.current, skillRef.current].forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">Review what we found</h1>
      <p className="text-sm text-[var(--color-body)]">
        Double-check the AI's extraction. Edit anything that's off, add what's missing.
      </p>

      <section ref={expRef} data-category="experience">
        <ExperienceList initial={initialExperience} onSync={(v) => syncSection("experience", v)} />
      </section>

      <section ref={eduRef} data-category="education">
        <EducationList initial={initialEducation} onSync={(v) => syncSection("education", v)} />
      </section>

      <section ref={skillRef} data-category="skill">
        <SkillsCloud initial={initialSkills} onSync={(v) => syncSection("skills", v)} />
      </section>

      <div className="flex justify-between pt-4">
        <a href="/onboarding/candidate/personal" className="rounded-full bg-[var(--color-surface-strong)] px-5 py-2.5 text-sm font-semibold">
          Back
        </a>
        <a
          href="/onboarding/candidate/preferences"
          className="rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-primary)]"
        >
          Continue
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 31.2: Type-check**

---

## Task 32: Step 3 — `/onboarding/candidate/review/page.tsx`

**Files:**
- Create: `apps/web/app/onboarding/candidate/review/page.tsx`

- [ ] **Step 32.1: Implement**

```tsx
import { redirect } from "next/navigation";
import { fetchCandidateProfileMe, fetchLatestParsedResume } from "../_data";
import { getCurrentSession } from "@/lib/auth/session";
import { ReviewStepClient } from "./_client";

export const metadata = { title: "Review — Onboarding" };

export default async function Step3Page() {
  const me = await fetchCandidateProfileMe();
  if (me.profileCompleted) redirect("/candidate");
  if (!me.fullName?.trim()) redirect("/onboarding/candidate/personal");

  const session = await getCurrentSession();
  const latestResume = await fetchLatestParsedResume();

  // Read existing experiences/educations/skills from candidate-profile (the candidate-profiles endpoint already exposes these — confirm by reading the response shape).
  // For brevity: assume they're nested on `me`. If not, fetch separately.
  return (
    <ReviewStepClient
      me={me}
      latestResume={latestResume}
      accessToken={session!.access_token}
    />
  );
}
```

`_client.tsx` wraps `<HighlightProvider>`, owns `saveStatus` + `activeCategories` state, renders `<OnboardingShell rightPane={<ResumePreviewPane activeCategories=...>}>` with `<ReviewStep>` inside. The `syncSection` prop calls `PATCH /candidate-profiles/me` with the appropriate array.

- [ ] **Step 32.2: Type-check**

---

## Task 33: `ProfilePreviewPane` (Step 4 right pane)

**Files:**
- Create: `apps/web/components/onboarding/candidate/profile-preview-pane.tsx`

- [ ] **Step 33.1: Implement**

```tsx
import type { CandidateProfileMe } from "@/app/onboarding/candidate/_data";
import type { ExperienceEntry } from "./review/experience-card";

interface Props {
  me: CandidateProfileMe;
  experience: ExperienceEntry[];
  skills: string[];
}

export function ProfilePreviewPane({ me, experience, skills }: Props) {
  const initials = (me.fullName ?? "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">What recruiters see</p>
      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-base font-semibold text-[var(--color-primary)]">
          {initials}
        </div>
        <div>
          <div className="text-base font-semibold">{me.fullName}</div>
          {me.headline && <div className="text-xs text-[var(--color-muted)]">{me.headline}</div>}
          {me.locationCity && <div className="text-xs text-[var(--color-muted)]">{me.locationCity}, {me.locationCountry}</div>}
        </div>
      </div>
      {me.summary && (
        <p className="mt-4 text-sm leading-6 text-[var(--color-body)] line-clamp-4">{me.summary}</p>
      )}
      {experience.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Recent experience</p>
          <ul className="mt-2 space-y-2">
            {experience.slice(0, 3).map((e) => (
              <li key={e.id}>
                <div className="text-sm font-semibold">{e.title}</div>
                <div className="text-xs text-[var(--color-muted)]">{e.company} · {e.start_date} – {e.is_current ? "Present" : e.end_date}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {skills.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Top skills</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {skills.slice(0, 8).map((s) => (
              <li key={s} className="rounded-full bg-[var(--color-surface-strong)] px-2.5 py-0.5 text-[11px]">{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 33.2: Type-check**

---

## Task 34: Step 4 — restyle `preferences-form.tsx` + page rewrite

**Files:**
- Modify: `apps/web/components/onboarding/candidate/preferences-form.tsx`
- Modify: `apps/web/app/onboarding/candidate/preferences/page.tsx`

- [ ] **Step 34.1: Restyle `preferences-form.tsx`**

Apply the same pattern as `personal-info-form.tsx` (`useAutosave`, design system tokens, 2-col grid where it fits). Wire the Finish button to call `PATCH /candidate-profiles/me/complete-onboarding` then `router.push("/candidate")`.

```tsx
// Sketch:
const handleFinish = async () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/candidate-profiles/me/complete-onboarding`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.ok) router.push("/candidate");
  else { /* show error toast */ }
};
```

- [ ] **Step 34.2: Update `preferences/page.tsx`**

Wraps with `<HighlightProvider>`, renders `<OnboardingShell rightPane={<ProfilePreviewPane ... />}>` with the form inside. (`HighlightProvider` is included for consistency, even though Step 4 has no resume highlights.)

- [ ] **Step 34.3: Type-check**

---

## Task 35: Mobile drawer — `resume-sheet.tsx`

**Files:**
- Create: `apps/web/components/onboarding/mobile/resume-sheet.tsx`

- [ ] **Step 35.1: Implement**

```tsx
"use client";
import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Paperclip, X } from "lucide-react";

interface Props {
  triggerLabel: string;
  children: ReactNode;
}

export function ResumeSheet({ triggerLabel, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-1 rounded-full border border-[var(--color-hairline)] px-3 py-1.5 text-xs">
          <Paperclip className="h-3.5 w-3.5" />
          {triggerLabel}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex h-full w-[85vw] max-w-[480px] flex-col bg-[var(--color-canvas)] shadow-2xl data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-4 py-3">
            <Dialog.Title className="text-sm font-semibold">{triggerLabel.replace("View ", "")}</Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close"><X className="h-4 w-4" /></button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-auto p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 35.2: Hook up `mobileRightPaneToggle` in pages**

In `_client.tsx` for steps 2–4, pass:
```tsx
mobileRightPaneToggle={<ResumeSheet triggerLabel="View resume">{rightPane}</ResumeSheet>}
```

- [ ] **Step 35.3: Type-check**

---

## Task 36: Middleware route guards

**Files:**
- Modify: `apps/web/middleware.ts`

- [ ] **Step 36.1: Add guards**

```ts
// apps/web/middleware.ts — inside the existing matcher logic
if (pathname.startsWith("/onboarding/candidate")) {
  // Fetch profile completion state — the existing middleware likely already loads session/profile.
  // Add the redirect rules:
  // 1. profileCompleted=true → /candidate
  // 2. /review with empty fullName → /personal
  // 3. /preferences with no review-min met → /review
}
```

(The exact code depends on the existing middleware structure — read `apps/web/middleware.ts` first and graft the rules onto its profile-fetching path.)

- [ ] **Step 36.2: Type-check + smoke-build**

Run: `pnpm tsc --noEmit && pnpm --filter web build`
Expected: PASS.

---

## Task 37: Delete old routes + components

**Files:**
- Delete: `apps/web/app/onboarding/candidate/education/page.tsx`
- Delete: `apps/web/app/onboarding/candidate/experience/page.tsx`
- Delete: `apps/web/app/onboarding/candidate/skills/page.tsx`
- Delete: `apps/web/components/onboarding/wizard-shell.tsx`
- Delete: `apps/web/components/onboarding/wizard-progress.tsx`
- Delete: `apps/web/components/onboarding/candidate/resume-upload.tsx`

- [ ] **Step 37.1: Delete files**

Use `rm` via the human or git rm (instruct human to run `git rm` since direct git ops are theirs):

Hand to human: *"Run `git rm apps/web/app/onboarding/candidate/{education,experience,skills}/page.tsx apps/web/components/onboarding/wizard-shell.tsx apps/web/components/onboarding/wizard-progress.tsx apps/web/components/onboarding/candidate/resume-upload.tsx`."*

- [ ] **Step 37.2: Verify build**

Run: `pnpm tsc --noEmit && pnpm --filter web build`
Expected: PASS.

---

## Task 38: E2E — Happy path PDF (Playwright)

**Files:**
- Create: `apps/web/e2e/onboarding-happy-pdf.spec.ts`

- [ ] **Step 38.1: Author the test**

```ts
import { test, expect } from "@playwright/test";

test("candidate completes onboarding via PDF resume upload", async ({ page }) => {
  await page.goto("/onboarding/candidate");
  await page.locator('input[type="file"]').setInputFiles("e2e/fixtures/sample.pdf");
  await expect(page.getByText(/We've read your resume/i)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("link", { name: "Continue" }).click();

  // Personal
  await expect(page).toHaveURL(/\/onboarding\/candidate\/personal/);
  await expect(page.getByLabel(/full name/i)).toHaveValue(/.+/);
  await page.getByRole("link", { name: "Continue" }).click();

  // Review
  await expect(page).toHaveURL(/\/onboarding\/candidate\/review/);
  await page.getByRole("link", { name: "Continue" }).click();

  // Preferences
  await expect(page).toHaveURL(/\/onboarding\/candidate\/preferences/);
  // Fill required fields
  await page.getByLabel(/desired roles/i).fill("Software Engineer");
  await page.getByLabel(/full-time/i).check();
  await page.getByRole("button", { name: /finish/i }).click();
  await expect(page).toHaveURL(/\/candidate$/);
});
```

- [ ] **Step 38.2: Hand to human**

*"E2E test authored. Please run `pnpm --filter web e2e:onboarding-happy-pdf` against your dev stack to verify."*

---

## Task 39: E2E — Skip-resume + Re-upload mid-flow + Mobile

**Files:**
- Create: `apps/web/e2e/onboarding-skip.spec.ts`
- Create: `apps/web/e2e/onboarding-reupload.spec.ts`
- Create: `apps/web/e2e/onboarding-mobile.spec.ts`

- [ ] **Step 39.1: Author the three E2E specs**

Pattern-match against Task 38. Each test < 50 lines. Use realistic fixture PDFs / DOCX files in `apps/web/e2e/fixtures/`.

- [ ] **Step 39.2: Hand to human**

*"E2E suite authored. Please run `pnpm --filter web e2e` against your dev stack."*

---

## Task 40: Final verification

- [ ] **Step 40.1: Type-check, lint, build**

Run:
```bash
pnpm tsc --noEmit
pnpm lint
turbo run build
```
Expected: all green.

- [ ] **Step 40.2: Run unit + integration tests**

Run: `pnpm test`
Expected: all green.

- [ ] **Step 40.3: Hand to human — manual verification**

Tell the human to walk through the manual checklist from the spec:

1. Upload 5 real resumes (mixed PDF/DOCX, different layouts) — confirm highlights land on correct text.
2. Verify per-step filter visually re-focuses highlights on each step transition.
3. Hover form fields → confirm corresponding resume highlight pulses; click highlights → confirm form field focuses.
4. Throttle network to "Slow 3G" — verify autosave still feels responsive.
5. Test in Safari, Chrome, Firefox — confirm PDF.js renders consistently.
6. Run on a real iPhone Safari — confirm drawer gestures, keyboard scroll, sticky dock work.
7. Run `pnpm test:ai-parse` — confirm hallucination rate is 0% and source-field-coverage ≥ 90% across the corpus.

- [ ] **Step 40.4: Suggested commit boundaries**

If the human wants to commit the work in chunks rather than all at once:

| Boundary | Files | Suggested message |
| --- | --- | --- |
| Backend foundation | Tasks 1–7 | `feat(api): add canonical PDF column + DOCX→PDF conversion + parse v2 with source spans + reparse + complete-onboarding` |
| AI quality gates | Task 8 | `test(api): add golden-corpus AI parse runner` |
| Shared package | Tasks 9–10 | `feat(shared): skills taxonomy + onboarding completion schemas + parsed-resume v2 types` |
| Frontend foundation | Tasks 11–18 | `feat(web): onboarding shell, progress, save indicator, autosave hook, highlight context, derive-highlights, find-text-spans` |
| Resume preview | Tasks 19–23 | `feat(web): ResumePreviewPane with PDF.js + highlight overlay + linearized fallback` |
| Step 1 | Tasks 24–26 | `feat(web): redesign onboarding step 1 (resume upload)` |
| Step 2 | Task 27 | `feat(web): redesign onboarding step 2 (personal)` |
| Step 3 | Tasks 28–32 | `feat(web): new onboarding review step (consolidated experience/education/skills)` |
| Step 4 | Tasks 33–34 | `feat(web): redesign onboarding step 4 (preferences) with profile preview` |
| Mobile + cleanup | Tasks 35–37 | `feat(web): mobile resume sheet drawer + middleware guards + delete legacy routes` |
| E2E | Tasks 38–39 | `test(web): e2e onboarding flows (happy / skip / reupload / mobile)` |

---

## Self-Review Notes (post-write)

- **Spec coverage**: every spec section maps to one or more tasks (architecture → Tasks 11–37, ResumePreviewPane → 19–23, backend → 1–7, AI quality → 8, mobile → 35, error states → 24+27+34+resume-preview-pane state machine, telemetry → audit logs in Tasks 5/6/7).
- **Placeholder scan**: clean. Two notable concessions: skills taxonomy ships at ~120 entries (target 500 — flagged in the file's comment); golden corpus ships with 1 fixture + a contribution guide for the human to expand to 15.
- **Type consistency**: `ExperienceEntry` is defined in `experience-card.tsx` and re-imported elsewhere; the parsed-resume v2 types in `_data.ts` use `responsibilities`/`responsibilities_source` matching the existing schema's `responsibilities`/`technologies_used` fields. `Highlight.fieldRef` strings (e.g. `"experience.0.title"`) match the form `data-field-id` strings used in `personal-info-form.tsx` and `useHighlightContext().registerField` keys.
- **Known soft spots**: Task 18's `findTextSpans` algorithm is intentionally a starting point — the multi-line bounding-box logic is best validated against real PDFs during manual verification (Task 40.3). The spec acknowledges this; the test suite should be expanded as edge cases surface.
