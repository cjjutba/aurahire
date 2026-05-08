# Explainable Scoring Overhaul — Strict-Sum Reconciliation, 5-Point Quantization, Honest Copy

**Date:** 2026-05-08
**Owner:** Scoring engines (profile + match), thesis "Explainable AI" pillar
**Status:** approved (design)

## Problem

The thesis angle is *"Explainable and Fair AI-Powered Recruitment: A Transparent Resume Scoring Platform with Bias Mitigation."* Two scoring engines deliver this promise: profile scoring and match scoring. Today neither delivers the transparency the thesis claims.

### Concrete defects observed in production-mode dev

**Profile score breakdown (`/candidate/profile`, score 85/100):**

- `Completeness 25/25`, `Experience Clarity 30/30` — both at ceiling, contradicting the prompt's own anchor at `apps/api/src/ai/prompts/score-profile.ts:18`: *"A complete-but-generic resume should top out around 75–85% of the component weight, NOT the ceiling."*
- `Skill Depth 25/30` — explanation text says *"lacks evidence of mastery for some skills, could benefit from more modern technologies"*, yet **all three evidence rows are marked HELPED**. The −5 deduction is invisible at the evidence layer.
- `Education Quality 5/15` — only the education component shows a HURT row. Asymmetric vs. how the other components surface their deductions (i.e. they don't).
- **Profile evidence schema has no `contribution_points` at all.** The candidate sees only a binary HELPED / HURT chip with no quantified justification.

**Match preview breakdown (`/candidate/jobs/<id>`, score 75/100, screenshots dated 2026-05-08 15:30):**

- `Skills 30/40`. Evidence rows: TypeScript +10, PostgreSQL +10, Go −10, Distributed Systems −10. **Sum = 0. Component score = 30. The math does not reconcile.**
- `Experience 25/35`. Evidence rows: 8+ vs. 6+ years gap −10, leadership +10, "6+ years TS/Node platforms" +10. **Sum = +10. Component score = 25. Does not reconcile.**
- `Cultural Fit 5/10`. Evidence: −5 architectural decisions gap, +5 mentorship strength. **Sum = 0. Component score = 5. Does not reconcile.**
- `Education 15/15`. Evidence: BS in CS +15. **Sum = 15. Score = 15. Reconciles.**

The match prompt at `apps/api/src/ai/prompts/score-match.ts:38` says contribution points should sum *"approximately"* to (score − max). The engine never enforces it. The result: visible point chips that look authoritative but are arithmetically incoherent.

**Copy defect:**

The evidence callout footer reads `"Contributes -10 points"` for negative contributions. *Contributing* means adding to a total — using it for deductions is semantically wrong. A negative number being introduced by the verb "contributes" reads as a typo or as system confusion to anyone scanning quickly.

### Why this matters for the thesis

A thesis defended on "explainable scoring" must survive the question: *"Why is this candidate's score 75 and not 80?"* The current system answers with hand-waving — the components reconcile to the headline (engine-enforced), but the evidence does not reconcile to the components. A reviewer who adds the visible numbers and gets a different total has just disproved the explainability claim.

## Goal

Make every point on every score traceable to a quoted excerpt. Specifically:

1. **Strict sum reconciliation.** `component.score = clamp(sum(contribution_points), 0, max)`, engine-enforced. The model's own `score` field becomes advisory; only the sum-of-contributions ships to clients.
2. **5-point quantization.** All `contribution_points` are multiples of 5 (`..., −15, −10, −5, 0, +5, +10, +15, ...`). Component scores naturally land on the 5-grid by construction. No arbitrary integers; no false precision.
3. **Profile evidence carries `contribution_points` for the first time.** Profile transparency reaches parity with match transparency.
4. **Honest copy.** Drop the "Contributes" verb everywhere; render `+N points` and `−N points` directly with semantic color, leaning on the existing HELPED / HURT chip for direction.
5. **Calibration safeguard.** When a component is at its ceiling, the prompt requires at least two positive evidence items, with at least one citing quantified outcomes OR senior-level scope; otherwise the engine logs a calibration warning surfaced in `/admin/bias-monitor`. The engine warning itself is a cheap heuristic ("ceiling with fewer than two positives"); the prompt rule is the deeper guardrail.

The result: anyone reading a score breakdown can add the visible numbers and arrive at the displayed component score, every time.

## Non-goals

- **Recalibrating component weights.** Default weights (`packages/shared/src/constants/score-thresholds.ts`) stay at `skills 40 / experience 35 / education 15 / cultural_fit 10` for match and `completeness 25 / skill_depth 30 / experience_clarity 30 / education_quality 15` for profile. Admin can still tune per-tenant via `/admin/ai-config`.
- **Changing band thresholds.** Strong ≥ 70, Partial ≥ 40, Limited < 40 (multiples of 10, already on the 5-grid).
- **Adding new scoring components** (e.g. portfolio depth, GitHub signal). Separate work.
- **Backfilling historical scores under the new prompt version.** Existing rows render as-is. Manual recompute via the `Recompute` button is opt-in.
- **Replacing `gpt-4o-mini`.** Same model, tighter prompt + engine reconciliation.
- **Modifying PII redaction, bias detection, or audit log infrastructure.** Existing pipelines preserved.

## Scope

**In scope:**

- `packages/shared/src/schemas/score.ts` — schema changes (rename `matchEvidenceSchema` → `scoredEvidenceSchema`, add `multipleOf(5)` refinement, switch profile component evidence to use it).
- `apps/api/src/ai/prompts/score-profile.ts` — bump to `1.2.0`, add contribution_points instruction block, tighten anchor.
- `apps/api/src/ai/prompts/score-match.ts` — bump to `1.2.0`, replace "approximately" with strict equality, add quantization rule.
- `apps/api/src/modules/scoring/scoring.service.ts` — add `reconcileEvidenceContributions` helper, call from `computeProfileScore`, `computeMatchScore`, `computeMatchPreview`. Emit residuals to audit.
- `apps/web/components/score/evidence-callout.tsx` — replace "Contributes ±N points" footer with a signed-integer chip rendered in score-band color.
- 5 consumer pages already pipe `contributionPoints` through `EvidenceCallout`; no signature changes required there.
- One new consumer: profile-score detail page must start passing `contributionPoints` from the new schema field.
- `apps/api/src/modules/scoring/scoring.repository.ts` — extend `insertProfileScore` / `insertMatchScore` calls so the new audit fields (`evidenceQuantizationResiduals`, `scoreResiduals`, `calibrationWarnings`) flow into the existing `details` jsonb on `audit_logs`.
- Unit tests for `reconcileEvidenceContributions` in `apps/api/src/modules/scoring/scoring.service.spec.ts`.

**Out of scope:**

- DB migration. The new audit fields ride inside existing `jsonb` columns (`audit_logs.details`, `profile_scores.raw_output`, `match_scores.raw_output`); no schema change.
- Backfill job for old scores. The bias-monitor admin page can filter to "post-v1.2.0 only" via `prompt_version` for thesis defense screenshots.
- Recruiter / admin score views beyond the existing `EvidenceCallout` consumers.
- Translating evidence excerpts to plain English on hover. (Future work; orthogonal.)
- Changing the Score Ring or Breakdown Bar visual. The numeric chips next to evidence are the only UI delta.

## Design

### Data flow (after this change)

```
score-profile.service / score-match.service
  └── OpenAI structured output (gpt-4o-mini)
       evidence: [
         { excerpt, source, relevance, contribution_points }, ...
       ]
       components: [{ name, score, max, weight, explanation, evidence }, ...]
       overall_score, band, ...
        │
        ▼
scoring.service.ts
  ├── normalizeComponentsToWeights(...)        ← existing: clamps score to [0, configured max]
  ├── reconcileEvidenceContributions(...)      ← NEW: per-component
  │     ├── quantize each evidence.contribution_points to nearest *5
  │     ├── reset evidence.relevance from sign
  │     ├── derived = clamp(sum(contributions), 0, component.max)
  │     ├── overwrite component.score with derived
  │     └── return { component, residual: ai_score - derived, quantizationDeltas[] }
  ├── deriveOverallScore(...)                  ← existing: sum components → 0..100
  ├── deriveBand(...)                          ← existing: thresholds → strong/partial/limited
  ├── detectCalibrationWarnings(...)           ← NEW: flag at-ceiling components without strong positive evidence
  ├── insertProfileScore / insertMatchScore     ← residuals + warnings folded into raw_output
  └── audit.log({ details: { ..., score_residuals, evidence_quantization_residuals, calibration_warnings } })
```

The AI's `overall_score` field continues to be discarded server-side; the engine recomputes from the (now-reconciled) component scores. New: the AI's per-component `score` field is also discarded — `derived_score` from contributions wins.

### Schema changes — `packages/shared/src/schemas/score.ts`

```ts
// Before:
//   evidenceSchema       — used by profile components
//   matchEvidenceSchema  — extends evidenceSchema with contribution_points
// After:
//   evidenceSchema       — base (unchanged shape; kept for any non-scoring evidence)
//   scoredEvidenceSchema — extends with contribution_points; used by BOTH profile and match components

export const scoredEvidenceSchema = evidenceSchema.extend({
  contribution_points: z
    .number()
    .int()
    .multipleOf(5),  // NEW: enforce 5-point quantization at the schema layer
});

// matchEvidenceSchema becomes a deprecated alias for one PR cycle, then removed.
export const matchEvidenceSchema = scoredEvidenceSchema; // transitional

// profileComponentSchema.evidence now uses scoredEvidenceSchema
export const profileComponentSchema = z.object({
  name: z.enum(["completeness", "skill_depth", "experience_clarity", "education_quality"]),
  score: z.number().int().min(0).multipleOf(5),  // NEW: quantized
  max: z.number().int().multipleOf(5),
  weight: z.number().int().multipleOf(5),
  explanation: z.string(),
  evidence: z.array(scoredEvidenceSchema),         // CHANGED from evidenceSchema
});

// matchComponentSchema.evidence already uses scoredEvidenceSchema (via the renamed alias)
// matchComponentSchema.score also gets multipleOf(5)
```

The `multipleOf(5)` refinement on `score` is defensive — the engine guarantees it via reconciliation, but the schema layer rejects malformed payloads early.

### Engine helper — `reconcileEvidenceContributions`

New pure function in `apps/api/src/modules/scoring/scoring.service.ts`, called from `computeProfileScore`, `computeMatchScore`, and `computeMatchPreview` immediately after `normalizeComponentsToWeights`.

```ts
interface ReconciliationResult<C> {
  component: C;
  residual: number;                               // ai_score - derived_score
  quantizationDeltas: Array<{                     // per-evidence rounding adjustments
    evidenceIndex: number;
    original: number;
    quantized: number;
  }>;
}

function reconcileEvidenceContributions<
  C extends {
    name: string;
    score: number;
    max: number;
    evidence: Array<{ contribution_points: number; relevance: "positive" | "negative" | "neutral" }>;
  },
>(component: C): ReconciliationResult<C> {
  const aiScore = component.score;
  const quantizationDeltas: ReconciliationResult<C>["quantizationDeltas"] = [];

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

Properties:

- **Pure / deterministic.** No I/O, no side effects. Trivially unit-testable.
- **Defensive quantization.** Even if the schema layer somehow lets a non-multiple-of-5 through (edge cases on Zod refinements with `int()`), this rounds it.
- **Authoritative `derived` score.** The AI's `score` is discarded; the engine's sum wins.
- **Relevance is computed from sign, not trusted from the model.** This kills the "Skill Depth showed all HELPED but actually deducted 5 points" defect in one stroke — if a contribution is negative, the relevance is forced to negative.
- **Clamps to `[0, max]`.** A model that hallucinates `+50 −80 = −30` for a component max 30 produces `0`, not a negative score.

### Calibration safeguard — `detectCalibrationWarnings`

New helper, also called from each compute path:

```ts
function detectCalibrationWarnings<C extends {
  name: string;
  score: number;
  max: number;
  evidence: Array<{
    contribution_points: number;
    relevance: "positive" | "negative" | "neutral";
    excerpt: string;
  }>;
}>(component: C): Array<{ componentName: string; reason: string }> {
  const warnings: Array<{ componentName: string; reason: string }> = [];

  // Component at ceiling but no negative evidence — model didn't surface what the candidate would need
  // to BEAT this score (the prompt's "complete-but-generic should top at 75-85%" anchor was ignored).
  if (component.score === component.max) {
    const positives = component.evidence.filter((e) => e.relevance === "positive");
    if (positives.length < 2) {
      warnings.push({
        componentName: component.name,
        reason: "ceiling_with_thin_evidence",
      });
    }
  }

  // Component below ceiling but no negative evidence — the deduction has no visible justification.
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

Warnings are advisory. They do **not** auto-adjust the score. They are written to the audit row's `details.calibration_warnings` array and surfaced in `/admin/bias-monitor` as a "scoring quality" lane (separate from the existing JD-bias lane). This gives admins visibility into model misbehavior without retroactively rewriting candidate scores.

### Prompt updates — `score-profile.ts` v1.2.0

Diff against current v1.1.0:

```
const SCORE_PROFILE_VERSION = "1.2.0";   // bump

system prompt CHANGES:

(after the existing "For each component" block, add:)

5. For each evidence item, assign contribution_points: a SIGNED integer that is a MULTIPLE OF 5.
   - Positive (helped earn points): +5, +10, +15, ...
   - Negative (a gap that cost points): -5, -10, -15, ...
   - Zero (purely neutral context, no point impact)
   The engine derives component.score from the SUM of contribution_points, clamped to [0, max].
   Be honest: choose contribution_points so that their sum truly reflects the component score you intend.

(after the existing "Reserve the FULL weight only..." paragraph, add:)

6. CALIBRATION RULE — If you score a component at its ceiling (full weight),
   you MUST cite at least TWO positive evidence items, AND at least one of them
   must reference quantified outcomes (numbers, percentages, dollar figures) OR
   senior-level scope (leadership, ownership, architectural decisions).
   Otherwise, cap the component at 85% of max and surface the gap as a negative
   evidence item.

(replace the existing 75-85% paragraph with the harder rule above.)

7. EVIDENCE BALANCE — For every component where score < max, you MUST include
   at least one evidence item with relevance="negative" and contribution_points<0
   that explains the deduction. No exceptions.
```

The user prompt builder is unchanged — weights and the redacted resume still flow through.

### Prompt updates — `score-match.ts` v1.2.0

Diff against current v1.1.0:

```
const SCORE_MATCH_VERSION = "1.2.0";   // bump

system prompt CHANGES:

- contribution_points instruction (item 3 in the existing block) tightens:
    BEFORE: "contribution_points: integer. Positive when the quote helped (+N).
             Negative when it represents a gap (-N). 0 only for purely neutral context."
    AFTER:  "contribution_points: signed integer that is a MULTIPLE OF 5
             (..., -15, -10, -5, 0, +5, +10, +15, ...). Positive when the quote
             helped (+N). Negative when it represents a gap (-N). 0 only for
             purely neutral context. The engine derives component.score from the
             sum, clamped to [0, max]; pick numbers honestly."

- EVIDENCE BALANCE block (currently says "approximately"):
    BEFORE: "The negative items' contribution_points should sum approximately
             to (score - max)."
    AFTER:  "The sum of all evidence contribution_points (positive + negative)
             must equal component.score exactly. If you score a component at
             25/40, the contributions must sum to 25. The engine recomputes
             score from the sum, so any mismatch will be silently overwritten —
             match them yourself for narrative coherence."

- Add the same calibration rule as profile (ceiling requires quantified outcomes
  OR senior-level scope; otherwise cap at 85%).
```

### UI copy fix — `evidence-callout.tsx`

Current footer (lines 65–70):

```tsx
{typeof contributionPoints === "number" && contributionPoints !== 0 && (
  <p className="mt-3 text-xs text-[var(--color-muted)]">
    Contributes {contributionPoints > 0 ? "+" : ""}
    <span className="font-mono">{contributionPoints}</span> points
  </p>
)}
```

New footer:

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

Changes:

- Drop "Contributes" verb — semantically wrong for negatives, redundant with the HELPED / HURT chip in the header.
- Use Unicode minus (`−`, U+2212), not ASCII hyphen — typographically correct on retina + matches existing `−5 pts to perfect` copy used elsewhere on the page.
- Color the chip per relevance (`var(--color-score-high)` for positive, `var(--color-score-low)` for negative) instead of always-muted gray. The number itself becomes a glanceable signal.
- `font-mono font-semibold` — matches the design system's number-display token (`{typography.number-display}`).

The `EvidenceCallout` consumers (`_match-preview-client.tsx`, `_application-detail-client.tsx`, `apply-match-summary.tsx`, `score-dashboard.tsx`, `_application-detail-sheet-client.tsx`) all already pass `contributionPoints` through from the AI output. Once profile components carry `contribution_points`, the profile detail page (`apps/web/app/(candidate)/candidate/_components/profile-score-card-client.tsx` and its detail child page) starts passing it too — no behavioral change in any consumer beyond piping the new field.

### Audit / observability

The new fields ride entirely inside existing jsonb columns. Per scoring run, the `audit_logs.details` row gains:

```ts
{
  // ...existing fields (reason, overallScore, band, model, promptVersion, etc.)...
  score_residuals: [
    { component_name: "skills", ai_score: 30, derived_score: 0 },        // NEW
    { component_name: "experience", ai_score: 25, derived_score: 10 },    // NEW
  ],
  evidence_quantization_residuals: [                                       // NEW
    { component_name: "experience", evidence_index: 1, original: 7, quantized: 5 },
  ],
  calibration_warnings: [                                                  // NEW
    { component_name: "completeness", reason: "ceiling_with_thin_evidence" },
  ],
}
```

`/admin/bias-monitor` gains a new "Scoring quality" panel that aggregates `calibration_warnings` over a rolling 7-day window, with the ability to filter to `prompt_version >= 1.2.0`. Implementation of this panel is in scope for Phase 3.

### Backwards compatibility

- **Schema:** `contribution_points` is added to profile evidence as a required field on new payloads (`gpt-4o-mini` will produce it because the prompt requires it). The DB layer is jsonb on both `profile_scores.components` and `match_scores.components` — no migration. Old rows continue to validate against the legacy reader because the frontend already treats `contributionPoints` as optional (`evidence-callout.tsx:9`).
- **UI:** When an old row is rendered, no `contribution_points` is present, so `evidence-callout.tsx` renders no footer chip — same as today. No regression.
- **Recompute path:** The `Recompute` button on `/candidate/profile` and the on-view recompute on `/candidate/jobs/[id]` produce v1.2.0 rows. Candidates who hit Recompute see the new chips immediately; candidates who don't, see the legacy view until they recompute.
- **Bias monitor filter:** Add a `prompt_version` filter to `/admin/bias-monitor` so screenshots for thesis defense pull post-v1.2.0 only.

### Phasing

One spec, three ordered phases for the implementation plan:

**Phase 1 — Backend**

1. Update `score.ts` schemas (rename, `multipleOf(5)`, profile evidence gets `contribution_points`).
2. Add `reconcileEvidenceContributions` and `detectCalibrationWarnings` helpers in `scoring.service.ts`.
3. Bump prompt versions to `1.2.0` and rewrite the affected sections.
4. Wire reconciliation + warnings into `computeProfileScore`, `computeMatchScore`, `computeMatchPreview`.
5. Extend audit `details` payloads.
6. Unit tests for the new helpers (math reconciles for synthetic mismatches, quantization rounds correctly, ceiling-with-thin-evidence flags correctly, deduction-without-negative-evidence flags correctly).

Backend is testable in isolation. Existing scoring service spec file (`scoring.service.spec.ts`) is the home for new tests.

**Phase 2 — Frontend**

1. Update `evidence-callout.tsx` footer (drop verb, color chip, Unicode minus).
2. Verify the 5 existing consumers still pass `contributionPoints` through correctly (no signature change, but verify no consumer was passing a hardcoded `0` or `null`).
3. Update profile-score detail page consumer to pipe `contribution_points` from the new schema field.
4. Manual UI verification: profile breakdown shows ±N chips; match preview breakdown sums to component score visibly.

**Phase 3 — Calibration surface + bias monitor**

1. Add the "Scoring quality" panel to `/admin/bias-monitor`.
2. Add a `prompt_version` filter (defaults to `>=1.2.0`).
3. Aggregation query reads from `audit_logs.details.calibration_warnings`.

Phase 3 depends on Phases 1–2 having produced enough v1.2.0 rows to populate the panel meaningfully. Order: 1 → 2 → (deploy, recompute a handful of seed candidates) → 3.

### Prompt-version bump approval gate

Per `CLAUDE.md` § "When to ask vs proceed":

> Anything that touches `scoring_config` defaults — Ask first.
> Changing the AI prompts (versions matter — bumping a prompt is a thesis-defensible event, not a casual edit) — Ask first.

Both prompts bump from `1.1.0` to `1.2.0`. The implementation plan's prompt-edit step requires explicit human approval before the PR moves to merge. Plan tasks for prompt edits ship with diffs in the description so the human can scan them in one read.

## Testing

### Unit tests (Phase 1)

In `apps/api/src/modules/scoring/scoring.service.spec.ts`, add a new `describe("reconcileEvidenceContributions")` block:

- **Sum reconciles when AI got it right.** AI returns `score=25, evidence=[+10, +10, +5]`. Expect `derived=25, residual=0, quantizationDeltas=[]`.
- **Sum overrides AI score when they disagree.** AI returns `score=30, evidence=[+10, +10, +5]`. Expect `derived=25, residual=5`.
- **Quantizes non-multiples of 5.** AI returns `evidence=[+7, +8]`. Expect quantized to `[+5, +10]`, `quantizationDeltas` length 2.
- **Clamps below zero.** AI returns `score=10, evidence=[-15, -15]`. Expect `derived=0, residual=10`.
- **Clamps above max.** AI returns `score=20, max=15, evidence=[+10, +10]`. Expect `derived=15, residual=5`.
- **Relevance forced from sign.** AI returns evidence `{ contribution_points: -10, relevance: "positive" }` (model lied). Expect output `relevance: "negative"`.

In the same spec, add a `describe("detectCalibrationWarnings")` block:

- **Ceiling with one positive evidence flags.** Component at max with one positive item → `ceiling_with_thin_evidence`.
- **Ceiling with two positives does not flag.** Component at max with two positive items → no warning. (The helper checks count only; semantic quantified-vs-not detection lives in the prompt rule, not the engine.)
- **Below-max with no negative evidence flags.** Component at 25/30 with all-positive evidence → `deduction_without_negative_evidence`.
- **Below-max with negative evidence does not flag.** 25/30 with one −5 negative item → no warning.

### Integration smoke (Phase 2)

The human runs `pnpm dev`, opens `/candidate/profile`, clicks Recompute, and verifies:

1. Each evidence row in the breakdown shows a `+N points` or `−N points` chip in the appropriate score-band color.
2. Summing the visible chips per component equals the displayed component score (e.g. Skill Depth 25/30 ⇒ visible chips sum to +25).
3. Summing the component scores equals the headline (e.g. 25 + 25 + 25 + 10 = 85).
4. No "Contributes" copy anywhere on the page.

Repeat for `/candidate/jobs/<id>` (match preview) and `/recruiter/applications/<id>` (full match score).

### Calibration regression check (Phase 3)

After 24 hours of `1.2.0` traffic, the human pulls `/admin/bias-monitor` and confirms:

- The "Scoring quality" panel populates with at least one warning row (proves the detection logic fires).
- Filtering to `prompt_version >= 1.2.0` removes legacy noise.
- A spot-check of three flagged scores manually verifies the warning was correct (i.e. the model genuinely scored at ceiling without strong evidence).

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| `gpt-4o-mini` fails to honor strict-sum after prompt update | Engine reconciles regardless; AI's `score` field is silently overwritten. Audit `score_residuals` surfaces the gap so we can iterate on the prompt without breaking users. |
| Model produces fewer or no negative evidence items, causing components below ceiling to look unjustified | Prompt v1.2.0 makes negative evidence required when score < max. `detectCalibrationWarnings` flags violations. Engine does NOT inject synthetic negative items — that would be dishonest; the warning surfaces the case for human review. |
| Quantization loses signal for fine-grained scoring | Acceptable; 5-point granularity matches the user's stated requirement and the band-threshold grid (70 / 40). False precision was the larger problem. |
| Existing recruiter / admin views render legacy rows differently from new rows | Both render correctly because `contributionPoints` was already optional in the props. Visual difference (chips present vs. absent) is desirable — it signals which scores were computed under the new transparent regime. |
| Frontend caching serves stale `evidence-callout` markup | Vercel deploy invalidates the bundle; no client-side persistence of the component HTML. Non-issue. |
| Cache (`ai:score-profile:<hash>` / `ai:score-match:<hash>`) returns pre-v1.2.0 outputs after deploy | The hash includes `promptVersion`. Bumping to `1.2.0` invalidates all old keys naturally. No manual flush needed. |

## Open questions

None at design time. All design decisions resolved in the brainstorming session preceding this doc.

## Glossary

- **Strict sum reconciliation** — Architectural choice where the engine derives `component.score` from `sum(evidence.contribution_points)` rather than trusting the AI's `score` field.
- **5-point quantization** — Constraint that all `contribution_points` are integer multiples of 5; component scores inherit the property by construction.
- **Calibration warning** — Advisory audit signal emitted when a component's score / evidence pattern matches a known model misbehavior (ceiling without strong evidence, deduction without negative evidence).
- **Score residual** — `ai_score − derived_score` for a component. Logged for audit; never user-visible. A nonzero residual means the model's intended score disagreed with its own contribution sums.
- **Evidence quantization residual** — Per-evidence delta when an AI-returned `contribution_points` was rounded to the nearest 5. Logged for audit.
