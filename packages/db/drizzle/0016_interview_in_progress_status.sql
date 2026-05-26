-- 0016_interview_in_progress_status.sql
-- Adds the "in_progress" interview status (May 2026 panel revision).
--
-- DDL IS REQUIRED. Although Drizzle treats interviews.status as plain
-- `text` and enforces the enum at write time on the TS side, there is
-- ALSO a Postgres CHECK constraint installed by 0009_interview_flow_v2
-- that whitelists the old five values. Without dropping and re-adding
-- the constraint, every cron run that tries to flip status to
-- in_progress fails with `interviews_status_check`.
--
-- This migration:
--   1. Drops the existing CHECK constraint.
--   2. Re-adds it with the new value included.
--
-- Idempotent: DROP IF EXISTS handles re-runs.
--
-- Behaviour change accompanying this enum value (see
-- apps/api/src/cron/interview-start.cron.ts +
-- apps/api/src/cron/interview-autocomplete.cron.ts):
--
--   * interview-start cron (every minute, new):
--       scheduled → in_progress when scheduledAt <= now()
--   * interview-autocomplete cron (every minute, was hourly):
--       in_progress | scheduled → completed when scheduledAt +
--       durationMinutes + 15-minute grace <= now()
--
-- Recruiters can manually mark complete from either scheduled or
-- in_progress, so the cron is the safety net rather than the primary
-- transition path.

ALTER TABLE interviews
  DROP CONSTRAINT IF EXISTS interviews_status_check;

ALTER TABLE interviews
  ADD CONSTRAINT interviews_status_check
  CHECK (
    status IN (
      'scheduled',
      'in_progress',
      'completed',
      'cancelled',
      'no-show',
      'rescheduled'
    )
  );
