-- =============================================================================
-- Multi-tenancy RLS rewrite — Phase 2c of the multi-tenancy overhaul
-- =============================================================================
--
-- WHAT THIS MIGRATION DOES
--   Enables Row Level Security on the eight tables that hold per-tenant data
--   and adds policies that read membership through `company_members`.
--   The matching backend refactor (apps/api/src/modules/{jobs,applications,
--   interviews,offers,scoring,bias}) lands in the same commit as this file —
--   the two halves complete the schema-level cutover.
--
--   Tables covered:
--     1. jobs                — company_id direct
--     2. applications        — via jobs.company_id JOIN
--     3. match_scores        — via jobs.company_id JOIN
--     4. interviews          — via applications → jobs.company_id JOIN
--     5. offers              — via applications → jobs.company_id JOIN
--     6. scoring_config      — global (single active config); read open to all
--                              authenticated users; writes admin-only
--     7. bias_flags          — via jobs.company_id JOIN
--     8. audit_logs          — admin sees all; company members see rows
--                              tagged to their tenant
--
-- WHY THIS DESIGN
--   The backend already runs through `ActiveCompanyGuard` (registered in
--   `app.module.ts` Phase 2c). RLS exists as a third defense layer behind
--   the guard + service-layer scope checks. Service-role connections
--   bypass RLS entirely, so the NestJS backend (which uses the service
--   role) is not affected by these policies — the backend decides who can
--   read what. The policies guard against:
--     - direct queries from a poorly-scoped `anon`/`authenticated` JWT
--     - future Supabase-client-side reads (e.g. realtime subscriptions)
--
-- POLICY SHAPE
--   Every per-tenant policy follows the same template:
--
--     EXISTS (
--       SELECT 1 FROM company_members cm
--       WHERE cm.company_id = <table>.company_id
--         AND cm.user_id    = auth.uid()
--         AND cm.status     = 'active'
--     )
--
--   For tables without a direct `company_id`, the lookup joins through
--   the parent (`applications` → `jobs`, `match_scores` → `jobs`,
--   `interviews`/`offers` → `applications` → `jobs`).
--
-- ADMIN BYPASS
--   `audit_logs` mixes admin (cross-tenant) reads with member (per-tenant)
--   reads, so its SELECT policy ORs the two together. For the other
--   tables, admin reads happen through the backend's service-role
--   connection — no in-policy admin OR is needed.
--
-- PRIOR STATE
--   `0000_initial.sql` did not enable RLS on these tables (the backend
--   relied on service-role connections + service-layer scope checks).
--   This migration is therefore additive — there are no `recruiter_id =
--   auth.uid()` policies to drop. The DROP POLICY statements below are
--   defensive (IF EXISTS) so re-running the migration is idempotent.
--
-- DEPENDS ON
--   - `0003_multi_tenancy.sql` (creates `company_members` and adds
--     `audit_logs.company_id`). Apply this migration AFTER that one.
--
-- WARNING
--   Run inside the single transaction below; partial application would
--   leave RLS enabled with incomplete policies.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. jobs — company_id direct
-- -----------------------------------------------------------------------------

ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_recruiter_select"       ON "jobs";
DROP POLICY IF EXISTS "jobs_recruiter_insert"       ON "jobs";
DROP POLICY IF EXISTS "jobs_recruiter_update"       ON "jobs";
DROP POLICY IF EXISTS "jobs_recruiter_delete"       ON "jobs";
DROP POLICY IF EXISTS "jobs_company_member_select"  ON "jobs";
DROP POLICY IF EXISTS "jobs_company_member_insert"  ON "jobs";
DROP POLICY IF EXISTS "jobs_company_member_update"  ON "jobs";
DROP POLICY IF EXISTS "jobs_company_member_delete"  ON "jobs";
DROP POLICY IF EXISTS "jobs_public_published_read"  ON "jobs";

-- Public read of published jobs — candidates browse without authentication
-- against the homepage and /jobs index. RLS is bypassed by service role
-- anyway, but this policy lets a future client-side direct read work too.
CREATE POLICY "jobs_public_published_read" ON "jobs"
  FOR SELECT
  TO authenticated, anon
  USING ("status" = 'published');

