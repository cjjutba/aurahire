// Score band thresholds — match defaults in scoring_config DB row.
// Admin can tune these via /admin/ai-config; runtime always reads from DB.
// These constants are the fallback / default values.

export const STRONG_MATCH_THRESHOLD = 70;
export const PARTIAL_MATCH_THRESHOLD = 40;
// 0–39 = "limited"

export const DEFAULT_MATCH_WEIGHTS = {
  skills: 40,
  experience: 35,
  education: 15,
  cultural_fit: 10,
} as const;

export const DEFAULT_PROFILE_WEIGHTS = {
  completeness: 25,
  skill_depth: 30,
  experience_clarity: 30,
  education_quality: 15,
} as const;

export const SCORE_BAND_LABELS = {
  strong: "Strong Match",
  partial: "Partial Match",
  limited: "Limited Match",
} as const;
