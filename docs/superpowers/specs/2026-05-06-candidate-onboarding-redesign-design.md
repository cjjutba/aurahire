# Candidate Onboarding Redesign - Two-Pane Wizard with Live Resume Highlights

**Date:** 2026-05-06
**Scope:** All pages under `apps/web/app/onboarding/candidate/`, the shared onboarding layout, supporting components in `apps/web/components/onboarding/`, and targeted backend changes in `apps/api/` (parse-resume prompt, DOCX→PDF conversion, schema, API surface).
**Thesis tie-in:** Doubles as a live demonstration of explainable AI - the candidate sees exactly which fragments of their resume the AI extracted, in their actual document, with per-step focus.

---

## Goals

1. Replace the current 6-step single-column form with a **4-step two-pane wizard**: form on the left, live `ResumePreviewPane` on the right with AI-extracted entities highlighted directly on the rendered PDF.
2. Per-step **highlight filtering**: only the entities relevant to the current step are emphasized; others fade.
3. **Bidirectional hover linking** between form fields and resume highlights.
4. Fix the read-only-looking parsed sections - Education, Experience, Skills get **inline-edit** with add/delete affordances inside a single consolidated **Review** step.
5. **Mobile parity**: < 1024px renders form-only with the resume preview accessible as a slide-in sheet.
6. **Autosave** on every form blur (debounced) so closing the tab is always safe.
7. Maintain AuraHire's design system exactly - no new tokens, no new accent colors, AuraHire Blue stays scarce.

## Non-Goals

- Recruiter onboarding (out of scope; covered by a separate spec).
- Marketing / portal pages outside `/onboarding/candidate/*`.
- New design tokens, fonts, or color additions.
- Real-time multiplayer editing (only single-tab → conflict banner if a second tab saves).
- AI prompt rewrites beyond adding `*_source` fields and bumping the version.
- New AI models - same `gpt-4o-mini` baseline.
- OAuth / SSO changes.

---

## Step Structure

Routes under `apps/web/app/onboarding/candidate/`:

| New route                           | Step                                                               | Replaces                                          |
| ----------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| `/onboarding/candidate`             | 1 · Resume (upload + parse)                                        | unchanged route, redesigned content               |
| `/onboarding/candidate/personal`    | 2 · Personal                                                       | unchanged route, redesigned                       |
| `/onboarding/candidate/review`      | 3 · Review (Education + Experience + Skills as accordion sections) | replaces `/education` + `/experience` + `/skills` |
| `/onboarding/candidate/preferences` | 4 · Preferences                                                    | unchanged route, redesigned                       |

The three deleted routes (`/education`, `/experience`, `/skills`) get removed; their components fold into the Review page. No redirects required - these were not externally linked.

---

## Component Architecture (frontend)

```
apps/web/
├── app/onboarding/
│   ├── layout.tsx                          # unchanged - auth + brand wordmark
│   └── candidate/
│       ├── _data.ts                        # updated step list (4 entries)
│       ├── page.tsx                        # step 1
│       ├── personal/page.tsx               # step 2
│       ├── review/page.tsx                 # step 3 (NEW)
│       └── preferences/page.tsx            # step 4
└── components/onboarding/
    ├── onboarding-shell.tsx                # NEW - top bar + two-pane body
    ├── onboarding-progress.tsx             # NEW - horizontal 4-segment progress
    ├── save-status-indicator.tsx           # NEW - top-bar autosave indicator
    ├── resume-preview/
    │   ├── resume-preview-pane.tsx         # NEW - orchestrator
    │   ├── pdf-renderer.tsx                # NEW - PDF.js wrapper
    │   ├── highlight-overlay.tsx           # NEW - colored rects on top of text layer
    │   ├── linearized-resume-view.tsx      # NEW - fallback for image-only / no-PDF
    │   ├── highlight-context.tsx           # NEW - hover-link context provider
    │   └── derive-highlights.ts            # NEW - turns parsed JSON into Highlight[]
    ├── candidate/
    │   ├── resume-upload-card.tsx          # restyled - replaces resume-upload.tsx
    │   ├── resume-upload-progress.tsx      # NEW - parse phase shimmer + cycling captions
    │   ├── personal-info-form.tsx          # restyled, 2-col grid, AI_SUGGESTED chips
    │   ├── preferences-form.tsx            # restyled
    │   ├── profile-preview-pane.tsx        # NEW - used as right pane on step 4
    │   └── review/
    │       ├── review-step.tsx             # NEW - orchestrates the 3 sections
    │       ├── experience-list.tsx         # NEW - inline-edit cards
    │       ├── experience-card.tsx         # NEW - collapsed/expanded states
    │       ├── education-list.tsx          # NEW
    │       ├── education-card.tsx          # NEW
    │       └── skills-cloud.tsx            # NEW - chips + typeahead
    └── mobile/
        └── resume-sheet.tsx                # NEW - Radix Dialog drawer for < 1024px
```

