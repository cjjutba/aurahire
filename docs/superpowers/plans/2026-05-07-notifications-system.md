# Notifications System - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-portal notifications system with a sidebar bell badge (capped at `99+`), a dedicated `/[role]/notifications` page per role, and a per-event-type Instant/Digest/Off email mode preference UI - wired into the same service-layer call sites that already write `audit_logs`.

**Architecture:**

- **Backend:** Two new NestJS modules (`apps/api/src/modules/notifications/` and `notification-preferences/`). `NotificationsService.emit()` is the single fan-out: it inserts a row, consults preferences, then either enqueues an instant email job or marks the row `digest_pending = true`. One new BullMQ queue (`notification-email`) serves both instant and digest paths. Five new `@nestjs/schedule` crons: digest batch (daily 08:00 Asia/Manila), retention sweep (daily 03:00), and three 24-hour reminder crons (interview start, offer expiry, interview feedback due).
- **Frontend:** A `<NavItemBadge />` component polls `useGetNotificationsUnreadCount` every 30s (paused when blurred). A shared `<NotificationsPage role={...} />` powers three thin route files, with Unread/All tabs (admin gets a third System tab). A rewrite of `notifications-form.tsx` replaces its localStorage-only implementation with API-backed grouped categories, 3-way segmented controls, security-locked rows, and per-category restore-defaults.
- **No new dependencies.** Reuses existing React Email + Mailpit/Resend, BullMQ, `@nestjs/schedule`, Drizzle, Supabase, Orval, TanStack Query.

**Tech Stack:**

- **Backend:** NestJS 10 (Fastify), `@nestjs/schedule`, `@nestjs/bullmq`, Drizzle ORM, `@react-email/render`, Pino logger, Jest.
- **Frontend:** Next.js 16 (App Router), TanStack Query 5, react-hook-form + Zod resolver, Lucide icons, Vitest + Testing Library, Playwright (e2e gated).
- **Shared:** Zod schemas in `packages/shared/src/schemas/notifications.ts`; Orval-generated TanStack Query hooks.
- **Verification per task:** `pnpm --filter api type-check && pnpm --filter api lint`, `pnpm --filter web type-check && pnpm --filter web lint`, plus `pnpm --filter api test -- <pattern>` and `pnpm --filter web test -- <pattern>` where tests apply. Per-phase verification: `pnpm --filter api build && pnpm --filter web build` plus the manual smoke checklist (Phase 12).

**Hard rules from CLAUDE.md that govern this plan:**

- Claude does **NOT** run dev servers, Docker commands, DB mutations, deploys, or destructive/history-rewriting git commands. The human runs `pnpm dev`, applies the migration via `drizzle-kit push` or Supabase CLI, and runs the `seed-db` / `reset-db` scripts.
- `pnpm tsc --noEmit` and `pnpm lint` are the automated gates Claude runs.
- Claude does not make billed external calls; the human verifies email by reading Mailpit at `http://localhost:8025`.

---

## Spec Reference

`docs/superpowers/specs/2026-05-07-notifications-system-design.md` - locked decisions (curated event taxonomy, polling delivery, per-event Instant/Digest/Off, 99+ badge cap, 90-day retention, admin scope merged, settings UI categories), full schema, full API surface, frontend layout, error-handling posture, testing strategy, migration plan.

---

## File Structure

| Path                                                                                                   | Role                                                                                                                                                                                                                                                                                         | Touch                                |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `packages/db/src/enums.ts`                                                                             | Add `NOTIFICATION_EVENT_TYPE`, `NOTIFICATION_MODE`, `NOTIFICATION_SCOPE`                                                                                                                                                                                                                     | Modify                               |
| `packages/db/src/schema.ts`                                                                            | Add `notificationsTable`, `notificationPreferencesTable`; add `reminderSentAt`, `feedbackDueNotifiedAt` to `interviewsTable`; add `expiryReminderSentAt` to `offersTable`                                                                                                                    | Modify                               |
| `packages/db/src/relations.ts`                                                                         | Add notifications ↔ profiles relation                                                                                                                                                                                                                                                        | Modify                               |
| `supabase/migrations/<ts>_notifications.sql`                                                           | Drizzle-generated migration for the two new tables + column additions                                                                                                                                                                                                                        | Create (via drizzle-kit; human runs) |
| `supabase/migrations/<ts>_notifications_rls.sql`                                                       | RLS policies on the two new tables                                                                                                                                                                                                                                                           | Create                               |
| `packages/shared/src/schemas/notifications.ts`                                                         | Zod DTOs (list query, mark read, upsert preference, restore defaults) + types                                                                                                                                                                                                                | Create                               |
| `packages/shared/src/index.ts`                                                                         | Re-export new schemas                                                                                                                                                                                                                                                                        | Modify                               |
| `apps/api/src/modules/notifications/notifications.module.ts`                                           | Module registration                                                                                                                                                                                                                                                                          | Create                               |
| `apps/api/src/modules/notifications/notifications.controller.ts`                                       | HTTP endpoints                                                                                                                                                                                                                                                                               | Create                               |
| `apps/api/src/modules/notifications/notifications.service.ts`                                          | `emit()`, `emitMany()`, list, count, mark-read, dismiss                                                                                                                                                                                                                                      | Create                               |
| `apps/api/src/modules/notifications/notifications.repository.ts`                                       | Drizzle queries                                                                                                                                                                                                                                                                              | Create                               |
| `apps/api/src/modules/notifications/event-defaults.ts`                                                 | `DEFAULT_MODES`, `SECURITY_EVENTS`, `EVENT_CATEGORIES`, `ROLE_VISIBLE_EVENTS`                                                                                                                                                                                                                | Create                               |
| `apps/api/src/modules/notifications/queues.ts`                                                         | `NOTIFICATION_EMAIL_QUEUE` constant + job-payload types                                                                                                                                                                                                                                      | Create                               |
| `apps/api/src/modules/notifications/notification-email.processor.ts`                                   | BullMQ worker for instant + digest emails                                                                                                                                                                                                                                                    | Create                               |
| `apps/api/src/modules/notifications/templates/index.ts`                                                | `buildTitle`, `buildBody`, `buildLink`, `emailSubject`, `emailComponent`, `icon` registry                                                                                                                                                                                                    | Create                               |
| `apps/api/src/modules/notifications/templates/base-layout.tsx`                                         | Shared React Email layout                                                                                                                                                                                                                                                                    | Create                               |
| `apps/api/src/modules/notifications/templates/<event>-email.tsx` × 20                                  | One per event type                                                                                                                                                                                                                                                                           | Create                               |
| `apps/api/src/modules/notifications/templates/digest-email.tsx`                                        | Multi-event composite                                                                                                                                                                                                                                                                        | Create                               |
| `apps/api/src/modules/notifications/dto/list-notifications.dto.ts`                                     | Query DTO                                                                                                                                                                                                                                                                                    | Create                               |
| `apps/api/src/modules/notifications/__tests__/*.spec.ts`                                               | Service + repo + controller + event-defaults + templates                                                                                                                                                                                                                                     | Create                               |
| `apps/api/src/modules/notification-preferences/notification-preferences.module.ts`                     | Module registration                                                                                                                                                                                                                                                                          | Create                               |
| `apps/api/src/modules/notification-preferences/notification-preferences.controller.ts`                 | HTTP endpoints                                                                                                                                                                                                                                                                               | Create                               |
| `apps/api/src/modules/notification-preferences/notification-preferences.service.ts`                    | `getEffectiveMode`, list, upsert, restore                                                                                                                                                                                                                                                    | Create                               |
| `apps/api/src/modules/notification-preferences/dto/upsert-preference.dto.ts`                           | Body DTO                                                                                                                                                                                                                                                                                     | Create                               |
| `apps/api/src/modules/notification-preferences/dto/restore-defaults.dto.ts`                            | Body DTO                                                                                                                                                                                                                                                                                     | Create                               |
| `apps/api/src/modules/notification-preferences/__tests__/*.spec.ts`                                    | Service + controller                                                                                                                                                                                                                                                                         | Create                               |
| `apps/api/src/cron/digest-email.cron.ts`                                                               | Daily 08:00 Asia/Manila digest batch                                                                                                                                                                                                                                                         | Create                               |
| `apps/api/src/cron/notifications-retention.cron.ts`                                                    | Daily 03:00 90-day delete                                                                                                                                                                                                                                                                    | Create                               |
| `apps/api/src/cron/interview-reminder.cron.ts`                                                         | Hourly 24h-ahead interview reminders                                                                                                                                                                                                                                                         | Create                               |
| `apps/api/src/cron/offer-expiry-reminder.cron.ts`                                                      | Hourly 24h-ahead offer expiry reminders                                                                                                                                                                                                                                                      | Create                               |
| `apps/api/src/cron/interview-feedback-due.cron.ts`                                                     | Hourly 24h-after-interview feedback prompts                                                                                                                                                                                                                                                  | Create                               |
| `apps/api/src/cron/__tests__/*.spec.ts`                                                                | Each cron's deduplication and side effects                                                                                                                                                                                                                                                   | Create                               |
| `apps/api/src/cron/cron.module.ts`                                                                     | Register the 5 new crons                                                                                                                                                                                                                                                                     | Modify                               |
| `apps/api/src/app.module.ts`                                                                           | Import the two new modules                                                                                                                                                                                                                                                                   | Modify                               |
| `apps/api/src/audit/audit.types.ts`                                                                    | Add `NOTIFICATIONS_MARKED_ALL_READ`, `NOTIFICATION_PREFERENCE_UPDATED`, `NOTIFICATION_PREFERENCES_RESET`, `DIGEST_EMAIL_BATCH_RUN`, `NOTIFICATIONS_RETENTION_RUN`, `INTERVIEW_REMINDER_RUN`, `OFFER_EXPIRY_REMINDER_RUN`, `INTERVIEW_FEEDBACK_DUE_RUN`, `SYSTEM_AI_SCORING_FAILURE_NOTIFIED` | Modify                               |
| `apps/api/src/modules/applications/applications.service.ts`                                            | Inject `NotificationsService`; emit on `apply()`, `changeStatus()`, `withdraw()`                                                                                                                                                                                                             | Modify                               |
| `apps/api/src/modules/applications/applications.module.ts`                                             | Import `NotificationsModule`                                                                                                                                                                                                                                                                 | Modify                               |
| `apps/api/src/modules/interviews/interviews.service.ts`                                                | Inject + emit on `schedule()`, `cancel()`                                                                                                                                                                                                                                                    | Modify                               |
| `apps/api/src/modules/interviews/interviews.module.ts`                                                 | Import `NotificationsModule`                                                                                                                                                                                                                                                                 | Modify                               |
| `apps/api/src/modules/offers/offers.service.ts`                                                        | Inject + emit on `create()`, `accept()`, `decline()`                                                                                                                                                                                                                                         | Modify                               |
| `apps/api/src/modules/offers/offers.module.ts`                                                         | Import `NotificationsModule`                                                                                                                                                                                                                                                                 | Modify                               |
| `apps/api/src/modules/bias/bias.service.ts` _(gated on module presence)_                               | Inject + emit on flag - both `bias_flag_raised` (recruiter) and `system_bias_flag_raised` (admin)                                                                                                                                                                                            | Modify (or wait)                     |
| `apps/api/src/modules/auth/auth.service.ts`                                                            | Inject + emit on `resetPassword()`, `verifyEmail()`                                                                                                                                                                                                                                          | Modify                               |
| `apps/api/src/modules/invitations/invitations.service.ts`                                              | Inject + emit on `accept()`, `decline()`                                                                                                                                                                                                                                                     | Modify                               |
| The match-preview-precompute worker (`MatchPreviewQueueService`, exact path resolved during execution) | Catch-block emit `system_ai_scoring_failure` to all admins                                                                                                                                                                                                                                   | Modify                               |
| `apps/api/openapi.json`                                                                                | Regenerated                                                                                                                                                                                                                                                                                  | Regenerate                           |
| `packages/shared/openapi.json` (if separate)                                                           | Regenerated                                                                                                                                                                                                                                                                                  | Regenerate                           |
| `packages/shared/src/api-client/generated.ts`                                                          | Regenerated by `pnpm --filter shared codegen`                                                                                                                                                                                                                                                | Regenerate                           |
| `apps/web/components/layout/nav-item-badge.tsx`                                                        | Bell badge polling unread count                                                                                                                                                                                                                                                              | Create                               |
| `apps/web/components/layout/portal-sidebar.tsx`                                                        | Add Notifications nav item to MAIN section for all 3 roles                                                                                                                                                                                                                                   | Modify                               |
| `apps/web/components/notifications/notification-icon-map.ts`                                           | `eventType → LucideIcon` registry                                                                                                                                                                                                                                                            | Create                               |
| `apps/web/components/notifications/notifications-empty-state.tsx`                                      | Per-tab empty state                                                                                                                                                                                                                                                                          | Create                               |
| `apps/web/components/notifications/notification-row.tsx`                                               | Single row                                                                                                                                                                                                                                                                                   | Create                               |
| `apps/web/components/notifications/notifications-list.tsx`                                             | Infinite-scroll list                                                                                                                                                                                                                                                                         | Create                               |
| `apps/web/components/notifications/notifications-page.tsx`                                             | Header + tabs + list orchestration                                                                                                                                                                                                                                                           | Create                               |
| `apps/web/components/notifications/__tests__/*.spec.tsx`                                               | Vitest + Testing Library tests                                                                                                                                                                                                                                                               | Create                               |
| `apps/web/app/(candidate)/candidate/notifications/page.tsx`                                            | Route shell                                                                                                                                                                                                                                                                                  | Create                               |
| `apps/web/app/(recruiter)/recruiter/notifications/page.tsx`                                            | Route shell                                                                                                                                                                                                                                                                                  | Create                               |
| `apps/web/app/(admin)/admin/notifications/page.tsx`                                                    | Route shell                                                                                                                                                                                                                                                                                  | Create                               |
| `apps/web/components/settings/notifications-form.tsx`                                                  | Full rewrite - API-backed, grouped, 3-mode, security-locked, restore-defaults, localStorage migration                                                                                                                                                                                        | Modify                               |
| `apps/web/components/notifications/__tests__/notifications-form.spec.tsx`                              | Vitest tests                                                                                                                                                                                                                                                                                 | Create                               |
| `apps/web/tests/notifications.spec.ts`                                                                 | Playwright e2e (gated on `e2e` script existing)                                                                                                                                                                                                                                              | Create                               |

---

## Phases

| Phase                   | Tasks   | Outcome                                             |
| ----------------------- | ------- | --------------------------------------------------- |
| 1 - Schema              | T1-T5   | DB tables, enums, relations, RLS migration          |
| 2 - Shared schemas      | T6      | Zod DTOs available to both apps                     |
| 3 - Backend foundation  | T7-T11  | event-defaults, repository, services, modules wired |
| 4 - Email + queue       | T12-T15 | Templates registry, base layout, digest, processor  |
| 5 - HTTP controllers    | T16-T17 | Endpoints exposed, audited                          |
| 6 - Crons               | T18-T22 | All 5 crons registered + deduplication-tested       |
| 7 - Service hookups     | T23-T28 | Every event type's producer wired                   |
| 8 - API client regen    | T29     | Frontend gets typed hooks                           |
| 9 - Bell + nav          | T30-T31 | Badge polls, sidebar shows count                    |
| 10 - Notifications page | T32-T36 | `/[role]/notifications` works end-to-end            |
| 11 - Settings rewrite   | T37     | localStorage retired, API-backed prefs              |
| 12 - Verification       | T38     | Manual smoke checklist + final build gate           |

---

## Phase 1 - Schema

### Task 1: Add notification enums

**Files:**

- Modify: `packages/db/src/enums.ts`

- [ ] **Step 1: Append the three new enums to the bottom of `packages/db/src/enums.ts`**

```ts
// Notification system - used by `notificationsTable` and `notificationPreferencesTable`.
export const NOTIFICATION_EVENT_TYPE = [
  // Candidate (personal scope)
  "application_status_changed",
  "interview_scheduled",
  "interview_reminder_24h",
  "interview_cancelled",
  "offer_received",
  "offer_expiring_soon",
  // Recruiter (personal scope)
  "new_application_received",
  "candidate_withdrew",
  "interview_feedback_due",
  "offer_accepted",
  "offer_declined",
  "bias_flag_raised",
  "team_invite_accepted",
  "team_invite_declined",
  // Admin (system scope)
  "system_bias_flag_raised",
  "system_ai_scoring_failure",
  "system_moderation_queue_item",
  // Security (always-instant, not user-toggleable)
  "account_password_reset",
  "account_email_verified",
  "account_login_new_device",
] as const;

export const NOTIFICATION_MODE = ["instant", "digest", "off"] as const;
export const NOTIFICATION_SCOPE = ["personal", "system"] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPE)[number];
export type NotificationMode = (typeof NOTIFICATION_MODE)[number];
export type NotificationScope = (typeof NOTIFICATION_SCOPE)[number];
```

- [ ] **Step 2: Type-check the db package**

Run: `pnpm --filter @aurahire/db type-check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/enums.ts
git commit -m "feat(db): add notification enums (event type, mode, scope)"
```

---

### Task 2: Add `notifications` table

**Files:**

- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: At the top of `schema.ts`, extend the import block from `./enums` to include the three new enums**

Find the existing import:

```ts
import {
  USER_ROLES,
  USER_STATUS,
  ...
} from "./enums";
```

Add at the end of the imported names:

```ts
  NOTIFICATION_EVENT_TYPE,
  NOTIFICATION_MODE,
  NOTIFICATION_SCOPE,
```

- [ ] **Step 2: Append the `notificationsTable` definition to the end of `schema.ts`, before any closing barrel exports**

```ts
export const notificationsTable = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    eventType: text("event_type", { enum: NOTIFICATION_EVENT_TYPE }).notNull(),
    scope: text("scope", { enum: NOTIFICATION_SCOPE })
      .notNull()
      .default("personal"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    actorId: uuid("actor_id").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    readAt: timestamp("read_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    digestPending: boolean("digest_pending").notNull().default(false),
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userUnreadIdx: index("notifications_user_unread_idx").on(
      t.userId,
      t.readAt,
      t.createdAt,
    ),
    userCreatedIdx: index("notifications_user_created_idx").on(
      t.userId,
      t.createdAt,
    ),
    createdAtIdx: index("notifications_created_at_idx").on(t.createdAt),
    digestPendingIdx: index("notifications_digest_pending_idx")
      .on(t.digestPending)
      .where(sql`${t.digestPending} = true`),
  }),
);

export type Notification = typeof notificationsTable.$inferSelect;
export type NewNotification = typeof notificationsTable.$inferInsert;
```

- [ ] **Step 3: Type-check the db package**

Run: `pnpm --filter @aurahire/db type-check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add notifications table"
```

---

### Task 3: Add `notification_preferences` table

**Files:**

- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Append `notificationPreferencesTable` to `schema.ts`, immediately after `notificationsTable`**

```ts
export const notificationPreferencesTable = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    eventType: text("event_type", { enum: NOTIFICATION_EVENT_TYPE }).notNull(),
    mode: text("mode", { enum: NOTIFICATION_MODE }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userEventUniq: uniqueIndex("notification_prefs_user_event_uniq").on(
      t.userId,
      t.eventType,
    ),
  }),
);

export type NotificationPreference =
  typeof notificationPreferencesTable.$inferSelect;
export type NewNotificationPreference =
  typeof notificationPreferencesTable.$inferInsert;
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @aurahire/db type-check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add notification_preferences table"
```

---

### Task 4: Add cron-flag columns to existing tables

**Files:**

- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: In `interviewsTable`, add two timestamp columns inside the column block**

Locate the existing `interviewsTable = pgTable("interviews", { ... })` definition. Inside the column object, add:

```ts
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    feedbackDueNotifiedAt: timestamp("feedback_due_notified_at", { withTimezone: true }),
```

- [ ] **Step 2: In `offersTable`, add one timestamp column**

Locate `offersTable = pgTable("offers", { ... })`. Inside the column object, add:

```ts
    expiryReminderSentAt: timestamp("expiry_reminder_sent_at", { withTimezone: true }),
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @aurahire/db type-check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add cron deduplication flag columns to interviews and offers"
```

---

### Task 5: Generate Drizzle migration + author RLS migration

**Files:**

