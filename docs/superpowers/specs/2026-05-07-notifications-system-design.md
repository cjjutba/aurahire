# Notifications System - In-App Bell, Notifications Page, Email + Digest

**Date:** 2026-05-07
**Owner:** Cross-portal (candidate · recruiter · admin)
**Status:** approved (curated event taxonomy + polling delivery + per-event-type instant/digest/off email modes)

## Problem

AuraHire has zero user-facing notification surface today. The platform performs many consequential actions on behalf of users - applications get reviewed, interviews are scheduled, offers are sent, bias flags are raised, AI scoring completes - but the only feedback channels are: (1) the user happens to revisit the right page and sees a changed status, (2) email infrastructure exists (`apps/api/src/email/email.service.ts` with React Email + Mailpit/Resend) but is not wired to any module, (3) `audit_logs` records what happened but is invisible to users. The recruiter settings page has a notification-preferences form (`apps/web/components/settings/notifications-form.tsx`) that writes to `localStorage` only and shows a banner reading "Notification preferences will sync to the email service in a future release."

This is a fundamental gap for a recruitment platform. Candidates miss interview invitations because they don't get pinged. Recruiters miss bias flags raised on JDs they published. Admins have no surface for system-wide events (cross-tenant bias flags, AI scoring failures). The thesis story - "explainable, fair AI-powered recruitment" - is undermined when users never learn that an AI decision affected them.

## Goal

Ship a notification system that:

- Surfaces a bell badge in every portal sidebar showing unread count (capped at `99+`).
- Provides a dedicated `/notifications` page per role with Unread/All tabs (admin gets a third System tab), click-to-mark-read row navigation, mark-all-read, and soft-dismiss.
- Sends emails through the existing React Email + Mailpit/Resend infrastructure, with three modes per event type - Instant, Digest, Off - configurable in the existing settings page (replacing the localStorage-only form).
- Wires notifications into the same service-layer call sites that already write `audit_logs`, with non-blocking failure semantics (a failed notification never breaks a user action).
- Adds nothing new to the dependency graph - uses existing BullMQ, `@nestjs/schedule`, React Email, Orval, TanStack Query, Drizzle, Supabase.

## Scope

**In scope:**

- New `notifications` and `notification_preferences` tables in `packages/db/`.
- New NestJS modules `notifications/` and `notification-preferences/` under `apps/api/src/modules/`.
- Five new cron jobs: digest email batch, retention cleanup, interview reminder (24h), offer expiry reminder (24h), interview feedback due (24h post-interview).
- One new BullMQ queue `notification-email`.
- `apps/web/components/notifications/` page + row + list + empty-state components.
- `apps/web/components/layout/portal-sidebar.tsx` adds a `Notifications` nav item with inline badge in the MAIN section for all three roles.
- Full rewrite of `apps/web/components/settings/notifications-form.tsx` (currently localStorage; new version wires to API with grouped categories, 3-mode segmented controls, security-locked rows, restore-defaults per category).
- Service-layer hookups in `applications`, `interviews`, `offers`, `bias`, `auth`, `invitations`, and the `match-preview-precompute` queue processor.
- Zod schemas in `packages/shared/src/schemas/notifications.ts`; regenerated Orval client at `packages/shared/src/api-client/generated.ts`.
- One-time client-side migration of legacy `localStorage` notification preferences to the API.
- Test coverage at unit, cron, integration, and e2e levels (e2e gated on Playwright presence).

**Out of scope (explicit):**

- Supabase Realtime subscription for the bell - polling only at MVP. Schema is forward-compatible.
- Team-wide fanout for `new_application_received` and `bias_flag_raised` - MVP notifies the job's owning recruiter only.
- Per-user digest cadence (daily vs weekly) and per-user digest delivery time - server-wide daily 08:00 Asia/Manila for MVP.
- Resend bounce/complaint webhook handling.
- Browser push or native push notifications.
- Recruiter-side read receipts ("candidate has seen this notification").
- AI-summarized digest emails.
- Prometheus `/metrics` counters for notification volume.
- Visual regression tests of the new components.

## Decisions locked

