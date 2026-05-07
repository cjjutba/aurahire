# Onboarding Resume Parse → Auto-Advance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `ParseSuccessCard` interstitial with a continuous parsing → done arc inside `ParsingProgressCard` that auto-advances the candidate to Step 2, where the existing AI Suggested badges carry the explanation. Add a `Replace resume` affordance in the resume preview pane and a low-confidence banner above Step 2 / Step 3 forms.

**Architecture:** Frontend-only change in `apps/web`. The parsing card gains a `done` state with auto-advance; the orchestrator (`ResumeUploadCard`) renders that card in done-mode instead of swapping to a separate success card. Step 1 page issues a server-side redirect for returning users with parsed resumes; the replace flow uses a `?replace=1` URL param to skip the redirect. A new presentational banner component surfaces `parse_confidence === "low"` on the form steps.

**Tech Stack:** Next.js 16 App Router (Server Components + Client Components), Vitest + jsdom + @testing-library/react for unit tests, TailwindCSS with project-defined CSS variables for tokens, existing keyframes in `apps/web/app/globals.css`.

**Spec:** [`docs/superpowers/specs/2026-05-07-onboarding-resume-parse-auto-advance-design.md`](../specs/2026-05-07-onboarding-resume-parse-auto-advance-design.md)

---

## Reference: file structure changes

**Create:**
- `apps/web/components/onboarding/candidate/low-confidence-banner.tsx`
- `apps/web/components/onboarding/candidate/low-confidence-banner.test.tsx`
- `apps/web/components/onboarding/candidate/parsing-progress-card.test.tsx`

**Modify:**
- `apps/web/components/onboarding/candidate/parsing-progress-card.tsx`
- `apps/web/components/onboarding/candidate/resume-upload-card.tsx`
- `apps/web/app/onboarding/candidate/page.tsx`
- `apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx`
- `apps/web/app/onboarding/candidate/personal/_client.tsx`
- `apps/web/app/onboarding/candidate/review/_client.tsx`

**Delete:**
- `apps/web/components/onboarding/candidate/parse-success-card.tsx`

**Test runner:** `pnpm --filter @aurahire/web test` (one-shot Vitest run). Watch mode: `pnpm --filter @aurahire/web test:watch`.

**Type checker:** `pnpm --filter @aurahire/web type-check`.

**Linter:** `pnpm --filter @aurahire/web lint`.

---

## Task 1: Extend `ParsingProgressCard` with a `done` state

**Files:**
- Modify: `apps/web/components/onboarding/candidate/parsing-progress-card.tsx`
- Create: `apps/web/components/onboarding/candidate/parsing-progress-card.test.tsx`

The current `ParsingProgressCard` runs a four-stage time curve and never resolves the fourth stage. It needs:

1. New props: `parseStatus: "parsing" | "done"`, `parsed: ParsedResumeV2 | null`, `onAutoAdvance?: () => void`.
2. When `parseStatus === "done"`: force `activeIdx` to `STAGES.length` (4) so all four stages render as `done`; replace the indeterminate sweep bar with a static fill; render a `Done · ...` summary line; swap the caption above the file row from "Hang tight..." to "Routing to your details..."; fire `onAutoAdvance` after 1500 ms.
3. The `Hang tight — this usually takes 5–15 seconds.` caption (currently rendered by `ResumeUploadCard` outside the card) moves *into* `ParsingProgressCard` so it can swap with status.

- [ ] **Step 1: Create the test file with the first failing test (parsing state still renders)**

