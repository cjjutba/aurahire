# Interview Flow Redesign - End-to-End In-Person Interview, Feedback, and Hire Decision

**Date:** 2026-05-07
**Owner:** Recruiter ↔ Candidate post-application pipeline
**Status:** approved (full bundle - schema + state machine + backend + cron + UI + notifications + audit + realtime)

## Problem

The current AuraHire pipeline (`applied → screening → interview → offer → hired`) treats the interview stage as a single status flag with a thin record (`interviews` table holds time, duration, format, free-text location, status, feedback, rating). The flow has multiple gaps that block production use:

1. **No way to skip Screening.** Recruiter must `applied → screening → interview` in two separate clicks even when scheduling an interview directly is the obvious next step. Real-world hiring (especially university campus interviews like JRMSU on-site) often goes straight to interview.
2. **Interview format is over-specified.** UI offers Phone / Video / In-Person; AuraHire's thesis use case is in-person only and the format selector adds noise without value.
3. **Location is a single free-text field** (`location_or_link`). For in-person interviews recruiters need: venue name, full address, room/floor, map link, reporting instructions, what to bring, interviewer name + title. Today they cram everything into one line or leave details out.
4. **No "interview happened" detection.** A scheduled interview's status stays `scheduled` forever unless a recruiter manually flips it. The existing `interview-feedback-due` cron already assumes the row is `completed` - there's a gap between reality (interview ended) and system state.
5. **Feedback workflow is invisible.** Backend `updateFeedback()` and `updateStatus()` exist but no UI wires them up. There's no path for: capturing feedback, rating, recommending hire/reject, or sharing a sanitized version with the candidate.
6. **No "decide" gate.** After an interview the recruiter has no scaffolded way to record "proceed to offer" or "reject after interview." They can click "Send Offer" or "Reject" cold, with no tie to interview feedback.
7. **Reschedule, no-show, and multi-round interviews are unsupported in UI** even though the data model permits them.
8. **Candidate withdrawal is over-restricted.** State machine only allows withdrawal from `offer`, but candidates expect to withdraw any time pre-hire.
9. **Calendar integration is missing.** No ICS attachment, no "Add to calendar" link.
10. **Conflict detection is absent.** Recruiter can double-book a candidate or themselves with no warning.
11. **Several pages are missing or thin:** no recruiter interview detail page; no candidate interview detail page; no venue templates; no withdraw UI on candidate side.

## Goal

Ship the full enterprise-grade post-application flow in one bundle:

- Recruiter can schedule directly from `applied` or from `screening`. Status auto-advances atomically with the interview row creation.
- Interviews are in-person only. The schedule modal captures structured venue + guidance fields. Recruiters can save and reuse venue templates.
- After the interview ends, a cron flips the status to `completed` automatically; the recruiter can override to `no-show`. The recruiter records private feedback, rating, and a `proceed | hold | reject` recommendation. They can optionally share a sanitized candidate-facing summary that reaches the candidate via email + in-app notification.
- The recruiter's recommendation drives the next-step UI: `proceed` highlights "Send Offer"; `reject` highlights "Reject Candidate." Soft confirmation if a stage move happens without recorded feedback.
- The candidate has a polished interview detail page (venue, map, instructions, what-to-bring, interviewer, calendar download, withdraw button) and sees recruiter feedback once it's shared.
- All transitions are audited; all stage-change events emit realtime so both sides see updates without refresh.
- Reschedule, no-show, multi-round, withdrawal, and conflict warnings are all first-class.

## Scope

### In scope

**Schema (`packages/db/`)**

- `interviewsTable` - add 13 columns; deprecate `location_or_link`; extend `INTERVIEW_STATUS` enum with `rescheduled`.
- New table `interview_venues` (per-company reusable templates) + RLS.
- `applications` - no new columns (status flag already represents the funnel).
- State machine update: `applied → interview` and `* → withdrawn` from any non-terminal stage.

**Shared types (`packages/shared/`)**

- New Zod schemas: `ScheduleInterviewInputV2` (with venue fields), `RescheduleInterviewInput`, `ShareInterviewFeedbackInput`, `SetInterviewRecommendationInput`, `WithdrawApplicationInput`, `InterviewVenue` CRUD shapes.
- Updated `UpdateInterviewFeedbackInput` to include `recommendation`.

**Backend (`apps/api/`)**

- `applications` module:
  - State machine relaxation (state-machine.ts).
  - New `POST /api/v1/applications/:id/withdraw` (candidate auth required).
  - `POST /api/v1/applications/:id/interviews` runs status auto-advance + interview insert in a single DB transaction.