- Create (via drizzle-kit): `supabase/migrations/<timestamp>_notifications.sql` - the human runs `pnpm drizzle:generate` (or the project's equivalent script) to generate this; if generation is the human's responsibility, provide the SQL directly so the human can paste it into a hand-written migration file.
- Create: `supabase/migrations/<timestamp>_notifications_rls.sql` - RLS policies.

- [ ] **Step 1: Write the migration SQL by hand at `supabase/migrations/<timestamp>_notifications.sql`**

The exact filename uses Supabase's timestamp convention; check the most recent migration in `supabase/migrations/` and increment. Contents:

```sql
-- notifications + notification_preferences tables.

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  scope text NOT NULL DEFAULT 'personal',
  title text NOT NULL,
  body text NOT NULL,
  link text,
  entity_type text,
  entity_id uuid,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  metadata jsonb,
  read_at timestamptz,
  dismissed_at timestamptz,
  digest_pending boolean NOT NULL DEFAULT false,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id, read_at, created_at);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications (user_id, created_at);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx
  ON notifications (created_at);
CREATE INDEX IF NOT EXISTS notifications_digest_pending_idx
  ON notifications (digest_pending) WHERE digest_pending = true;

CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  mode text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_prefs_user_event_uniq
  ON notification_preferences (user_id, event_type);

-- Cron-flag columns on existing tables.
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS feedback_due_notified_at timestamptz;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS expiry_reminder_sent_at timestamptz;
```

- [ ] **Step 2: Author the RLS migration at `supabase/migrations/<next-timestamp>_notifications_rls.sql`**

```sql
-- RLS policies for notifications + notification_preferences.

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own notifications.
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

-- Backend writes via service role, bypassing RLS - no INSERT policy needed for the user-facing flow.

-- Same shape for preferences.
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
```

- [ ] **Step 3: Commit the migration files**

```bash
git add supabase/migrations/
git commit -m "feat(db): notifications migration + RLS policies"
```

- [ ] **Step 4: Pause for the human to apply migrations**

Print to the user:

> Migrations written. Please apply them: `supabase db push` (or your project's migration runner) and confirm both tables and the RLS policies exist before continuing. Reply once applied so the next phase can run with a working DB.

Wait for confirmation before proceeding to Phase 2.

---

## Phase 2 - Shared schemas

### Task 6: Add Zod schemas for notifications and preferences

**Files:**

- Create: `packages/shared/src/schemas/notifications.ts`
- Modify: `packages/shared/src/index.ts` (add re-export)

- [ ] **Step 1: Create `packages/shared/src/schemas/notifications.ts`**

```ts
import { z } from "zod";

export const notificationEventTypeSchema = z.enum([
  "application_status_changed",
  "interview_scheduled",
  "interview_reminder_24h",
  "interview_cancelled",
  "offer_received",
  "offer_expiring_soon",
  "new_application_received",
  "candidate_withdrew",
  "interview_feedback_due",
  "offer_accepted",
  "offer_declined",
  "bias_flag_raised",
  "team_invite_accepted",
  "team_invite_declined",
  "system_bias_flag_raised",
  "system_ai_scoring_failure",
  "system_moderation_queue_item",
  "account_password_reset",
  "account_email_verified",
  "account_login_new_device",
]);

export const notificationModeSchema = z.enum(["instant", "digest", "off"]);
export const notificationScopeSchema = z.enum(["personal", "system"]);

export const notificationCategorySchema = z.enum([
  "account",
  "applications",
  "interviews",
  "offers",
  "bias",
  "team",
  "system",
]);

export const notificationItemSchema = z.object({
  id: z.string().uuid(),
  eventType: notificationEventTypeSchema,
  scope: notificationScopeSchema,
  title: z.string(),
  body: z.string(),
  link: z.string().nullable(),
  entityType: z.string().nullable(),
  entityId: z.string().uuid().nullable(),
  actorId: z.string().uuid().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  readAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
});
export type NotificationItem = z.infer<typeof notificationItemSchema>;

export const listNotificationsQuerySchema = z.object({
  tab: z.enum(["unread", "all"]).default("unread"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});
export type ListNotificationsQuery = z.infer<
  typeof listNotificationsQuerySchema
>;

export const listNotificationsResponseSchema = z.object({
  items: z.array(notificationItemSchema),
  nextCursor: z.string().nullable(),
});
export type ListNotificationsResponse = z.infer<
  typeof listNotificationsResponseSchema
>;

export const unreadCountResponseSchema = z.object({
  count: z.number().int().min(0),
  displayCount: z.string(),
});
export type UnreadCountResponse = z.infer<typeof unreadCountResponseSchema>;

export const markReadResponseSchema = unreadCountResponseSchema.extend({
  unreadCount: z.number().int().min(0),
});
export type MarkReadResponse = z.infer<typeof markReadResponseSchema>;

export const upsertPreferenceBodySchema = z.object({
  eventType: notificationEventTypeSchema,
  mode: notificationModeSchema,
});
export type UpsertPreferenceBody = z.infer<typeof upsertPreferenceBodySchema>;

export const preferenceItemSchema = z.object({
  eventType: notificationEventTypeSchema,
  mode: notificationModeSchema,
  isDefault: z.boolean(),
  isSecurityLocked: z.boolean(),
  category: notificationCategorySchema,
  label: z.string(),
  description: z.string(),
});
export type PreferenceItem = z.infer<typeof preferenceItemSchema>;

export const restoreDefaultsBodySchema = z.object({
  category: z
    .enum([
      "applications",
      "interviews",
      "offers",
      "bias",
      "team",
      "system",
      "all",
    ])
    .default("all"),
});
export type RestoreDefaultsBody = z.infer<typeof restoreDefaultsBodySchema>;

export const restoreDefaultsResponseSchema = z.object({
  deleted: z.number().int().min(0),
});
export type RestoreDefaultsResponse = z.infer<
  typeof restoreDefaultsResponseSchema
>;
```

- [ ] **Step 2: Add the re-export to `packages/shared/src/index.ts`**

Append to the existing exports:

```ts
export * from "./schemas/notifications";
```

- [ ] **Step 3: Type-check the shared package**

Run: `pnpm --filter @aurahire/shared type-check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas/notifications.ts packages/shared/src/index.ts
git commit -m "feat(shared): add notification Zod schemas + types"
```

---

## Phase 3 - Backend foundation

### Task 7: Create event-defaults registry

**Files:**

- Create: `apps/api/src/modules/notifications/event-defaults.ts`
- Create: `apps/api/src/modules/notifications/__tests__/event-defaults.spec.ts`

- [ ] **Step 1: Write the failing test at `apps/api/src/modules/notifications/__tests__/event-defaults.spec.ts`**

```ts
import {
  DEFAULT_MODES,
  SECURITY_EVENTS,
  EVENT_CATEGORIES,
  ROLE_VISIBLE_EVENTS,
  EVENT_LABELS,
  EVENT_DESCRIPTIONS,
} from "../event-defaults";
import { NOTIFICATION_EVENT_TYPE } from "@aurahire/db";

describe("event-defaults", () => {
  it("DEFAULT_MODES has an entry for every NOTIFICATION_EVENT_TYPE", () => {
    for (const eventType of NOTIFICATION_EVENT_TYPE) {
      expect(DEFAULT_MODES[eventType]).toBeDefined();
    }
  });

  it("SECURITY_EVENTS contains the 4 always-instant event types", () => {
    expect(SECURITY_EVENTS.has("account_password_reset")).toBe(true);
    expect(SECURITY_EVENTS.has("account_email_verified")).toBe(true);
    expect(SECURITY_EVENTS.has("account_login_new_device")).toBe(true);
    expect(SECURITY_EVENTS.has("offer_expiring_soon")).toBe(true);
    expect(SECURITY_EVENTS.size).toBe(4);
  });

  it("default mode is 'digest' for the high-volume events", () => {
    expect(DEFAULT_MODES.new_application_received).toBe("digest");
    expect(DEFAULT_MODES.team_invite_accepted).toBe("digest");
    expect(DEFAULT_MODES.team_invite_declined).toBe("digest");
    expect(DEFAULT_MODES.system_moderation_queue_item).toBe("digest");
  });

  it("default mode is 'instant' for security and offer events", () => {
    expect(DEFAULT_MODES.account_password_reset).toBe("instant");
    expect(DEFAULT_MODES.offer_received).toBe("instant");
    expect(DEFAULT_MODES.offer_expiring_soon).toBe("instant");
    expect(DEFAULT_MODES.bias_flag_raised).toBe("instant");
  });

  it("EVENT_CATEGORIES maps each event to a category string", () => {
    for (const eventType of NOTIFICATION_EVENT_TYPE) {
      expect(EVENT_CATEGORIES[eventType]).toBeDefined();
    }
    expect(EVENT_CATEGORIES.application_status_changed).toBe("applications");
    expect(EVENT_CATEGORIES.account_password_reset).toBe("account");
    expect(EVENT_CATEGORIES.system_bias_flag_raised).toBe("system");
  });

  it("ROLE_VISIBLE_EVENTS lists the events each role's settings page can toggle", () => {
    expect(ROLE_VISIBLE_EVENTS.candidate).toContain(
      "application_status_changed",
    );
    expect(ROLE_VISIBLE_EVENTS.candidate).not.toContain(
      "new_application_received",
    );
    expect(ROLE_VISIBLE_EVENTS.recruiter).toContain("new_application_received");
    expect(ROLE_VISIBLE_EVENTS.admin).toContain("system_bias_flag_raised");
  });

  it("EVENT_LABELS and EVENT_DESCRIPTIONS have entries for every event type", () => {
    for (const eventType of NOTIFICATION_EVENT_TYPE) {
      expect(EVENT_LABELS[eventType]).toBeTruthy();
      expect(EVENT_DESCRIPTIONS[eventType]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm --filter api test -- event-defaults`
Expected: Cannot find module `../event-defaults`.

- [ ] **Step 3: Create `apps/api/src/modules/notifications/event-defaults.ts`**

```ts
import type { NotificationEventType, NotificationMode } from "@aurahire/db";

export const DEFAULT_MODES: Record<NotificationEventType, NotificationMode> = {
  application_status_changed: "instant",
  interview_scheduled: "instant",
  interview_reminder_24h: "instant",
  interview_cancelled: "instant",
  offer_received: "instant",
  offer_expiring_soon: "instant",
  new_application_received: "digest",
  candidate_withdrew: "instant",
  interview_feedback_due: "instant",
  offer_accepted: "instant",
  offer_declined: "instant",
  bias_flag_raised: "instant",
  team_invite_accepted: "digest",
  team_invite_declined: "digest",
  system_bias_flag_raised: "instant",
  system_ai_scoring_failure: "instant",
  system_moderation_queue_item: "digest",
  account_password_reset: "instant",
  account_email_verified: "instant",
  account_login_new_device: "instant",
};

export const SECURITY_EVENTS: ReadonlySet<NotificationEventType> = new Set([
  "account_password_reset",
  "account_email_verified",
  "account_login_new_device",
  "offer_expiring_soon",
]);

export type EventCategory =
  | "account"
  | "applications"
  | "interviews"
  | "offers"
  | "bias"
  | "team"
  | "system";

export const EVENT_CATEGORIES: Record<NotificationEventType, EventCategory> = {
  application_status_changed: "applications",
  new_application_received: "applications",
  candidate_withdrew: "applications",
  interview_scheduled: "interviews",
  interview_reminder_24h: "interviews",
  interview_cancelled: "interviews",
  interview_feedback_due: "interviews",
  offer_received: "offers",
  offer_expiring_soon: "offers",
  offer_accepted: "offers",
  offer_declined: "offers",
  bias_flag_raised: "bias",
  team_invite_accepted: "team",
  team_invite_declined: "team",
  system_bias_flag_raised: "system",
  system_ai_scoring_failure: "system",
  system_moderation_queue_item: "system",
  account_password_reset: "account",
  account_email_verified: "account",
  account_login_new_device: "account",
};

export const ROLE_VISIBLE_EVENTS: Record<
  "candidate" | "recruiter" | "admin",
  ReadonlyArray<NotificationEventType>
> = {
  candidate: [
    "application_status_changed",
    "interview_scheduled",
    "interview_reminder_24h",
    "interview_cancelled",
    "offer_received",
    "offer_expiring_soon",
    "account_password_reset",
    "account_email_verified",
    "account_login_new_device",
  ],
  recruiter: [
    "new_application_received",
    "candidate_withdrew",
    "interview_feedback_due",
    "offer_accepted",
    "offer_declined",
    "bias_flag_raised",
    "team_invite_accepted",
    "team_invite_declined",
    "account_password_reset",
    "account_email_verified",
    "account_login_new_device",
  ],
  admin: [
    "system_bias_flag_raised",
    "system_ai_scoring_failure",
    "system_moderation_queue_item",
    "team_invite_accepted",
    "team_invite_declined",
    "account_password_reset",
    "account_email_verified",
    "account_login_new_device",
  ],
};

export const EVENT_LABELS: Record<NotificationEventType, string> = {
  application_status_changed: "Application status changed",
  interview_scheduled: "Interview scheduled",
  interview_reminder_24h: "Interview tomorrow reminder",
  interview_cancelled: "Interview cancelled",
  offer_received: "Offer received",
  offer_expiring_soon: "Offer expiring within 24 hours",
  new_application_received: "New application received",
  candidate_withdrew: "Candidate withdrew",
  interview_feedback_due: "Interview feedback due",
  offer_accepted: "Offer accepted by candidate",
  offer_declined: "Offer declined by candidate",
  bias_flag_raised: "Bias flag on your job description",
  team_invite_accepted: "Team invite accepted",
  team_invite_declined: "Team invite declined",
  system_bias_flag_raised: "Bias flag raised system-wide",
  system_ai_scoring_failure: "AI scoring failure",
  system_moderation_queue_item: "Moderation queue item",
  account_password_reset: "Password reset confirmation",
  account_email_verified: "Email verification confirmation",
  account_login_new_device: "Login from a new device",
};

export const EVENT_DESCRIPTIONS: Record<NotificationEventType, string> = {
  application_status_changed:
    "Your application moves to Screening, Interview, Offer, Hired, or Rejected.",
  interview_scheduled: "A recruiter scheduled an interview with you.",
  interview_reminder_24h: "An interview starts within 24 hours.",
  interview_cancelled: "A scheduled interview was cancelled.",
  offer_received: "A recruiter sent you a job offer.",
  offer_expiring_soon:
    "An offer expires within 24 hours. Required for security - cannot be disabled.",
  new_application_received: "A candidate applied to a job you own.",
  candidate_withdrew:
    "A candidate withdrew their application from a job you own.",
  interview_feedback_due: "Feedback for an interview you ran is overdue.",
  offer_accepted: "A candidate accepted your offer.",
  offer_declined: "A candidate declined your offer.",
  bias_flag_raised:
    "Bias detection flagged language on a job description you published.",
  team_invite_accepted: "A team member you invited accepted.",
  team_invite_declined: "A team member you invited declined.",
  system_bias_flag_raised:
    "Bias detection flagged a job description anywhere on the platform.",
  system_ai_scoring_failure:
    "An AI scoring job failed and needs investigation.",
  system_moderation_queue_item: "A new item entered the moderation queue.",
  account_password_reset:
    "Your password was changed. Required for security - cannot be disabled.",
  account_email_verified:
    "Your email address was verified. Required for security - cannot be disabled.",
  account_login_new_device:
    "A login was detected from a device fingerprint we haven't seen. Required for security - cannot be disabled.",
};
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm --filter api test -- event-defaults`
Expected: PASS, all assertions green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/notifications/event-defaults.ts apps/api/src/modules/notifications/__tests__/event-defaults.spec.ts
git commit -m "feat(api): add notification event-defaults registry (categories, labels, role visibility)"
```

---

### Task 8: Create notifications repository

**Files:**

- Create: `apps/api/src/modules/notifications/notifications.repository.ts`
- Create: `apps/api/src/modules/notifications/__tests__/notifications.repository.spec.ts`

This task uses the project's existing test-DB fixture pattern. Inspect any existing `*.repository.spec.ts` (e.g., `applications.repository.spec.ts`) before writing tests to confirm: (a) the test-DB connection helper module path, (b) the seed-row helper pattern, (c) whether tests run against a real Postgres or a stub. Mirror that pattern verbatim - do not invent a new fixture.

- [ ] **Step 1: Read an existing repository spec to confirm the test-DB helper**

Run: `find apps/api/src -name "*.repository.spec.ts" | head -3`
Open any one match and note the imports for the test-DB helper. Use the same imports below.

- [ ] **Step 2: Write the failing test at `notifications.repository.spec.ts`**

The structure (replace `<DB_HELPER_IMPORT>` with the path discovered in Step 1):

```ts
import { Test } from "@nestjs/testing";
import { NotificationsRepository } from "../notifications.repository";
import {} from /* test-db helpers */ "<DB_HELPER_IMPORT>";

describe("NotificationsRepository", () => {
  let repo: NotificationsRepository;
  // (set up test-db, seed a profile row, get its id as TEST_USER_ID)

  beforeAll(async () => {
    /* boot test module mirroring existing pattern */
  });

  afterAll(async () => {
    /* tear down */
  });

  it("insertOne creates a row and returns it", async () => {
    const row = await repo.insertOne({
      userId: TEST_USER_ID,
      eventType: "application_status_changed",
      scope: "personal",
      title: "Status changed",
      body: "Your application moved to Interview",
      link: "/candidate/applications/abc",
      entityType: "application",
      entityId: TEST_APP_ID,
      actorId: null,
      metadata: { newStatus: "interview" },
    });
    expect(row.id).toBeDefined();
    expect(row.readAt).toBeNull();
    expect(row.digestPending).toBe(false);
  });

  it("countUnread returns rows where readAt IS NULL AND dismissedAt IS NULL", async () => {
    const count = await repo.countUnread(TEST_USER_ID);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("listForUser excludes dismissed rows and orders by createdAt DESC", async () => {
    const { items } = await repo.listForUser(TEST_USER_ID, {
      tab: "all",
      limit: 20,
    });
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].dismissedAt).toBeNull();
  });

  it("markRead sets readAt and returns new unread count", async () => {
    const row = await repo.insertOne(/* ... */);
    const result = await repo.markRead(row.id, TEST_USER_ID);
    expect(result.unreadCount).toBeGreaterThanOrEqual(0);
  });

  it("markAllRead zeros unread count for the user", async () => {
    const result = await repo.markAllRead(TEST_USER_ID);
    expect(result.unreadCount).toBe(0);
  });

  it("dismiss sets dismissedAt", async () => {
    const row = await repo.insertOne(/* ... */);
    await repo.dismiss(row.id, TEST_USER_ID);
    const refetched = await repo.findById(row.id);
    expect(refetched?.dismissedAt).not.toBeNull();
  });

  it("setDigestPending updates the row", async () => {
    const row = await repo.insertOne(/* ... */);
    await repo.setDigestPending(row.id, true);
    const refetched = await repo.findById(row.id);
    expect(refetched?.digestPending).toBe(true);
  });

  it("findDigestPendingByUser returns one user-id batch with all their pending rows", async () => {
    const batches = await repo.findDigestPendingByUser();
    expect(Array.isArray(batches)).toBe(true);
  });

  it("clearDigestPending flips digest_pending=false for given ids", async () => {
    const row = await repo.insertOne(/* ... */);
    await repo.setDigestPending(row.id, true);
    await repo.clearDigestPending([row.id]);
    const refetched = await repo.findById(row.id);
    expect(refetched?.digestPending).toBe(false);
  });

  it("deleteOlderThan deletes rows older than the cutoff", async () => {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const deleted = await repo.deleteOlderThan(cutoff);
    expect(typeof deleted).toBe("number");
  });

  it("listForUser supports cursor pagination", async () => {
    const page1 = await repo.listForUser(TEST_USER_ID, {
      tab: "all",
      limit: 1,
    });
    expect(page1.nextCursor).toBeDefined();
    const page2 = await repo.listForUser(TEST_USER_ID, {
      tab: "all",
      limit: 1,
      cursor: page1.nextCursor!,
    });
    expect(page2.items[0].id).not.toBe(page1.items[0].id);
  });
});
```

- [ ] **Step 3: Run the test, expect failure**

Run: `pnpm --filter api test -- notifications.repository`
Expected: Cannot find module.

- [ ] **Step 4: Implement `notifications.repository.ts`**

```ts
import { Injectable, Inject } from "@nestjs/common";
import {
  notificationsTable,
  type NewNotification,
  type Notification,
} from "@aurahire/db";
import { and, desc, eq, isNull, lt, sql, inArray } from "drizzle-orm";
import type { NotificationScope } from "@aurahire/db";
import { DRIZZLE_DB } from "../../db/db.tokens"; // confirm path during execution
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export interface ListForUserParams {
  tab: "unread" | "all";
  limit: number;
  cursor?: string;
}

export interface ListForUserResult {
  items: Notification[];
  nextCursor: string | null;
}

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async insertOne(input: NewNotification): Promise<Notification> {
    const [row] = await this.db
      .insert(notificationsTable)
      .values(input)
      .returning();
    return row;
  }

  async insertMany(inputs: NewNotification[]): Promise<Notification[]> {
    if (inputs.length === 0) return [];
    return this.db.insert(notificationsTable).values(inputs).returning();
  }

  async findById(id: string): Promise<Notification | null> {
    const [row] = await this.db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, id))
      .limit(1);
    return row ?? null;
  }

  async countUnread(userId: string): Promise<number> {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, userId),
          isNull(notificationsTable.readAt),
          isNull(notificationsTable.dismissedAt),
        ),
      );
    return count ?? 0;
  }

  async listForUser(
    userId: string,
    params: ListForUserParams,
  ): Promise<ListForUserResult> {
    const conditions = [
      eq(notificationsTable.userId, userId),
      isNull(notificationsTable.dismissedAt),
    ];
    if (params.tab === "unread") {
      conditions.push(isNull(notificationsTable.readAt));
    }
    if (params.cursor) {
      const decoded = Buffer.from(params.cursor, "base64").toString("utf-8");
      const [createdAt, id] = decoded.split("|");
      conditions.push(
        sql`(${notificationsTable.createdAt}, ${notificationsTable.id}) < (${createdAt}::timestamptz, ${id}::uuid)`,
      );
    }
    const rows = await this.db
      .select()
      .from(notificationsTable)
      .where(and(...conditions))
      .orderBy(desc(notificationsTable.createdAt), desc(notificationsTable.id))
      .limit(params.limit + 1);

    const hasMore = rows.length > params.limit;
    const items = hasMore ? rows.slice(0, params.limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString(
            "base64",
          )
        : null;
    return { items, nextCursor };
  }

  async markRead(id: string, userId: string): Promise<{ unreadCount: number }> {
    await this.db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.id, id),
          eq(notificationsTable.userId, userId),
        ),
      );
    const unreadCount = await this.countUnread(userId);
    return { unreadCount };
  }

  async markAllRead(userId: string): Promise<{ unreadCount: number }> {
    await this.db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.userId, userId),
          isNull(notificationsTable.readAt),
          isNull(notificationsTable.dismissedAt),
        ),
      );
    return { unreadCount: 0 };
  }

  async dismiss(id: string, userId: string): Promise<{ unreadCount: number }> {
    await this.db
      .update(notificationsTable)
      .set({ dismissedAt: new Date() })
      .where(
        and(
          eq(notificationsTable.id, id),
          eq(notificationsTable.userId, userId),
        ),
      );
    const unreadCount = await this.countUnread(userId);
    return { unreadCount };
  }

  async setDigestPending(id: string, value: boolean): Promise<void> {
    await this.db
      .update(notificationsTable)
      .set({ digestPending: value })
      .where(eq(notificationsTable.id, id));
  }

  async setEmailSent(id: string): Promise<void> {
    await this.db
      .update(notificationsTable)
      .set({ emailSentAt: new Date() })
      .where(eq(notificationsTable.id, id));
  }

  async findDigestPendingByUser(): Promise<
    Array<{ userId: string; ids: string[] }>
  > {
    const rows = await this.db
      .select({ id: notificationsTable.id, userId: notificationsTable.userId })
      .from(notificationsTable)
      .where(eq(notificationsTable.digestPending, true));
    const grouped = new Map<string, string[]>();
    for (const row of rows) {
      const arr = grouped.get(row.userId) ?? [];
      arr.push(row.id);
      grouped.set(row.userId, arr);
    }
    return Array.from(grouped.entries()).map(([userId, ids]) => ({
      userId,
      ids,
    }));
  }

  async clearDigestPending(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(notificationsTable)
      .set({ digestPending: false })
      .where(inArray(notificationsTable.id, ids));
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.db
      .delete(notificationsTable)
      .where(lt(notificationsTable.createdAt, cutoff));
    return (result as unknown as { rowCount?: number }).rowCount ?? 0;
  }
}
```

> **Note on `DRIZZLE_DB`:** Use whichever DB-injection token the existing repositories use. Confirm the import path during execution by reading `applications.repository.ts`.

- [ ] **Step 5: Run the test, expect pass**

Run: `pnpm --filter api test -- notifications.repository`
Expected: All assertions green. If the test-DB fixture isn't already wired, defer the implementation tests to plan-execution review and ship the repo with type-check + lint as the gate.

- [ ] **Step 6: Type-check and lint**

Run: `pnpm --filter api type-check && pnpm --filter api lint`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/notifications/notifications.repository.ts apps/api/src/modules/notifications/__tests__/notifications.repository.spec.ts
git commit -m "feat(api): notifications repository (insert, list, count, mark-read, dismiss, digest, retention)"
```

