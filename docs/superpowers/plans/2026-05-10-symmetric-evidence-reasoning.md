# Symmetric Evidence Reasoning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (this is an inline-execution slice). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Every credit AND every deduction in profile + match scoring shows its work — schema gains a per-row `reasoning` sentence, prompts forbid `neutral` evidence rows quoting gap items, candidate UI surfaces calibration-warning recoverability.

**Architecture:** Single vertical slice across five layers — shared Zod schema → AI prompts (v-bumped) → API DTOs + service mappers → web `EvidenceCallout` component → 6 consumer surfaces. No DB migration (jsonb columns absorb the new field). The auxiliary `evidence_excerpts` relational table stays unchanged for now (auxiliary, not a UI source).

**Tech Stack:** TypeScript strict, Zod schemas, NestJS, Drizzle ORM (read-only here), Next.js 16 App Router, Jest (`scoring.service.spec.ts`).

---

## File Structure

**Schema (1):**
- Modify: `packages/shared/src/schemas/score.ts:27-29` — add `reasoning` to `scoredEvidenceSchema`

**Prompts (2):**
- Modify: `apps/api/src/ai/prompts/score-profile.ts` (1.3.0 → 1.4.0)
- Modify: `apps/api/src/ai/prompts/score-match.ts` (1.2.0 → 1.3.0)

**API DTOs (3):**
- Modify: `apps/api/src/modules/scoring/dto/profile-score-response.dto.ts:3-7,27-39` — add `contributionPoints` + `reasoning` to `ScoreEvidenceDto`; add `calibrationWarnings` to `ProfileScoreDto`
- Modify: `apps/api/src/modules/applications/dto/application-response.dto.ts:3-9,21-35` — add `reasoning` to `MatchEvidenceDto`; add `calibrationWarnings` to `MatchScoreDto`
- Modify: `apps/api/src/modules/scoring/dto/match-preview-response.dto.ts:7-25` — add `calibrationWarnings` to `MatchScorePreviewDto`

**Shared types (1):**
- Modify: `packages/shared/src/schemas/score.ts` — export `CalibrationWarning` type for cross-package use

**Service / mappers (1):**
- Modify: `apps/api/src/modules/scoring/scoring.service.ts:529-598,832-866,1267-1296,1298-1332` — pipe `reasoning` and `contribution_points` through all 5 DTO mappers; recompute `calibrationWarnings` in mappers

**Tests (1):**
- Modify: `apps/api/src/modules/scoring/scoring.service.spec.ts` — three new test cases

**Web component (1):**
- Modify: `apps/web/components/score/evidence-callout.tsx` — accept and render `reasoning`

**Web infra (1):**
- Modify: `apps/web/components/score/score-dashboard.tsx:10-15,318-326,360-368` — extend `ScoreDashboardEvidence` with `reasoning`; pass through to `EvidenceCallout`; add optional `calibrationWarnings` notice slot

**Web consumers (6 — pass `reasoning` through):**
- Modify: `apps/web/app/(candidate)/candidate/jobs/[id]/_match-preview-client.tsx` — pipe + add inline calibration-warning notice
- Modify: `apps/web/components/score/apply-match-summary.tsx` — pipe + notice
- Modify: `apps/web/app/(admin)/admin/applications/_application-detail-sheet-client.tsx` — pipe
- Modify: `apps/web/app/(recruiter)/recruiter/applications/[id]/_application-detail-client.tsx` — pipe + notice
- Modify: `apps/web/app/(candidate)/candidate/profile/_profile-score-dashboard-client.tsx` — pipe `reasoning` (and the `contributionPoints` that finally reaches profile)
- Modify: `apps/web/app/(candidate)/candidate/_components/profile-score-card-client.tsx` — pipe (preview card on dashboard)

---

## Task 1: Schema — add `reasoning` to `scoredEvidenceSchema` + `CalibrationWarning` type

**Files:**
- Modify: `packages/shared/src/schemas/score.ts`

- [ ] **Step 1.1: Extend `scoredEvidenceSchema` with `reasoning`**

```ts
// packages/shared/src/schemas/score.ts — replace lines 17-29
/**
 * Evidence that contributes a quantified delta to a component score.
 * `contribution_points` is a SIGNED INTEGER and a MULTIPLE OF 5 — positive when
 * the quote helped, negative when it represents a gap, 0 when neutral.
 *
 * The engine derives `component.score = clamp(sum(contribution_points), 0, max)`
 * so this field is the source of truth for a component's numeric score.
 *
 * `reasoning` is a 10–280 char sentence on every row explaining WHY this row
 * helps or hurts, surfacing per-evidence transparency the chip alone can't.
 *
 * Used by both profile components (since v1.4.0) and match components (since v1.3.0).
 */
export const scoredEvidenceSchema = evidenceSchema.extend({
  contribution_points: z.number().int().multipleOf(5),
  reasoning: z.string().min(10).max(280),
});
```

- [ ] **Step 1.2: Export `CalibrationWarning` shared type**

```ts
// packages/shared/src/schemas/score.ts — append after the existing exports
/**
 * Advisory signal emitted when a score component matches a known model
 * misbehavior pattern (ceiling without strong evidence, deduction without
 * negative evidence). Surfaced to candidate UIs for inline "this breakdown
 * may be incomplete" notices and aggregated in /admin/bias-monitor.
 */
export const calibrationWarningSchema = z.object({
  componentName: z.string(),
  reason: z.enum([
    "ceiling_with_thin_evidence",
    "deduction_without_negative_evidence",
  ]),
});

export type CalibrationWarning = z.infer<typeof calibrationWarningSchema>;
```

