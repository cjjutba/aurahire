-- =============================================================================
-- Async match scoring - score_status lifecycle column on applications.
-- =============================================================================
--
-- WHAT THIS MIGRATION DOES
--   Adds applications.score_status (computing | completed | failed) so the
--   apply request can return immediately with status 'computing' while a
--   BullMQ worker computes the AI match score in the background. UI uses this
--   column to show AiShimmer vs the rendered score.
--
-- WHY
--   POST /applications used to wait ~34 seconds for sequential redaction +
--   match scoring before responding. With the work moved to a queue, the
--   apply response drops to ~200ms; the score is delivered via the realtime
--   `application.scored` event when the worker finishes. The column exists
--   so detail-page renders that miss the live event still know the work is
--   in progress and show the right placeholder.
--
-- BACKFILL
--   Existing rows are pre-scored under the old synchronous flow, so the
--   defensible default for in-place rows is 'completed'. The column default
--   is 'computing' for new rows; this UPDATE pins existing rows that already
--   have a match_score row to 'completed'. Rows without a match_score (which
--   would only occur if a prior scoring AI call failed silently) stay at the
--   default 'computing' - they will be picked up by a future rescore pass.

ALTER TABLE applications
  ADD COLUMN score_status text NOT NULL DEFAULT 'computing'
  CHECK (score_status IN ('computing', 'completed', 'failed'));

UPDATE applications
SET score_status = 'completed'
WHERE id IN (SELECT application_id FROM match_scores);

CREATE INDEX applications_score_status_idx
  ON applications (score_status);
