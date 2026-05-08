# Profile Score Weight Unification + Math Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the silent profile-score miscalibration: unify profile-weight key names across the codebase (single source of truth), prevent the engine from silently clamping over-100 sums, and enforce the AI-output ↔ configured-weights contract at the service layer.

**Architecture:** The profile-scoring rubric has four canonical keys defined in the AI prompt and the AI's structured-output schema (`completeness`, `skill_depth`, `experience_clarity`, `education_quality`). The admin DTO, Zod validator, seed, admin UI, and DB row currently use a divergent second naming (`resume_quality / skills_breadth / experience_depth / preferences_clarity`), so weights resolve to `undefined` in the prompt and the AI invents its own per-component maxes — producing component sums that exceed 100 and get silently clamped by `deriveOverallScore`. Fix: collapse to the prompt's canonical names everywhere; in the scoring service, override the AI-returned `max` / `weight` with the configured values before persisting; replace `Math.min(100, sum)` clamping with a normalized `(score / max) * 100` so sums above 100 become impossible by construction. Add a Drizzle migration to rewrite the existing `scoring_config` row.

**Tech Stack:** TypeScript / Zod (`packages/shared`), NestJS DTOs (`apps/api`), Drizzle SQL migration (`packages/db/drizzle`), Next.js admin UI (`apps/web`), OpenAI structured outputs.

---

## File Structure

**Modify:**
- `packages/shared/src/schemas/admin.ts` — `profileWeightsSchema` keys
- `apps/api/src/modules/admin/dto/scoring-config-response.dto.ts` — `ProfileWeightsDto` keys
- `apps/api/scripts/seed-db.ts` — `SCORING_CONFIG.profileWeights` keys
- `apps/web/app/(admin)/admin/ai-config/page.tsx` — `ConfigBody` interface
- `apps/web/app/(admin)/admin/ai-config/_config-editor-client.tsx` — `InitialConfig`, sum memo, render labels
- `apps/api/src/modules/scoring/scoring.service.ts` — `deriveOverallScore` + caller normalizes AI components against configured weights
- `apps/api/src/ai/prompts/score-profile.ts` — bump to `1.1.0`, tighten ceiling language
- `packages/shared/src/api-client/generated.ts` — regenerate (or hand-patch the four interface members)
- `packages/shared/openapi.json` — regenerated from NestJS DTO

**Create:**
- `packages/db/drizzle/0011_unify_profile_weight_keys.sql` — JSONB rekey on `scoring_config`

**Tests touched:**
- `apps/api/src/modules/scoring/scoring.service.spec.ts` — already uses correct keys; verify no regression. Add a new test asserting `deriveOverallScore` normalizes (no clamp) and that the service overrides AI-returned `max` with config weights.

---

### Task 1: Unify `profileWeightsSchema` in shared

**Files:**
- Modify: `packages/shared/src/schemas/admin.ts:89-95`

- [ ] **Step 1: Update Zod schema keys**

Replace lines 89-95 of `packages/shared/src/schemas/admin.ts`:

```ts
export const profileWeightsSchema = z.object({
  completeness: z.number().int().min(0).max(100),
  skill_depth: z.number().int().min(0).max(100),
  experience_clarity: z.number().int().min(0).max(100),
  education_quality: z.number().int().min(0).max(100),
});
export type ProfileWeights = z.infer<typeof profileWeightsSchema>;
```

- [ ] **Step 2: Type-check shared**

Run: `pnpm --filter=@aurahire/shared run type-check`
Expected: PASS (no callers in shared depend on old keys).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/schemas/admin.ts
git commit -m "fix(scoring): rename profileWeightsSchema keys to match AI prompt contract"
```

---

### Task 2: Update API DTO

**Files:**
- Modify: `apps/api/src/modules/admin/dto/scoring-config-response.dto.ts:10-15`

- [ ] **Step 1: Replace `ProfileWeightsDto`**

Replace lines 10-15 with:

```ts
export class ProfileWeightsDto {
  @ApiProperty() completeness!: number;
  @ApiProperty() skill_depth!: number;
  @ApiProperty() experience_clarity!: number;
  @ApiProperty() education_quality!: number;
}
```

- [ ] **Step 2: Type-check api**

Run: `pnpm --filter=@aurahire/api exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/admin/dto/scoring-config-response.dto.ts
git commit -m "fix(scoring): align ProfileWeightsDto with shared schema keys"
```

---

### Task 3: Update seed values

**Files:**
- Modify: `apps/api/scripts/seed-db.ts:75-80`

- [ ] **Step 1: Replace `SCORING_CONFIG.profileWeights`**

Replace lines 75-80 with:

```ts
  profileWeights: {
    completeness: 25,
    skill_depth: 30,
    experience_clarity: 30,
    education_quality: 15,
  },