- [ ] **Step 1.3: Verify exports flow through `packages/shared/src/index.ts`**

Run: `Grep -n "scoredEvidenceSchema\|CalibrationWarning" packages/shared/src/index.ts`

If `CalibrationWarning` doesn't appear in the index, add it to the score-schema re-export block. Find the line that exports from `./schemas/score` and ensure it uses `export * from` (no targeted whitelist). If it's targeted, add `calibrationWarningSchema` and the `CalibrationWarning` type.

- [ ] **Step 1.4: Type-check the shared package**

Run from repo root: `pnpm --filter @aurahire/shared tsc --noEmit`
Expected: PASS

- [ ] **Step 1.5: Commit**

```bash
git add packages/shared/src/schemas/score.ts packages/shared/src/index.ts
git commit -m "feat(shared): add reasoning to scoredEvidenceSchema and CalibrationWarning type"
```

---

## Task 2: Bump profile prompt to v1.4.0 with `reasoning` + tightened gap rule

**Files:**
- Modify: `apps/api/src/ai/prompts/score-profile.ts`

- [ ] **Step 2.1: Bump version constant**

```ts
// apps/api/src/ai/prompts/score-profile.ts — line 1
export const SCORE_PROFILE_VERSION = "1.4.0";
```

- [ ] **Step 2.2: Add `reasoning` to the per-evidence field list**

Replace the current evidence-field bullet (line 17-21) with:

```ts
3. Provide 2-6 evidence excerpts from the resume that drove the score. Each excerpt:
   - excerpt: a short quote from the resume (or for negative items, the section/expectation that fell short).
   - source: section reference (e.g. "Experience › Senior Engineer at Acme", or "Resume › Education" for an absent-credential gap).
   - relevance: "positive" (helped earn points) | "negative" (a gap that cost points) | "neutral" (context only).
   - contribution_points: SIGNED integer that is a MULTIPLE OF 5 (..., -15, -10, -5, 0, +5, +10, +15, ...). Positive when the quote helped (+N). Negative when it represents a gap (-N). 0 only for purely neutral context. The engine derives component.score from the SUM of contribution_points, clamped to [0, max] — so the sum MUST equal the score you intend.
   - reasoning: ONE sentence (10–280 chars) explaining WHY this row contributes the score it does. Be specific to the candidate's resume; never paraphrase the chip ("This helps", "This hurts" — disallowed).
     POSITIVE example: "Multi-year TypeScript experience cited in two roles matches the role's primary stack."
     NEGATIVE example: "Resume mentions no leadership scope or quantified outcomes; senior expectations expect both."
```

- [ ] **Step 2.3: Replace the EVIDENCE BALANCE block with the tightened rule**

Replace line 28 (the current single-line rule) with:

```ts
EVIDENCE BALANCE — REQUIRED:
- The sum of all contribution_points (positive + negative) MUST equal component.score exactly. The engine recomputes from the sum and clamps to [0, max], so any mismatch is silently overwritten — match them yourself for narrative coherence.
- For every component where score < max, you MUST include at least one evidence item with relevance="negative" and contribution_points<0 that names the gap. The gap MUST be a `negative` row, never a `neutral` row that merely cites the missing requirement.
- Evidence whose excerpt or source describes an expected credential, expected resume section, or quality bar the candidate does NOT satisfy MUST use relevance="negative" with contribution_points<0. Never `neutral`.
- `neutral` is reserved for genuinely contextual snippets that neither help nor hurt (e.g. tenure note that anchors the reader). Use sparingly; default to either positive or negative.
```

- [ ] **Step 2.4: Verify Step 2.1–2.3 by reading the file end-to-end**

Run: `Read apps/api/src/ai/prompts/score-profile.ts`
Confirm: `SCORE_PROFILE_VERSION = "1.4.0"`, `reasoning` appears in evidence field list, the new BALANCE block replaces the old single-line rule.

- [ ] **Step 2.5: Type-check**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: PASS

- [ ] **Step 2.6: Commit**

```bash
git add apps/api/src/ai/prompts/score-profile.ts
git commit -m "feat(api): bump profile-score prompt to v1.4.0 — reasoning + symmetric gap rule"
```

---

## Task 3: Bump match prompt to v1.3.0 with same updates

**Files:**
- Modify: `apps/api/src/ai/prompts/score-match.ts`

- [ ] **Step 3.1: Bump version constant**

```ts
// apps/api/src/ai/prompts/score-match.ts — line 1
export const SCORE_MATCH_VERSION = "1.3.0";
```

- [ ] **Step 3.2: Add `reasoning` to the per-evidence field list**

Replace the current evidence field section (lines 9-12) with:

