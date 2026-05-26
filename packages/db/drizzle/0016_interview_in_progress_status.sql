-- 0016_interview_in_progress_status.sql
-- Adds the "in_progress" interview status to the TypeScript enum.
-- No DDL is required: interviews.status is plain `text`; Drizzle
-- enforces the enum at write time. This file records the schema bump.
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

SELECT 1; -- no-op