The existing `wizard-shell.tsx` and `wizard-progress.tsx` get **deleted**; replaced by `onboarding-shell.tsx` + `onboarding-progress.tsx`. Old `resume-upload.tsx` is **deleted** (folded into `resume-upload-card.tsx`).

---

## Step-by-Step Flow

### Step 1 · Resume (`/onboarding/candidate`)

The right pane is collapsed; the left pane is wide and centered. The whole content area is a generous file-upload dropzone using the design system's `file-upload-dropzone` token (200px+ min-height, dashed `hairline` border, drag-over → `primary` border + `primary-soft` bg).

On upload:

1. Frontend posts the file to `POST /resumes/upload` and awaits the response. The existing service runs parse synchronously inside the upload request, so the response carries the final `parseStatus` (no polling needed in the happy path).
2. While the request is in flight: dropzone replaced by a "parsing" card - `ai-shimmer` band with a caption that cycles every 1.5s through _"Reading your resume… → Extracting experience… → Detecting skills… → Almost done…"_
3. On response with `parseStatus = "parsed"`: layout transitions into the two-pane view. Left pane shows a success card - _"Found N items"_ with chips for `5 work experiences · 1 school · 12 skills · 1 cert` - plus a primary "Continue" pill. Right pane fades in the rendered PDF with **all** highlights visible at once (no per-step filter on this step).
4. On response with `parseStatus = "failed"`: error card with two CTAs - `Try again` (re-runs `POST /resumes/:id/reparse`) and `Continue without parsing` (routes to step 2 with empty defaults).
5. **Recovery from a stale `parsing` row**: if `fetchLatestParsedResume()` on page-load returns a row with `parseStatus = "parsing"` (user closed tab mid-upload, server crashed mid-parse), step 1 renders a recovery card: _"A previous upload didn't complete"_ + `Retry parse` (calls `POST /resumes/:id/reparse`) and `Upload a different file` (returns to dropzone).

### Step 2 · Personal (`/onboarding/candidate/personal`)

Left: form with Full Name, Phone, Headline, Summary, City / Region / Country. AI-prefilled fields keep the `AI SUGGESTED` chip; chip flips to a muted `EDITED` state once the field changes (driven by RHF `formState.dirtyFields`). Layout: 2-column grid for Full Name + Phone and City + Region + Country; Headline + Summary full-width. 1-col on phone.

Right: `ResumePreviewPane` with `activeCategories=["contact","summary"]`. All other resume regions are visually de-emphasized via opacity transition. Hovering an input pulses the matched resume span; clicking a highlight focuses the corresponding form field.

### Step 3 · Review (`/onboarding/candidate/review`)

Left: three sections stacked - Experience, Education, Skills - each with a section header showing item count.

**Experience / Education** - inline-expand cards:

```
Collapsed (default):
┌────────────────────────────────────────────────────────────┐
│ Senior Software Engineer · Acme Corp           [✏] [🗑]   │  ← icons visible on hover
│ 2022-01 - Present                                         │
└────────────────────────────────────────────────────────────┘

Expanded (click → edit mode):
┌────────────────────────────────────────────────────────────┐
│ Title              │  Company                              │  ← 2-col on desktop, 1-col phone
│ [_______________]  │  [_______________]                    │
│ Start (YYYY-MM)    │  End (YYYY-MM or "Present")           │
│ [_______________]  │  [_______________]                    │
│ Bullets                                                    │
│ • [____________________________________________]           │
│ • [____________________________________________]           │
│ + Add bullet                                              │
│                                          [Cancel] [Save]  │
└────────────────────────────────────────────────────────────┘
```

State machine: `collapsed → click → expanded(editing) → Save (PATCH) → collapsed | Cancel → collapsed (revert)`.

**Skills** - chip cloud + typeahead:

- Each chip: `primary-soft` bg, `primary` text, X on hover.
- Below the cloud: `<input>` with autocomplete sourced from `packages/shared/skills-taxonomy.ts` plus skills already on the profile.
- Enter or click suggestion → adds chip. X on chip → removes. Both trigger debounced 300ms PATCH.

**Footer per section:** dashed-border CTA pill `+ Add experience` / `+ Add education` / `+ Add skill`.

**Right pane:** `ResumePreviewPane` filters highlights to whichever section is currently in view. Implementation: an `IntersectionObserver` watching the three section headers in the left pane drives `activeCategories`. Scrolling Experience into view → resume highlights only experience entries (others fade to opacity 0.15). Skills section uses a per-skill highlight: hover a skill chip → its `source` string lights up in the resume.

### Step 4 · Preferences (`/onboarding/candidate/preferences`)