---

### Task 9: Create NotificationsService.emit() with TDD

**Files:**

- Create: `apps/api/src/modules/notifications/notifications.service.ts`
- Create: `apps/api/src/modules/notifications/__tests__/notifications.service.spec.ts`

This is the central fan-out: insert row → consult preferences → enqueue email or mark digest. Tested with mocked repository, mocked queue, mocked preferences service, mocked profile lookup.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/notifications/__tests__/notifications.service.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { NotificationsService } from "../notifications.service";
import { NotificationsRepository } from "../notifications.repository";
import { NotificationPreferencesService } from "../../notification-preferences/notification-preferences.service";
import { NOTIFICATION_EMAIL_QUEUE } from "../queues";
import { ProfilesRepository } from "../../profiles/profiles.repository"; // confirm path

const mockRepo = () => ({
  insertOne: jest.fn(),
  insertMany: jest.fn(),
  setDigestPending: jest.fn(),
});
const mockPrefs = () => ({ getEffectiveMode: jest.fn() });
const mockQueue = () => ({ add: jest.fn() });
const mockProfiles = () => ({ findById: jest.fn(), findIdsByRole: jest.fn() });

describe("NotificationsService.emit", () => {
  let service: NotificationsService;
  let repo: ReturnType<typeof mockRepo>;
  let prefs: ReturnType<typeof mockPrefs>;
  let queue: ReturnType<typeof mockQueue>;
  let profiles: ReturnType<typeof mockProfiles>;

  beforeEach(async () => {
    repo = mockRepo();
    prefs = mockPrefs();
    queue = mockQueue();
    profiles = mockProfiles();

    profiles.findById.mockResolvedValue({
      id: "u1",
      status: "active",
      role: "candidate",
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: repo },
        { provide: NotificationPreferencesService, useValue: prefs },
        { provide: getQueueToken(NOTIFICATION_EMAIL_QUEUE), useValue: queue },
        { provide: ProfilesRepository, useValue: profiles },
        Logger,
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
    repo.insertOne.mockResolvedValue({ id: "n1", userId: "u1" });
  });

  it("inserts a row and enqueues an email job when mode is 'instant'", async () => {
    prefs.getEffectiveMode.mockResolvedValue("instant");
    await service.emit({
      userId: "u1",
      eventType: "application_status_changed",
      entityType: "application",
      entityId: "app1",
      metadata: { newStatus: "interview" },
    });
    expect(repo.insertOne).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      "instant-email",
      { kind: "instant", notificationId: "n1" },
      expect.any(Object),
    );
    expect(repo.setDigestPending).not.toHaveBeenCalled();
  });

  it("marks digest_pending and skips queue when mode is 'digest'", async () => {
    prefs.getEffectiveMode.mockResolvedValue("digest");
    await service.emit({
      userId: "u1",
      eventType: "new_application_received",
    });
    expect(repo.insertOne).toHaveBeenCalled();
    expect(repo.setDigestPending).toHaveBeenCalledWith("n1", true);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("inserts but does not enqueue or mark digest when mode is 'off'", async () => {
    prefs.getEffectiveMode.mockResolvedValue("off");
    await service.emit({ userId: "u1", eventType: "team_invite_accepted" });
    expect(repo.insertOne).toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
    expect(repo.setDigestPending).not.toHaveBeenCalled();
  });

  it("ignores preferences for SECURITY_EVENTS and always sends instant", async () => {
    prefs.getEffectiveMode.mockResolvedValue("off");
    await service.emit({ userId: "u1", eventType: "account_password_reset" });
    expect(queue.add).toHaveBeenCalled();
  });

  it("does not insert a row when userId === actorId (self-targeting)", async () => {
    await service.emit({
      userId: "u1",
      actorId: "u1",
      eventType: "application_status_changed",
    });
    expect(repo.insertOne).not.toHaveBeenCalled();
  });

  it("does not insert a row for suspended users", async () => {
    profiles.findById.mockResolvedValue({
      id: "u1",
      status: "suspended",
      role: "candidate",
    });
    await service.emit({
      userId: "u1",
      eventType: "application_status_changed",
    });
    expect(repo.insertOne).not.toHaveBeenCalled();
  });

  it("swallows errors and never throws", async () => {
    repo.insertOne.mockRejectedValue(new Error("boom"));
    await expect(
      service.emit({ userId: "u1", eventType: "application_status_changed" }),
    ).resolves.toBeUndefined();
  });

  it("emitMany fans out to all user ids", async () => {
    profiles.findById.mockResolvedValue({
      id: "x",
      status: "active",
      role: "admin",
    });
    prefs.getEffectiveMode.mockResolvedValue("instant");
    await service.emitMany(["a", "b", "c"], {
      eventType: "system_bias_flag_raised",
      scope: "system",
    });
    expect(repo.insertOne).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm --filter api test -- notifications.service`
Expected: Cannot find module.

- [ ] **Step 3: Create `apps/api/src/modules/notifications/notifications.service.ts`**

```ts
import { Injectable, Logger, forwardRef, Inject } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationPreferencesService } from "../notification-preferences/notification-preferences.service";
import {
  NOTIFICATION_EMAIL_QUEUE,
  type NotificationEmailJobData,
} from "./queues";
import { SECURITY_EVENTS } from "./event-defaults";
import { buildTitle, buildBody, buildLink } from "./templates";
import { ProfilesRepository } from "../profiles/profiles.repository"; // confirm path
import type {
  NotificationEventType,
  NotificationScope,
  NotificationMode,
} from "@aurahire/db";

export interface EmitParams {
  userId: string;
  eventType: NotificationEventType;
  scope?: NotificationScope;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repo: NotificationsRepository,
    @Inject(forwardRef(() => NotificationPreferencesService))
    private readonly prefs: NotificationPreferencesService,
    @InjectQueue(NOTIFICATION_EMAIL_QUEUE)
    private readonly queue: Queue<NotificationEmailJobData>,
    private readonly profiles: ProfilesRepository,
  ) {}

  async emit(params: EmitParams): Promise<void> {
    try {
      if (params.actorId && params.actorId === params.userId) return;

      const profile = await this.profiles.findById(params.userId);
      if (!profile || profile.status !== "active") return;

      const role = profile.role as "candidate" | "recruiter" | "admin";
      const title = buildTitle(params.eventType, params.metadata ?? {});
      const body = buildBody(params.eventType, params.metadata ?? {});
      const link = buildLink(params.eventType, role, params.metadata ?? {});

      const row = await this.repo.insertOne({
        userId: params.userId,
        eventType: params.eventType,
        scope: params.scope ?? "personal",
        title,
        body,
        link,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        actorId: params.actorId ?? null,
        metadata: params.metadata ?? null,
      });

      const mode = await this.resolveDeliveryMode(
        params.userId,
        params.eventType,
      );

      this.logger.debug(
        `emit: user=${params.userId} eventType=${params.eventType} mode=${mode} id=${row.id}`,
      );

      if (mode === "instant") {
        await this.queue.add(
          "instant-email",
          { kind: "instant", notificationId: row.id },
          { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
        );
      } else if (mode === "digest") {
        await this.repo.setDigestPending(row.id, true);
      }
    } catch (err) {
      this.logger.error("notifications.emit failed", { err, params });
    }
  }

  async emitMany(
    userIds: string[],
    params: Omit<EmitParams, "userId">,
  ): Promise<void> {
    await Promise.all(
      userIds.map((userId) => this.emit({ ...params, userId })),
    );
  }

  private async resolveDeliveryMode(
    userId: string,
    eventType: NotificationEventType,
  ): Promise<NotificationMode> {
    if (SECURITY_EVENTS.has(eventType)) return "instant";
    return this.prefs.getEffectiveMode(userId, eventType);
  }
}
```

> **Path note:** The actual `ProfilesRepository` path may differ - confirm by running `find apps/api/src -name "profiles.repository.ts"` during execution and use the canonical import path. Same for the DB injection token used by `NotificationsRepository`.

- [ ] **Step 4: Stub `templates/index.ts` so the service compiles**

The full templates land in Phase 4. Create a minimal stub at `apps/api/src/modules/notifications/templates/index.ts`:

```ts
import type { NotificationEventType } from "@aurahire/db";

export function buildTitle(
  eventType: NotificationEventType,
  metadata: Record<string, unknown>,
): string {
  return `Notification: ${eventType}`;
}

export function buildBody(
  eventType: NotificationEventType,
  metadata: Record<string, unknown>,
): string {
  return "";
}

export function buildLink(
  eventType: NotificationEventType,
  role: "candidate" | "recruiter" | "admin",
  metadata: Record<string, unknown>,
): string | null {
  return null;
}
```

This stub will be replaced in Task 12 with the full registry. The stub is intentional - it lets the service tests pass before templates are written.

- [ ] **Step 5: Run the test, expect pass**

Run: `pnpm --filter api test -- notifications.service`
Expected: PASS.

- [ ] **Step 6: Type-check and lint**

Run: `pnpm --filter api type-check && pnpm --filter api lint`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/notifications/notifications.service.ts apps/api/src/modules/notifications/templates/index.ts apps/api/src/modules/notifications/__tests__/notifications.service.spec.ts
git commit -m "feat(api): NotificationsService.emit() with delivery routing and stubbed templates"
```

---

### Task 10: Create NotificationPreferencesService with TDD

**Files:**

- Create: `apps/api/src/modules/notification-preferences/notification-preferences.service.ts`
- Create: `apps/api/src/modules/notification-preferences/__tests__/notification-preferences.service.spec.ts`
- Create: `apps/api/src/modules/notification-preferences/notification-preferences.repository.ts`

- [ ] **Step 1: Create the repository**

`apps/api/src/modules/notification-preferences/notification-preferences.repository.ts`:

```ts
import { Injectable, Inject } from "@nestjs/common";
import {
  notificationPreferencesTable,
  type NotificationPreference,
  type NewNotificationPreference,
  type NotificationEventType,
  type NotificationMode,
} from "@aurahire/db";
import { and, eq, inArray } from "drizzle-orm";
import { DRIZZLE_DB } from "../../db/db.tokens"; // confirm path
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

@Injectable()
export class NotificationPreferencesRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async findByUser(userId: string): Promise<NotificationPreference[]> {
    return this.db
      .select()
      .from(notificationPreferencesTable)
      .where(eq(notificationPreferencesTable.userId, userId));
  }

  async findOne(
    userId: string,
    eventType: NotificationEventType,
  ): Promise<NotificationPreference | null> {
    const [row] = await this.db
      .select()
      .from(notificationPreferencesTable)
      .where(
        and(
          eq(notificationPreferencesTable.userId, userId),
          eq(notificationPreferencesTable.eventType, eventType),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async upsert(
    userId: string,
    eventType: NotificationEventType,
    mode: NotificationMode,
  ): Promise<NotificationPreference> {
    const [row] = await this.db
      .insert(notificationPreferencesTable)
      .values({ userId, eventType, mode })
      .onConflictDoUpdate({
        target: [
          notificationPreferencesTable.userId,
          notificationPreferencesTable.eventType,
        ],
        set: { mode, updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  async deleteForCategory(
    userId: string,
    eventTypes: NotificationEventType[],
  ): Promise<number> {
    if (eventTypes.length === 0) return 0;
    const result = await this.db
      .delete(notificationPreferencesTable)
      .where(
        and(
          eq(notificationPreferencesTable.userId, userId),
          inArray(notificationPreferencesTable.eventType, eventTypes),
        ),
      );
    return (result as unknown as { rowCount?: number }).rowCount ?? 0;
  }

  async deleteAllForUser(userId: string): Promise<number> {
    const result = await this.db
      .delete(notificationPreferencesTable)
      .where(eq(notificationPreferencesTable.userId, userId));
    return (result as unknown as { rowCount?: number }).rowCount ?? 0;
  }
}
```

- [ ] **Step 2: Write the failing service test**

`apps/api/src/modules/notification-preferences/__tests__/notification-preferences.service.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { NotificationPreferencesService } from "../notification-preferences.service";
import { NotificationPreferencesRepository } from "../notification-preferences.repository";

const mockRepo = () => ({
  findOne: jest.fn(),
  findByUser: jest.fn(),
  upsert: jest.fn(),
  deleteForCategory: jest.fn(),
  deleteAllForUser: jest.fn(),
});

describe("NotificationPreferencesService", () => {
  let service: NotificationPreferencesService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    repo = mockRepo();
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        { provide: NotificationPreferencesRepository, useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(NotificationPreferencesService);
  });

  describe("getEffectiveMode", () => {
    it("returns the stored mode when a row exists", async () => {
      repo.findOne.mockResolvedValue({ mode: "off" });
      const mode = await service.getEffectiveMode(
        "u1",
        "application_status_changed",
      );
      expect(mode).toBe("off");
    });

    it("falls back to DEFAULT_MODES when no row exists", async () => {
      repo.findOne.mockResolvedValue(null);
      const mode = await service.getEffectiveMode(
        "u1",
        "new_application_received",
      );
      expect(mode).toBe("digest");
    });

    it("always returns 'instant' for SECURITY_EVENTS regardless of stored row", async () => {
      repo.findOne.mockResolvedValue({ mode: "off" });
      const mode = await service.getEffectiveMode(
        "u1",
        "account_password_reset",
      );
      expect(mode).toBe("instant");
    });
  });

  describe("upsert", () => {
    it("rejects security event-types with BadRequest", async () => {
      await expect(
        service.upsert("u1", {
          eventType: "account_password_reset",
          mode: "off",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it("upserts non-security events", async () => {
      repo.upsert.mockResolvedValue({
        eventType: "application_status_changed",
        mode: "off",
      });
      await service.upsert("u1", {
        eventType: "application_status_changed",
        mode: "off",
      });
      expect(repo.upsert).toHaveBeenCalledWith(
        "u1",
        "application_status_changed",
        "off",
      );
    });
  });

  describe("listForRole", () => {
    it("returns one entry per role-visible event with isDefault flag", async () => {
      repo.findByUser.mockResolvedValue([
        { eventType: "application_status_changed", mode: "off" },
      ]);
      const list = await service.listForRole("u1", "candidate");
      const overridden = list.find(
        (x) => x.eventType === "application_status_changed",
      );
      expect(overridden?.mode).toBe("off");
      expect(overridden?.isDefault).toBe(false);
      const stillDefault = list.find(
        (x) => x.eventType === "interview_scheduled",
      );
      expect(stillDefault?.mode).toBe("instant");
      expect(stillDefault?.isDefault).toBe(true);
    });

    it("marks security events with isSecurityLocked", async () => {
      repo.findByUser.mockResolvedValue([]);
      const list = await service.listForRole("u1", "candidate");
      const sec = list.find((x) => x.eventType === "account_password_reset");
      expect(sec?.isSecurityLocked).toBe(true);
      expect(sec?.mode).toBe("instant");
    });
  });

  describe("restoreDefaults", () => {
    it("with category 'all' deletes all preference rows", async () => {
      repo.deleteAllForUser.mockResolvedValue(7);
      const { deleted } = await service.restoreDefaults("u1", {
        category: "all",
      });
      expect(deleted).toBe(7);
      expect(repo.deleteAllForUser).toHaveBeenCalledWith("u1");
    });

    it("with category 'applications' only deletes application-event rows", async () => {
      repo.deleteForCategory.mockResolvedValue(2);
      const { deleted } = await service.restoreDefaults("u1", {
        category: "applications",
      });
      expect(deleted).toBe(2);
      const call = repo.deleteForCategory.mock.calls[0];
      expect(call[1]).toEqual(
        expect.arrayContaining([
          "application_status_changed",
          "new_application_received",
          "candidate_withdrew",
        ]),
      );
    });
  });
});
```

- [ ] **Step 3: Run the test, expect failure**

Run: `pnpm --filter api test -- notification-preferences.service`
Expected: Cannot find module.

- [ ] **Step 4: Create the service**

`apps/api/src/modules/notification-preferences/notification-preferences.service.ts`:

```ts
import { Injectable, BadRequestException } from "@nestjs/common";
import type { NotificationEventType, NotificationMode } from "@aurahire/db";
import { NOTIFICATION_EVENT_TYPE } from "@aurahire/db";
import {
  DEFAULT_MODES,
  SECURITY_EVENTS,
  EVENT_CATEGORIES,
  ROLE_VISIBLE_EVENTS,
  EVENT_LABELS,
  EVENT_DESCRIPTIONS,
  type EventCategory,
} from "../notifications/event-defaults";
import { NotificationPreferencesRepository } from "./notification-preferences.repository";

export interface UpsertPreferenceInput {
  eventType: NotificationEventType;
  mode: NotificationMode;
}

export interface PreferenceListItem {
  eventType: NotificationEventType;
  mode: NotificationMode;
  isDefault: boolean;
  isSecurityLocked: boolean;
  category: EventCategory;
  label: string;
  description: string;
}

export interface RestoreDefaultsInput {
  category: EventCategory | "all";
}

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly repo: NotificationPreferencesRepository) {}

  async getEffectiveMode(
    userId: string,
    eventType: NotificationEventType,
  ): Promise<NotificationMode> {
    if (SECURITY_EVENTS.has(eventType)) return "instant";
    const row = await this.repo.findOne(userId, eventType);
    return row?.mode ?? DEFAULT_MODES[eventType];
  }

  async upsert(userId: string, input: UpsertPreferenceInput) {
    if (SECURITY_EVENTS.has(input.eventType)) {
      throw new BadRequestException(
        "This event type is required for security and cannot be modified.",
      );
    }
    return this.repo.upsert(userId, input.eventType, input.mode);
  }

  async listForRole(
    userId: string,
    role: "candidate" | "recruiter" | "admin",
  ): Promise<PreferenceListItem[]> {
    const visible = ROLE_VISIBLE_EVENTS[role];
    const stored = await this.repo.findByUser(userId);
    const map = new Map(stored.map((r) => [r.eventType, r.mode]));

    return visible.map((eventType) => {
      const isSecurityLocked = SECURITY_EVENTS.has(eventType);
      const overridden = map.get(eventType);
      const mode = isSecurityLocked
        ? "instant"
        : (overridden ?? DEFAULT_MODES[eventType]);
      return {
        eventType,
        mode,
        isDefault: !isSecurityLocked && overridden === undefined,
        isSecurityLocked,
        category: EVENT_CATEGORIES[eventType],
        label: EVENT_LABELS[eventType],
        description: EVENT_DESCRIPTIONS[eventType],
      };
    });
  }

  async restoreDefaults(userId: string, input: RestoreDefaultsInput) {
    if (input.category === "all") {
      const deleted = await this.repo.deleteAllForUser(userId);
      return { deleted };
    }
    const eventsInCategory = NOTIFICATION_EVENT_TYPE.filter(
      (e) => EVENT_CATEGORIES[e] === input.category && !SECURITY_EVENTS.has(e),
    );
    const deleted = await this.repo.deleteForCategory(userId, eventsInCategory);
    return { deleted };
  }
}
```

- [ ] **Step 5: Run the test, expect pass**

Run: `pnpm --filter api test -- notification-preferences.service`
Expected: PASS.

- [ ] **Step 6: Type-check and lint**

Run: `pnpm --filter api type-check && pnpm --filter api lint`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/notification-preferences/
git commit -m "feat(api): NotificationPreferencesService (effective mode, listForRole, restoreDefaults)"
```

---

### Task 11: Wire notifications + preferences modules

**Files:**

- Create: `apps/api/src/modules/notifications/notifications.module.ts`
- Create: `apps/api/src/modules/notifications/queues.ts`
- Create: `apps/api/src/modules/notification-preferences/notification-preferences.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create `apps/api/src/modules/notifications/queues.ts`**

```ts
export const NOTIFICATION_EMAIL_QUEUE = "notification-email";

export type NotificationEmailJobData =
  | { kind: "instant"; notificationId: string }
  | { kind: "digest"; userId: string; notificationIds: string[] };
```

- [ ] **Step 2: Create `apps/api/src/modules/notifications/notifications.module.ts`**

```ts
import { Module, forwardRef } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationEmailProcessor } from "./notification-email.processor";
import { NOTIFICATION_EMAIL_QUEUE } from "./queues";
import { NotificationPreferencesModule } from "../notification-preferences/notification-preferences.module";
import { ProfilesModule } from "../profiles/profiles.module"; // confirm
import { EmailModule } from "../../email/email.module";
import { AuditModule } from "../../audit/audit.module";

@Module({
  imports: [
    BullModule.registerQueue({ name: NOTIFICATION_EMAIL_QUEUE }),
    forwardRef(() => NotificationPreferencesModule),
    ProfilesModule,
    EmailModule,
    AuditModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationEmailProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

> The `NotificationsController` and `NotificationEmailProcessor` are landed in later tasks; this module wiring is written first so subsequent tasks can compile against it. If the linter complains in the meantime, add temporary minimal class stubs that the next tasks replace.

- [ ] **Step 3: Create temporary minimal stubs so the module compiles**

`apps/api/src/modules/notifications/notifications.controller.ts`:

```ts
import { Controller } from "@nestjs/common";

@Controller("notifications")
export class NotificationsController {}
```

`apps/api/src/modules/notifications/notification-email.processor.ts`:

```ts
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { NOTIFICATION_EMAIL_QUEUE } from "./queues";

@Processor(NOTIFICATION_EMAIL_QUEUE)
export class NotificationEmailProcessor extends WorkerHost {
  async process(): Promise<void> {
    return;
  }
}
```

These are placeholders intentionally - Tasks 15 and 16 replace them with the real implementations.

- [ ] **Step 4: Create `apps/api/src/modules/notification-preferences/notification-preferences.module.ts`**

```ts
import { Module, forwardRef } from "@nestjs/common";
import { NotificationPreferencesController } from "./notification-preferences.controller";
import { NotificationPreferencesService } from "./notification-preferences.service";
import { NotificationPreferencesRepository } from "./notification-preferences.repository";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditModule } from "../../audit/audit.module";

@Module({
  imports: [forwardRef(() => NotificationsModule), AuditModule],
  controllers: [NotificationPreferencesController],
  providers: [
    NotificationPreferencesService,
    NotificationPreferencesRepository,
  ],
  exports: [NotificationPreferencesService],
})
export class NotificationPreferencesModule {}
```

- [ ] **Step 5: Stub the preferences controller**

`apps/api/src/modules/notification-preferences/notification-preferences.controller.ts`:

```ts
import { Controller } from "@nestjs/common";

@Controller("notification-preferences")
export class NotificationPreferencesController {}
```

- [ ] **Step 6: Register both modules in `apps/api/src/app.module.ts`**

In the imports array, add:

```ts
NotificationsModule,
NotificationPreferencesModule,
```

plus the corresponding imports at the top of the file.

- [ ] **Step 7: Type-check and lint**

Run: `pnpm --filter api type-check && pnpm --filter api lint`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/notifications/notifications.module.ts apps/api/src/modules/notifications/queues.ts apps/api/src/modules/notifications/notifications.controller.ts apps/api/src/modules/notifications/notification-email.processor.ts apps/api/src/modules/notification-preferences/notification-preferences.module.ts apps/api/src/modules/notification-preferences/notification-preferences.controller.ts apps/api/src/app.module.ts
git commit -m "feat(api): wire notifications and notification-preferences modules"
```

---

## Phase 4 - Email templates and queue processor

### Task 12: Create the templates registry and base layout

**Files:**

- Modify: `apps/api/src/modules/notifications/templates/index.ts` (replace stub)
- Create: `apps/api/src/modules/notifications/templates/base-layout.tsx`
- Create: `apps/api/src/modules/notifications/__tests__/templates.spec.ts`

- [ ] **Step 1: Create `templates/base-layout.tsx`**

```tsx
import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";

interface BaseLayoutProps {
  preview: string;
  children: React.ReactNode;
  unsubscribePath: string;
  appOrigin: string;
}

export function BaseLayout({
  preview,
  children,
  unsubscribePath,
  appOrigin,
}: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#f7f7f7",
          fontFamily:
            "Inter, -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
          color: "#0a0b0d",
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            margin: "0 auto",
            padding: 32,
            backgroundColor: "#ffffff",
            borderRadius: 16,
          }}
        >
          <Section style={{ paddingBottom: 24 }}>
            <Heading
              as="h1"
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "#2563eb",
                margin: 0,
              }}
            >
              AuraHire
            </Heading>
          </Section>
          {children}
          <Hr
            style={{
              border: 0,
              borderTop: "1px solid #dee1e6",
              margin: "32px 0 16px",
            }}
          />
          <Text style={{ fontSize: 12, color: "#7c828a", lineHeight: 1.5 }}>
            You're receiving this because of your AuraHire notification
            preferences.{" "}
            <Link
              href={`${appOrigin}${unsubscribePath}`}
              style={{ color: "#2563eb" }}
            >
              Manage notification settings
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const brandStyles = {
  ctaPrimary: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    padding: "12px 24px",
    borderRadius: 100,
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
    display: "inline-block",
  },
  body: {
    fontSize: 16,
    color: "#0a0b0d",
    lineHeight: 1.5,
    margin: "0 0 16px",
  },
  bodyMuted: {
    fontSize: 14,
    color: "#5b616e",
    lineHeight: 1.5,
    margin: "0 0 16px",
  },
} as const;
```

- [ ] **Step 2: Replace the stub `templates/index.ts` with the full registry**

```ts
import * as React from "react";
import type { NotificationEventType } from "@aurahire/db";
import { BaseLayout, brandStyles } from "./base-layout";
import {
  Bell,
  Briefcase,
  Calendar,
  Check,
  Mail,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
  X,
  AlertCircle,
  Clock,
  Settings,
} from "lucide-react";

type Metadata = Record<string, unknown>;
type Role = "candidate" | "recruiter" | "admin";

const m = <T,>(metadata: Metadata, key: string, fallback: T): T => {
  const v = metadata[key];
  return (v ?? fallback) as T;
};

interface TemplateDefinition {
  buildTitle(metadata: Metadata): string;
  buildBody(metadata: Metadata): string;
  buildLink(role: Role, metadata: Metadata): string | null;
  emailSubject(metadata: Metadata): string;
  EmailComponent: React.FC<{ metadata: Metadata; appOrigin: string; role: Role }>;
  iconName: string;
}

const buildPersonalEmail =
  (
    headline: (md: Metadata) => string,
    body: (md: Metadata) => string,
    ctaLabel: (md: Metadata) => string | null,
    linkBuilder: (role: Role, md: Metadata) => string | null,
  ): TemplateDefinition["EmailComponent"] =>
  ({ metadata, appOrigin, role }) => {
    const link = linkBuilder(role, metadata);
    const cta = ctaLabel(metadata);
    return (
      <BaseLayout
        preview={headline(metadata)}
        appOrigin={appOrigin}
        unsubscribePath={`/${role}/settings/notifications`}
      >
        <h2 style={{ fontSize: 24, fontWeight: 400, margin: "0 0 16px" }}>
          {headline(metadata)}
        </h2>
        <p style={brandStyles.body}>{body(metadata)}</p>
        {cta && link && (
          <p style={{ marginTop: 24 }}>
            <a href={`${appOrigin}${link}`} style={brandStyles.ctaPrimary}>
              {cta}
            </a>
          </p>
        )}
      </BaseLayout>
    );
  };

export const TEMPLATES: Record<NotificationEventType, TemplateDefinition> = {
  application_status_changed: {
    buildTitle: (md) => `Application moved to ${m(md, "newStatus", "next stage")}`,
    buildBody: (md) =>
      `${m(md, "jobTitle", "your role")} at ${m(md, "companyName", "the company")} - your application is now in ${m(md, "newStatus", "the next stage")}.`,
    buildLink: (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    emailSubject: (md) => `Application update: ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      (md) => `Application moved to ${m(md, "newStatus", "next stage")}`,
      (md) => `Your application for ${m(md, "jobTitle", "this role")} at ${m(md, "companyName", "the company")} is now in ${m(md, "newStatus", "a new stage")}.`,
      () => "View application",
      (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "Briefcase",
  },
  interview_scheduled: {
    buildTitle: (md) => `Interview scheduled - ${m(md, "jobTitle", "your role")}`,
    buildBody: (md) => `Scheduled for ${m(md, "startTime", "TBD")} (${m(md, "format", "video")}).`,
    buildLink: (role, md) =>
      role === "recruiter"
        ? `/recruiter/interviews/${m(md, "interviewId", "")}`
        : `/candidate/interviews/${m(md, "interviewId", "")}`,
    emailSubject: (md) => `Interview scheduled: ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      (md) => `Interview scheduled`,
      (md) => `${m(md, "jobTitle", "your role")} interview on ${m(md, "startTime", "TBD")} (${m(md, "format", "video")}).`,
      () => "View interview",
      (role, md) =>
        role === "recruiter"
          ? `/recruiter/interviews/${m(md, "interviewId", "")}`
          : `/candidate/interviews/${m(md, "interviewId", "")}`,
    ),
    iconName: "Calendar",
  },
  interview_reminder_24h: {
    buildTitle: () => `Interview tomorrow`,
    buildBody: (md) => `${m(md, "jobTitle", "your role")} at ${m(md, "startTime", "tomorrow")}.`,
    buildLink: (_role, md) => `/candidate/interviews/${m(md, "interviewId", "")}`,
    emailSubject: () => `Reminder: your interview is tomorrow`,
    EmailComponent: buildPersonalEmail(
      () => `Your interview is tomorrow`,
      (md) => `${m(md, "jobTitle", "your role")} on ${m(md, "startTime", "tomorrow")}.`,
      () => "View details",
      (_role, md) => `/candidate/interviews/${m(md, "interviewId", "")}`,
    ),
    iconName: "Clock",
  },
  interview_cancelled: {
    buildTitle: () => `Interview cancelled`,
    buildBody: (md) => `Your interview for ${m(md, "jobTitle", "this role")} was cancelled.`,
    buildLink: (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    emailSubject: (md) => `Interview cancelled: ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      () => `Interview cancelled`,
      (md) => `Your interview for ${m(md, "jobTitle", "this role")} at ${m(md, "companyName", "the company")} was cancelled.`,
      () => "View application",
      (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "X",
  },
  offer_received: {
    buildTitle: () => `Offer received`,
    buildBody: (md) =>
      `${m(md, "jobTitle", "your role")} at ${m(md, "companyName", "the company")} - review and respond by ${m(md, "expiresAt", "the deadline")}.`,
    buildLink: (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    emailSubject: () => `You received an offer`,
    EmailComponent: buildPersonalEmail(
      (md) => `Offer received: ${m(md, "jobTitle", "your role")}`,
      (md) =>
        `${m(md, "companyName", "The company")} sent you an offer. Respond by ${m(md, "expiresAt", "the deadline")}.`,
      () => "Review offer",
      (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "Check",
  },
  offer_expiring_soon: {
    buildTitle: () => `Offer expires within 24 hours`,
    buildBody: (md) =>
      `${m(md, "jobTitle", "your role")} at ${m(md, "companyName", "the company")} expires ${m(md, "expiresAt", "soon")}.`,
    buildLink: (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    emailSubject: () => `Your offer expires within 24 hours`,
    EmailComponent: buildPersonalEmail(
      () => `Your offer expires within 24 hours`,
      (md) => `${m(md, "jobTitle", "your role")} at ${m(md, "companyName", "the company")}.`,
      () => "Review offer",
      (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "Clock",
  },
  new_application_received: {
    buildTitle: (md) => `New application: ${m(md, "candidateName", "a candidate")}`,
    buildBody: (md) =>
      `Applied to ${m(md, "jobTitle", "your role")} - match score ${m(md, "scoreValue", "-")} (${m(md, "matchBand", "-")}).`,
    buildLink: (_role, md) =>
      `/recruiter/jobs/${m(md, "jobId", "")}/applications/${m(md, "applicationId", "")}`,
    emailSubject: (md) => `New application - ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      (md) => `New application from ${m(md, "candidateName", "a candidate")}`,
      (md) => `Applied to ${m(md, "jobTitle", "your role")}. Match score ${m(md, "scoreValue", "-")}.`,
      () => "Review application",
      (_role, md) =>
        `/recruiter/jobs/${m(md, "jobId", "")}/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "UserPlus",
  },
  candidate_withdrew: {
    buildTitle: (md) => `${m(md, "candidateName", "A candidate")} withdrew`,
    buildBody: (md) => `Withdrew from ${m(md, "jobTitle", "your role")}.`,
    buildLink: (_role, md) =>
      `/recruiter/jobs/${m(md, "jobId", "")}/applications/${m(md, "applicationId", "")}`,
    emailSubject: (md) => `Candidate withdrew - ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      (md) => `${m(md, "candidateName", "A candidate")} withdrew`,
      (md) => `Withdrew their application for ${m(md, "jobTitle", "your role")}.`,
      () => "View application",
      (_role, md) =>
        `/recruiter/jobs/${m(md, "jobId", "")}/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "UserMinus",
  },
  interview_feedback_due: {
    buildTitle: () => `Interview feedback due`,
    buildBody: (md) => `${m(md, "candidateName", "the candidate")} for ${m(md, "jobTitle", "this role")}.`,
    buildLink: (_role, md) => `/recruiter/interviews/${m(md, "interviewId", "")}`,
    emailSubject: () => `Interview feedback overdue`,
    EmailComponent: buildPersonalEmail(
      () => `Interview feedback overdue`,
      (md) => `Please file feedback for ${m(md, "candidateName", "the candidate")} (${m(md, "jobTitle", "this role")}).`,
      () => "Submit feedback",
      (_role, md) => `/recruiter/interviews/${m(md, "interviewId", "")}`,
    ),
    iconName: "AlertCircle",
  },
  offer_accepted: {
    buildTitle: (md) => `${m(md, "candidateName", "Candidate")} accepted your offer`,
    buildBody: (md) => `${m(md, "jobTitle", "your role")}.`,
    buildLink: (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}`,
    emailSubject: (md) => `${m(md, "candidateName", "Candidate")} accepted your offer`,
    EmailComponent: buildPersonalEmail(
      (md) => `${m(md, "candidateName", "Candidate")} accepted your offer`,
      (md) => `Offer for ${m(md, "jobTitle", "your role")} accepted.`,
      () => "View job",
      (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}`,
    ),
    iconName: "Check",
  },
  offer_declined: {
    buildTitle: (md) => `${m(md, "candidateName", "Candidate")} declined your offer`,
    buildBody: (md) => `${m(md, "jobTitle", "your role")}.`,
    buildLink: (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}`,
    emailSubject: (md) => `${m(md, "candidateName", "Candidate")} declined your offer`,
    EmailComponent: buildPersonalEmail(
      (md) => `${m(md, "candidateName", "Candidate")} declined your offer`,
      (md) => `Offer for ${m(md, "jobTitle", "your role")} declined.`,
      () => "View job",
      (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}`,
    ),
    iconName: "X",
  },
  bias_flag_raised: {
    buildTitle: () => `Bias flag on your job description`,
    buildBody: (md) => `${m(md, "jobTitle", "your JD")} - ${m(md, "flagSummary", "review flagged language")}.`,
    buildLink: (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}/bias`,
    emailSubject: (md) => `Bias flag - ${m(md, "jobTitle", "your JD")}`,
    EmailComponent: buildPersonalEmail(
      () => `Bias flag on your job description`,
      (md) => `${m(md, "jobTitle", "your JD")}: ${m(md, "flagSummary", "review flagged language")}.`,
      () => "Review flag",
      (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}/bias`,
    ),
    iconName: "ShieldAlert",
  },
  team_invite_accepted: {
    buildTitle: (md) => `${m(md, "memberName", "A team member")} accepted your invite`,
    buildBody: (md) => `${m(md, "companyName", "your company")}.`,
    buildLink: () => `/recruiter/settings/members`,
    emailSubject: () => `Team invite accepted`,
    EmailComponent: buildPersonalEmail(
      (md) => `${m(md, "memberName", "A team member")} accepted your invite`,
      (md) => `Joined ${m(md, "companyName", "your company")}.`,
      () => "View team",
      () => `/recruiter/settings/members`,
    ),
    iconName: "UserCheck",
  },
  team_invite_declined: {
    buildTitle: (md) => `${m(md, "memberName", "A team member")} declined your invite`,
    buildBody: (md) => `${m(md, "companyName", "your company")}.`,
    buildLink: () => `/recruiter/settings/members`,
    emailSubject: () => `Team invite declined`,
    EmailComponent: buildPersonalEmail(
      (md) => `${m(md, "memberName", "A team member")} declined your invite`,
      (md) => `${m(md, "companyName", "your company")}.`,
      () => "View team",
      () => `/recruiter/settings/members`,
    ),
    iconName: "UserMinus",
  },
  system_bias_flag_raised: {
    buildTitle: () => `Bias flag system-wide`,
    buildBody: (md) =>
      `${m(md, "companyName", "A company")} - ${m(md, "jobTitle", "JD")} - ${m(md, "flagSummary", "language review")}.`,
    buildLink: (_role, md) => `/admin/bias-flags/${m(md, "flagId", "")}`,
    emailSubject: () => `System bias flag`,
    EmailComponent: buildPersonalEmail(
      () => `System bias flag`,
      (md) =>
        `${m(md, "companyName", "A company")} - ${m(md, "jobTitle", "JD")}: ${m(md, "flagSummary", "language review")}.`,
      () => "Review",
      (_role, md) => `/admin/bias-flags/${m(md, "flagId", "")}`,
    ),
    iconName: "ShieldAlert",
  },
  system_ai_scoring_failure: {
    buildTitle: () => `AI scoring failure`,
    buildBody: (md) => `${m(md, "summary", "An AI scoring job failed")}.`,
    buildLink: (_role, md) => `/admin/ai-failures/${m(md, "failureId", "")}`,
    emailSubject: () => `AI scoring failure`,
    EmailComponent: buildPersonalEmail(
      () => `AI scoring failure`,
      (md) => `${m(md, "summary", "An AI scoring job failed")}.`,
      () => "Investigate",
      (_role, md) => `/admin/ai-failures/${m(md, "failureId", "")}`,
    ),
    iconName: "AlertCircle",
  },
  system_moderation_queue_item: {
    buildTitle: (md) => `Moderation queue: ${m(md, "kind", "item")}`,
    buildBody: (md) => `${m(md, "summary", "A new item entered the moderation queue.")}`,
    buildLink: () => `/admin/moderation`,
    emailSubject: () => `Moderation queue update`,
    EmailComponent: buildPersonalEmail(
      (md) => `Moderation queue: ${m(md, "kind", "item")}`,
      (md) => `${m(md, "summary", "A new item entered the moderation queue.")}`,
      () => "Open queue",
      () => `/admin/moderation`,
    ),
    iconName: "Settings",
  },
  account_password_reset: {
    buildTitle: () => `Password reset confirmed`,
    buildBody: () => `Your password was changed. If this wasn't you, contact support immediately.`,
    buildLink: (role) => `/${role}/settings/security`,
    emailSubject: () => `Password reset confirmation`,
    EmailComponent: buildPersonalEmail(
      () => `Password reset confirmed`,
      () => `Your AuraHire password was changed. If this wasn't you, contact support immediately.`,
      () => "Review security settings",
      (role) => `/${role}/settings/security`,
    ),
    iconName: "ShieldCheck",
  },
  account_email_verified: {
    buildTitle: () => `Email verified`,
    buildBody: () => `Your email address was successfully verified.`,
    buildLink: (role) => `/${role}/settings/security`,
    emailSubject: () => `Email verified`,
    EmailComponent: buildPersonalEmail(
      () => `Email verified`,
      () => `Your AuraHire email address was verified.`,
      () => "View account",
      (role) => `/${role}/settings/security`,
    ),
    iconName: "ShieldCheck",
  },
  account_login_new_device: {
    buildTitle: () => `New device login`,
    buildBody: (md) =>
      `Login from ${m(md, "browser", "an unknown browser")} (${m(md, "location", "unknown location")}). If this wasn't you, reset your password immediately.`,
    buildLink: (role) => `/${role}/settings/security`,
    emailSubject: () => `New login from an unrecognized device`,
    EmailComponent: buildPersonalEmail(
      () => `New device login`,
      (md) =>
        `Login from ${m(md, "browser", "an unknown browser")} (${m(md, "location", "unknown location")}). If this wasn't you, reset your password immediately.`,
      () => "Reset password",
      (role) => `/${role}/settings/security`,
    ),
    iconName: "ShieldAlert",
  },
};

export function buildTitle(eventType: NotificationEventType, metadata: Metadata): string {
  return TEMPLATES[eventType].buildTitle(metadata);
}

export function buildBody(eventType: NotificationEventType, metadata: Metadata): string {
  return TEMPLATES[eventType].buildBody(metadata);
}

export function buildLink(
  eventType: NotificationEventType,
  role: Role,
  metadata: Metadata,
): string | null {
  return TEMPLATES[eventType].buildLink(role, metadata);
}

export function emailSubject(eventType: NotificationEventType, metadata: Metadata): string {
  return TEMPLATES[eventType].emailSubject(metadata);
}

export function getEmailComponent(eventType: NotificationEventType) {
  return TEMPLATES[eventType].EmailComponent;
}

export function getIconName(eventType: NotificationEventType): string {
  return TEMPLATES[eventType].iconName;
}
```

- [ ] **Step 3: Create `templates.spec.ts`**

```ts
import { NOTIFICATION_EVENT_TYPE } from "@aurahire/db";
import {
  buildTitle,
  buildBody,
  buildLink,
  emailSubject,
  getIconName,
} from "../templates";

describe("template registry", () => {
  it("every event type has a non-empty title, body, subject, and icon", () => {
    for (const eventType of NOTIFICATION_EVENT_TYPE) {
      expect(buildTitle(eventType, {})).toBeTruthy();
      expect(buildBody(eventType, {})).toBeTruthy();
      expect(emailSubject(eventType, {})).toBeTruthy();
      expect(getIconName(eventType)).toBeTruthy();
    }
  });

  it("buildLink returns null or an absolute path", () => {
    for (const eventType of NOTIFICATION_EVENT_TYPE) {
      const link = buildLink(eventType, "candidate", { applicationId: "x" });
      expect(link === null || link.startsWith("/")).toBe(true);
    }
  });

  it("application_status_changed renders the new status in the title", () => {
    expect(
      buildTitle("application_status_changed", { newStatus: "Interview" }),
    ).toContain("Interview");
  });

  it("system events route to /admin/* paths", () => {
    expect(
      buildLink("system_bias_flag_raised", "admin", { flagId: "f1" }),
    ).toBe("/admin/bias-flags/f1");
    expect(buildLink("system_moderation_queue_item", "admin", {})).toBe(
      "/admin/moderation",
    );
  });

  it("account events route to the recipient's role-specific security page", () => {
    expect(buildLink("account_password_reset", "candidate", {})).toBe(
      "/candidate/settings/security",
    );
    expect(buildLink("account_password_reset", "recruiter", {})).toBe(
      "/recruiter/settings/security",
    );
    expect(buildLink("account_password_reset", "admin", {})).toBe(
      "/admin/settings/security",
    );
  });
});
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm --filter api test -- templates`
Expected: PASS.

- [ ] **Step 5: Type-check and lint**

Run: `pnpm --filter api type-check && pnpm --filter api lint`
Expected: No errors. JSX in `.tsx` files in the api may need a `tsconfig` adjustment - verify by checking if existing email templates compile (look for `apps/api/src/email/templates/` if any). If existing templates use a specific `tsconfig` setup, mirror it.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/notifications/templates/ apps/api/src/modules/notifications/__tests__/templates.spec.ts
git commit -m "feat(api): notification templates registry + base layout for 20 event types"
```

---

### Task 13: Create the digest email template

**Files:**

- Create: `apps/api/src/modules/notifications/templates/digest-email.tsx`

- [ ] **Step 1: Create the digest template**

```tsx
import * as React from "react";
import { BaseLayout, brandStyles } from "./base-layout";
import { TEMPLATES, type Metadata } from "./index";
import type { NotificationEventType } from "@aurahire/db";
import { EVENT_CATEGORIES } from "../event-defaults";

interface DigestRow {
  id: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  link: string | null;
  metadata: Metadata;
  createdAt: string;
}

interface DigestEmailProps {
  rows: DigestRow[];
  appOrigin: string;
  role: "candidate" | "recruiter" | "admin";
}

const CATEGORY_LABELS: Record<string, string> = {
  applications: "Applications",
  interviews: "Interviews",
  offers: "Offers",
  bias: "Bias & fairness",
  team: "Team",
  system: "System",
  account: "Account & security",
};

export function DigestEmail({ rows, appOrigin, role }: DigestEmailProps) {
  const grouped = new Map<string, DigestRow[]>();
  for (const row of rows) {
    const cat = EVENT_CATEGORIES[row.eventType];
    const arr = grouped.get(cat) ?? [];
    arr.push(row);
    grouped.set(cat, arr);
  }

  const total = rows.length;
  const preview = `${total} update${total === 1 ? "" : "s"} from AuraHire`;

  return (
    <BaseLayout
      preview={preview}
      appOrigin={appOrigin}
      unsubscribePath={`/${role}/settings/notifications`}
    >
      <h2 style={{ fontSize: 28, fontWeight: 400, margin: "0 0 8px" }}>
        Your AuraHire daily summary
      </h2>
      <p style={brandStyles.bodyMuted}>
        {total} update{total === 1 ? "" : "s"} since yesterday.
      </p>
      {Array.from(grouped.entries()).map(([category, categoryRows]) => (
        <div key={category} style={{ marginTop: 24 }}>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#5b616e",
              margin: "0 0 12px",
            }}
          >
            {CATEGORY_LABELS[category] ?? category}
          </h3>
          {categoryRows.map((row) => (
            <div
              key={row.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid #eef0f3",
              }}
            >
              <p
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  margin: "0 0 4px",
                  color: "#0a0b0d",
                }}
              >
                {row.title}
              </p>
              <p style={{ fontSize: 14, color: "#5b616e", margin: 0 }}>
                {row.body}
              </p>
              {row.link && (
                <p style={{ marginTop: 8 }}>
                  <a
                    href={`${appOrigin}${row.link}`}
                    style={{
                      color: "#2563eb",
                      textDecoration: "none",
                      fontSize: 14,
                    }}
                  >
                    View →
                  </a>
                </p>
              )}
            </div>
          ))}
        </div>
      ))}
    </BaseLayout>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter api type-check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/notifications/templates/digest-email.tsx
git commit -m "feat(api): digest email template grouping notifications by category"
```

---

### Task 14: Implement notification-email processor

**Files:**

- Modify: `apps/api/src/modules/notifications/notification-email.processor.ts` (replace stub)
- Create: `apps/api/src/modules/notifications/__tests__/notification-email.processor.spec.ts`

- [ ] **Step 1: Replace the stub processor with the full implementation**

```ts
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { render } from "@react-email/render";
import * as React from "react";
import {
  NOTIFICATION_EMAIL_QUEUE,
  type NotificationEmailJobData,
} from "./queues";
import { NotificationsRepository } from "./notifications.repository";
import { ProfilesRepository } from "../profiles/profiles.repository"; // confirm
import { EmailService } from "../../email/email.service";
import { ConfigService } from "@nestjs/config";
import { TEMPLATES, emailSubject } from "./templates";
import { DigestEmail } from "./templates/digest-email";

@Processor(NOTIFICATION_EMAIL_QUEUE)
export class NotificationEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationEmailProcessor.name);

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly profiles: ProfilesRepository,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<NotificationEmailJobData>): Promise<void> {
    if (job.data.kind === "instant") {
      await this.processInstant(job.data.notificationId);
    } else {
      await this.processDigest(job.data.userId, job.data.notificationIds);
    }
  }

  private async processInstant(notificationId: string): Promise<void> {
    const row = await this.repo.findById(notificationId);
    if (!row) {
      this.logger.warn(
        `processInstant: notification not found: ${notificationId}`,
      );
      return;
    }
    if (row.emailSentAt) {
      this.logger.debug(`processInstant: already sent: ${notificationId}`);
      return;
    }
    const profile = await this.profiles.findById(row.userId);
    if (!profile) return;

    const role = profile.role as "candidate" | "recruiter" | "admin";
    const tpl = TEMPLATES[row.eventType];
    const appOrigin =
      this.config.get<string>("APP_ORIGIN") ?? "http://localhost:3000";
    const html = await render(
      React.createElement(tpl.EmailComponent, {
        metadata: row.metadata ?? {},
        appOrigin,
        role,
      }),
    );

    await this.email.send({
      to: profile.email,
      subject: emailSubject(row.eventType, row.metadata ?? {}),
      template: html,
    });
    await this.repo.setEmailSent(notificationId);
  }

  private async processDigest(
    userId: string,
    notificationIds: string[],
  ): Promise<void> {
    const profile = await this.profiles.findById(userId);
    if (!profile) return;
    const rows = await Promise.all(
      notificationIds.map((id) => this.repo.findById(id)),
    );
    const validRows = rows
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({
        id: r.id,
        eventType: r.eventType,
        title: r.title,
        body: r.body,
        link: r.link,
        metadata: r.metadata ?? {},
        createdAt: r.createdAt.toISOString(),
      }));
    if (validRows.length === 0) return;

    const role = profile.role as "candidate" | "recruiter" | "admin";
    const appOrigin =
      this.config.get<string>("APP_ORIGIN") ?? "http://localhost:3000";
    const html = await render(
      React.createElement(DigestEmail, { rows: validRows, appOrigin, role }),
    );

    await this.email.send({
      to: profile.email,
      subject: `Your AuraHire daily summary - ${validRows.length} update${
        validRows.length === 1 ? "" : "s"
      }`,
      template: html,
    });
    await Promise.all(validRows.map((r) => this.repo.setEmailSent(r.id)));
  }
}
```

- [ ] **Step 2: Write a focused processor test**

`__tests__/notification-email.processor.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { NotificationEmailProcessor } from "../notification-email.processor";
import { NotificationsRepository } from "../notifications.repository";
import { ProfilesRepository } from "../../profiles/profiles.repository"; // confirm
import { EmailService } from "../../../email/email.service";
import { ConfigService } from "@nestjs/config";

describe("NotificationEmailProcessor", () => {
  let processor: NotificationEmailProcessor;
  let repo: any;
  let profiles: any;
  let email: any;

  beforeEach(async () => {
    repo = {
      findById: jest.fn(),
      setEmailSent: jest.fn(),
    };
    profiles = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: "u1", email: "u@x.io", role: "candidate" }),
    };
    email = { send: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationEmailProcessor,
        { provide: NotificationsRepository, useValue: repo },
        { provide: ProfilesRepository, useValue: profiles },
        { provide: EmailService, useValue: email },
        {
          provide: ConfigService,
          useValue: { get: () => "http://localhost:3000" },
        },
      ],
    }).compile();
    processor = moduleRef.get(NotificationEmailProcessor);
  });

  it("instant: sends email and marks emailSentAt", async () => {
    repo.findById.mockResolvedValue({
      id: "n1",
      userId: "u1",
      eventType: "application_status_changed",
      title: "t",
      body: "b",
      link: "/x",
      metadata: { newStatus: "Interview" },
      emailSentAt: null,
      createdAt: new Date(),
    });
    await processor.process({
      data: { kind: "instant", notificationId: "n1" },
    } as any);
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(repo.setEmailSent).toHaveBeenCalledWith("n1");
  });

  it("instant: short-circuits when emailSentAt is set", async () => {
    repo.findById.mockResolvedValue({
      id: "n1",
      userId: "u1",
      eventType: "application_status_changed",
      emailSentAt: new Date(),
      metadata: {},
      createdAt: new Date(),
      title: "t",
      body: "b",
      link: null,
    });
    await processor.process({
      data: { kind: "instant", notificationId: "n1" },
    } as any);
    expect(email.send).not.toHaveBeenCalled();
    expect(repo.setEmailSent).not.toHaveBeenCalled();
  });

  it("digest: renders one email and marks every included row sent", async () => {
    const baseRow = {
      eventType: "application_status_changed" as const,
      title: "t",
      body: "b",
      link: "/x",
      metadata: {},
      createdAt: new Date(),
      emailSentAt: null,
      userId: "u1",
    };
    repo.findById
      .mockResolvedValueOnce({ ...baseRow, id: "n1" })
      .mockResolvedValueOnce({ ...baseRow, id: "n2" });
    await processor.process({
      data: { kind: "digest", userId: "u1", notificationIds: ["n1", "n2"] },
    } as any);
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(repo.setEmailSent).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter api test -- notification-email.processor`
Expected: PASS.

- [ ] **Step 4: Type-check and lint**

Run: `pnpm --filter api type-check && pnpm --filter api lint`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/notifications/notification-email.processor.ts apps/api/src/modules/notifications/__tests__/notification-email.processor.spec.ts
git commit -m "feat(api): notification-email processor (instant + digest paths with idempotency)"
```

---

## Phase 5 - HTTP controllers

### Task 15: Notifications controller

**Files:**

- Modify: `apps/api/src/modules/notifications/notifications.controller.ts` (replace stub)
- Create: `apps/api/src/modules/notifications/dto/list-notifications.dto.ts`
- Modify: `apps/api/src/modules/notifications/notifications.service.ts` (add list/count/mark-read/dismiss methods that delegate to repo + audit)
- Modify: `apps/api/src/audit/audit.types.ts` (add new action constants)
- Create: `apps/api/src/modules/notifications/__tests__/notifications.controller.spec.ts`

- [ ] **Step 1: Add audit action constants**

In `apps/api/src/audit/audit.types.ts`, append (or insert into the appropriate location):

```ts
NOTIFICATIONS_MARKED_ALL_READ: "notifications.marked_all_read",
NOTIFICATION_PREFERENCE_UPDATED: "notification_preferences.updated",
NOTIFICATION_PREFERENCES_RESET: "notification_preferences.reset",
DIGEST_EMAIL_BATCH_RUN: "notifications.digest_email_batch_run",
NOTIFICATIONS_RETENTION_RUN: "notifications.retention_run",
INTERVIEW_REMINDER_RUN: "cron.interview_reminder_run",
OFFER_EXPIRY_REMINDER_RUN: "cron.offer_expiry_reminder_run",
INTERVIEW_FEEDBACK_DUE_RUN: "cron.interview_feedback_due_run",
SYSTEM_AI_SCORING_FAILURE_NOTIFIED: "system.ai_scoring_failure_notified",
```

Match the existing key/value style - if the file uses a TypeScript `as const` object, add them inside; if it's a string-enum, add them as enum members.

- [ ] **Step 2: Create the list DTO**

`apps/api/src/modules/notifications/dto/list-notifications.dto.ts`:

```ts
import { createZodDto } from "nestjs-zod";
import { listNotificationsQuerySchema } from "@aurahire/shared";

export class ListNotificationsDto extends createZodDto(
  listNotificationsQuerySchema,
) {}
```

- [ ] **Step 3: Add list/count/mark-read/dismiss methods to `NotificationsService`**

Open `apps/api/src/modules/notifications/notifications.service.ts` and append (after `emit` and `emitMany`):

```ts
  async listForUser(userId: string, query: { tab: "unread" | "all"; limit: number; cursor?: string }) {
    const result = await this.repo.listForUser(userId, query);
    return {
      items: result.items.map((row) => ({
        id: row.id,
        eventType: row.eventType,
        scope: row.scope,
        title: row.title,
        body: row.body,
        link: row.link,
        entityType: row.entityType,
        entityId: row.entityId,
        actorId: row.actorId,
        metadata: row.metadata,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: result.nextCursor,
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.repo.countUnread(userId);
    return { count, displayCount: count > 99 ? "99+" : String(count) };
  }

  async markRead(id: string, userId: string) {
    const { unreadCount } = await this.repo.markRead(id, userId);
    return {
      unreadCount,
      count: unreadCount,
      displayCount: unreadCount > 99 ? "99+" : String(unreadCount),
    };
  }

  async markAllRead(userId: string) {
    await this.repo.markAllRead(userId);
    return { unreadCount: 0, count: 0, displayCount: "0" };
  }

  async dismiss(id: string, userId: string) {
    const { unreadCount } = await this.repo.dismiss(id, userId);
    return {
      unreadCount,
      count: unreadCount,
      displayCount: unreadCount > 99 ? "99+" : String(unreadCount),
    };
  }
```

- [ ] **Step 4: Replace the controller stub**

`apps/api/src/modules/notifications/notifications.controller.ts`:

```ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { ListNotificationsDto } from "./dto/list-notifications.dto";
import { AuditService } from "../../audit/audit.service";
import { AUDIT_ACTIONS } from "../../audit/audit.types"; // confirm export name

interface AuthedRequest {
  user: {
    id: string;
    role: "candidate" | "recruiter" | "admin";
    email: string;
  };
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query() query: ListNotificationsDto) {
    return this.service.listForUser(req.user.id, query);
  }

  @Get("unread-count")
  unreadCount(@Req() req: AuthedRequest) {
    return this.service.getUnreadCount(req.user.id);
  }

  @Post(":id/read")
  @HttpCode(HttpStatus.OK)
  markRead(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.service.markRead(id, req.user.id);
  }

  @Post("read-all")
  @HttpCode(HttpStatus.OK)
  async markAllRead(@Req() req: AuthedRequest) {
    const result = await this.service.markAllRead(req.user.id);
    await this.audit.log({
      actorId: req.user.id,
      actorType: req.user.role,
      action: AUDIT_ACTIONS.NOTIFICATIONS_MARKED_ALL_READ,
      entityType: "notifications",
      entityId: req.user.id,
      details: {},
    });
    return result;
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  dismiss(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.service.dismiss(id, req.user.id);
  }
}
```

> **Confirm during execution:** the exact `AuditService.log` signature, the `AUDIT_ACTIONS` export name, and the `AuthedRequest.user` shape (read `apps/api/src/common/guards/supabase-auth.guard.ts` to see what's attached). Adjust the imports and field names to match.

- [ ] **Step 5: Write a controller test**

```ts
import { Test } from "@nestjs/testing";
import { NotificationsController } from "../notifications.controller";
import { NotificationsService } from "../notifications.service";
import { AuditService } from "../../../audit/audit.service";

describe("NotificationsController", () => {
  let controller: NotificationsController;
  let service: any;
  let audit: any;

  beforeEach(async () => {
    service = {
      listForUser: jest.fn(),
      getUnreadCount: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
      dismiss: jest.fn(),
    };
    audit = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: service },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    controller = moduleRef.get(NotificationsController);
  });

  it("getUnreadCount returns the service's count and displayCount", async () => {
    service.getUnreadCount.mockResolvedValue({ count: 5, displayCount: "5" });
    const result = await controller.unreadCount({ user: { id: "u1" } } as any);
    expect(result).toEqual({ count: 5, displayCount: "5" });
  });

  it("markAllRead writes an audit log entry", async () => {
    service.markAllRead.mockResolvedValue({
      unreadCount: 0,
      count: 0,
      displayCount: "0",
    });
    await controller.markAllRead({
      user: { id: "u1", role: "candidate", email: "x@y.z" },
    } as any);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "u1",
        action: expect.stringContaining("marked_all_read"),
      }),
    );
  });

  it("dismiss returns capped displayCount when count > 99", async () => {
    service.dismiss.mockResolvedValue({
      unreadCount: 150,
      count: 150,
      displayCount: "99+",
    });
    const result = await controller.dismiss(
      { user: { id: "u1" } } as any,
      "n1",
    );
    expect(result.displayCount).toBe("99+");
  });
});
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter api test -- notifications.controller`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/notifications/notifications.controller.ts apps/api/src/modules/notifications/notifications.service.ts apps/api/src/modules/notifications/dto/ apps/api/src/audit/audit.types.ts apps/api/src/modules/notifications/__tests__/notifications.controller.spec.ts
git commit -m "feat(api): notifications HTTP endpoints (list, unread-count, mark-read, mark-all, dismiss)"
```

---

### Task 16: Notification preferences controller

**Files:**

- Modify: `apps/api/src/modules/notification-preferences/notification-preferences.controller.ts` (replace stub)
- Create: `apps/api/src/modules/notification-preferences/dto/upsert-preference.dto.ts`
- Create: `apps/api/src/modules/notification-preferences/dto/restore-defaults.dto.ts`
- Create: `apps/api/src/modules/notification-preferences/__tests__/notification-preferences.controller.spec.ts`

- [ ] **Step 1: Create the two DTOs**

`dto/upsert-preference.dto.ts`:

```ts
import { createZodDto } from "nestjs-zod";
import { upsertPreferenceBodySchema } from "@aurahire/shared";

export class UpsertPreferenceDto extends createZodDto(
  upsertPreferenceBodySchema,
) {}
```

`dto/restore-defaults.dto.ts`:

```ts
import { createZodDto } from "nestjs-zod";
import { restoreDefaultsBodySchema } from "@aurahire/shared";

export class RestoreDefaultsDto extends createZodDto(
  restoreDefaultsBodySchema,
) {}
```

- [ ] **Step 2: Replace the controller stub**

`notification-preferences.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { NotificationPreferencesService } from "./notification-preferences.service";
import { UpsertPreferenceDto } from "./dto/upsert-preference.dto";
import { RestoreDefaultsDto } from "./dto/restore-defaults.dto";
import { AuditService } from "../../audit/audit.service";
import { AUDIT_ACTIONS } from "../../audit/audit.types";

interface AuthedRequest {
  user: { id: string; role: "candidate" | "recruiter" | "admin" };
}

@ApiTags("notification-preferences")
@Controller("notification-preferences")
export class NotificationPreferencesController {
  constructor(
    private readonly service: NotificationPreferencesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.service.listForRole(req.user.id, req.user.role);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async upsert(@Req() req: AuthedRequest, @Body() body: UpsertPreferenceDto) {
    const previous = await this.service.getEffectiveMode(
      req.user.id,
      body.eventType,
    );
    const result = await this.service.upsert(req.user.id, body);
    await this.audit.log({
      actorId: req.user.id,
      actorType: req.user.role,
      action: AUDIT_ACTIONS.NOTIFICATION_PREFERENCE_UPDATED,
      entityType: "notification_preference",
      entityId: req.user.id,
      details: {
        eventType: body.eventType,
        oldMode: previous,
        newMode: body.mode,
      },
    });
    return { eventType: result.eventType, mode: result.mode, isDefault: false };
  }

  @Post("restore-defaults")
  @HttpCode(HttpStatus.OK)
  async restoreDefaults(
    @Req() req: AuthedRequest,
    @Body() body: RestoreDefaultsDto,
  ) {
    const result = await this.service.restoreDefaults(req.user.id, body);
    await this.audit.log({
      actorId: req.user.id,
      actorType: req.user.role,
      action: AUDIT_ACTIONS.NOTIFICATION_PREFERENCES_RESET,
      entityType: "notification_preference",
      entityId: req.user.id,
      details: { category: body.category, deleted: result.deleted },
    });
    return result;
  }
}
```

- [ ] **Step 3: Write a controller test**

```ts
import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { NotificationPreferencesController } from "../notification-preferences.controller";
import { NotificationPreferencesService } from "../notification-preferences.service";
import { AuditService } from "../../../audit/audit.service";

describe("NotificationPreferencesController", () => {
  let controller: NotificationPreferencesController;
  let service: any;
  let audit: any;

  beforeEach(async () => {
    service = {
      listForRole: jest.fn(),
      getEffectiveMode: jest.fn().mockResolvedValue("instant"),
      upsert: jest.fn(),
      restoreDefaults: jest.fn(),
    };
    audit = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationPreferencesController],
      providers: [
        { provide: NotificationPreferencesService, useValue: service },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    controller = moduleRef.get(NotificationPreferencesController);
  });

  it("upsert audits the change with old and new mode", async () => {
    service.getEffectiveMode.mockResolvedValue("instant");
    service.upsert.mockResolvedValue({
      eventType: "application_status_changed",
      mode: "off",
    });
    await controller.upsert(
      { user: { id: "u1", role: "candidate" } } as any,
      { eventType: "application_status_changed", mode: "off" } as any,
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        details: {
          eventType: "application_status_changed",
          oldMode: "instant",
          newMode: "off",
        },
      }),
    );
  });

  it("upsert propagates BadRequestException for security events", async () => {
    service.upsert.mockRejectedValue(new BadRequestException());
    await expect(
      controller.upsert(
        { user: { id: "u1", role: "candidate" } } as any,
        { eventType: "account_password_reset", mode: "off" } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("restoreDefaults audits the reset with category", async () => {
    service.restoreDefaults.mockResolvedValue({ deleted: 3 });
    await controller.restoreDefaults(
      { user: { id: "u1", role: "candidate" } } as any,
      { category: "applications" } as any,
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        details: { category: "applications", deleted: 3 },
      }),
    );
  });
});
```

- [ ] **Step 4: Run tests + type-check + lint**

Run: `pnpm --filter api test -- notification-preferences.controller && pnpm --filter api type-check && pnpm --filter api lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/notification-preferences/
git commit -m "feat(api): notification-preferences HTTP endpoints (list, upsert, restore-defaults)"
```

---

## Phase 6 - Crons

> All crons live under `apps/api/src/cron/`. Each follows the existing pattern in the project (e.g., `archive-past-deadline-jobs.cron.ts`): `@Injectable()`, a `@Cron(...)` decorated method, audit-log on completion. Confirm the existing pattern by reading one existing cron before starting.

### Task 17: DigestEmailCron

**Files:**

- Create: `apps/api/src/cron/digest-email.cron.ts`
- Create: `apps/api/src/cron/__tests__/digest-email.cron.spec.ts`
- Modify: `apps/api/src/cron/cron.module.ts` (register the cron)

- [ ] **Step 1: Create the cron**

```ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { NotificationsRepository } from "../modules/notifications/notifications.repository";
import {
  NOTIFICATION_EMAIL_QUEUE,
  type NotificationEmailJobData,
} from "../modules/notifications/queues";
import { AuditService } from "../audit/audit.service";
import { AUDIT_ACTIONS } from "../audit/audit.types";

@Injectable()
export class DigestEmailCron {
  private readonly logger = new Logger(DigestEmailCron.name);

  constructor(
    private readonly repo: NotificationsRepository,
    @InjectQueue(NOTIFICATION_EMAIL_QUEUE)
    private readonly queue: Queue<NotificationEmailJobData>,
    private readonly audit: AuditService,
  ) {}

  @Cron("0 8 * * *", { timeZone: "Asia/Manila" })
  async run(): Promise<void> {
    await this.handleDigestRun();
  }

  async handleDigestRun(): Promise<{
    userCount: number;
    notificationCount: number;
  }> {
    const batches = await this.repo.findDigestPendingByUser();
    let totalNotifications = 0;
    for (const batch of batches) {
      try {
        await this.queue.add(
          "digest-email",
          { kind: "digest", userId: batch.userId, notificationIds: batch.ids },
          { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
        );
        await this.repo.clearDigestPending(batch.ids);
        totalNotifications += batch.ids.length;
      } catch (err) {
        this.logger.error(
          `digest enqueue failed for user ${batch.userId}`,
          err,
        );
      }
    }
    await this.audit.log({
      actorId: null,
      actorType: "system",
      action: AUDIT_ACTIONS.DIGEST_EMAIL_BATCH_RUN,
      entityType: "cron",
      entityId: null,
      details: {
        userCount: batches.length,
        notificationCount: totalNotifications,
      },
    });
    this.logger.log(
      `digest run: ${batches.length} users / ${totalNotifications} notifications`,
    );
    return { userCount: batches.length, notificationCount: totalNotifications };
  }
}
```

> **Confirm:** the `audit.log` call shape (some projects don't accept `null` for `actorId`). If null isn't allowed, use a system-id constant. Read an existing cron's audit call to mirror it.

- [ ] **Step 2: Write the test**

```ts
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { DigestEmailCron } from "../digest-email.cron";
import { NotificationsRepository } from "../../modules/notifications/notifications.repository";
import { NOTIFICATION_EMAIL_QUEUE } from "../../modules/notifications/queues";
import { AuditService } from "../../audit/audit.service";

describe("DigestEmailCron", () => {
  let cron: DigestEmailCron;
  let repo: any;
  let queue: any;
  let audit: any;

  beforeEach(async () => {
    repo = {
      findDigestPendingByUser: jest.fn(),
      clearDigestPending: jest.fn(),
    };
    queue = { add: jest.fn() };
    audit = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        DigestEmailCron,
        { provide: NotificationsRepository, useValue: repo },
        { provide: getQueueToken(NOTIFICATION_EMAIL_QUEUE), useValue: queue },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    cron = moduleRef.get(DigestEmailCron);
  });

  it("enqueues one digest job per user and clears digest_pending", async () => {
    repo.findDigestPendingByUser.mockResolvedValue([
      { userId: "u1", ids: ["n1", "n2"] },
      { userId: "u2", ids: ["n3"] },
    ]);
    const result = await cron.handleDigestRun();
    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(repo.clearDigestPending).toHaveBeenCalledWith(["n1", "n2"]);
    expect(repo.clearDigestPending).toHaveBeenCalledWith(["n3"]);
    expect(result).toEqual({ userCount: 2, notificationCount: 3 });
  });

  it("audit-logs the batch run", async () => {
    repo.findDigestPendingByUser.mockResolvedValue([]);
    await cron.handleDigestRun();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.stringContaining("digest_email_batch_run"),
      }),
    );
  });

  it("idempotent: a second run with no pending rows enqueues nothing", async () => {
    repo.findDigestPendingByUser.mockResolvedValue([]);
    const result = await cron.handleDigestRun();
    expect(queue.add).not.toHaveBeenCalled();
    expect(result.userCount).toBe(0);
  });
});
```

- [ ] **Step 3: Register in `cron.module.ts`**

Open `apps/api/src/cron/cron.module.ts` and add `DigestEmailCron` to the providers array, plus the import. Add `NotificationsModule` to `imports` if it isn't already accessible (the `NotificationsRepository` and queue token come from there).

- [ ] **Step 4: Run tests + type-check + lint**

Run: `pnpm --filter api test -- digest-email.cron && pnpm --filter api type-check && pnpm --filter api lint`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/cron/digest-email.cron.ts apps/api/src/cron/__tests__/digest-email.cron.spec.ts apps/api/src/cron/cron.module.ts
git commit -m "feat(api): DigestEmailCron - daily 08:00 Asia/Manila batch"
```

---

### Task 18: NotificationsRetentionCron

**Files:**

- Create: `apps/api/src/cron/notifications-retention.cron.ts`
- Create: `apps/api/src/cron/__tests__/notifications-retention.cron.spec.ts`
- Modify: `apps/api/src/cron/cron.module.ts`

- [ ] **Step 1: Create the cron**

```ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { NotificationsRepository } from "../modules/notifications/notifications.repository";
import { AuditService } from "../audit/audit.service";
import { AUDIT_ACTIONS } from "../audit/audit.types";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

@Injectable()
export class NotificationsRetentionCron {
  private readonly logger = new Logger(NotificationsRetentionCron.name);

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly audit: AuditService,
  ) {}

  @Cron("0 3 * * *", { timeZone: "Asia/Manila" })
  async run(): Promise<void> {
    await this.handleRetention();
  }

  async handleRetention(): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - NINETY_DAYS_MS);
    const deleted = await this.repo.deleteOlderThan(cutoff);
    await this.audit.log({
      actorId: null,
      actorType: "system",
      action: AUDIT_ACTIONS.NOTIFICATIONS_RETENTION_RUN,
      entityType: "cron",
      entityId: null,
      details: { deleted, cutoffIso: cutoff.toISOString() },
    });
    this.logger.log(
      `retention run: deleted ${deleted} rows older than ${cutoff.toISOString()}`,
    );
    return { deleted };
  }
}
```

- [ ] **Step 2: Write the test**

```ts
import { Test } from "@nestjs/testing";
import { NotificationsRetentionCron } from "../notifications-retention.cron";
import { NotificationsRepository } from "../../modules/notifications/notifications.repository";
import { AuditService } from "../../audit/audit.service";

describe("NotificationsRetentionCron", () => {
  let cron: NotificationsRetentionCron;
  let repo: any;
  let audit: any;

  beforeEach(async () => {
    repo = { deleteOlderThan: jest.fn().mockResolvedValue(42) };
    audit = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsRetentionCron,
        { provide: NotificationsRepository, useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    cron = moduleRef.get(NotificationsRetentionCron);
  });

  it("deletes rows older than 90 days and audit-logs the count", async () => {
    const result = await cron.handleRetention();
    expect(repo.deleteOlderThan).toHaveBeenCalledTimes(1);
    const cutoff = repo.deleteOlderThan.mock.calls[0][0] as Date;
    const elapsed = Date.now() - cutoff.getTime();
    expect(elapsed).toBeGreaterThanOrEqual(89 * 24 * 60 * 60 * 1000);
    expect(elapsed).toBeLessThanOrEqual(91 * 24 * 60 * 60 * 1000);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ deleted: 42 }),
      }),
    );
    expect(result).toEqual({ deleted: 42 });
  });
});
```

- [ ] **Step 3: Register + verify + commit**

Add to `cron.module.ts` providers, then:

Run: `pnpm --filter api test -- notifications-retention && pnpm --filter api type-check && pnpm --filter api lint`

```bash
git add apps/api/src/cron/notifications-retention.cron.ts apps/api/src/cron/__tests__/notifications-retention.cron.spec.ts apps/api/src/cron/cron.module.ts
git commit -m "feat(api): NotificationsRetentionCron - daily 03:00 90-day delete"
```

---

### Task 19: InterviewReminderCron

**Files:**

- Create: `apps/api/src/cron/interview-reminder.cron.ts`
- Create: `apps/api/src/cron/__tests__/interview-reminder.cron.spec.ts`
- Modify: `apps/api/src/cron/cron.module.ts`

This cron requires reading interviews with `startTime BETWEEN now() AND now()+24h AND reminder_sent_at IS NULL` and emitting one notification per match. The query lives in a new repo method or inline; the test stubs the repo.

- [ ] **Step 1: Add the query method to `InterviewsRepository`**

In `apps/api/src/modules/interviews/interviews.repository.ts`, append (adjusting the file's existing import block as needed):

```ts
  async findRemindersDue(): Promise<Array<{
    id: string;
    applicationId: string;
    candidateId: string;
    jobTitle: string;
    companyName: string;
    startTime: Date;
    format: string;
  }>> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return this.db.execute(sql`
      SELECT i.id, i.application_id as "applicationId", a.candidate_id as "candidateId",
             j.title as "jobTitle", c.name as "companyName",
             i.start_time as "startTime", i.format as "format"
      FROM interviews i
      JOIN applications a ON a.id = i.application_id
      JOIN jobs j ON j.id = a.job_id
      JOIN companies c ON c.id = j.company_id
      WHERE i.start_time BETWEEN ${now.toISOString()}::timestamptz AND ${in24h.toISOString()}::timestamptz
        AND i.reminder_sent_at IS NULL
        AND i.status = 'scheduled'
      LIMIT 200
    `);
  }

  async markReminderSent(id: string): Promise<void> {
    await this.db
      .update(interviewsTable)
      .set({ reminderSentAt: new Date() })
      .where(eq(interviewsTable.id, id));
  }