```ts
3. 1-6 evidence excerpts in total — a mix of positive (what helped) and negative (what was missing or mismatched).
   - excerpt: a short quote. For positive items, quote the candidate's resume verbatim. For negative items, quote either the resume snippet that fell short OR the job-description requirement the resume does not satisfy.
   - source: section reference. Examples — "Experience › Senior Engineer at Acme" (resume), or "Job requirement › Required Skills" (job description) for gap items.
   - relevance: "positive" (helped earn points) | "negative" (a gap that cost points) | "neutral" (context only).
   - contribution_points: SIGNED integer that is a MULTIPLE OF 5 (..., -15, -10, -5, 0, +5, +10, +15, ...). Positive when the quote helped (+N). Negative when it represents a gap (-N). 0 only for purely neutral context. The engine derives component.score from the sum, clamped to [0, max]; pick numbers honestly.
   - reasoning: ONE sentence (10–280 chars) explaining WHY this row contributes the score it does. Be specific to candidate-vs-job; never paraphrase the chip ("This helps" / "This hurts" disallowed).
     POSITIVE example: "Resume cites 6 years of TypeScript across two senior roles, satisfying the role's primary language requirement."
     NEGATIVE example: "Resume does not mention Go, Backstage, or Bazel — three of the role's core required skills."
```

- [ ] **Step 3.3: Replace EVIDENCE BALANCE block**

Replace lines 36-40 with:

```ts
EVIDENCE BALANCE — REQUIRED:
- The sum of all evidence contribution_points (positive + negative) must EQUAL component.score exactly. If you score skills at 25/40, the contributions must sum to 25. The engine recomputes score from the sum, so any mismatch will be silently overwritten — match them yourself for narrative coherence.
- For every component where score < max, you MUST include at least one "negative" evidence item that names the gap. The gap MUST be a `negative` row, never a `neutral` row that merely cites the unmet requirement.
- Evidence whose excerpt or source describes a job requirement the candidate does NOT satisfy MUST use relevance="negative" with contribution_points<0. Never `neutral`.
- `neutral` is reserved for genuinely contextual snippets that neither help nor hurt. Use sparingly; default to either positive or negative.
- For components scored at max, do NOT fabricate gaps — only positive/neutral evidence.
- Total evidence per component: aim for 2–4 items in mixed cases (some positives + at least one negative). Do not exceed 6.
```

- [ ] **Step 3.4: Type-check**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: PASS

- [ ] **Step 3.5: Commit**

```bash
git add apps/api/src/ai/prompts/score-match.ts
git commit -m "feat(api): bump match-score prompt to v1.3.0 — reasoning + symmetric gap rule"
```

---

## Task 4: Extend API DTOs with `reasoning` + `calibrationWarnings`

**Files:**
- Modify: `apps/api/src/modules/scoring/dto/profile-score-response.dto.ts`
- Modify: `apps/api/src/modules/applications/dto/application-response.dto.ts`
- Modify: `apps/api/src/modules/scoring/dto/match-preview-response.dto.ts`

- [ ] **Step 4.1: Update `ScoreEvidenceDto` (profile) — add `contributionPoints` AND `reasoning`**

Replace `apps/api/src/modules/scoring/dto/profile-score-response.dto.ts` lines 3-7 with:

```ts
export class ScoreEvidenceDto {
  @ApiProperty() excerpt!: string;
  @ApiProperty() source!: string;
  @ApiProperty({ enum: ["positive", "negative", "neutral"] }) relevance!: string;
  @ApiPropertyOptional({ nullable: true, type: Number })
  contributionPoints!: number | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  reasoning!: string | null;
}
```

Update the import on line 1 to include `ApiPropertyOptional`:

```ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
```

- [ ] **Step 4.2: Add `CalibrationWarningDto` and extend `ProfileScoreDto`**

Append a new class above `ProfileScoreDto` (line 27) and add `calibrationWarnings` to it:

```ts
export class CalibrationWarningDto {
  @ApiProperty() componentName!: string;
  @ApiProperty({
    enum: ["ceiling_with_thin_evidence", "deduction_without_negative_evidence"],
  })
  reason!: "ceiling_with_thin_evidence" | "deduction_without_negative_evidence";
}

export class ProfileScoreDto {
  @ApiProperty() id!: string;
  @ApiProperty() overallScore!: number;
  @ApiProperty({ enum: ["strong", "partial", "limited"] }) band!: string;
  @ApiProperty({ type: [ProfileComponentDto] }) components!: ProfileComponentDto[];
  @ApiProperty({ type: [ImprovementSuggestionDto] })
  improvementSuggestions!: ImprovementSuggestionDto[];
  @ApiProperty({ type: [String] }) redactedFields!: string[];
  @ApiProperty() promptVersion!: string;
  @ApiProperty() modelUsed!: string;
  @ApiProperty() latencyMs!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: [CalibrationWarningDto] })
  calibrationWarnings!: CalibrationWarningDto[];
}
```

- [ ] **Step 4.3: Update `MatchEvidenceDto` and `MatchScoreDto`**

Replace `apps/api/src/modules/applications/dto/application-response.dto.ts` lines 3-9 with:

```ts
export class MatchEvidenceDto {
  @ApiProperty() excerpt!: string;
  @ApiProperty() source!: string;
  @ApiProperty({ enum: ["positive", "negative", "neutral"] }) relevance!: string;
  @ApiPropertyOptional({ nullable: true, type: Number })
  contributionPoints!: number | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  reasoning!: string | null;
}
```