CREATE POLICY "jobs_company_member_select" ON "jobs"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "company_members" cm
      WHERE cm."company_id" = "jobs"."company_id"
        AND cm."user_id"    = auth.uid()
        AND cm."status"     = 'active'
    )
  );

CREATE POLICY "jobs_company_member_insert" ON "jobs"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "company_members" cm
      WHERE cm."company_id" = "jobs"."company_id"
        AND cm."user_id"    = auth.uid()
        AND cm."status"     = 'active'
    )
  );

CREATE POLICY "jobs_company_member_update" ON "jobs"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "company_members" cm
      WHERE cm."company_id" = "jobs"."company_id"
        AND cm."user_id"    = auth.uid()
        AND cm."status"     = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "company_members" cm
      WHERE cm."company_id" = "jobs"."company_id"
        AND cm."user_id"    = auth.uid()
        AND cm."status"     = 'active'
    )
  );

CREATE POLICY "jobs_company_member_delete" ON "jobs"
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "company_members" cm
      WHERE cm."company_id" = "jobs"."company_id"
        AND cm."user_id"    = auth.uid()
        AND cm."status"     = 'active'
    )
  );

-- -----------------------------------------------------------------------------
-- 2. applications — company access via jobs.company_id JOIN
--    Plus candidate-self access for "my applications" reads/writes.
-- -----------------------------------------------------------------------------

ALTER TABLE "applications" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_recruiter_select"      ON "applications";
DROP POLICY IF EXISTS "applications_recruiter_update"      ON "applications";
DROP POLICY IF EXISTS "applications_candidate_self"        ON "applications";
DROP POLICY IF EXISTS "applications_company_member_select" ON "applications";
DROP POLICY IF EXISTS "applications_company_member_update" ON "applications";
DROP POLICY IF EXISTS "applications_candidate_select"      ON "applications";
DROP POLICY IF EXISTS "applications_candidate_insert"      ON "applications";
DROP POLICY IF EXISTS "applications_candidate_update"      ON "applications";

CREATE POLICY "applications_candidate_select" ON "applications"
  FOR SELECT
  TO authenticated
  USING ("candidate_id" = auth.uid());

CREATE POLICY "applications_candidate_insert" ON "applications"
  FOR INSERT
  TO authenticated
  WITH CHECK ("candidate_id" = auth.uid());

CREATE POLICY "applications_candidate_update" ON "applications"
  FOR UPDATE
  TO authenticated
  USING ("candidate_id" = auth.uid())
  WITH CHECK ("candidate_id" = auth.uid());

CREATE POLICY "applications_company_member_select" ON "applications"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM "jobs" j
        JOIN "company_members" cm
          ON cm."company_id" = j."company_id"
      WHERE j."id"     = "applications"."job_id"
        AND cm."user_id" = auth.uid()
        AND cm."status"  = 'active'
    )
  );

CREATE POLICY "applications_company_member_update" ON "applications"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM "jobs" j
        JOIN "company_members" cm
          ON cm."company_id" = j."company_id"
      WHERE j."id"     = "applications"."job_id"
        AND cm."user_id" = auth.uid()
        AND cm."status"  = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM "jobs" j
        JOIN "company_members" cm
          ON cm."company_id" = j."company_id"
      WHERE j."id"     = "applications"."job_id"
        AND cm."user_id" = auth.uid()
        AND cm."status"  = 'active'
    )
  );

-- -----------------------------------------------------------------------------
-- 3. match_scores — via jobs.company_id JOIN
--    Plus candidate-self read for "my match scores".
-- -----------------------------------------------------------------------------

ALTER TABLE "match_scores" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_scores_recruiter_select"      ON "match_scores";
DROP POLICY IF EXISTS "match_scores_candidate_select"      ON "match_scores";
DROP POLICY IF EXISTS "match_scores_company_member_select" ON "match_scores";

CREATE POLICY "match_scores_candidate_select" ON "match_scores"
  FOR SELECT
  TO authenticated
  USING ("candidate_id" = auth.uid());