| #   | Decision        | Choice                                                                                                                                      | Rationale                                                                                                                                                                              |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Event taxonomy  | Curated user-pivotal events (~20 types), not an `audit_logs` 1:1 mirror                                                                     | Audit logs are forensic; notifications are for human attention. Mixing them turns the bell into a fire hose.                                                                           |
| 2   | In-app delivery | Polling via TanStack Query (`refetchInterval: 30_000`, paused when blurred)                                                                 | No new dependencies; consistent with the rest of the data-fetching stack; sub-30s latency is acceptable when email handles urgent. Realtime upgrade path is a single-component change. |
| 3   | Email cadence   | Per-event-type configurable: Instant / Digest / Off                                                                                         | High-volume events (recruiter receiving applications) need batching; security/offer events need urgency; off is a real preference.                                                     |
| 4   | Read-state UX   | Click row → mark read + navigate; bell counts only `read_at IS NULL`; `99+` cap; "Mark all as read" button; soft-dismiss kept for retention | Matches Linear/GitHub/Gmail mental models. Cap is server-rendered for invariance across clients.                                                                                       |
| 5   | Retention       | Daily cron deletes rows older than 90 days                                                                                                  | Audit logs are the immortal record; notifications are ephemeral. One cron, one rule.                                                                                                   |
| 6   | Admin scope     | Personal + system events merged in one stream, separated via tab/filter                                                                     | One bell to check; `scope` column distinguishes; same schema serves both.                                                                                                              |
| 7   | Settings UI     | Grouped by category (Account/Apps/Interviews/Offers/Bias/System), 3-way segmented control per row, restore-defaults per category            | Explicit and scannable; security events render as disabled rows with "Required for security" caption.                                                                                  |

## Architecture

### Module layout

```
apps/api/src/modules/
├── notifications/                          (new)
│   ├── notifications.module.ts
│   ├── notifications.controller.ts
│   ├── notifications.service.ts            - emit(), emitMany(), list, count, mark-read, dismiss
│   ├── notifications.repository.ts
│   ├── event-defaults.ts                   - DEFAULT_MODES, SECURITY_EVENTS
│   ├── queues.ts                           - NOTIFICATION_EMAIL_QUEUE constant
│   ├── notification-email.processor.ts     - BullMQ worker for instant + digest emails
│   ├── templates/
│   │   ├── index.ts                        - buildTitle/buildBody/buildLink registry
│   │   ├── base-layout.tsx                 - shared React Email layout
│   │   ├── application-status-changed-email.tsx
│   │   ├── interview-scheduled-email.tsx
│   │   ├── ... one file per event type
│   │   └── digest-email.tsx                - multi-event digest template
│   └── dto/
│       └── list-notifications.dto.ts       - query DTO for the list endpoint
│
├── notification-preferences/               (new)
│   ├── notification-preferences.module.ts
│   ├── notification-preferences.controller.ts
│   ├── notification-preferences.service.ts - getEffectiveMode(), upsert, restoreDefaults
│   └── dto/upsert-preference.dto.ts
│
apps/api/src/cron/                          (additions)
├── digest-email.cron.ts                    (new) - daily 08:00 Asia/Manila
├── notifications-retention.cron.ts         (new) - daily 03:00 Asia/Manila
├── interview-reminder.cron.ts              (new) - hourly
├── offer-expiry-reminder.cron.ts           (new) - hourly
└── interview-feedback-due.cron.ts          (new) - hourly
```

### Frontend layout

```
apps/web/components/notifications/          (new)
├── notifications-page.tsx                  - orchestration: header, tabs, list
├── notifications-list.tsx                  - infinite-scroll list calling useGetNotifications
├── notification-row.tsx                    - single row (icon + title + body + chip + dismiss)
├── notifications-empty-state.tsx
└── notification-icon-map.ts                - eventType → Lucide icon

apps/web/components/layout/                 (additions)
└── nav-item-badge.tsx                      (new) - bell badge polling unread count

apps/web/app/(candidate)/candidate/notifications/page.tsx  (new)
apps/web/app/(recruiter)/recruiter/notifications/page.tsx  (new)
apps/web/app/(admin)/admin/notifications/page.tsx          (new)

apps/web/components/settings/notifications-form.tsx        (rewrite)
apps/web/components/layout/portal-sidebar.tsx              (edit - add nav item per role)
```

### Data flow (instant path)