Left: form (Desired Roles textarea/comma-separated, Seniority select, Open To checkboxes - Full-time / Part-time / Contract / Remote / Hybrid / On-site, Salary Min / Max / Currency, Available Start Date). Same fields as today, restyled to match the new design.

Right: right pane swaps to `ProfilePreviewPane` showing the recruiter view - avatar + name + headline (or initials avatar plate if no avatar), summary excerpt, top 3 most-recent experiences, top 8 skills as chips, location. This is the candidate's "you're about to be on the platform" moment.

**Finish** button submits to `PATCH /candidate-profiles/me/complete-onboarding` (existing endpoint behavior moved here under a dedicated route for clarity) and routes to `/candidate`.

### Cross-step UX

- **Auto-save** on every form blur (debounced 500ms) → `PATCH /candidate-profiles/me`. Visual feedback: top-bar `save-status-indicator` shows `idle="All changes saved"` / `saving="Saving…"` / `error="Couldn't save - Retry"`.
- **Browser back / forward / direct-URL** all work - each step is a real route with server-rendered defaults from `fetchCandidateProfileMe()` + `fetchLatestParsedResume()`. Form state is local, reseeded from server on mount.
- **Step indicator**: completed steps clickable (jumps back), future steps locked with a small lock glyph, current step highlighted in `primary`.
- **Closing the tab** is safe (everything autosaved). On return, candidate lands on the same step. Tab-close protection (`beforeunload`) only fires if any RHF form has been dirty for > 750ms.

---

## Layout Chrome (`OnboardingShell`)

```
┌─────────────────────────────────────────────────────────────┐
│ AuraHire    [○──○──◐──○]    All changes saved   2 / 4 ▾     │  ← top bar 64px
│             ────────────                                     │     hairline bottom
├──────────────────────────────────┬──────────────────────────┤
│                                  │                          │
│  Tell us about yourself          │  Your Resume       ▾     │
│  Some fields prefilled…          │  ┌────────────────────┐  │
│                                  │  │ [PDF page render]  │  │
│  Full Name        Phone          │  │ with highlights    │  │
│  [____________]   [____________] │  │ over text layer    │  │
│                                  │  └────────────────────┘  │
│  Headline   AI SUGGESTED         │                          │
│  [_________________________]     │                          │
│                                                            │
│  …                                                          │
│                                                            │
│                          [Back]  [Continue]                  │
└──────────────────────────────────┴──────────────────────────┘
       60% (or 1.3 fr)              40% (or 1 fr)
```

**Top bar** (`64px` height):

- AuraHire wordmark left, links to `/`.
- Center: `OnboardingProgress` - 4 horizontal segments, `12px` circles connected by `2px` rules. Each circle: completed = `primary` fill with check; current = `primary` ring on `canvas`; upcoming = `hairline` fill. Labels below segments at `≥ 1024px`. Current label in `primary`, others in `muted`.
- Right: `SaveStatusIndicator` + JetBrains-Mono `2 / 4` counter.
- 1px `hairline-soft` bottom border.

**Body**:

- 1280px max content width on `≥ 1280px`; full bleed below.
- Two-pane CSS grid: `grid-template-columns: 1.3fr 1fr` at `≥ 1024px`; single column below.
- Form pane: `padding: 32px`. Resume pane: `padding: 24px`, `bg: surface-soft`, `border-left: 1px solid hairline`.
- Form card itself uses the design-system `product-ui-card-light` token: `radius-xl` (24px), `1px hairline` border, `shadow: 0 4px 12px rgba(0,0,0,0.04)`.

---

## `ResumePreviewPane` - Implementation Detail

**Library:** `pdfjs-dist` (PDF.js), worker mode, lazy-loaded only on onboarding pages via `next/dynamic` so it doesn't bloat the rest of the app.

**Render pipeline:**

1. Backend returns a signed download URL for the canonical PDF (original PDF or LibreOffice-converted PDF). Frontend never branches on file type.
2. PDF.js renders each page to a `<canvas>` plus a transparent text layer (DOM `<span>` elements positioned exactly over their characters).
3. A separate **highlight overlay layer** sits between canvas and text layer (`z-index: 1`), absolutely positioned per page.

**Highlight data shape:**

```ts
type HighlightCategory =
  | "contact"
  | "summary"
  | "experience"
  | "education"
  | "skill";

type Highlight = {
  id: string; // stable, used for hover linking - e.g. "experience.0.title"
  category: HighlightCategory;
  source: string; // verbatim text from resume to find in the PDF
  fieldRef: string; // form field id to focus on click
  pageHint?: number; // optional, narrows search if backend learns positions later
};
```

**Highlight derivation** (`derive-highlights.ts`): Walks the parsed resume JSON, emits one `Highlight` per `*_source` field. Skipped if `_source` is null/empty (legacy parses without the new prompt).