Create `apps/web/components/onboarding/candidate/parsing-progress-card.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ParsingProgressCard } from "./parsing-progress-card";
import type { ParsedResumeV2 } from "@/app/onboarding/candidate/_steps";

const FILE = { name: "resume.pdf", size: 10240, type: "application/pdf" };

function makeParsed(
  partial: Partial<{
    experience: number;
    education: number;
    skills: number;
    certifications: number;
    confidence: "high" | "medium" | "low";
  }> = {},
): ParsedResumeV2 {
  const exp = partial.experience ?? 3;
  const edu = partial.education ?? 1;
  const skl = partial.skills ?? 12;
  const crt = partial.certifications ?? 1;
  return {
    contact: {
      full_name: null, full_name_source: null,
      email: null, email_source: null,
      phone: null, phone_source: null,
      location_city: null, location_city_source: null,
      location_country: null, location_country_source: null,
      linkedin_url: null, linkedin_url_source: null,
      portfolio_url: null, portfolio_url_source: null,
    },
    summary: null,
    education: Array.from({ length: edu }, () => ({
      institution: "Stanford", institution_source: "Stanford",
      degree: null, degree_source: null,
      field_of_study: null, field_of_study_source: null,
      start_year: null, end_year: null, period_source: null,
      gpa: null, gpa_source: null,
    })),
    experience: Array.from({ length: exp }, () => ({
      company: "Acme", company_source: "Acme",
      title: "Engineer", title_source: "Engineer",
      start_date: null, end_date: null, period_source: "",
      is_current: false, responsibilities: [], responsibilities_source: [],
      technologies_used: [],
    })),
    skills: Array.from({ length: skl }, (_, i) => ({
      name: `skill-${i}`, source: `skill-${i}`,
    })),
    certifications: Array.from({ length: crt }, () => ({
      name: "AWS", name_source: "AWS",
      issuing_organization: null, issuing_organization_source: null,
      issue_date: null, issue_date_source: null,
      expires: null,
    })),
    languages: [],
    parse_confidence: partial.confidence ?? "high",
  };
}

describe("ParsingProgressCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders all four stage labels in parsing state", () => {
    render(
      <ParsingProgressCard
        file={FILE}
        parseStatus="parsing"
        parsed={null}
      />,
    );
    expect(screen.getByText("Uploading file")).toBeInTheDocument();
    expect(screen.getByText("Extracting text")).toBeInTheDocument();
    expect(screen.getByText("Identifying experience & skills")).toBeInTheDocument();
    expect(screen.getByText("Polishing the details")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test — it should pass against the current implementation**

```bash
pnpm --filter @aurahire/web test parsing-progress-card
```

Expected: PASS (first test verifies existing behavior).

- [ ] **Step 3: Add the failing tests for the new `done` state**

Append inside the existing `describe("ParsingProgressCard", ...)` block in the same test file:

```tsx
  it("renders the 'Done · ...' summary line when parseStatus is 'done'", () => {
    render(
      <ParsingProgressCard
        file={FILE}
        parseStatus="done"
        parsed={makeParsed({ experience: 3, education: 1, skills: 12, certifications: 1 })}
      />,
    );
    const line = screen.getByTestId("parse-done-summary");
    expect(line).toHaveTextContent(
      "Done · 3 experiences, 1 school, 12 skills, 1 cert extracted",
    );
  });

  it("omits zero-count categories from the summary line", () => {
    render(
      <ParsingProgressCard
        file={FILE}
        parseStatus="done"
        parsed={makeParsed({ experience: 2, education: 0, skills: 5, certifications: 0 })}
      />,
    );
    const line = screen.getByTestId("parse-done-summary");
    expect(line).toHaveTextContent("Done · 2 experiences, 5 skills extracted");
    expect(line).not.toHaveTextContent("school");
    expect(line).not.toHaveTextContent("cert");
  });

  it("appends 'Some fields may need review' suffix on low confidence", () => {
    render(
      <ParsingProgressCard
        file={FILE}
        parseStatus="done"
        parsed={makeParsed({ confidence: "low", experience: 1, education: 1, skills: 4, certifications: 0 })}
      />,
    );
    const line = screen.getByTestId("parse-done-summary");
    expect(line).toHaveTextContent("Some fields may need review");
  });

  it("does not append the low-confidence suffix on high or medium confidence", () => {
    render(
      <ParsingProgressCard
        file={FILE}
        parseStatus="done"
        parsed={makeParsed({ confidence: "medium" })}
      />,
    );
    expect(screen.queryByText(/Some fields may need review/)).toBeNull();
  });

  it("swaps the caption above the file row when in done state", () => {
    const { rerender } = render(
      <ParsingProgressCard
        file={FILE}
        parseStatus="parsing"
        parsed={null}
      />,
    );
    expect(screen.getByTestId("parse-caption")).toHaveTextContent(
      "Hang tight — this usually takes 5–15 seconds.",
    );
    rerender(
      <ParsingProgressCard
        file={FILE}
        parseStatus="done"
        parsed={makeParsed()}
      />,
    );
    expect(screen.getByTestId("parse-caption")).toHaveTextContent(
      "Routing to your details...",
    );
  });

  it("fires onAutoAdvance exactly once 1500 ms after entering 'done'", () => {
    const onAutoAdvance = vi.fn();
    render(
      <ParsingProgressCard
        file={FILE}
        parseStatus="done"
        parsed={makeParsed()}
        onAutoAdvance={onAutoAdvance}
      />,
    );
    expect(onAutoAdvance).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(onAutoAdvance).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onAutoAdvance).toHaveBeenCalledTimes(1);
    // Should not fire again on additional time advance.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onAutoAdvance).toHaveBeenCalledTimes(1);
  });

  it("does not fire onAutoAdvance while still in 'parsing' state", () => {
    const onAutoAdvance = vi.fn();
    render(
      <ParsingProgressCard
        file={FILE}
        parseStatus="parsing"
        parsed={null}
        onAutoAdvance={onAutoAdvance}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onAutoAdvance).not.toHaveBeenCalled();
  });

  it("clears the auto-advance timer if unmounted before it fires", () => {
    const onAutoAdvance = vi.fn();
    const { unmount } = render(
      <ParsingProgressCard
        file={FILE}
        parseStatus="done"
        parsed={makeParsed()}
        onAutoAdvance={onAutoAdvance}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onAutoAdvance).not.toHaveBeenCalled();
  });
```

- [ ] **Step 4: Run tests — the new ones should fail**

```bash
pnpm --filter @aurahire/web test parsing-progress-card
```

Expected: FAIL on every test that touches `parseStatus="done"` — e.g. `getByTestId("parse-done-summary")` returns null. The `parsing` test still passes.

- [ ] **Step 5: Update `parsing-progress-card.tsx` to support the `done` state**

Replace the entire contents of `apps/web/components/onboarding/candidate/parsing-progress-card.tsx` with:

```tsx
// apps/web/components/onboarding/candidate/parsing-progress-card.tsx
"use client";

import { useEffect, useState } from "react";
import { Check, FileText, Loader2 } from "lucide-react";
import type { ParsedResumeV2 } from "@/app/onboarding/candidate/_steps";

