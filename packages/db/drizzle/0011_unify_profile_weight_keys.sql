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