```
Service-layer call site (e.g., applications.service.changeStatus)
  └─> notifications.service.emit({ userId, eventType, entityType, entityId, metadata })
        ├─> insertRow()  ─────────────────> notifications table (row visible to bell within 30s)
        └─> getEffectiveMode(userId, eventType)
              ├─ 'instant' OR security event ─> enqueue { kind:'instant', notificationId } → notification-email queue
              ├─ 'digest'                      ─> UPDATE digest_pending = true
              └─ 'off'                          ─> done

notification-email.processor (BullMQ worker)
  └─> render React Email template
  └─> EmailService.send()
  └─> UPDATE email_sent_at = now()
```

### Data flow (digest path)

```
DigestEmailCron (daily 08:00 Asia/Manila)
  ├─> SELECT DISTINCT user_id WHERE digest_pending = true
  └─> for each user (transaction):
        ├─ SELECT digest_pending rows ordered DESC
        ├─ enqueue { kind:'digest', userId, notificationIds[] }
        └─ UPDATE digest_pending = false on those rows
  └─> audit_logs: action='DIGEST_EMAIL_BATCH_RUN'
```

## Schema

### Enums (additions to `packages/db/src/enums.ts`)

```ts
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
```

### `notifications` table

```ts
{
  id: uuid PK defaultRandom()
  userId: uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  eventType: text NOT NULL - enum NOTIFICATION_EVENT_TYPE
  scope: text NOT NULL DEFAULT 'personal' - enum NOTIFICATION_SCOPE
  title: text NOT NULL                   - rendered headline
  body: text NOT NULL                    - 1-2 sentence summary
  link: text NULL                        - destination URL on row click
  entityType: text NULL                  - 'application' | 'interview' | 'offer' | 'job' | 'bias_flag'
  entityId: uuid NULL
  actorId: uuid NULL REFERENCES profiles(id) ON DELETE SET NULL
  metadata: jsonb NULL                   - { scoreValue, matchBand, companyName, ... }
  readAt: timestamptz NULL
  dismissedAt: timestamptz NULL          - soft-delete; hidden from list, kept until retention cron
  digestPending: boolean NOT NULL DEFAULT false
  emailSentAt: timestamptz NULL
  createdAt: timestamptz NOT NULL DEFAULT now()
}
```

Indexes:

- `notifications_user_unread_idx` on `(userId, readAt, createdAt DESC)` - drives unread-count and Unread-tab queries
- `notifications_user_created_idx` on `(userId, createdAt DESC)` - drives All-tab queries
- `notifications_created_at_idx` on `(createdAt)` - drives retention cron
- `notifications_digest_pending_idx` on `(digestPending) WHERE digestPending = true` - partial index for digest cron

### `notification_preferences` table

```ts
{
  id: uuid PK defaultRandom()
  userId: uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  eventType: text NOT NULL - enum NOTIFICATION_EVENT_TYPE
  mode: text NOT NULL - enum NOTIFICATION_MODE
  createdAt: timestamptz NOT NULL DEFAULT now()
  updatedAt: timestamptz NOT NULL DEFAULT now()
  UNIQUE(userId, eventType)
}
```

Sparse by design: a missing row means "use the system default for this event type." New event types added later automatically inherit their default mode without backfill.

### Existing-table additions

Three small flag columns prevent cron duplicate-firing:

- `interviewsTable.reminderSentAt: timestamptz NULL` - set when InterviewReminderCron emits
- `interviewsTable.feedbackDueNotifiedAt: timestamptz NULL` - set when InterviewFeedbackDueCron emits
- `offersTable.expiryReminderSentAt: timestamptz NULL` - set when OfferExpiryReminderCron emits

### Default modes (in code, `event-defaults.ts`)

```ts
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

export const SECURITY_EVENTS = new Set<NotificationEventType>([
  "account_password_reset",
  "account_email_verified",
  "account_login_new_device",
  "offer_expiring_soon",
]);
```

`SECURITY_EVENTS` are hardcoded instant regardless of any preference row; the controller rejects PUTs against these event types with HTTP 400.

### RLS

A Supabase migration (in `supabase/migrations/`, matching the existing pattern) installs RLS policies on both new tables:

- `notifications`: `SELECT/UPDATE/DELETE WHERE auth.uid() = user_id`
- `notification_preferences`: same shape

The backend writes via the service-role key, bypassing RLS for the create-fanout path. RLS provides defense-in-depth for the read path and any direct-DB exposure.

## Event taxonomy and wiring

Each event type's title/body/link is rendered from a single source in `templates.ts`, used both for the in-app row insert and the email render. The link function takes the recipient's role because the same `applicationId` resolves to different routes per role.