CREATE POLICY "match_scores_company_member_select" ON "match_scores"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM "jobs" j
        JOIN "company_members" cm
          ON cm."company_id" = j."company_id"
      WHERE j."id"     = "match_scores"."job_id"
        AND cm."user_id" = auth.uid()
        AND cm."status"  = 'active'
    )
  );

-- -----------------------------------------------------------------------------
-- 4. interviews — via applications → jobs.company_id JOIN
--    Plus candidate-self read for "my interviews".
-- -----------------------------------------------------------------------------

ALTER TABLE "interviews" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "interviews_recruiter_select"      ON "interviews";
DROP POLICY IF EXISTS "interviews_recruiter_modify"      ON "interviews";
DROP POLICY IF EXISTS "interviews_candidate_select"      ON "interviews";
DROP POLICY IF EXISTS "interviews_company_member_select" ON "interviews";
DROP POLICY IF EXISTS "interviews_company_member_modify" ON "interviews";

CREATE POLICY "interviews_candidate_select" ON "interviews"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "applications" a
      WHERE a."id" = "interviews"."application_id"
        AND a."candidate_id" = auth.uid()
    )
  );

CREATE POLICY "interviews_company_member_select" ON "interviews"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM "applications" a
        JOIN "jobs" j ON j."id" = a."job_id"
        JOIN "company_members" cm ON cm."company_id" = j."company_id"
      WHERE a."id" = "interviews"."application_id"
        AND cm."user_id" = auth.uid()
        AND cm."status"  = 'active'
    )
  );

CREATE POLICY "interviews_company_member_modify" ON "interviews"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM "applications" a
        JOIN "jobs" j ON j."id" = a."job_id"
        JOIN "company_members" cm ON cm."company_id" = j."company_id"
      WHERE a."id" = "interviews"."application_id"
        AND cm."user_id" = auth.uid()
        AND cm."status"  = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM "applications" a
        JOIN "jobs" j ON j."id" = a."job_id"
        JOIN "company_members" cm ON cm."company_id" = j."company_id"
      WHERE a."id" = "interviews"."application_id"
        AND cm."user_id" = auth.uid()
        AND cm."status"  = 'active'
    )
  );

-- -----------------------------------------------------------------------------
-- 5. offers — via applications → jobs.company_id JOIN
--    Plus candidate-self read+update for accept/decline flows.
-- -----------------------------------------------------------------------------

ALTER TABLE "offers" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offers_recruiter_select"      ON "offers";
DROP POLICY IF EXISTS "offers_recruiter_modify"      ON "offers";
DROP POLICY IF EXISTS "offers_candidate_select"      ON "offers";
DROP POLICY IF EXISTS "offers_candidate_update"      ON "offers";
DROP POLICY IF EXISTS "offers_company_member_select" ON "offers";
DROP POLICY IF EXISTS "offers_company_member_modify" ON "offers";

CREATE POLICY "offers_candidate_select" ON "offers"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "applications" a
      WHERE a."id" = "offers"."application_id"
        AND a."candidate_id" = auth.uid()
    )
  );

CREATE POLICY "offers_candidate_update" ON "offers"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "applications" a
      WHERE a."id" = "offers"."application_id"
        AND a."candidate_id" = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "applications" a
      WHERE a."id" = "offers"."application_id"
        AND a."candidate_id" = auth.uid()
    )
  );

CREATE POLICY "offers_company_member_select" ON "offers"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM "applications" a
        JOIN "jobs" j ON j."id" = a."job_id"
        JOIN "company_members" cm ON cm."company_id" = j."company_id"
      WHERE a."id" = "offers"."application_id"
        AND cm."user_id" = auth.uid()
        AND cm."status"  = 'active'
    )
  );