```

> **Confirm during execution:** the actual table column names (snake_case in SQL but camelCase in Drizzle) and the joinable companies/jobs structure. If the company name lives at `companies.legal_name` or similar, adjust. Read the schema before writing the SQL.

- [ ] **Step 2: Create the cron**

```ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InterviewsRepository } from "../modules/interviews/interviews.repository";
import { NotificationsService } from "../modules/notifications/notifications.service";
import { AuditService } from "../audit/audit.service";
import { AUDIT_ACTIONS } from "../audit/audit.types";

@Injectable()
export class InterviewReminderCron {
  private readonly logger = new Logger(InterviewReminderCron.name);

  constructor(
    private readonly interviews: InterviewsRepository,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  @Cron("0 * * * *", { timeZone: "Asia/Manila" })
  async run(): Promise<void> {
    await this.handleRun();
  }

  async handleRun(): Promise<{ remindersSent: number }> {
    const due = await this.interviews.findRemindersDue();
    for (const i of due) {
      try {
        await this.notifications.emit({
          userId: i.candidateId,
          eventType: "interview_reminder_24h",
          entityType: "interview",
          entityId: i.id,
          metadata: {
            interviewId: i.id,
            applicationId: i.applicationId,
            jobTitle: i.jobTitle,
            companyName: i.companyName,
            startTime: i.startTime.toISOString(),
            format: i.format,
          },
        });
        await this.interviews.markReminderSent(i.id);
      } catch (err) {
        this.logger.error(`reminder emit failed for interview ${i.id}`, err);
      }
    }
    await this.audit.log({
      actorId: null,
      actorType: "system",
      action: AUDIT_ACTIONS.INTERVIEW_REMINDER_RUN,
      entityType: "cron",
      entityId: null,
      details: { remindersSent: due.length },
    });
    this.logger.log(`interview-reminder run: ${due.length} sent`);
    return { remindersSent: due.length };
  }
}
```

- [ ] **Step 3: Test (mocked repo + service)**

```ts
import { Test } from "@nestjs/testing";
import { InterviewReminderCron } from "../interview-reminder.cron";
import { InterviewsRepository } from "../../modules/interviews/interviews.repository";
import { NotificationsService } from "../../modules/notifications/notifications.service";
import { AuditService } from "../../audit/audit.service";

describe("InterviewReminderCron", () => {
  let cron: InterviewReminderCron;
  let interviews: any;
  let notifications: any;
  let audit: any;

  beforeEach(async () => {
    interviews = {
      findRemindersDue: jest.fn(),
      markReminderSent: jest.fn(),
    };
    notifications = { emit: jest.fn() };
    audit = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        InterviewReminderCron,
        { provide: InterviewsRepository, useValue: interviews },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    cron = moduleRef.get(InterviewReminderCron);
  });

  it("emits a notification and marks reminder_sent_at for each due interview", async () => {
    interviews.findRemindersDue.mockResolvedValue([
      {
        id: "i1",
        applicationId: "a1",
        candidateId: "c1",
        jobTitle: "Engineer",
        companyName: "ACME",
        startTime: new Date(),
        format: "video",
      },
      {
        id: "i2",
        applicationId: "a2",
        candidateId: "c2",
        jobTitle: "PM",
        companyName: "ACME",
        startTime: new Date(),
        format: "phone",
      },
    ]);
    const result = await cron.handleRun();
    expect(notifications.emit).toHaveBeenCalledTimes(2);
    expect(interviews.markReminderSent).toHaveBeenCalledWith("i1");
    expect(interviews.markReminderSent).toHaveBeenCalledWith("i2");
    expect(result).toEqual({ remindersSent: 2 });
  });

  it("idempotent: subsequent run with no due rows is a no-op (apart from audit)", async () => {
    interviews.findRemindersDue.mockResolvedValue([]);
    await cron.handleRun();
    expect(notifications.emit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Register + verify + commit**

Add `InterviewReminderCron` to `cron.module.ts` providers and ensure `InterviewsModule` is imported (so `InterviewsRepository` is injectable).

```bash
pnpm --filter api test -- interview-reminder
pnpm --filter api type-check
pnpm --filter api lint
git add apps/api/src/cron/interview-reminder.cron.ts apps/api/src/cron/__tests__/interview-reminder.cron.spec.ts apps/api/src/modules/interviews/interviews.repository.ts apps/api/src/cron/cron.module.ts
git commit -m "feat(api): InterviewReminderCron - hourly 24h reminder with dedup flag"
```

---

### Task 20: OfferExpiryReminderCron

Mirror Task 19's structure for offers:

- Add `findExpiryRemindersDue()` and `markExpiryReminderSent()` to `OffersRepository`
- Create the cron emitting `offer_expiring_soon`
- Test with mocked repo + service
- Register in `cron.module.ts`

The query selects offers where `expires_at BETWEEN now() AND now()+24h AND expiry_reminder_sent_at IS NULL AND status = 'pending'`.

- [ ] **Step 1: Add `findExpiryRemindersDue` to `apps/api/src/modules/offers/offers.repository.ts`**

```ts
  async findExpiryRemindersDue(): Promise<Array<{
    id: string;
    applicationId: string;
    candidateId: string;
    jobTitle: string;
    companyName: string;
    expiresAt: Date;
  }>> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return this.db.execute(sql`
      SELECT o.id, o.application_id as "applicationId", a.candidate_id as "candidateId",
             j.title as "jobTitle", c.name as "companyName",
             o.expires_at as "expiresAt"
      FROM offers o
      JOIN applications a ON a.id = o.application_id
      JOIN jobs j ON j.id = a.job_id
      JOIN companies c ON c.id = j.company_id
      WHERE o.expires_at BETWEEN ${now.toISOString()}::timestamptz AND ${in24h.toISOString()}::timestamptz
        AND o.expiry_reminder_sent_at IS NULL
        AND o.status = 'pending'
      LIMIT 200
    `);
  }

  async markExpiryReminderSent(id: string): Promise<void> {
    await this.db
      .update(offersTable)
      .set({ expiryReminderSentAt: new Date() })
      .where(eq(offersTable.id, id));
  }
```

- [ ] **Step 2: Create `apps/api/src/cron/offer-expiry-reminder.cron.ts`**

```ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { OffersRepository } from "../modules/offers/offers.repository";
import { NotificationsService } from "../modules/notifications/notifications.service";
import { AuditService } from "../audit/audit.service";
import { AUDIT_ACTIONS } from "../audit/audit.types";

@Injectable()
export class OfferExpiryReminderCron {
  private readonly logger = new Logger(OfferExpiryReminderCron.name);

  constructor(
    private readonly offers: OffersRepository,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  @Cron("0 * * * *", { timeZone: "Asia/Manila" })
  async run(): Promise<void> {
    await this.handleRun();
  }

  async handleRun(): Promise<{ remindersSent: number }> {
    const due = await this.offers.findExpiryRemindersDue();
    for (const o of due) {
      try {
        await this.notifications.emit({
          userId: o.candidateId,
          eventType: "offer_expiring_soon",
          entityType: "offer",
          entityId: o.id,
          metadata: {
            offerId: o.id,
            applicationId: o.applicationId,
            jobTitle: o.jobTitle,
            companyName: o.companyName,
            expiresAt: o.expiresAt.toISOString(),
          },
        });
        await this.offers.markExpiryReminderSent(o.id);
      } catch (err) {
        this.logger.error(`offer expiry reminder failed for ${o.id}`, err);
      }
    }
    await this.audit.log({
      actorId: null,
      actorType: "system",
      action: AUDIT_ACTIONS.OFFER_EXPIRY_REMINDER_RUN,
      entityType: "cron",
      entityId: null,
      details: { remindersSent: due.length },
    });
    return { remindersSent: due.length };
  }
}
```

- [ ] **Step 3: Write the test**

Create `apps/api/src/cron/__tests__/offer-expiry-reminder.cron.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { OfferExpiryReminderCron } from "../offer-expiry-reminder.cron";
import { OffersRepository } from "../../modules/offers/offers.repository";
import { NotificationsService } from "../../modules/notifications/notifications.service";
import { AuditService } from "../../audit/audit.service";

describe("OfferExpiryReminderCron", () => {
  let cron: OfferExpiryReminderCron;
  let offers: any;
  let notifications: any;
  let audit: any;

  beforeEach(async () => {
    offers = {
      findExpiryRemindersDue: jest.fn(),
      markExpiryReminderSent: jest.fn(),
    };
    notifications = { emit: jest.fn() };
    audit = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        OfferExpiryReminderCron,
        { provide: OffersRepository, useValue: offers },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    cron = moduleRef.get(OfferExpiryReminderCron);
  });

  it("emits offer_expiring_soon and marks expiry_reminder_sent_at for each due offer", async () => {
    offers.findExpiryRemindersDue.mockResolvedValue([
      {
        id: "o1",
        applicationId: "a1",
        candidateId: "c1",
        jobTitle: "Engineer",
        companyName: "ACME",
        expiresAt: new Date(),
      },
      {
        id: "o2",
        applicationId: "a2",
        candidateId: "c2",
        jobTitle: "PM",
        companyName: "ACME",
        expiresAt: new Date(),
      },
    ]);
    const result = await cron.handleRun();
    expect(notifications.emit).toHaveBeenCalledTimes(2);
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "offer_expiring_soon" }),
    );
    expect(offers.markExpiryReminderSent).toHaveBeenCalledWith("o1");
    expect(offers.markExpiryReminderSent).toHaveBeenCalledWith("o2");
    expect(result).toEqual({ remindersSent: 2 });
  });

  it("audit-logs the run", async () => {
    offers.findExpiryRemindersDue.mockResolvedValue([]);
    await cron.handleRun();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.stringContaining("offer_expiry_reminder_run"),
      }),
    );
  });

  it("idempotent: subsequent run with no due rows is a no-op apart from audit", async () => {
    offers.findExpiryRemindersDue.mockResolvedValue([]);
    await cron.handleRun();
    expect(notifications.emit).not.toHaveBeenCalled();
    expect(offers.markExpiryReminderSent).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Register + verify + commit**

```bash
pnpm --filter api test -- offer-expiry-reminder
pnpm --filter api type-check
pnpm --filter api lint
git add apps/api/src/cron/offer-expiry-reminder.cron.ts apps/api/src/cron/__tests__/offer-expiry-reminder.cron.spec.ts apps/api/src/modules/offers/offers.repository.ts apps/api/src/cron/cron.module.ts
git commit -m "feat(api): OfferExpiryReminderCron - hourly 24h reminder with dedup flag"
```

---

### Task 21: InterviewFeedbackDueCron

**Files:**

- Add `findFeedbackDue()` + `markFeedbackDueNotified()` to `InterviewsRepository`
- Create `apps/api/src/cron/interview-feedback-due.cron.ts`
- Create test
- Register in `cron.module.ts`

- [ ] **Step 1: Add the repo methods**

```ts
  async findFeedbackDue(): Promise<Array<{
    id: string;
    recruiterId: string;
    candidateId: string;
    candidateName: string;
    jobTitle: string;
  }>> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.db.execute(sql`
      SELECT i.id, i.recruiter_id as "recruiterId",
             a.candidate_id as "candidateId",
             p.full_name as "candidateName",
             j.title as "jobTitle"
      FROM interviews i
      JOIN applications a ON a.id = i.application_id
      JOIN profiles p ON p.id = a.candidate_id
      JOIN jobs j ON j.id = a.job_id
      WHERE i.end_time IS NOT NULL
        AND i.end_time < ${cutoff.toISOString()}::timestamptz
        AND (i.feedback IS NULL OR i.feedback = '{}'::jsonb)
        AND i.feedback_due_notified_at IS NULL
      LIMIT 200
    `);
  }

  async markFeedbackDueNotified(id: string): Promise<void> {
    await this.db
      .update(interviewsTable)
      .set({ feedbackDueNotifiedAt: new Date() })
      .where(eq(interviewsTable.id, id));
  }
```

> **Confirm:** `interviews.end_time`, `interviews.feedback`, `profiles.full_name` column names. Adjust to match the actual schema during execution.

- [ ] **Step 2: Create the cron**

```ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InterviewsRepository } from "../modules/interviews/interviews.repository";
import { NotificationsService } from "../modules/notifications/notifications.service";
import { AuditService } from "../audit/audit.service";
import { AUDIT_ACTIONS } from "../audit/audit.types";

@Injectable()
export class InterviewFeedbackDueCron {
  private readonly logger = new Logger(InterviewFeedbackDueCron.name);

  constructor(
    private readonly interviews: InterviewsRepository,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  @Cron("0 * * * *", { timeZone: "Asia/Manila" })
  async run(): Promise<void> {
    await this.handleRun();
  }

  async handleRun(): Promise<{ notified: number }> {
    const due = await this.interviews.findFeedbackDue();
    for (const i of due) {
      try {
        await this.notifications.emit({
          userId: i.recruiterId,
          eventType: "interview_feedback_due",
          entityType: "interview",
          entityId: i.id,
          metadata: {
            interviewId: i.id,
            candidateName: i.candidateName,
            jobTitle: i.jobTitle,
          },
        });
        await this.interviews.markFeedbackDueNotified(i.id);
      } catch (err) {
        this.logger.error(
          `feedback-due emit failed for interview ${i.id}`,
          err,
        );
      }
    }
    await this.audit.log({
      actorId: null,
      actorType: "system",
      action: AUDIT_ACTIONS.INTERVIEW_FEEDBACK_DUE_RUN,
      entityType: "cron",
      entityId: null,
      details: { notified: due.length },
    });
    return { notified: due.length };
  }
}
```

- [ ] **Step 3: Write the test**

Create `apps/api/src/cron/__tests__/interview-feedback-due.cron.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { InterviewFeedbackDueCron } from "../interview-feedback-due.cron";
import { InterviewsRepository } from "../../modules/interviews/interviews.repository";
import { NotificationsService } from "../../modules/notifications/notifications.service";
import { AuditService } from "../../audit/audit.service";

describe("InterviewFeedbackDueCron", () => {
  let cron: InterviewFeedbackDueCron;
  let interviews: any;
  let notifications: any;
  let audit: any;

  beforeEach(async () => {
    interviews = {
      findFeedbackDue: jest.fn(),
      markFeedbackDueNotified: jest.fn(),
    };
    notifications = { emit: jest.fn() };
    audit = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        InterviewFeedbackDueCron,
        { provide: InterviewsRepository, useValue: interviews },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    cron = moduleRef.get(InterviewFeedbackDueCron);
  });

  it("emits interview_feedback_due to the recruiter and marks the flag column", async () => {
    interviews.findFeedbackDue.mockResolvedValue([
      {
        id: "i1",
        recruiterId: "r1",
        candidateId: "c1",
        candidateName: "Alex",
        jobTitle: "Engineer",
      },
    ]);
    const result = await cron.handleRun();
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "r1",
        eventType: "interview_feedback_due",
        metadata: expect.objectContaining({
          interviewId: "i1",
          candidateName: "Alex",
        }),
      }),
    );
    expect(interviews.markFeedbackDueNotified).toHaveBeenCalledWith("i1");
    expect(result).toEqual({ notified: 1 });
  });

  it("audit-logs the run", async () => {
    interviews.findFeedbackDue.mockResolvedValue([]);
    await cron.handleRun();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.stringContaining("interview_feedback_due_run"),
      }),
    );
  });

