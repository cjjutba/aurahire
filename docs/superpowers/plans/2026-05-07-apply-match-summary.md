# Apply Page - Surface Match Preview, Stop Misleading "Computing" Shimmer · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the candidate apply page from rendering "Computing your match…" copy when the backend is silently reusing a cached preview, by (a) surfacing the existing preview as a read-only summary panel above the form and (b) branching the submit indicator and button label on whether the chosen resume actually matches the preview.

**Architecture:** Frontend-only change. The Next.js server component for the apply page (`apply/page.tsx`) gains a 4th parallel fetch to `GET /api/v1/scoring/match-preview/{jobId}` and forwards the preview (or `null`) to the existing `_apply-form-client.tsx`. A new presentational component, `apps/web/components/score/apply-match-summary.tsx`, renders a read-only mirror of the job-detail Match Preview card - same `ScoreRing`, `MatchBandChip`, `EvidenceCallout` - minus the Recompute button. The form client compares `preview.resumeId` against the picker selection to drive a banner ("locked-in" / "fresh-compute warning" / "no preview yet") and to branch the submit indicator between a plain `Loader2` spinner ("Submitting application…") and the existing `AiShimmer`. Backend is unchanged: the promotion path in `scoring.service.ts:381-409` already reuses the cached AI result when the `(candidate, job, resume)` triple matches.

**Tech Stack:** Next.js 16 App Router (RSC for `page.tsx`, `"use client"` for the form + summary component), React 19, TypeScript strict, Tailwind v4 with brand CSS variables, `lucide-react` for icons, `@aurahire/shared` types. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-07-apply-match-summary-design.md` is authoritative. When in doubt, defer to the spec.

---

## File Structure

### New file

- `apps/web/components/score/apply-match-summary.tsx` - read-only summary panel + the `ApplyMatchPreview` type that both `page.tsx` and `_apply-form-client.tsx` consume.

### Modified files

- `apps/web/app/(candidate)/candidate/jobs/[id]/apply/page.tsx` - add the 4th parallel fetch and forward the preview to the form.
- `apps/web/app/(candidate)/candidate/jobs/[id]/apply/_apply-form-client.tsx` - accept `preview` prop, render the summary, derive `selectedResumeMatchesPreview`, render the banner, branch submit indicator + button copy.

### Untouched (intentionally)

- All NestJS code under `apps/api/`. The backend promotion path already covers everything server-side; touching it would re-open scope.
- `apps/web/app/(candidate)/candidate/jobs/[id]/_match-preview-client.tsx` - the job-detail Match Preview is unchanged.
- `apps/web/components/score/score-ring.tsx`, `match-band-chip.tsx`, `evidence-callout.tsx` - reused as-is.
- `apps/web/components/ai/ai-shimmer.tsx` - used unchanged in the fresh-compute branch only.

### Why a new component, not extracting from `_match-preview-client.tsx`

The job-detail variant has fetch/refetch state, a Recompute button, an empty/loading skeleton, and a "system vs candidate source" badge. The apply variant is purely presentational, has no fetch, has a "switch back to default resume" ribbon when the picker doesn't match, and has a "Locked-in on apply" badge instead of "Auto". Extracting one shared component would require parameterising those differences and would obscure both call-sites. We duplicate the inner `ComponentRow` + `ActiveComponentPanel` markup (~60 LOC) - DRY at the right granularity, not at the page level.

---

## Conventions used in every step

- **Brand tokens only:** `var(--color-primary)`, `var(--color-primary-soft)`, `var(--color-canvas)`, `var(--color-ink)`, `var(--color-body)`, `var(--color-muted)`, `var(--color-hairline)`, `var(--color-hairline-soft)`, `var(--color-surface-strong)`, `var(--color-surface-soft)`, `var(--color-score-high)`, `var(--color-score-high-soft)`, `var(--color-score-mid)`, `var(--color-score-mid-soft)`, `var(--color-score-low)`, `var(--color-score-low-soft)`, `var(--color-on-primary)`, `var(--color-status-danger)`, `var(--color-primary-disabled)`. No raw hex.
- **Radius tokens:** `var(--radius-md)` (12 px) for the banner and ribbon buttons, `var(--radius-lg)` (16 px) on existing cards, `var(--radius-xl)` (24 px) on the summary panel, `var(--radius-pill)` for buttons. Already in use.
- **Strict TS:** no `any`, no new `as` casts. The existing single cast in `_apply-form-client.tsx` (`(await res.json()) as { data: { id: string } }`) stays as-is.
- **No new dependencies.** All needed icons (`Loader2`, `Sparkles`, `ChevronRight`, `AlertCircle`, `RotateCcw`) are already exported by `lucide-react` (which is at `^1.14.0` in `apps/web/package.json`).
- **`Promise.all` failure mode:** if any of the four parallel fetches throws, the whole page errors. Per the spec, the preview fetch is non-fatal - we only treat `ok` responses as successful and otherwise fall through to `null`. If the fetch throws (network error), we let it bubble; this matches the existing fetch contracts for `jobRes` / `resumesRes` / `appsRes` and Next.js will render the route's error boundary.
- **No unit tests added.** The codebase pattern for UI work is `pnpm --filter web type-check` + `pnpm --filter web lint` + manual browser verification by the human. The two existing `*.test.ts` files in `apps/web` cover pure utilities, not React components. This plan follows that pattern; the human is responsible for the manual verification step at the end.
- **No dev-server commands in this plan.** Per `CLAUDE.md` § Hard rules, Claude does not run dev servers. The final verification task documents the human-driven browser test.

---

## Task 1: Create the `ApplyMatchSummary` component (and the shared `ApplyMatchPreview` type)

**Files:**

- Create: `apps/web/components/score/apply-match-summary.tsx`

**What:** A presentational client component that mirrors the loaded variant of `_match-preview-client.tsx` minus the Recompute button. Accepts the preview data, a flag for whether the form's selected resume matches the preview's resume, and a callback to switch the picker back to the preview's resume. Exports the `ApplyMatchPreview` type so the page server component and form client can both reference it.

- [ ] **Step 1: Create the file**

Create `apps/web/components/score/apply-match-summary.tsx` with the following content:

```tsx
"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ChevronRight, RotateCcw, Sparkles } from "lucide-react";