**Match algorithm** (`pdf-renderer.tsx`, post text-layer render):

```ts
function findTextSpans(textLayer: TextItem[], source: string): Rect[] | null {
  // 1. Build flat character buffer with index→span map.
  // 2. Normalize: collapse whitespace runs to single space, lowercase.
  // 3. Search for normalized(source) in normalized(buffer).
  // 4. If found, translate matched range back to span indices,
  //    return list of bounding boxes (multi-line yields multiple rects).
  // 5. If not found, return null (silent skip + telemetry).
}
```

Whitespace-tolerant, case-insensitive, accent-insensitive (NFD-normalized). Multi-line matches yield one `Rect` per line.

**Highlight overlay rendering:** For each `Highlight` with non-null `Rect[]`, render `<div>` per rect with absolute positioning, `bg: primary-soft`, `mix-blend-mode: multiply`, `border-radius: 3px`, `padding: 0 2px`. Out-of-set highlights get `opacity: 0.15`. Transitions: 200ms ease.

**Per-step filter:** `activeCategories: HighlightCategory[]` prop drives the opacity. On step 3 (Review), the active categories follow the section currently in view via `IntersectionObserver` on section headers.

**Bidirectional hover linking** (`highlight-context.tsx`):

- A React Context exposes `{ hoveredFieldId, setHoveredFieldId, focusField }`.
- Each form input gets `onMouseEnter / onFocus → setHoveredFieldId('experience.0.title')`.
- The pane subscribes; on change, finds matching highlight, scrolls it into view via `scrollIntoView({ block: 'center' })`, applies a 600ms pulse animation (CSS keyframe).
- Each highlight has `data-field-id`. On click, it calls `focusField(id)` which dispatches a custom event that form-field components listen for to call `inputRef.current.focus()`.

**Fallback for image-only PDFs** (`linearized-resume-view.tsx`): If text-layer extraction yields `< 50` total characters across all pages, the pane renders `LinearizedResumeView` instead - `rawText` formatted as styled HTML (preserving line breaks and rough section detection), with substring highlights. Same UX, lower fidelity, no positions.

**State machine:** `loading → ready | error | image-only`. Errors retain the form (left pane keeps working - the resume preview is enrichment, not blocking).

**Component contract:**

```tsx
<ResumePreviewPane
  resumeId={resume.id}
  signedPdfUrl={resume.signedPdfUrl}
  highlights={highlights}
  activeCategories={["contact", "summary"]}
  className="..."
/>
```

---

## Backend Changes

### 1. AI prompt update (`apps/api/src/modules/ai/parse-resume.service.ts`)

Prompt version bumps to next version (e.g. `parse_resume_v3`). The structured-output Zod schema in `packages/shared/` adds `*_source` fields next to every extracted value:

```ts
contact: {
  full_name: string;
  full_name_source: string;            // verbatim, must be substring of rawText
  phone: string | null;
  phone_source: string | null;         // verbatim if phone is present
  email: string | null;
  email_source: string | null;
  location_city: string | null;
  location_city_source: string | null;
  location_country: string | null;
  location_country_source: string | null;
}
summary: { text: string; text_source: string } | null;
experience: Array<{
  title: string; title_source: string;
  company: string; company_source: string;
  start_date: string; end_date: string | null;   // normalized ISO
  period_source: string;                          // verbatim, e.g. "Jan 2022 - Present"
  bullets: string[];
  bullets_source: string[];                       // 1:1 with bullets, verbatim
  skills: string[];
  is_current: boolean;
}>;
education: Array<{
  school: string; school_source: string;
  degree: string | null; degree_source: string | null;
  field: string | null; field_source: string | null;
  start_year: number | null; end_year: number | null;
  period_source: string | null;
  gpa: number | null;
}>;
skills: Array<{ name: string; source: string }>;
certifications: Array<{ name: string; name_source: string; year: number | null; year_source: string | null }>;
parse_confidence: number;
```

Prompt instruction (added to system message): _"For every extracted value, also return its verbatim source string exactly as it appears in the resume. The source string must be a substring of the raw text, character-for-character. Do not paraphrase, normalize, or fix typos in source strings. If a value is null, the corresponding source string is null."_

OpenAI structured-output JSON schema enforces these as required (with `null` allowed where the value itself is null).

**New audit metric:** `source_field_coverage` = % of `*_source` fields successfully populated AND verified as substrings of `rawText`. Recorded on every `resume.parsed` audit log row. Thesis-defensible.

### 2. DOCX → PDF conversion (new: `apps/api/src/modules/storage/docx-to-pdf.service.ts`)

LibreOffice headless wrapped in a NestJS service:

