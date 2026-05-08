# Explainable Scoring Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every point on every profile/match score traceable to a quoted excerpt. Engine derives `component.score = clamp(sum(evidence.contribution_points), 0, max)`; all contributions are multiples of 5; profile evidence gains `contribution_points` parity with match; the "Contributes" verb is dropped; calibration warnings flag at-ceiling components without strong evidence.

**Architecture:** Strict-sum reconciliation enforced server-side in pure helpers (`reconcileEvidenceContributions`, `detectCalibrationWarnings`) called from every score-write code path (`computeProfileScore`, `computeMatchScore`, `computeMatchPreviewInternal`, `rescore-batch.processor`). Schema layer enforces `multipleOf(5)` via Zod refinement; engine re-quantizes defensively. Audit fields ride existing `audit_logs.details` jsonb — no DB migration. Frontend `EvidenceCallout` copy fix is purely additive; profile parity comes for free once the engine writes `contribution_points` into the existing `evidence_excerpts.contribution_points` column (currently hardcoded `null` for profile rows).

**Tech Stack:** Zod schemas in `@aurahire/shared`; NestJS scoring module in `apps/api/src/modules/scoring/`; Drizzle for persistence (no migration); Next.js 16 App Router for the candidate / admin pages; OpenAI `gpt-4o-mini` with structured outputs.

**Spec reference:** `docs/superpowers/specs/2026-05-08-explainable-scoring-overhaul-design.md`

---

## File Structure

**Modified — `packages/shared/src/schemas/score.ts`** (~80 lines): Adds `scoredEvidenceSchema` with `multipleOf(5)`. Profile component evidence switches from `evidenceSchema` → `scoredEvidenceSchema`. `matchEvidenceSchema` becomes a transitional alias. Component score fields gain `multipleOf(5)`.

**Modified — `apps/api/src/modules/scoring/scoring.service.ts`** (~1130 lines): Adds two pure helpers `reconcileEvidenceContributions` and `detectCalibrationWarnings` near existing `normalizeComponentsToWeights`. Wires both into `computeProfileScore` (line 276 onward), `computeMatchScore` (line 534 onward), and `computeMatchPreviewInternal` (line 892 onward). Replaces hardcoded `contributionPoints: null` at line 289. Audit `details` payloads gain `scoreResiduals`, `evidenceQuantizationResiduals`, `calibrationWarnings` (camelCase, matching the rest of `audit_logs.details`). Helpers exported so the rescore-batch processor can import them.

**Modified — `apps/api/src/modules/scoring/scoring.service.spec.ts`** (~600 lines today): New `describe("reconcileEvidenceContributions")` and `describe("detectCalibrationWarnings")` blocks with the unit tests from the spec.

**Modified — `apps/api/src/modules/admin/processors/rescore-batch.processor.ts`** (~150 lines): Wires reconciliation + calibration helpers into the rescore loop so admin-driven rescores get the same transparency as candidate-driven ones. (Spec did not explicitly list this file, but excluding it would leave a transparency hole the user explicitly objected to — "all transactions should be transparent.")

**Modified — `apps/api/src/ai/prompts/score-profile.ts`** (~70 lines): Bump version constant to `1.2.0`. Add contribution_points instruction. Tighten the existing 75–85% anchor into the new ceiling-requires-strong-evidence rule. **HUMAN APPROVAL GATE.**

**Modified — `apps/api/src/ai/prompts/score-match.ts`** (~95 lines): Bump version constant to `1.2.0`. Replace `"approximately"` with strict equality. Add 5-point quantization rule. Add ceiling rule. **HUMAN APPROVAL GATE.**

**Modified — `apps/web/components/score/evidence-callout.tsx`** (~75 lines): Replace `"Contributes ±N points"` footer with a signed-integer chip in score-band color, Unicode minus, monospace.

**Modified — `apps/api/src/modules/admin/repositories/admin-bias-monitor.repository.ts`**: New aggregation query that counts `calibrationWarnings` from `audit_logs.details` over the requested date range, optionally filtered by `prompt_version`.

**Modified — `apps/api/src/modules/admin/services/admin-bias-monitor.service.ts`**: Calls the new repo method, folds the result into the existing bundle response.

**Modified — `apps/api/src/modules/admin/dto/bias-monitor-query.dto.ts`** + **`bias-monitor-response.dto.ts`**: Adds optional `promptVersionMin` query param and `scoringQuality` block on the response.

**Modified — `apps/web/app/(admin)/admin/bias-monitor/page.tsx`**: Renders a new "Scoring Quality" panel below existing KPIs.

**New — `apps/web/app/(admin)/admin/bias-monitor/_scoring-quality-panel.tsx`**: Client component that displays the calibration warnings breakdown.

---

# Phase 1 — Backend

Phase 1 is testable end-to-end via existing `scoring.service.spec.ts` plus new unit tests. No frontend dependency.

---

## Task 1: Schema — add `scoredEvidenceSchema` with `multipleOf(5)`

**Goal:** Profile and match component evidence both use a single schema that requires `contribution_points` as a multiple of 5. Component scores also become multiples of 5.

**Files:**
- Modify: `packages/shared/src/schemas/score.ts:7-79`

### Steps

- [ ] **Step 1: Read the current schema**

Run: `cat packages/shared/src/schemas/score.ts`
Note the existing definitions: `evidenceSchema` (line 7), `matchEvidenceSchema` (line 13), `profileComponentSchema` (line 21), `matchComponentSchema` (line 58).

- [ ] **Step 2: Replace the EVIDENCE block (lines 7-15) with the new schemas**

Replace:

```ts
export const evidenceSchema = z.object({
  excerpt: z.string(),
  source: z.string(), // e.g. "Experience › Senior Engineer at Acme"
  relevance: z.enum(["positive", "negative", "neutral"]),
});

export const matchEvidenceSchema = evidenceSchema.extend({
  contribution_points: z.number().int(),
});
```

with:

```ts
export const evidenceSchema = z.object({
  excerpt: z.string(),
  source: z.string(), // e.g. "Experience › Senior Engineer at Acme"
  relevance: z.enum(["positive", "negative", "neutral"]),
});

/**
 * Evidence that contributes a quantified delta to a component score.
 * `contribution_points` is a SIGNED INTEGER and a MULTIPLE OF 5 — positive when
 * the quote helped, negative when it represents a gap, 0 when neutral.
 *
 * The engine derives `component.score = clamp(sum(contribution_points), 0, max)`
 * so this field is the source of truth for a component's numeric score.
 *
 * Used by both profile components (since v1.2.0) and match components.
 */
export const scoredEvidenceSchema = evidenceSchema.extend({
  contribution_points: z.number().int().multipleOf(5),
});

/**
 * @deprecated Transitional alias — use `scoredEvidenceSchema`.
 * Kept so existing imports don't break in the same PR; remove in a follow-up.
 */
export const matchEvidenceSchema = scoredEvidenceSchema;
```

- [ ] **Step 3: Update `profileComponentSchema` (lines 21-33)**

Replace:

```ts
export const profileComponentSchema = z.object({
  name: z.enum([
    "completeness",
    "skill_depth",
    "experience_clarity",
    "education_quality",
  ]),
  score: z.number().int().min(0), // 0..max
  max: z.number().int(), // weight value
  weight: z.number().int(), // same as max for now
  explanation: z.string(),
  evidence: z.array(evidenceSchema),
});
```

with:

```ts
export const profileComponentSchema = z.object({
  name: z.enum([
    "completeness",
    "skill_depth",
    "experience_clarity",
    "education_quality",
  ]),
  score: z.number().int().min(0).multipleOf(5), // 0..max, quantized to 5
  max: z.number().int().multipleOf(5),
  weight: z.number().int().multipleOf(5),
  explanation: z.string(),
  evidence: z.array(scoredEvidenceSchema),
});
```

- [ ] **Step 4: Update `matchComponentSchema` (lines 58-65)**

Replace:

```ts
export const matchComponentSchema = z.object({
  name: z.enum(["skills", "experience", "education", "cultural_fit"]),
  score: z.number().int().min(0),
  max: z.number().int(),
  weight: z.number().int(),
  explanation: z.string(),
  evidence: z.array(matchEvidenceSchema).max(5),
});
```

with:

```ts
export const matchComponentSchema = z.object({
  name: z.enum(["skills", "experience", "education", "cultural_fit"]),
  score: z.number().int().min(0).multipleOf(5),
  max: z.number().int().multipleOf(5),
  weight: z.number().int().multipleOf(5),
  explanation: z.string(),
  evidence: z.array(scoredEvidenceSchema).max(6), // bumped from 5 to 6 to allow more granular gap evidence
});
```

The cap raise from 5 to 6 matches what the match prompt v1.1.0 already states (`score-match.ts:40` says "Total evidence per component: aim for 2–4 items in mixed cases (some positives + at least one negative). Do not exceed 6.") — so the schema is catching up to the prompt, not introducing new behavior.

- [ ] **Step 5: Verify type exports still work**

