-- 0017_drop_rls.sql
-- Re-platform to Neon: remove the Supabase auth.uid()-based RLS layer.
--
-- On Neon, auth.uid() does not exist, and all DB access is backend-only via the
-- service connection — so the NestJS guards (Supabase/Clerk Auth + Roles +
-- ActiveCompany) are the authoritative enforcement (they always were; RLS was a
-- defense-in-depth third layer that only protected hypothetical direct client
-- connections, which this architecture never uses).
--
-- Drops every policy, disables RLS on all public tables, and removes the
-- auth.uid() compatibility stub that scripts/migrate.ts installs so the
-- historical policy migrations could apply on Neon.

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

DO $$
DECLARE tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', tbl.tablename);
  END LOOP;
END $$;

DROP SCHEMA IF EXISTS auth CASCADE;
