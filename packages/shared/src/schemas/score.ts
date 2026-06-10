import { z } from "zod";

// ============================================================================
// EVIDENCE (used by both profile + match score components)
// ============================================================================

/**
 * Evidence with no quantified contribution. Reserved for future non-scoring
 * surfaces; current profile + match scoring uses `scoredEvidenceSchema`.
 */
export const evidenceSchema = z.object({
  excerpt: z.string(),
  source: z.string(), // e.g. "Experience › Senior Engineer at Acme"
  relevance: z.enum(["positive", "negative", "neutral"]),
});

/**
 * Evidence that contributes a quantified delta to a component score.
 * `contribution_points` is a SIGNED INTEGER and a MULTIPLE OF 5 - positive when
 * the quote helped, negative when it represents a gap, 0 when neutral.
 *
 * The engine derives `component.score = clamp(sum(contribution_points), 0, max)`
 * so this field is the source of truth for a component's numeric score.
 *
 * `reasoning` is a 10-280 char sentence on every row explaining WHY this row
 * helps or hurts - surfacing per-evidence transparency the chip alone can't.
 *
 * Used by profile components (since v1.4.0) and match components (since v1.3.0).
 */
export const scoredEvidenceSchema = evidenceSchema.extend({
  contribution_points: z.number().int().multipleOf(5),
  reasoning: z.string().min(10).max(280),
});

/**
 * @deprecated Transitional alias - use `scoredEvidenceSchema`.
 * Kept so existing imports don't break in the same PR; remove in a follow-up.
 */
export const matchEvidenceSchema = scoredEvidenceSchema;

// ============================================================================
// PROFILE SCORE - output of profile scoring AI call
// ============================================================================

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

export const profileScoreSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  band: z.enum(["strong", "partial", "limited"]),
  components: z.array(profileComponentSchema),
  improvement_suggestions: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        estimated_impact: z.number().int(), // points the candidate could gain
      }),
    )
    .max(3),
});

export type ProfileComponent = z.infer<typeof profileComponentSchema>;
export type ProfileScore = z.infer<typeof profileScoreSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;

// ============================================================================
// MATCH SCORE - output of match scoring AI call
// ============================================================================

export const matchComponentSchema = z.object({
  name: z.enum(["skills", "experience", "education", "cultural_fit"]),
  score: z.number().int().min(0).multipleOf(5),
  max: z.number().int().multipleOf(5),
  weight: z.number().int().multipleOf(5),
  explanation: z.string(),
  evidence: z.array(scoredEvidenceSchema).max(6), // schema catches up to prompt v1.1.0 which already states "do not exceed 6"
});

export const matchScoreSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  band: z.enum(["strong", "partial", "limited"]),
  components: z.array(matchComponentSchema),
  summary: z.string(), // one-paragraph synthesis
  red_flags: z.array(z.string()).max(3).nullable(),
  green_flags: z.array(z.string()).max(3).nullable(),
});

export type MatchComponent = z.infer<typeof matchComponentSchema>;
export type MatchScore = z.infer<typeof matchScoreSchema>;
export type MatchEvidence = z.infer<typeof matchEvidenceSchema>;

// ============================================================================
// CALIBRATION WARNINGS - advisory signals on score quality
// ============================================================================

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