```ts
@Injectable()
export class DocxToPdfService {
  async convert(docxBuffer: Buffer): Promise<Buffer> {
    // 1. Write buffer to temp file
    // 2. Spawn `soffice --headless --convert-to pdf --outdir <tmpdir> <tmpfile>`
    // 3. Read output PDF buffer, clean up tmp files, return.
    // Timeout: 30s. On non-zero exit, throw DocxConversionError.
  }
}
```

LibreOffice serializes per-process (concurrent jobs cause lock contention). Wrap calls behind a simple in-memory mutex queue (1 conversion at a time per container). For volume, this can later move to a dedicated BullMQ queue with a worker, but for sprint scope a mutex is enough.

**Docker image** (`apps/api/Dockerfile`): adds `libreoffice-core libreoffice-writer fonts-liberation` (Debian package list). Adds ~400MB to the API image. Acceptable - single API container.

`ResumesService.upload()` flow becomes:

```
1. Validate + upload original to storage (unchanged).
2. If mimeType === DOCX:
     pdfBuffer = await docxToPdf.convert(originalBuffer);
     canonicalPdfPath = `${userId}/${uuid}.pdf`;
     await storage.upload({ bucket: "resumes", path: canonicalPdfPath, buffer: pdfBuffer });
   Else:
     canonicalPdfPath = null;   // PDF uploads use storagePath directly.
3. Insert resume row with both paths.
4. Run AI parse.
```

If conversion fails, log + continue with `canonicalPdfPath = null`. Frontend gracefully falls back to `LinearizedResumeView`.

### 3. Schema change (`packages/db/src/schema/resumes.ts`)

```sql
ALTER TABLE resumes
  ADD COLUMN canonical_pdf_path text;
```

Nullable. `null` for PDF uploads (frontend uses `storage_path` directly); populated for DOCX uploads. No data migration needed for existing rows.

### 4. API surface

**Existing** `GET /resumes/:id/download-url` - extended response:

```ts
// Before:
{
  signedUrl: string;
  expiresAt: string;
}

// After:
{
  signedUrl: string; // original (for download button)
  signedPdfUrl: string; // canonical PDF (for ResumePreviewPane) - same as signedUrl for PDF uploads
  expiresAt: string;
}
```

`signedPdfUrl` always points to `canonical_pdf_path` if set, else `storage_path`. Frontend uses `signedPdfUrl` exclusively for preview rendering.

**New** `POST /resumes/:id/reparse` - re-runs the parse with the current prompt version against the existing stored resume. Returns the updated resume row. Used by the Step 1 retry CTA and the "New AI suggestion available" mid-flow re-parse.

**Existing** `PATCH /candidate-profiles/me` - already accepts the full profile shape. Stays the patch endpoint for autosave.

**Renamed/clarified** `PATCH /candidate-profiles/me/complete-onboarding` - dedicated endpoint for the Finish button. Validates final completion (Zod check: `profileCompleted` requirements per design system). Sets `profileCompleted = true` and writes the `onboarding.completed` audit log.

### 5. Backwards compat for existing parsed resumes

Resumes already parsed with the old prompt will not have `*_source` fields. The frontend's `ResumePreviewPane` checks per highlight: if `_source` is missing/empty, that highlight is skipped (still renders the rest). PDF still displays. No backfill required. Re-uploads or explicit re-parse calls naturally pick up the new prompt.

---

## Form Behavior

| Step                       | Save trigger                       | Endpoint                              | Behavior                                                                         |
| -------------------------- | ---------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| 2 · Personal               | Field `onBlur`, debounced 500ms    | `PATCH /candidate-profiles/me`        | Single-field patch payload                                                       |
| 3 · Review (cards)         | "Save" button inside expanded card | `PATCH /candidate-profiles/me`        | Sends the full updated `experience[]` / `education[]` array - atomic per section |
| 3 · Review (skills)        | Chip add/remove                    | `PATCH /candidate-profiles/me`        | Sends full updated `skills[]` array, debounced 300ms to coalesce rapid edits     |
| 4 · Preferences            | Field `onBlur`, debounced 500ms    | `PATCH /candidate-profiles/me`        | Single-field patch                                                               |
| Step transition (Continue) | Click                              | flushes pending debounce, then routes | -                                                                                |

**Inline edit state machine** (each card):

```
collapsed → click → expanded(editing)
                       ├─ Save  → PATCH succeeds → collapsed (with new values)
                       │         PATCH fails    → expanded + inline error banner, retry
                       └─ Cancel → collapsed (revert local state)
```

**Optimistic delete:** Trash icon does an optimistic remove → toast appears with "Undo" link (5s timeout) before the network call commits. Click Undo within 5s → restored. Otherwise commits.

**Adding new entries:** Footer dashed-border CTA in each section creates a temporary client-side entry with a synthesized id (e.g. `"experience.tmp-${nanoid(6)}"`), opens it pre-expanded in edit mode. Save commits it as a real entry (server assigns real id on next fetch). Cancel discards.

