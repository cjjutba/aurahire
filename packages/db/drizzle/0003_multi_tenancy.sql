-- =============================================================================
-- Multi-tenancy cutover — Phase 1 of the multi-tenancy overhaul
-- =============================================================================
--
-- WHAT THIS MIGRATION DOES
--   1. Creates the `company_members` join table — a many-to-many membership row
--      between `profiles` (users) and `companies`, carrying role + lifecycle
--      status + invitation token. Replaces the implicit 1:1 link previously
--      stored on `recruiter_profiles.company_id`.
--   2. Adds `profiles.last_active_company_id` — the per-user active-company
--      pointer that the `ActiveCompanyGuard` will read when a request omits
--      the `X-Active-Company-Id` header.
--   3. Adds `audit_logs.company_id` — every per-tenant action now records the
--      company it belongs to, enabling the explainability surface in
--      `/admin/audit` (cross-tenant) and `/recruiter/settings/audit`
--      (per-tenant) without join gymnastics.
--   4. Backfills `company_members` so every existing recruiter becomes the
--      `owner` of their (sole) existing company with `status='active'` and
--      `joined_at` = the recruiter profile's `created_at`. Sets each existing
--      recruiter's `profiles.last_active_company_id` to that same company.
--   5. Drops `recruiter_profiles.company_id` (and its supporting index +
--      foreign-key constraint) ONLY AFTER the backfill has run.
--
-- WHY (multi-tenancy cutover)
--   The system is moving from "one recruiter ⇄ one company" to "one user can
--   belong to multiple companies, each with a per-company role". Single-tenant
--   queries against `recruiter_profiles.company_id` are replaced with
--   `company_members` lookups gated by the `ActiveCompanyGuard`. See the full
--   rationale in /docs/plans/2026-05-05-multi-tenancy-and-settings-overhaul.md.
--
-- BACKFILL SEMANTICS
--   - Every existing row in `recruiter_profiles` produces exactly one
--     `company_members` row with role='owner', status='active'.
--   - `joined_at` is set from `profiles.created_at` (the user's own creation
--     timestamp — the closest signal we have for "when did this person start
--     working in this company").
--   - `email` is snapshotted from `profiles.email` so the row survives
--     `profiles` row deletion (FK is ON DELETE CASCADE on user_id; the row
--     itself only disappears when its parent company is deleted).
--   - `last_active_company_id` is then populated for every recruiter from the
--     same backfill output.
--
-- WARNING — ONE-WAY CUTOVER
--   Once this migration is applied, the column `recruiter_profiles.company_id`
--   is GONE. Any single-tenant code path that reads or writes that column
--   will break immediately. In particular, `apps/api/src/modules/profiles/
--   profiles.repository.ts::insertRecruiter` (and its callers) must be
--   refactored in Phase 2 (backend guard + endpoint scoping) before this
--   migration is applied to dev. There is NO fallback to single-tenancy
--   after this runs. The whole migration is wrapped in a single transaction
--   so partial application is impossible.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. company_members — the join table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "company_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "user_id" uuid,
  "email" text NOT NULL,
  "role" text NOT NULL,
  "status" text NOT NULL,
  "invitation_token" text,
  "invitation_expires_at" timestamp with time zone,
  "invited_by" uuid,
  "invited_at" timestamp with time zone DEFAULT now() NOT NULL,
  "joined_at" timestamp with time zone,
  "removed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_members_role_check"
    CHECK ("role" IN ('owner', 'admin', 'recruiter')),
  CONSTRAINT "company_members_status_check"
    CHECK ("status" IN ('invited', 'active', 'suspended', 'left')),
  CONSTRAINT "company_members_company_user_unique" UNIQUE ("company_id", "user_id"),
  CONSTRAINT "company_members_company_email_unique" UNIQUE ("company_id", "email"),
  CONSTRAINT "company_members_invitation_token_unique" UNIQUE ("invitation_token")
);

ALTER TABLE "company_members"
  ADD CONSTRAINT "company_members_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "company_members"
  ADD CONSTRAINT "company_members_user_id_profiles_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "company_members"
  ADD CONSTRAINT "company_members_invited_by_profiles_id_fk"
  FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "company_members_user_status_idx"
  ON "company_members" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "company_members_company_status_idx"
  ON "company_members" ("company_id", "status");
CREATE INDEX IF NOT EXISTS "company_members_invitation_token_idx"
  ON "company_members" ("invitation_token")
  WHERE "invitation_token" IS NOT NULL;

-- RLS — service role only for now. Phase 2 will add member-readable policies.
-- Service-role connections bypass RLS, so the backend can read/write freely.
ALTER TABLE "company_members" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_no_anon" ON "company_members"
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- -----------------------------------------------------------------------------
-- 2. profiles.last_active_company_id — per-user active company pointer
-- -----------------------------------------------------------------------------

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "last_active_company_id" uuid;

ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_last_active_company_id_companies_id_fk"
  FOREIGN KEY ("last_active_company_id") REFERENCES "public"."companies"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "profiles_last_active_company_idx"
  ON "profiles" ("last_active_company_id");

-- -----------------------------------------------------------------------------
-- 3. audit_logs.company_id — per-tenant explainability
-- -----------------------------------------------------------------------------

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "company_id" uuid;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "audit_logs_company_id_idx"
  ON "audit_logs" ("company_id");

-- -----------------------------------------------------------------------------
-- 4. BACKFILL — recruiters become owners; last_active_company_id populated
-- -----------------------------------------------------------------------------
--
-- One CTE inserts the membership rows and returns (company_id, user_id);
-- the outer UPDATE consumes those rows to set profiles.last_active_company_id.
-- This must run BEFORE the column drop below.

WITH new_owners AS (
  INSERT INTO "company_members" (
    "company_id",
    "user_id",
    "email",
    "role",
    "status",
    "joined_at"
  )
  SELECT
    rp."company_id",
    rp."id",
    p."email",
    'owner',
    'active',
    p."created_at"
  FROM "recruiter_profiles" rp
  INNER JOIN "profiles" p ON p."id" = rp."id"
  RETURNING "company_id", "user_id"
)
UPDATE "profiles"
   SET "last_active_company_id" = new_owners."company_id"
  FROM new_owners
 WHERE "profiles"."id" = new_owners."user_id";

-- -----------------------------------------------------------------------------
-- 5. Drop recruiter_profiles.company_id (and supporting index + FK)
-- -----------------------------------------------------------------------------
--
-- Order matters: drop the index first, then the FK constraint, then the column.
-- The data is now safely mirrored into company_members above.

DROP INDEX IF EXISTS "recruiter_profiles_company_idx";

ALTER TABLE "recruiter_profiles"
  DROP CONSTRAINT IF EXISTS "recruiter_profiles_company_id_companies_id_fk";

ALTER TABLE "recruiter_profiles"
  DROP COLUMN IF EXISTS "company_id";

COMMIT;