- `interviews` module:
  - `PATCH /api/v1/interviews/:id/feedback` - save private feedback + rating + recommendation.
  - `POST /api/v1/interviews/:id/share-feedback` - set candidate_summary, set shared_with_candidate_at, fire candidate email + in-app notification.
  - `PATCH /api/v1/interviews/:id/no-show` - flips status to `no-show` (only valid from `scheduled` or `completed`).
  - `POST /api/v1/interviews/:id/reschedule` - atomic: marks current `rescheduled`, links via `rescheduled_to_id`, creates new with `rescheduled_from_id`, sends rescheduled email with refreshed ICS.
  - `GET /api/v1/interviews/:id/ics` - returns ICS file for calendar download (auth required, candidate or recruiter).
  - Conflict detection helper: `checkConflicts({ scheduledAt, durationMinutes, recruiterId, candidateId })` returns recruiter and candidate overlapping interviews; soft surface only.
  - Map URL sanitizer (`^https?://` only).
- New `interview-venues` module: full CRUD + `set-default` action.
- Notifications service: new event types listed in §Notifications. All plug into existing notification-preferences toggles.
- Realtime events: `interview.completed`, `interview.rescheduled`, `interview.feedbackShared`, `application.recommendationSet`, `application.withdrawn`.
- New cron `apps/api/src/cron/interview-autocomplete.cron.ts`. Hourly. Flips overdue scheduled interviews to `completed`, audits, emits realtime, fires recruiter in-app nudge.
- Email templates added: `InterviewRescheduledEmail`, `InterviewReminderEmail`, `InterviewFeedbackSharedEmail`. Existing `InterviewScheduledEmail` updated to render new venue fields and attach ICS.
- ICS builder under `apps/api/src/lib/calendar/build-interview-ics.ts`. Stable UID per interview so reschedule replaces calendar entry instead of duplicating it.
- Audit actions added (see §Audit).

**Web (`apps/web/`)**

- Recruiter - application detail (`/recruiter/applications/[id]`):
  - Decision bar adds "Move to Interview" CTA when status=`applied`.
  - Replaces today's flat Interviews section with an Interview Pipeline panel: active interview card (full venue display + actions), past-interviews accordion, "Schedule another" button.
  - Adds a Decision panel that appears when latest interview is `completed`: inline private feedback form, rating, recommendation, "Save Feedback" + "Share with candidate" actions; recommendation result highlights "Send Offer" or "Reject Candidate."
  - Soft confirmation modal if recruiter clicks Send Offer or Reject without feedback recorded.
- Recruiter - schedule interview modal (redesigned):
  - "Use saved venue" template dropdown.
  - Date/time/duration with conflict-warning chips (recruiter overlap, candidate overlap).
  - Venue fields (name, address required; room, map URL optional).
  - Candidate guidance (reporting instructions, what to bring).
  - Interviewer (name default = current user, title optional).
  - "Save as venue template" checkbox.
  - Hides format selector (defaults to in-person).
- Recruiter - interview detail page (NEW `/recruiter/interviews/[id]`):
  - Header (candidate, job, status, scheduled time).
  - Venue card with optional map embed.
  - Candidate info link.
  - Reschedule / Cancel / Mark No-Show actions.
  - Feedback panel: private feedback, rating, recommendation, save + share actions.
  - Past-interviews list (multi-round).
- Recruiter - share-feedback modal (NEW): pre-filled sanitized version of private feedback, recruiter edits, tone tip, sends.
- Recruiter - venue templates settings (NEW `/recruiter/settings/interview-venues`): list, add, edit, delete, set default.
- Candidate - application detail (`/candidate/applications/[id]`):
  - Upcoming Interview banner (visible when latest interview is `scheduled`): date/time/venue, "View details," "Add to calendar," "Withdraw application."
  - Interview Feedback panel (visible when `shared_with_candidate_at` is set).