**Skills typeahead:** Static common-skills list at `packages/shared/src/skills-taxonomy.ts` (~500 common tech skills as a starting set). Fuzzy match on input. Plus existing profile skills (avoid suggesting already-added).

**Validation:** Zod schemas in `packages/shared/onboarding/` are the single source of truth - used by `nestjs-zod` on the backend and `@hookform/resolvers/zod` on the frontend. Per-step "completion schemas" gate the Continue button:

```ts
// packages/shared/src/onboarding/personal.schema.ts
export const personalCompleteSchema = z.object({
  fullName: z.string().min(1),
  // phone, headline, summary, location all optional
});

// review-complete.schema.ts
// At least one of: experience.length >= 1 OR education.length >= 1 OR skills.length >= 3.
// (Otherwise the candidate has nothing to be matched against.)
```

Missing required field → Continue button disabled with tooltip "Add your full name to continue". Inline field errors use design system error pattern: 2px `status-danger` border + alert-circle icon + red helper text below.

**`AI_SUGGESTED` chip lifecycle:** Field starts with chip if value came from parsing. On first user keystroke (`formState.dirtyFields[name] === true`), chip flips to `EDITED` (`muted` text, no icon). Reset to original value flips back. Pure local state - not persisted.

**Save status indicator** - single global indicator in the top bar:

- `idle` → "All changes saved" with check icon
- `saving` → "Saving…" with spinner
- `error` → "Couldn't save - Retry" link

**Tab-close protection:** `beforeunload` listener triggers when any RHF form has been dirty for > 750ms (avoids prompts during normal typing). Inline edit cards count: closing while a card is expanded with unsaved edits also triggers.

**Failure handling:**

- Network error → in-flight Save retries 1× silently, then surfaces inline retry button.
- 401 (token expired) → toast + redirect to `/login?next=/onboarding/candidate/<step>`.
- Validation error from server → field-level error mapping; if no field can be matched, generic banner.
- 409 (conflict, second tab saved) → non-blocking banner: _"Profile changed in another window - refresh to see the latest"_ + Refresh link.

---

## Responsive Behavior

| Range         | Treatment                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------- |
| ≥ 1280px      | Wide: max content cap 1280px, two-pane 1.3 : 1                                            |
| 1024 - 1280px | Desktop: full two-pane, same ratio                                                        |
| 640 - 1024px  | Tablet: single column, resume → slide-in sheet, form fields stay 2-col where space allows |
| < 640px       | Phone: single column, resume → slide-in sheet, all form fields stack 1-col                |

**Top bar at < 1024px:** wordmark + step counter only. The 4-segment progress collapses to a single slim 4px progress bar that spans the full viewport width directly under the header.

**Resume → slide-in sheet** (`mobile/resume-sheet.tsx`):

- Pinned pill button "View resume" with paperclip icon in the top bar (right side). Label changes to "View preview" on Preferences step.
- Tap → Radix Dialog with `data-side="right"`. Width 85vw, max 480px on tablet. Semi-opaque scrim backdrop; tap-out / X / Esc / swipe-right to dismiss.
- Drawer renders the same `ResumePreviewPane`. Per-step highlight filtering, hover linking (touch: tap a highlight → drawer auto-closes + form field focuses), and pinch-zoom all work unchanged.
- First open lazy-loads the PDF.

**Inline edit cards on phone:** field grid collapses to 1-col stacked. Trash & pencil icons visible by default (no hover state).

**Form layouts on phone:** Headline and Summary always full-width; other fields stack 1-col.

**Step navigation buttons on phone:** sticky bottom dock with iOS safe-area-inset-bottom. Back as secondary text link above; Continue as full-width primary pill below.

**Touch targets:** every tappable element ≥ 44px tall. Trash/pencil icons get a 44 × 44 hit area.

**Keyboard on mobile:** `scrollIntoView({ block: 'center' })` on input focus. Sticky bottom dock collapses while keyboard is up.

**Accessibility:** progress bar has `role="progressbar"` + `aria-valuenow`/`aria-valuemax`; sheet drawer has focus trap + restore (Radix handles); PDF.js text layer keeps native text-selection for screen readers.

---

## Error & Empty States

### A. Upload errors (Step 1)

| Cause                      | UX                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------ |
| File > 10MB                | Inline dropzone error: "File exceeds 10MB. Try compressing or use a different file." |
| Unsupported format         | "Only PDF and DOCX files are accepted."                                              |
| Network drop during upload | Auto-retry 1× silently. Then banner + retry + "Continue without resume" link.        |
| Storage upload failure     | Same banner. Audit log captures error.                                               |

### B. AI parse failures (Step 1, after upload)

