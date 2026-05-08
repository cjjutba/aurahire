# Proactive System: Auto-Score + Live Notifications + Sidebar Rail

**Date:** 2026-05-08
**Owner:** Candidate scoring + notifications + sidebar shell across all three portals (candidate, recruiter, admin)
**Status:** approved (extended scope — folds in audit findings F1–F13 and the Vercel-style sidebar bottom rail)
**Supersedes:** prior narrower scope titled *"Onboarding Auto-Score + Buttonless Match Compute"* in this same file. All of that content is preserved; new sections extend it.

---

## Problem

The candidate journey, the recruiter journey, and all three portals' shells share a single root pattern of friction: *the system has all the data to react to a lifecycle event automatically, but the UI sits there until a user clicks something or refreshes the page.*

This shows up as four concrete classes of friction:

1. **Manual scoring buttons** the candidate sees even when the system has already (or could already) compute the result. *"Compute my score"* on the dashboard, *"See my match"* on the job detail page. Both render a button that hides a result that's either cached or one OpenAI call away.

2. **Missing automatic recomputes when source data changes.** Profile edits don't refresh the Profile Score. Default-resume changes leave previews stale until a manual click. The system knows the inputs changed but doesn't act on it.

3. **An incomplete notification system.** Application status transitions, new applications, offer accept/decline, interview reschedules — most lifecycle events that should produce a notification produce nothing. The bell icon doesn't auto-update. Several recent commits (`5a4c481`, `df48d0b`) explicitly punted email sends as TODOs. There are no scheduled jobs for interview reminders, offer expirations, job deadlines, feedback-due reminders, or notification digest emission.

4. **No surface in the portal shell where notifications live.** All three portal sidebars end with the user info and a logout/settings affordance — no entry point for notifications, no unread badge that reflects reality, no popover to review activity.

The pattern across all four classes: AuraHire feels like *AI with manual switches* instead of *AI that's already on*. This contradicts the thesis story ("transparent, explainable AI that works for the candidate") and degrades the experience for recruiters (who need real-time visibility) and admins (who need governance signals).

## Goal

Make the entire system *proactive*. Every lifecycle event that can produce a downstream computation, a notification, or a UI update — does, automatically, with realtime delivery to whoever should know. Manual buttons survive only at three deliberate gates: deliberate user commitments (apply, accept, withdraw), fairness-critical justifications (bias-flag override), and recompute affordances on inputs the user controls (re-parse a resume).

Concretely:

- **Candidate scoring is buttonless.** Profile Score auto-computes at the end of onboarding. Match scores auto-compute on view. Resume changes and preferences edits trigger transparent re-computation with shimmer + banner copy.
- **Notifications fire on every consequential lifecycle event** across application, interview, offer, account, and system surfaces. The bell badge updates in realtime. Notification email + in-app delivery is wired and tested.
- **Scheduled jobs cover the time-based reactions** the system can't infer from user actions: interview reminders, offer expirations, job deadlines, feedback-due reminders, digest emails.
- **Every portal sidebar has a bottom rail** modeled on the Vercel dashboard pattern: avatar + name (clicks open a profile dropdown), a `⋯` button (alternate trigger for the same dropdown), and a bell icon (clicks open a notifications popover with Inbox + Archive tabs). Wired to the live notification feed, with realtime unread-count updates and per-role notification feeds.

The end-state: a candidate, recruiter, or admin opening AuraHire feels the system has been thinking about them since the last visit. Nothing is dormant. Nothing waits to be asked.

---

## Scope

**In scope.** Eight coherent areas, all sharing the same pattern (event → handler → realtime + persistence + UI update):

### Area A — Candidate scoring (original slice)

Backend (`apps/api`)
- Extend `PATCH /candidate-profiles/me/complete-onboarding` to compute Profile Score inline, enqueue match-preview precompute, and return the score in the response.
- New `ScoringService.computeMatchPreviewOnView(candidateId, jobId)` wrapping the existing preview compute with a per-candidate per-day Redis rate limit. Writes with `source = candidate_view` (new enum value). The existing `POST /api/v1/scoring/match-preview/:jobId` controller delegates to this method; the prior `source = candidate` write path is removed since the manual *"See my match"* button is gone. Existing rows with `source = candidate` remain as historical data.
- Add `match_preview_source = 'candidate_view'` enum value.
- Add `profile_scores.stale_at TIMESTAMPTZ NULL` column + partial index for "current score per candidate."
- Default-resume change handler: cancel in-flight BullMQ jobs scoped to the old `resume_id`, mark `profile_scores` stale, enqueue Profile Score recompute + match-preview re-precompute.
- Preferences-edit handler: mark `profile_scores` stale, enqueue Profile Score recompute. No match-preview action — preferences don't affect per-job scoring.
- Server-side guard `enqueueProfileScoreIfMissing` invoked on candidate-portal entry to backfill legacy candidates who completed onboarding before this change.

Frontend (`apps/web`)
- New page `app/onboarding/candidate/analyzing/page.tsx` — the *"AI is analyzing your profile"* screen with a state machine that waits on the API response then on Socket.IO events.
- Preferences final step (`/onboarding/candidate/preferences`) redirects to `/onboarding/candidate/analyzing` instead of `/candidate`.
- Remove the *"Compute my score"* button from `profile-score-card-client.tsx`. Render the latest score directly. When `stale_at IS NOT NULL` and no recompute is in flight, show a small *"Recompute"* affordance. When a recompute is in flight, overlay `AiShimmer` on the existing score number until the `profile-score.updated` event arrives.
- Remove the *"See my match"* button from `_match-preview-client.tsx`. Auto-compute on mount when no cached preview. Render `AiShimmer` during compute. On `429 DAILY_AI_LIMIT`, show a banner instead of a button — *"Daily AI compute limit reached. Apply to score this match as part of your application."* with a link to the apply page. No manual compute trigger remains in the UI.
- Dashboard `RecommendedForYouSection`: render shimmer slots while `previews.length < 5`; subscribe to `match-preview.created` events to fill them in. Graceful empty state on precompute failure.

### Area B — Profile edit triggers Profile Score recompute (F1)

- `CandidateProfilesService.updatePersonal(candidateId, dto)` and any other "candidate identity" mutation (headline, summary, current title) — emit a `candidate.profile_changed` event.
- New `ProfileScoreRecomputeOnProfileChangeHandler` listens, marks `profile_scores.stale_at = NOW()`, enqueues `ProfileScoreRecomputeJob(currentDefaultResumeId)`. Same flow as preferences-edit.
- Frontend Profile Score card on dashboard subscribes to `profile-score.updated` (already in scope) and shows shimmer with caption *"Updating with your profile changes…"*.

### Area C — Default-resume UX improvements (F2, F3)

