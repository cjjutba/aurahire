-- =============================================================================
-- 0015_panel_revision_may_2026.sql
-- =============================================================================
--
-- Schema bump for the May 2026 thesis panel revision. Bundles three small DDL
-- changes that travel together so the deploy is a single atomic step.
--
-- WHAT THIS MIGRATION DOES
--
--   1. Adds `evidence_excerpts.excerpt_redacted` (nullable text).
--      A recruiter-safe variant of `excerpt_text` — names, emails, phones,
--      URLs, and company-suffix tokens are scrubbed deterministically at
--      write time by `apps/api/src/ai/redact-text-deterministic.ts`. The
--      recruiter view returns this column instead of the verbatim excerpt
--      until an interview is completed. Nullable so we don't break the
--      backfill window (historical rows are filled by
--      `apps/api/scripts/backfill-redacted-excerpts.ts`).
--
--   2. Adds `scoring_config.auto_reject_threshold` (integer, default 75).
--      Admin-tunable minimum match score for interview eligibility.
--      Applications scoring below this value are auto-rejected as soon as
--      scoring completes (sync preview promotion + async match-score
--      worker). 75 is the panel-mandated default; admins can tune it
--      via /admin/ai-config.
--
--   3. (Application-layer only) The "screening" application status is
--      removed from the TypeScript enum. `applications.status` is plain
--      text so no DDL is required, but legacy rows must be migrated
--      forward first — see `apps/api/scripts/migrate-remove-screening.ts`
--      which rewrites any `status='screening'` rows to `'applied'`.
--      That data migration MUST be run before deploying the new API,
--      otherwise the application-layer validator will reject the legacy
--      rows on read.
--
-- WHY
--
--   See the panel revision minutes (May 2026):
--     · "Remove the screening features because it is redundant."
--     · "Hide the name and other personal information of the candidate
--        except the skills."
--     · "Only applicants with a score of 75 and above should proceed to
--        the interview, while those below 75 will be automatically
--        rejected."
--
-- BACKFILL & ORDER OF OPERATIONS
--
--   Recommended deploy sequence:
--     a. Apply this DDL.
--     b. Run `pnpm --filter @aurahire/api migrate-remove-screening -- --yes`
--        to rewrite any legacy `screening` application rows.
--     c. Run `pnpm --filter @aurahire/api backfill-redacted-excerpts -- --yes`
--        to populate `excerpt_redacted` for historical evidence rows.
--     d. Roll out the API + web build.
--
-- =============================================================================

ALTER TABLE evidence_excerpts
  ADD COLUMN IF NOT EXISTS excerpt_redacted text;

ALTER TABLE scoring_config
  ADD COLUMN IF NOT EXISTS auto_reject_threshold integer NOT NULL DEFAULT 75
  CHECK (auto_reject_threshold BETWEEN 0 AND 100);