  it("idempotent: subsequent run with no due rows is a no-op apart from audit", async () => {
    interviews.findFeedbackDue.mockResolvedValue([]);
    await cron.handleRun();
    expect(notifications.emit).not.toHaveBeenCalled();
    expect(interviews.markFeedbackDueNotified).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Register + verify + commit**

```bash
pnpm --filter api test -- interview-feedback-due
pnpm --filter api type-check && pnpm --filter api lint
git add apps/api/src/cron/interview-feedback-due.cron.ts apps/api/src/cron/__tests__/interview-feedback-due.cron.spec.ts apps/api/src/modules/interviews/interviews.repository.ts apps/api/src/cron/cron.module.ts
git commit -m "feat(api): InterviewFeedbackDueCron - hourly 24h-after-interview prompt"
```

---

## Phase 7 - Service-layer hookups

> **Pattern for every task in this phase:**
>
> 1. Import `NotificationsModule` into the affected feature module.
> 2. Inject `NotificationsService` into the service.
> 3. After the existing successful DB write (and after the existing `auditService.log()` if any), call `notifications.emit({ ... })` with the matching event type and metadata.
> 4. The `emit()` call is non-blocking and never throws - it does NOT need to be inside the existing try/catch, but it must be inside the function so a normal control-flow path executes it.
> 5. Add a unit test asserting the emit call happens with the expected eventType and metadata. Mock `NotificationsService` for the test.

### Task 22: Wire applications.service

**Files:**

- Modify: `apps/api/src/modules/applications/applications.service.ts`
- Modify: `apps/api/src/modules/applications/applications.module.ts`
- Modify: `apps/api/src/modules/applications/__tests__/applications.service.spec.ts` (or create if absent)

- [ ] **Step 1: Add `NotificationsModule` to `ApplicationsModule.imports`**

```ts
import { NotificationsModule } from "../notifications/notifications.module";
// ...
@Module({
  imports: [/* existing */, NotificationsModule],
  // ...
})
```

- [ ] **Step 2: Inject `NotificationsService` into `ApplicationsService`**

Add to constructor:

```ts
import { NotificationsService } from "../notifications/notifications.service";
// ...
constructor(
  // ... existing deps,
  private readonly notifications: NotificationsService,
) {}
```

- [ ] **Step 3: Emit on `apply()` (after successful insert)**

Within the method that creates a new application, after `auditService.log(...)` (or after the insert if no audit call exists), append:

```ts
await this.notifications.emit({
  userId: job.ownerRecruiterId,
  eventType: "new_application_received",
  entityType: "application",
  entityId: application.id,
  actorId: candidate.id,
  metadata: {
    applicationId: application.id,
    candidateName: candidate.fullName,
    jobId: job.id,
    jobTitle: job.title,
    scoreValue: matchPreview?.scoreValue ?? null,
    matchBand: matchPreview?.matchBand ?? null,
  },
});
```

> **Confirm:** the variable names (`job.ownerRecruiterId`, `candidate.fullName`, etc.) and how `matchPreview` is available. Read the existing `apply()` method first to align.

- [ ] **Step 4: Emit on `changeStatus()` (after status update succeeds)**

```ts
await this.notifications.emit({
  userId: application.candidateId,
  eventType: "application_status_changed",
  entityType: "application",
  entityId: application.id,
  actorId: req.user.id,
  metadata: {
    applicationId: application.id,
    jobTitle: job.title,
    companyName: company.name,
    newStatus: capitalize(newStatus),
  },
});
```

- [ ] **Step 5: Emit on `withdraw()`**

```ts
await this.notifications.emit({
  userId: job.ownerRecruiterId,
  eventType: "candidate_withdrew",
  entityType: "application",
  entityId: application.id,
  actorId: candidate.id,
  metadata: {
    applicationId: application.id,
    candidateName: candidate.fullName,
    jobId: job.id,
    jobTitle: job.title,
  },
});
```

- [ ] **Step 6: Add tests asserting each emit fires**

In the existing service spec (or create one), add:

```ts
describe("notification side-effects", () => {
  it("apply emits new_application_received to the job owner", async () => {
    /* set up mocks; call service.apply(...) */
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TEST_RECRUITER_ID,
        eventType: "new_application_received",
      }),
    );
  });
  it("changeStatus emits application_status_changed to the candidate", async () => {
    /* ... */
  });
  it("withdraw emits candidate_withdrew to the job owner", async () => {
    /* ... */
  });
});
```

- [ ] **Step 7: Verify + commit**

```bash
pnpm --filter api test -- applications.service
pnpm --filter api type-check
pnpm --filter api lint
git add apps/api/src/modules/applications/
git commit -m "feat(api): emit notifications on application apply/status-change/withdraw"
```

---

### Task 23: Wire interviews.service

**Files:**

- Modify: `apps/api/src/modules/interviews/interviews.service.ts`
- Modify: `apps/api/src/modules/interviews/interviews.module.ts`
- Modify: tests

- [ ] **Step 1: Import + inject `NotificationsService`** (same pattern as Task 22).

- [ ] **Step 2: Emit on `schedule()`**

```ts
await this.notifications.emit({
  userId: application.candidateId,
  eventType: "interview_scheduled",
  entityType: "interview",
  entityId: interview.id,
  actorId: req.user.id,
  metadata: {
    interviewId: interview.id,
    applicationId: application.id,
    jobTitle: job.title,
    companyName: company.name,
    startTime: interview.startTime.toISOString(),
    format: interview.format,
  },
});
```

- [ ] **Step 3: Emit on `cancel()`**

```ts
await this.notifications.emit({
  userId: application.candidateId,
  eventType: "interview_cancelled",
  entityType: "interview",
  entityId: interview.id,
  actorId: req.user.id,
  metadata: {
    applicationId: application.id,
    jobTitle: job.title,
    companyName: company.name,
  },
});
```

- [ ] **Step 4: Tests + verify + commit**

```bash
pnpm --filter api test -- interviews.service
pnpm --filter api type-check && pnpm --filter api lint
git add apps/api/src/modules/interviews/
git commit -m "feat(api): emit notifications on interview schedule/cancel"
```

---

### Task 24: Wire offers.service

**Files:**

- Modify: `apps/api/src/modules/offers/offers.service.ts` + module + tests

- [ ] **Step 1: Import + inject** (same pattern).

- [ ] **Step 2: Emit on `create()` (offer sent to candidate)**

```ts
await this.notifications.emit({
  userId: offer.candidateId,
  eventType: "offer_received",
  entityType: "offer",
  entityId: offer.id,
  actorId: req.user.id,
  metadata: {
    offerId: offer.id,
    applicationId: offer.applicationId,
    jobTitle: job.title,
    companyName: company.name,
    expiresAt: offer.expiresAt.toISOString(),
  },
});
```

- [ ] **Step 3: Emit on `accept()`**

```ts
await this.notifications.emit({
  userId: offer.recruiterId,
  eventType: "offer_accepted",
  entityType: "offer",
  entityId: offer.id,
  actorId: candidate.id,
  metadata: {
    offerId: offer.id,
    candidateName: candidate.fullName,
    jobId: job.id,
    jobTitle: job.title,
  },
});
```

- [ ] **Step 4: Emit on `decline()`** (mirror Step 3, swap event type to `offer_declined`).

- [ ] **Step 5: Tests + verify + commit**

```bash
pnpm --filter api test -- offers.service
pnpm --filter api type-check && pnpm --filter api lint
git add apps/api/src/modules/offers/
git commit -m "feat(api): emit notifications on offer create/accept/decline"
```

---

### Task 25: Wire bias.service (gated on module presence)

**Files:**

- Modify: `apps/api/src/modules/bias/bias.service.ts` + module + tests
- Or: skip if no bias module exists yet

- [ ] **Step 1: Verify the bias module exists**

Run: `ls apps/api/src/modules/bias/ 2>/dev/null && echo present || echo missing`

If the directory is missing, this task is **skipped** - documented in the spec as a phase-2 hookup. Move directly to Task 26 and add a TODO at the bottom of `bias_flag_raised`'s eventually-named producer (note in the commit message that the wiring is deferred).

- [ ] **Step 2: If present, find the method that records a bias flag**

Search: `grep -n "bias_flag\\|biasFlag\\|flagBias" apps/api/src/modules/bias/bias.service.ts`

- [ ] **Step 3: After the flag insert succeeds, emit BOTH events**

```ts
// Personal: recruiter who owns the JD
await this.notifications.emit({
  userId: job.ownerRecruiterId,
  eventType: "bias_flag_raised",
  entityType: "bias_flag",
  entityId: flag.id,
  metadata: {
    flagId: flag.id,
    jobId: job.id,
    jobTitle: job.title,
    flagSummary: flag.summary,
  },
});

// System: every admin
const adminIds = await this.profiles.findIdsByRole("admin");
await this.notifications.emitMany(adminIds, {
  eventType: "system_bias_flag_raised",
  scope: "system",
  entityType: "bias_flag",
  entityId: flag.id,
  metadata: {
    flagId: flag.id,
    companyName: company.name,
    jobTitle: job.title,
    flagSummary: flag.summary,
  },
});
```

> **Confirm:** the existence of `profiles.findIdsByRole(role)`. If absent, add it to `ProfilesRepository` first:
>
> ```ts
> async findIdsByRole(role: "candidate" | "recruiter" | "admin"): Promise<string[]> {
>   const rows = await this.db.select({ id: profilesTable.id }).from(profilesTable).where(eq(profilesTable.role, role));
>   return rows.map((r) => r.id);
> }
> ```

- [ ] **Step 4: Tests + verify + commit**

```bash
pnpm --filter api test -- bias.service
pnpm --filter api type-check && pnpm --filter api lint
git add apps/api/src/modules/bias/ apps/api/src/modules/profiles/profiles.repository.ts
git commit -m "feat(api): emit personal + system notifications on bias flag"
```

---

### Task 26: Wire auth.service

**Files:**

- Modify: `apps/api/src/modules/auth/auth.service.ts` + module + tests

- [ ] **Step 1: Inject `NotificationsService`**

- [ ] **Step 2: Emit on `resetPassword()` success**

```ts
await this.notifications.emit({
  userId: user.id,
  eventType: "account_password_reset",
});
```

- [ ] **Step 3: Emit on `verifyEmail()` success**

```ts
await this.notifications.emit({
  userId: user.id,
  eventType: "account_email_verified",
});
```

- [ ] **Step 4: `account_login_new_device` is gated on device-fingerprinting**

If the login path doesn't already track fingerprints, document this as deferred. Skip the wiring; the event type still ships in the enum.

- [ ] **Step 5: Tests + verify + commit**

```bash
pnpm --filter api test -- auth.service
pnpm --filter api type-check && pnpm --filter api lint
git add apps/api/src/modules/auth/
git commit -m "feat(api): emit notifications on password reset and email verify"
```

---

### Task 27: Wire invitations.service + match-preview-precompute catch

**Files:**

- Modify: `apps/api/src/modules/invitations/invitations.service.ts`
- Modify: the match-preview-precompute worker (`MatchPreviewQueueService`)

- [ ] **Step 1: Confirm `invitations` module exists; if so, inject + emit**

```ts
// On accept():
await this.notifications.emit({
  userId: invite.invitedById,
  eventType: "team_invite_accepted",
  entityType: "invitation",
  entityId: invite.id,
  actorId: invitedUser.id,
  metadata: { memberName: invitedUser.fullName, companyName: company.name },
});

// On decline():
await this.notifications.emit({
  userId: invite.invitedById,
  eventType: "team_invite_declined",
  entityType: "invitation",
  entityId: invite.id,
  actorId: invitedUser.id,
  metadata: { memberName: invitedUser.fullName, companyName: company.name },
});
```

- [ ] **Step 2: Find the match-preview-precompute worker**

Run: `grep -rn "match-preview-precompute\\|MatchPreviewQueueService" apps/api/src/`

Inject `NotificationsService` and `ProfilesRepository`. Inside the worker's main `process()` catch (or the equivalent error path), emit:

```ts
const adminIds = await this.profiles.findIdsByRole("admin");
await this.notifications.emitMany(adminIds, {
  eventType: "system_ai_scoring_failure",
  scope: "system",
  entityType: "match_preview_job",
  entityId: job.id,
  metadata: {
    failureId: job.id,
    summary: `AI scoring failed for job ${job.data?.applicationId ?? job.id}: ${err.message}`,
  },
});
await this.audit.log({
  actorId: null,
  actorType: "system",
  action: AUDIT_ACTIONS.SYSTEM_AI_SCORING_FAILURE_NOTIFIED,
  entityType: "queue_job",
  entityId: job.id,
  details: { error: String(err) },
});
```

> Skip the moderation event hookup - `system_moderation_queue_item` waits for the moderation module to ship.

- [ ] **Step 3: Tests + verify + commit**

```bash
pnpm --filter api test
pnpm --filter api type-check && pnpm --filter api lint
git add apps/api/src/modules/invitations/ apps/api/src/queue/ apps/api/src/audit/audit.types.ts
git commit -m "feat(api): emit notifications on invite accept/decline + AI scoring failure"
```

---

## Phase 8 - API client regeneration

### Task 28: Regenerate openapi.json + Orval client

**Files:**

- Regenerate: `apps/api/openapi.json` (or `packages/shared/openapi.json` - check which the project uses)
- Regenerate: `packages/shared/src/api-client/generated.ts`

- [ ] **Step 1: Verify the OpenAPI spec generation script**

Run: `cat apps/api/package.json | grep -A 1 "generate:openapi"`
Use whichever script the project defines. The output path is whatever the script writes to.

- [ ] **Step 2: Build api so the controllers are picked up**

Run: `pnpm --filter api build`
Expected: build succeeds.

- [ ] **Step 3: Generate the OpenAPI spec**

Run: `pnpm --filter api generate:openapi`
Expected: openapi.json updated. Inspect with `git diff -- apps/api/openapi.json packages/shared/openapi.json` to confirm new `notifications` and `notification-preferences` paths appear.

- [ ] **Step 4: Regenerate the TypeScript client**

Run: `pnpm --filter @aurahire/shared codegen`
Expected: `packages/shared/src/api-client/generated.ts` regenerated with new hooks.

- [ ] **Step 5: Confirm hooks exist in the generated file**

Run: `grep -n "useGetNotifications\\|useGetNotificationPreferences\\|usePostNotificationsReadAll\\|usePutNotificationPreferences\\|usePostNotificationPreferencesRestoreDefaults" packages/shared/src/api-client/generated.ts | head -20`

Expected: at least the listed hook names present (exact spelling may vary by Orval naming convention - note the actual names for use in frontend tasks).

- [ ] **Step 6: Type-check the shared package**

Run: `pnpm --filter @aurahire/shared type-check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/openapi.json packages/shared/openapi.json packages/shared/src/api-client/generated.ts
git commit -m "chore: regenerate openapi.json + Orval client for notifications endpoints"
```

---

## Phase 9 - Frontend bell + nav

### Task 29: Create the nav-item-badge component

**Files:**

- Create: `apps/web/components/layout/nav-item-badge.tsx`
- Create: `apps/web/components/layout/__tests__/nav-item-badge.spec.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavItemBadge } from "../nav-item-badge";
import * as api from "@aurahire/shared";

vi.mock("@aurahire/shared", async () => {
  const actual = await vi.importActual<typeof api>("@aurahire/shared");
  return {
    ...actual,
    useGetNotificationsUnreadCount: vi.fn(),
  };
});

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("NavItemBadge", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing when count is 0", () => {
    (api.useGetNotificationsUnreadCount as any).mockReturnValue({
      data: { count: 0, displayCount: "0" },
    });
    const { container } = wrap(<NavItemBadge />);
    expect(container.textContent).toBe("");
  });

  it("renders the displayCount when count > 0", () => {
    (api.useGetNotificationsUnreadCount as any).mockReturnValue({
      data: { count: 3, displayCount: "3" },
    });
    wrap(<NavItemBadge />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders 99+ when count exceeds 99", () => {
    (api.useGetNotificationsUnreadCount as any).mockReturnValue({
      data: { count: 150, displayCount: "99+" },
    });
    wrap(<NavItemBadge />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("renders nothing when data is undefined (loading)", () => {
    (api.useGetNotificationsUnreadCount as any).mockReturnValue({
      data: undefined,
    });
    const { container } = wrap(<NavItemBadge />);
    expect(container.textContent).toBe("");
  });
});
```

- [ ] **Step 2: Implement the component**

```tsx
"use client";

import { useGetNotificationsUnreadCount } from "@aurahire/shared";

export function NavItemBadge() {
  const { data } = useGetNotificationsUnreadCount({
    query: {
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
    },
  });
  if (!data || data.count === 0) return null;
  return (
    <span className="ml-auto rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-xs font-medium text-[var(--color-on-primary)]">
      {data.displayCount}
    </span>
  );
}
```

> **Confirm:** the actual hook name from Task 28 may differ (check by running `grep -n "useGet.*Notifications.*Unread" packages/shared/src/api-client/generated.ts`). Adjust import accordingly. The tailwind CSS-vars `--color-primary` and `--color-on-primary` should exist in `apps/web/app/globals.css` per the design system; if they're named differently (e.g., `--primary`, `--on-primary`), use whatever convention the existing components use.

- [ ] **Step 3: Run test + type-check + lint**

Run: `pnpm --filter web test -- nav-item-badge && pnpm --filter web type-check && pnpm --filter web lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/layout/nav-item-badge.tsx apps/web/components/layout/__tests__/nav-item-badge.spec.tsx
git commit -m "feat(web): NavItemBadge polling unread notification count (99+ cap, hides when zero)"
```

---

### Task 30: Add Notifications nav item to portal-sidebar

**Files:**

- Modify: `apps/web/components/layout/portal-sidebar.tsx`

- [ ] **Step 1: Read the current sidebar to confirm the `NavItem` shape**

Open `apps/web/components/layout/portal-sidebar.tsx`. Locate the `NAV_SECTIONS: Record<UserRole, NavSection[]>` definition. Note the `NavItem` interface - it should have at minimum `{ href, label, icon, matchPrefix? }`.

- [ ] **Step 2: Extend the `NavItem` type to support an optional badge slot**

Find the `NavItem` interface and add:

```ts
interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  matchPrefix?: string;
  badge?: React.FC; // NEW - optional badge component rendered after label
}
```

- [ ] **Step 3: Render the badge inline in the row component**

Find the JSX that renders a single `NavItem`. Add (immediately after the label):

```tsx
{
  item.badge && <item.badge />;
}
```

- [ ] **Step 4: Add the Notifications entry to all three roles' MAIN section**

Import:

```tsx
import { Bell } from "lucide-react";
import { NavItemBadge } from "./nav-item-badge";
```

In `NAV_SECTIONS.candidate`, find the MAIN section (which today has Dashboard + Browse Jobs) and insert between them:

```ts
{
  href: "/candidate/notifications",
  label: "Notifications",
  icon: Bell,
  badge: NavItemBadge,
},
```

Repeat in `NAV_SECTIONS.recruiter` MAIN section (`href: "/recruiter/notifications"`) and `NAV_SECTIONS.admin` MAIN section (`href: "/admin/notifications"`).

- [ ] **Step 5: Type-check + lint**

Run: `pnpm --filter web type-check && pnpm --filter web lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/layout/portal-sidebar.tsx
git commit -m "feat(web): add Notifications nav entry with badge to all three role sidebars"
```

---

## Phase 10 - Notifications page

### Task 31: Notification icon map

**Files:**

- Create: `apps/web/components/notifications/notification-icon-map.ts`

- [ ] **Step 1: Create the file**

```ts
import {
  Bell,
  Briefcase,
  Calendar,
  Check,
  Clock,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
  X,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import type { NotificationEventType } from "@aurahire/shared";

export const NOTIFICATION_ICONS: Record<NotificationEventType, LucideIcon> = {
  application_status_changed: Briefcase,
  interview_scheduled: Calendar,
  interview_reminder_24h: Clock,
  interview_cancelled: X,
  offer_received: Check,
  offer_expiring_soon: Clock,
  new_application_received: UserPlus,
  candidate_withdrew: UserMinus,
  interview_feedback_due: AlertCircle,
  offer_accepted: Check,
  offer_declined: X,
  bias_flag_raised: ShieldAlert,
  team_invite_accepted: UserCheck,
  team_invite_declined: UserMinus,
  system_bias_flag_raised: ShieldAlert,
  system_ai_scoring_failure: AlertCircle,
  system_moderation_queue_item: Settings,
  account_password_reset: ShieldCheck,
  account_email_verified: ShieldCheck,
  account_login_new_device: ShieldAlert,
};

export function getNotificationIcon(
  eventType: NotificationEventType,
): LucideIcon {
  return NOTIFICATION_ICONS[eventType] ?? Bell;
}
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm --filter web type-check
git add apps/web/components/notifications/notification-icon-map.ts
git commit -m "feat(web): notification event-type → Lucide icon registry"
```

---

### Task 32: Empty state component

**Files:**

- Create: `apps/web/components/notifications/notifications-empty-state.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { BellOff, Inbox } from "lucide-react";

interface NotificationsEmptyStateProps {
  tab: "unread" | "all" | "system";
}

const COPY: Record<
  NotificationsEmptyStateProps["tab"],
  { title: string; subtitle: string; Icon: typeof Inbox }
> = {
  unread: {
    title: "All caught up",
    subtitle: "No unread notifications.",
    Icon: BellOff,
  },
  all: {
    title: "No notifications yet",
    subtitle: "Your activity will appear here as it happens.",
    Icon: Inbox,
  },
  system: {
    title: "No system events",
    subtitle:
      "Cross-tenant bias flags, AI scoring failures, and moderation events will appear here.",
    Icon: Inbox,
  },
};

export function NotificationsEmptyState({ tab }: NotificationsEmptyStateProps) {
  const { title, subtitle, Icon } = COPY[tab];
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-strong)]">
        <Icon className="h-7 w-7 text-[var(--color-muted)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--color-muted)]">
        {subtitle}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm --filter web type-check
git add apps/web/components/notifications/notifications-empty-state.tsx
git commit -m "feat(web): NotificationsEmptyState (per-tab copy)"
```

---

### Task 33: NotificationRow

**Files:**

- Create: `apps/web/components/notifications/notification-row.tsx`
- Create: `apps/web/components/notifications/__tests__/notification-row.spec.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationRow } from "../notification-row";
import * as nav from "next/navigation";
import * as api from "@aurahire/shared";

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof nav>("next/navigation");
  return { ...actual, useRouter: vi.fn() };
});
vi.mock("@aurahire/shared", async () => {
  const actual = await vi.importActual<typeof api>("@aurahire/shared");
  return {
    ...actual,
    usePostNotificationsIdRead: vi.fn(),
    useDeleteNotificationsId: vi.fn(),
  };
});

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const baseRow = {
  id: "n1",
  eventType: "application_status_changed" as const,
  scope: "personal" as const,
  title: "Status changed",
  body: "Moved to Interview",
  link: "/candidate/applications/abc",
  entityType: "application",
  entityId: "abc",
  actorId: null,
  metadata: null,
  readAt: null,
  createdAt: new Date().toISOString(),
};

describe("NotificationRow", () => {
  let push: ReturnType<typeof vi.fn>;
  let mutateRead: ReturnType<typeof vi.fn>;
  let mutateDismiss: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    push = vi.fn();
    mutateRead = vi.fn();
    mutateDismiss = vi.fn();
    (nav.useRouter as any).mockReturnValue({ push });
    (api.usePostNotificationsIdRead as any).mockReturnValue({
      mutate: mutateRead,
    });
    (api.useDeleteNotificationsId as any).mockReturnValue({
      mutate: mutateDismiss,
    });
  });

  it("shows unread dot when readAt is null", () => {
    wrap(<NotificationRow row={baseRow} />);
    expect(screen.getByTestId("unread-dot")).toBeInTheDocument();
  });

  it("hides unread dot when readAt is set", () => {
    wrap(
      <NotificationRow
        row={{ ...baseRow, readAt: new Date().toISOString() }}
      />,
    );
    expect(screen.queryByTestId("unread-dot")).not.toBeInTheDocument();
  });

  it("clicking the row marks read and navigates", () => {
    wrap(<NotificationRow row={baseRow} />);
    fireEvent.click(screen.getByRole("button", { name: /Status changed/i }));
    expect(mutateRead).toHaveBeenCalledWith({ id: "n1" });
    expect(push).toHaveBeenCalledWith("/candidate/applications/abc");
  });

  it("dismiss button triggers delete mutation", () => {
    wrap(<NotificationRow row={baseRow} />);
    fireEvent.click(screen.getByLabelText(/dismiss/i));
    expect(mutateDismiss).toHaveBeenCalledWith({ id: "n1" });
  });
});
```

- [ ] **Step 2: Implement the row**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  type NotificationItem,
  usePostNotificationsIdRead,
  useDeleteNotificationsId,
} from "@aurahire/shared";
import { getNotificationIcon } from "./notification-icon-map";

function relativeTime(iso: string): string {
  const created = new Date(iso).getTime();
  const elapsed = Date.now() - created;
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

interface NotificationRowProps {
  row: NotificationItem;
}

export function NotificationRow({ row }: NotificationRowProps) {
  const router = useRouter();
  const markRead = usePostNotificationsIdRead();
  const dismiss = useDeleteNotificationsId();
  const Icon = getNotificationIcon(row.eventType);
  const isUnread = row.readAt === null;

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-dismiss]")) return;
    if (isUnread) {
      markRead.mutate({ id: row.id });
    }
    if (row.link) {
      router.push(row.link);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismiss.mutate({ id: row.id });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group relative flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[var(--color-surface-soft)] transition-colors"
    >
      {isUnread && (
        <span
          data-testid="unread-dot"
          aria-label="unread"
          className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[var(--color-primary)]"
        />
      )}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-strong)]">
        <Icon className="h-5 w-5 text-[var(--color-ink)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
            {row.title}
          </p>
          <span className="text-xs text-[var(--color-muted)]">
            {relativeTime(row.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-[var(--color-body)]">
          {row.body}
        </p>
      </div>
      <button
        type="button"
        data-dismiss
        aria-label="Dismiss notification"
        onClick={handleDismiss}
        className="shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--color-surface-strong)]"
      >
        <X className="h-4 w-4 text-[var(--color-muted)]" />
      </button>
    </button>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter web test -- notification-row`
Expected: PASS.

- [ ] **Step 4: Type-check + lint + commit**

```bash
pnpm --filter web type-check && pnpm --filter web lint
git add apps/web/components/notifications/notification-row.tsx apps/web/components/notifications/__tests__/notification-row.spec.tsx
git commit -m "feat(web): NotificationRow (icon, title, body, timestamp, unread dot, dismiss)"
```

---

### Task 34: Notifications list with infinite scroll

**Files:**

- Create: `apps/web/components/notifications/notifications-list.tsx`

- [ ] **Step 1: Implement the list**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getGetNotifications, type NotificationItem } from "@aurahire/shared";
import { NotificationRow } from "./notification-row";
import { NotificationsEmptyState } from "./notifications-empty-state";

interface NotificationsListProps {
  tab: "unread" | "all" | "system";
}

export function NotificationsList({ tab }: NotificationsListProps) {
  const apiTab = tab === "system" ? "all" : tab;
  const query = useInfiniteQuery({
    queryKey: ["notifications", "list", apiTab],
    queryFn: ({ pageParam }) =>
      getGetNotifications({ tab: apiTab, limit: 20, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver((entries) => {
      if (
        entries[0].isIntersecting &&
        query.hasNextPage &&
        !query.isFetchingNextPage
      ) {
        query.fetchNextPage();
      }
    });
    obs.observe(node);
    return () => obs.disconnect();
  }, [query]);

  if (query.isLoading) {
    return (
      <div className="py-8 text-center text-sm text-[var(--color-muted)]">
        Loading…
      </div>
    );
  }

  const allRows: NotificationItem[] = (query.data?.pages ?? []).flatMap(
    (p) => p.items,
  );
  const filtered =
    tab === "system" ? allRows.filter((r) => r.scope === "system") : allRows;

  if (filtered.length === 0) {
    return <NotificationsEmptyState tab={tab} />;
  }

  return (
    <div className="divide-y divide-[var(--color-hairline)] rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
      {filtered.map((row) => (
        <NotificationRow key={row.id} row={row} />
      ))}
      <div ref={sentinelRef} />
      {query.hasNextPage && (
        <button
          type="button"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="w-full py-3 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-surface-soft)]"
        >
          {query.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
```

> **Confirm:** the actual exported function for `getGetNotifications`. Orval may export under different names - `grep -n "getNotifications\\|GetNotifications" packages/shared/src/api-client/generated.ts` to find the right one.

- [ ] **Step 2: Type-check + commit**

```bash
pnpm --filter web type-check && pnpm --filter web lint
git add apps/web/components/notifications/notifications-list.tsx
git commit -m "feat(web): NotificationsList with infinite scroll + intersection observer"
```

---

### Task 35: NotificationsPage orchestrator

**Files:**

- Create: `apps/web/components/notifications/notifications-page.tsx`
- Create: `apps/web/components/notifications/__tests__/notifications-page.spec.tsx`

- [ ] **Step 1: Implement the page**

```tsx
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetNotificationsUnreadCount,
  usePostNotificationsReadAll,
} from "@aurahire/shared";
import { NotificationsList } from "./notifications-list";

interface NotificationsPageProps {
  role: "candidate" | "recruiter" | "admin";
}

type Tab = "unread" | "all" | "system";

export function NotificationsPage({ role }: NotificationsPageProps) {
  const [tab, setTab] = useState<Tab>("unread");
  const queryClient = useQueryClient();
  const { data: unread } = useGetNotificationsUnreadCount({
    query: { refetchInterval: 30_000, refetchIntervalInBackground: false },
  });
  const markAll = usePostNotificationsReadAll({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      },
    },
  });

  const tabs: Tab[] =
    role === "admin" ? ["unread", "all", "system"] : ["unread", "all"];

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            <span className="font-mono">{unread?.displayCount ?? "0"}</span>{" "}
            unread
          </p>
        </div>
        {(unread?.count ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => markAll.mutate(undefined)}
            disabled={markAll.isPending}
            className="rounded-full border border-[var(--color-hairline)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
          >
            Mark all as read
          </button>
        )}
      </header>

      <div className="mb-4 flex gap-1 border-b border-[var(--color-hairline)]">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`relative px-4 py-2 text-sm font-medium capitalize ${
              tab === t
                ? "text-[var(--color-ink)]"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            {t}
            {tab === t && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--color-primary)]" />
            )}
          </button>
        ))}
      </div>

      <NotificationsList tab={tab} />
    </div>
  );
}
```

- [ ] **Step 2: Write a focused test**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationsPage } from "../notifications-page";
import * as api from "@aurahire/shared";

vi.mock("@aurahire/shared", async () => {
  const actual = await vi.importActual<typeof api>("@aurahire/shared");
  return {
    ...actual,
    useGetNotificationsUnreadCount: vi.fn(),
    usePostNotificationsReadAll: vi.fn(),
  };
});

vi.mock("../notifications-list", () => ({
  NotificationsList: ({ tab }: { tab: string }) => (
    <div data-testid="list">{tab}</div>
  ),
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient();
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("NotificationsPage", () => {
  beforeEach(() => {
    (api.useGetNotificationsUnreadCount as any).mockReturnValue({
      data: { count: 3, displayCount: "3" },
    });
    (api.usePostNotificationsReadAll as any).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it("starts on the Unread tab", () => {
    wrap(<NotificationsPage role="candidate" />);
    expect(screen.getByTestId("list")).toHaveTextContent("unread");
  });

  it("only shows Mark all as read when unread > 0", () => {
    wrap(<NotificationsPage role="candidate" />);
    expect(screen.getByText(/Mark all as read/i)).toBeInTheDocument();
  });

  it("Mark all hidden when count = 0", () => {
    (api.useGetNotificationsUnreadCount as any).mockReturnValue({
      data: { count: 0, displayCount: "0" },
    });
    wrap(<NotificationsPage role="candidate" />);
    expect(screen.queryByText(/Mark all as read/i)).not.toBeInTheDocument();
  });

  it("admin sees a System tab", () => {
    wrap(<NotificationsPage role="admin" />);
    expect(
      screen.getByRole("button", { name: /^system$/i }),
    ).toBeInTheDocument();
  });

  it("non-admin does not see a System tab", () => {
    wrap(<NotificationsPage role="candidate" />);
    expect(
      screen.queryByRole("button", { name: /^system$/i }),
    ).not.toBeInTheDocument();
  });

  it("clicking a tab switches the list", () => {
    wrap(<NotificationsPage role="candidate" />);
    fireEvent.click(screen.getByRole("button", { name: /^all$/i }));
    expect(screen.getByTestId("list")).toHaveTextContent("all");
  });
});
```