- Remove the *"Set as default resume?"* confirmation modal at `_resume-client.tsx:840-846`. Instead: optimistic update + post-success toast *"Set X as default. [Undo]"* with a 6-second undo affordance. Click Undo → revert via `PATCH /resumes/:id/set-default`.
- New backend behavior on `DELETE /resumes/:id` when `id` is the default: transactional auto-promote of the most-recently-uploaded remaining resume (`updated_at DESC`, fall back to `created_at DESC`) to default. Emit `resume.default_changed` event with the new default's `id`. UI toast on the candidate's next page load: *"X is now your default resume."*
- If the deletion would leave the candidate with zero resumes: block the delete with `409 LAST_RESUME_PROTECTED`. UI surfaces *"You can't delete your last resume — upload another first."*

### Area D — Notification system completeness (F4–F8)

Audit shows the notification system is wired (queue, processor, in-app feed table, email path, event-defaults) but most lifecycle events don't emit. Fix the emissions.

- **F4 — Application status change events.** `ApplicationsService` advances applications through `applied → screening → interview → offer → hired/rejected`. Each transition emits `application_status_changed` to the candidate (and to the hiring team filtered by `role_visible_events`). Currently zero of the transitions emit. Add the emissions inline in the existing `updateStatus` and equivalent paths.
- **F5 — Offer accept/decline.** `OffersService.accept()` and `OffersService.decline()` emit `offer_accepted` / `offer_declined` to the recruiter who created the offer (and to other members of the hiring team via the role-visible-events filter).
- **F6 — New application events.** `ApplicationsService.create()` emits `new_application_received` to the recruiter who owns the job (and the hiring team).
- **F7 — Bell badge realtime updates.** New realtime event `notification.created` broadcast to room `user:{userId}` whenever a `notifications` row is inserted. Frontend bell subscribes, increments unread count, and (per user preference) optionally shows a brief inline toast.
- **F8 — Interview reschedule + share-feedback emails.** Recent commits (`5a4c481` reschedule, `df48d0b` share-feedback) explicitly left email TODOs. Plumb the existing `notification-email.processor.ts` through both code paths so the in-app notification *and* the email both fire.

### Area E — Scheduled jobs (F9–F13)

Five new cron jobs wired through `@nestjs/schedule` and emitting events that the existing notification queue handles.

- **F9 — Interview reminder cron.** Schedule: `0 5 * * *` UTC (every day, 00:05 UTC). Query: interviews with `status = 'scheduled'` and `scheduled_at` ∈ `[now+23h, now+24h]`. Emit `interview_reminder_24h` to the candidate.
- **F10 — Offer expiration cron.** Schedule: `10 0 * * *` UTC. Two passes: (a) offers with `status = 'pending'` and `expires_at` ∈ `[now, now+24h]` → emit `offer_expiring_soon` to the candidate; (b) offers with `status = 'pending'` and `expires_at < now` → transactional update to `status = 'expired'` + emit `offer_expired` to candidate *and* recruiter.
- **F11 — Job deadline auto-archive cron.** Schedule: `15 0 * * *` UTC. Query: jobs with `status = 'published'` and `application_deadline < now`. Update to `status = 'archived'`. Emit `job_archived_by_deadline` to the recruiter who owns the job. Audit log entry per archive.
- **F12 — Interview feedback due reminder cron.** Schedule: `0 */6 * * *` (every 6 hours). Query: interviews with `status = 'completed'`, `feedback_id IS NULL`, `completed_at < now - 24h`, `feedback_reminder_sent_at IS NULL`. Emit `interview_feedback_due` to the recruiter who scheduled the interview. Set `feedback_reminder_sent_at = NOW()` to prevent duplicates. (A second reminder at 47 h from completion is folded in via the same cron — track `feedback_reminder_sent_at` as `last_sent` and check elapsed.)
- **F13 — Notification digest cron.** Schedule: `0 9 * * *` UTC. Query: notifications with `digest_pending = true` grouped by `user_id`. For each user, enqueue a `digest-email` job to the existing `NotificationEmailProcessor` (already implemented at `apps/api/src/modules/notifications/notification-email.processor.ts:69-98`). Reset `digest_pending = false` on emission.

All five crons are implemented as a single new `apps/api/src/modules/notifications/notifications.scheduler.ts` (or split into per-domain schedulers if cleaner — judgment call during implementation).

### Area F — Sidebar bottom rail with profile + notifications popovers