| Event type                     | Scope    | Triggered from                                                                           | Recipient resolver             |
| ------------------------------ | -------- | ---------------------------------------------------------------------------------------- | ------------------------------ |
| `application_status_changed`   | personal | `applications.service.changeStatus()`                                                    | `application.candidateId`      |
| `interview_scheduled`          | personal | `interviews.service.schedule()`                                                          | `application.candidateId`      |
| `interview_reminder_24h`       | personal | `InterviewReminderCron` (hourly)                                                         | `application.candidateId`      |
| `interview_cancelled`          | personal | `interviews.service.cancel()`                                                            | `application.candidateId`      |
| `offer_received`               | personal | `offers.service.create()`                                                                | `offer.candidateId`            |
| `offer_expiring_soon`          | personal | `OfferExpiryReminderCron` (hourly)                                                       | `offer.candidateId`            |
| `new_application_received`     | personal | `applications.service.apply()`                                                           | `job.ownerRecruiterId` (MVP)   |
| `candidate_withdrew`           | personal | `applications.service.withdraw()`                                                        | `job.ownerRecruiterId`         |
| `interview_feedback_due`       | personal | `InterviewFeedbackDueCron` (hourly)                                                      | `interview.recruiterId`        |
| `offer_accepted`               | personal | `offers.service.accept()`                                                                | `offer.recruiterId`            |
| `offer_declined`               | personal | `offers.service.decline()`                                                               | `offer.recruiterId`            |
| `bias_flag_raised`             | personal | `bias.service.flag()` (post-publish)                                                     | `job.ownerRecruiterId`         |
| `team_invite_accepted`         | personal | `invitations.service.accept()`                                                           | `invite.inviterId`             |
| `team_invite_declined`         | personal | `invitations.service.decline()`                                                          | `invite.inviterId`             |
| `system_bias_flag_raised`      | system   | `bias.service.flag()` (also fires this)                                                  | all `admin` users (`emitMany`) |
| `system_ai_scoring_failure`    | system   | catch block in the existing match-preview-precompute worker (`MatchPreviewQueueService`) | all `admin` users              |
| `system_moderation_queue_item` | system   | `moderation.service.queue()` (see note below)                                            | all `admin` users              |
| `account_password_reset`       | personal | `auth.service.resetPassword()`                                                           | acting user                    |
| `account_email_verified`       | personal | `auth.service.verifyEmail()`                                                             | acting user                    |
| `account_login_new_device`     | personal | `auth.service.recordLogin()` (unseen fingerprint)                                        | acting user                    |

> **Service-name verification (during plan execution).** `bias.service.flag()` and `moderation.service.queue()` are conceptual call sites - the actual file paths and method names are confirmed by reading the existing modules during plan execution. If the moderation module isn't built yet at implementation time, `system_moderation_queue_item` becomes a phase-2 hookup (the event type still ships in the enum but no producer wires it). Similarly for `auth.service.recordLogin()` device-fingerprinting: if device tracking isn't already implemented, `account_login_new_device` waits for that capability and the spec's three other security events still ship.

### Cron-driven events

All five new crons live under `apps/api/src/cron/` and follow the existing project pattern (audit-log on each run):

- **`InterviewReminderCron`** - `@Cron("0 * * * *")` (hourly). Selects `interviews` where `startTime BETWEEN now() AND now() + interval '24 hours' AND reminderSentAt IS NULL`. For each, calls `notifications.emit(...)` and sets `reminderSentAt = now()` in the same transaction.
- **`OfferExpiryReminderCron`** - hourly. Same pattern keyed off `offers.expiresAt` and `expiryReminderSentAt`.
- **`InterviewFeedbackDueCron`** - hourly. Selects interviews where `endTime + interval '24 hours' < now() AND feedback IS NULL AND feedbackDueNotifiedAt IS NULL`.
- **`DigestEmailCron`** - `@Cron(CronExpression.EVERY_DAY_AT_8AM, { timeZone: 'Asia/Manila' })`. Batches all `digest_pending = true` rows per user, enqueues one digest email per user, flips `digest_pending = false`.
- **`NotificationsRetentionCron`** - daily at 03:00 Asia/Manila. `DELETE FROM notifications WHERE created_at < now() - interval '90 days'`.

## API surface