- [ ] **Step 3: Run tests + verify + commit**

```bash
pnpm --filter web test -- notifications-page
pnpm --filter web type-check && pnpm --filter web lint
git add apps/web/components/notifications/notifications-page.tsx apps/web/components/notifications/__tests__/notifications-page.spec.tsx
git commit -m "feat(web): NotificationsPage (header, tabs, mark-all-read, role-conditional System tab)"
```

---

### Task 36: Three thin route files

**Files:**

- Create: `apps/web/app/(candidate)/candidate/notifications/page.tsx`
- Create: `apps/web/app/(recruiter)/recruiter/notifications/page.tsx`
- Create: `apps/web/app/(admin)/admin/notifications/page.tsx`

- [ ] **Step 1: Create the candidate page**

```tsx
import { NotificationsPage } from "@/components/notifications/notifications-page";

export const metadata = { title: "Notifications · AuraHire" };

export default function Page() {
  return <NotificationsPage role="candidate" />;
}
```

- [ ] **Step 2: Create the recruiter page** (same content, `role="recruiter"`)

- [ ] **Step 3: Create the admin page** (same content, `role="admin"`)

> **Confirm:** the path-alias prefix (`@/components/...`) by checking `tsconfig.json`'s `paths`. Adjust if the project uses a different alias.