A new shared component, modeled directly on the Vercel dashboard pattern (the user's reference screenshots), is wired into all three portal sidebar shells: candidate, recruiter, admin.

#### F.1 Visual layout

The portal sidebar already exists at `apps/web/components/portal/sidebar.tsx` (or equivalent path — verify during implementation). The bottom rail replaces the current bottom-anchor user-info area with three side-by-side elements:

```
┌──────────────────────────────────────────────────┐
│  [avatar]  CJ Jutba              ( ⋯ )    ( 🔔 ) │
│                                              ●   │
│              ↑                    ↑        ↑ ↑   │
│              clickable            clickable  unread dot
│              opens profile popover           visible only
│                                              if unreadCount > 0
└──────────────────────────────────────────────────┘
```

- Avatar + name area is a single clickable region that opens the profile dropdown popover. Padding `{spacing.sm}`. Hover state: background `{colors.surface-strong}`.
- The `⋯` button is a 32×32 circle, background `{colors.surface-strong}`, opens the *same* profile dropdown popover (alternate affordance, matching Vercel).
- The bell button is a 32×32 circle, background `{colors.surface-strong}`. When `unreadCount > 0`, a 6×6 `{colors.primary}` (AuraHire Blue) circle overlays the top-right of the bell icon.
- Both buttons use Lucide React icons (`MoreHorizontal`, `Bell`).
- The bell button opens the notifications popover.

#### F.2 Profile dropdown popover

Anchored above the avatar/name region (Vercel anchors above; Radix UI Popover with `side="top"` + `align="start"`). Width 320 px. Border radius `{rounded.lg}` (16 px). Shadow: the soft-drop tier from `DESIGN.md`. Padding `{spacing.lg}` (24 px).

Content (top to bottom), adapted from Vercel's pattern to AuraHire's surfaces:

| Slot | Element | Behavior |
|---|---|---|
| Header | Avatar (40 px, `{rounded.full}`) + name `{typography.title-md}` + email `{typography.caption}` muted + small gear icon button right-aligned | Gear → `/settings` (role-appropriate route — `/candidate/settings`, `/recruiter/settings`, `/admin/settings`) |
| Action | *"Send feedback"* with smile icon | `mailto:cjjutbaofficial@gmail.com?subject=AuraHire feedback` (stub for thesis; can become a modal in a follow-up) |
| Theme picker | *"Theme"* label + three pill icons: System / Light / Dark | Persisted in user preferences via existing settings (or `localStorage` if no theme persistence yet — verify) |
| Action | *"How it works"* with book icon | `/how-it-works` — the explainability docs page (thesis-aligned) |
| Action | *"Help"* with help-circle icon | `/help` (existing page) |
| Action | *"Log out"* with log-out icon | Existing logout flow |
| Footer status pill | *"AI Status — All systems normal"* (or *"AI Status — Degraded"* on failure) with a `{colors.score-high}` / `{colors.score-mid}` dot | Polled from `GET /api/v1/health/ai` on popover open. Click → `/status` (out of scope — link is a no-op for this slice). |

Items deliberately *not* included from the Vercel pattern: *"Home Page"*, *"Changelog"*, *"Docs"*, *"Upgrade to Pro"* — none have a thesis-relevant analogue.

The component is a single file `apps/web/components/portal/sidebar-profile-popover.tsx`. It receives `user` (id, name, email, avatarUrl, role) as a prop. Role-conditional rendering is minimal (the `Settings` link target differs).

#### F.3 Notifications popover

Anchored above the bell button. Width 380 px. Same radius / shadow / typography tokens as the profile popover. Padding `{spacing.lg}` for the header, `0` for the list (rows manage their own padding).

Header bar:
- Tabs: *Inbox* (with unread count badge) / *Archive* — left-aligned, underline-on-active per `DESIGN.md` chip patterns
- Settings gear icon, right-aligned → `/settings/notifications` (existing page)

Body — list of notification rows, vertically scrollable to ~80 vh max:
- Avatar / icon (32×32, `{rounded.full}`) showing the event type icon (alert-triangle for warnings, check-circle for confirmations, calendar for interviews, briefcase for jobs, etc. — mapped from notification `kind`)
- Title + 1–2 line body, `{typography.body-sm}` for body
- Timestamp (`{typography.caption}` muted) — relative ("19h ago", "Apr 25")
- Unread blue dot (`{colors.primary}`) right-aligned, 8×8 `{rounded.full}`
- Click anywhere on the row: marks as read (optimistic), navigates to the notification's `link_url` (e.g., `/candidate/applications/:id`)
- Hover: `{colors.surface-soft}` background

Empty state per tab:
- Inbox empty: *"No new notifications. We'll let you know when something happens."*
- Archive empty: *"No archived notifications yet."*

Footer (Inbox tab only): *"Archive all"* button (`button-secondary-light`, full-width). Click → `POST /api/v1/notifications/archive-all` → optimistic clear of inbox list, refresh archive on next tab switch.

Component file: `apps/web/components/portal/sidebar-notifications-popover.tsx`.

#### F.4 Per-portal notification feeds

The notifications query is already user-scoped (`notifications.user_id = me`), so no new filtering is required at the API layer. What differs per portal is *which event kinds* a user typically receives, governed by `event-defaults.ts` + `notification_preferences`:

| Portal | Typical event kinds in the feed |
|---|---|
| Candidate | `application_status_changed`, `interview_scheduled`, `interview_rescheduled`, `interview_reminder_24h`, `offer_received`, `offer_expiring_soon`, `offer_expired`, `match_preview_ready` (optional, via realtime stream — see below), `profile_score_updated` (optional), `account_password_reset`, account-security events |
| Recruiter | `new_application_received`, `application_status_changed` (subset — only role-relevant), `offer_accepted`, `offer_declined`, `interview_rescheduled` (when candidate reschedules), `interview_feedback_due`, `job_archived_by_deadline`, `bias_flag_raised` (on their jobs), `system_ai_scoring_failure` (their org only) |
| Admin | `system_moderation_queue_item`, `system_ai_scoring_failure` (system-wide), security events, governance signals |

Whether `match_preview_ready` and `profile_score_updated` appear in the bell feed is a deliberate design choice. *Recommendation:* they appear in the realtime stream (used by the dashboard to fill shimmer slots) but **do not** create persistent notification rows — otherwise the bell becomes noisy on a high-volume precompute day. Stream-only events live for the duration of the WebSocket connection and don't accumulate in the bell.

#### F.5 Bell badge realtime updates

Existing infrastructure: Socket.IO server with rooms (verified by `apps/api/src/realtime/redis-adapter.provider.ts`). New room: `user:{userId}`. Events scoped to that room:

```ts
event: "notification.created"
payload: {
  id: string,
  userId: string,
  kind: NotificationKind,
  title: string,
  bodyExcerpt: string,
  linkUrl: string | null,
  createdAt: string,
  unreadCount: number,    // server-computed total unread for this user, post-insert
}

event: "notification.read"
payload: {
  id: string,
  unreadCount: number,
}

event: "notification.archived"
payload: {
  id: string,
  unreadCount: number,
}

event: "notification.archive_all"
payload: {
  unreadCount: 0,       // always 0 by definition after archive-all
}
```

The frontend `useUserNotifications()` hook (new, in `apps/web/lib/realtime/use-user-notifications.ts`) subscribes to `user:{userId}` on mount, exposes `{ inbox, archive, unreadCount, markRead, archive, archiveAll }`. The bell badge reads `unreadCount` directly. The popover Inbox/Archive tabs read from React Query caches that the hook keeps in sync via the events above.

#### F.6 Mark-as-read, archive, archive-all

API surface (extending the existing notifications module):
- `GET /api/v1/notifications?tab=inbox|archive&limit=50` — paginated list
- `PATCH /api/v1/notifications/:id/read` — mark single as read
- `PATCH /api/v1/notifications/:id/archive` — archive single
- `POST /api/v1/notifications/archive-all` — archive every unarchived notification for the user
- `GET /api/v1/notifications/unread-count` — used only on first load before realtime takes over

All four mutating endpoints emit the corresponding realtime event from the table above. All write to `audit_logs` with the user as actor (relevant for thesis auditability — every notification interaction is recorded).

The schema gets an `archived_at TIMESTAMPTZ NULL` column on `notifications` (or use the existing one if present — verify during implementation). Inbox = `archived_at IS NULL`. Archive = `archived_at IS NOT NULL`.

### Area G — Database migrations

Single migration adding all required columns, indexes, and enum extensions:

```sql
-- A1. Extend match preview source enum
ALTER TYPE match_preview_source ADD VALUE IF NOT EXISTS 'candidate_view' AFTER 'system';

-- A2. Profile score staleness signal
ALTER TABLE profile_scores
  ADD COLUMN stale_at TIMESTAMPTZ NULL;
CREATE INDEX idx_profile_scores_candidate_current
  ON profile_scores (candidate_id, computed_at DESC)
  WHERE stale_at IS NULL;

-- D/F. Notifications: ensure archived_at + indexes for tab queries
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_inbox
  ON notifications (user_id, created_at DESC)
  WHERE archived_at IS NULL AND read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_archive
  ON notifications (user_id, archived_at DESC)
  WHERE archived_at IS NOT NULL;

-- E.F12. Interview feedback reminder timestamp
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS feedback_reminder_sent_at TIMESTAMPTZ NULL;

-- E.F11. Job archived-by-deadline reason flag (for distinguishing manual vs auto archive in audit)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS archived_reason TEXT NULL;  -- nullable: 'manual' | 'deadline_passed' | etc.
```

`scoring_config` (existing JSON document) gets new keys:
```jsonc
{
  // ...existing keys...
  "onview_daily_cap": 100,
  "precompute_top_n": 25,
  "analyzing_screen_wallclock_ms": 10000,
  "interview_reminder_lead_hours": 24,
  "offer_expiry_warning_lead_hours": 24,
  "feedback_reminder_lead_hours": 24
}
```

Mirror in `packages/db/schema/`.

**Out of scope:**

- Recruiter-side ranking changes. The match-preview-to-match-score promotion path on apply is unchanged; recruiter ranking continues to read `match_scores.overallScore` keyed to the `(candidate, job, resumeId)` they applied with. Resume changes after apply do not retroactively rescore submitted applications.
- Search/list-page auto-compute (the most aggressive option from earlier brainstorming). Cards in search results render the match-band chip only when a cached preview exists; they never trigger compute.
- New scoring algorithm. The AI call, prompt, schema, and weights are unchanged.
- Bias detection / job-description-checking work beyond plumbing the existing `bias_flag_raised` event into the recruiter's bell feed.
- Job duplication / "use as template" affordance.
- Match score override capture (separate slice — needs verification that the override path exists).
- Recruiter-side bulk bias-flag override (intentional friction; deferred).
- Admin user suspension notification to the suspended user.
- AI scoring failure observability/escalation beyond the recruiter-facing notification.
- Candidate "Not interested" affordance on recommendations.
- Manual Profile Score recompute affordance when not stale.
- Send-feedback modal (the mailto stub stands for thesis scope; modal is a follow-up).
- "How it works" page content (the link target exists; the page content is its own slice).

---

## Architecture overview

A single repeating pattern across all areas:

```
   ┌────────────────────────────────────────────────────────────┐
   │  Lifecycle event in apps/api                               │
   │  (e.g. application status change, offer acceptance,        │
   │   resume parsed, job published, cron tick)                 │
   └───────────────────┬────────────────────────────────────────┘
                       │
                       ▼
   ┌────────────────────────────────────────────────────────────┐
   │  Domain service handler                                    │
   │  ┌─ writes domain row(s) (apps/api/src/modules/...)        │
   │  ├─ writes audit_logs entry                                │
   │  ├─ enqueues BullMQ jobs (scoring, recompute, email)       │
   │  └─ calls NotificationsService.emit(event, payload)        │
   └───────────────────┬────────────────────────────────────────┘
                       │
            ┌──────────┼──────────────┬──────────────────────┐
            ▼          ▼              ▼                      ▼
   ┌────────────┐ ┌─────────┐ ┌─────────────────┐ ┌──────────────────┐
   │ INSERT into│ │BullMQ   │ │  Socket.IO emit │ │ Email queue (per │
   │notifications│ │job runs│ │  to user:{id}   │ │  user prefs)     │
   │            │ │         │ │  room           │ │                  │
   └────────────┘ └─────────┘ └─────────────────┘ └──────────────────┘
                                       │
                                       ▼
                              ┌─────────────────────┐
                              │ Frontend hook       │
                              │ (useUserNotif…)     │
                              │ updates bell badge, │
                              │ inbox cache,        │
                              │ candidate dashboard │
                              │ shimmer slots, etc. │
                              └─────────────────────┘
```

Every new feature in this spec is one of: a new lifecycle event emission, a new cron tick, a new realtime room, or a new UI subscriber. None invent new architectural primitives.

---

## A. Candidate scoring

### A.1 The three computations

| Computation | Storage | Source values | Triggered by |
|---|---|---|---|
| Profile Score | `profile_scores` | (single concept) | End of onboarding (blocking, ~3–5 s); default-resume change; preferences edit; **profile-personal edit (F1)**; legacy backfill guard |
| Top-N match precompute | `match_score_previews` | `system` | Resume parse complete (existing trigger, kept); default-resume change |
| On-view match compute | `match_score_previews` | `candidate_view` (new) | First open of a non-recommended job's detail page; rate-limited |

### A.2 Trigger model — onboarding completion

```
User clicks "Complete setup" on /onboarding/candidate/preferences
        │
        │ router.push("/onboarding/candidate/analyzing")
        ▼
[/onboarding/candidate/analyzing] mounts
        │
        │ kicks off PATCH /candidate-profiles/me/complete-onboarding
        ▼
Backend transaction:
  • UPDATE candidate_profiles SET profile_completed = true   (always succeeds first)
  • Enqueue MatchPreviewPrecomputeJob (BullMQ, async)
  • Attempt: ScoringService.computeProfileScore(candidate, defaultResume, prefs)
        ◦ Synchronous OpenAI call (gpt-4o-mini)
        ◦ Writes profile_scores row with prompt_version, model_used, latency_ms, redacted_fields
        ◦ Writes audit_logs entry
        ◦ Emits "profile-score.updated" event with reason = "onboarding"
  • Respond 200:
      { profileCompleted: true,
        profileScore: <DTO> | null,
        precomputeJobId: <bullmq-id>,
        errors?: { profileScore?: "transient" | "missing_resume" } }
        │
        ▼
[/onboarding/candidate/analyzing] receives response
        │
        ├── profileScore != null → state: profileScoreReady
        │      │ open Socket.IO subscription to candidate:{id}
        │      ▼
        │   state: streamingPreviews
        │      │ count "match-preview.created" events received
        │      │ when count ≥ 5  OR  10 s wall-clock elapsed since profileScoreReady
        │      ▼
        │   router.push("/candidate")
        │
        └── profileScore == null → state: profileScoreDegraded
               │ wait 2 s (let user read "Still working on it…")
               ▼
               router.push("/candidate?profileScoreRetry=1")
                  └ dashboard renders Profile Score card with shimmer + retry banner
```

Wall-clock cap on streaming: 10 s after `profileScoreReady`. Worst-case ceiling for the analyzing screen: ~5 s (Profile Score) + 10 s (preview wait) + 2 s (degraded path) ≈ **17 s**, with the typical happy path at ~10–12 s.

### A.3 Steady-state surfaces

**Job detail page mount** (`apps/web/app/(candidate)/candidate/jobs/[id]/page.tsx`):
1. SSR: fetch job + `GET /scoring/match-preview/:jobId` (cache read; returns null if no row exists for `(candidate, job, defaultResumeId)`).
2. If preview exists in response → render Score Ring inline; done.
3. If no preview → client-side `useEffect` on mount fires `POST /scoring/match-preview/:jobId`.
   - UI: `AiShimmer` with caption *"Computing your match for this role…"*
   - On success → render Score Ring.
   - On `429 DAILY_AI_LIMIT` → render banner *"Daily AI compute limit reached. Apply to score this match as part of your application."* with a CTA link to `/candidate/jobs/[id]/apply`. No manual compute button.
   - On `500` → inline error: *"Couldn't compute your match. [Try again]"*. Retry on AI failure is allowed; the cap doesn't apply because the previous attempt didn't produce a row.
   - On `422 MISSING_RESUME` → *"Upload a resume to see your match"* + link to `/candidate/profile/resumes`.

**Default-resume change** (`PATCH /resumes/:id/set-default`):
1. Backend transaction:
   - Update default flag on resumes.
   - Look up in-flight BullMQ jobs by `data.resumeId = OLD_RESUME_ID`; remove them.
   - `UPDATE profile_scores SET stale_at = NOW() WHERE candidate_id = ? AND stale_at IS NULL`.
   - Enqueue `ProfileScoreRecomputeJob(newResumeId)` and `MatchPreviewPrecomputeJob(newResumeId)`.
2. Frontend dashboard:
   - Optimistic banner: *"Refreshing your scores with your new resume…"*
   - Profile Score card: shimmer over the existing number until `profile-score.updated` event arrives.
   - Recommendations section: existing previews stay visible (still useful as a fallback view) until new `system`-source previews arrive. Old previews are not deleted, just no longer queried.

**Preferences edit** and **profile-personal edit (F1)** (`PATCH /candidate-profiles/preferences`, `PATCH /candidate-profiles/personal`):
1. Backend: update row, mark `profile_scores.stale_at = NOW()`, enqueue `ProfileScoreRecomputeJob(currentDefaultResumeId)`. No match-preview action.
2. Frontend: shimmer over Profile Score card with caption *"Updating with your latest profile…"*. On `profile-score.updated` event → render new score.

### A.4 State machine — `/onboarding/candidate/analyzing`

| State | Visible copy / UI | Transition out |
|---|---|---|
| `mounting` | brief skeleton | on mount → `computingProfileScore` |
| `computingProfileScore` | `AiShimmer` + *"Computing your Profile Score…"* | API response: profileScore present → `profileScoreReady`; profileScore null → `profileScoreDegraded`; network error → `error` |
| `error` | inline error + *"Try again"* button | click retry → `computingProfileScore` |
| `profileScoreDegraded` | *"We're still working on your score — taking you to your dashboard now."* | 2 s elapsed → `redirecting` (with `?profileScoreRetry=1` query) |
| `profileScoreReady` | Score Ring renders + *"✓ Profile Score ready. Finding your top matches…"* | open Socket.IO subscription → `streamingPreviews` |
| `streamingPreviews` | counter: *"N of 5 matches ready"*; visualized as filling-pip indicator | counter ≥ 5 OR 10 s elapsed → `redirecting` |
| `redirecting` | brief fade | `router.push('/candidate')` |

Implemented as a `useReducer` in the client component. Single file, ~200 lines.

### A.5 API contract — `PATCH /candidate-profiles/me/complete-onboarding`

```ts
// Request: empty body (unchanged)

// Response 200:
{
  profileCompleted: true,
  profileScore: {
    overallScore: number,            // 0..100
    band: "strong" | "partial" | "limited",
    components: ScoreComponentDto[], // existing shape from ScoringService
    promptVersion: string,
    computedAt: string,              // ISO
  } | null,                          // null on AI failure
  precomputeJobId: string,
  errors?: {
    profileScore?: "transient" | "missing_resume",
    // "transient": OpenAI/network error. retry job enqueued.
    // "missing_resume": no parsed default resume found. should be impossible
    //   under normal flow (onboarding gates this) but defended for safety.
  }
}

// Response 5xx: only on database errors. AI failure does NOT return 5xx.
```

The endpoint flips `profile_completed = true` first, then attempts the BullMQ enqueue, then attempts the inline Profile Score compute. Profile Score compute is attempted inline but does not gate the success of the endpoint — an OpenAI outage cannot trap a candidate in onboarding limbo. BullMQ enqueue is not transactional with Postgres; if the enqueue fails, the server-side `enqueueProfileScoreIfMissing` / precompute-missing guard re-enqueues on the next candidate-portal visit.

### A.6 Realtime event contract — scoring events

```ts
// emitted by ScoringService whenever a match_score_previews row is inserted
event: "match-preview.created"
payload: {
  candidateId: string,
  jobId: string,
  resumeId: string,
  source: "system" | "candidate_view",
  overallScore: number,
  band: "strong" | "partial" | "limited",
  createdAt: string,
}

// emitted by ScoringService on Profile Score compute (success or recompute)
event: "profile-score.updated"
payload: {
  candidateId: string,
  resumeId: string,
  overallScore: number,
  band: "strong" | "partial" | "limited",
  reason: "onboarding" | "resume_change" | "preferences_change" | "profile_change" | "manual_recompute",
  updatedAt: string,
}
```

Both scoped to room `candidate:{candidateId}`. Both validated against Zod schemas in `packages/shared/realtime/candidate-events.ts`.

---

## B. Profile edit triggers Profile Score recompute (F1)

`CandidateProfilesService.updatePersonal()` (and any other "candidate identity" mutation — headline, summary, current title) follows the same pattern as preferences-edit:

1. Update the row.
2. `UPDATE profile_scores SET stale_at = NOW() WHERE candidate_id = ? AND stale_at IS NULL`.
3. Enqueue `ProfileScoreRecomputeJob(currentDefaultResumeId)` with `reason = 'profile_change'`.

The recompute job, when it lands, emits `profile-score.updated` with the new score, which the dashboard hook picks up and renders.

No new API surface; all changes are within the existing `updatePersonal` handler.

---

## C. Default-resume UX improvements (F2, F3)

### C.1 F2 — Switch default — instant + undo toast

Frontend (`_resume-client.tsx`):
- Remove the confirmation modal at lines 840–846.
- Click *"Set as default"* → immediate `PATCH /resumes/:id/set-default` (optimistic UI update).
- On success, render an undo toast at the bottom: *"Set X as default. [Undo]"* — 6-second auto-dismiss.
- Undo click → `PATCH /resumes/:previousDefaultId/set-default` (reverts).

The recompute chain triggered by the original switch *also* runs for the undo (predictably — it's the same code path). Net effect of an undone switch: two recompute cycles, but the user ends up with the score for the resume they originally had. Cost is acceptable given the rarity of undos.

### C.2 F3 — Delete default — auto-promote next resume

Backend (`ResumesService.delete()`):
1. Determine if the resume being deleted is the candidate's current default.
2. If yes, find the most-recently-uploaded remaining resume (`updated_at DESC` then `created_at DESC`).
3. If a remaining resume exists, transactionally:
   - Delete the target resume.
   - Set the chosen replacement as default.
   - Enqueue Profile Score recompute and match-preview precompute on the new default (same chain as switch).
   - Emit `resume.default_changed` event with the new default's ID.
4. If no remaining resume, return `409 LAST_RESUME_PROTECTED` — refuse the delete.

Frontend:
- On `409 LAST_RESUME_PROTECTED`, show inline error: *"You can't delete your last resume — upload another first."*
- On success of a delete-of-default, show toast: *"Deleted X. Y is now your default resume."*
- Background: dashboard updates as recompute lands (existing flow).

---

## D. Notification system completeness (F4–F8)

### D.1 F4 — Application status change events

`ApplicationsService` already advances state in `updateStatus()` (and equivalent paths). Add an `await this.notifications.emit('application_status_changed', { ... })` call inside each path. The event payload:

```ts
{
  applicationId: string,
  candidateId: string,
  recruiterUserIds: string[],   // members of the hiring team for this job
  jobId: string,
  fromStatus: ApplicationStatus,
  toStatus: ApplicationStatus,
  occurredAt: string,
}
```

`NotificationsService.emit()` already routes to per-user notification rows based on `event-defaults.ts` and `notification_preferences`. Recipient list comes from the payload's `candidateId` + `recruiterUserIds` (the service filters by `role_visible_events`).

### D.2 F5 — Offer accept/decline events

Inside `OffersService.accept()` and `OffersService.decline()`:
```ts
await this.notifications.emit(
  status === 'accepted' ? 'offer_accepted' : 'offer_declined',
  { offerId, applicationId, candidateId, recruiterUserIds, occurredAt }
);
```

### D.3 F6 — New application events

Inside `ApplicationsService.create()`:
```ts
await this.notifications.emit('new_application_received', {
  applicationId, jobId, candidateId, recruiterUserIds, occurredAt
});
```

### D.4 F8 — Plumb interview reschedule + share-feedback emails

Recent commits explicitly punted email sends. Inside the existing `InterviewsService.reschedule()` and `InterviewsService.shareFeedback()`:
- After the in-app notification emit (already wired), enqueue an email job via `notification-email.processor.ts`. The processor is implemented; it just needs to be invoked.
- Email templates: reuse the existing interview email templates (or add new ones if reschedule doesn't have one — verify `apps/api/src/email/templates/`).

### D.5 F7 — Realtime notification events

The existing realtime infrastructure (Socket.IO, Redis adapter) gains a new room: `user:{userId}`. Inside `NotificationsService.emit()`, after the row insert, broadcast `notification.created` to that room (see Area F.5 for the payload shape).

The mark-read, archive, and archive-all endpoints (Area F.6) emit their respective realtime events.

---

## E. Scheduled jobs (F9–F13)

All five crons live in a new module `apps/api/src/modules/notifications/notifications.scheduler.ts` (or split per-domain if cleaner during implementation). Each is a `@Cron` decorated method using `CronExpression` constants.

| Cron | Schedule (UTC) | Query | Action |
|---|---|---|---|
| F9 — interview reminder | `0 5 * * *` (00:05) | `interviews WHERE status='scheduled' AND scheduled_at BETWEEN NOW()+'23h' AND NOW()+'24h'` | Emit `interview_reminder_24h` to candidate |
| F10a — offer expiring soon | `10 0 * * *` (00:10) | `offers WHERE status='pending' AND expires_at BETWEEN NOW() AND NOW()+'24h'` | Emit `offer_expiring_soon` to candidate |
| F10b — offer expired | `10 0 * * *` (same job, second pass) | `offers WHERE status='pending' AND expires_at < NOW()` | UPDATE to `status='expired'`, emit `offer_expired` to candidate + recruiter |
| F11 — job deadline auto-archive | `15 0 * * *` (00:15) | `jobs WHERE status='published' AND application_deadline < NOW()` | UPDATE to `status='archived'`, set `archived_reason='deadline_passed'`, emit `job_archived_by_deadline` to recruiter |
| F12 — interview feedback due | `0 */6 * * *` (every 6h) | `interviews WHERE status='completed' AND feedback_id IS NULL AND completed_at < NOW()-'24h' AND (feedback_reminder_sent_at IS NULL OR feedback_reminder_sent_at < NOW()-'24h')` | Emit `interview_feedback_due` to recruiter, set `feedback_reminder_sent_at = NOW()` |
| F13 — notification digest | `0 9 * * *` (09:00) | `notifications WHERE digest_pending = true GROUP BY user_id` | For each user, enqueue digest-email job to existing processor; reset `digest_pending = false` |

All crons:
- Run inside a try/catch with audit-log entry on failure (so a failure once doesn't kill the cron silently).
- Use `LIMIT 500` per pass to avoid memory blowup on large datasets — re-run on next tick if more remain.
- Skip work if the relevant table is empty (cheap query; no side effects).
- Are testable: each cron method exposes a `runOnce()` for unit tests that bypasses the schedule.

---

## F. Sidebar bottom rail with profile + notifications popovers

(Full detail in Area F of the Scope section above; here we restate the API surface and per-portal touchpoints needed for implementation.)

### F.7 New shared components

- `apps/web/components/portal/sidebar-bottom-rail.tsx` — the avatar + name + `⋯` + bell layout. Used by all three portal sidebars.
- `apps/web/components/portal/sidebar-profile-popover.tsx` — Vercel-style profile dropdown (Radix Popover).
- `apps/web/components/portal/sidebar-notifications-popover.tsx` — Inbox/Archive notifications popover (Radix Popover, with Radix Tabs inside).
- `apps/web/lib/realtime/use-user-notifications.ts` — the React hook that subscribes to `user:{userId}` and exposes `{ inbox, archive, unreadCount, markRead, archive, archiveAll }`.

### F.8 Sidebar wiring per portal

Each existing portal sidebar adds the new bottom rail in place of its current bottom anchor:
- `apps/web/components/portal/candidate-sidebar.tsx` (verify exact path)
- `apps/web/components/portal/recruiter-sidebar.tsx`
- `apps/web/components/portal/admin-sidebar.tsx`

If a shared sidebar layout already exists, the change is a single edit to the bottom slot.

### F.9 New API surface

- `GET /api/v1/notifications?tab=inbox|archive&limit=50&before=<cursor>` — paginated list (already partially exists; verify and extend).
- `GET /api/v1/notifications/unread-count` — single integer, cheap query (used only on first load before realtime takes over).
- `PATCH /api/v1/notifications/:id/read`
- `PATCH /api/v1/notifications/:id/archive`
- `POST /api/v1/notifications/archive-all`

All four mutating endpoints emit the corresponding realtime event (Area F.5) and write `audit_logs`.

### F.10 Per-role event filter

The existing `event-defaults.ts` and `notification_preferences` already determine which event kinds reach which role. No new configuration is needed — the audit identified that emissions were missing, not that filters were wrong. As emissions are added in Area D, they automatically flow through the per-role filter to the appropriate user feeds.

---

## G. Realtime event contract (consolidated)

All events are scoped to a Socket.IO room. Frontend hooks subscribe on mount, unsubscribe on unmount.

| Event | Room | Emitted by | Payload | Frontend subscriber |
|---|---|---|---|---|
| `match-preview.created` | `candidate:{candidateId}` | `ScoringService` after preview row insert | candidateId, jobId, resumeId, source, overallScore, band, createdAt | analyzing screen + dashboard `RecommendedForYouSection` |
| `profile-score.updated` | `candidate:{candidateId}` | `ScoringService` after Profile Score insert | candidateId, resumeId, overallScore, band, reason, updatedAt | dashboard `ProfileScoreCard` |
| `notification.created` | `user:{userId}` | `NotificationsService` after row insert | id, userId, kind, title, bodyExcerpt, linkUrl, createdAt, unreadCount | sidebar bell badge + notifications popover (all portals) |
| `notification.read` | `user:{userId}` | `NotificationsService` on mark-read | id, unreadCount | sidebar bell badge |
| `notification.archived` | `user:{userId}` | `NotificationsService` on archive | id, unreadCount | sidebar bell + popover lists |
| `notification.archive_all` | `user:{userId}` | `NotificationsService` on archive-all | unreadCount: 0 | sidebar bell + popover lists |

All payloads are validated through Zod schemas in `packages/shared/realtime/`. Emitter validates outgoing; subscriber parses incoming. Single source of truth.

---

## H. Error handling matrix

| Trigger | API behavior | UI behavior |
|---|---|---|
| Profile Score AI fails during onboarding | `200` with `profileScore: null`, `errors.profileScore: "transient"`. Profile Score retry job enqueued (BullMQ, 3 attempts, exponential backoff). | Analyzing page → `profileScoreDegraded` for 2 s → redirect to `/candidate?profileScoreRetry=1`. Dashboard score card shows shimmer; resolves when retry succeeds. |
| Profile Score retry exhausts (3 attempts) | Audit log written; `profile_scores` row remains absent. | Dashboard score card transitions from shimmer to inline error: *"We couldn't compute your score. [Try again]"* — manual retry only. |
| `complete-onboarding` PATCH itself errors (DB / network) | `5xx` | Analyzing page shows error with *"Try again"* button. No auto-redirect; candidate isn't trapped. |
| Match precompute job fails (3 retries) | Audit log written. | Dashboard recommendations section shows graceful empty state with retry button. |
| On-view compute AI failure | `5xx` | Job detail page: shimmer → inline error: *"Couldn't compute your match. [Try again]"* |
| On-view compute hits daily cap | `429 DAILY_AI_LIMIT` | Banner: *"Daily AI compute limit reached. Apply to score this match as part of your application."* with CTA link. **No manual compute button** — would bypass the cap. |
| Default resume missing when on-view requested | `422 MISSING_RESUME` | Job detail page: *"Upload a resume to see your match"* — links to `/candidate/profile/resumes`. |
| Delete-default with no remaining resume | `409 LAST_RESUME_PROTECTED` | Inline error in resume list: *"You can't delete your last resume — upload another first."* |
| Notification emit fails (DB error or queue full) | Domain action still succeeds; failure logged via audit_logs. Realtime event not sent. | Bell badge eventually catches up via the next list refetch on mount. Notifications are best-effort delivery; the source-of-truth is the database. |
| Email send fails (Resend/Mailpit error) | BullMQ retries 3× with exponential backoff. After exhaustion, audit_logs entry. | No user-visible error (email is async; user sees the in-app notification). |
| Cron query times out | Cron entry catches, logs, returns. Next tick re-attempts. | No user-visible effect — at most a slightly delayed notification. |
| Socket.IO disconnects | n/a (client-side) | Hook reconnects on its own; React Query refetch on focus pulls authoritative state from the database. **Realtime is an acceleration, not a correctness requirement.** |
| Candidate already has `profile_completed = true` but no `profile_scores` row (legacy state) | First candidate-portal page load triggers a server-side `enqueueProfileScoreIfMissing` guard. Idempotent — if a row exists or a job is already queued, no-op. | Transparent to the candidate. Score card shows shimmer until the job lands. |

---

## I. Testing strategy

**Backend (Jest + supertest)**

Area A — Scoring
- `CandidateProfilesService.completeOnboarding` happy/AI-failure/DB-error paths.
- `ScoringService.computeMatchPreviewOnView` below-cap/at-cap/cache-hit.
- Default-resume-change handler: cancel-old, mark stale, enqueue-new.

Area B — Profile edit recompute (F1)
- `updatePersonal()` marks stale + enqueues recompute job.

Area C — Resume UX (F2, F3)
- Delete-default with multiple resumes → auto-promote.
- Delete-default with one remaining resume → returns 409.

Area D — Notification emissions (F4–F8)
- Application status transitions emit `application_status_changed`.
- `OffersService.accept/decline` emit corresponding events.
- `ApplicationsService.create` emits `new_application_received`.
- Realtime: `notification.created` payload validated against shared Zod schema.

Area E — Crons (F9–F13)
- Each cron's `runOnce()` against a seeded fixture asserts: correct rows are picked up, correct events emitted, side-effect columns updated (e.g., `feedback_reminder_sent_at`).
- Cron error handling: a thrown error inside the handler is caught + logged + doesn't break the schedule.

Area F — Sidebar / notifications API
- `GET /notifications?tab=inbox|archive` returns correct rows.
- Mark-read / archive / archive-all endpoints update DB + emit realtime.
- Audit_logs entry per mutation.

**Frontend (Vitest + React Testing Library)**

- `/onboarding/candidate/analyzing` — render each state of the state machine.
- `profile-score-card-client.tsx` — `stale_at` null vs not-null vs in-flight.
- `_match-preview-client.tsx` — cached / uncached / 429 / 500 / 422 states.
- `_dashboard-client.tsx` `RecommendedForYouSection` — shimmer → fill via realtime → empty state on failure.
- `sidebar-bottom-rail.tsx` — renders avatar + name + ⋯ + bell with correct badge state.
- `sidebar-profile-popover.tsx` — all menu items render; gear icon links to correct settings route per role.
- `sidebar-notifications-popover.tsx` — Inbox tab with unread items, Archive tab, empty states, click-row marks read + navigates.
- `useUserNotifications` hook — subscribes/unsubscribes correctly; updates cache on each event type.

**E2E (Playwright)**

- Full onboarding → analyzing → dashboard with both Profile Score and ≥5 recommendations.
- AI-failure-during-onboarding → degraded path → dashboard with retry banner.
- Job detail: cached preview renders without click; non-cached triggers auto-compute.
- Rate-limit smoke: 101 distinct job details → 101st renders the apply-path banner.
- Notification round-trip per role:
  - Candidate: trigger an application status change in the API → bell badge increments within ~2 s → click bell → see notification → click row → navigate + badge decrements.
  - Recruiter: candidate applies → recruiter's bell increments → review notification.
  - Admin: trigger a `system_moderation_queue_item` → admin bell increments.
- Default-resume switch: undo toast appears + works.
- Delete-default with one resume left: 409 surfaces correctly.

---

## J. Rollout plan

Three PRs to keep review tractable. Each is independently shippable.

**PR 1 — Backend foundation: scoring + crons + notifications emissions** (no user-visible change yet, except the existing CRUD endpoints become slightly more capable)
1. DB migration (Area G).
2. Drizzle schema mirror.
3. Extend `complete-onboarding` response (additive).
4. New `ScoringService.computeMatchPreviewOnView` + Redis cap + `429 DAILY_AI_LIMIT`.
5. Default-resume-change handler.
6. Preferences-edit + profile-personal-edit handlers (F1).
7. Resume delete cascade (F3) + 409 last-resume guard.
8. Notification emissions on application status, new application, offer accept/decline (F4, F5, F6).
9. Email plumbing for interview reschedule + share-feedback (F8).
10. Five new crons (F9–F13).
11. Server-side guard `enqueueProfileScoreIfMissing` on candidate-portal entry.
12. Backend tests.

**PR 2 — Realtime infrastructure: rooms + events + notification API**
1. New `notification.created` / `notification.read` / `notification.archived` / `notification.archive_all` events.
2. `match-preview.created` and `profile-score.updated` events (F7 from the Area F realtime list).
3. `GET /notifications/unread-count`, mark-read, archive, archive-all endpoints.
4. Zod schemas in `packages/shared/realtime/`.
5. Backend tests.

**PR 3 — Frontend cutover: analyzing screen + sidebar rail + buttonless surfaces**
1. New `/onboarding/candidate/analyzing` page + state machine.
2. Preferences final step redirects to `/onboarding/candidate/analyzing` instead of `/candidate`.
3. Remove "Compute my score" button from `profile-score-card-client.tsx`.
4. Remove "See my match" button from `_match-preview-client.tsx`.
5. Dashboard `RecommendedForYouSection`: shimmer slots + Socket.IO subscription.
6. Default-resume confirmation modal removed; undo toast added.
7. New shared `sidebar-bottom-rail.tsx`, `sidebar-profile-popover.tsx`, `sidebar-notifications-popover.tsx`.
8. Wire the bottom rail into all three portal sidebars (candidate, recruiter, admin).
9. New `useUserNotifications()` and `useCandidateRealtime()` hooks in `apps/web/lib/realtime/`.
10. Frontend + E2E tests.

**Post-deploy verification:**
- One-shot report: count candidates with `profile_completed = true AND no current profile_scores row`. Backfill with batched Profile Score recompute jobs.
- Watch `audit_logs` for AI failure rate during the first 48 h. Investigate if it spikes above ~2 %.
- Spot-check that each of the five new crons fires on schedule (look at audit_logs the morning after deploy).
- Confirm bell badges update in realtime for at least one user of each role.

---

## K. Recruiter-side invariants (no work needed — confirming)

When a candidate applies, the existing match-preview-to-match-score promotion path (`scoring.service.ts:381-409`) is unchanged. Recruiter ranking pulls from `match_scores.overallScore` keyed to the `(candidate, job, resumeId)` they applied with. If the candidate later changes their default resume, the application's score stays pinned to the resume they actually submitted — which is the correct invariant. Recruiter-side requires zero modifications under this design beyond the new notification emissions that flow into their bell feed.

---

## L. UI/UX tokens — sidebar bottom rail (per `DESIGN.md`)

The new sidebar rail and popovers are the primary new visual surfaces. They map to existing `DESIGN.md` tokens:

| Element | Token |
|---|---|
| Sidebar background | `{colors.surface-soft}` (`#f7f7f7`) |
| Bottom rail divider | `{colors.hairline}` |
| Avatar (40 px) | `{rounded.full}` |
| Name | `{typography.title-md}` |
| Email | `{typography.caption}` (muted) |
| Settings gear / `⋯` / bell buttons | 32×32 circles, `{colors.surface-strong}` background, hover darken 4–8 % |
| Unread indicator dot on bell | 6×6 `{rounded.full}`, `{colors.primary}` (AuraHire Blue) |
| Profile dropdown popover | `{rounded.lg}` (16 px) radius, soft-drop shadow tier, padding `{spacing.lg}` (24 px), width 320 px |
| Notifications popover | same tokens; width 380 px |
| Tab labels (Inbox / Archive) | `{typography.nav-link}`, active state underline 2 px `{colors.ink}` |
| Notification row title | `{typography.body-sm}` strong (600) |
| Notification row body | `{typography.body-sm}` muted |
| Timestamp | `{typography.caption}` muted |
| Inline notification unread dot | 8×8 `{rounded.full}`, `{colors.primary}` |
| Empty state copy | `{typography.body-sm}`, `{colors.muted}` |
| Archive-all button | `button-secondary-light` from `DESIGN.md` |
| Status pill in profile popover | small inline row, dot + label, dot color = `{colors.score-high}` (normal) or `{colors.score-mid}` (degraded) |

Animations: popover enter 200 ms (matches `DESIGN.md` modal-enter timing). Bell badge transition on increment: a 1-frame scale 1 → 1.15 → 1.0 over 200 ms (subtle pulse — explicit because the Vercel pattern uses one).

---

## M. Open follow-ups (not blocking this slice)

- **Reverse precompute on job publish.** When a recruiter publishes a new job, score it against the top-N active candidate profiles. Helps recruiter-side ranking light up faster and gives candidates whose dashboards are open a fresh recommendation. Adds complexity around defining "active candidate profile" — defer.
- **Dismiss-recommendation affordance.** Candidate "Not interested" on a recommended job. Either a `dismissed_at` column on `match_score_previews` or a separate `recommendation_dismissals` table. Defer; not load-bearing for the thesis.
- **Search-results card auto-compute.** Highest AI spend; cards in lists currently render the match-band chip only when a cached preview exists. Defer.
- **Manual Profile Score recompute when not stale.** Currently the recompute affordance only appears on `stale_at IS NOT NULL`. Defer until requested.
- **Job duplication / "use as template."** Recruiter UX feature; needs its own slice.
- **Match score override justification.** Verify whether the override path exists in the current codebase; if so, design fairness-critical capture in a separate slice.
- **Bulk bias-flag override.** Likely intentional friction (per-flag justification enforces thought). Confirm in a fairness review before changing.
- **Admin user suspension notification to suspended user.** Touches auth/email policy; better as part of an admin-actions slice.
- **AI scoring failure observability.** Beyond the recruiter-facing notification, an admin-facing dashboard / Sentry integration is worth a separate slice.
- **Send-feedback modal.** The mailto stub stands for thesis scope; modal is a polish follow-up.
- **"How it works" page content.** The link target exists; the page content is its own slice.
- **Bell desktop notifications / browser push.** Out of scope for thesis; would require a service worker + push subscription flow.
- **Notification preferences UI.** The `notification_preferences` table exists and is read by the emit path; a settings UI to let users toggle per-event-kind preferences is a separate slice.
