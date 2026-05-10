# Symmetric Evidence Reasoning — Every Credit *and* Every Deduction Shows Its Work

**Date:** 2026-05-10
**Owner:** Scoring engines (profile + match), thesis "Explainable AI" pillar
**Status:** approved (design)

## Problem

The 2026-05-08 explainable-scoring overhaul landed: engine reconciliation, 5-point quantization, ±N chips, and `detectCalibrationWarnings`. But a downstream failure mode is still visible to candidates — confirmed by screenshots from `/candidate/jobs/<id>` on 2026-05-10:

For a `Skills 20/40` (deficit −20) component, `gpt-4o-mini` produced:

| # | excerpt | source | relevance | contribution_points |
|---|---|---|---|---|
| 1 | "TypeScript" | skills | positive | +10 |
| 2 | "Kubernetes" | skills | positive | +10 |
| 3 | "Go, Backstage, Bazel" | Job requirement › Required Skills | **neutral** | **0** |
| 4 | "JavaScript, React, Node.js, AWS, Docker" | skills | **neutral** | **0** |

Engine math reconciles (`+10 + +10 + 0 + 0 = 20 = derived score`). The component-level explanation correctly cites the gap ("lacks experience with Go, Backstage, and Bazel"). But the **−20 deficit has no per-row accounting**: rows 3–4 quote the gap subject without taking the deduction. The candidate sees two "HELPED +10" rows and two "NEUTRAL" rows, and is left to infer where the missing 20 went.

Two compounding defects:

1. **The AI deducts by *under-filling* positives.** Instead of `+10 +10 −10 −10 = 0` (clamped to component score 20 by the spec's required positives) or any balanced enumeration, the model picks two positives at +10 and uses neutrals to *describe* the gaps without taking them. The prompt's "EVIDENCE BALANCE — REQUIRED" rule (`apps/api/src/ai/prompts/score-match.ts:36–40`) is not consistently honored.
2. **Per-row reasoning does not exist.** The current evidence schema is `{ excerpt, source, relevance, contribution_points }`. There is no field where the model says *why* this row helped or hurt. The component-level `explanation` summarizes all gaps in one paragraph, but individual rows can't independently answer "why?". Even when the model emits a correctly-tagged negative row, the candidate sees only a quote, a source, a HURT chip, and a `−N points` chip — no sentence-level justification.

A side defect uncovered while diagnosing this: the profile DTO drops `contribution_points` entirely on the API boundary. `apps/api/src/modules/scoring/scoring.service.ts:541–562` maps `c.evidence` into `ScoreEvidenceDto` *without* the field, and `apps/api/src/modules/scoring/dto/profile-score-response.dto.ts:3–7` defines `ScoreEvidenceDto` with only `excerpt / source / relevance`. The 2026-05-08 spec phase 2 task ("update profile-score detail page consumer to pipe `contribution_points`") never reached the DTO. Profile evidence rows render with no ±N chip at all today.

### Why this matters for the thesis

The thesis defends *"Explainable and Fair AI-Powered Recruitment: A Transparent Resume Scoring Platform with Bias Mitigation."* A reviewer asking "why did this candidate score 65 not 85?" must be able to point at evidence rows and read both the quoted excerpt and a sentence-level reason for every helping AND every hurting contribution. Today the system delivers credits transparently and deductions opaquely — asymmetric explainability is incomplete explainability.

## Goal

Every evidence row in profile + match scoring answers three questions independently of any other row:

1. **What is the evidence?** (`excerpt` + `source`) — already there.
2. **Did it help or hurt, and by how much?** (relevance chip + `±N points`) — already there for match, missing on profile DTO.
3. **Why did it help or hurt?** (`reasoning` — one sentence) — *new*.

Plus: gap items always render as `negative` with negative `contribution_points` — never `neutral` — so the candidate's mental sum reconciles to the component score whether reading positives only, negatives only, or both.

## Non-goals

- Recalibrating component weights. Defaults stay at `skills 40 / experience 35 / education 15 / cultural_fit 10` (match) and `completeness 25 / skill_depth 30 / experience_clarity 30 / education_quality 15` (profile).
- Changing band thresholds (strong ≥ 70, partial ≥ 40, limited < 40).
- Replacing `gpt-4o-mini`. Same model, tighter prompt + new schema field.
- Engine-side synthesis of evidence rows. The engine never invents a `negative` row from a `neutral` row; that would put the engine's words in the AI's mouth and erode the thesis claim. If the AI fails the balance rule, `detectCalibrationWarnings` already logs `deduction_without_negative_evidence` to audit; this spec adds a candidate-facing inline notice ("This breakdown may be incomplete — Recompute to refresh") so a noncompliant output is recoverable without faking the data.
- Backfilling pre-v1.3.0 / v1.4.0 rows. Old rows render with no `reasoning` sentence — graceful degradation. Recompute regenerates with the new shape.
- Modifying PII redaction, bias detection, or audit-log infrastructure.
- Translating reasoning into multiple languages.

## Scope

**In scope:**

1. `packages/shared/src/schemas/score.ts` — add `reasoning` (required, 10–280 chars) to `scoredEvidenceSchema`.
2. `apps/api/src/ai/prompts/score-profile.ts` — bump `1.3.0` → `1.4.0`. Add `reasoning` to the per-evidence field list with worked examples; tighten gap rule to forbid `neutral` for evidence that quotes a missing-from-resume requirement; mandate balanced math when score < max.
3. `apps/api/src/ai/prompts/score-match.ts` — bump `1.2.0` → `1.3.0`. Same prompt updates as profile, adapted to the match domain (job-requirement excerpts).
4. `apps/api/src/modules/scoring/dto/profile-score-response.dto.ts` — add `contributionPoints?: number | null` (the missing 2026-05-08 wiring) AND `reasoning?: string | null` to `ScoreEvidenceDto`.
5. `apps/api/src/modules/applications/dto/application-response.dto.ts` — add `reasoning?: string | null` to `MatchEvidenceDto`.
6. `apps/api/src/modules/scoring/dto/match-preview-response.dto.ts` — add `reasoning?: string | null` to its evidence DTO (mirror of `MatchEvidenceDto`).
7. `apps/api/src/modules/scoring/scoring.service.ts` — DTO mappers (`toDto`, `matchScoreToDto`, `matchPreviewRowToDto`, `getMatchScoreByApplicationId`, `fromDbRow`) pipe `contribution_points` (profile only — already piped on match) and `reasoning` through the API boundary. Add `calibrationWarnings: CalibrationWarning[]` to the response DTOs so the candidate UI can surface them.
8. `apps/api/src/modules/scoring/scoring.repository.ts` — extend the evidence-row insert helpers with `reasoning` (rides on existing `evidence` jsonb columns inside `components`; no migration).
9. `apps/web/components/score/evidence-callout.tsx` — accept `reasoning?: string | null` prop, render between excerpt and points chip.
10. Match consumer wiring — `_match-preview-client.tsx`, `apply-match-summary.tsx`, `score-dashboard.tsx`, `_application-detail-sheet-client.tsx`, `_application-detail-client.tsx` — pass `reasoning` (and where applicable, surface the calibration-warning notice).
11. Profile consumer wiring — `apps/web/app/(candidate)/candidate/profile/_components/profile-score-card-client.tsx` (and detail subpage) — pass `contribution_points` AND `reasoning` from the now-complete profile DTO.
12. Unit tests in `scoring.service.spec.ts` — DTO round-trip for `reasoning`; new calibration-warning case asserting fire when `score < max` with all-`neutral` evidence (the exact failure mode in the screenshot).

**Out of scope:**

- DB migration. All changes ride existing jsonb columns (`profile_scores.components`, `match_scores.components`, `match_score_previews.components`).
- Recruiter / admin score-view redesigns beyond pipe-through of the new fields.
- Translating evidence to plain English on hover (orthogonal future work).
- Score Ring / Breakdown Bar visual changes — only `EvidenceCallout` itself is modified.

## Design

### Schema change — `packages/shared/src/schemas/score.ts`

```ts
export const scoredEvidenceSchema = evidenceSchema.extend({
  contribution_points: z.number().int().multipleOf(5),
  reasoning: z.string().min(10).max(280), // NEW: per-row "why" sentence
});
```

Both `profileComponentSchema.evidence` and `matchComponentSchema.evidence` reference `scoredEvidenceSchema`, so they pick up the field automatically. The `min(10)` floor rejects degenerate one-word reasonings (e.g. `"Helped"`); the `max(280)` ceiling keeps rows scannable in the existing card layout (~one tweet's worth).

### Prompt updates — `score-profile.ts` v1.4.0 and `score-match.ts` v1.3.0

Both prompts add the same two changes (adapted per domain):

**1. New per-evidence field — `reasoning`:**

```
- reasoning: ONE sentence (10–280 chars) explaining WHY this row contributes the
  score it does. Be specific to the candidate; not a paraphrase of the chip.
  Examples:
    Positive: "Multi-year TypeScript experience cited in two roles matches the
              role's primary stack."
    Negative: "Resume does not mention Go, Backstage, or Bazel — three of the
              role's core required skills."
```

**2. Tightened gap rule — forbid `neutral` for gap items:**

```
EVIDENCE BALANCE — REQUIRED:
- The sum of all contribution_points (positive + negative) MUST equal
  component.score exactly. (Carried over from v1.2.0/v1.3.0; the engine
  recomputes from the sum and clamps to [0, max], so any mismatch is
  silently overwritten — match them yourself for narrative coherence.)
- For every component where score < max, you MUST include at least one
  evidence item with relevance="negative" and contribution_points<0 that
  names the gap. NEW: the gap MUST be a `negative` row, never a `neutral`
  row that merely cites the requirement.
- Evidence whose excerpt or source describes a job requirement, expected
  credential, or expected resume section the candidate does NOT satisfy
  MUST use relevance="negative" with contribution_points<0. Never `neutral`.
- `neutral` is reserved for genuinely contextual snippets that neither help
  nor hurt (e.g. a tenure note that anchors the reader but doesn't move the
  score). Use sparingly; default to either positive or negative.
```

The math constraint itself is unchanged from v1.2.0 — what changes is *enforcement*. Today the model satisfies the math by emitting `+10 +10 +0 +0 = 20` (two positives, two neutrals quoting the gap). Under v1.3.0/v1.4.0 the neutrals-quoting-gap path is forbidden, so a 20/40 score must surface as e.g. `+10 +10 +5 −5` or `+15 +15 −10` or any combination where the deduction is itself a `negative` row with a `reasoning` sentence.

Both prompts add a worked example block in the system prompt showing one positive and one negative row with `reasoning`, so the model has a concrete template.

Per `CLAUDE.md` § "When to ask vs proceed" — prompt-version bumps require user approval. **The user authorized this bump in the 2026-05-10 brainstorming session preceding this spec.** Diffs ride in the implementation plan for sign-off at PR time.

### DTO + mapper updates — `apps/api/src/modules/scoring/`

`ScoreEvidenceDto` (profile-side) gains the two fields the prior overhaul missed plus `reasoning`:

```ts
export class ScoreEvidenceDto {
  @ApiProperty() excerpt!: string;
  @ApiProperty() source!: string;
  @ApiProperty({ enum: ["positive", "negative", "neutral"] }) relevance!: string;
  @ApiPropertyOptional({ nullable: true, type: Number })
  contributionPoints!: number | null;                 // ADDED — closes the 2026-05-08 wiring gap
  @ApiPropertyOptional({ nullable: true, type: String })
  reasoning!: string | null;                          // NEW
}
```

`MatchEvidenceDto` and the match-preview evidence DTO each gain `reasoning?: string | null`.

`scoring.service.ts` mapper changes:

- `toDto` (profile): include `contributionPoints: e.contribution_points` and `reasoning: e.reasoning` in the evidence map. Same for `fromDbRow`.
- `matchScoreToDto`, `getMatchScoreByApplicationId`, `matchPreviewRowToDto`: include `reasoning: e.reasoning`.

These changes are pure data wiring — no behavioral or arithmetic shift.

### Calibration warnings as first-class API output

Today `detectCalibrationWarnings` results live only in audit. After this change, the response DTOs surface them so the candidate UI can render an inline notice when the AI's evidence wasn't balanced:

```ts
// New shared type:
export interface CalibrationWarning {
  componentName: string;
  reason: "ceiling_with_thin_evidence" | "deduction_without_negative_evidence";
}

// Added to ProfileScoreDto and MatchScoreDto and MatchScorePreviewDto:
@ApiProperty({ type: [CalibrationWarningDto] })
calibrationWarnings!: CalibrationWarningDto[];
```

The mappers pull warnings from the persisted `audit_logs.details.calibrationWarnings` for that score row OR recompute them on the fly from the persisted components — recomputing is cheaper and avoids the audit-table read. (Per `detectCalibrationWarnings` already being a pure function over a component, recomputing is deterministic and matches what audit recorded.)

### UI — `apps/web/components/score/evidence-callout.tsx`

Accept `reasoning?: string | null` and render it between the blockquote and the points-footer:

```tsx
{reasoning && (
  <p
    className="mt-2 text-sm text-[var(--color-body)]"
    style={{ borderLeft: `2px solid ${variant.borderColor}`, paddingLeft: "0.5rem" }}
  >
    {reasoning}
  </p>
)}
```

Visual: a thin score-band-colored hairline on the left of the reasoning sentence ties it to the relevance chip and points chip. Leans on existing tokens — no new colors. Renders only when present, so legacy rows (pre-v1.4.0 profile / pre-v1.3.0 match) degrade to the current visual exactly.

### UI — calibration-warning notice on breakdown surfaces

Three breakdown surfaces (`_match-preview-client.tsx`, `score-dashboard.tsx`, `apply-match-summary.tsx`) already render a "−N pts to perfect" footer per component. When `calibrationWarnings` is non-empty for the rendered score, add a small inline notice near the Recompute button (or `Apply Now` for non-recomputable surfaces):

```
[i] This breakdown may be incomplete — recompute to refresh.
```

Color: `var(--color-status-warning)` text on `var(--color-score-mid-soft)` background, `{rounded.pill}` per design system. Dismissible by clicking Recompute — the next recompute either clears the warnings or reproduces them, in which case the user knows it's a model-quality issue worth admin attention.

### Backwards compatibility

- **Schema:** `reasoning` is required for new payloads. The Zod `.min(10).max(280)` will reject malformed model outputs — `gpt-4o-mini` reliably produces well-formed strings under explicit prompt instructions, but the validation is the safety net. Same posture as the existing `contribution_points` `.multipleOf(5)` refinement.
- **DB rows:** Old rows continue to validate against legacy readers. Profile and match jsonb columns store evidence verbatim; the missing field on old rows surfaces as `undefined` → `null` through the DTO mapper, which the UI renders as "no reasoning chip."
- **UI:** `EvidenceCallout` guards on `reasoning && reasoning.length > 0` — no regression on legacy rows.
- **Cache invalidation:** Cache keys include `promptVersion`. Bumping profile to `1.4.0` and match to `1.3.0` invalidates v1.3.0/v1.2.0 entries naturally.
- **Recompute path:** The candidate's Recompute button on `/candidate/profile`, the on-view recompute on `/candidate/jobs/<id>`, and the application-time match scoring all produce v1.4.0/v1.3.0 rows. Candidates who recompute see the new reasoning sentences immediately; candidates who don't, see the legacy view until next recompute. Recruiter-facing match scores reproduce on the next applicant the recruiter receives.

### Phasing — single PR

Five thin layers, all in one slice:

1. `packages/shared/src/schemas/score.ts` — `reasoning` added.
2. `apps/api/src/ai/prompts/score-{profile,match}.ts` — version bumps + new fields + tightened balance rule + worked examples.
3. `apps/api/src/modules/scoring/{scoring.service,scoring.repository,dto/*}.ts` — DTO + mapper changes.
4. `apps/web/components/score/evidence-callout.tsx` — render `reasoning`.
5. Web consumers (5 files) — pipe `reasoning` and `contribution_points` (profile) to `EvidenceCallout`. Add calibration-warning notice on breakdown surfaces.

Single PR keeps the schema-prompt-engine-UI alignment atomic; partial deploys would either drop reasoning on the floor (UI old, API new) or 500 on validation (API old, UI new — though this can't happen since UI just reads).

## Testing

### Unit tests — `scoring.service.spec.ts`

Add to existing `describe("DTO mappers")` block (creating it if absent):

- **Profile mapper pipes `contribution_points` and `reasoning`.** Given a fixture profile score with two evidence items (one positive, one negative, both with `reasoning`), assert the response DTO carries both fields verbatim.
- **Match mapper pipes `reasoning`.** Same fixture pattern for match.
- **Match preview mapper pipes `reasoning`.** Same.

Add to existing `describe("detectCalibrationWarnings")` block:

- **Skills 20/40 with two positives and two neutrals quoting requirements fires `deduction_without_negative_evidence`.** Mirrors the screenshot: confirms the warning condition triggers for the exact failure mode the user reported.

### Integration smoke (human-driven; cannot be automated by Claude per `CLAUDE.md` § Hard rules)

Human runs `pnpm dev`, then:

1. `/candidate/profile` → Recompute → every evidence row displays a `reasoning` sentence under the excerpt; positive/negative chips both render; sums of visible chips per component equal displayed component score.
2. `/candidate/jobs/<id>` → Recompute → same; specifically, no `NEUTRAL` rows where the source is `Job requirement › ...`.
3. `/recruiter/applications/<id>` → reproduces the new layout with reasoning sentences for any application scored under v1.3.0.
4. Force a calibration-warning case (e.g., apply with a deliberately incomplete resume) → confirm "This breakdown may be incomplete — recompute to refresh" notice appears near the Recompute button, dismisses on next recompute.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| `gpt-4o-mini` produces `reasoning` strings that violate the 10–280 char range | Zod schema rejects malformed payloads → service returns 502 from the AI layer's existing error path. The prompt's worked examples drive compliance; if 502s spike, narrow the prompt iteration loop on examples. |
| Model still under-fills positives instead of using negatives, despite tightened prompt | `detectCalibrationWarnings` fires `deduction_without_negative_evidence`; the new candidate-facing notice surfaces the issue and Recompute reruns. Audit aggregates noncompliance for /admin/bias-monitor follow-up. |
| Reasoning strings parrot the chip ("This helps" / "This hurts") and add no information | Prompt examples explicitly call this out as a failure pattern; `reasoning.toLowerCase() === relevance` is impossible by length floor. We accept residual noise — adding a content-quality check would couple the engine to NLU heuristics, which is out of scope. |
| Pre-v1.3.0/v1.4.0 rows mix with new ones in the same recruiter view | `EvidenceCallout` guards on presence; mixed rows render with reasoning where available, blank where not. Visually consistent enough; the dichotomy fades after a recompute pass. |
| Calibration-warning notice annoys candidates whose model outputs were genuinely incomplete | Notice is small, dismissible by clicking Recompute, and only renders when warnings exist. False positives are rare (the heuristic is "score < max with zero negative evidence"); real positives are exactly the case the user wants surfaced. |

## Open questions

None at design time. All decisions are resolved.

## Glossary

- **Per-evidence reasoning** — A 10–280 character sentence on every `scoredEvidenceSchema` row explaining *why* this row helps or hurts. New in v1.3.0 (match) and v1.4.0 (profile).
- **Symmetric evidence** — The property that positives and negatives are presented with equal informational completeness (excerpt + source + relevance + points + reasoning). The thesis claim of "explainable scoring" is met when this property holds.
- **Calibration warning notice** — Candidate-facing inline message rendered when `detectCalibrationWarnings` flags noncompliance for the displayed score. Promotes audit-only signal to user-actionable affordance.