- [ ] **Step 4: Type-check + commit**

```bash
pnpm --filter web type-check
git add apps/web/app/
git commit -m "feat(web): /[role]/notifications route files for all three portals"
```

---

## Phase 11 - Settings rewrite

### Task 37: Rewrite notifications-form.tsx

**Files:**

- Modify: `apps/web/components/settings/notifications-form.tsx` (full rewrite)
- Create: `apps/web/components/settings/__tests__/notifications-form.spec.tsx`

This rewrite replaces the localStorage-only form with an API-backed one. It also performs the one-time legacy-key migration on mount.

- [ ] **Step 1: Read the current form to preserve any role context API**

Open `apps/web/components/settings/notifications-form.tsx`. Note any role prop, layout container, and the existing legacy keys (e.g., `notif-prefs:recruiter`, `notif-prefs:candidate`).

- [ ] **Step 2: Implement the rewrite**

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetNotificationPreferences,
  usePutNotificationPreferences,
  usePostNotificationPreferencesRestoreDefaults,
  type PreferenceItem,
  type NotificationMode,
} from "@aurahire/shared";

interface NotificationsFormProps {
  role: "candidate" | "recruiter" | "admin";
}

const MODE_OPTIONS: NotificationMode[] = ["instant", "digest", "off"];
const MODE_LABEL: Record<NotificationMode, string> = {
  instant: "Instant",
  digest: "Digest",
  off: "Off",
};