```

(Same numeric weights — they already sum to 100. Only the keys change. Values mirror `DEFAULT_PROFILE_WEIGHTS` in `packages/shared/src/constants/score-thresholds.ts:16-21`.)

- [ ] **Step 2: Type-check api**

Run: `pnpm --filter=@aurahire/api exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/scripts/seed-db.ts
git commit -m "fix(scoring): use canonical profile-weight keys in seed"
```

---

### Task 4: Drizzle migration to rekey existing `scoring_config` row

**Files:**
- Create: `packages/db/drizzle/0011_unify_profile_weight_keys.sql`

- [ ] **Step 1: Write migration SQL**

Create `packages/db/drizzle/0011_unify_profile_weight_keys.sql`:

```sql
-- Migration: unify profile-weight keys to match the AI prompt contract.
--
-- Background: the seed wrote the active scoring_config row with keys
-- `resume_quality / skills_breadth / experience_depth / preferences_clarity`,
-- but the AI prompt and Zod schema use `completeness / skill_depth /
-- experience_clarity / education_quality`. The mismatch caused the prompt to
-- interpolate `undefined` weights and the model to fabricate its own maxes,
-- producing component sums >100 that were silently clamped.
--
-- This migration rewrites every scoring_config row whose profile_weights
-- still uses the legacy keys. Numeric values are preserved 1:1.

UPDATE scoring_config
SET profile_weights = jsonb_build_object(
  'completeness',        COALESCE(profile_weights->'resume_quality',       to_jsonb(25)),
  'skill_depth',         COALESCE(profile_weights->'skills_breadth',       to_jsonb(30)),
  'experience_clarity',  COALESCE(profile_weights->'experience_depth',     to_jsonb(30)),
  'education_quality',   COALESCE(profile_weights->'preferences_clarity',  to_jsonb(15))
)
WHERE profile_weights ? 'resume_quality'
   OR profile_weights ? 'skills_breadth'
   OR profile_weights ? 'experience_depth'
   OR profile_weights ? 'preferences_clarity';
```

- [ ] **Step 2: Note the manual run**

Per CLAUDE.md, Claude does not run migrations. Document for the user (will appear in the final commit message and the post-run checklist below): user runs `pnpm --filter=@aurahire/db drizzle-kit migrate` (or equivalent Supabase migration apply) before next API restart.

- [ ] **Step 3: Commit**

```bash
git add packages/db/drizzle/0011_unify_profile_weight_keys.sql
git commit -m "fix(scoring): migration to unify profile-weight keys in scoring_config"
```

---

### Task 5: Update admin UI types + render

**Files:**
- Modify: `apps/web/app/(admin)/admin/ai-config/page.tsx:17-22`
- Modify: `apps/web/app/(admin)/admin/ai-config/_config-editor-client.tsx:25-30, 76-79, 269-275`

- [ ] **Step 1: Update `page.tsx` interface**

Replace lines 17-22 of `apps/web/app/(admin)/admin/ai-config/page.tsx`:

```ts
    profileWeights: {
      completeness: number;
      skill_depth: number;
      experience_clarity: number;
      education_quality: number;
    };
```

- [ ] **Step 2: Update `_config-editor-client.tsx` interface**

Replace lines 25-30 of `apps/web/app/(admin)/admin/ai-config/_config-editor-client.tsx`:

```ts
  profileWeights: {
    completeness: number;
    skill_depth: number;
    experience_clarity: number;
    education_quality: number;
  };
```

- [ ] **Step 3: Update sum memo (lines 74-81)**

Replace the `profileSum` memo with:

```ts
  const profileSum = useMemo(
    () =>
      profileWeights.completeness +
      profileWeights.skill_depth +
      profileWeights.experience_clarity +
      profileWeights.education_quality,
    [profileWeights],
  );