All routes live under the existing global guard chain (`SupabaseAuthGuard` then `RolesGuard`). All Zod DTOs come from `packages/shared/src/schemas/notifications.ts` and are re-used by `react-hook-form` resolvers in the frontend.

### `notifications.controller.ts`

| Method   | Path                          | Body / Query                                | Returns                                          |
| -------- | ----------------------------- | ------------------------------------------- | ------------------------------------------------ |
| `GET`    | `/notifications`              | `?tab=unread\|all&limit=20&cursor=<base64>` | `{ items: Notification[], nextCursor?: string }` |
| `GET`    | `/notifications/unread-count` | -                                           | `{ count: number, displayCount: string }`        |
| `POST`   | `/notifications/:id/read`     | -                                           | `{ unreadCount: number, displayCount: string }`  |
| `POST`   | `/notifications/read-all`     | -                                           | `{ unreadCount: 0, displayCount: "0" }`          |
| `DELETE` | `/notifications/:id`          | -                                           | `{ unreadCount: number, displayCount: string }`  |

- All queries scope `WHERE userId = req.user.id AND dismissedAt IS NULL`; RLS provides defense-in-depth.
- Pagination is cursor-based on `(createdAt DESC, id)` - works with the `(userId, createdAt DESC)` index. Cursor is `base64(<createdAt>|<id>)`.
- `displayCount` is server-rendered as `"99+"` when count > 99 - keeps the cap rule invariant across clients.
- `mark-read` and `read-all` return the new count so TanStack Query can `setQueryData` immediately.

### `notification-preferences.controller.ts`

| Method | Path                                         | Body                                                                             | Returns                                                             |
| ------ | -------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `GET`  | `/notification-preferences`                  | -                                                                                | `Array<{ eventType, mode, isDefault, isSecurityLocked, category }>` |
| `PUT`  | `/notification-preferences`                  | `{ eventType, mode }`                                                            | `{ eventType, mode, isDefault: false }`                             |
| `POST` | `/notification-preferences/restore-defaults` | `{ category?: 'applications'\|'interviews'\|'offers'\|'bias'\|'system'\|'all' }` | `{ deleted: number }`                                               |

- `GET` returns the **effective** view: every event type the user can toggle (filtered by role) plus security-locked rows. Security rows return `isSecurityLocked: true, mode: 'instant'`.
- `PUT` rejects `eventType ∈ SECURITY_EVENTS` with HTTP 400.
- `restore-defaults` with `category: 'all'` deletes every preference row for the user; per-category deletes only that category's rows.

### Audit hookups

- `POST /notifications/read-all` → `audit_logs` action `NOTIFICATIONS_MARKED_ALL_READ`
- `PUT /notification-preferences` → action `NOTIFICATION_PREFERENCE_UPDATED`, details `{ eventType, oldMode, newMode }`
- `POST /notification-preferences/restore-defaults` → action `NOTIFICATION_PREFERENCES_RESET`, details `{ category }`

Per-row `mark-read` and per-row `dismiss` do **not** audit-log (high volume, low consequence).

### Generation

After Nest controllers compile, `pnpm --filter api openapi:export` regenerates `openapi.json`, then `pnpm --filter shared orval` regenerates `packages/shared/src/api-client/generated.ts`. New TanStack Query hooks land:

```
useGetNotifications, useGetNotificationsUnreadCount,
usePostNotificationsIdRead, usePostNotificationsReadAll,
useDeleteNotificationsId,
useGetNotificationPreferences, usePutNotificationPreferences,
usePostNotificationPreferencesRestoreDefaults
```

> Hook names follow Orval's path-derived convention. The exact final names are produced by `orval` from `openapi.json` and may differ slightly from this listing - the implementation plan reconciles names against the regenerated client.

## Frontend

### Sidebar bell + badge

`Notifications` joins the **MAIN** section of `portal-sidebar.tsx` for all three roles, between `Dashboard` and the role's first pipeline link, using the Lucide `Bell` icon. The existing `NavItem` type gets an optional `badgeQuery: 'unreadCount'` field; when set, the rendered nav row appends `<NavItemBadge />`.

```tsx
function NavItemBadge() {
  const { data } = useGetNotificationsUnreadCount({
    query: { refetchInterval: 30_000, refetchIntervalInBackground: false },
  });
  if (!data?.count) return null;
  return (
    <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-on-primary">
      {data.displayCount}
    </span>
  );
}
```

