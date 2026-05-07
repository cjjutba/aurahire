-- =============================================================================
-- Notifications system — in-app bell, /notifications page, email + digest.
-- =============================================================================
--
-- WHAT THIS MIGRATION DOES
--   Creates `notifications` and `notification_preferences` tables that power
--   the cross-portal notification system, plus three deduplication-flag
--   columns on existing tables (`interviews.reminder_sent_at`,
--   `interviews.feedback_due_notified_at`, `offers.expiry_reminder_sent_at`)
--   used by the new hourly cron jobs to avoid double-emitting reminders.
--   Enables RLS on both new tables and adds owner-scoped policies.
--
-- WHY
--   1. AuraHire today has zero user-facing notification surface — applications
--      change status, interviews schedule, offers send, bias flags raise, and
--      users never know unless they refresh the right page. Email infra
--      exists but is wired to nothing. This migration is the foundation.
--   2. Notifications are ephemeral; audit_logs is the immortal record. Daily
--      retention cron deletes notification rows older than 90 days, so the
--      `created_at` index is sized for that scan.
--   3. Per-event-type Instant/Digest/Off preferences live in a separate
--      table so default modes apply to events the user has never explicitly
--      configured (sparse-by-design — missing rows = use code defaults).
--
-- KEY SHAPE
--   * `notifications` is partitioned naturally by user_id; the
--     (user_id, read_at, created_at) composite index drives both the
--     unread-count badge and the Unread tab.
--   * `digest_pending` is a partial index — `WHERE digest_pending = true`
--     — sized for the daily digest cron's batch scan.
--   * `dismissed_at` is a soft-delete; rows survive until the retention
--     cron's 90-day cutoff so a user's "remove from list" doesn't lose
--     forensic context immediately.
--   * `notification_preferences` uniqueness on (user_id, event_type) is
--     enforced via UNIQUE INDEX (not table constraint) for upsert support
--     via ON CONFLICT.
--   * RLS lets users read/update/delete only their own rows; backend
--     writes via service role bypassing RLS for the create/fanout path.
--
-- INDEXES (notifications)
--   * (user_id, read_at, created_at) — unread-count + Unread tab
--   * (user_id, created_at)          — All tab
--   * (created_at)                   — retention cron scan
--   * (digest_pending) PARTIAL       — digest cron scan
--
-- INDEXES (notification_preferences)
--   * UNIQUE (user_id, event_type)   — natural key + ON CONFLICT support

CREATE TABLE notifications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type      text        NOT NULL,
  scope           text        NOT NULL DEFAULT 'personal',
  title           text        NOT NULL,
  body            text        NOT NULL,
  link            text,
  entity_type     text,
  entity_id       uuid,
  actor_id        uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  metadata        jsonb,
  read_at         timestamptz,
  dismissed_at    timestamptz,
  digest_pending  boolean     NOT NULL DEFAULT false,
  email_sent_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx
  ON notifications (user_id, read_at, created_at);

CREATE INDEX notifications_user_created_idx
  ON notifications (user_id, created_at);

CREATE INDEX notifications_created_at_idx
  ON notifications (created_at);

CREATE INDEX notifications_digest_pending_idx
  ON notifications (digest_pending) WHERE digest_pending = true;


CREATE TABLE notification_preferences (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type  text        NOT NULL,
  mode        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX notification_prefs_user_event_uniq
  ON notification_preferences (user_id, event_type);


-- =============================================================================
-- Column additions for cron deduplication flags
-- =============================================================================

ALTER TABLE interviews ADD COLUMN reminder_sent_at timestamptz;
ALTER TABLE interviews ADD COLUMN feedback_due_notified_at timestamptz;
ALTER TABLE offers ADD COLUMN expiry_reminder_sent_at timestamptz;


-- =============================================================================
-- RLS
-- =============================================================================
-- Users: see/update/delete only their own rows.
-- Backend (service role): bypasses RLS for create/update/fanout operations.

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_delete_own"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);


ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_prefs_select_own"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notification_prefs_insert_own"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notification_prefs_update_own"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notification_prefs_delete_own"
  ON notification_preferences FOR DELETE
  USING (auth.uid() = user_id);