Then append a `CalibrationWarningDto` class (mirroring profile's) and add `calibrationWarnings` to `MatchScoreDto`:

```ts
export class CalibrationWarningDto {
  @ApiProperty() componentName!: string;
  @ApiProperty({
    enum: ["ceiling_with_thin_evidence", "deduction_without_negative_evidence"],
  })
  reason!: "ceiling_with_thin_evidence" | "deduction_without_negative_evidence";
}
```

Add this property to `MatchScoreDto` (after `latencyMs`, line 33):

```ts
@ApiProperty({ type: [CalibrationWarningDto] })
calibrationWarnings!: CalibrationWarningDto[];
```

- [ ] **Step 4.4: Add `calibrationWarnings` to `MatchScorePreviewDto`**

In `apps/api/src/modules/scoring/dto/match-preview-response.dto.ts`, update imports (line 3-5) to include `CalibrationWarningDto` from the applications module:

```ts
import {
  MatchComponentDto,
  CalibrationWarningDto,
} from "../../applications/dto/application-response.dto";
```

Add the property after `createdAt` (line 19):

```ts
@ApiProperty({ type: [CalibrationWarningDto] })
calibrationWarnings!: CalibrationWarningDto[];
```

- [ ] **Step 4.5: Type-check**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: FAIL — service mappers do not yet populate the new required fields. This is expected; Task 5 fixes them.

- [ ] **Step 4.6: Commit (intentionally with red type-check; the next task's commit makes it green)**

Skip this commit — bundle DTOs + mappers in Task 5's commit so the tree never lands on a broken type state.

---

## Task 5: Pipe `reasoning` + `calibrationWarnings` through scoring service mappers

**Files:**
- Modify: `apps/api/src/modules/scoring/scoring.service.ts`

- [ ] **Step 5.1: Import `CalibrationWarningDto` from applications DTO at top of `scoring.service.ts`**

Append to the import block (~line 38-44):

```ts
import type {
  MatchScoreDto,
  MatchComponentDto,
  MatchEvidenceDto,
  CalibrationWarningDto,
} from "../applications/dto/application-response.dto";
```

And import the local `CalibrationWarningDto` from profile DTO at line 35-37:

```ts
import type {
  ProfileScoreDto,
  ScoreEvidenceDto,
  CalibrationWarningDto as ProfileCalibrationWarningDto,
} from "./dto/profile-score-response.dto";
```

(The two DTOs are structurally identical; one is profile-namespaced, the other application-namespaced. Use the profile one in the profile mapper.)

- [ ] **Step 5.2: Update `toDto` (profile) — pipe `contributionPoints`, `reasoning`, and `calibrationWarnings`**

Replace `apps/api/src/modules/scoring/scoring.service.ts` lines 529-564 with:

```ts
private toDto(
  scoreId: string,
  score: ProfileScoreOutput,
  aiMeta: { latencyMs: number; model: string; promptVersion: string; redactedFields: string[] },
  createdAt: Date,
  overallOverride?: number,
  bandOverride?: "strong" | "partial" | "limited",
): ProfileScoreDto {
  const calibrationWarnings = score.components.flatMap((c) =>
    detectCalibrationWarnings({
      name: c.name,
      score: c.score,
      max: c.max,
      evidence: c.evidence.map((e) => ({
        excerpt: e.excerpt,
        source: e.source,
        relevance: e.relevance,
        contribution_points: e.contribution_points,
      })),
    }),
  );
  return {
    id: scoreId,
    overallScore: overallOverride ?? score.overall_score,
    band: bandOverride ?? score.band,
    components: score.components.map((c) => ({
      name: c.name,
      score: c.score,
      max: c.max,
      weight: c.weight,
      explanation: c.explanation,
      evidence: c.evidence.map<ScoreEvidenceDto>((e) => ({
        excerpt: e.excerpt,
        source: e.source,
        relevance: e.relevance,
        contributionPoints: e.contribution_points,
        reasoning: e.reasoning,
      })),
    })),
    improvementSuggestions: score.improvement_suggestions.map((s) => ({
      title: s.title,
      description: s.description,
      estimatedImpact: s.estimated_impact,
    })),
    redactedFields: aiMeta.redactedFields,
    promptVersion: aiMeta.promptVersion,
    modelUsed: aiMeta.model,
    latencyMs: aiMeta.latencyMs,
    createdAt: createdAt.toISOString(),
    calibrationWarnings,
  };
}
```

- [ ] **Step 5.3: Update `fromDbRow` similarly**

Replace `scoring.service.ts` lines 566-598 with:

```ts
private fromDbRow(row: DbProfileScore): ProfileScoreDto {
  const components = (row.components as ProfileScoreOutput["components"]) ?? [];
  const suggestions =
    (row.improvementSuggestions as ProfileScoreOutput["improvement_suggestions"]) ?? [];

  const calibrationWarnings = components.flatMap((c) =>
    detectCalibrationWarnings({
      name: c.name,
      score: c.score,
      max: c.max,
      evidence: c.evidence.map((e) => ({
        excerpt: e.excerpt,
        source: e.source,
        relevance: e.relevance,
        contribution_points: e.contribution_points,
      })),
    }),
  );

  return {
    id: row.id,
    overallScore: row.overallScore,
    band: row.band,
    components: components.map((c) => ({
      name: c.name,
      score: c.score,
      max: c.max,
      weight: c.weight,
      explanation: c.explanation,
      evidence: c.evidence.map<ScoreEvidenceDto>((e) => ({
        excerpt: e.excerpt,
        source: e.source,
        relevance: e.relevance,
        contributionPoints: e.contribution_points,
        reasoning: e.reasoning,
      })),
    })),
    improvementSuggestions: suggestions.map((s) => ({
      title: s.title,
      description: s.description,
      estimatedImpact: s.estimated_impact,
    })),
    redactedFields: row.redactedFields,
    promptVersion: row.promptVersion,
    modelUsed: row.modelUsed,
    latencyMs: row.latencyMs ?? 0,
    createdAt: row.createdAt.toISOString(),
    calibrationWarnings,
  };
}
```

- [ ] **Step 5.4: Update `getMatchScoreByApplicationId` mapper**

Replace `scoring.service.ts` lines 832-866 with:

```ts
async getMatchScoreByApplicationId(
  applicationId: string,
): Promise<MatchScoreDto | null> {
  const row = await this.scoringRepo.findMatchScoreByApplicationId(applicationId);
  if (!row) return null;

  const components = (row.components as MatchScoreOutput["components"]) ?? [];
  const raw = row.rawOutput as MatchScoreOutput;
  const calibrationWarnings = components.flatMap((c) =>
    detectCalibrationWarnings({
      name: c.name,
      score: c.score,
      max: c.max,
      evidence: c.evidence.map((e) => ({
        excerpt: e.excerpt,
        source: e.source,
        relevance: e.relevance,
        contribution_points: e.contribution_points,
      })),
    }),
  );
  return {
    id: row.id,
    overallScore: row.overallScore,
    band: row.band,
    components: components.map((c) => ({
      name: c.name,
      score: c.score,
      max: c.max,
      weight: c.weight,
      explanation: c.explanation,
      evidence: c.evidence.map<MatchEvidenceDto>((e) => ({
        excerpt: e.excerpt,
        source: e.source,
        relevance: e.relevance,
        contributionPoints: e.contribution_points,
        reasoning: e.reasoning,
      })),
    })),
    summary: raw?.summary ?? "",
    redFlags: raw?.red_flags ?? null,
    greenFlags: raw?.green_flags ?? null,
    redactedFields: row.redactedFields,
    promptVersion: row.promptVersion,
    modelUsed: row.modelUsed,
    latencyMs: row.latencyMs ?? 0,
    createdAt: row.createdAt.toISOString(),
    calibrationWarnings,
  };
}
```

- [ ] **Step 5.5: Update `matchScoreToDto`**

Replace `scoring.service.ts` lines 1298-1332 with:

```ts
private matchScoreToDto(
  scoreId: string,
  score: MatchScoreOutput,
  aiMeta: { latencyMs: number; model: string; promptVersion: string; redactedFields: string[] },
  createdAt: Date,
  overallOverride?: number,
  bandOverride?: "strong" | "partial" | "limited",
): MatchScoreDto {
  const calibrationWarnings = score.components.flatMap((c) =>
    detectCalibrationWarnings({
      name: c.name,
      score: c.score,
      max: c.max,
      evidence: c.evidence.map((e) => ({
        excerpt: e.excerpt,
        source: e.source,
        relevance: e.relevance,
        contribution_points: e.contribution_points,
      })),
    }),
  );
  return {
    id: scoreId,
    overallScore: overallOverride ?? score.overall_score,
    band: bandOverride ?? score.band,
    components: score.components.map<MatchComponentDto>((c) => ({
      name: c.name,
      score: c.score,
      max: c.max,
      weight: c.weight,
      explanation: c.explanation,
      evidence: c.evidence.map<MatchEvidenceDto>((e) => ({
        excerpt: e.excerpt,
        source: e.source,
        relevance: e.relevance,
        contributionPoints: e.contribution_points,
        reasoning: e.reasoning,
      })),
    })),
    summary: score.summary,
    redFlags: score.red_flags ?? null,
    greenFlags: score.green_flags ?? null,
    redactedFields: aiMeta.redactedFields,
    promptVersion: aiMeta.promptVersion,
    modelUsed: aiMeta.model,
    latencyMs: aiMeta.latencyMs,
    createdAt: createdAt.toISOString(),
    calibrationWarnings,
  };
}
```

- [ ] **Step 5.6: Update `matchPreviewRowToDto`**

Replace `scoring.service.ts` lines 1267-1296 with:

```ts
private matchPreviewRowToDto(row: DbMatchScorePreview): MatchScorePreviewDto {
  const components = (row.components as MatchScoreOutput["components"]) ?? [];
  const calibrationWarnings = components.flatMap((c) =>
    detectCalibrationWarnings({
      name: c.name,
      score: c.score,
      max: c.max,
      evidence: c.evidence.map((e) => ({
        excerpt: e.excerpt,
        source: e.source,
        relevance: e.relevance,
        contribution_points: e.contribution_points,
      })),
    }),
  );
  return {
    id: row.id,
    jobId: row.jobId,
    resumeId: row.resumeId,
    overallScore: row.overallScore,
    band: row.band,
    components: components.map<MatchComponentDto>((c) => ({
      name: c.name,
      score: c.score,
      max: c.max,
      weight: c.weight,
      explanation: c.explanation,
      evidence: c.evidence.map<MatchEvidenceDto>((e) => ({
        excerpt: e.excerpt,
        source: e.source,
        relevance: e.relevance,
        contributionPoints: e.contribution_points,
        reasoning: e.reasoning,
      })),
    })),
    redactedFields: row.redactedFields,
    promptVersion: row.promptVersion,
    modelUsed: row.modelUsed,
    latencyMs: row.latencyMs ?? 0,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    calibrationWarnings,
    job: null,
  };
}
```

- [ ] **Step 5.7: Type-check**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: PASS

- [ ] **Step 5.8: Commit DTO + mapper changes together**

```bash
git add apps/api/src/modules/scoring/dto/profile-score-response.dto.ts apps/api/src/modules/applications/dto/application-response.dto.ts apps/api/src/modules/scoring/dto/match-preview-response.dto.ts apps/api/src/modules/scoring/scoring.service.ts
git commit -m "feat(api): pipe reasoning + calibrationWarnings through scoring DTOs and mappers"
```

---

## Task 6: Render `reasoning` in `EvidenceCallout`

**Files:**
- Modify: `apps/web/components/score/evidence-callout.tsx`

- [ ] **Step 6.1: Add `reasoning` prop and render it**

Replace `apps/web/components/score/evidence-callout.tsx` entirely with:

```tsx
import { Quote } from "lucide-react";

type Relevance = "positive" | "negative" | "neutral";

interface EvidenceCalloutProps {
  excerpt: string;
  source: string;
  relevance: Relevance;
  contributionPoints?: number | null;
  reasoning?: string | null;
  className?: string;
}

const RELEVANCE_VARIANTS: Record<
  Relevance,
  { borderColor: string; iconColor: string; label: string }
> = {
  positive: {
    borderColor: "var(--color-score-high)",
    iconColor: "var(--color-score-high)",
    label: "Helped",
  },
  neutral: {
    borderColor: "var(--color-muted)",
    iconColor: "var(--color-muted)",
    label: "Neutral",
  },
  negative: {
    borderColor: "var(--color-score-low)",
    iconColor: "var(--color-score-low)",
    label: "Hurt",
  },
};

export function EvidenceCallout({
  excerpt,
  source,
  relevance,
  contributionPoints,
  reasoning,
  className,
}: EvidenceCalloutProps) {
  const variant = RELEVANCE_VARIANTS[relevance];
  return (
    <article
      className={`rounded-[var(--radius-lg)] border-l-4 bg-[var(--color-surface-soft)] p-4 ${className ?? ""}`}
      style={{ borderLeftColor: variant.borderColor }}
    >
      <header className="mb-2 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          <Quote className="h-3.5 w-3.5" style={{ color: variant.iconColor }} />
          Evidence from resume
        </div>
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: variant.iconColor }}
        >
          {variant.label}
        </span>
      </header>
      {source && (
        <p className="mb-2 text-xs italic text-[var(--color-muted)]">{source}</p>
      )}
      <blockquote className="text-sm italic text-[var(--color-body)] break-words">
        &ldquo;{excerpt}&rdquo;
      </blockquote>
      {reasoning && reasoning.trim().length > 0 && (
        <p
          className="mt-3 border-l-2 pl-3 text-sm leading-relaxed text-[var(--color-body)]"
          style={{ borderLeftColor: variant.borderColor }}
        >
          {reasoning}
        </p>
      )}
      {typeof contributionPoints === "number" && contributionPoints !== 0 && (
        <p
          className="mt-3 font-mono text-xs font-semibold"
          style={{ color: variant.iconColor }}
        >
          {contributionPoints > 0 ? "+" : "−"}
          {Math.abs(contributionPoints)} points
        </p>
      )}
    </article>
  );
}
```

- [ ] **Step 6.2: Type-check web**

Run: `pnpm --filter @aurahire/web tsc --noEmit`
Expected: PASS (callers don't pass `reasoning` yet, but it's optional)

- [ ] **Step 6.3: Commit**

```bash
git add apps/web/components/score/evidence-callout.tsx
git commit -m "feat(web): render per-row reasoning in EvidenceCallout"
```

---

## Task 7: Extend `ScoreDashboard` to pipe `reasoning` and accept calibration-warning notice slot

**Files:**
- Modify: `apps/web/components/score/score-dashboard.tsx`

- [ ] **Step 7.1: Extend `ScoreDashboardEvidence` type**

Replace `apps/web/components/score/score-dashboard.tsx` lines 10-15 with:

```ts
export interface ScoreDashboardEvidence {
  excerpt: string;
  source: string;
  relevance: "positive" | "negative" | "neutral";
  contributionPoints?: number | null;
  reasoning?: string | null;
}
```

- [ ] **Step 7.2: Pass `reasoning` to both `EvidenceCallout` invocations**

In the same file, find the two `EvidenceCallout` blocks (lines ~318-326 and ~360-368) and add `reasoning={ev.reasoning ?? null}` to each:

```tsx
<EvidenceCallout
  key={`${c.name}-ev-${i}`}
  excerpt={trimQuotes(ev.excerpt)}
  source={ev.source}
  relevance={ev.relevance}
  contributionPoints={ev.contributionPoints ?? null}
  reasoning={ev.reasoning ?? null}
/>
```

(and the same for the grouped variant)

- [ ] **Step 7.3: Add optional `calibrationNotice` prop to `ScoreDashboardProps`**

In the props interface (line 32-62) append:

```ts
/**
 * Optional inline notice rendered between the active component header and
 * its evidence list. Used to surface calibration warnings ("breakdown may
 * be incomplete — recompute") to the candidate without disrupting layout.
 */
calibrationNotice?: ReactNode;
```

Then in the destructuring on line 78-89 add `calibrationNotice`.

In the component body (around line 290 — between the explanation paragraph and the evidence list — i.e. after `<p className="text-sm leading-relaxed text-[var(--color-body)]">{c.explanation}</p>`) the notice should render at the top of the right pane, NOT per-component. Add it BEFORE the grid in the main layout (around line 106, after `topActions`):

```tsx
{calibrationNotice}
```

Pass `calibrationNotice` from the destructured props.

- [ ] **Step 7.4: Type-check**

Run: `pnpm --filter @aurahire/web tsc --noEmit`
Expected: PASS

- [ ] **Step 7.5: Commit**

```bash
git add apps/web/components/score/score-dashboard.tsx
git commit -m "feat(web): pipe reasoning through ScoreDashboard and add calibrationNotice slot"
```

---

## Task 8: Update web consumers — pipe `reasoning` and surface calibration notices

**Files (6):**
- Modify: `apps/web/app/(candidate)/candidate/jobs/[id]/_match-preview-client.tsx`
- Modify: `apps/web/components/score/apply-match-summary.tsx`
- Modify: `apps/web/app/(admin)/admin/applications/_application-detail-sheet-client.tsx`
- Modify: `apps/web/app/(recruiter)/recruiter/applications/[id]/_application-detail-client.tsx`
- Modify: `apps/web/app/(candidate)/candidate/profile/_profile-score-dashboard-client.tsx`
- Modify: `apps/web/app/(candidate)/candidate/_components/profile-score-card-client.tsx`

For each consumer, the work is the same shape:
1. Find where the consumer maps API evidence into `EvidenceCallout` props (or into `ScoreDashboardEvidence`).
2. Add `reasoning: e.reasoning ?? null` to the mapped object.
3. If the consumer's source data is also typed (e.g. an interface defined inline), extend that interface with `reasoning?: string | null` and `calibrationWarnings?: CalibrationWarning[]` where applicable.
4. Where the consumer renders breakdowns (match preview / dashboard / apply / app-detail), render a calibration-warning notice when `score.calibrationWarnings.length > 0`.

- [ ] **Step 8.1: Inspect each consumer to locate the evidence map**

Run sequentially:
- `Grep -n "evidence" apps/web/app/(candidate)/candidate/jobs/\[id\]/_match-preview-client.tsx`
- `Grep -n "evidence" apps/web/components/score/apply-match-summary.tsx`
- `Grep -n "evidence" apps/web/app/(admin)/admin/applications/_application-detail-sheet-client.tsx`
- `Grep -n "evidence" apps/web/app/(recruiter)/recruiter/applications/\[id\]/_application-detail-client.tsx`
- `Grep -n "evidence\|ScoreDashboardEvidence" apps/web/app/(candidate)/candidate/profile/_profile-score-dashboard-client.tsx`
- `Grep -n "evidence" apps/web/app/(candidate)/candidate/_components/profile-score-card-client.tsx`

Note the line numbers for each evidence map.

- [ ] **Step 8.2: Add `reasoning` to each evidence map**

For each consumer, edit the evidence map. Example shape:

```ts
// before
evidence: c.evidence.map((e) => ({
  excerpt: e.excerpt,
  source: e.source,
  relevance: e.relevance,
  contributionPoints: e.contributionPoints,
})),

// after
evidence: c.evidence.map((e) => ({
  excerpt: e.excerpt,
  source: e.source,
  relevance: e.relevance,
  contributionPoints: e.contributionPoints,
  reasoning: e.reasoning ?? null,
})),
```

If the consumer's source-data interface is an inline TypeScript shape that doesn't include `reasoning`, extend it (e.g. `reasoning?: string | null`).

- [ ] **Step 8.3: Render the calibration-warning notice on three breakdown surfaces**

For `_match-preview-client.tsx`, `apply-match-summary.tsx`, and `_application-detail-client.tsx` — locate where the breakdown is rendered (typically near the Recompute / Apply Now button, or near the score-ring header) and add:

```tsx
{score.calibrationWarnings && score.calibrationWarnings.length > 0 && (
  <div
    className="rounded-[var(--radius-pill)] px-4 py-2 text-xs"
    style={{
      backgroundColor: "var(--color-score-mid-soft)",
      color: "var(--color-score-mid)",
    }}
  >
    <span className="font-semibold">Heads up — </span>
    This breakdown may be incomplete. Recompute to refresh.
  </div>
)}
```

For `_profile-score-dashboard-client.tsx`, render the notice via the new `calibrationNotice` prop on `ScoreDashboard`:

```tsx
<ScoreDashboard
  // ...existing props
  calibrationNotice={
    data.calibrationWarnings && data.calibrationWarnings.length > 0 ? (
      <div /* same notice block as above */ />
    ) : null
  }
/>
```

For the admin sheet (`_application-detail-sheet-client.tsx`) and the candidate dashboard preview card (`profile-score-card-client.tsx`) — skip the notice (these are already-listed thumbnail surfaces; the notice belongs on the canonical breakdown view).

- [ ] **Step 8.4: Update the consumer's source-data interface for `calibrationWarnings`**

Where the consumer defines an interface for `data.matchScore` / `data.profileScore` / `data.preview`, extend it:

```ts
interface MatchPreviewData {
  // ...
  calibrationWarnings?: CalibrationWarning[];
}
```

Import `CalibrationWarning` from `@aurahire/shared` where needed.

- [ ] **Step 8.5: Type-check web**

Run: `pnpm --filter @aurahire/web tsc --noEmit`
Expected: PASS

- [ ] **Step 8.6: Commit**

```bash
git add apps/web
git commit -m "feat(web): surface reasoning + calibration-warning notice on all breakdown consumers"
```

---

## Task 9: Add unit tests in `scoring.service.spec.ts`

**Files:**
- Modify: `apps/api/src/modules/scoring/scoring.service.spec.ts`

- [ ] **Step 9.1: Locate the existing `describe("detectCalibrationWarnings")` block**

Run: `Grep -n "detectCalibrationWarnings\|toDto\|matchScoreToDto" apps/api/src/modules/scoring/scoring.service.spec.ts`

Identify the line of the `describe("detectCalibrationWarnings", ...)` block (or the closest existing block).

- [ ] **Step 9.2: Add new test case — Skills 20/40 with neutrals quoting requirements fires deduction warning**

Inside the existing `describe("detectCalibrationWarnings")` block (or create one if missing), append:

```ts
it("fires `deduction_without_negative_evidence` for the screenshot failure mode (Skills 20/40 with two positives + two neutrals quoting requirements)", () => {
  const warnings = detectCalibrationWarnings({
    name: "skills",
    score: 20,
    max: 40,
    evidence: [
      { excerpt: "TypeScript", source: "skills", relevance: "positive", contribution_points: 10 },
      { excerpt: "Kubernetes", source: "skills", relevance: "positive", contribution_points: 10 },
      { excerpt: "Go, Backstage, Bazel", source: "Job requirement › Required Skills", relevance: "neutral", contribution_points: 0 },
      { excerpt: "JavaScript, React, Node.js, AWS, Docker", source: "skills", relevance: "neutral", contribution_points: 0 },
    ],
  });
  expect(warnings).toEqual([
    { componentName: "skills", reason: "deduction_without_negative_evidence" },
  ]);
});
```

- [ ] **Step 9.3: Add round-trip test — `toDto` pipes `reasoning` for profile**

Add a new `describe("toDto / mapper round-trip")` block (or append to existing) with a focused test that constructs a fixture `ProfileScoreOutput` containing one evidence item with `reasoning: "Multi-year TypeScript matches the role's primary stack."` and asserts the response DTO carries `reasoning` verbatim.

(Use the existing fixture builder pattern in the file; if no fixtures exist, mirror the structure from another test.)

- [ ] **Step 9.4: Add round-trip test — `matchScoreToDto` pipes `reasoning`**

Same shape, for match.

- [ ] **Step 9.5: Run the new tests**

Run: `pnpm --filter @aurahire/api test -- scoring.service.spec.ts`
Expected: all new tests PASS, no existing tests regress.

- [ ] **Step 9.6: Commit**

```bash
git add apps/api/src/modules/scoring/scoring.service.spec.ts
git commit -m "test(api): cover reasoning DTO round-trip and screenshot-failure calibration warning"
```

---

## Task 10: Final verification — type-check, lint, build

- [ ] **Step 10.1: Full repo type-check**

Run: `pnpm tsc --noEmit` (from repo root)
Expected: PASS across all packages.

- [ ] **Step 10.2: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 10.3: API build**

Run: `pnpm --filter @aurahire/api build`
Expected: PASS — confirms NestJS module graph + dependency injection still resolve.

- [ ] **Step 10.4: Web build**

Run: `pnpm --filter @aurahire/web build`
Expected: PASS — confirms App Router pages render server-side without runtime errors.

- [ ] **Step 10.5: Final commit (if any verification fixes were needed)**

If steps 10.1–10.4 surfaced fixes, commit them with `chore: ...` prefix. Otherwise skip.

- [ ] **Step 10.6: Report to user**

Summarize what shipped: prompt versions bumped, schema field added, DTOs extended, EvidenceCallout updated, 6 consumers updated, calibration notice rendered on 3 breakdown surfaces, 3 new test cases. Tell the human to run `pnpm dev`, click Recompute on `/candidate/profile` and `/candidate/jobs/<id>`, and verify per-evidence reasoning sentences appear and gap items render as `negative` not `neutral`.

---

## Self-Review Notes

- **Spec coverage:** All 12 in-scope items mapped to tasks. The auxiliary `evidence_excerpts` table is intentionally untouched (out of scope per spec — it's a denormalization, not a UI source).
- **Placeholder scan:** No "TBD" or "implement later" text. Every step has explicit code.
- **Type consistency:** `reasoning` is `string` (10–280) at schema, `string | null` at DTO/web interface, `string | null | undefined` accepted at component prop level. `CalibrationWarning` is mirrored as `CalibrationWarningDto` in two NestJS DTOs and as the shared TS type in web consumers.
- **TDD nuance:** Test additions in Task 9 are after the implementation in Tasks 1–8 because the new tests verify wiring rather than driving design. The screenshot-failure test pinned in Step 9.2 codifies the regression we're preventing future drift on.