import { EvidenceCallout } from "@/components/score/evidence-callout";
import { MatchBandChip } from "@/components/score/match-band-chip";
import { ScoreRing } from "@/components/score/score-ring";

const COMPONENT_LABELS: Record<string, string> = {
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  cultural_fit: "Cultural Fit",
};

export interface ApplyMatchPreviewEvidence {
  excerpt: string;
  source: string;
  relevance: "positive" | "negative" | "neutral";
  contributionPoints: number | null;
}

export interface ApplyMatchPreviewComponent {
  name: string;
  score: number;
  max: number;
  weight: number;
  explanation: string;
  evidence: ApplyMatchPreviewEvidence[];
}

export interface ApplyMatchPreview {
  id: string;
  jobId: string;
  resumeId: string;
  overallScore: number;
  band: "strong" | "partial" | "limited";
  components: ApplyMatchPreviewComponent[];
  redactedFields: string[];
  promptVersion: string;
  modelUsed: string;
  latencyMs: number;
  source: "system" | "candidate";
  createdAt: string;
}

interface ApplyMatchSummaryProps {
  preview: ApplyMatchPreview;
  /**
   * Whether the resume currently selected in the apply form matches the
   * resume the preview was scored against. Drives the dimmed/ribbon state.
   */
  selectedResumeMatchesPreview: boolean;
  /**
   * Called when the user clicks the "switch back" ribbon - the form client
   * resets the resume picker to `preview.resumeId`.
   */
  onSwitchToPreviewResume: () => void;
}

function bandColors(ratio: number): { fill: string; track: string } {
  if (ratio >= 0.7) {
    return {
      fill: "var(--color-score-high)",
      track: "var(--color-score-high-soft)",
    };
  }
  if (ratio >= 0.4) {
    return {
      fill: "var(--color-score-mid)",
      track: "var(--color-score-mid-soft)",
    };
  }
  return {
    fill: "var(--color-score-low)",
    track: "var(--color-score-low-soft)",
  };
}