Badge geometry uses `{rounded.pill}`, AuraHire Blue background, white text - the indicator reads as a brand-consistent count, not an error/danger signal. When count is 0, the component returns `null` and the row visually matches every other nav item.

### `/[role]/notifications/page.tsx`

Three thin route files, each importing one shared client component `<NotificationsPage role={role} />` from `apps/web/components/notifications/`. The component handles:

- **Header:** title in `{typography.display-md}`, "Mark all as read" button (right-aligned, conditional on unread > 0). Caption below header shows total unread in JetBrains Mono.
- **Tabs:** Unread (default) / All. Admin gets a third **System** tab filtering `scope === 'system'`.
- **List:** rows separated by `{colors.hairline}` 1px dividers, container at `{rounded.lg}` (16px) per the portal-card pattern.
- **Empty state:** illustrated, copy varies per tab ("All caught up" for unread, "No notifications yet" for All).
- **Pagination:** infinite scroll via intersection observer triggering the cursor-paginated next fetch; "Load more" button below for keyboard-only users.

### `<NotificationRow>` anatomy

- **Left:** 40px `{rounded.full}` icon plate (`{colors.surface-strong}` bg) holding the event-type Lucide icon
- **Center:** `{typography.title-sm}` title, `{typography.body-sm}` body, `{typography.caption}` muted relative timestamp ("2h ago")
- **Right:** match-band chip if `metadata.matchBand` exists, score value in JetBrains Mono if `metadata.scoreValue` exists, hover-revealed `X` dismiss button
- **Unread indicator:** 6px solid AuraHire Blue dot at the leftmost edge; absent when `readAt` is set
- **Whole row is a button:** click fires `usePostNotificationsRead` mutation AND `router.push(link)` in parallel - navigation does not block on the mutation

### Mutation patterns

All mutations are optimistic with `onMutate`/`onError` rollback:

- **mark-read:** optimistically sets `readAt` on the row, decrements badge cache via `queryClient.setQueryData(['unreadCount'], ...)`, reconciles when server response arrives
- **mark-all-read:** optimistically zeros every visible row's `readAt` and the badge, invalidates the list query
- **dismiss:** optimistically removes the row, invalidates on success

### Settings form rewrite

`apps/web/components/settings/notifications-form.tsx` is rewritten in place:

1. Fetches preferences via `useGetNotificationPreferences` - server returns the effective view including security-locked rows and category labels.
2. Groups rows by `category` field returned from the server.
3. Each row renders a 3-way segmented control (Instant / Digest / Off). Security-locked rows render disabled with the `Required for security` caption. Always-instant rows for hardcoded events also render disabled.
4. **Saves on change** via `usePutNotificationPreferences` with optimistic update; 300ms debounce per row to avoid thrash.
5. **"Restore defaults"** button per category calls `usePostNotificationPreferencesRestoreDefaults` then invalidates the prefs query.
6. The same component serves all three roles. Filtering by role happens server-side; the form just renders what the API returns.
7. The legacy banner ("Notification preferences will sync to the email service in a future release...") is deleted.

## Email mechanism

### One queue, two paths

Both instant and digest emails route through one new BullMQ queue: `NOTIFICATION_EMAIL_QUEUE = "notification-email"`. The processor inspects `job.data.kind` and renders accordingly. Retry policy: 3 attempts with exponential backoff (1s, 5s, 25s).

### Templates structure

```
apps/api/src/modules/notifications/templates/
├── index.ts                                - buildTitle/buildBody/buildLink registry
├── base-layout.tsx                         - shared header (AuraHire wordmark) + footer
├── application-status-changed-email.tsx
├── interview-scheduled-email.tsx
├── interview-reminder-email.tsx
├── interview-cancelled-email.tsx
├── offer-received-email.tsx
├── offer-expiring-email.tsx
├── new-application-received-email.tsx
├── candidate-withdrew-email.tsx
├── interview-feedback-due-email.tsx
├── offer-accepted-email.tsx
├── offer-declined-email.tsx
├── bias-flag-raised-email.tsx
├── team-invite-accepted-email.tsx
├── team-invite-declined-email.tsx
├── system-bias-flag-email.tsx
├── system-ai-failure-email.tsx
├── system-moderation-queue-email.tsx
├── account-password-reset-email.tsx
├── account-email-verified-email.tsx
├── account-login-new-device-email.tsx
└── digest-email.tsx                        - multi-event composite
```

