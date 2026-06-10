-- =============================================================================
-- 0010_proactive_system.sql - schema additions for the proactive-system slice.
-- =============================================================================
--
-- Phase 1, Task 1 of the 2026-05-08 "Proactive System" plan.
-- Plan:  docs/superpowers/plans/2026-05-08-proactive-system.md
-- Spec:  docs/superpowers/specs/2026-05-08-onboarding-autoscore-and-buttonless-match-design.md (§G)
--
-- WHAT THIS MIGRATION DOES
--   1. Extends the match_score_previews.source CHECK constraint to allow the
--      new "candidate_view" value (on-view auto-compute path, daily-capped).
--   2. Adds profile_scores.stale_at + a partial index for "current score
--      per candidate" lookups. NULL = current; non-NULL = needs recompute.
--   3. Adds the partial inbox/archive indexes the notifications popover
--      relies on. NOTE: the notifications table already has `dismissed_at`
--      with the same semantics the spec calls `archived_at`; we reuse the
--      existing column rather than add a duplicate. The indexes therefore
--      key on `dismissed_at` and the controller will treat dismiss = archive.
--   4. Adds interviews.feedback_reminder_sent_at - drives the periodic
--      post-interview feedback reminder cron added by this slice
--      (distinct from the legacy `feedback_due_notified_at`).
--   5. Adds jobs.archived_reason - lets audit logs distinguish manual
--      archive from cron-driven (e.g. deadline_passed) archive.
--
-- INVARIANTS PRESERVED
--   * No data is dropped or rewritten.
--   * All ALTERs use IF NOT EXISTS / DROP IF EXISTS so the migration is
--     idempotent and safe to apply against partially-migrated environments.
--   * Existing previews keep their `source` value; the constraint is only
--     widened to admit a new value.
-- =============================================================================

-- 1. Match preview source - widen the CHECK constraint (this column is a
--    text + CHECK, NOT a postgres enum type, so we drop and recreate the
--    constraint rather than ALTER TYPE).
ALTER TABLE public.match_score_previews
  DROP CONSTRAINT IF EXISTS match_score_previews_source_check;

ALTER TABLE public.match_score_previews
  ADD CONSTRAINT match_score_previews_source_check
  CHECK (source IN ('system', 'candidate', 'candidate_view'));

-- 2. Profile score staleness signal.
ALTER TABLE public.profile_scores
  ADD COLUMN IF NOT EXISTS stale_at timestamptz;

-- Partial index for "fetch the candidate's current Profile Score".
-- Rationale: keys on (candidate_id, created_at DESC) WHERE stale_at IS NULL
-- so the dashboard can fetch the latest non-stale score in one index scan.
-- (Spec §G mentions `computed_at`; this table's authoritative timestamp is
-- `created_at` - the column-of-record for "when the score landed".)
CREATE INDEX IF NOT EXISTS idx_profile_scores_candidate_current
  ON public.profile_scores (candidate_id, created_at DESC)
  WHERE stale_at IS NULL;

-- 3. Notifications inbox / archive partial indexes.
--    Reusing the existing `dismissed_at` column as the archive signal.
CREATE INDEX IF NOT EXISTS idx_notifications_user_inbox
  ON public.notifications (user_id, created_at DESC)
  WHERE dismissed_at IS NULL AND read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_archive
  ON public.notifications (user_id, dismissed_at DESC)
  WHERE dismissed_at IS NOT NULL;

-- 4. Interview feedback reminder timestamp (cron-managed).
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS feedback_reminder_sent_at timestamptz;

-- 5. Job archive reason (manual vs deadline_passed vs other).
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS archived_reason text;
