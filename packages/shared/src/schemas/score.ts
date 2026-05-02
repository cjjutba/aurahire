import { z } from "zod";

// ============================================================================
// EVIDENCE (used by both profile + match score components)
// ============================================================================

export const evidenceSchema = z.object({
  excerpt: z.string(),
  source: z.string(), // e.g. "Experience › Senior Engineer at Acme"
  relevance: z.enum(["positive", "negative", "neutral"]),
});

export const matchEvidenceSchema = evidenceSchema.extend({
  contribution_points: z.number().int(),
});

// ============================================================================
// PROFILE SCORE — output of profile scoring AI call
// ============================================================================

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
// MATCH SCORE — output of match scoring AI call
// ============================================================================

export const matchComponentSchema = z.object({
  name: z.enum(["skills", "experience", "education", "cultural_fit"]),
  score: z.number().int().min(0),
  max: z.number().int(),
  weight: z.number().int(),
  explanation: z.string(),
  evidence: z.array(matchEvidenceSchema).max(5),
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