All extend `base-layout.tsx`, establishing brand styling (Inter body, AuraHire Blue CTA pills, surface palette, footer with link to `/[role]/settings/notifications` for unsubscribe). The digest template renders sections per category, with each notification as a compact row.

### Idempotency

- **Instant:** processor early-returns if `email_sent_at IS NOT NULL`. Prevents BullMQ retries from double-sending after a partial failure.
- **Digest:** `digest_pending = false` update happens inside the same transaction as the enqueue; cron rerun won't re-batch the same rows. If the queue job permanently fails after retries, the rows are already flipped - in-app notification is the source of truth.

## Error handling and edge cases

### Posture

`emit()` follows the project-wide rule from `audit.service.log()`: **never throw**. A failed notification can never break the originating user action. Failures log with full context and return.

```ts
async emit(params) {
  try {
    await this.insertRow(params);
    await this.routeDelivery(params);
  } catch (err) {
    this.logger.error('notifications.emit failed', { err, params });
  }
}
```

The same posture applies in the email processor: a Resend timeout retries 3× then fails the job; the in-app row remains.

### Specific edge cases

- **Self-targeting** - `emit()` early-returns when `userId === actorId`. Future internal-hire flows shouldn't notify the recruiter about their own application.
- **Rapid status flapping** - two rapid status changes stack in the in-app stream (acceptable at MVP). Phase 2 could collapse via 60s debounce per `(userId, applicationId)`.
- **Deleted entities** - processor checks the entity exists before rendering; if missing, marks `email_sent_at = now()` with `metadata.delivery_skipped_reason = 'entity_missing'` so the job stops retrying.
- **Suspended users** - `emit()` checks `users.status` before insert; never creates rows for `suspended` or `deleted` users.
- **Cron deduplication** - every cron-driven event uses a flag column on its source table (`reminderSentAt`, `feedbackDueNotifiedAt`, `expiryReminderSentAt`) updated in the same transaction as `emit()`.
- **Daylight-saving** - `@nestjs/schedule` `timeZone` option handles transitions correctly. Asia/Manila doesn't observe DST, so this is moot today; documented for future locales.
- **Email bounces** - out of MVP. A Resend webhook handler is phase-2 work.

### Observability

- **`audit_logs`** - every cron run, every digest batch, every preference change writes an audit row.
- **Pino logger** - every `emit()` logs at debug level with eventType, userId, resulting mode, deliveryPath; errors at error level with stack.
- **BullMQ dashboard** - existing queue-monitoring path covers `notification-email` automatically.
- **Prometheus counters** - phase 2.

### Acceptance behaviors

- Status change on an application → row appears in candidate's Unread tab within 30s; bell badge increments.
- Click row → row marks read, badge decrements, navigation lands on application detail.
- Recruiter sets `new_application_received` to Off → applying creates no row and no email.
- Recruiter sets it to Digest → applying creates an in-app row immediately, no email immediately, single digest email at next 08:00.
- Setting `account_password_reset` to anything → 400.
- Suspended user → no notifications received.
- Hard-deleting a notification row → bell re-syncs on next 30s poll.

## Testing strategy

### Backend unit tests (Jest)

`apps/api/src/modules/notifications/__tests__/`

- `notifications.service.spec.ts` - `emit()` route correctness for instant/digest/off, security-event override, suspended-user skip, self-targeting skip, swallowed failures.
- `event-defaults.spec.ts` - `getEffectiveMode()` falls back to `DEFAULT_MODES`, returns `'instant'` for `SECURITY_EVENTS` regardless of stored preference.
- `templates.spec.ts` - each event-type's `buildTitle/buildBody/buildLink` produces expected strings for representative metadata fixtures.
- `notifications.controller.spec.ts` - cursor pagination ordering and next-cursor; `unread-count` cap rule; user-scoping enforcement; dismissed rows excluded.
- `notification-preferences.controller.spec.ts` - security-event PUT returns 400; restore-defaults with `category='all'` deletes all rows.

### Backend cron tests

`apps/api/src/cron/__tests__/` - each new cron asserts: side effects on seeded DB state, idempotency on second run, audit-log entries written.

### Backend integration

`apps/api/test/notifications.e2e-spec.ts` - full HTTP path against a real Postgres test database:

- Status change as recruiter → candidate's `GET /notifications` shows the row + bell count = 1
- Mark read → bell count = 0
- Set preference Off → repeat status change → no row appears