- Candidate - interview detail page (NEW `/candidate/interviews/[id]`):
  - Schedule card (rendered in candidate's TZ, fallback `Asia/Manila`).
  - Venue card.
  - What to bring + reporting instructions.
  - Interviewer info.
  - "Add to calendar" → ICS download.
  - "Withdraw application" with confirmation modal (optional reason).
  - Recruiter feedback panel (only when shared; numeric rating stays internal).
- Notification preferences UI (existing) - adds toggle rows for new events.
- Withdraw confirmation modal (shared component): warning copy, optional reason textarea.

### Out of scope

- Onboarding handoff after `hired` (separate v2 epic).
- Bulk operations (bulk reject, bulk move stage).
- Phone/video interview formats (deliberately removed; enum stays for forward-compat only).
- Internationalization beyond `Asia/Manila` default for timezone display.
- Print stylesheet for interview details.
- Recruiter scheduling on behalf of multiple candidates simultaneously (panel interview support).
- Interview kit / question bank / scorecards keyed to job competencies.
- Calendar two-way sync (Google Calendar / Outlook). ICS download only.

## Data Model

### `interviews` table (changes to existing)

| Column                     | Type        | Constraints                               | Purpose                                       |
| -------------------------- | ----------- | ----------------------------------------- | --------------------------------------------- |
| `venue_name`               | text        | NOT NULL DEFAULT ''                       | Primary venue label, e.g. "JRMSU Main Campus" |
| `address_line`             | text        | NOT NULL DEFAULT ''                       | Full street address                           |
| `room_or_floor`            | text        | NULL                                      | "ICT Building, Room 305"                      |
| `map_url`                  | text        | NULL                                      | Google Maps URL (sanitized)                   |
| `reporting_instructions`   | text        | NULL                                      | "Arrive 15 min early; check in at front desk" |
| `what_to_bring`            | text        | NULL                                      | "1 valid ID, printed resume"                  |
| `interviewer_name`         | text        | NULL                                      | Defaults to scheduling recruiter              |
| `interviewer_title`        | text        | NULL                                      | "Senior Engineering Manager"                  |
| `candidate_summary`        | text        | NULL                                      | Sanitized feedback shown to candidate         |
| `recommendation`           | text        | NULL, enum: `proceed \| hold \| reject`   | Recruiter's post-interview call               |
| `shared_with_candidate_at` | timestamptz | NULL                                      | When `candidate_summary` was last shared      |
| `rescheduled_from_id`      | uuid        | NULL FK→interviews(id) ON DELETE SET NULL | Back-pointer in reschedule chain              |
| `rescheduled_to_id`        | uuid        | NULL FK→interviews(id) ON DELETE SET NULL | Forward-pointer in reschedule chain           |

Existing column changes:

- `format` - default changed to `'in-person'`. Enum remains `phone | video | in-person` for forward-compat. UI hides selector.
- `location_or_link` - kept for legacy reads. Backfill copies value into `address_line` if `address_line` is empty.

Enum changes:

- `INTERVIEW_STATUS` adds `'rescheduled'`. New full set: `scheduled | completed | cancelled | no-show | rescheduled`.

Indexes (new):

- `interviews_recommendation_idx` on `(application_id, recommendation)` - supports the decision panel query.
- `interviews_shared_idx` on `(application_id) WHERE shared_with_candidate_at IS NOT NULL` - partial index for candidate's "any shared feedback?" query.

### `interview_venues` table (NEW)

```
id              uuid pk
company_id      uuid NOT NULL FK→companies(id) ON DELETE CASCADE
created_by      uuid NOT NULL FK→profiles(id)
label           text NOT NULL                     -- recruiter-facing label
venue_name      text NOT NULL
address_line    text NOT NULL
room_or_floor   text NULL
map_url         text NULL
reporting_instructions text NULL
what_to_bring   text NULL
interviewer_name  text NULL
interviewer_title text NULL
is_default      boolean NOT NULL DEFAULT false
created_at      timestamptz NOT NULL DEFAULT now()
updated_at      timestamptz NOT NULL DEFAULT now()

unique (company_id, label)
index (company_id, is_default) WHERE is_default = true
```

RLS:

- `interview_venues_company_select` - `EXISTS company_members WHERE company_id = interview_venues.company_id AND user_id = auth.uid()`
- `interview_venues_recruiter_write` - same check + `role = 'recruiter'`
- `interview_venues_admin_all` - admin role bypasses

### State machine - `apps/api/src/modules/applications/state-machine.ts`

```ts
const VALID_TRANSITIONS: Record<
  ApplicationStatus,
  readonly ApplicationStatus[]
> = {
  applied: ["screening", "interview", "rejected", "withdrawn"],
  screening: ["interview", "rejected", "withdrawn"],
  interview: ["offer", "rejected", "withdrawn"],
  offer: ["hired", "rejected", "withdrawn"],
  hired: [],
  rejected: [],
  withdrawn: [],
};
```

Authorization rules layered on top of the transitions table:

- `* → withdrawn` is allowed only when actor is the application's candidate, or admin.
- `* → screening | interview | offer | hired | rejected` is allowed only when actor is a recruiter for the company that owns the job, or admin.
- The recruiter cannot withdraw on behalf of a candidate.

### Audit actions added

```
INTERVIEW_AUTO_COMPLETED
INTERVIEW_NO_SHOW_MARKED
INTERVIEW_RESCHEDULED
INTERVIEW_FEEDBACK_SUBMITTED      // rename of INTERVIEW_FEEDBACK_UPDATED
INTERVIEW_FEEDBACK_SHARED
INTERVIEW_RECOMMENDATION_SET
INTERVIEW_VENUE_CREATED
INTERVIEW_VENUE_UPDATED
INTERVIEW_VENUE_DELETED
APPLICATION_WITHDRAWN_BY_CANDIDATE
```

## Backend Surface

### Endpoints (new and changed)

**Application stage transitions:**

- `POST /api/v1/applications/:id/interviews` (recruiter) - body includes new venue fields. Service runs `applied → interview` (or `screening → interview`) and interview INSERT in one transaction. Returns interview DTO.
- `POST /api/v1/applications/:id/withdraw` (candidate or admin) - sets status to `withdrawn`, audits, emits `application.withdrawn`. Body: `{ reason?: string }`.

**Interview operations:**

- `PATCH /api/v1/interviews/:id/feedback` (recruiter) - body: `{ feedback: string, rating: 1-5 \| null, recommendation: 'proceed' \| 'hold' \| 'reject' \| null }`. Sets the three fields, audits `INTERVIEW_FEEDBACK_SUBMITTED` and (if recommendation changed) `INTERVIEW_RECOMMENDATION_SET`. Emits `application.recommendationSet`.
- `POST /api/v1/interviews/:id/share-feedback` (recruiter) - body: `{ candidateSummary: string }`. Validates length (1-4000 chars). Sets `candidate_summary` and `shared_with_candidate_at = now()`. Audits, sends email via `InterviewFeedbackSharedEmail`, fires in-app `interview_feedback_shared`.
- `PATCH /api/v1/interviews/:id/no-show` (recruiter) - flips status to `no-show`. Allowed from `scheduled` or `completed`. Audits.
- `POST /api/v1/interviews/:id/reschedule` (recruiter) - body: full schedule input shape. Allowed only when current status is `scheduled` or `no-show`; rejected with 422 from `cancelled`, `completed`, or `rescheduled`. In one transaction: marks current row `status='rescheduled'`, sets its `rescheduled_to_id`, creates new row with `rescheduled_from_id` pointing back. Sends `InterviewRescheduledEmail` with refreshed ICS (same UID).
- `PATCH /api/v1/interviews/:id/status` (recruiter) - existing endpoint, untouched in shape.
- `GET /api/v1/interviews/:id/ics` (candidate or recruiter, ownership-checked) - returns `text/calendar` body with `Content-Disposition: attachment; filename="interview.ics"`.

**Venue templates:**

- `GET /api/v1/companies/:companyId/interview-venues` (recruiter, member of company) - list.
- `POST /api/v1/companies/:companyId/interview-venues` (recruiter) - create.
- `PATCH /api/v1/interview-venues/:id` (recruiter, member of owning company) - update.
- `DELETE /api/v1/interview-venues/:id` (recruiter, member) - delete.
- `POST /api/v1/interview-venues/:id/set-default` (recruiter) - atomically clears other defaults in the company and sets this one.

### Conflict detection (soft, never-blocking)

Helper inside `interviews.service.ts`:

```ts
async checkConflicts(input: { scheduledAt: Date; durationMinutes: number; recruiterId: string; candidateId: string }): Promise<{
  recruiterConflicts: InterviewSummary[];
  candidateConflicts: InterviewSummary[];
}>
```

SQL queries `interviews` joined to `applications` for candidate-side conflicts; uses `scheduled_by` for recruiter-side. Time overlap = `[start, start+duration)` ranges intersect with existing `scheduled` interviews.

Schedule modal calls a separate `POST /api/v1/applications/:id/interviews/check-conflicts` (no DB write) before the actual schedule POST, displays warning chips in modal. Recruiter can override (proceeding without changes is allowed).

### Map URL sanitizer

`apps/api/src/modules/interviews/lib/sanitize-map-url.ts`:

- Trim, lowercase scheme.
- Allow only schemes `http://` and `https://`.
- Reject `javascript:`, `data:`, `file:`, etc.
- Length cap 2048 chars.
- Returns `string | null`. On invalid input, validation error from DTO.

### ICS builder

`apps/api/src/lib/calendar/build-interview-ics.ts`:

```ts
export function buildInterviewIcs(input: {
  interview: InterviewRow;
  candidate: { fullName: string; email: string };
  job: { title: string };
  company: { name: string; recruiterEmail: string };
}): string;
```

Returns RFC-5545 compliant ICS string. Required fields: `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//AuraHire//Interview//EN`, `BEGIN:VEVENT`, `UID:interview-{interview.id}@aurahire.app`, `DTSTAMP`, `DTSTART`, `DTEND` (DTSTART + duration), `SUMMARY` (`Interview: {jobTitle} at {companyName}`), `LOCATION` (`{venueName}, {addressLine}{ , room_or_floor if set}`), `DESCRIPTION` (interviewer info + reporting instructions + what to bring + map URL), `ORGANIZER` (recruiter mailto), `ATTENDEE` (candidate mailto), `END:VEVENT`, `END:VCALENDAR`. Folds long lines per RFC 5545. UID stable across reschedule so calendar updates the existing event.

### Cron job (NEW): interview-autocomplete

`apps/api/src/cron/interview-autocomplete.cron.ts`. Pattern matches existing `interview-feedback-due.cron.ts`.

```
@Cron("0 * * * *", { name: "interview-autocomplete", timeZone: "Asia/Manila" })
```

Query (raw SQL needed for column-derived comparison, like the existing feedback-due cron):

```sql
SELECT id, application_id, scheduled_by FROM interviews
WHERE status = 'scheduled'
  AND (scheduled_at + ((duration_minutes + 15) || ' minutes')::interval) <= now()
LIMIT 200
```

For each row:

1. `UPDATE interviews SET status='completed', updated_at=now() WHERE id = $1 AND status='scheduled'` (guards against race).
2. Audit `INTERVIEW_AUTO_COMPLETED`.
3. Cache bust (company interviews, candidate interviews, dashboard).
4. Emit `interview.completed` realtime event.
5. Fire `interview_completed` in-app notification to candidate.
6. Fire `interview_record_feedback` in-app to recruiter (distinct event key from the existing feedback-due cron's `interview_feedback_due`, so neither cron sets a guard timestamp the other depends on). The existing `interview-feedback-due.cron.ts` continues unchanged and provides the 24h-later second nudge with its own event key.

### Notifications

Events plug into existing `notifications` + `notification-preferences` modules. Event keys (some new):

| Event key                   | Email              | In-app | Recipient | Trigger                                                                                             |
| --------------------------- | ------------------ | ------ | --------- | --------------------------------------------------------------------------------------------------- |
| `interview_scheduled`       | ✓ + ICS            | ✓      | candidate | recruiter schedules                                                                                 |
| `interview_rescheduled`     | ✓ + ICS (same UID) | ✓      | candidate | recruiter reschedules                                                                               |
| `interview_cancelled`       | ✓                  | ✓      | candidate | recruiter cancels                                                                                   |
| `interview_reminder_24h`    | ✓                  | ✓      | candidate | reminder cron                                                                                       |
| `interview_completed`       | -                  | ✓      | candidate | autocomplete cron                                                                                   |
| `interview_feedback_shared` | ✓                  | ✓      | candidate | recruiter shares                                                                                    |
| `interview_record_feedback` | -                  | ✓      | recruiter | autocomplete cron - fires immediately when status flips to completed                                |
| `interview_feedback_due`    | -                  | ✓      | recruiter | existing feedback-due cron - fires 24h after completion if feedback still unrecorded (second nudge) |
| `application_withdrawn`     | -                  | ✓      | recruiter | candidate withdraws                                                                                 |

Default preferences: all enabled for both channels except `interview_completed`, `interview_record_feedback`, `interview_feedback_due`, and `application_withdrawn` (in-app only - these are workflow nudges, not announcements).

### Realtime events added

`interview.completed`, `interview.rescheduled`, `interview.feedbackShared`, `application.recommendationSet`, `application.withdrawn`. Subscribed by:

- Recruiter application detail and recruiter interview detail pages (live status sync).
- Candidate application detail and candidate interview detail pages (live banner + feedback panel sync).

## UI

### Recruiter - application detail (`/recruiter/applications/[id]`)

Layout (top to bottom):

1. **Header** (existing) - back link, candidate name, contact row, status pill, applied-at, job link.
2. **Decision bar** (existing, augmented):
   - Pipeline path visualization (existing).
   - Shortlist / Resume / Reject buttons (existing).
   - Primary CTA: when status=`applied`, render two buttons side-by-side - "Move to Screening" (existing) and "Move to Interview" (new). The "Move to Interview" button advances status without scheduling, useful when the recruiter wants to gate a separate scheduling action. Schedule modal still auto-advances if status=`applied`.
   - When status=`screening`, primary CTA is "Move to Interview."
   - When status=`interview`, primary CTA is "Send Offer" (existing).
3. **Score dashboard** (existing).
4. **Interview Pipeline panel** (NEW; replaces today's flat Interviews section):
   - Header: "Interview" + status chip of latest interview (active or final).
   - Active interview card (latest by `created_at DESC` with status priority `scheduled > rescheduled > completed > cancelled > no-show`):
     - Scheduled time + duration in company TZ.
     - Venue summary (venue_name, address_line, room_or_floor).
     - Interviewer name + title.
     - Per-status actions:
       - `scheduled` → "Reschedule," "Mark No-Show," "Cancel."
       - `completed` → "Add Feedback" (opens detail page) / "Mark No-Show" (override).
       - `cancelled | no-show | rescheduled` → read-only.
   - Past interviews accordion (collapsed by default) with same card layout but no actions.
   - "Schedule another interview" button (always visible during interview stage; supports multi-round).
5. **Decision panel** (NEW; visible when latest interview status=`completed`):
   - Banner: "Interview completed. Record your decision."
   - Inline feedback form:
     - Private feedback textarea (4000-char limit).
     - Rating: 1-5 star control.
     - Recommendation: radio group `Proceed → Offer` / `Hold` / `Reject`.
     - "Save Feedback" primary button.
     - "Share summary with candidate" secondary button (opens share modal).
   - When `recommendation = proceed`, the existing "Send Offer" CTA in the decision bar gets a highlight ring.
   - When `recommendation = reject`, the existing "Reject" CTA gets a highlight ring.
   - Soft confirmation modal if recruiter clicks Send Offer / Reject without `recommendation` set.
6. **Offers** (existing) - untouched.
7. **Notes** (existing, repositioned beneath Decision panel) - kept for misc team notes; visually distinguished from interview feedback.
8. **Fairness footer** (existing).

### Recruiter - schedule interview modal (`_schedule-interview-modal-client.tsx`, redesigned)

Width grows to ~640px to accommodate new fields. Sections:

- **Use saved venue** (top): dropdown loads `interview_venues` for the active company. On select, autofills all venue + guidance + interviewer fields. "None - fill manually" is the default.
- **Date & time** + **Duration** (existing). Below the date input: conflict warning chips populated from `check-conflicts` endpoint (debounced 500ms after change).
- **Venue:** venue_name (required), address_line (required), room_or_floor, map_url.
- **Candidate guidance:** reporting_instructions (multiline), what_to_bring (multiline).
- **Interviewer:** interviewer_name (default = current user fullName), interviewer_title.
- **"Save as venue template"** checkbox (only visible when no template was selected). When checked, prompts for a `label`. After successful schedule, also creates an `interview_venues` row.
- Submit → `POST /applications/:id/interviews` → toast "Interview scheduled" → close modal → `router.refresh()`.
- Error states: validation errors render inline; conflict errors render at top as dismissible warning.

Format selector is removed entirely. Server defaults `format='in-person'`.

### Recruiter - interview detail page (NEW `/recruiter/interviews/[id]`)

```
/recruiter/interviews/[id]/
├── page.tsx
├── _interview-detail-client.tsx
├── _feedback-panel-client.tsx
├── _share-feedback-modal-client.tsx
├── _reschedule-modal-client.tsx
└── loading.tsx
```

Sections:

1. Header with back link to applications list, candidate name + initials avatar, job + company, status pill.
2. Schedule card: date/time in company TZ + candidate TZ if known (fallback Asia/Manila), duration, ICS download button.
3. Venue card with optional map embed (lazy iframe to `mapUrl` only if it points to google.com/maps; otherwise plain link).
4. Candidate card → links to `/recruiter/applications/[id]`.
5. Action bar: Reschedule, Mark No-Show, Cancel (status-aware enable/disable).
6. Feedback panel:
   - Tabs: "Private feedback" | "Candidate-facing summary."
   - Private tab: feedback textarea, rating, recommendation radios, save button. Last-saved indicator.
   - Candidate-facing tab: shows current shared summary (if any) and `shared_with_candidate_at`. "Share with candidate" button opens modal.
7. Reschedule chain: if `rescheduled_from_id` or `rescheduled_to_id` is set, render mini-timeline at bottom.

### Recruiter - share-feedback modal

Inputs:

- Candidate-facing summary textarea (1-4000 chars). Pre-filled by stripping common internal markers from private feedback (heuristic: removes lines starting with "internal:", "concern:", "note to team:"; trims down to a 2-paragraph max). Recruiter can fully edit.
- Tone tip block: "This text is sent directly to the candidate via email and shown in their portal. Keep it constructive."
- Diff preview if updating a previously shared summary (shows added/removed lines).
- Submit → POST share-feedback → toast → modal closes → parent page revalidates.

### Recruiter - venue templates settings (NEW `/recruiter/settings/interview-venues`)

```
/recruiter/settings/interview-venues/
├── page.tsx
├── _venues-list-client.tsx
├── _venue-form-modal-client.tsx
└── loading.tsx
```

Page shows:

- "Add venue template" button (top-right) → opens form modal.
- List of existing templates (cards):
  - Label (bold) + venue_name + address summary.
  - Default badge if `is_default=true`.
  - Actions: Edit, Delete (confirmation), Set as default.

### Candidate - application detail (`/candidate/applications/[id]`, augmented)

New blocks added between existing sections:

- **Upcoming Interview banner** (visible when latest interview = `scheduled` or `rescheduled`):
  - Card with primary surface - interview date/time in candidate's TZ, venue_name, address summary, room_or_floor.
  - Buttons: "View interview details" (→ `/candidate/interviews/[id]`), "Add to calendar" (downloads ICS), "Withdraw application" (opens confirmation modal).
- **Interview Feedback panel** (visible when latest interview has `shared_with_candidate_at` set):
  - Header: "Recruiter feedback from your interview."
  - Body: `candidate_summary` text rendered with line breaks preserved (no markdown).
  - Footer: "View full interview details" link.

### Candidate - interview detail page (NEW `/candidate/interviews/[id]`)

```
/candidate/interviews/[id]/
├── page.tsx
├── _interview-detail-client.tsx
├── _withdraw-modal-client.tsx
└── loading.tsx
```

Sections (top to bottom):

1. Header: job title + company name, status pill, scheduled time in candidate's TZ.
2. Venue card: venue_name, address_line, room_or_floor, map link (or embed if `mapUrl` is google.com/maps).
3. What to bring card.
4. Reporting instructions card.
5. Interviewer card.
6. Action bar: "Add to calendar" (ICS download), "Withdraw application" (opens modal).
7. Recruiter feedback panel (only when shared) - `candidate_summary` text, no rating exposure.

Data load:

- Server component fetches via `GET /api/v1/me/interviews/:id` (existing endpoint, dto extended with new fields and conditional `candidate_summary`).
- 404 if interview belongs to different candidate (existing RLS).

### Withdraw application modal (shared component)

Used on both candidate application detail banner and candidate interview detail page.

Inputs:

- Optional reason textarea (500-char limit).
- "Yes, withdraw my application" destructive button + "Keep my application" cancel button.
- Warning copy: "This cannot be undone. The recruiter will be notified."

Submit → `POST /api/v1/applications/:id/withdraw` → toast "Application withdrawn" → router.refresh.

### Notification preferences UI

Existing settings page gains the following toggle rows (each with email + in-app subtoggles where applicable):

- Interview reminders (24h before)
- Interview rescheduled
- Interview feedback shared (candidate side)
- Application withdrawn (recruiter side)

## Edge Cases

1. **Concurrent stage moves** - DB row-level lock on `applications` for the duration of the transaction. Loser gets `INVALID_STATUS_TRANSITION` and surfaces as toast.
2. **Reschedule racing autocomplete cron** - UPDATE in reschedule path uses `WHERE status='scheduled'` guard. Cron's UPDATE uses the same guard. At-most-one wins.
3. **Candidate withdraws after recruiter shares feedback** - feedback already delivered; status flips to `withdrawn`. Candidate UI shows withdrawn state with feedback still readable. Recruiter UI shows withdrawn banner over the decision panel.
4. **Reject without feedback** - soft confirmation modal: "You haven't recorded interview feedback. Continue?" - proceeds if confirmed. "Once per session" means once per `(applicationId, recruiterId)` tuple, tracked in `sessionStorage` under key `interview-feedback-warn:{applicationId}` so the warn doesn't repeat for the same application during the same browser tab session, but does repeat for a different application or after a tab close/reopen.
5. **ICS reschedule** - same UID across the chain so calendars update the existing event in place. New ICS is sent attached to `InterviewRescheduledEmail`. If user manually downloaded ICS earlier from the old detail page, the calendar still updates because UIDs match.
6. **Long interview vs. autocomplete** - autocomplete grace is `duration_minutes + 15`. A 4-hour interview won't be flipped early.
7. **Multiple interviews on one application** - UI sorts by `created_at DESC` with status priority `scheduled > rescheduled > completed > cancelled > no-show`. Active card always renders the top entry.
8. **Malicious mapUrl** - backend regex enforces `^https?://`; any other scheme rejected with 422.
9. **Email bounce on share** - Mailpit/Resend logs a bounce; in-app notification is delivered regardless. Audit log captures the share event independent of delivery.
10. **Candidate withdraws while recruiter views detail page** - realtime `application.withdrawn` event flips the page to a withdrawn banner state without manual refresh.
11. **No-show then reschedule** - original stays `no-show`, new interview chains via `rescheduled_from_id`. Reschedule action is allowed from `scheduled` and `no-show` (so a recruiter can re-schedule after a missed interview); not allowed from `cancelled` (cancellation is final; create fresh schedule instead).
12. **Connection loss during feedback save** - UI uses optimistic write with localStorage backup keyed by `interview-{id}-feedback-draft`; retry banner appears if save fails. Draft cleared on successful save.
13. **Recruiter changes mind about share** - re-clicking "Share with candidate" opens modal pre-filled with current shared summary. New share updates `candidate_summary` and refreshes `shared_with_candidate_at`. Cannot un-share; audit captures every share with diff.
14. **Venue template deleted while modal is open** - schedule modal's "Use saved venue" dropdown re-fetches on open; if the selected template was deleted between open and submit, server proceeds normally because venue fields were copied into the form, not referenced by ID.
15. **Candidate's TZ unknown** - fall back to `Asia/Manila`. Candidate detail page shows "(Times shown in Manila timezone)" footnote.
16. **Recruiter unassigned from company mid-flow** - RLS denies access; recruiter sees 404 on the application detail page. Open modals dismiss with "session permissions changed" toast.
17. **Interview was originally scheduled by a recruiter who is no longer in the company** - `interviewer_name` field is text, not FK, so display is unaffected. Audit + scheduledBy still link to the original profile (FK is preserved).
18. **Candidate withdrawn mid-cron** - autocomplete cron's status guard is `WHERE status='scheduled'`. If withdraw flipped the application status, the interview row still has `status='scheduled'`; cron still runs and flips it to `completed` (which is harmless - the interview did or did not happen, the candidate withdrew separately). Decision panel won't render for withdrawn applications regardless.

## Testing

### Unit

- State machine transitions (extended): every entry in `VALID_TRANSITIONS` has positive and negative tests.
- ICS builder: snapshot test against fixtures; UID stability across reschedule; long-line folding.
- Map URL sanitizer: allow http/https; reject javascript:, data:, file:, mailto:, ftp:; length cap.
- Conflict detection: overlap math correctness (start, end, and edge boundaries); recruiter vs. candidate sets.
- Recommendation gating logic: soft-confirm trigger conditions.
- Withdrawal authorization: only candidate or admin can withdraw.

### Integration (NestJS + supertest)

- Schedule from `applied` → status flips to `interview`, interview row exists, audit record created.
- Schedule from `screening` → status flips to `interview`.
- Reschedule chain: original row marked `rescheduled`, new row created with `rescheduled_from_id` pointing back, `rescheduled_to_id` set on original. Email fired with new ICS.
- Share feedback flow: PATCH feedback (private) → POST share-feedback → email fired → in-app notification dispatched → `shared_with_candidate_at` set.
- Autocomplete cron: scheduled row past `(scheduled_at + duration + 15min)` → flipped to completed → audit recorded → recruiter and candidate notifications fired.
- Venue templates CRUD: create, list, update, delete, set-default semantics (only one default per company).
- Withdraw: `applied → withdrawn` succeeds; recruiter cannot withdraw; admin can.
- Conflict detection endpoint: returns recruiter + candidate overlap rows; does not block schedule POST.

### E2E (full happy path)

1. Candidate applies.
2. Recruiter opens application, clicks Schedule Interview from `applied` (skip Screening). Modal saves with venue + guidance fields. Status auto-advances.
3. Time-mock advances past `scheduled_at + duration + 15min`. Autocomplete cron runs.
4. Recruiter opens detail, sees Decision panel. Records private feedback + rating + recommendation=`proceed`.
5. Recruiter shares candidate-facing summary.
6. Candidate sees Interview Feedback panel on application detail.
7. Recruiter clicks Send Offer (highlighted). Offer flow proceeds (existing).
8. Candidate accepts offer. Status → `hired` (existing flow).

### UI

- axe accessibility on all new modals and pages.
- Keyboard navigation through schedule modal, share-feedback modal, withdraw modal.
- Visual snapshot tests for new pages: recruiter interview detail, candidate interview detail, venue templates settings.
- Conflict warning chip rendering.
- Realtime event handling: simulated socket message flips UI state.

### Cron

- Time-mocked vitest specs (existing pattern in `interview-feedback-due.cron.spec.ts`):
  - autocomplete picks up overdue rows.
  - autocomplete leaves not-yet-overdue rows alone.
  - autocomplete is idempotent (running twice doesn't double-flip).
  - autocomplete handles 200-row batch limit gracefully.

## Migration & Rollout

1. **Schema migration** (single SQL file):
   - ALTER `interviews` adding new columns (all nullable or with default).
   - CREATE TABLE `interview_venues` + RLS.
   - ALTER enum `interview_status` add `rescheduled`.
   - Backfill: `UPDATE interviews SET address_line = location_or_link WHERE address_line = '' AND location_or_link IS NOT NULL`.
   - CREATE INDEXES.
2. **Backend deploy** with feature gate `INTERVIEW_FLOW_V2_ENABLED` (default true in dev, false in prod until UI lands).
3. **Web deploy** with the new pages and modals; gate the new UI behind the same flag.
4. **Notification preferences seeding** for new event types (defaults set at insert; no migration needed for existing users - the preferences module reads default-on for unset keys).
5. **Cron registration** in `cron.module.ts` for `InterviewAutocompleteCron`.
6. **Audit action enum** updated in `audit.types.ts`.
7. Flip flag to true. Old `location_or_link` field continues to read for legacy interviews.
8. Two weeks later: drop `location_or_link` column in a follow-up migration.

No data loss. No downtime required (additive schema changes; backfill is idempotent).