| Cause                                   | UX                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Parse timeout (> 60s)                   | Loading caption changes to "Parse is taking too long" → CTAs surface: **Try again** + **Continue without parsing**.                                          |
| Parse error (invalid JSON, OpenAI down) | `parseStatus = 'failed'`. Banner with retry. Subsequent steps still navigable; right pane shows "Couldn't parse this resume" empty state with re-parse link. |
| `parse_confidence < 0.4`                | Soft warning above step-2 form: "We had a hard time reading this resume - please double-check the prefilled values."                                         |

### C. PDF render failures (`ResumePreviewPane`)

| Cause                                       | UX                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Image-only PDF (text layer < 50 chars)      | Auto-fallback to `LinearizedResumeView`. Caption: "Showing a text version of your resume."     |
| DOCX → PDF conversion failed                | Backend left `canonical_pdf_path = null`. Frontend falls through to linearized fallback.       |
| PDF.js bundle/CDN error                     | Pane shows: "Couldn't load resume preview." + download link. Form fully functional. Telemetry. |
| Highlight `_source` not found in text layer | Highlight silently skipped. Telemetry event `highlight_miss` with field + source string.       |

### D. Skip / no resume

A small "Skip - I'll fill in manually" text link at the bottom of step 1. Routes to step 2. Right pane on subsequent steps shows: _"No resume uploaded yet - your prefill suggestions will be more accurate with one"_ + small upload button.

### E. Re-upload mid-flow

Right-pane header has an inline "Replace resume" link visible on every step ≥ 2. Triggers same upload flow as step 1. On successful re-parse:

- **Pristine fields** (form value matches old prefill) get refreshed; `AI_SUGGESTED` chip pulses briefly.
- **Dirty fields** (user edited them) keep the user's value untouched. A "New AI suggestion available - apply?" indicator appears.
- New parsed arrays (experience, education, skills) merge into existing arrays via id-stable diff: items the user added/edited preserved, AI re-extractions added as new entries.

### F. Empty parsed sections

Review step renders an empty state per section (rather than hiding):

| Section    | Empty state                                                        |
| ---------- | ------------------------------------------------------------------ |
| Experience | "No work experience parsed from your resume." + `+ Add experience` |
| Education  | "No education parsed." + `+ Add education`                         |
| Skills     | "No skills found." + typeahead input prefilled and focused         |

### G. Direct-URL access guards (`apps/web/middleware.ts`)

| URL accessed                  | Condition                    | Result                   |
| ----------------------------- | ---------------------------- | ------------------------ |
| Any `/onboarding/candidate/*` | `profileCompleted = true`    | Redirect to `/candidate` |
| `/personal`                   | No upload + no profile data  | Allowed (skip path)      |
| `/review`                     | Personal full-name missing   | Redirect to `/personal`  |
| `/preferences`                | Review-complete schema fails | Redirect to `/review`    |

Backend always validates final completion at `PATCH /complete-onboarding`.

### H. Auth expiry mid-flow

Supabase token expires after 1h; refresh happens silently via `@supabase/ssr`. If refresh fails (refresh token revoked) → next API call returns 401 → toast + redirect to `/login?next=/onboarding/candidate/<step>`. On return, candidate lands on the same step with all previously-saved data intact.

### I. Telemetry events

| Event                       | Fields                                                               |
| --------------------------- | -------------------------------------------------------------------- |
| `resume.uploaded`           | mime, size, isFirst                                                  |
| `resume.parsed`             | promptVersion, modelUsed, latencyMs, confidence, sourceFieldCoverage |
| `resume.parse_failed`       | error, retryCount                                                    |
| `resume.reparsed`           | resumeId, promptVersion, dirtyFieldsPreserved                        |
| `onboarding.step_completed` | step, durationMs                                                     |
| `onboarding.field_edited`   | field, wasAiSuggested                                                |
| `resume.highlight_miss`     | field, sourceString (truncated to 80 chars)                          |
| `onboarding.completed`      | totalDurationMs, stepsCompleted                                      |

---

## Testing

### Unit tests (`vitest`)

**Frontend:**

- `OnboardingProgress`: completed / current / upcoming states; label collapse < 1024px; ARIA roles.
- `ResumePreviewPane.findTextSpans()`: verbatim, whitespace-tolerant, multi-line, case-insensitive, accent-insensitive, not-found returns null.
- Inline edit state machine: transitions correct; dirty-state preserved across edits.
- `AI_SUGGESTED` chip lifecycle: initial render, flip on first keystroke, revert on reset.
- Per-step Zod completion schemas correctly gate Continue.
- Save status indicator: idle → saving → idle / error states.

**Backend:**

- `DocxToPdfService.convert()`: mock LibreOffice spawn, buffer in/out, error path on non-zero exit, 30s timeout.
- `parse-resume.service`: mocked OpenAI, structured output validation, `*_source` substring verification.
- `ResumesService.upload()` for both PDF and DOCX paths, audit logs written.
- Middleware route guards: 8 access scenarios from §G.

