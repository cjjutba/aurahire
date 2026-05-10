-- 0014_offer_accepted_status.sql
-- Adds the "offer_accepted" application status to the TypeScript enum.
-- No DDL: applications.status is plain `text`; Drizzle enforces the enum
-- at write time. File exists only to record the schema bump.

SELECT 1; -- no-op