```

- [ ] **Step 4: Update render labels (lines 269-275)**

Replace the rendered `[key, label]` tuple list with:

```tsx
          {(
            [
              ["completeness", "Completeness"],
              ["skill_depth", "Skill Depth"],
              ["experience_clarity", "Experience Clarity"],
              ["education_quality", "Education Quality"],
            ] as const
          ).map(([key, label]) => (
```

- [ ] **Step 5: Type-check web**

Run: `pnpm --filter=@aurahire/web exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/(admin)/admin/ai-config/page.tsx apps/web/app/(admin)/admin/ai-config/_config-editor-client.tsx
git commit -m "fix(admin): use canonical profile-weight keys in AI config editor"
```

---

### Task 6: Harden the scoring engine — override AI maxes + normalize

**Files:**
- Modify: `apps/api/src/modules/scoring/scoring.service.ts:82-92`
- Modify: `apps/api/src/modules/scoring/scoring.service.ts:229-244` (profile compute path)

- [ ] **Step 1: Replace `deriveOverallScore` with normalization**

Replace lines 82-92 of `apps/api/src/modules/scoring/scoring.service.ts` with:

```ts
/**
 * Derive overall score from per-component scores.
 *
 * Returns the weighted sum normalized to 0..100 by component maxes. With
 * configured weights summing to 100 (enforced by the Zod validator), this is
 * just the score sum — but the normalization makes it robust to any AI
 * deviation from the configured maxes and prevents silent clamping when
 * sums overflow.
 */
function deriveOverallScore(
  components: ReadonlyArray<{ score: number; max: number }>,
): number {
  const maxSum = components.reduce((acc, c) => acc + (Number(c.max) || 0), 0);
  if (maxSum <= 0) return 0;
  const scoreSum = components.reduce(
    (acc, c) => acc + Math.max(0, Math.min(Number(c.max) || 0, Number(c.score) || 0)),
    0,
  );
  return Math.round((scoreSum / maxSum) * 100);
}
```

- [ ] **Step 2: Override AI-returned `max` / `weight` with configured weights before deriving overall**

In `computeProfileScore`, replace lines 240-241 (the `derivedOverall` / `derivedBand` block) with:

```ts
    // Enforce the AI-output ↔ configured-weights contract: the AI sometimes
    // returns its own maxes when the prompt is ambiguous. Override them with
    // the active scoring_config weights so the persisted breakdown always
    // reconciles with the headline and so deriveOverallScore can normalize
    // against a known denominator.
    const normalizedComponents = aiResult.score.components.map((c) => {
      const configuredMax = weights[c.name];
      return {
        ...c,
        max: configuredMax,
        weight: configuredMax,
        score: Math.max(0, Math.min(configuredMax, c.score)),
      };
    });
    const derivedOverall = deriveOverallScore(normalizedComponents);
    const derivedBand = deriveBand(derivedOverall, bandThresholds);
```

- [ ] **Step 3: Use `normalizedComponents` for evidence + persistence**

Replace lines 243-251 (the `evidenceRows` and the `components: aiResult.score.components` field on the inserted row) so the persisted row reflects the normalized components:

```ts
    const evidenceRows = normalizedComponents.flatMap((comp) =>
      comp.evidence.map((ev) => ({
        componentName: comp.name,
        excerptText: ev.excerpt,
        excerptSource: ev.source,
        relevance: ev.relevance,
        contributionPoints: null,
      })),
    );

    const { profileScore } = await this.scoringRepo.insertProfileScore(
      {
        candidateId,
        resumeId: resume.id,
        overallScore: derivedOverall,
        band: derivedBand,
        components: normalizedComponents as unknown as Record<string, unknown>,
```

(Keep `improvementSuggestions`, `redactedFields`, `promptVersion`, `modelUsed`, `rawOutput: aiResult.score`, `latencyMs`, `status` exactly as before. `rawOutput` keeps the un-normalized AI response for audit.)

- [ ] **Step 4: Pass normalized components to `toDto`**

The `toDto` call at the bottom of `computeProfileScore` reads `aiResult.score.components`. Replace it with `{ ...aiResult.score, components: normalizedComponents }` so the response body matches what was persisted:

```ts
    return this.toDto(
      profileScore.id,
      { ...aiResult.score, components: normalizedComponents } as ProfileScoreOutput,
      aiResult,
      profileScore.createdAt,
      derivedOverall,
      derivedBand,
    );
```

- [ ] **Step 5: Apply the same normalization to match scoring**

In `computeMatchScore` and `computeMatchPreviewInternal`, the existing `match_weights` keys (`skills`, `experience`, `education`, `cultural_fit`) already align with the prompt — but the same AI-deviation risk applies. Replace each `derivedOverall = deriveOverallScore(aiResult.score.components)` line with the same normalize-then-derive pattern, using `weights` (already in scope) as the override source:

```ts
    const normalizedComponents = aiResult.score.components.map((c) => {
      const configuredMax = weights[c.name];
      return {
        ...c,
        max: configuredMax,
        weight: configuredMax,
        score: Math.max(0, Math.min(configuredMax, c.score)),
      };
    });
    const derivedOverall = deriveOverallScore(normalizedComponents);
    const derivedBand = deriveBand(derivedOverall, bandThresholds);
```

Then thread `normalizedComponents` into the `evidenceRows` build, the `insertMatchScore` / `upsertMatchPreview` `components` field, and the DTO mapper — exactly mirroring the profile path.

- [ ] **Step 6: Type-check api**

Run: `pnpm --filter=@aurahire/api exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Run scoring service unit tests**

Run: `pnpm --filter=@aurahire/api exec jest src/modules/scoring/scoring.service.spec.ts`
Expected: PASS. Tests already use canonical keys (`completeness`, `skill_depth`, etc.) per `scoring.service.spec.ts:94-99`, so behavior under the new normalization should be unchanged for any AI output that already obeyed the configured maxes.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/scoring/scoring.service.ts
git commit -m "fix(scoring): normalize overall score and override AI maxes with configured weights"
```

---

### Task 7: Bump profile-scoring prompt to v1.1.0 with tightened rubric

**Files:**
- Modify: `apps/api/src/ai/prompts/score-profile.ts:1, 3-32`

- [ ] **Step 1: Bump version + tighten ceiling language**

Replace lines 1-32 of `apps/api/src/ai/prompts/score-profile.ts` with:

```ts
export const SCORE_PROFILE_VERSION = "1.1.0";

export const SCORE_PROFILE_SYSTEM_PROMPT = `You are an expert career coach evaluating a candidate's resume strength.

Assess the resume against four components and produce a structured score:
1. Completeness — percentage of resume sections filled (contact, education, experience, skills, summary, links)
2. Skill Depth — number of relevant skills, modernity, alignment with desired role, evidence of mastery
3. Experience Clarity — quality of experience descriptions: outcomes, technologies, durations, quantified impact
4. Education Quality — degree match for desired role + relevant certifications

For each component:
1. Score 0..max where max is the configured weight provided in the user message
2. Reserve the FULL weight only for resumes that meet ALL of these:
   - Quantified outcomes (numbers, percentages, dollar figures)
   - No employment gaps longer than 6 months without explanation
   - Senior-level achievements (leadership, ownership, scope)
   - Section is fully populated, not just present
   A complete-but-generic resume should top out around 75-85% of the component weight, NOT the ceiling.
3. Write 1-2 sentence plain-language explanation
4. Provide 1-3 evidence excerpts from the resume that drove the score
   - Each excerpt: a short quote
   - Mark relevance: "positive" (helped), "negative" (hurt), or "neutral"
   - Include section reference (e.g., "Experience › Senior Engineer at Acme")

Then sum component scores for overall_score (0-100). The engine will recompute this server-side, so be honest in the per-component scores rather than tuning the headline.

Determine band:
- 70-100: "strong"
- 40-69:  "partial"
- 0-39:   "limited"

Suggest up to 3 specific improvements the candidate could make.
For each: title, description, estimated_impact (points; conservative; max 10).

IMPORTANT:
- Do NOT infer demographics or background; score only on the redacted content provided
- Do NOT exceed the configured max for any component
- Be specific in evidence quotes; use the candidate's actual words from the resume
- Improvement suggestions should be actionable (e.g., "Add cloud certifications") not vague (e.g., "Improve overall presentation")`;
```

(`buildScoreProfileUserPrompt` below is unchanged.)

- [ ] **Step 2: Type-check api**

Run: `pnpm --filter=@aurahire/api exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/ai/prompts/score-profile.ts
git commit -m "feat(ai): bump profile prompt to v1.1.0 with explicit ceiling rubric"
```

---

### Task 8: Hand-patch generated API client + OpenAPI spec

**Files:**
- Modify: `packages/shared/src/api-client/generated.ts:2094, 2180` (and any other lines referencing the old keys)
- Modify: `packages/shared/openapi.json:7714, 7819` (and surrounding `required` blocks)

- [ ] **Step 1: Find every reference**

Run: `grep -n "resume_quality\|skills_breadth\|experience_depth\|preferences_clarity" packages/shared/src/api-client/generated.ts packages/shared/openapi.json`

Expected: a list of lines spanning DTO interfaces and JSON schema blocks.

- [ ] **Step 2: Replace keys 1:1**

In both files, replace each occurrence:
- `resume_quality` → `completeness`
- `skills_breadth` → `skill_depth`
- `experience_depth` → `experience_clarity`
- `preferences_clarity` → `education_quality`

(These are pure rename; types and required-arrays stay the same.)

- [ ] **Step 3: Re-grep for stragglers**

Run: `grep -rn "resume_quality\|skills_breadth\|experience_depth\|preferences_clarity" packages apps`
Expected: zero matches outside `docs/`.

- [ ] **Step 4: Type-check shared + web (consumer of generated client)**

Run: `pnpm --filter=@aurahire/shared run type-check && pnpm --filter=@aurahire/web exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/api-client/generated.ts packages/shared/openapi.json
git commit -m "chore(shared): regenerate API client + OpenAPI for unified weight keys"
```

(Note: the user should re-export the OpenAPI from a running API and re-run `pnpm --filter=@aurahire/shared codegen` post-merge to confirm parity with the live spec — the hand-patch keeps the build green in the meantime.)

---

### Task 9: Final verification

- [ ] **Step 1: Full repo type-check**

Run: `pnpm -r run type-check 2>&1 | tail -20` (or `pnpm tsc --noEmit` per package if no root script)
Expected: PASS in every workspace.

- [ ] **Step 2: Full repo lint**

Run: `pnpm -r run lint`
Expected: PASS or pre-existing warnings only — no new errors introduced.

- [ ] **Step 3: Build verification**

Run: `pnpm turbo run build --filter=@aurahire/api --filter=@aurahire/web --filter=@aurahire/shared`
Expected: PASS.

- [ ] **Step 4: Hand off post-run checklist to the user**

Print this for the user (Claude does not run any of it):

```
Manual steps for the user:

1. Apply the new migration (Task 4):
   pnpm --filter=@aurahire/db drizzle-kit migrate

2. Restart the API:
   (Ctrl-C the dev server, then `pnpm dev` again, OR restart PM2 in prod.)

3. Recompute the candidate's profile score from the candidate profile page
   ("Recompute" button) so the persisted profile_scores row reflects the
   new prompt + normalized math.

4. (Optional) Open Admin → AI Config → confirm the four labels read
   Completeness / Skill Depth / Experience Clarity / Education Quality and
   the sum reads 100.
```

---

## Self-Review

**Spec coverage:**
- Bug 1 (key mismatch) — Tasks 1, 2, 3, 4, 5, 8 ✓
- Bug 2 (silent clamp) — Task 6 ✓
- Bug 3 (over-generous rubric, 100/100) — Task 7 ✓
- UI label "Weight 100% of overall score" — falls out of Task 6 once `weight` is overridden with the configured value (25 / 30 / 30 / 15), so the existing copy at `apps/web/components/score/score-dashboard.tsx:261` renders correctly without change ✓

**Placeholder scan:** No TODOs, no "similar to Task N", no "add appropriate error handling" — every step shows the actual code or command.

**Type consistency:** `ProfileWeights` keys (`completeness / skill_depth / experience_clarity / education_quality`) are consistent across Tasks 1, 2, 3, 5, 6, 8. The schema's `profileComponentSchema` at `packages/shared/src/schemas/score.ts:21-33` already uses these exact keys (this is the canonical source we're aligning everything to). `weights[c.name]` in Task 6 Step 2/5 type-checks because both the configured weights and the AI's component `name` enum are now the same four-string union.