CREATE POLICY "offers_company_member_modify" ON "offers"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM "applications" a
        JOIN "jobs" j ON j."id" = a."job_id"
        JOIN "company_members" cm ON cm."company_id" = j."company_id"
      WHERE a."id" = "offers"."application_id"
        AND cm."user_id" = auth.uid()
        AND cm."status"  = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM "applications" a
        JOIN "jobs" j ON j."id" = a."job_id"
        JOIN "company_members" cm ON cm."company_id" = j."company_id"
      WHERE a."id" = "offers"."application_id"
        AND cm."user_id" = auth.uid()
        AND cm."status"  = 'active'
    )
  );

-- -----------------------------------------------------------------------------
-- 6. scoring_config — global, single active row.
--    Read is open to any authenticated user (frontend fetches active config
--    to render Score Ring weight breakdowns). Writes are admin-only and
--    happen via the service-role connection from the admin module.
-- -----------------------------------------------------------------------------

ALTER TABLE "scoring_config" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scoring_config_select_authenticated" ON "scoring_config";
DROP POLICY IF EXISTS "scoring_config_admin_modify"         ON "scoring_config";

CREATE POLICY "scoring_config_select_authenticated" ON "scoring_config"
  FOR SELECT
  TO authenticated
  USING (true);

-- Writes: admin role only. The admin role is held in profiles.role; the
-- service-role backend bypasses RLS, so this policy only matters if a
-- direct authenticated client ever tries to update scoring_config.
CREATE POLICY "scoring_config_admin_modify" ON "scoring_config"
  FOR ALL
  TO authenticated
  USING (
    (SELECT "role" FROM "profiles" WHERE "id" = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT "role" FROM "profiles" WHERE "id" = auth.uid()) = 'admin'
  );

-- -----------------------------------------------------------------------------
-- 7. bias_flags — via jobs.company_id JOIN
-- -----------------------------------------------------------------------------

ALTER TABLE "bias_flags" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bias_flags_recruiter_select"      ON "bias_flags";
DROP POLICY IF EXISTS "bias_flags_recruiter_modify"      ON "bias_flags";
DROP POLICY IF EXISTS "bias_flags_company_member_select" ON "bias_flags";
DROP POLICY IF EXISTS "bias_flags_company_member_modify" ON "bias_flags";

CREATE POLICY "bias_flags_company_member_select" ON "bias_flags"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM "jobs" j
        JOIN "company_members" cm
          ON cm."company_id" = j."company_id"
      WHERE j."id"     = "bias_flags"."job_id"
        AND cm."user_id" = auth.uid()
        AND cm."status"  = 'active'
    )
  );

CREATE POLICY "bias_flags_company_member_modify" ON "bias_flags"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM "jobs" j
        JOIN "company_members" cm
          ON cm."company_id" = j."company_id"
      WHERE j."id"     = "bias_flags"."job_id"
        AND cm."user_id" = auth.uid()
        AND cm."status"  = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM "jobs" j
        JOIN "company_members" cm
          ON cm."company_id" = j."company_id"
      WHERE j."id"     = "bias_flags"."job_id"
        AND cm."user_id" = auth.uid()
        AND cm."status"  = 'active'
    )
  );

-- -----------------------------------------------------------------------------
-- 8. audit_logs — admin sees all; company members see rows tagged to their
--    tenant. Writes always come from the service-role backend; no in-RLS
--    write policy beyond the default deny.
-- -----------------------------------------------------------------------------

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_admin_only"                 ON "audit_logs";
DROP POLICY IF EXISTS "audit_logs_admin_or_company_member"    ON "audit_logs";

CREATE POLICY "audit_logs_admin_or_company_member" ON "audit_logs"
  FOR SELECT
  TO authenticated
  USING (
    -- admin role bypass: see every row in every tenant
    (SELECT "role" FROM "profiles" WHERE "id" = auth.uid()) = 'admin'
    OR
    -- company-member bypass: see rows tagged to a tenant the caller
    -- belongs to. Rows with NULL company_id are admin/system actions
    -- that are NOT exposed to company members through RLS.
    (
      "audit_logs"."company_id" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "company_members" cm
        WHERE cm."company_id" = "audit_logs"."company_id"
          AND cm."user_id"    = auth.uid()
          AND cm."status"     = 'active'
      )
    )
  );

COMMIT;
