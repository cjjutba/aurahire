-- =============================================================================
-- Match-score previews - pre-application "See my match" results.
-- =============================================================================
--
-- WHAT THIS MIGRATION DOES
--   Creates the `match_score_previews` table. A preview holds the full
--   explainable AI score (overall + per-component + evidence + provenance)
--   for a (candidate, job, resume) tuple computed BEFORE the candidate
--   applies - either explicitly via the candidate-facing "See my match"
--   button or auto-computed in the background after a resume parse.
--
-- WHY
--   1. UX: Apply becomes instant for candidates who previewed first - the
--      preview is promoted into match_scores at apply time instead of a
--      blocking 10-15s OpenAI call.
--   2. Discovery: enables a candidate "Recommended for you" feed by listing
--      the candidate's own previews ordered by score.
--   3. Audit: previews are first-class explainable scores with the same
--      provenance fields (prompt_version, model_used, latency_ms,
--      redacted_fields, raw_output) as match_scores. Bias mitigation +
--      transparency invariants are preserved.
--
-- KEY SHAPE
--   * One preview per (candidate_id, job_id, resume_id) tuple - re-running
--     for the same resume hits the existing row (UPSERT in the service).
--   * resume_id is part of the natural key so previews against an old
--     resume become "stale" automatically when a new resume is uploaded -
--     they remain valid for that historical resume but won't be promoted
--     to a future apply that uses a different resume_id.
--   * source is "candidate" (explicit click) or "system" (background
--     pre-compute on resume parse).
--   * raw_output retains the full AI payload (including the AI's holistic
--     overall_score) for audit; the engine writes a deterministic
--     overall_score = Σ component.score and re-derives the band from
--     scoring_config.band_thresholds (matches the same invariant
--     enforced for match_scores).
--
-- INDEXES
--   * Unique (candidate_id, job_id, resume_id) - natural key.
--   * (candidate_id) - list previews for one candidate (recommended feed).
--   * (candidate_id, overall_score) - order by score within a candidate.
--   * (job_id) - recruiter-side analytics (future: who previewed this job).
--   * (resume_id) - fast cleanup when a resume is replaced.

CREATE TABLE match_score_previews (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    uuid        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  job_id          uuid        NOT NULL REFERENCES jobs(id)      ON DELETE CASCADE,
  resume_id       uuid        NOT NULL REFERENCES resumes(id)   ON DELETE CASCADE,
  overall_score   integer     NOT NULL,
  band            text        NOT NULL,
  components      jsonb       NOT NULL,
  redacted_fields text[]      NOT NULL DEFAULT '{}'::text[],
  weights_used    jsonb       NOT NULL,
  prompt_version  text        NOT NULL,
  model_used      text        NOT NULL,
  raw_output      jsonb       NOT NULL,
  latency_ms      integer,
  source          text        NOT NULL DEFAULT 'candidate',
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT match_score_previews_band_check
    CHECK (band IN ('strong', 'partial', 'limited')),
  CONSTRAINT match_score_previews_source_check
    CHECK (source IN ('system', 'candidate')),
  CONSTRAINT match_score_previews_overall_range
    CHECK (overall_score >= 0 AND overall_score <= 100)
);

CREATE UNIQUE INDEX match_score_previews_candidate_job_resume_uniq
  ON match_score_previews (candidate_id, job_id, resume_id);

CREATE INDEX match_score_previews_candidate_idx
  ON match_score_previews (candidate_id);

CREATE INDEX match_score_previews_candidate_score_idx
  ON match_score_previews (candidate_id, overall_score);

CREATE INDEX match_score_previews_job_idx
  ON match_score_previews (job_id);

CREATE INDEX match_score_previews_resume_idx
  ON match_score_previews (resume_id);

-- =============================================================================
-- RLS
-- =============================================================================
-- Candidates: see only their own previews.
-- Recruiters: no access via RLS at this layer (preview previews are a
--   candidate-facing concept; recruiter-side surfacing - e.g. "candidates
--   who previewed your job" - is a future enhancement that will require
--   its own grant + service-layer scoping).
-- Service role: bypasses RLS for backend-issued queries.

ALTER TABLE match_score_previews ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_score_previews_candidate_read
  ON match_score_previews
  FOR SELECT
  USING (candidate_id = auth.uid());

CREATE POLICY match_score_previews_candidate_delete
  ON match_score_previews
  FOR DELETE
  USING (candidate_id = auth.uid());