interface ParsingProgressCardProps {
  file: { name: string; size: number; type: string } | null;
  /** Default "parsing" so existing call sites type-check until Task 3 rewires them. */
  parseStatus?: "parsing" | "done";
  /** Required when parseStatus === "done"; ignored otherwise. */
  parsed?: ParsedResumeV2 | null;
  /** Fired exactly once, ~1500 ms after entering "done". */
  onAutoAdvance?: () => void;
}

type StageId = "upload" | "extract" | "identify" | "polish";

interface Stage {
  id: StageId;
  label: string;
  duration: number;
}

const STAGES: Stage[] = [
  { id: "upload", label: "Uploading file", duration: 800 },
  { id: "extract", label: "Extracting text", duration: 3500 },
  { id: "identify", label: "Identifying experience & skills", duration: 4500 },
  { id: "polish", label: "Polishing the details", duration: Number.POSITIVE_INFINITY },
];

const AUTO_ADVANCE_MS = 1500;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatExt(file: { name: string; type: string }): string {
  if (file.type === "application/pdf") return "PDF";
  if (
    file.type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "DOCX";
  const dot = file.name.lastIndexOf(".");
  if (dot >= 0) return file.name.slice(dot + 1).toUpperCase();
  return "FILE";
}

interface SummaryPart {
  count: number;
  singular: string;
  plural: string;
}

function buildSummary(parsed: ParsedResumeV2): {
  countsLine: string;
  showLine: boolean;
} {
  // Order matches the legacy ParseSuccessCard chip order so terminology stays consistent.
  const parts: SummaryPart[] = [
    { count: parsed.experience.length, singular: "experience", plural: "experiences" },
    { count: parsed.education.length, singular: "school", plural: "schools" },
    { count: parsed.skills.length, singular: "skill", plural: "skills" },
    { count: parsed.certifications.length, singular: "cert", plural: "certs" },
  ];
  const nonzero = parts.filter((p) => p.count > 0);
  if (nonzero.length === 0) {
    return { countsLine: "", showLine: false };
  }
  const segments = nonzero.map(
    (p) => `${p.count} ${p.count === 1 ? p.singular : p.plural}`,
  );
  return { countsLine: `Done · ${segments.join(", ")} extracted`, showLine: true };
}

export function ParsingProgressCard({
  file,
  parseStatus = "parsing",
  parsed = null,
  onAutoAdvance,
}: ParsingProgressCardProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  // Time-curve advancement during parsing.
  useEffect(() => {
    if (parseStatus !== "parsing") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    STAGES.slice(0, -1).forEach((stage, i) => {
      elapsed += stage.duration;
      timers.push(
        setTimeout(() => setActiveIdx((idx) => Math.max(idx, i + 1)), elapsed),
      );
    });
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [parseStatus]);

  // On entering "done", force all stages complete and schedule auto-advance.
  useEffect(() => {
    if (parseStatus !== "done") return;
    setActiveIdx(STAGES.length);
    if (!onAutoAdvance) return;
    const t = setTimeout(onAutoAdvance, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [parseStatus, onAutoAdvance]);

  const ext = file ? formatExt(file) : "FILE";
  const sizeLabel = file ? formatBytes(file.size) : null;
  const isDone = parseStatus === "done";

  const summary = isDone && parsed ? buildSummary(parsed) : null;
  const isLowConfidence = isDone && parsed?.parse_confidence === "low";

  return (
    <div>
      <p
        data-testid="parse-caption"
        className="mb-3 text-xs text-[var(--color-muted)]"
      >
        {isDone
          ? "Routing to your details..."
          : "Hang tight — this usually takes 5–15 seconds."}
      </p>

      <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-strong)]">
            <FileText
              className="h-5 w-5 text-[var(--color-body)]"
              aria-hidden="true"
              strokeWidth={1.75}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="min-w-0 truncate text-sm font-semibold text-[var(--color-ink)]">
                {file?.name ?? "Resume"}
              </p>
              <span className="shrink-0 rounded-full bg-[var(--color-surface-strong)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
                {ext}
              </span>
            </div>
            {sizeLabel && (
              <p className="mt-0.5 font-mono text-xs tabular-nums text-[var(--color-muted)]">
                {sizeLabel}
              </p>
            )}
          </div>
        </div>

        <div
          className="relative mt-5 h-[2px] w-full overflow-hidden rounded-full bg-[var(--color-surface-strong)]"
          role="progressbar"
          aria-label="Parsing resume"
          aria-valuetext={
            isDone ? "Done" : (STAGES[activeIdx]?.label ?? "Working")
          }
        >
          {isDone ? (
            <div className="h-full w-full bg-[var(--color-primary)]" />
          ) : (
            <div className="animate-indeterminate-sweep h-full w-1/3 bg-gradient-to-r from-transparent via-[var(--color-primary)] to-transparent" />
          )}
        </div>

        <ul className="mt-5 space-y-3" role="list">
          {STAGES.map((stage, i) => {
            const state: "done" | "active" | "pending" =
              i < activeIdx ? "done" : i === activeIdx ? "active" : "pending";
            return <StageRow key={stage.id} label={stage.label} state={state} />;
          })}
        </ul>

        {isDone && summary?.showLine && (
          <p
            data-testid="parse-done-summary"
            className="animate-stage-fade-in mt-5 text-sm text-[var(--color-body)]"
          >
            <span className="font-mono tabular-nums">{summary.countsLine}</span>
            {isLowConfidence && (
              <span className="text-[var(--color-score-mid)]">
                {" · Some fields may need review"}
              </span>
            )}
          </p>
        )}

        {isDone && !summary?.showLine && isLowConfidence && (
          <p
            data-testid="parse-done-summary"
            className="animate-stage-fade-in mt-5 text-sm text-[var(--color-score-mid)]"
          >
            Some fields may need review
          </p>
        )}
      </div>
    </div>
  );
}

function StageRow({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "pending";
}) {
  const labelClass =
    state === "active"
      ? "flex-1 text-sm font-semibold text-[var(--color-ink)]"
      : state === "done"
        ? "flex-1 text-sm text-[var(--color-body)]"
        : "flex-1 text-sm text-[var(--color-muted-soft)]";

  return (
    <li className="flex items-center gap-3">
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center"
        aria-hidden="true"
      >
        {state === "done" ? (
          <span className="block h-2.5 w-2.5 rounded-full bg-[var(--color-score-high)]" />
        ) : state === "active" ? (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-primary)] opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" />
          </span>
        ) : (
          <span className="block h-2.5 w-2.5 rounded-full border border-[var(--color-hairline)]" />
        )}
      </span>
      <span className={labelClass}>{label}</span>
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center"
        aria-hidden="true"
      >
        {state === "done" ? (
          <Check
            key="done"
            className="animate-stage-check-pop h-4 w-4 text-[var(--color-score-high)]"
            strokeWidth={2.5}
          />
        ) : state === "active" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-primary)]" />
        ) : (
          <span className="block h-1 w-1 rounded-full bg-[var(--color-muted-soft)]" />
        )}
      </span>
    </li>
  );
}
```

Notes for the implementer:
- The `Hang tight — this usually takes 5–15 seconds.` caption now lives **inside** the card component. The next task removes the duplicate from `ResumeUploadCard`.
- `data-testid="parse-caption"` and `data-testid="parse-done-summary"` are required for the tests above.
- Keep the existing keyframes (`animate-indeterminate-sweep`, `animate-stage-check-pop`, `animate-stage-fade-in`) — they're already defined in `apps/web/app/globals.css` and don't need changes.

- [ ] **Step 6: Run tests — all should pass**

```bash
pnpm --filter @aurahire/web test parsing-progress-card
```

Expected: PASS on every test (8 cases).

- [ ] **Step 7: Run type-check**

```bash
pnpm --filter @aurahire/web type-check
```

Expected: PASS. The new props are optional with defaults so the existing call site in `resume-upload-card.tsx` (`<ParsingProgressCard file={activeFile} />`) continues to type-check; Task 3 will update those call sites to pass explicit values.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/onboarding/candidate/parsing-progress-card.tsx apps/web/components/onboarding/candidate/parsing-progress-card.test.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): add 'done' state to ParsingProgressCard

The card now resolves all four stages, shows a summary line of extracted
counts, swaps the caption to "Routing to your details...", and fires
onAutoAdvance after 1500ms. Low-confidence parses get a warning suffix.
Caption rendering moved into the card so it can swap with state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create `LowConfidenceBanner` component

**Files:**
- Create: `apps/web/components/onboarding/candidate/low-confidence-banner.tsx`
- Create: `apps/web/components/onboarding/candidate/low-confidence-banner.test.tsx`

A small presentational component shown above the form on Step 2 and Step 3 when `parse_confidence === "low"`. Returns `null` for any other value.

- [ ] **Step 1: Write the failing test**

Create `apps/web/components/onboarding/candidate/low-confidence-banner.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { LowConfidenceBanner } from "./low-confidence-banner";