Run: `pnpm --filter @aurahire/shared tsc --noEmit`
Expected: No type errors. The renamed `matchEvidenceSchema` alias means downstream code still resolves.

- [ ] **Step 6: Verify all consumers still type-check**

Run: `pnpm --filter @aurahire/api tsc --noEmit && pnpm --filter @aurahire/web tsc --noEmit`
Expected: No type errors. (If the web app errors on a `multipleOf(5)` constraint somewhere, that's a sign that some test data is hardcoded — reroute to Step 7.)

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/schemas/score.ts
git commit -m "feat(scoring): add scoredEvidenceSchema with multipleOf(5) refinement

Profile evidence schema gains contribution_points (parity with match).
Component scores become multiples of 5. matchEvidenceSchema kept as
transitional alias.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: TDD — `reconcileEvidenceContributions` helper

**Goal:** Pure function that quantizes contributions to nearest 5, computes derived score = clamp(sum, 0, max), forces relevance from sign, and returns reconciliation metadata.

**Files:**
- Modify: `apps/api/src/modules/scoring/scoring.service.ts:91-126` (add helper near existing `normalizeComponentsToWeights`)
- Modify: `apps/api/src/modules/scoring/scoring.service.spec.ts` (add new describe block)

### Steps

- [ ] **Step 1: Find a stable place to put the new tests**

Run: `grep -n "describe(" apps/api/src/modules/scoring/scoring.service.spec.ts`
Note: existing tests live in a single `describe("ScoringService.computeMatchPreviewOnView")` block. Add new top-level `describe` blocks at the top of the file (above the existing one) for the pure helper tests — they don't need any of the mocks the existing tests build.

- [ ] **Step 2: Write the failing tests**

Add at the top of `apps/api/src/modules/scoring/scoring.service.spec.ts`, immediately after the imports:

```ts
import {
  ScoringService,
  reconcileEvidenceContributions,
  detectCalibrationWarnings,
} from "./scoring.service";

describe("reconcileEvidenceContributions", () => {
  function buildComponent(overrides: Partial<{
    name: string;
    score: number;
    max: number;
    evidence: Array<{
      excerpt: string;
      source: string;
      relevance: "positive" | "negative" | "neutral";
      contribution_points: number;
    }>;
  }> = {}) {
    return {
      name: "skills",
      score: 0,
      max: 40,
      weight: 40,
      explanation: "test",
      evidence: [],
      ...overrides,
    };
  }

  it("reconciles when AI got the math right (sum equals score)", () => {
    const result = reconcileEvidenceContributions(
      buildComponent({
        score: 25,
        evidence: [
          { excerpt: "TS", source: "skills", relevance: "positive", contribution_points: 10 },
          { excerpt: "PG", source: "skills", relevance: "positive", contribution_points: 10 },
          { excerpt: "Docker", source: "skills", relevance: "positive", contribution_points: 5 },
        ],
      }),
    );
    expect(result.component.score).toBe(25);
    expect(result.residual).toBe(0);
    expect(result.quantizationDeltas).toHaveLength(0);
  });

  it("overrides AI score when it disagrees with sum of contributions", () => {
    const result = reconcileEvidenceContributions(
      buildComponent({
        score: 30, // AI claimed 30
        evidence: [
          { excerpt: "TS", source: "skills", relevance: "positive", contribution_points: 10 },
          { excerpt: "PG", source: "skills", relevance: "positive", contribution_points: 10 },
          { excerpt: "Docker", source: "skills", relevance: "positive", contribution_points: 5 },
        ],
      }),
    );
    expect(result.component.score).toBe(25); // sum wins
    expect(result.residual).toBe(5); // ai_score - derived
  });

  it("quantizes non-multiples of 5 to nearest 5", () => {
    const result = reconcileEvidenceContributions(
      buildComponent({
        score: 15,
        evidence: [
          { excerpt: "a", source: "skills", relevance: "positive", contribution_points: 7 },
          { excerpt: "b", source: "skills", relevance: "positive", contribution_points: 8 },
        ],
      }),
    );
    expect(result.component.evidence[0].contribution_points).toBe(5);
    expect(result.component.evidence[1].contribution_points).toBe(10);
    expect(result.component.score).toBe(15); // 5 + 10 = 15
    expect(result.quantizationDeltas).toHaveLength(2);
    expect(result.quantizationDeltas[0]).toEqual({
      evidenceIndex: 0,
      original: 7,
      quantized: 5,
    });
  });

  it("clamps below zero", () => {
    const result = reconcileEvidenceContributions(
      buildComponent({
        score: 10,
        evidence: [
          { excerpt: "gap1", source: "req", relevance: "negative", contribution_points: -15 },
          { excerpt: "gap2", source: "req", relevance: "negative", contribution_points: -15 },
        ],
      }),
    );
    expect(result.component.score).toBe(0); // clamped from -30
    expect(result.residual).toBe(10); // ai_score 10 - derived 0
  });

  it("clamps above max", () => {
    const result = reconcileEvidenceContributions(
      buildComponent({
        score: 20,
        max: 15,
        evidence: [
          { excerpt: "a", source: "skills", relevance: "positive", contribution_points: 10 },
          { excerpt: "b", source: "skills", relevance: "positive", contribution_points: 10 },
        ],
      }),
    );
    expect(result.component.score).toBe(15); // clamped from 20
    expect(result.residual).toBe(5); // ai_score 20 - derived 15
  });

  it("forces relevance from sign even when AI lied", () => {
    const result = reconcileEvidenceContributions(
      buildComponent({
        score: 0,
        evidence: [
          // AI mislabeled a -10 as positive — engine forces it back to negative.
          { excerpt: "no Go", source: "req", relevance: "positive", contribution_points: -10 },
        ],
      }),
    );
    expect(result.component.evidence[0].relevance).toBe("negative");
  });

  it("preserves neutral relevance for zero contributions", () => {
    const result = reconcileEvidenceContributions(
      buildComponent({
        score: 0,
        evidence: [
          { excerpt: "context", source: "summary", relevance: "neutral", contribution_points: 0 },
        ],
      }),
    );
    expect(result.component.evidence[0].relevance).toBe("neutral");
    expect(result.component.score).toBe(0);
  });
});
```

- [ ] **Step 3: Run the failing tests**

Run: `pnpm --filter @aurahire/api test -- scoring.service.spec`
Expected: 7 failures from `describe("reconcileEvidenceContributions")` because the function isn't exported (or doesn't exist) yet. The existing `computeMatchPreviewOnView` block should still pass — don't touch it.

- [ ] **Step 4: Implement the helper**

In `apps/api/src/modules/scoring/scoring.service.ts`, immediately after the existing `normalizeComponentsToWeights` function (which currently ends around line 126), add:

```ts
/**
 * Strict-sum reconciliation: derive component.score from the sum of evidence
 * contribution_points, quantizing each to the nearest 5 and clamping to
 * [0, component.max]. Forces evidence.relevance to match the sign of the
 * (quantized) contribution.
 *
 * Returns the reconciled component plus residuals for audit:
 *   - residual = ai_score - derived_score (zero when AI was honest)
 *   - quantizationDeltas: per-evidence deltas where the AI's number was rounded
 *
 * The AI's `score` field is discarded by the engine; only `derived` ships.
 */
export function reconcileEvidenceContributions<
  C extends {
    name: string;
    score: number;
    max: number;
    evidence: Array<{
      excerpt: string;
      source: string;
      relevance: "positive" | "negative" | "neutral";
      contribution_points: number;
    }>;
  },
>(
  component: C,
): {
  component: C;
  residual: number;
  quantizationDeltas: Array<{ evidenceIndex: number; original: number; quantized: number }>;
} {
  const aiScore = component.score;
  const quantizationDeltas: Array<{ evidenceIndex: number; original: number; quantized: number }> = [];

  const reconciled = component.evidence.map((ev, evidenceIndex) => {
    const original = Number(ev.contribution_points) || 0;
    const quantized = Math.round(original / 5) * 5;
    if (quantized !== original) {
      quantizationDeltas.push({ evidenceIndex, original, quantized });
    }
    const relevance: "positive" | "negative" | "neutral" =
      quantized > 0 ? "positive" : quantized < 0 ? "negative" : "neutral";
    return { ...ev, contribution_points: quantized, relevance };
  });

  const derivedRaw = reconciled.reduce((sum, ev) => sum + ev.contribution_points, 0);
  const derived = Math.max(0, Math.min(component.max, derivedRaw));

  return {
    component: { ...component, score: derived, evidence: reconciled },
    residual: aiScore - derived,
    quantizationDeltas,
  };
}
```

- [ ] **Step 5: Re-run the tests**

Run: `pnpm --filter @aurahire/api test -- scoring.service.spec`
Expected: All 7 `reconcileEvidenceContributions` tests pass; existing `computeMatchPreviewOnView` block still passes.

- [ ] **Step 6: Type-check**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/scoring/scoring.service.ts apps/api/src/modules/scoring/scoring.service.spec.ts
git commit -m "feat(scoring): add reconcileEvidenceContributions helper

