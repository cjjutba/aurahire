-- 0018_clerk_identity.sql
-- Clerk re-platform (Epic 2, Story 2.1): add the Clerk identity mapping.
--
-- profiles.id was the mirrored Supabase auth.users.id; now profiles generate
-- their own uuid and map to the Clerk user via clerk_user_id (set by the Clerk
-- webhook / lazy guard upsert). The 15+ FKs that reference profiles.id are
-- unaffected — only the source of the value changes.
--
-- (auth_tokens is dropped in Story 2.5 once the auth module stops using it.)

ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
ALTER TABLE "profiles" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

DO $$ BEGIN
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_clerk_user_id_unique" UNIQUE ("clerk_user_id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