const CATEGORY_LABEL: Record<string, string> = {
  account: "Account & security",
  applications: "Applications",
  interviews: "Interviews",
  offers: "Offers",
  bias: "Bias & fairness",
  team: "Team",
  system: "System",
};

const CATEGORY_ORDER = [
  "account",
  "applications",
  "interviews",
  "offers",
  "bias",
  "team",
  "system",
];

const LEGACY_KEYS: Record<string, string[]> = {
  candidate: ["notif-prefs:candidate"],
  recruiter: ["notif-prefs:recruiter"],
  admin: ["notif-prefs:admin"],
};

export function NotificationsForm({ role }: NotificationsFormProps) {
  const { data: prefs, refetch } = useGetNotificationPreferences();
  const queryClient = useQueryClient();
  const upsert = usePutNotificationPreferences();
  const restore = usePostNotificationPreferencesRestoreDefaults({
    mutation: { onSuccess: () => refetch() },
  });
  const migrated = useRef(false);

  // One-time legacy localStorage migration.
  useEffect(() => {
    if (migrated.current || typeof window === "undefined") return;
    migrated.current = true;
    const keys = LEGACY_KEYS[role] ?? [];
    let any = false;
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      any = true;
      try {
        const legacy = JSON.parse(raw) as Record<string, boolean>;
        for (const [eventType, enabled] of Object.entries(legacy)) {
          // Map legacy boolean → new mode space; engineer should adjust per the project's actual legacy keys.
          upsert.mutate({
            data: {
              eventType: eventType as PreferenceItem["eventType"],
              mode: enabled ? "instant" : "off",
            },
          });
        }
      } catch {
        // ignore malformed legacy data
      }
      window.localStorage.removeItem(key);
    }
    if (any) {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    }
  }, [role, upsert, queryClient]);

  const grouped = useMemo(() => {
    const map = new Map<string, PreferenceItem[]>();
    for (const item of prefs ?? []) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map(
      (c) => [c, map.get(c)!] as const,
    );
  }, [prefs]);

  return (
    <div className="space-y-8">
      {grouped.map(([category, items]) => (
        <section key={category}>
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-[var(--color-ink)]">
              {CATEGORY_LABEL[category] ?? category}
            </h2>
            {category !== "account" && (
              <button
                type="button"
                onClick={() =>
                  restore.mutate({ data: { category: category as any } })
                }
                className="text-xs text-[var(--color-primary)] hover:underline"
              >
                Restore defaults
              </button>
            )}
          </header>
          <div className="divide-y divide-[var(--color-hairline)] rounded-2xl border border-[var(--color-hairline)]">
            {items.map((item) => (
              <PreferenceRow key={item.eventType} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

interface PreferenceRowProps {
  item: PreferenceItem;
}

function PreferenceRow({ item }: PreferenceRowProps) {
  const [pending, setPending] = useState<NotificationMode | null>(null);
  const upsert = usePutNotificationPreferences();
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const display: NotificationMode = pending ?? item.mode;
  const disabled = item.isSecurityLocked;

  const handleChange = (mode: NotificationMode) => {
    if (disabled) return;
    setPending(mode);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      upsert.mutate(
        { data: { eventType: item.eventType, mode } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: ["notification-preferences"],
            });
            setPending(null);
          },
          onError: () => setPending(null),
        },
      );
    }, 300);
  };

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-ink)]">
          {item.label}
        </p>
        <p className="mt-0.5 text-xs text-[var(--color-muted)]">
          {item.description}
        </p>
      </div>
      <div className="shrink-0">
        {disabled ? (
          <span className="rounded-full bg-[var(--color-surface-strong)] px-3 py-1 text-xs text-[var(--color-muted)]">
            Required for security
          </span>
        ) : (
          <div className="flex overflow-hidden rounded-full border border-[var(--color-hairline)]">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleChange(opt)}
                className={`px-3 py-1 text-xs font-medium ${
                  display === opt
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    : "bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
                }`}
              >
                {MODE_LABEL[opt]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write a focused test**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationsForm } from "../notifications-form";
import * as api from "@aurahire/shared";

vi.mock("@aurahire/shared", async () => {
  const actual = await vi.importActual<typeof api>("@aurahire/shared");
  return {
    ...actual,
    useGetNotificationPreferences: vi.fn(),
    usePutNotificationPreferences: vi.fn(),
    usePostNotificationPreferencesRestoreDefaults: vi.fn(),
  };
});

const mockPrefs = [
  {
    eventType: "application_status_changed",
    mode: "instant",
    isDefault: true,
    isSecurityLocked: false,
    category: "applications",
    label: "Application status changed",
    description: "Test description",
  },
  {
    eventType: "account_password_reset",
    mode: "instant",
    isDefault: false,
    isSecurityLocked: true,
    category: "account",
    label: "Password reset confirmation",
    description: "Required",
  },
];

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient();
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("NotificationsForm", () => {
  let upsertMutate: ReturnType<typeof vi.fn>;
  let restoreMutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    upsertMutate = vi.fn();
    restoreMutate = vi.fn();
    (api.useGetNotificationPreferences as any).mockReturnValue({
      data: mockPrefs,
      refetch: vi.fn(),
    });
    (api.usePutNotificationPreferences as any).mockReturnValue({
      mutate: upsertMutate,
    });
    (api.usePostNotificationPreferencesRestoreDefaults as any).mockReturnValue({
      mutate: restoreMutate,
    });
  });

  afterEach(() => vi.useRealTimers());

  it("renders security-locked rows with the Required caption", () => {
    wrap(<NotificationsForm role="candidate" />);
    expect(screen.getByText(/Required for security/i)).toBeInTheDocument();
  });

  it("changing a row triggers a debounced PUT after 300ms", async () => {
    wrap(<NotificationsForm role="candidate" />);
    fireEvent.click(screen.getAllByRole("button", { name: /^Off$/i })[0]);
    expect(upsertMutate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    await waitFor(() => expect(upsertMutate).toHaveBeenCalled());
    const call = upsertMutate.mock.calls[0][0];
    expect(call.data.eventType).toBe("application_status_changed");
    expect(call.data.mode).toBe("off");
  });

  it("Restore defaults calls the right endpoint", () => {
    wrap(<NotificationsForm role="candidate" />);
    fireEvent.click(screen.getByRole("button", { name: /Restore defaults/i }));
    expect(restoreMutate).toHaveBeenCalledWith({
      data: { category: "applications" },
    });
  });

  it("does not show Restore defaults for the account category", () => {
    (api.useGetNotificationPreferences as any).mockReturnValue({
      data: [mockPrefs[1]],
      refetch: vi.fn(),
    });
    wrap(<NotificationsForm role="candidate" />);
    expect(
      screen.queryByRole("button", { name: /Restore defaults/i }),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Update the settings page that uses this form to pass the role prop**

For each role's settings page that imports `NotificationsForm`, ensure the role prop is passed. Look for the existing import in `apps/web/app/(recruiter)/recruiter/settings/notifications/page.tsx` and equivalents.

- [ ] **Step 5: Run tests + verify + commit**

```bash
pnpm --filter web test -- notifications-form
pnpm --filter web type-check && pnpm --filter web lint
git add apps/web/components/settings/notifications-form.tsx apps/web/components/settings/__tests__/notifications-form.spec.tsx apps/web/app/
git commit -m "feat(web): rewrite notifications-form with API backing + 3-mode prefs + localStorage migration"
```

---

## Phase 12 - Verification

### Task 38: Final build + manual smoke checklist

**Files:**

- None (verification only)

- [ ] **Step 1: Full type-check across all packages**

```bash
pnpm --filter @aurahire/db type-check
pnpm --filter @aurahire/shared type-check
pnpm --filter api type-check
pnpm --filter web type-check
```

Expected: every command exits 0.

- [ ] **Step 2: Full lint**

```bash
pnpm --filter api lint
pnpm --filter web lint
pnpm --filter @aurahire/shared lint
```

Expected: every command exits 0.

- [ ] **Step 3: Full backend test suite**

```bash
pnpm --filter api test
```

Expected: all tests pass.

- [ ] **Step 4: Full frontend test suite**

```bash
pnpm --filter web test
```

Expected: all tests pass.

- [ ] **Step 5: Production builds**

```bash
pnpm --filter api build
pnpm --filter web build
```

Expected: both builds succeed.

- [ ] **Step 6: Hand off to the human for manual smoke verification**

Ask the human to:

1. Start the dev stack: `pnpm dev` (and ensure Docker containers for Mailpit + Redis are running).
2. **As candidate (Christian's account or a seeded candidate):**
   - Visit `/candidate/notifications` - empty state shows.
   - Apply to a job (any).
   - As recruiter, change the application status - within 30s the candidate's bell should show `1`, and the page lists "Application moved to ...".
   - Click the row - navigates to the application detail; bell drops to `0`.
   - Open Mailpit at `http://localhost:8025` - verify a "Application update" email arrived.
3. **As recruiter:**
   - Visit `/recruiter/settings/notifications` - preferences load from API (no banner about localStorage).
   - Toggle `new_application_received` to **Off** - apply as another candidate; no row appears in recruiter notifications.
   - Toggle it to **Digest** - apply again; row appears in-app immediately, no email immediately.
   - Manually invoke `DigestEmailCron.handleDigestRun()` (or wait for 08:00) - Mailpit shows one digest email containing the row.
   - Toggle `account_password_reset` - UI prevents the toggle (security-locked).
   - Click "Restore defaults" under Applications - preference rows for that category are deleted, defaults reapply.
4. **As admin:**
   - Visit `/admin/notifications` - System tab present.
   - Cause an AI scoring failure (or simulate by manually pushing a failing job to `match-preview-precompute`) - admin sees `system_ai_scoring_failure` in System tab.

Once all 4 sections are confirmed by the human, the implementation is complete.

- [ ] **Step 7: Summary commit (if any cleanup needed)**

```bash
git status
# If any leftover changes:
git add <paths>
git commit -m "chore: smoke verification cleanup"
```

---

## Done

Final state: bell badge polls and shows unread count (capped at `99+`); a dedicated `/[role]/notifications` page renders unread/all (admin: + system) tabs with click-to-mark-read row navigation, mark-all, and soft-dismiss; settings page wires preferences to the API with categories, 3-mode segmented controls, security-locked rows, and per-category restore-defaults; emails route through one BullMQ queue with instant + digest paths, both rendering React Email templates per event type; five new crons handle digest delivery, retention, and three 24h reminders; and every consequential service-layer mutation now emits notifications alongside its existing `audit_logs` write.
