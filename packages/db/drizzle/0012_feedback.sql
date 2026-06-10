-- =============================================================================
-- In-app feedback - sidebar popover "Send feedback" → admin inbox.
-- =============================================================================
--
-- WHAT THIS MIGRATION DOES
--   Creates the `feedback` table that backs the in-app feedback flow shipped
--   with this slice. Replaces the prior mailto: link (which dead-ended for
--   users without a configured desktop mail client). Authenticated users
--   submit feedback via /api/v1/feedback; admins triage it under
--   /admin/feedback. Enables RLS and adds policies that mirror the rest of
--   the admin-only tables (audit_logs, scoring_config).
--
-- WHY
--   1. Mail-client dialogs are jarring and lossy - many users never had a
--      mail client open and the link silently failed.
--   2. Auto-captured page URL, user-agent, and submitter role + active
--      company turn raw "X is broken" reports into actionable triage.
--   3. Status workflow (new → reviewing → resolved | dismissed) lets an
--      admin work the queue from /admin/feedback the same way they triage
--      bias flags or audit entries - no separate inbox.
--
-- KEY SHAPE
--   * `submitter_id` is nullable (ON DELETE SET NULL): rows survive user
--     deletion for forensic/historical context. `submitter_email` and
--     `submitter_name` are snapshotted at insert time so the row stays
--     readable after the FK clears. `submitter_role` and `company_id` are
--     snapshotted for the same reason - a user may switch role or leave a
--     tenant after submitting feedback.
--   * `severity` is nullable and only meaningful when `type = 'bug'`. The
--     CHECK constraint enforces this invariant - non-bug rows must have
--     NULL severity, bug rows must have a non-NULL severity.
--   * `resolved_at` / `resolved_by` are set together when status moves to
--     'resolved' or 'dismissed'. Status reverts (e.g. resolved → reviewing)
--     clear them.
--   * RLS: INSERT is open to any authenticated user (with auth.uid() =
--     submitter_id); SELECT/UPDATE are admin-only. Backend writes via the
--     service role and bypasses RLS for both - the policies exist as the
--     defense-in-depth tier in case a client ever queries directly.
--
-- INDEXES
--   * (status, created_at) - the admin inbox default sort + status filter
--   * (type)               - type filter
--   * (submitter_id)       - "feedback by this user" lookups
--   * (company_id)         - tenant-scoped admin reports
--   * (created_at)         - global recency

CREATE TABLE feedback (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  submitter_email text        NOT NULL,
  submitter_name  text        NOT NULL,
  submitter_role  text        NOT NULL,
  company_id      uuid        REFERENCES companies(id) ON DELETE SET NULL,
  type            text        NOT NULL,
  severity        text,
  subject         text        NOT NULL,
  message         text        NOT NULL,
  page_url        text,
  user_agent      text,
  app_version     text,
  status          text        NOT NULL DEFAULT 'new',
  admin_note      text,
  resolved_at     timestamptz,
  resolved_by     uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT feedback_severity_only_when_bug CHECK (
    (type = 'bug' AND severity IS NOT NULL)
    OR (type <> 'bug' AND severity IS NULL)
  )
);

CREATE INDEX feedback_status_created_idx ON feedback (status, created_at);
CREATE INDEX feedback_type_idx           ON feedback (type);
CREATE INDEX feedback_submitter_idx      ON feedback (submitter_id);
CREATE INDEX feedback_company_idx        ON feedback (company_id);
CREATE INDEX feedback_created_idx        ON feedback (created_at);

-- =============================================================================
-- RLS
-- =============================================================================
-- Users may insert their own rows (auth.uid() = submitter_id).
-- Only admins may select or update rows.
-- Backend writes via service role bypass RLS for both insert + update.

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_insert_self"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = submitter_id);

CREATE POLICY "feedback_admin_select"
  ON feedback FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "feedback_admin_update"
  ON feedback FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