describe("LowConfidenceBanner", () => {
  it("renders banner when confidence is 'low'", () => {
    render(<LowConfidenceBanner confidence="low" />);
    expect(screen.getByText(/low-confidence parse/i)).toBeInTheDocument();
    expect(screen.getByText(/Double-check every prefilled field/i)).toBeInTheDocument();
  });

  it("renders nothing for 'high' confidence", () => {
    const { container } = render(<LowConfidenceBanner confidence="high" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for 'medium' confidence", () => {
    const { container } = render(<LowConfidenceBanner confidence="medium" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for null", () => {
    const { container } = render(<LowConfidenceBanner confidence={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for undefined", () => {
    const { container } = render(<LowConfidenceBanner confidence={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the test — should fail (file does not exist)**

```bash
pnpm --filter @aurahire/web test low-confidence-banner
```

Expected: FAIL with "Cannot find module './low-confidence-banner'".

- [ ] **Step 3: Create the component**

Create `apps/web/components/onboarding/candidate/low-confidence-banner.tsx`:

```tsx
// apps/web/components/onboarding/candidate/low-confidence-banner.tsx
import { AlertTriangle } from "lucide-react";
import type { ParsedResumeV2 } from "@/app/onboarding/candidate/_steps";

interface LowConfidenceBannerProps {
  confidence: ParsedResumeV2["parse_confidence"] | null | undefined;
}

export function LowConfidenceBanner({ confidence }: LowConfidenceBannerProps) {
  if (confidence !== "low") return null;

  return (
    <div
      role="status"
      className="mb-5 flex items-start gap-3 rounded-xl border-l-4 border-[var(--color-score-mid)] bg-[var(--color-score-mid-soft)] px-4 py-3"
    >
      <AlertTriangle
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-score-mid)]"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--color-ink)]">
          Heads up — low-confidence parse
        </p>
        <p className="mt-0.5 text-sm text-[var(--color-body)]">
          The AI wasn&apos;t sure about parts of this resume. Double-check every prefilled field before continuing.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test — should pass**

```bash
pnpm --filter @aurahire/web test low-confidence-banner
```

Expected: PASS (5 cases).

- [ ] **Step 5: Run type-check**

```bash
pnpm --filter @aurahire/web type-check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/onboarding/candidate/low-confidence-banner.tsx apps/web/components/onboarding/candidate/low-confidence-banner.test.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): add LowConfidenceBanner component

Surfaces parse_confidence === 'low' to candidates above the Step 2 / Step 3
forms so they double-check prefilled values. Renders nothing for high,
medium, null, or undefined.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Rewire `ResumeUploadCard` and delete `ParseSuccessCard`

**Files:**
- Modify: `apps/web/components/onboarding/candidate/resume-upload-card.tsx`
- Delete: `apps/web/components/onboarding/candidate/parse-success-card.tsx`

The orchestrator's `done` branch must now render `ParsingProgressCard` in done-mode and pass `onAutoAdvance` to navigate to Step 2. It also gains a `forceIdle` prop used by the replace flow on the Step 1 page.

- [ ] **Step 1: Replace `resume-upload-card.tsx` with the rewired version**

Replace the entire contents of `apps/web/components/onboarding/candidate/resume-upload-card.tsx` with:

```tsx
// apps/web/components/onboarding/candidate/resume-upload-card.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { ParsingProgressCard } from "./parsing-progress-card";
import { ResumeStaleRecoveryCard } from "./resume-stale-recovery-card";
import type { LatestParsedResume } from "@/app/onboarding/candidate/_steps";

const ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 10 * 1024 * 1024;

interface Props {
  latestResume: LatestParsedResume | null;
  accessToken: string;
  /**
   * When true, ignore an existing parsed resume and render the dropzone.
   * Used by the replace flow (`/onboarding/candidate?replace=1`).
   */
  forceIdle?: boolean;
}

type Stage = "idle" | "uploading" | "done" | "failed";

export function ResumeUploadCard({ latestResume, accessToken, forceIdle = false }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // Initial stage based on existing resume row, unless forceIdle overrides.
  const [stage, setStage] = useState<Stage>(() => {
    if (forceIdle) return "idle";
    if (latestResume?.parseStatus === "parsed") return "done";
    if (latestResume?.parseStatus === "failed") return "failed";
    return "idle";
  });
  const [resume, setResume] = useState<LatestParsedResume | null>(
    forceIdle ? null : latestResume,
  );
  const [activeFile, setActiveFile] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);

  // Stale "parsing" recovery state — render the recovery card, unless we're
  // explicitly in the replace flow (then user wants the dropzone).
  if (
    !forceIdle &&
    latestResume?.parseStatus === "parsing" &&
    stage !== "uploading"
  ) {
    return (
      <ResumeStaleRecoveryCard
        resumeId={latestResume.id}
        accessToken={accessToken}
        onReparseTriggered={() => router.refresh()}
        onUploadDifferent={() => {
          setResume(null);
          setStage("idle");
        }}
      />
    );
  }

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("File exceeds 10MB. Try compressing or use a different file.");
      return;
    }
    setActiveFile({ name: file.name, size: file.size, type: file.type });
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
      const body = (await res.json()) as {
        data: {
          id: string;
          parseStatus: "parsed" | "failed" | "parsing" | "pending";
          parsedData: LatestParsedResume["parsed"];
          rawText: string | null;
          canonicalPdfPath: string | null;
        };
      };
      if (body.data.parseStatus === "parsed") {
        setResume({
          id: body.data.id,
          parseStatus: "parsed",
          signedPdfUrl: null,
          rawText: body.data.rawText,
          canonicalPdfPath: body.data.canonicalPdfPath,
          parsed: body.data.parsedData,
        });
        setStage("done");
        router.refresh();
      } else if (body.data.parseStatus === "failed") {
        setStage("failed");
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
      setStage("idle");
    }
  };

  if (stage === "uploading") {
    return (
      <ParsingProgressCard
        file={activeFile}
        parseStatus="parsing"
        parsed={null}
      />
    );
  }

  if (stage === "done" && resume) {
    return (
      <ParsingProgressCard
        file={activeFile}
        parseStatus="done"
        parsed={resume.parsed}
        onAutoAdvance={() => router.push("/onboarding/candidate/personal")}
      />
    );
  }

  if (stage === "failed") {
    return (
      <div>
        <p className="text-sm font-semibold text-[var(--color-status-danger)]">
          We couldn&apos;t parse this resume.
        </p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Try a different file or continue without parsing.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => router.push("/onboarding/candidate/personal")}
            className="rounded-full bg-[var(--color-surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-hairline)]"
          >
            Continue without parsing
          </button>
          <button
            onClick={() => setStage("idle")}
            className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-active)]"
          >
            Try a different file
          </button>
        </div>
      </div>
    );
  }

  // idle
  return (
    <div>
      <label
        className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/30"
        onDragOver={(e) => {
          e.preventDefault();
        }}
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
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>
      {error && <p className="mt-3 text-sm text-[var(--color-status-danger)]">{error}</p>}
      <button
        onClick={() => router.push("/onboarding/candidate/personal")}
        className="mt-5 text-sm text-[var(--color-muted)] underline transition-colors hover:text-[var(--color-ink)]"
      >
        Skip — I&apos;ll fill in manually
      </button>
    </div>
  );
}
```

Key changes from the previous version:
- Drops `import { ParseSuccessCard } from "./parse-success-card";`.
- `Props` adds `forceIdle?: boolean`.
- `useState<Stage>(...)` initializer is a function that respects `forceIdle`.
- `resume` initial value is `null` when `forceIdle`, else `latestResume`.
- The stale-parsing branch also respects `forceIdle` (skip recovery card; user wants dropzone).
- `if (stage === "uploading")` no longer renders a separate `Hang tight...` `<p>` — that caption now lives inside `ParsingProgressCard`.
- The `done` branch renders `ParsingProgressCard` with `parseStatus="done"` and `onAutoAdvance` that pushes to Step 2.

- [ ] **Step 2: Delete the obsolete `parse-success-card.tsx`**

```bash
rm apps/web/components/onboarding/candidate/parse-success-card.tsx
```

- [ ] **Step 3: Run type-check**

```bash
pnpm --filter @aurahire/web type-check
```

Expected: PASS. If you see "Cannot find module './parse-success-card'" anywhere, search for stale imports and remove them — none should exist outside `resume-upload-card.tsx` (which we already updated).

- [ ] **Step 4: Run all web tests**

```bash
pnpm --filter @aurahire/web test
```

Expected: PASS (parsing-progress-card, low-confidence-banner, plus the existing find-text-spans / derive-highlights suites).

- [ ] **Step 5: Run lint**

```bash
pnpm --filter @aurahire/web lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/onboarding/candidate/resume-upload-card.tsx apps/web/components/onboarding/candidate/parse-success-card.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): rewire ResumeUploadCard to auto-advance after parse

The 'done' branch renders ParsingProgressCard in done-mode and pushes to
Step 2 via the new onAutoAdvance callback. The ParseSuccessCard interstitial
is removed entirely. Adds a forceIdle prop used by the replace flow to
ignore an existing parsed resume and render the dropzone.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Note: `git add` on the deleted file records the deletion.

---

## Task 4: Server-redirect on Step 1 page + thread `forceIdle`

**Files:**
- Modify: `apps/web/app/onboarding/candidate/page.tsx`

If a returning candidate already has a parsed resume, the page redirects them straight to Step 2 — unless the URL carries `?replace=1`, in which case we render the dropzone.

- [ ] **Step 1: Replace `apps/web/app/onboarding/candidate/page.tsx`**

Replace the entire contents with:

```tsx
// apps/web/app/onboarding/candidate/page.tsx
import { redirect } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { ResumeUploadCard } from "@/components/onboarding/candidate/resume-upload-card";
import { fetchCandidateProfileMe, fetchLatestParsedResume } from "./_data";
import { ONBOARDING_STEPS } from "./_steps";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata = { title: "Upload Resume — Onboarding" };

export default async function Step1Page({
  searchParams,
}: {
  searchParams: Promise<{ replace?: string }>;
}) {
  const { replace } = await searchParams;
  const isReplaceFlow = replace === "1";

  const me = await fetchCandidateProfileMe();
  if (me.profileCompleted) redirect("/candidate");

  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const latestResume = await fetchLatestParsedResume();

  // Auto-advance returning users with a parsed resume on file, unless they
  // explicitly want to replace it.
  if (latestResume?.parseStatus === "parsed" && !isReplaceFlow) {
    redirect("/onboarding/candidate/personal");
  }

  return (
    <OnboardingShell
      steps={ONBOARDING_STEPS}
      currentStepId="resume"
      saveStatus="idle"
      title="Upload your resume"
      subtitle="We'll extract your contact info, experience, education, and skills automatically. The AI takes 5–15 seconds."
    >
      <ResumeUploadCard
        latestResume={latestResume}
        accessToken={session.access_token}
        forceIdle={isReplaceFlow}
      />
    </OnboardingShell>
  );
}
```

- [ ] **Step 2: Run type-check**

```bash
pnpm --filter @aurahire/web type-check
```

Expected: PASS. (Next.js 16's `searchParams` is a Promise — the `await` shape matches the project's existing usage; if any existing pages in the repo use the older sync shape, do not unify them in this PR.)

- [ ] **Step 3: Run lint**

```bash
pnpm --filter @aurahire/web lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/onboarding/candidate/page.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): redirect returning candidates with parsed resume to Step 2

Page now redirects /onboarding/candidate to /onboarding/candidate/personal
when a parsed resume is on file, unless the URL carries ?replace=1. The
replace flow threads forceIdle into ResumeUploadCard so the dropzone
renders even with an existing parsed resume.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add `Replace resume` link to `ResumePreviewPane`

**Files:**
- Modify: `apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx`

A small text-button next to the existing PDF/Text segmented toggle that routes to `/onboarding/candidate?replace=1`. Lives wherever `ResumePreviewPane` is rendered (Step 2, Step 3, mobile sheet).

- [ ] **Step 1: Inspect the current header row**

Open `apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx`. The header row to modify is the block that currently renders the PDF/Text toggle and the "Open" external link, gated by `(canToggle || hasPdf)`. We need to:

1. Always render the header row when there's any parsed-resume context to expose, so `Replace resume` is reachable even when PDF preview is unavailable.
2. Add a `Replace resume` `<Link>` next to (left of) the existing "Open" link.

- [ ] **Step 2: Update the imports**

Find the `import` block at the top of the file (around line 1-10):

```tsx
import { ExternalLink, FileText, FileType2 } from "lucide-react";
```

Replace it with:

```tsx
import Link from "next/link";
import { ExternalLink, FileText, FileType2, RotateCcw } from "lucide-react";
```

- [ ] **Step 3: Update the header row JSX**

Find this block (currently around lines 130-170):

```tsx
      {/* Header row: toggle (when both modes usable) or label, plus open-in-new-tab affordance */}
      {(canToggle || hasPdf) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {canToggle ? (
            <div ... role="tablist" ...>
              <ViewToggleButton ... />
              <ViewToggleButton ... />
            </div>
          ) : (
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
              Your resume
            </span>
          )}
          {hasPdf && signedPdfUrl && (
            <a ... aria-label="Open original PDF in a new tab">
              Open
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </div>
      )}
```

Replace the whole block with:

```tsx
      {/* Header row: toggle (when both modes usable) or label, plus replace + open affordances. */}
      <div className="mb-3 flex items-center justify-between gap-3">
        {canToggle ? (
          <div
            role="tablist"
            aria-label="Resume view mode"
            className="inline-flex rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-0.5"
          >
            <ViewToggleButton
              icon={<FileType2 className="h-3.5 w-3.5" aria-hidden />}
              label="PDF"
              selected={displayedMode === "pdf"}
              onClick={() => setUserMode("pdf")}
            />
            <ViewToggleButton
              icon={<FileText className="h-3.5 w-3.5" aria-hidden />}
              label="Text"
              selected={displayedMode === "text"}
              onClick={() => setUserMode("text")}
            />
          </div>
        ) : (
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
            Your resume
          </span>
        )}
        <div className="flex items-center gap-3">
          <Link
            href="/onboarding/candidate?replace=1"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Replace resume
          </Link>
          {hasPdf && signedPdfUrl && (
            <a
              href={signedPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
              aria-label="Open original PDF in a new tab"
            >
              Open
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </div>
      </div>
```

Key changes:
- Removed the outer `(canToggle || hasPdf) && ` gate — header now always renders.
- Wrapped the right-side actions in a flex container holding `Replace resume` (always shown) and `Open` (still gated on `hasPdf && signedPdfUrl`).
- Used `next/link`'s `<Link>` for the replace navigation so client-side routing works.

- [ ] **Step 4: Run type-check**

```bash
pnpm --filter @aurahire/web type-check
```

Expected: PASS. If you get "Cannot find name 'Link'" or similar, double-check the import update in Step 2.

- [ ] **Step 5: Run lint**

```bash
pnpm --filter @aurahire/web lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/onboarding/resume-preview/resume-preview-pane.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): add 'Replace resume' link to ResumePreviewPane

A small text-button in the preview pane header routes to
/onboarding/candidate?replace=1 so candidates on Step 2 / Step 3 (and the
mobile resume sheet) can swap their uploaded file. The header row always
renders now so the link is reachable even when PDF preview is unavailable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire `LowConfidenceBanner` into Step 2 and Step 3 client components

**Files:**
- Modify: `apps/web/app/onboarding/candidate/personal/_client.tsx`
- Modify: `apps/web/app/onboarding/candidate/review/_client.tsx`

Both client components receive `latestResume` already; we just need to render the banner above the form.

- [ ] **Step 1: Update `personal/_client.tsx`**

Find this block at the top of `apps/web/app/onboarding/candidate/personal/_client.tsx`:

```tsx
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { HighlightProvider } from "@/components/onboarding/resume-preview/highlight-context";
import { ResumePreviewPane } from "@/components/onboarding/resume-preview/resume-preview-pane";
import { ResumeSheet } from "@/components/onboarding/mobile/resume-sheet";
import {
  CandidatePersonalInfoForm,
  type PersonalFormValues,
} from "@/components/onboarding/candidate/personal-info-form";
```

Add the banner import directly below the `personal-info-form` import:

```tsx
import { LowConfidenceBanner } from "@/components/onboarding/candidate/low-confidence-banner";
```

Then find the JSX that renders `<CandidatePersonalInfoForm ... />` inside the `<OnboardingShell>` body:

```tsx
        <CandidatePersonalInfoForm
          defaults={defaults}
          aiSuggestedFields={aiSuggestedFields}
          accessToken={accessToken}
          onSaveStatusChange={setSaveStatus}
        />
```

Wrap it with the banner so the banner sits above:

```tsx
        <LowConfidenceBanner confidence={latestResume?.parsed?.parse_confidence ?? null} />
        <CandidatePersonalInfoForm
          defaults={defaults}
          aiSuggestedFields={aiSuggestedFields}
          accessToken={accessToken}
          onSaveStatusChange={setSaveStatus}
        />
```

- [ ] **Step 2: Update `review/_client.tsx`**

Find this block at the top of `apps/web/app/onboarding/candidate/review/_client.tsx`:

```tsx
import { ReviewStep } from "@/components/onboarding/candidate/review/review-step";
```

Add the banner import directly below it:

```tsx
import { LowConfidenceBanner } from "@/components/onboarding/candidate/low-confidence-banner";
```

Then find the JSX that renders `<ReviewStep ... />` inside the `<OnboardingShell>` body:

```tsx
        <ReviewStep
          initialExperience={initialExperience}
          initialEducation={initialEducation}
          initialSkills={initialSkills}
          syncSection={syncSection}
          onCategoriesChange={setActiveCategories}
        />
```

Wrap it with the banner so the banner sits above:

```tsx
        <LowConfidenceBanner confidence={latestResume?.parsed?.parse_confidence ?? null} />
        <ReviewStep
          initialExperience={initialExperience}
          initialEducation={initialEducation}
          initialSkills={initialSkills}
          syncSection={syncSection}
          onCategoriesChange={setActiveCategories}
        />
```

- [ ] **Step 3: Run type-check**

```bash
pnpm --filter @aurahire/web type-check
```

Expected: PASS.

- [ ] **Step 4: Run lint**

```bash
pnpm --filter @aurahire/web lint
```

Expected: PASS.

- [ ] **Step 5: Run all web tests**

```bash
pnpm --filter @aurahire/web test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/onboarding/candidate/personal/_client.tsx apps/web/app/onboarding/candidate/review/_client.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): show LowConfidenceBanner above Step 2 and Step 3 forms

When parse_confidence === 'low' on the candidate's resume, an amber banner
appears above the personal-info form (Step 2) and the review form (Step 3)
warning the candidate to double-check prefilled values.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Final verification

This task is verification-only — no code changes. The implementer hands the build off to the human for browser-based confirmation since the agent does not run dev servers (per `CLAUDE.md`).

- [ ] **Step 1: Run the full test + type-check + lint suite from the repo root**

```bash
pnpm --filter @aurahire/web test
pnpm --filter @aurahire/web type-check
pnpm --filter @aurahire/web lint
```

All three should pass.

- [ ] **Step 2: Build verification (no server start)**

```bash
pnpm --filter @aurahire/web build
```

Expected: build succeeds.

- [ ] **Step 3: Hand off to the human for manual verification**

Ask the user to run `pnpm dev` from the repo root and walk through each scenario below, reporting back any deviations:

**Scenario A — happy path (new candidate, high-confidence resume):**
1. Sign up + verify email (existing onboarding flow lands on Step 1).
2. Drag a known-good PDF onto the dropzone.
3. Watch the parsing card animate through four stages.
4. Verify: when parse completes, all four green dots appear (no card swap), the progress bar becomes solid AuraHire-Blue, the "Done · {N} experiences, {N} schools, {N} skills, {N} certs extracted" line fades in, the caption above changes to "Routing to your details...", and after ~1.5s the URL changes to `/onboarding/candidate/personal` automatically.
5. On Step 2, verify the AI Suggested badges appear next to prefilled fields and no low-confidence banner appears.

**Scenario B — returning user with parsed resume:**
1. Navigate manually to `/onboarding/candidate`.
2. Verify: URL immediately becomes `/onboarding/candidate/personal` (server-side redirect).

**Scenario C — replace flow:**
1. From Step 2 (or Step 3), look at the resume preview pane on the right.
2. Verify a `↻ Replace resume` link is visible in the header next to the PDF/Text toggle.
3. Click it — URL becomes `/onboarding/candidate?replace=1`, the dropzone renders.
4. Upload a different PDF.
5. Verify the auto-advance flow runs again and the new file's prefilled values appear on Step 2.

**Scenario D — failed parse:**
1. Upload an unparseable file (e.g. an empty PDF, or a PDF with image-only content beyond the heuristic).
2. Verify: stage flips to `failed` view ("We couldn't parse this resume." + retry/skip buttons). Existing behavior; should not regress.

**Scenario E — low-confidence parse (manual fixture):**
This requires a resume that the OpenAI prompt scores as `parse_confidence: "low"`. If you don't have one handy, you can temporarily edit `apps/web/app/onboarding/candidate/_data.ts` (or wherever `fetchLatestParsedResume` lives) to override `parse_confidence: "low"` for testing — revert before committing.
1. Upload the low-confidence resume.
2. Verify on the parse-success flash: summary line includes `· Some fields may need review` in amber.
3. Verify on Step 2: amber banner appears above the form: "Heads up — low-confidence parse · The AI wasn't sure about parts of this resume. Double-check every prefilled field before continuing."
4. Verify on Step 3: same banner.

**Scenario F — skip "fill manually":**
1. From a clean Step 1 (no parsed resume), click `Skip — I'll fill in manually`.
2. Verify: routes to Step 2 with no prefilled values, no AI Suggested badges, no low-confidence banner.

- [ ] **Step 4: If any scenario fails, capture the symptom + console output and reopen the relevant task. If all pass, no further commits required — the implementation is done.**

---

## Spec Coverage Check

Each section of the spec maps to a task:

| Spec section | Implemented in |
|---|---|
| Delete `parse-success-card.tsx` | Task 3, Step 2 |
| Extend `ParsingProgressCard` with done state | Task 1 |
| Rewire `ResumeUploadCard` | Task 3 |
| Server redirect on Step 1 page | Task 4 |
| `forceIdle` prop on `ResumeUploadCard` | Task 3 (prop), Task 4 (page wires it) |
| `Replace resume` link on `ResumePreviewPane` | Task 5 |
| New `LowConfidenceBanner` component | Task 2 |
| Wire banner into Step 2 + Step 3 | Task 6 |
| Unit test: `ParsingProgressCard` done state | Task 1 |
| Unit test: `LowConfidenceBanner` | Task 2 |
| Integration: Step 1 redirect (no `?replace=1` → redirect; with `?replace=1` → dropzone) | Task 7 manual verification (Scenario B + C); no automated server-component test infrastructure exists in the repo, so this stays manual for sprint scope |
| Manual e2e (happy path, replace, low-confidence) | Task 7 |