### Integration tests (`@nestjs/testing` + Supabase test DB)

- `POST /resumes/upload` PDF end-to-end: parsed result includes `*_source` fields, audit logs written.
- DOCX upload → canonical PDF generated, both files in storage, `canonical_pdf_path` set.
- `PATCH /candidate-profiles/me` array replacement (experience, education, skills) - atomic, validated, audit-logged.
- Re-parse flow: `POST /resumes/:id/reparse` preserves dirty fields semantics (frontend test).

### E2E tests (Playwright, against the dev stack the human runs)

Five flows that must pass:

1. **Happy path PDF**: upload → parse → all 4 steps → dashboard.
2. **Happy path DOCX**: same; verifies LibreOffice path renders in pane.
3. **Skip resume**: skip → manual fill → complete.
4. **Re-upload mid-flow**: replace resume on step 3, dirty Personal field preserved, new experience entries merged.
5. **Mobile (viewport 375 × 812)**: drawer open/close, sticky bottom dock, keyboard scroll-into-view.

### AI quality gates

A **golden corpus** of 15 fixture resumes at `apps/api/test/fixtures/resumes/`, mix of PDF/DOCX, plain/styled, different industries, edge cases (image-only, multilingual). Each fixture has an adjacent `.expected.json` with canonical extraction.

`pnpm test:ai-parse` runs the new prompt against the corpus and asserts:

| Metric                                                                    | Threshold          |
| ------------------------------------------------------------------------- | ------------------ |
| Contact precision/recall                                                  | ≥ 0.95 / ≥ 0.95    |
| Experience entries (count match)                                          | exact              |
| Skills (Jaccard with expected)                                            | ≥ 0.85             |
| `source_field_coverage`                                                   | ≥ 0.90             |
| **Source-string hallucination rate** (sources not substring of `rawText`) | **0% - hard fail** |

Prompt-version bumps cannot land unless the corpus passes. Result CSV attached to the PR for review.

### Accessibility

`@axe-core/playwright` - every step page asserted with zero axe violations on both desktop and mobile viewports. Manual keyboard-only walkthrough: Tab → Enter → Esc → focus restored.

### Visual regression

Playwright screenshots checked into the repo for each step at 1280px / 768px / 375px, both `AI_SUGGESTED` and `EDITED` chip states, inline-edit collapsed/expanded, `ResumePreviewPane` with highlights filtered to each category. Threshold: 0.1% pixel difference.

### Type / lint / build gates

`pnpm tsc --noEmit`, `pnpm lint`, `turbo run build` all green.

### Manual verification (the human runs this)

Before sign-off:

1. Upload 5 real resumes (mixed PDF/DOCX, different layouts) - confirm highlights land on correct text.
2. Verify per-step filter visually re-focuses highlights on each step transition.
3. Hover form fields → confirm corresponding resume highlight pulses; click highlights → confirm form field focuses.
4. Throttle network to "Slow 3G" - verify autosave still feels responsive or surfaces clear status.
5. Test in Safari, Chrome, Firefox - confirm PDF.js renders consistently.
6. Run on a real iPhone Safari - confirm drawer gestures, keyboard scroll, sticky dock work.

---

## Migration & Rollout

- No DB data migration required. New column is nullable.
- Existing parsed resumes work without highlights (graceful degradation).
- No flag-gating - the redesign ships as a single drop. Existing in-flight onboarding sessions (rare given onboarding is short) will see a state transition; their saved data is preserved.
- The 3 deleted routes (`/education`, `/experience`, `/skills`) get removed in the same PR. They are not externally linked.

---

## Out of Scope / Future Work

- Recruiter onboarding redesign (separate spec).
- Real-time collaborative editing (multi-tab today gets conflict banner only).
- Per-recruiter "view as recruiter" preview on Step 4 (currently shows generic profile).
- Saving the source-position computation server-side (currently client-side every load - acceptable for a 4-page flow).
- Beefier image-only PDF support via OCR (currently falls back to linearized text).
- Undo stack beyond the 5s toast on delete.

---

## Definition of Done

1. All 4 routes renderable; old 6 routes removed.
2. PDF.js highlights working on real resumes with `≥ 90%` source-field coverage.
3. DOCX upload → conversion → preview round-trip works.
4. Inline edit / add / delete works on every Review section.
5. Autosave indicator behavior correct in all 3 states.
6. Mobile drawer works on real iPhone Safari.
7. All E2E flows pass; golden-corpus AI quality gates pass; all unit + integration tests pass.
8. `pnpm tsc --noEmit`, `pnpm lint`, `turbo run build` all green.
9. Manual verification checklist signed off by the human.
10. Audit logs visible in `audit_logs` for every consequential action.