### Frontend tests (matching project's existing setup - Vitest + Testing Library expected, confirmed during plan execution)

`apps/web/components/notifications/__tests__/`

- `notification-bell.spec.tsx` - badge hides at count=0, shows `99+` when > 99, polls every 30s while focused (mock timers), pauses when blurred.
- `notification-row.spec.tsx` - click triggers mark-read mutation and navigation; unread dot hides after `readAt`; X button only on hover.
- `notifications-page.spec.tsx` - Unread is default tab; "Mark all as read" only renders when unread > 0; tab switch refetches with correct query param.
- `notifications-form.spec.tsx` - security rows disabled with caption; row change triggers debounced PUT after 300ms; "Restore defaults" calls correct endpoint.

### E2E (gated on Playwright presence)

`apps/web/tests/notifications.spec.ts` - sign in as candidate, see empty state, recruiter changes status, candidate sees notification within poll window, click navigates, badge clears, settings toggle Off, repeat status change, no new notification.

## Migration

The existing `notifications-form.tsx` writes legacy boolean toggles to `localStorage` under keys like `notif-prefs:recruiter`. Rollout:

1. Ship the new system with empty `notification_preferences` table - every user gets default modes server-side.
2. The rewritten form, on first mount, reads any `notif-prefs:*` keys from `localStorage`, maps the legacy booleans to the new 3-mode space (`true → instant`, `false → off`), POSTs the resulting preferences, then deletes the legacy keys.
3. The legacy banner is removed as part of the form rewrite.

Migration runs once per browser per user. Absence of legacy keys means defaults apply, which is the safe behavior.

## Phase 2 (named, not scoped)

1. Supabase Realtime subscription for the bell - single-component upgrade in `<NavItemBadge>`.
2. Team-wide fanout for `new_application_received` and `bias_flag_raised`.
3. Per-user digest cadence (daily/weekly/off) and per-user delivery time.
4. Per-tenant timezone for digest delivery.
5. Resend bounce/complaint webhook handling + suppression list.
6. `/metrics` counters for notification volume.
7. Phase-2 event types: AI rescore complete, scoring weights changed, platform announcements.
8. AI-summarized digest body (OpenAI structured output).
9. 60s status-flap debounce per `(userId, applicationId)`.

## Files touched (summary)

**New (~30):**

- `packages/db/src/schema.ts` (additions)
- `packages/db/src/enums.ts` (additions)
- `apps/api/src/modules/notifications/*` (full module + templates + processor + queues + dto + event-defaults)
- `apps/api/src/modules/notification-preferences/*` (full module + dto)
- `apps/api/src/cron/digest-email.cron.ts`
- `apps/api/src/cron/notifications-retention.cron.ts`
- `apps/api/src/cron/interview-reminder.cron.ts`
- `apps/api/src/cron/offer-expiry-reminder.cron.ts`
- `apps/api/src/cron/interview-feedback-due.cron.ts`
- `apps/web/components/notifications/*` (page + list + row + empty-state + icon-map)
- `apps/web/components/layout/nav-item-badge.tsx`
- `apps/web/app/(candidate)/candidate/notifications/page.tsx`
- `apps/web/app/(recruiter)/recruiter/notifications/page.tsx`
- `apps/web/app/(admin)/admin/notifications/page.tsx`
- `packages/shared/src/schemas/notifications.ts`
- `supabase/migrations/<timestamp>_notifications_rls.sql`

**Edited (~12):**

- `packages/db/src/schema.ts` (column additions to `interviewsTable`, `offersTable`)
- `apps/api/src/app.module.ts` (register modules)
- `apps/api/src/modules/applications/applications.service.ts`
- `apps/api/src/modules/interviews/interviews.service.ts`
- `apps/api/src/modules/offers/offers.service.ts`
- `apps/api/src/modules/bias/bias.service.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/invitations/invitations.service.ts`
- The existing match-preview-precompute worker (`MatchPreviewQueueService`) - catch-block emit (exact path resolved during plan execution)
- `apps/web/components/layout/portal-sidebar.tsx` (nav additions, all three roles)
- `apps/web/components/settings/notifications-form.tsx` (full rewrite)
- `packages/shared/src/index.ts` (re-export new schemas)

**Regenerated:**

- `apps/api/openapi.json`
- `packages/shared/src/api-client/generated.ts`