function trimQuotes(s: string): string {
  return s
    .replace(
      /^["'`\u201c\u201d\u2018\u2019]+|["'`\u201c\u201d\u2018\u2019]+$/g,
      "",
    )
    .trim();
}

export function ApplyMatchSummary({
  preview,
  selectedResumeMatchesPreview,
  onSwitchToPreviewResume,
}: ApplyMatchSummaryProps) {
  const [activeName, setActiveName] = useState<string>(
    preview.components[0]?.name ?? "",
  );
  const [showAllComponents, setShowAllComponents] = useState(false);

  const active = useMemo(
    () =>
      preview.components.find((c) => c.name === activeName) ??
      preview.components[0] ??
      null,
    [preview, activeName],
  );

  const dimmed = !selectedResumeMatchesPreview;

  return (
    <div
      className={[
        "rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 transition",
        dimmed ? "opacity-60" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {dimmed && (
        <button
          type="button"
          onClick={onSwitchToPreviewResume}
          className="mb-4 flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-strong)] px-3 py-2 text-left text-xs text-[var(--color-body)] transition hover:bg-[var(--color-surface-soft)]"
        >
          <span>
            This was scored against your default resume. Switching back will
            lock in this score.
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 font-medium text-[var(--color-primary)]">
            <RotateCcw className="h-3 w-3" />
            Switch back
          </span>
        </button>
      )}

      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Match Summary
          </h2>
          {!dimmed && (
            <span className="rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
              Locked-in on apply
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-5">
        <ScoreRing
          score={preview.overallScore}
          band={preview.band}
          size="md"
          label="of 100"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <MatchBandChip band={preview.band} />
          <p className="text-xs text-[var(--color-muted)]">
            Computed{" "}
            {new Date(preview.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            · <span className="font-mono">{preview.latencyMs}ms</span> ·{" "}
            {preview.modelUsed}
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-[var(--color-hairline-soft)] pt-4">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Component Breakdown
        </h3>
        <ul className="grid gap-1 sm:grid-cols-2">
          {preview.components.map((c) => (
            <ComponentRow
              key={c.name}
              component={c}
              label={COMPONENT_LABELS[c.name] ?? c.name}
              selected={c.name === activeName}
              onSelect={() => {
                setActiveName(c.name);
                setShowAllComponents(true);
              }}
            />
          ))}
        </ul>
      </div>

      {showAllComponents && active && (
        <ActiveComponentPanel
          component={active}
          label={COMPONENT_LABELS[active.name] ?? active.name}
          className="mt-5 border-t border-[var(--color-hairline-soft)] pt-5"
        />
      )}

      {!showAllComponents && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowAllComponents(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
          >
            Show evidence and explanations
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <p className="mt-5 flex items-start gap-2 border-t border-[var(--color-hairline-soft)] pt-4 text-[11px] text-[var(--color-muted)]">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Personal info was redacted before scoring (
          {preview.redactedFields.length > 0
            ? `${preview.redactedFields.length} fields removed`
            : "no identifying fields detected"}
          ). Score reflects skills + experience match only.
        </span>
      </p>
    </div>
  );
}

function ComponentRow({
  component: c,
  label,
  selected,
  onSelect,
}: {
  component: ApplyMatchPreviewComponent;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const ratio = c.max > 0 ? c.score / c.max : 0;
  const colors = bandColors(ratio);
  const filledPct = ratio * 100;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`group w-full rounded-[var(--radius-md)] px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
          selected
            ? "bg-[var(--color-primary-soft)]"
            : "hover:bg-[var(--color-surface-soft)]"
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`text-sm font-medium ${
              selected
                ? "text-[var(--color-primary)]"
                : "text-[var(--color-ink)]"
            }`}
          >
            {label}
          </span>
          <span className="font-mono text-xs text-[var(--color-muted)]">
            <span
              className={
                selected
                  ? "text-[var(--color-primary)]"
                  : "text-[var(--color-ink)]"
              }
            >
              {c.score}
            </span>
            <span className="text-[var(--color-muted)]"> / {c.max}</span>
          </span>
        </div>
        <div
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-[var(--radius-pill)]"
          style={{ backgroundColor: colors.track }}
        >
          <div
            className="h-full rounded-[var(--radius-pill)]"
            style={{
              width: `${filledPct}%`,
              backgroundColor: colors.fill,
              transition: "width 600ms ease-out",
            }}
          />
        </div>
      </button>
    </li>
  );
}

function ActiveComponentPanel({
  component: c,
  label,
  className,
}: {
  component: ApplyMatchPreviewComponent;
  label: string;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-base font-semibold text-[var(--color-ink)]">
          {label}
        </h3>
        <span className="font-mono text-sm text-[var(--color-muted)]">
          {c.score}
          <span className="text-[var(--color-muted)]"> / {c.max}</span>
          <span className="ml-2 text-[var(--color-muted)]">
            (weight {Math.round(c.weight * 100)}%)
          </span>
        </span>
      </header>
      <p className="text-sm leading-relaxed text-[var(--color-body)]">
        {c.explanation}
      </p>
      {c.evidence.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-3 text-center text-xs text-[var(--color-muted)]">
          No evidence cited for this component.
        </p>
      ) : (
        <div className="space-y-2.5">
          {c.evidence.map((ev, i) => (
            <EvidenceCallout
              key={`${c.name}-ev-${i}`}
              excerpt={trimQuotes(ev.excerpt)}
              source={ev.source}
              relevance={ev.relevance}
              contributionPoints={ev.contributionPoints}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

Notes:

- The `trimQuotes` regex uses Unicode escape sequences (`\u201c\u201d\u2018\u2019`) instead of the literal smart-quote glyphs; both are valid but the escape form survives clipboard round-trips reliably.
- `dimmed` is derived locally from the prop - no extra state, no extra prop, no contradiction risk.
- The component never fetches or imports `createSupabaseBrowserClient`. It is purely presentational.

- [ ] **Step 2: Type-check the new file**

Run from repo root:

```bash
pnpm --filter web type-check
```

Expected: PASS. The component imports only from existing modules; the exported types are self-contained.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/score/apply-match-summary.tsx
git commit -m "$(cat <<'EOF'
feat(candidate-apply): add read-only ApplyMatchSummary component

Mirrors the job-detail Match Preview card layout (ScoreRing + breakdown
+ evidence) but stripped of fetch state and the Recompute button.
Exports the ApplyMatchPreview type for the apply page server component
and form client to share. Not yet wired into the apply flow - that
happens in the next commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add the preview fetch to the apply page server component

**Files:**

- Modify: `apps/web/app/(candidate)/candidate/jobs/[id]/apply/page.tsx`

**What:** Add a 4th parallel fetch to `GET /api/v1/scoring/match-preview/{jobId}`. Treat anything other than a 200 OK with `data` as no-preview. Forward the result (or `null`) to `ApplyFormClient` as a new `preview` prop.

- [ ] **Step 1: Add the import**

Open `apps/web/app/(candidate)/candidate/jobs/[id]/apply/page.tsx`. Find the existing import line:

```ts
import { ApplyFormClient } from "./_apply-form-client";
```

Add directly under it:

```ts
import type { ApplyMatchPreview } from "@/components/score/apply-match-summary";
```

This is a type-only import - safe inside a server component because TypeScript erases it before the React Server Components boundary.

- [ ] **Step 2: Add the 4th parallel fetch**

Find the existing `Promise.all` block (currently lines 46-59):

```ts
const [jobRes, resumesRes, appsRes] = await Promise.all([
  fetch(`${apiUrl}/api/v1/jobs/${jobId}/for-candidate`, {
    headers: authHeaders,
    cache: "no-store",
  }),
  fetch(`${apiUrl}/api/v1/resumes/mine`, {
    headers: authHeaders,
    cache: "no-store",
  }),
  fetch(`${apiUrl}/api/v1/applications/mine`, {
    headers: authHeaders,
    cache: "no-store",
  }),
]);
```

Replace with:

```ts
const [jobRes, resumesRes, appsRes, previewRes] = await Promise.all([
  fetch(`${apiUrl}/api/v1/jobs/${jobId}/for-candidate`, {
    headers: authHeaders,
    cache: "no-store",
  }),
  fetch(`${apiUrl}/api/v1/resumes/mine`, {
    headers: authHeaders,
    cache: "no-store",
  }),
  fetch(`${apiUrl}/api/v1/applications/mine`, {
    headers: authHeaders,
    cache: "no-store",
  }),
  fetch(`${apiUrl}/api/v1/scoring/match-preview/${jobId}`, {
    headers: authHeaders,
    cache: "no-store",
  }),
]);
```

- [ ] **Step 3: Parse the preview response**

Find the existing job/resume body parsing (currently lines 82-86):

```ts
const jobBody = (await jobRes.json()) as { data: JobRecap };
const resumesBody = (await resumesRes.json()) as { data: ResumeRow[] };

const job = jobBody.data;
const parsedResumes = resumesBody.data.filter(
  (r) => r.parseStatus === "parsed",
);
```

Append directly after that block:

```ts
let preview: ApplyMatchPreview | null = null;
if (previewRes.ok) {
  const previewBody = (await previewRes.json()) as {
    data: ApplyMatchPreview | null;
  };
  preview = previewBody.data;
}
```

Notes:

- A 401/404/5xx response returns `null` silently (matches spec edge case "Server-side preview fetch fails (5xx, network error). Treat as no-preview.").
- An empty body - i.e. backend returned 200 with `data: null` because no preview exists yet - also yields `null`. Both code paths converge.

- [ ] **Step 4: Forward the prop to `ApplyFormClient`**

Find the existing render of `ApplyFormClient` (currently line 119):

```tsx
<ApplyFormClient jobId={jobId} resumes={parsedResumes} />
```

Replace with:

```tsx
<ApplyFormClient jobId={jobId} resumes={parsedResumes} preview={preview} />
```

- [ ] **Step 5: Type-check**

Run from repo root:

```bash
pnpm --filter web type-check
```

Expected: PASS. (At this point `ApplyFormClient` does not yet accept `preview`, so TypeScript will likely **fail** here with `Property 'preview' does not exist on type 'IntrinsicAttributes & Props'`. **That's expected and fine for this task - it will pass once Task 3 lands.**)

If you want a clean type-check between commits, you can defer this commit until Task 3 finishes and combine the two. The recommended path is: commit now (failing type-check is acceptable mid-feature), continue to Task 3.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(candidate\)/candidate/jobs/\[id\]/apply/page.tsx
git commit -m "$(cat <<'EOF'
feat(candidate-apply): fetch match preview server-side, pass to form

Adds a 4th parallel fetch to GET /api/v1/scoring/match-preview/{jobId}
in the apply page. Non-fatal on failure (treated as no-preview). The
ApplyFormClient now receives a preview prop it does not yet read -
that's wired in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire `preview` into `ApplyFormClient` - accept prop, render summary, derive match flag

**Files:**

- Modify: `apps/web/app/(candidate)/candidate/jobs/[id]/apply/_apply-form-client.tsx`

**What:** Accept the new `preview` prop, render `<ApplyMatchSummary>` above the resume picker when a preview exists, compute `selectedResumeMatchesPreview`, and add the switch-back callback.

- [ ] **Step 1: Add the import**

Open `apps/web/app/(candidate)/candidate/jobs/[id]/apply/_apply-form-client.tsx`. Find the existing imports block (lines 1-11):

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, FileText, Sparkles, Star } from "lucide-react";

import { AiShimmer } from "@/components/ai/ai-shimmer";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { toastSuccess, toastApiError } from "@/lib/toast";
```

Replace the `lucide-react` import line with:

```tsx
import { Check, FileText, Loader2, Sparkles, Star } from "lucide-react";
```

(Adds `Loader2` for the new spinner; alphabetised.)

Add a new import line directly under the `Textarea` import:

```tsx
import {
  ApplyMatchSummary,
  type ApplyMatchPreview,
} from "@/components/score/apply-match-summary";
```

- [ ] **Step 2: Update the `Props` interface**

Find the existing `Props` interface (currently lines 22-25):

```tsx
interface Props {
  jobId: string;
  resumes: ResumeOption[];
}
```

Replace with:

```tsx
interface Props {
  jobId: string;
  resumes: ResumeOption[];
  preview: ApplyMatchPreview | null;
}
```

- [ ] **Step 3: Update the function signature**

Find the existing function signature (currently line 29):

```tsx
export function ApplyFormClient({ jobId, resumes }: Props) {
```

Replace with:

```tsx
export function ApplyFormClient({ jobId, resumes, preview }: Props) {
```

- [ ] **Step 4: Derive `selectedResumeMatchesPreview` and the switch-back callback**

Find the existing state declarations (currently lines 30-37):

```tsx
const router = useRouter();
const defaultResumeId =
  resumes.find((r) => r.isDefault)?.id ?? resumes[0]?.id ?? "";
const [resumeId, setResumeId] = useState<string>(defaultResumeId);
const [coverLetter, setCoverLetter] = useState<string>("");
const [submitting, setSubmitting] = useState(false);

const charsLeft = COVER_LETTER_MAX - coverLetter.length;
const overLimit = charsLeft < 0;
```

Insert directly after `const overLimit = charsLeft < 0;`:

```tsx
const selectedResumeMatchesPreview =
  preview !== null && preview.resumeId === resumeId;

function switchToPreviewResume() {
  if (preview) setResumeId(preview.resumeId);
}
```

Notes:

- The callback is a regular function declaration (not memoised) because `<ApplyMatchSummary>` doesn't memoise its props - there's nothing to gain from `useCallback` here.
- `selectedResumeMatchesPreview` is derived per-render. With at most a handful of resumes the comparison is free.

- [ ] **Step 5: Render `<ApplyMatchSummary>` above the resume picker**

Find the start of the rendered fragment after the `submitting` early return (currently the line:

```tsx
return (
  <>
    {/* Resume picker card */}
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
```

Insert the summary panel directly inside the fragment, before the resume picker `<section>`:

```tsx
return (
  <>
    {preview && (
      <ApplyMatchSummary
        preview={preview}
        selectedResumeMatchesPreview={selectedResumeMatchesPreview}
        onSwitchToPreviewResume={switchToPreviewResume}
      />
    )}

    {/* Resume picker card */}
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
```

(Everything below the resume picker section stays unchanged.)

- [ ] **Step 6: Type-check**

Run from repo root:

```bash
pnpm --filter web type-check
```

Expected: PASS. Both Task 2 and Task 3 changes now align - `Props.preview` is declared, `page.tsx` passes it, and `ApplyMatchSummary` consumes the matching shape.

- [ ] **Step 7: Lint**

Run:

```bash
pnpm --filter web lint
```

Expected: PASS. Note: if the linter flags `selectedResumeMatchesPreview` or `switchToPreviewResume` as unused (they're consumed by `<ApplyMatchSummary>`, but TS-aware ESLint should see that), no action needed - they're definitely used.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/\(candidate\)/candidate/jobs/\[id\]/apply/_apply-form-client.tsx
git commit -m "$(cat <<'EOF'
feat(candidate-apply): render match summary above the apply form

Wires the new preview prop into ApplyFormClient. Renders
<ApplyMatchSummary> above the resume picker when a preview exists,
derives selectedResumeMatchesPreview from the picker selection, and
exposes a switch-back callback so candidates can return to the
default-resume preview with one click.

The summary is read-only - no Recompute button. Banner copy and
submit-indicator branching are added in the next commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add the conditional banner under the resume picker

**Files:**

- Modify: `apps/web/app/(candidate)/candidate/jobs/[id]/apply/_apply-form-client.tsx`

**What:** Render a one-line status banner directly under the resume picker card. Three states: locked-in (preview matches), warning (preview exists but resume mismatch), neutral (no preview). The banner sits between the resume picker and the cover letter card.

- [ ] **Step 1: Add the banner render block**

Find the resume picker card's closing `</section>` followed by the cover letter card's opening `<section>` (these are adjacent - no whitespace lines between them today). The structure looks like:

```tsx
        </div>
      </section>

      {/* Cover letter card */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
```

Insert a banner between those two sections. Replace the snippet above with:

```tsx
        </div>
      </section>

      <ResumeMatchBanner
        preview={preview}
        selectedResumeMatchesPreview={selectedResumeMatchesPreview}
      />

      {/* Cover letter card */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
```

- [ ] **Step 2: Define the `ResumeMatchBanner` helper at the bottom of the file**

Find the bottom of `_apply-form-client.tsx` (after the `relativeDate` helper). Add this new component definition before the final closing of the file:

```tsx
function ResumeMatchBanner({
  preview,
  selectedResumeMatchesPreview,
}: {
  preview: ApplyMatchPreview | null;
  selectedResumeMatchesPreview: boolean;
}) {
  if (preview && selectedResumeMatchesPreview) {
    return (
      <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] px-4 py-3 text-xs text-[var(--color-primary)]">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">
            Apply to lock in this score - no recompute needed.
          </strong>{" "}
          We&apos;ll attach the match preview shown above to your application.
        </span>
      </div>
    );
  }
  if (preview && !selectedResumeMatchesPreview) {
    return (
      <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-score-mid-soft)] px-4 py-3 text-xs text-[var(--color-score-mid)]">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">
            You picked a different resume than the one your match was scored
            against.
          </strong>{" "}
          We&apos;ll compute a fresh match when you submit.
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] px-4 py-3 text-xs text-[var(--color-body)]">
      <Sparkles
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]"
        aria-hidden
      />
      <span>
        <strong className="font-semibold text-[var(--color-ink)]">
          No match preview yet.
        </strong>{" "}
        We&apos;ll score your resume against this job when you submit.
      </span>
    </div>
  );
}
```

Notes:

- The function is a colocated helper, not exported. It only consumes the two props the form already has, so no extra plumbing.
- The neutral state (no preview) still uses `<Sparkles>` in primary blue - the badge of "AI is involved here" - which matches the project's `badge-ai-suggested` voice in `DESIGN.md`.

- [ ] **Step 3: Type-check**

```bash
pnpm --filter web type-check
```

Expected: PASS.

- [ ] **Step 4: Lint**

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(candidate\)/candidate/jobs/\[id\]/apply/_apply-form-client.tsx
git commit -m "$(cat <<'EOF'
feat(candidate-apply): three-state banner under resume picker

Tells the candidate exactly what will happen on submit: lock in the
existing score (preview matches selected resume), recompute fresh
(preview exists but candidate picked a different resume), or score
from scratch (no preview at all). Tokens-only styling, no new icons.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Branch the submit indicator and submit button copy

**Files:**

- Modify: `apps/web/app/(candidate)/candidate/jobs/[id]/apply/_apply-form-client.tsx`

**What:** When the candidate is on the promotion path (`preview && selectedResumeMatchesPreview`), show a plain spinner + "Submitting application…" instead of the misleading `AiShimmer`, and label the submit button "Lock in match & apply". On every other path (no preview, or resume mismatch), keep the existing `AiShimmer` and "Submit application" button label. Apply to both the desktop action bar and the mobile sticky bar.

- [ ] **Step 1: Replace the `submitting` early-return**

Find the existing `submitting` block (currently lines 108-117):

```tsx
if (submitting) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8">
      <AiShimmer
        caption="Computing your match against this job - analyzing skills, experience, education, and cultural fit..."
        height={240}
      />
    </div>
  );
}
```

Replace with:

```tsx
if (submitting) {
  if (preview && selectedResumeMatchesPreview) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-sm text-[var(--color-body)]">
        <Loader2
          className="h-4 w-4 animate-spin text-[var(--color-primary)]"
          aria-hidden
        />
        <span>Submitting application…</span>
      </div>
    );
  }
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8">
      <AiShimmer
        caption="Computing your match against this job - analyzing skills, experience, education, and cultural fit..."
        height={240}
      />
    </div>
  );
}
```

Notes:

- `Loader2` was already added to the `lucide-react` import in Task 3.
- The spinner branch uses `p-12` (48 px padding) instead of `p-8` to roughly match the visual height of the shimmer, so the layout doesn't jump between the two paths if the page re-renders.

- [ ] **Step 2: Branch the desktop submit button label**

Find the desktop action bar's submit button (currently lines 204-212):

```tsx
<button
  type="button"
  onClick={submit}
  disabled={!resumeId || overLimit}
  className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:cursor-not-allowed disabled:bg-[var(--color-primary-disabled)]"
>
  <Sparkles className="h-4 w-4" />
  Submit application
</button>
```

Replace with:

```tsx
<button
  type="button"
  onClick={submit}
  disabled={!resumeId || overLimit}
  className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:cursor-not-allowed disabled:bg-[var(--color-primary-disabled)]"
>
  <Sparkles className="h-4 w-4" />
  {preview && selectedResumeMatchesPreview
    ? "Lock in match & apply"
    : "Submit application"}
</button>
```

- [ ] **Step 3: Branch the mobile sticky submit button label**

Find the mobile sticky submit button (currently lines 224-232):

```tsx
<button
  type="button"
  onClick={submit}
  disabled={!resumeId || overLimit}
  className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:cursor-not-allowed disabled:bg-[var(--color-primary-disabled)]"
>
  <Sparkles className="h-4 w-4" />
  Submit
</button>
```

Replace with:

```tsx
<button
  type="button"
  onClick={submit}
  disabled={!resumeId || overLimit}
  className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:cursor-not-allowed disabled:bg-[var(--color-primary-disabled)]"
>
  <Sparkles className="h-4 w-4" />
  {preview && selectedResumeMatchesPreview ? "Lock in & apply" : "Submit"}
</button>
```

(Mobile uses the shorter `"Lock in & apply"` because the sticky bar shares horizontal space with the Cancel button - keeping the label concise prevents wrapping on small viewports.)

- [ ] **Step 4: Type-check**

```bash
pnpm --filter web type-check
```

Expected: PASS.

- [ ] **Step 5: Lint**

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(candidate\)/candidate/jobs/\[id\]/apply/_apply-form-client.tsx
git commit -m "$(cat <<'EOF'
feat(candidate-apply): honest submit indicator + button copy

The AiShimmer was running unconditionally on every submit and lying
about computing a match score that the backend was actually loading
from cache. Branch the indicator: spinner + "Submitting application…"
on the promotion path (preview matches selected resume), keep the
shimmer on the fresh-compute path (no preview, or resume mismatch).
Submit button label mirrors the same split.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Manual verification checklist (human-driven)

**Files:** None modified. This task is a verification pass the human runs.

**What:** Per `CLAUDE.md` § Hard rules, Claude does not run `pnpm dev`. The human starts the dev servers (`pnpm dev` from repo root) and walks through three flows in the browser. The summary above passes type-check and lint, but the visual + interaction layer needs eyes.

- [ ] **Step 1: Final type-check + lint pass**

```bash
pnpm --filter web type-check
pnpm --filter web lint
```

Expected: both PASS.

- [ ] **Step 2: Hand off to the human with the verification checklist**

Tell the human: "Type-check and lint are clean. Please run `pnpm dev` and verify the three apply-page paths below in the browser. Report any deviation from the expected behavior so I can fix it."

**Path A - Default resume + existing preview (the original bug case):**

1. Visit a job detail page where the candidate already computed a Match Preview against the default resume. The Match Preview card should show a score (e.g., 76 / 100).
2. Click **Apply Now**.
3. **Expect:** The apply page renders the read-only `Match Summary` panel above the resume picker, with a `Locked-in on apply` pill in the header. The summary shows the same score, breakdown, and evidence as the job-detail Match Preview.
4. **Expect:** The banner under the resume picker says "Apply to lock in this score - no recompute needed." (primary-soft background, primary text).
5. **Expect:** The submit button reads **"Lock in match & apply"**.
6. Click it.
7. **Expect:** A plain spinner with "Submitting application…" - **no AI shimmer, no "Computing your match…" copy**.
8. After redirect, the application detail page shows the same score; no duplicate `score.match.computed` audit row was created (verifiable by checking the `audit_logs` table - the row's `details.promotedFromPreviewId` should be non-null).

**Path B - Non-default resume picked, preview exists against default:**

1. Visit a job detail page with an existing Match Preview.
2. Click **Apply Now**.
3. In the resume picker, pick a _different_ parsed resume (not the default).
4. **Expect:** The summary panel dims (60% opacity), and a small ribbon appears at the top of the panel: "This was scored against your default resume. Switching back will lock in this score." with a "Switch back" affordance.
5. **Expect:** The banner under the picker is amber: "You picked a different resume than the one your match was scored against. We'll compute a fresh match when you submit."
6. **Expect:** Submit button reads **"Submit application"**.
7. Click "Switch back" on the ribbon - the picker should jump back to the default resume, the panel un-dims, and the banner returns to the locked-in state.
8. Switch resumes again, click submit.
9. **Expect:** The `AiShimmer` runs with "Computing your match…" copy - **this branch is honest** (a fresh OpenAI call really is happening).

**Path C - No preview at all:**

1. Visit a job detail page where the candidate has _not_ yet computed a Match Preview (the empty "See my match" state).
2. Click **Apply Now** (the apply button is reachable because `MatchPreviewClient` is empty-state, not blocking).
3. **Expect:** No summary panel renders.
4. **Expect:** The banner under the picker is neutral: "No match preview yet. We'll score your resume against this job when you submit."
5. **Expect:** Submit button reads **"Submit application"**.
6. Click submit.
7. **Expect:** `AiShimmer` runs with "Computing your match…" copy. Honest - there's no cached score to promote.

**Path D - Cross-cutting checks for all three paths:**

- The 409 conflict path (already-applied race) still toasts "Already applied" and redirects back to the job detail page.
- Cancel button on desktop and mobile still pops history.
- Cover letter character counter still works (5,000 limit).
- Mobile sticky submit bar tracks the correct branch ("Lock in & apply" on Path A, "Submit" on B/C).
- No console errors in DevTools during any path.
- No layout jump or flash between resume-picker selections.

- [ ] **Step 3: Address any human-reported issues**

If the human reports a deviation, treat it as a bug-fix follow-up, not a re-plan. Common likely-issues and quick checks:

- _Score panel collapsed flat with no padding._ → Check the parent `<div className="space-y-6">` in `apply/page.tsx` is wrapping the form output; the `<>` fragment in the form client doesn't add a gap, the parent must.
- _Banner not appearing._ → Confirm `<ResumeMatchBanner>` is between `</section>` of the resume picker and `<section>` of the cover letter, and that the prop spread is correct.
- _Submit button label flickers between two values during submit._ → Don't treat `submitting` as a third state for the label - the label is stable based on `(preview, selectedResumeMatchesPreview)`, not on `submitting`. Re-check the boolean expression.

- [ ] **Step 4: Once verified, no further commit needed**

The five commits from Tasks 1-5 already cover the entire feature. Manual verification is acceptance, not code.

---

## Plan self-review

**Spec coverage** (each spec section maps to a task):

| Spec section                                                                   | Implemented in                                              |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Apply page server-side preview fetch                                           | Task 2                                                      |
| `<ApplyMatchSummary>` component contract                                       | Task 1                                                      |
| Three-state banner under resume picker                                         | Task 4                                                      |
| Submit indicator branching (spinner vs `AiShimmer`)                            | Task 5                                                      |
| Submit button label branching ("Lock in match & apply" / "Submit application") | Task 5                                                      |
| Mobile sticky bar follows the same rule                                        | Task 5, Step 3                                              |
| Resume-mismatch dimmed panel + ribbon                                          | Task 1 (component built-in) + Task 3 (switch-back callback) |
| No backend changes                                                             | Confirmed in "Untouched (intentionally)"                    |
| No new audit events                                                            | Confirmed - backend already logs `promotedFromPreviewId`    |
| `ApplyMatchPreview` type re-used by `page.tsx` and form client                 | Task 1 exports it; Tasks 2 + 3 import it                    |
| Acceptance criteria from spec                                                  | Task 6 verification checklist                               |

**Placeholder scan:** No `TODO`, no `TBD`, no "implement later", no "add appropriate error handling", no "similar to Task N". Each step contains the actual code or command needed.

**Type consistency:**

- `ApplyMatchPreview` is defined exactly once (`apply-match-summary.tsx`, Task 1) and imported via type-only import in two places (`page.tsx` Task 2 Step 1, `_apply-form-client.tsx` Task 3 Step 1).
- `selectedResumeMatchesPreview` is computed once (Task 3 Step 4) and consumed in Task 4 (`ResumeMatchBanner` prop), Task 5 Steps 1-3 (submit indicator + button labels). All call sites use the same boolean expression.
- `switchToPreviewResume` is declared once (Task 3 Step 4) and passed once (Task 3 Step 5 to `<ApplyMatchSummary>`'s `onSwitchToPreviewResume` prop).

No inconsistencies found.

---

## Commit count and ordering

Five commits land in this order:

1. `feat(candidate-apply): add read-only ApplyMatchSummary component` (Task 1)
2. `feat(candidate-apply): fetch match preview server-side, pass to form` (Task 2)
3. `feat(candidate-apply): render match summary above the apply form` (Task 3)
4. `feat(candidate-apply): three-state banner under resume picker` (Task 4)
5. `feat(candidate-apply): honest submit indicator + button copy` (Task 5)

Commit 2 type-checks against an out-of-date `_apply-form-client.tsx`; this is acknowledged in Task 2 Step 5 and resolved by commit 3. If green-CI-per-commit is required, fold commits 2 and 3 into a single commit titled `feat(candidate-apply): wire match preview through to apply form`.

No commits touch `apps/api/`. No commits touch the database schema. No new dependencies.
