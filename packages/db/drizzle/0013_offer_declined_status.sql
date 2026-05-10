-- 0013_offer_declined_status.sql
-- Adds the "offer_declined" application status to the TypeScript enum.
-- No DDL is required: applications.status is plain `text`; Drizzle enforces
-- the enum at write time. This file exists only to record the schema bump.

SELECT 1; -- no-op