Pure helper that derives component.score from sum of evidence
contribution_points, quantizes to multiples of 5, clamps to [0, max],
and forces evidence relevance from sign. Returns residuals for audit.
Seven unit tests cover happy path, AI mismatch, quantization, both clamps,
and the relevance-from-sign override.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: TDD — `detectCalibrationWarnings` helper

**Goal:** Surface known model-misbehavior patterns (ceiling with thin evidence, deduction without negative evidence) as audit warnings — without auto-adjusting the score.

**Files:**
- Modify: `apps/api/src/modules/scoring/scoring.service.ts` (add helper next to `reconcileEvidenceContributions`)
- Modify: `apps/api/src/modules/scoring/scoring.service.spec.ts` (add second new describe block)

### Steps

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/modules/scoring/scoring.service.spec.ts`, add a new `describe` block after the `reconcileEvidenceContributions` block:

```ts
describe("detectCalibrationWarnings", () => {
  function buildComponent(overrides: Partial<{
    name: string;
    score: number;
    max: number;
    evidence: Array<{
      excerpt: string;
      source: string;
      relevance: "positive" | "negative" | "neutral";
      contribution_points: number;
    }>;
  }> = {}) {
    return {
      name: "skills",
      score: 0,
      max: 40,
      weight: 40,
      explanation: "test",
      evidence: [],
      ...overrides,
    };
  }

  it("flags ceiling with only one positive evidence item", () => {
    const warnings = detectCalibrationWarnings(
      buildComponent({
        score: 40,
        max: 40,
        evidence: [
          { excerpt: "TS", source: "skills", relevance: "positive", contribution_points: 40 },
        ],
      }),
    );
    expect(warnings).toEqual([
      { componentName: "skills", reason: "ceiling_with_thin_evidence" },
    ]);
  });

  it("does not flag ceiling with two or more positive items", () => {
    const warnings = detectCalibrationWarnings(
      buildComponent({
        score: 40,
        max: 40,
        evidence: [
          { excerpt: "TS", source: "skills", relevance: "positive", contribution_points: 20 },
          { excerpt: "PG", source: "skills", relevance: "positive", contribution_points: 20 },
        ],
      }),
    );
    expect(warnings).toEqual([]);
  });

  it("flags below-max with no negative evidence", () => {
    const warnings = detectCalibrationWarnings(
      buildComponent({
        score: 25,
        max: 30,
        evidence: [
          { excerpt: "a", source: "skills", relevance: "positive", contribution_points: 15 },
          { excerpt: "b", source: "skills", relevance: "positive", contribution_points: 10 },
        ],
      }),
    );
    expect(warnings).toEqual([
      { componentName: "skills", reason: "deduction_without_negative_evidence" },
    ]);
  });

  it("does not flag below-max when negative evidence is present", () => {
    const warnings = detectCalibrationWarnings(
      buildComponent({
        score: 25,
        max: 30,
        evidence: [
          { excerpt: "a", source: "skills", relevance: "positive", contribution_points: 30 },
          { excerpt: "gap", source: "req", relevance: "negative", contribution_points: -5 },
        ],
      }),
    );
    expect(warnings).toEqual([]);
  });

  it("returns empty array for a healthy at-zero component", () => {
    const warnings = detectCalibrationWarnings(
      buildComponent({
        score: 0,
        max: 40,
        evidence: [
          { excerpt: "no match", source: "req", relevance: "negative", contribution_points: -40 },
        ],
      }),
    );
    expect(warnings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `pnpm --filter @aurahire/api test -- scoring.service.spec`
Expected: 5 failures from the new describe block.

- [ ] **Step 3: Implement the helper**

In `apps/api/src/modules/scoring/scoring.service.ts`, immediately after `reconcileEvidenceContributions`, add:

```ts
/**
 * Surface known model-misbehavior patterns as advisory warnings.
 * Warnings do NOT auto-adjust the score — they're written to the audit
 * row's `details.calibrationWarnings` array and aggregated in
 * /admin/bias-monitor's "Scoring Quality" panel for human review.
 *
 * Two heuristics:
 *   1. ceiling_with_thin_evidence — Component scored at max but the model
 *      only cited one positive evidence item. The prompt v1.2.0 rule
 *      requires at least two positives at ceiling.
 *   2. deduction_without_negative_evidence — Component below max but no
 *      evidence row carries a negative contribution. The deduction has no
 *      visible justification.
 */
export function detectCalibrationWarnings<C extends {
  name: string;
  score: number;
  max: number;
  evidence: Array<{
    excerpt: string;
    source: string;
    relevance: "positive" | "negative" | "neutral";
    contribution_points: number;
  }>;
}>(component: C): Array<{ componentName: string; reason: string }> {
  const warnings: Array<{ componentName: string; reason: string }> = [];

  if (component.score === component.max) {
    const positives = component.evidence.filter((e) => e.relevance === "positive");
    if (positives.length < 2) {
      warnings.push({
        componentName: component.name,
        reason: "ceiling_with_thin_evidence",
      });
    }
  }

  if (component.score < component.max) {
    const negatives = component.evidence.filter((e) => e.relevance === "negative");
    if (negatives.length === 0) {
      warnings.push({
        componentName: component.name,
        reason: "deduction_without_negative_evidence",
      });
    }
  }

  return warnings;
}
```

- [ ] **Step 4: Re-run the tests**

Run: `pnpm --filter @aurahire/api test -- scoring.service.spec`
Expected: All 5 new tests pass; previous tests still green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/scoring/scoring.service.ts apps/api/src/modules/scoring/scoring.service.spec.ts
git commit -m "feat(scoring): add detectCalibrationWarnings helper

Surfaces ceiling-with-thin-evidence and deduction-without-negative-evidence
patterns as advisory warnings. Warnings do not adjust the score — they
flow into audit_logs.details for /admin/bias-monitor aggregation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire reconciliation into `computeProfileScore`

**Goal:** Profile scoring path runs reconciliation + calibration warnings before persisting. Replaces the hardcoded `contributionPoints: null` at line 289 with the AI-supplied + reconciled value.

**Files:**
- Modify: `apps/api/src/modules/scoring/scoring.service.ts:218-360`

### Steps

- [ ] **Step 1: Read the current method**

Run: `sed -n '218,360p' apps/api/src/modules/scoring/scoring.service.ts`
Note the structure: `normalizeComponentsToWeights` → `deriveOverallScore` → `deriveBand` → build `evidenceRows` → `insertProfileScore` → `audit.log`.

- [ ] **Step 2: Add reconciliation between `normalizeComponentsToWeights` and `deriveOverallScore`**

Locate lines 276-281:

```ts
const normalizedProfileComponents = normalizeComponentsToWeights(
  aiResult.score.components,
  weights as unknown as Record<string, number>,
);
const derivedOverall = deriveOverallScore(normalizedProfileComponents);
const derivedBand = deriveBand(derivedOverall, bandThresholds);
```

Replace with:

```ts
const normalizedProfileComponents = normalizeComponentsToWeights(
  aiResult.score.components,
  weights as unknown as Record<string, number>,
);

// Strict-sum reconciliation: component.score becomes the (quantized, clamped)
// sum of evidence contribution_points. The AI's score field is discarded;
// residuals + quantization deltas + calibration warnings flow into the audit row.
const reconciliations = normalizedProfileComponents.map((c) =>
  reconcileEvidenceContributions(c),
);
const reconciledProfileComponents = reconciliations.map((r) => r.component);
const scoreResiduals = reconciliations
  .filter((r) => r.residual !== 0)
  .map((r) => ({
    componentName: r.component.name,
    aiScore: r.component.score + r.residual,
    derivedScore: r.component.score,
  }));
const evidenceQuantizationResiduals = reconciliations.flatMap((r) =>
  r.quantizationDeltas.map((d) => ({
    componentName: r.component.name,
    evidenceIndex: d.evidenceIndex,
    original: d.original,
    quantized: d.quantized,
  })),
);
const calibrationWarnings = reconciledProfileComponents.flatMap((c) =>
  detectCalibrationWarnings(c),
);

const derivedOverall = deriveOverallScore(reconciledProfileComponents);
const derivedBand = deriveBand(derivedOverall, bandThresholds);
```

- [ ] **Step 3: Update the `evidenceRows` mapper to flow contribution_points (replace line 283-291)**

Replace:

```ts
const evidenceRows = normalizedProfileComponents.flatMap((comp) =>
  comp.evidence.map((ev) => ({
    componentName: comp.name,
    excerptText: ev.excerpt,
    excerptSource: ev.source,
    relevance: ev.relevance,
    contributionPoints: null,
  })),
);
```

with:

```ts
const evidenceRows = reconciledProfileComponents.flatMap((comp) =>
  comp.evidence.map((ev) => ({
    componentName: comp.name,
    excerptText: ev.excerpt,
    excerptSource: ev.source,
    relevance: ev.relevance,
    contributionPoints: ev.contribution_points,
  })),
);
```

- [ ] **Step 4: Update the `insertProfileScore` call (around line 293-310) to pass reconciled components**

Replace:

```ts
const { profileScore } = await this.scoringRepo.insertProfileScore(
  {
    candidateId,
    resumeId: resume.id,
    overallScore: derivedOverall,
    band: derivedBand,
    components: normalizedProfileComponents as unknown as Record<string, unknown>,
    improvementSuggestions: aiResult.score
      .improvement_suggestions as unknown as Record<string, unknown>,
    redactedFields: aiResult.redactedFields,
    promptVersion: aiResult.promptVersion,
    modelUsed: aiResult.model,
    rawOutput: aiResult.score as unknown as Record<string, unknown>,
    latencyMs: aiResult.latencyMs,
    status: "completed",
  },
  evidenceRows,
);
```

with (only the `components` line and `rawOutput` line change — `components` reads from reconciled, `rawOutput` keeps AI's original for audit):

```ts
const { profileScore } = await this.scoringRepo.insertProfileScore(
  {
    candidateId,
    resumeId: resume.id,
    overallScore: derivedOverall,
    band: derivedBand,
    components: reconciledProfileComponents as unknown as Record<string, unknown>,
    improvementSuggestions: aiResult.score
      .improvement_suggestions as unknown as Record<string, unknown>,
    redactedFields: aiResult.redactedFields,
    promptVersion: aiResult.promptVersion,
    modelUsed: aiResult.model,
    rawOutput: aiResult.score as unknown as Record<string, unknown>,
    latencyMs: aiResult.latencyMs,
    status: "completed",
  },
  evidenceRows,
);
```

- [ ] **Step 5: Extend the `audit.log` call (around line 312-329) with the new fields**

Replace:

```ts
await this.audit.log({
  actorId: candidateId,
  actorType: "ai",
  action: "score.profile.computed",
  entityType: "profile_score",
  entityId: profileScore.id,
  details: {
    reason,
    overallScore: profileScore.overallScore,
    band: profileScore.band,
    model: aiResult.model,
    promptVersion: aiResult.promptVersion,
    latencyMs: aiResult.latencyMs,
    redactedFields: aiResult.redactedFields,
    weightsUsed: weights as unknown as Record<string, unknown>,
  },
  ...requestMeta,
});
```

with:

```ts
await this.audit.log({
  actorId: candidateId,
  actorType: "ai",
  action: "score.profile.computed",
  entityType: "profile_score",
  entityId: profileScore.id,
  details: {
    reason,
    overallScore: profileScore.overallScore,
    band: profileScore.band,
    model: aiResult.model,
    promptVersion: aiResult.promptVersion,
    latencyMs: aiResult.latencyMs,
    redactedFields: aiResult.redactedFields,
    weightsUsed: weights as unknown as Record<string, unknown>,
    scoreResiduals,
    evidenceQuantizationResiduals,
    calibrationWarnings,
  },
  ...requestMeta,
});
```

- [ ] **Step 6: Update the `toDto` call at the bottom of the method (around line 350-360) to use reconciled components**

Replace `normalizedProfileComponents` with `reconciledProfileComponents` in the spread there.

- [ ] **Step 7: Type-check**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: No errors.

- [ ] **Step 8: Run all scoring tests**

Run: `pnpm --filter @aurahire/api test -- scoring.service.spec`
Expected: All tests pass (existing `computeMatchPreviewOnView`, plus `reconcileEvidenceContributions` and `detectCalibrationWarnings` blocks).

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/scoring/scoring.service.ts
git commit -m "feat(scoring): wire reconciliation into computeProfileScore

Profile evidence now carries contribution_points (was hardcoded null).
Component scores derive from quantized contribution sums; AI's score is
discarded. Audit row gains scoreResiduals, evidenceQuantizationResiduals,
and calibrationWarnings under details.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wire reconciliation into `computeMatchScore`

**Goal:** Full match-score path (used when an application is created) runs the same reconciliation as profile.

**Files:**
- Modify: `apps/api/src/modules/scoring/scoring.service.ts:460-620` (the `computeMatchScore` method)

### Steps

- [ ] **Step 1: Locate the normalize → derive block**

The method currently has at line 533-539:

```ts
const normalizedMatchComponents = normalizeComponentsToWeights(
  aiResult.score.components,
  weights as unknown as Record<string, number>,
);
const derivedOverall = deriveOverallScore(normalizedMatchComponents);
const derivedBand = deriveBand(derivedOverall, bandThresholds);
```

- [ ] **Step 2: Insert reconciliation between normalize and derive**

Replace the block with:

```ts
const normalizedMatchComponents = normalizeComponentsToWeights(
  aiResult.score.components,
  weights as unknown as Record<string, number>,
);

const matchReconciliations = normalizedMatchComponents.map((c) =>
  reconcileEvidenceContributions(c),
);
const reconciledMatchComponents = matchReconciliations.map((r) => r.component);
const matchScoreResiduals = matchReconciliations
  .filter((r) => r.residual !== 0)
  .map((r) => ({
    componentName: r.component.name,
    aiScore: r.component.score + r.residual,
    derivedScore: r.component.score,
  }));
const matchEvidenceQuantizationResiduals = matchReconciliations.flatMap((r) =>
  r.quantizationDeltas.map((d) => ({
    componentName: r.component.name,
    evidenceIndex: d.evidenceIndex,
    original: d.original,
    quantized: d.quantized,
  })),
);
const matchCalibrationWarnings = reconciledMatchComponents.flatMap((c) =>
  detectCalibrationWarnings(c),
);

const derivedOverall = deriveOverallScore(reconciledMatchComponents);
const derivedBand = deriveBand(derivedOverall, bandThresholds);
```

- [ ] **Step 3: Update the evidenceRows mapper (around line 541-549) to read from reconciled**

Replace:

```ts
const evidenceRows = normalizedMatchComponents.flatMap((comp) =>
  comp.evidence.map((ev) => ({
    componentName: comp.name,
    excerptText: ev.excerpt,
    excerptSource: ev.source,
    relevance: ev.relevance,
    contributionPoints: ev.contribution_points,
  })),
);
```

with:

```ts
const evidenceRows = reconciledMatchComponents.flatMap((comp) =>
  comp.evidence.map((ev) => ({
    componentName: comp.name,
    excerptText: ev.excerpt,
    excerptSource: ev.source,
    relevance: ev.relevance,
    contributionPoints: ev.contribution_points,
  })),
);
```

- [ ] **Step 4: Update the `insertMatchScore` call (around line 551-569) — change `components` field**

Replace `normalizedMatchComponents` with `reconciledMatchComponents` in the `components:` field.

- [ ] **Step 5: Find the audit.log call for match score**

Run: `grep -n "score.match.computed\|score\\.match\\.promoted" apps/api/src/modules/scoring/scoring.service.ts`
Note the line range of the audit.log call that follows the `insertMatchScore`.

- [ ] **Step 6: Add the new audit fields**

In the audit.log call's `details` block, add:

```ts
scoreResiduals: matchScoreResiduals,
evidenceQuantizationResiduals: matchEvidenceQuantizationResiduals,
calibrationWarnings: matchCalibrationWarnings,
```

- [ ] **Step 7: Update the matchScoreToDto call (or wherever the response is built)**

Find the `matchScoreToDto(...)` call near the end of `computeMatchScore` and ensure it receives `reconciledMatchComponents` (most likely the `aiResult.score` is being passed; you'll need to thread the reconciled components through). If the path passes `aiResult.score` as-is, change it to overwrite `aiResult.score.components` with `reconciledMatchComponents` before the call:

```ts
const reconciledScoreOutput = {
  ...aiResult.score,
  components: reconciledMatchComponents,
};
```

Then pass `reconciledScoreOutput` instead of `aiResult.score`.

- [ ] **Step 8: Type-check + tests**

Run: `pnpm --filter @aurahire/api tsc --noEmit && pnpm --filter @aurahire/api test -- scoring.service.spec`
Expected: clean compile, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/scoring/scoring.service.ts
git commit -m "feat(scoring): wire reconciliation into computeMatchScore

Full match-score path now reconciles evidence contributions, quantizes
to multiples of 5, and writes residuals + calibration warnings to audit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire reconciliation into `computeMatchPreviewInternal`

**Goal:** Match-preview path (candidate clicks "See my match", or system precomputes top-N) runs identical reconciliation. Persists to `match_score_previews` (no separate `evidence_excerpts` rows for previews — evidence lives in `components` jsonb).

**Files:**
- Modify: `apps/api/src/modules/scoring/scoring.service.ts:820-920` (the `computeMatchPreviewInternal` method)

### Steps

- [ ] **Step 1: Locate the normalize → derive block**

Around lines 892-897:

```ts
const normalizedPreviewComponents = normalizeComponentsToWeights(
  aiResult.score.components,
  weights as unknown as Record<string, number>,
);
const derivedOverall = deriveOverallScore(normalizedPreviewComponents);
const derivedBand = deriveBand(derivedOverall, bandThresholds);
```

- [ ] **Step 2: Insert reconciliation**

Replace with:

```ts
const normalizedPreviewComponents = normalizeComponentsToWeights(
  aiResult.score.components,
  weights as unknown as Record<string, number>,
);

const previewReconciliations = normalizedPreviewComponents.map((c) =>
  reconcileEvidenceContributions(c),
);
const reconciledPreviewComponents = previewReconciliations.map((r) => r.component);
const previewScoreResiduals = previewReconciliations
  .filter((r) => r.residual !== 0)
  .map((r) => ({
    componentName: r.component.name,
    aiScore: r.component.score + r.residual,
    derivedScore: r.component.score,
  }));
const previewEvidenceQuantizationResiduals = previewReconciliations.flatMap((r) =>
  r.quantizationDeltas.map((d) => ({
    componentName: r.component.name,
    evidenceIndex: d.evidenceIndex,
    original: d.original,
    quantized: d.quantized,
  })),
);
const previewCalibrationWarnings = reconciledPreviewComponents.flatMap((c) =>
  detectCalibrationWarnings(c),
);

const derivedOverall = deriveOverallScore(reconciledPreviewComponents);
const derivedBand = deriveBand(derivedOverall, bandThresholds);
```

- [ ] **Step 3: Update `upsertMatchPreview` call (around line 899-913) — change `components` field**

Replace `normalizedPreviewComponents` with `reconciledPreviewComponents` in the `components:` field of the upsert payload.

- [ ] **Step 4: Find the audit.log call for the preview**

Run: `grep -n "score.match-preview.computed\|match-preview\\..*audit\\|action: \"score\\.match-preview" apps/api/src/modules/scoring/scoring.service.ts`
Note the audit log call. Add the same three new fields:

```ts
scoreResiduals: previewScoreResiduals,
evidenceQuantizationResiduals: previewEvidenceQuantizationResiduals,
calibrationWarnings: previewCalibrationWarnings,
```

If there is no audit.log call for previews, skip this step (and note in the commit that previews don't audit, which is the existing pattern).

- [ ] **Step 5: Type-check + tests**

Run: `pnpm --filter @aurahire/api tsc --noEmit && pnpm --filter @aurahire/api test -- scoring.service.spec`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/scoring/scoring.service.ts
git commit -m "feat(scoring): wire reconciliation into computeMatchPreview

Match preview path (candidate 'See my match' + system precompute) runs
identical reconciliation. Reconciled components persist to
match_score_previews.components.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire reconciliation into `rescore-batch.processor`

**Goal:** Admin-driven batch rescores produce the same reconciled scores as candidate-driven ones. Without this, manual rescores would silently bypass the entire transparency pipeline.

**Files:**
- Modify: `apps/api/src/modules/admin/processors/rescore-batch.processor.ts:90-150`

### Steps

- [ ] **Step 1: Read the current loop body**

Run: `sed -n '90,150p' apps/api/src/modules/admin/processors/rescore-batch.processor.ts`
Note: the current code calls `scoreMatch.score`, then directly inserts using `aiResult.score.overall_score` and `aiResult.score.components` without normalization or reconciliation.

- [ ] **Step 2: Import the helpers**

At the top of the file, add to the existing scoring.service import (or add a new import if the helpers aren't already imported there):

```ts
import {
  ScoringService,
  reconcileEvidenceContributions,
  detectCalibrationWarnings,
  // existing imports stay
} from "../../scoring/scoring.service";
```

(Adjust path as needed based on the file's existing imports — the helpers live in `scoring.service.ts`.)

If `normalizeComponentsToWeights` / `deriveOverallScore` / `deriveBand` are needed here too, add them. **First check whether they are already exported.** If not, export them from `scoring.service.ts` in the same edit:

```ts
// In scoring.service.ts, change:
function deriveOverallScore(...)
function normalizeComponentsToWeights(...)
function deriveBand(...)

// to:
export function deriveOverallScore(...)
export function normalizeComponentsToWeights(...)
export function deriveBand(...)
```

- [ ] **Step 3: Replace the inline `aiResult.score.overall_score` / `.band` / `.components` writes with reconciled equivalents**

Find the block (around lines 117-138):

```ts
const evidenceRows = aiResult.score.components.flatMap((comp) =>
  comp.evidence.map((ev) => ({
    componentName: comp.name,
    excerptText: ev.excerpt,
    excerptSource: ev.source,
    relevance: ev.relevance,
    contributionPoints: ev.contribution_points,
  })),
);

const { matchScore } = await this.scoringRepo.insertMatchScore(
  {
    applicationId: application.id,
    candidateId: application.candidateId,
    jobId: application.jobId,
    resumeId: application.resumeId,
    overallScore: aiResult.score.overall_score,
    band: aiResult.score.band,
    components: aiResult.score.components as unknown as Record<string, unknown>,
    redactedFields: aiResult.redactedFields,
    weightsUsed: weights as unknown as Record<string, unknown>,
    promptVersion: aiResult.promptVersion,
    modelUsed: aiResult.model,
    ...
```

Replace with:

```ts
const normalizedComponents = normalizeComponentsToWeights(
  aiResult.score.components,
  weights as unknown as Record<string, number>,
);
const reconciliations = normalizedComponents.map((c) =>
  reconcileEvidenceContributions(c),
);
const reconciledComponents = reconciliations.map((r) => r.component);
const derivedOverall = deriveOverallScore(reconciledComponents);
const derivedBand = deriveBand(derivedOverall, bandThresholds);
const calibrationWarnings = reconciledComponents.flatMap((c) =>
  detectCalibrationWarnings(c),
);

const evidenceRows = reconciledComponents.flatMap((comp) =>
  comp.evidence.map((ev) => ({
    componentName: comp.name,
    excerptText: ev.excerpt,
    excerptSource: ev.source,
    relevance: ev.relevance,
    contributionPoints: ev.contribution_points,
  })),
);

const { matchScore } = await this.scoringRepo.insertMatchScore(
  {
    applicationId: application.id,
    candidateId: application.candidateId,
    jobId: application.jobId,
    resumeId: application.resumeId,
    overallScore: derivedOverall,
    band: derivedBand,
    components: reconciledComponents as unknown as Record<string, unknown>,
    redactedFields: aiResult.redactedFields,
    weightsUsed: weights as unknown as Record<string, unknown>,
    promptVersion: aiResult.promptVersion,
    modelUsed: aiResult.model,
    ...
```

(Note: `bandThresholds` must be in scope. If not, fetch it from the scoring config alongside `weights` at the top of the loop body. Pattern matches the way `computeMatchScore` does it at line 498.)

- [ ] **Step 4: If the processor logs an audit row for each rescore, add the new fields**

Run: `grep -n "audit\\.log" apps/api/src/modules/admin/processors/rescore-batch.processor.ts`
If found, add `calibrationWarnings` (object shorthand) to the `details` object. (Score and quantization residuals are optional here; the calibration warnings are the load-bearing signal.)

- [ ] **Step 5: Type-check + tests**

Run: `pnpm --filter @aurahire/api tsc --noEmit && pnpm --filter @aurahire/api test -- rescore-batch.processor`

If no spec file exists for the rescore processor, just run the type-check.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/admin/processors/rescore-batch.processor.ts apps/api/src/modules/scoring/scoring.service.ts
git commit -m "feat(scoring): apply reconciliation to admin rescore-batch path

Closes a transparency gap: admin-driven batch rescores were inserting
AI-raw overall_score + components without normalization. Now they run
through the full normalize → reconcile → derive pipeline like every
other score-write path. Helpers exported from scoring.service.ts so
the processor can import them.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Bump `score-profile.ts` to v1.2.0 — **HUMAN APPROVAL GATE**

**Goal:** Profile prompt version bumps; new instructions force the model to populate `contribution_points`, surface negative evidence when below ceiling, and require quantified-or-senior signals at ceiling.

**Files:**
- Modify: `apps/api/src/ai/prompts/score-profile.ts:1-65`

> ⚠️ **STOP.** Per `CLAUDE.md` § "When to ask vs proceed":
> > Changing the AI prompts (versions matter — bumping a prompt is a thesis-defensible event, not a casual edit) — Ask first.
>
> Before completing this task, present the diff to the human and wait for explicit approval. The implementing agent must surface the full before/after content of `score-profile.ts` in its message.

### Steps

- [ ] **Step 1: Surface the diff to the human**

Output the current contents of `apps/api/src/ai/prompts/score-profile.ts` and the proposed v1.2.0 contents (steps 2–4 below) for human approval. Pause until the human responds with "approved".

- [ ] **Step 2: Bump the version constant (line 1)**

Replace:

```ts
export const SCORE_PROFILE_VERSION = "1.1.0";
```

with:

```ts
export const SCORE_PROFILE_VERSION = "1.2.0";
```

- [ ] **Step 3: Replace the system prompt (lines 3-39) with the v1.2.0 version**

```ts
export const SCORE_PROFILE_SYSTEM_PROMPT = `You are an expert career coach evaluating a candidate's resume strength.

Assess the resume against four components and produce a structured score:
1. Completeness — percentage of resume sections filled (contact, education, experience, skills, summary, links)
2. Skill Depth — number of relevant skills, modernity, alignment with desired role, evidence of mastery
3. Experience Clarity — quality of experience descriptions: outcomes, technologies, durations, quantified impact
4. Education Quality — degree match for desired role + relevant certifications

For each component:
1. Score 0..max where max is the configured weight provided in the user message. The score MUST be a multiple of 5.
2. Write 1-2 sentence plain-language explanation. When score < max, the explanation MUST identify what specifically prevented a higher score (e.g. missing leadership signals, insufficient quantified outcomes, generic experience bullets, no advanced certifications). Do not pad with generic praise.
3. Provide 2-6 evidence excerpts from the resume that drove the score. Each excerpt:
   - excerpt: a short quote from the resume (or for negative items, the section/expectation that fell short).
   - source: section reference (e.g. "Experience › Senior Engineer at Acme", or "Resume › Education" for an absent-credential gap).
   - relevance: "positive" (helped earn points) | "negative" (a gap that cost points) | "neutral" (context only).
   - contribution_points: SIGNED integer that is a MULTIPLE OF 5 (..., -15, -10, -5, 0, +5, +10, +15, ...). Positive when the quote helped (+N). Negative when it represents a gap (-N). 0 only for purely neutral context. The engine derives component.score from the SUM of contribution_points, clamped to [0, max] — so the sum MUST equal the score you intend.

CALIBRATION RULE — When you score a component at its ceiling (full max):
- You MUST cite at least TWO positive evidence items.
- At least one of those items MUST reference quantified outcomes (numbers, percentages, dollar figures, scale metrics like "8k DAU") OR senior-level scope (leadership, ownership, architectural decisions, multi-team scope).
- Otherwise, cap the component at 85% of max (rounded to the nearest 5) and surface the gap as a negative evidence item.

EVIDENCE BALANCE — For every component where score < max, you MUST include at least one evidence item with relevance="negative" and contribution_points<0 that explains the deduction. No exceptions. The negative items' contribution_points should arithmetically explain why the component sits below max.

Then the engine sums component scores for overall_score (0-100). Determine band:
- 70-100: "strong"
- 40-69:  "partial"
- 0-39:   "limited"

Suggest up to 3 specific improvements the candidate could make.
For each: title, description, estimated_impact (points; conservative; max 10).

IMPORTANT:
- Do NOT infer demographics or background; score only on the redacted content provided.
- Do NOT exceed the configured max for any component.
- Be specific in evidence quotes; use the candidate's actual words from the resume.
- Improvement suggestions should be actionable (e.g., "Add cloud certifications") not vague (e.g., "Improve overall presentation").`;
```

- [ ] **Step 4: Leave the user prompt builder unchanged (lines 41-65)**

The `buildScoreProfileUserPrompt` function and its call sites do not need to change. Confirm by running:

```
grep -n "buildScoreProfileUserPrompt" apps/api/src/ai/prompts/score-profile.ts
grep -rn "buildScoreProfileUserPrompt" apps/api/src
```

- [ ] **Step 5: Run the type-check**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: No errors. The version constant is consumed by `score-profile.service.ts` for cache keys; the bump invalidates pre-1.2.0 cached entries automatically.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ai/prompts/score-profile.ts
git commit -m "feat(ai): bump score-profile prompt to v1.2.0

Adds contribution_points instruction (multiple of 5; sum equals score).
Tightens calibration anchor: ceiling requires 2+ positives with at least
one quantified-OR-senior signal. Requires negative evidence for any
component below max. Cache keys invalidate via promptVersion bump.

This prompt version is a thesis-defensible event; reviewed and approved
by human before merge.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Bump `score-match.ts` to v1.2.0 — **HUMAN APPROVAL GATE**

**Goal:** Match prompt version bumps; replaces `"approximately"` with strict equality, adds 5-point quantization, adds calibration rule.

**Files:**
- Modify: `apps/api/src/ai/prompts/score-match.ts:1-92`

> ⚠️ **STOP.** Same gate as Task 8. Surface the diff and wait for human approval before proceeding.

### Steps

- [ ] **Step 1: Surface the diff to the human**

Output current and proposed contents. Pause for explicit approval.

- [ ] **Step 2: Bump the version constant (line 1)**

Replace:

```ts
export const SCORE_MATCH_VERSION = "1.1.0";
```

with:

```ts
export const SCORE_MATCH_VERSION = "1.2.0";
```

- [ ] **Step 3: Replace the system prompt (lines 3-54) with the v1.2.0 version**

```ts
export const SCORE_MATCH_SYSTEM_PROMPT = `You are an expert recruiter scoring a candidate's match against a specific job. Use the four components below and produce a structured match score that explains BOTH why points were earned AND why points were not.

For each component:
1. Score 0..max (where max is the configured weight). The score MUST be a multiple of 5.
2. Plain-language explanation. When score < max, the explanation MUST identify what specifically prevented a higher score (e.g. missing required skill, insufficient years of experience, education gap, tone mismatch). Do not pad with generic praise.
3. 1-6 evidence excerpts in total — a mix of positive (what helped) and negative (what was missing or mismatched).
   - excerpt: a short quote. For positive items, quote the candidate's resume verbatim. For negative items, quote either the resume snippet that fell short OR the job-description requirement the resume does not satisfy.
   - source: section reference. Examples — "Experience › Senior Engineer at Acme" (resume), or "Job requirement › Required Skills" (job description) for gap items.
   - relevance: "positive" (helped earn points) | "negative" (a gap that cost points) | "neutral"
   - contribution_points: SIGNED integer that is a MULTIPLE OF 5 (..., -15, -10, -5, 0, +5, +10, +15, ...). Positive when the quote helped (+N). Negative when it represents a gap (-N). 0 only for purely neutral context.

Components:

skills:
- Count required skills present in resume; treat synonyms as matches (React == ReactJS == React.js, AWS == Amazon Web Services, etc.)
- Bonus for adjacent/complementary skills
- Gap evidence: name each required skill that is absent or only weakly demonstrated.

experience:
- Compare years of experience and seniority of past titles to the job's level
- Match in industry/domain is a positive
- Gap evidence: cite required years/seniority/domain that are unmet (e.g. "Job asks for 5+ years; resume shows 2").

education:
- Compare highest degree to requirement
- Bonus for relevant certifications
- Gap evidence: name the required degree, field, or certification that is missing.

cultural_fit:
- Compare tone and language between resume's responsibilities/summary and job description
- Look for soft-skill alignment (collaborative, fast-paced, structured, etc.)
- Gap evidence: name the soft-skill or working-style cue from the JD that the resume does not echo.

EVIDENCE BALANCE — REQUIRED:
- The sum of all evidence contribution_points (positive + negative) must EQUAL component.score exactly. If you score skills at 25/40, the contributions must sum to 25. The engine recomputes score from the sum, so any mismatch will be silently overwritten — match them yourself for narrative coherence.
- For every component where score < max, you MUST include at least one "negative" evidence item that names the gap. No exceptions.
- For components scored at max, do NOT fabricate gaps — only positive/neutral evidence.
- Total evidence per component: aim for 2–4 items in mixed cases (some positives + at least one negative). Do not exceed 6.

CALIBRATION RULE — When you score a component at its ceiling (full max):
- You MUST cite at least TWO positive evidence items.
- At least one of those items MUST reference quantified outcomes (numbers, percentages, dollar figures) OR senior-level scope (leadership, ownership, architectural decisions).
- Otherwise, cap the component at 85% of max (rounded to the nearest 5) and surface the gap as a negative evidence item.

After scoring components:
- The engine sums component scores to overall_score (0-100).
- Determine band: "strong" (70+), "partial" (40-69), "limited" (0-39)
- Write a one-paragraph synthesis (summary). When the overall score is below 100, the summary must acknowledge the main gap(s), not only strengths.
- List up to 3 red_flags (significant gaps) — optional, but populate when at least one component scored below 60% of its max.
- List up to 3 green_flags (standout strengths) — optional.

IMPORTANT:
- Do NOT infer demographics; score only on the redacted content provided.
- Be honest: a candidate who doesn't fit should score low and the gaps must be visible in evidence.
- For positive evidence, use the candidate's actual words from the resume.
- For negative evidence, prefer quoting the unmet job requirement; the source field can name the missing criterion.
- Never report a perfect score (max for every component) without genuine, specific positive evidence in every component.`;
```

- [ ] **Step 4: Leave the user prompt builder unchanged (lines 56-92)**

- [ ] **Step 5: Run the type-check**

Run: `pnpm --filter @aurahire/api tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ai/prompts/score-match.ts
git commit -m "feat(ai): bump score-match prompt to v1.2.0

Replaces 'approximately sum to (score - max)' with strict equality
between sum and component.score. Adds 5-point quantization rule.
Adds calibration rule: ceiling requires 2+ positives with at least
one quantified-OR-senior signal. Cache keys invalidate via promptVersion.

Reviewed and approved by human before merge.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# Phase 2 — Frontend

Phase 2 is purely cosmetic. The backend now writes `contribution_points` into both profile and match evidence; the frontend already pipes the field through to `EvidenceCallout` (verified across 5 consumer files). The only change needed is the footer copy fix inside `EvidenceCallout` itself.

---

## Task 10: Update `evidence-callout.tsx` footer copy

**Goal:** Replace `"Contributes ±N points"` with a signed-integer chip rendered in score-band color, using Unicode minus.

**Files:**
- Modify: `apps/web/components/score/evidence-callout.tsx:65-70`

### Steps

- [ ] **Step 1: Replace the footer block (lines 65-70)**

Replace:

```tsx
{typeof contributionPoints === "number" && contributionPoints !== 0 && (
  <p className="mt-3 text-xs text-[var(--color-muted)]">
    Contributes {contributionPoints > 0 ? "+" : ""}
    <span className="font-mono">{contributionPoints}</span> points
  </p>
)}
```

with:

```tsx
{typeof contributionPoints === "number" && contributionPoints !== 0 && (
  <p
    className="mt-3 text-xs font-mono font-semibold"
    style={{ color: variant.iconColor }}
  >
    {contributionPoints > 0 ? "+" : "−"}
    {Math.abs(contributionPoints)} points
  </p>
)}
```

Three changes vs. the old footer:
- Drop the "Contributes" verb (semantically wrong for negatives, redundant with the HELPED / HURT chip in the header).
- Use Unicode minus `−` (U+2212), not ASCII hyphen `-` — typographically correct + matches existing `−5 pts to perfect` copy on the same page.
- Color the chip per relevance (`var(--color-score-high)` for positive, `var(--color-score-low)` for negative) instead of always-muted gray. The number itself becomes a glanceable signal.

- [ ] **Step 2: Type-check + lint**

Run: `pnpm --filter @aurahire/web tsc --noEmit && pnpm --filter @aurahire/web lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/score/evidence-callout.tsx
git commit -m "fix(score): drop 'Contributes' verb on evidence point chip

'Contributes -5 points' read as a typo because contributing implies
adding. Replaced with a colored signed-integer chip ('+5 points' /
'−5 points') in score-band color; the HELPED / HURT chip in the
header carries direction. Unicode minus replaces ASCII hyphen.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Manual UI verification — **HUMAN STEP**

**Goal:** Confirm the visible math reconciles end-to-end.

**Files:** None modified.

### Steps

- [ ] **Step 1: Human starts dev servers**

Per `CLAUDE.md` § "Hard rules": Claude does NOT run dev servers. Ask the human to run `pnpm dev` from the repo root and report the dev URL (typically `http://localhost:3000`).

- [ ] **Step 2: Human triggers a fresh profile score**

Navigate to `/candidate/profile`, click **Recompute**. Wait for the AI shimmer to clear and the new breakdown to render.

- [ ] **Step 3: Verify each component sums correctly**

For each of the four components (Completeness, Skill Depth, Experience Clarity, Education Quality):
- Click the component to expand its evidence panel.
- Add the visible point chips (`+10 points`, `−5 points`, etc.) in your head.
- The sum must equal the displayed component score (e.g. `Skill Depth 25/30` ⇒ visible chips sum to +25).
- Add the four component scores. They must equal the headline (e.g. `25 + 25 + 30 + 5 = 85`).

- [ ] **Step 4: Verify the copy fix landed**

Search the page for the word "Contributes" — it must not appear anywhere in the breakdown. Negative chips render as `−5 points`, positive as `+5 points`.

- [ ] **Step 5: Repeat for match preview**

Navigate to `/candidate/jobs/<any-job-id>`. The match preview renders below the apply button. Repeat steps 3–4 for the four match components (Skills, Experience, Education, Cultural Fit).

- [ ] **Step 6: Repeat for full match score**

If a recruiter test account exists, navigate to `/recruiter/applications/<any-app-id>`. Repeat steps 3–4 for the full match score.

- [ ] **Step 7: Report any reconciliation failure**

If a component's chips don't sum to its score, the issue is on the **backend** (reconciliation didn't fire, or the response DTO is reading from `rawOutput` instead of the reconciled `components`). Re-open Tasks 4–7 and look for a missed handoff. Do NOT patch the frontend.

If all checks pass, Phase 2 is complete.

---

# Phase 3 — Bias Monitor Surface

Phase 3 surfaces the calibration warnings collected by Phases 1–2 in `/admin/bias-monitor`. Depends on having v1.2.0 traffic in `audit_logs.details` to populate the panel meaningfully.

---

## Task 12: Backend — extend bias-monitor repository with calibration query

**Goal:** Add a repository method that aggregates `audit_logs.details.calibrationWarnings` over a date range, optionally filtered by `prompt_version`.

**Files:**
- Modify: `apps/api/src/modules/admin/repositories/admin-bias-monitor.repository.ts`

### Steps

- [ ] **Step 1: Read the current repository**

Run: `cat apps/api/src/modules/admin/repositories/admin-bias-monitor.repository.ts`
Note the existing query patterns. The repo uses Drizzle.

- [ ] **Step 2: Add the new method**

Append to the existing class:

```ts
/**
 * Aggregate calibrationWarnings from audit_logs over a date range.
 * Optionally filtered by min prompt_version (e.g. ">=1.2.0" so legacy
 * pre-reconciliation rows don't pollute the count).
 */
async getCalibrationWarnings(opts: {
  from: Date;
  to: Date;
  promptVersionMin?: string;
}): Promise<{
  totalWarnings: number;
  byReason: Array<{ reason: string; count: number }>;
  byComponent: Array<{ componentName: string; count: number }>;
  recent: Array<{
    auditLogId: string;
    componentName: string;
    reason: string;
    promptVersion: string;
    createdAt: string;
  }>;
}> {
  const promptVersionFilter = opts.promptVersionMin
    ? sql`AND (details->>'promptVersion') >= ${opts.promptVersionMin}`
    : sql``;

  // Unnest the details.calibrationWarnings array, count per reason / component.
  const rows = await this.db.execute(sql`
    SELECT
      al.id AS audit_log_id,
      al.created_at,
      details->>'promptVersion' AS prompt_version,
      warning->>'componentName' AS component_name,
      warning->>'reason' AS reason
    FROM audit_logs al
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(details->'calibrationWarnings', '[]'::jsonb)
    ) AS warning
    WHERE al.action IN ('score.profile.computed', 'score.match.computed', 'score.match-preview.computed')
      AND al.created_at >= ${opts.from}
      AND al.created_at <= ${opts.to}
      ${promptVersionFilter}
    ORDER BY al.created_at DESC
    LIMIT 500
  `);

  type Row = {
    audit_log_id: string;
    created_at: Date;
    prompt_version: string;
    component_name: string;
    reason: string;
  };
  const typed = rows as unknown as Row[];

  const byReasonMap = new Map<string, number>();
  const byComponentMap = new Map<string, number>();
  for (const r of typed) {
    byReasonMap.set(r.reason, (byReasonMap.get(r.reason) ?? 0) + 1);
    byComponentMap.set(
      r.component_name,
      (byComponentMap.get(r.component_name) ?? 0) + 1,
    );
  }

  return {
    totalWarnings: typed.length,
    byReason: Array.from(byReasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    byComponent: Array.from(byComponentMap.entries())
      .map(([componentName, count]) => ({ componentName, count }))
      .sort((a, b) => b.count - a.count),
    recent: typed.slice(0, 25).map((r) => ({
      auditLogId: r.audit_log_id,
      componentName: r.component_name,
      reason: r.reason,
      promptVersion: r.prompt_version,
      createdAt: r.created_at.toISOString(),
    })),
  };
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: No errors. If `sql` from `drizzle-orm` is missing from imports, add it.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/admin/repositories/admin-bias-monitor.repository.ts
git commit -m "feat(admin): add calibration warnings aggregation query

Repository method for /admin/bias-monitor 'Scoring Quality' panel.
Aggregates audit_logs.details.calibrationWarnings over a date range
with optional prompt_version filter.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Backend — extend bundle DTO and service

**Goal:** Add `scoringQuality` block to the bias-monitor response and `promptVersionMin` to the query DTO.

**Files:**
- Modify: `apps/api/src/modules/admin/dto/bias-monitor-query.dto.ts`
- Modify: `apps/api/src/modules/admin/dto/bias-monitor-response.dto.ts`
- Modify: `apps/api/src/modules/admin/services/admin-bias-monitor.service.ts`

### Steps

- [ ] **Step 1: Update the query DTO**

Open `apps/api/src/modules/admin/dto/bias-monitor-query.dto.ts` and add an optional `promptVersionMin` field. The exact diff depends on the existing shape; pattern:

```ts
// In the Zod schema for the query:
promptVersionMin: z.string().optional(),
```

(Mirror whichever validation library / pattern the existing fields use.)

- [ ] **Step 2: Update the response DTO**

Open `apps/api/src/modules/admin/dto/bias-monitor-response.dto.ts` and add:

```ts
scoringQuality: z.object({
  totalWarnings: z.number().int(),
  byReason: z.array(z.object({
    reason: z.string(),
    count: z.number().int(),
  })),
  byComponent: z.array(z.object({
    componentName: z.string(),
    count: z.number().int(),
  })),
  recent: z.array(z.object({
    auditLogId: z.string().uuid(),
    componentName: z.string(),
    reason: z.string(),
    promptVersion: z.string(),
    createdAt: z.string(),
  })),
}),
```

- [ ] **Step 3: Wire into the service**

In `apps/api/src/modules/admin/services/admin-bias-monitor.service.ts`, find the bundle-builder method and add a call to the new repo method, then fold the result into the response. Pattern:

```ts
const scoringQuality = await this.repo.getCalibrationWarnings({
  from: query.dateFrom,
  to: query.dateTo,
  promptVersionMin: query.promptVersionMin ?? "1.2.0",
});

// existing return statement:
return {
  range: { from, to },
  kpis,
  // ...existing fields...
  scoringQuality,
};
```

The default `"1.2.0"` filters out pre-reconciliation legacy rows so the panel doesn't show meaningless zero-warning noise from old scoring runs.

- [ ] **Step 4: Type-check + lint**

Run: `pnpm --filter @aurahire/api tsc --noEmit && pnpm --filter @aurahire/api lint`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/admin/dto/bias-monitor-query.dto.ts apps/api/src/modules/admin/dto/bias-monitor-response.dto.ts apps/api/src/modules/admin/services/admin-bias-monitor.service.ts
git commit -m "feat(admin): plumb scoring quality into bias-monitor bundle

Adds optional promptVersionMin to the query (defaults to '1.2.0' to
filter out pre-reconciliation legacy rows). Adds scoringQuality block
to the response carrying totals + breakdowns + 25 most recent warnings.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Frontend — Scoring Quality panel + filter UI

**Goal:** Render the scoring-quality data in `/admin/bias-monitor`. Add a prompt-version filter alongside the existing date range filter.

**Files:**
- Modify: `apps/web/app/(admin)/admin/bias-monitor/page.tsx`
- Create: `apps/web/app/(admin)/admin/bias-monitor/_scoring-quality-panel.tsx`

### Steps

- [ ] **Step 1: Extend the `BundleBody` type in `page.tsx`**

Open `apps/web/app/(admin)/admin/bias-monitor/page.tsx` and add the `scoringQuality` shape to the `BundleBody.data` interface:

```ts
scoringQuality: {
  totalWarnings: number;
  byReason: Array<{ reason: string; count: number }>;
  byComponent: Array<{ componentName: string; count: number }>;
  recent: Array<{
    auditLogId: string;
    componentName: string;
    reason: string;
    promptVersion: string;
    createdAt: string;
  }>;
};
```

- [ ] **Step 2: Create the panel client component**

Create `apps/web/app/(admin)/admin/bias-monitor/_scoring-quality-panel.tsx`:

```tsx
"use client";

import { Sparkles } from "lucide-react";

const REASON_LABELS: Record<string, string> = {
  ceiling_with_thin_evidence: "Ceiling with thin evidence",
  deduction_without_negative_evidence: "Deduction without negative evidence",
};

const COMPONENT_LABELS: Record<string, string> = {
  completeness: "Completeness",
  skill_depth: "Skill Depth",
  experience_clarity: "Experience Clarity",
  education_quality: "Education Quality",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  cultural_fit: "Cultural Fit",
};

interface ScoringQualityProps {
  totalWarnings: number;
  byReason: Array<{ reason: string; count: number }>;
  byComponent: Array<{ componentName: string; count: number }>;
  recent: Array<{
    auditLogId: string;
    componentName: string;
    reason: string;
    promptVersion: string;
    createdAt: string;
  }>;
}

export function ScoringQualityPanel({
  totalWarnings,
  byReason,
  byComponent,
  recent,
}: ScoringQualityProps) {
  if (totalWarnings === 0) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <header className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Scoring Quality
          </h2>
        </header>
        <p className="text-sm text-[var(--color-body)]">
          No calibration warnings in this range. The model is honoring the
          v1.2.0 prompt rules (ceiling requires strong evidence; deductions
          require negative evidence).
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <header className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Scoring Quality
        </h2>
        <span className="ml-auto font-mono text-xs text-[var(--color-muted)]">
          {totalWarnings} warning{totalWarnings === 1 ? "" : "s"}
        </span>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            By reason
          </h3>
          <ul className="space-y-1 text-sm">
            {byReason.map((r) => (
              <li key={r.reason} className="flex justify-between">
                <span className="text-[var(--color-body)]">
                  {REASON_LABELS[r.reason] ?? r.reason}
                </span>
                <span className="font-mono text-[var(--color-ink)]">{r.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            By component
          </h3>
          <ul className="space-y-1 text-sm">
            {byComponent.map((c) => (
              <li key={c.componentName} className="flex justify-between">
                <span className="text-[var(--color-body)]">
                  {COMPONENT_LABELS[c.componentName] ?? c.componentName}
                </span>
                <span className="font-mono text-[var(--color-ink)]">{c.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Recent (latest {recent.length})
          </h3>
          <ul className="space-y-1 text-xs">
            {recent.map((r) => (
              <li
                key={r.auditLogId}
                className="flex flex-wrap items-baseline gap-x-3 text-[var(--color-body)]"
              >
                <span className="font-mono text-[var(--color-muted)]">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
                <span>
                  {COMPONENT_LABELS[r.componentName] ?? r.componentName}
                </span>
                <span className="text-[var(--color-muted)]">
                  · {REASON_LABELS[r.reason] ?? r.reason}
                </span>
                <span className="ml-auto font-mono text-[var(--color-muted)]">
                  v{r.promptVersion}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Render the panel in `page.tsx`**

In `apps/web/app/(admin)/admin/bias-monitor/page.tsx`, after the existing KPI / chart sections in the JSX, add:

```tsx
<ScoringQualityPanel
  totalWarnings={data.scoringQuality.totalWarnings}
  byReason={data.scoringQuality.byReason}
  byComponent={data.scoringQuality.byComponent}
  recent={data.scoringQuality.recent}
/>
```

And add the import at the top:

```ts
import { ScoringQualityPanel } from "./_scoring-quality-panel";
```

- [ ] **Step 4: Type-check + lint**

Run: `pnpm --filter @aurahire/web tsc --noEmit && pnpm --filter @aurahire/web lint`

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(admin)/admin/bias-monitor/page.tsx apps/web/app/(admin)/admin/bias-monitor/_scoring-quality-panel.tsx
git commit -m "feat(admin): scoring quality panel on /admin/bias-monitor

Renders calibrationWarnings aggregations (by reason, by component,
and the 25 most recent) below existing KPI section. Empty state
reads as confirmation the model is honoring v1.2.0 prompt rules.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Manual verification — **HUMAN STEP**

**Goal:** Confirm the Scoring Quality panel populates with real data after Phases 1-2 have shipped and produced v1.2.0 traffic.

**Files:** None modified.

### Steps

- [ ] **Step 1: Wait for v1.2.0 traffic**

Phase 1 + Phase 2 must be deployed. Either trigger a few test recomputes via the `Recompute` button on `/candidate/profile` and the on-view auto-compute on `/candidate/jobs/<id>`, or wait 24 hours of organic candidate traffic.

- [ ] **Step 2: Navigate to /admin/bias-monitor**

Open the admin bias-monitor page in a browser logged in as an admin.

- [ ] **Step 3: Confirm the Scoring Quality panel renders below the existing KPI section**

Check:
- The header reads "Scoring Quality" with a sparkle icon.
- If warnings exist, "By reason" and "By component" lists populate.
- The "Recent" list shows the latest warnings with timestamps and prompt versions (`v1.2.0`).
- If no warnings exist, the empty-state message reads "No calibration warnings in this range."

- [ ] **Step 4: Spot-check accuracy**

Pick one warning row in "Recent" and click through to the corresponding audit log entry (or query the DB directly). Confirm the `details.calibrationWarnings` array on that audit row contains a matching entry. This proves the aggregation query is reading correctly.

- [ ] **Step 5: Spot-check filter**

If the `promptVersionMin` query param is editable via UI (or test via URL `?promptVersionMin=2.0.0`), confirm the panel returns zero warnings (no v2.0.0 prompts exist yet). This proves the filter wires through.

If all checks pass, the implementation is complete.

---

## Done

After Task 15:

- All evidence chips reconcile to component scores; all component scores reconcile to the headline.
- Profile and match scores have parity in transparency.
- "Contributes" is gone from the UI.
- `/admin/bias-monitor` surfaces calibration warnings with prompt-version filtering for thesis defense screenshots.

The thesis claim — "every point traces to a quoted excerpt" — is now technically accurate end-to-end.
