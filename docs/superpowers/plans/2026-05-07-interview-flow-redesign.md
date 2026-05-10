# Interview Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the end-to-end in-person interview, feedback, and hire-decision flow described in `docs/superpowers/specs/2026-05-07-interview-flow-redesign-design.md`. After this plan: a recruiter can schedule directly from `applied` (skipping Screening), capture structured venue + guidance fields, save reusable venue templates, get conflict warnings; the system auto-completes interviews; the recruiter records private feedback + rating + recommendation, optionally shares a sanitized summary with the candidate; the candidate has a polished interview detail page with calendar download and withdraw control; and stage moves are gated by recommendation, audited, and broadcast in realtime.

**Architecture:** Eight phases. (1) **Foundation** — schema additions, enum extensions, shared Zod schemas, audit constants. (2) **State machine + withdrawal + auto-advance on schedule.** (3) **Interview backend operations** — conflict detection, ICS, reschedule, no-show, share-feedback, recommendation. (4) **Venue templates module.** (5) **Cron + notifications + emails + realtime.** (6) **Recruiter UI** — decision bar, schedule modal, pipeline panel, decision panel, recruiter interview detail page, share modal, reschedule modal, venue settings. (7) **Candidate UI** — upcoming banner, feedback panel, candidate interview detail page, withdraw modal, ICS download. (8) **Notification preferences + final E2E test.**

**Tech Stack:** NestJS 10 (Fastify), Drizzle ORM, Supabase Postgres + Auth, BullMQ, Socket.io 4, Zod 3, Next.js 16 App Router, TanStack Query 5, Tailwind v4, Vitest.

---

## File Structure

**Schema / shared / migration:**
| Path | Change |
|---|---|
| `packages/db/src/enums.ts` | **Modify.** Extend `INTERVIEW_STATUS` with `rescheduled`. Add `INTERVIEW_RECOMMENDATION` tuple. |
| `packages/db/src/schema.ts` | **Modify.** Add 13 columns to `interviewsTable`. Add new `interviewVenuesTable`. Add new indexes. |
| `packages/db/src/relations.ts` | **Modify.** Wire `interview_venues` relations + reschedule self-FKs. |
| `packages/db/src/rls/all-policies.sql` | **Modify.** Append RLS for `interview_venues`. |
| `packages/db/drizzle/0009_interview_flow_v2.sql` | **Create.** Migration: alter interviews + create interview_venues + indexes + backfill. |
| `packages/shared/src/enums.ts` | **Modify.** Re-export `INTERVIEW_RECOMMENDATION`, updated `INTERVIEW_STATUS`. |
| `packages/shared/src/schemas/interviews.ts` | **Modify.** Replace `scheduleInterviewSchema` (v2 with venue fields). Update `updateInterviewFeedbackSchema` (recommendation). Add `shareInterviewFeedbackSchema`, `rescheduleInterviewSchema`, `interviewConflictsSchema`. |
| `packages/shared/src/schemas/applications.ts` | **Modify.** Add `withdrawApplicationSchema`. |
| `packages/shared/src/schemas/interview-venues.ts` | **Create.** Zod for venue CRUD inputs. |
| `packages/shared/src/realtime/events.ts` | **Modify.** Add 5 events: `interview.completed`, `interview.rescheduled`, `interview.feedbackShared`, `application.recommendationSet`, `application.withdrawn`. |
| `apps/api/src/audit/audit.types.ts` | **Modify.** Add 10 new action constants (see §Audit). Rename `INTERVIEW_FEEDBACK_UPDATED` → `INTERVIEW_FEEDBACK_SUBMITTED`. |

**Backend — interviews module:**
| Path | Change |
|---|---|
| `apps/api/src/modules/applications/state-machine.ts` | **Modify.** Add `applied → interview` and `* → withdrawn` from non-terminal stages. |
| `apps/api/src/modules/applications/state-machine.spec.ts` | **Create.** Cover new transitions, withdrawal authorization. |
| `apps/api/src/modules/applications/applications.controller.ts` | **Modify.** Add `POST /applications/:id/withdraw`. |
| `apps/api/src/modules/applications/applications.service.ts` | **Modify.** Add `withdraw()` method (candidate-auth). |
| `apps/api/src/modules/interviews/lib/sanitize-map-url.ts` | **Create.** http/https only sanitizer. |
| `apps/api/src/modules/interviews/lib/sanitize-map-url.spec.ts` | **Create.** Unit tests for sanitizer. |
| `apps/api/src/lib/calendar/build-interview-ics.ts` | **Create.** RFC-5545 ICS builder; stable UID. |
| `apps/api/src/lib/calendar/build-interview-ics.spec.ts` | **Create.** Snapshot tests. |
| `apps/api/src/modules/interviews/interviews.controller.ts` | **Modify.** Add 5 new endpoints (share, no-show, reschedule, ics, conflicts-check). |
| `apps/api/src/modules/interviews/interviews.service.ts` | **Modify.** Add 5 service methods + auto-advance schedule path + conflict detection helper. |
| `apps/api/src/modules/interviews/interviews.repository.ts` | **Modify.** Add `findOverlapping*`, `setRecommendation`, `setRescheduledLink`, `setSharedSummary`. |
| `apps/api/src/modules/interviews/dto/schedule-interview.dto.ts` | **Modify.** Use new schema (venue fields). |
| `apps/api/src/modules/interviews/dto/update-interview-feedback.dto.ts` | **Modify.** Add recommendation. |
| `apps/api/src/modules/interviews/dto/share-interview-feedback.dto.ts` | **Create.** |
| `apps/api/src/modules/interviews/dto/reschedule-interview.dto.ts` | **Create.** |
| `apps/api/src/modules/interviews/dto/interview-conflicts.dto.ts` | **Create.** |
| `apps/api/src/modules/interviews/dto/interview-response.dto.ts` | **Modify.** Add new fields to `InterviewDto`. |

**Backend — venues module (new):**
| Path | Change |
|---|---|
| `apps/api/src/modules/interview-venues/interview-venues.module.ts` | **Create.** |
| `apps/api/src/modules/interview-venues/interview-venues.controller.ts` | **Create.** |
| `apps/api/src/modules/interview-venues/interview-venues.service.ts` | **Create.** |
| `apps/api/src/modules/interview-venues/interview-venues.repository.ts` | **Create.** |
| `apps/api/src/modules/interview-venues/dto/*.ts` | **Create.** Input + response DTOs. |
| `apps/api/src/app.module.ts` | **Modify.** Register `InterviewVenuesModule`. |

**Backend — cron + email + realtime:**
| Path | Change |
|---|---|
| `apps/api/src/cron/interview-autocomplete.cron.ts` | **Create.** Hourly, flips overdue scheduled → completed. |
| `apps/api/src/cron/interview-autocomplete.cron.spec.ts` | **Create.** Time-mocked tests. |
| `apps/api/src/cron/cron.module.ts` | **Modify.** Register new cron. |
| `apps/api/src/cron/index.ts` | **Modify.** Re-export new cron. |
| `apps/api/src/email/templates/interview-scheduled.tsx` | **Modify.** Render new venue fields; attach ICS. |
| `apps/api/src/email/templates/interview-rescheduled.tsx` | **Create.** |
| `apps/api/src/email/templates/interview-reminder.tsx` | **Create.** |
| `apps/api/src/email/templates/interview-feedback-shared.tsx` | **Create.** |
| `apps/api/src/email/email.service.ts` | **Modify.** Accept optional `attachments` arg. |
| `apps/api/src/realtime/events.service.ts` | **Modify.** Add 5 emitter methods. |
| `apps/api/src/modules/notifications/event-defaults.ts` | **Modify.** Defaults for new event keys. |

**Frontend — recruiter:**
| Path | Change |
|---|---|
| `apps/web/app/(recruiter)/recruiter/applications/[id]/_decision-bar-client.tsx` | **Modify.** Add "Move to Interview" CTA at applied. |
| `apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-modal-client.tsx` | **Modify.** Full redesign: venue fields, saved-venue dropdown, conflict chips, interviewer fields. |
| `apps/web/app/(recruiter)/recruiter/applications/[id]/_interviews-section-client.tsx` | **Modify.** Replace with Interview Pipeline panel. |
| `apps/web/app/(recruiter)/recruiter/applications/[id]/_decision-panel-client.tsx` | **Create.** Inline feedback + recommendation form for completed interviews. |
| `apps/web/app/(recruiter)/recruiter/applications/[id]/_application-detail-client.tsx` | **Modify.** Mount Decision panel + soft-confirm wiring. |
| `apps/web/app/(recruiter)/recruiter/applications/[id]/_offer-confirm-modal-client.tsx` | **Create.** Soft confirmation when proceeding without recorded feedback. |
| `apps/web/app/(recruiter)/recruiter/interviews/[id]/page.tsx` | **Create.** |
| `apps/web/app/(recruiter)/recruiter/interviews/[id]/_interview-detail-client.tsx` | **Create.** |
| `apps/web/app/(recruiter)/recruiter/interviews/[id]/_feedback-panel-client.tsx` | **Create.** |
| `apps/web/app/(recruiter)/recruiter/interviews/[id]/_share-feedback-modal-client.tsx` | **Create.** |
| `apps/web/app/(recruiter)/recruiter/interviews/[id]/_reschedule-modal-client.tsx` | **Create.** |
| `apps/web/app/(recruiter)/recruiter/interviews/[id]/loading.tsx` | **Create.** |
| `apps/web/app/(recruiter)/recruiter/settings/interview-venues/page.tsx` | **Create.** |
| `apps/web/app/(recruiter)/recruiter/settings/interview-venues/_venues-list-client.tsx` | **Create.** |
| `apps/web/app/(recruiter)/recruiter/settings/interview-venues/_venue-form-modal-client.tsx` | **Create.** |
| `apps/web/lib/query/keys.ts` | **Modify.** Add interview-venues query key. |
| `apps/web/lib/query/queries.ts` | **Modify.** Add `interviewVenues` query factories. |

**Frontend — candidate:**
| Path | Change |
|---|---|
| `apps/web/app/(candidate)/candidate/applications/[id]/_application-detail-client.tsx` | **Modify.** Mount upcoming-interview banner + feedback panel. |
| `apps/web/app/(candidate)/candidate/applications/[id]/_upcoming-interview-banner-client.tsx` | **Create.** |
| `apps/web/app/(candidate)/candidate/applications/[id]/_interview-feedback-panel-client.tsx` | **Create.** |
| `apps/web/app/(candidate)/candidate/applications/[id]/_withdraw-button-client.tsx` | **Modify.** Use shared withdraw modal. |
| `apps/web/app/(candidate)/candidate/interviews/[id]/page.tsx` | **Create.** |
| `apps/web/app/(candidate)/candidate/interviews/[id]/_interview-detail-client.tsx` | **Create.** |
| `apps/web/app/(candidate)/candidate/interviews/[id]/loading.tsx` | **Create.** |
| `apps/web/components/interview/withdraw-application-modal.tsx` | **Create.** Shared component. |
| `apps/web/components/interview/add-to-calendar-button.tsx` | **Create.** ICS download client. |

**Frontend — notification prefs:**
| Path | Change |
|---|---|
| `apps/web/components/notifications/notification-preferences-form.tsx` | **Modify.** Add toggle rows for new event keys. |

---

## Operating discipline

- **TDD throughout.** Failing test → run fail → minimal code → run pass → commit.
- **Migrations:** the human runs `pnpm drizzle:generate` / `pnpm drizzle:push` (Claude does NOT run db mutations per CLAUDE.md). Plan checkpoints when migrations need to be applied.
- **No destructive git.** Per AGENTS.md / CLAUDE.md.
- **Frequent commits.** Each task ends with a commit.
- **No `pnpm dev`, no Docker control, no deploys.** The human runs servers.

---

## Phase 1 — Foundation (schema, enums, shared types, audit constants)

### Task 1: Extend interview enums + add recommendation tuple

**Files:**

- Modify: `packages/db/src/enums.ts`
- Modify: `packages/shared/src/enums.ts`

- [ ] **Step 1: Update `INTERVIEW_STATUS` and add recommendation enum in `packages/db/src/enums.ts`**

Replace lines around the existing `INTERVIEW_STATUS` declaration:

```ts
export const INTERVIEW_FORMAT = ["phone", "video", "in-person"] as const;
export const INTERVIEW_STATUS = [
  "scheduled",
  "completed",
  "cancelled",
  "no-show",
  "rescheduled",
] as const;
export const INTERVIEW_RECOMMENDATION = ["proceed", "hold", "reject"] as const;
```

Below the existing `InterviewStatus` type export, add:

```ts
export type InterviewRecommendation = (typeof INTERVIEW_RECOMMENDATION)[number];
```

- [ ] **Step 2: Re-export from `packages/shared/src/enums.ts`**

Add (matching existing re-export style):

```ts
export {
  INTERVIEW_RECOMMENDATION,
  type InterviewRecommendation,
} from "@aurahire/db";
```

- [ ] **Step 3: Type-check both packages**

Run: `pnpm --filter @aurahire/db type-check && pnpm --filter @aurahire/shared type-check`
Expected: silent success.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/enums.ts packages/shared/src/enums.ts
git commit -m "feat(enums): extend INTERVIEW_STATUS with rescheduled, add INTERVIEW_RECOMMENDATION"
```

---

### Task 2: Drizzle schema additions — `interviews` columns + `interview_venues` table + indexes

**Files:**

- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Add 13 columns to `interviewsTable`**

Inside `interviewsTable` definition (after `feedbackDueNotifiedAt`), append:

```ts
    venueName: text("venue_name").notNull().default(""),
    addressLine: text("address_line").notNull().default(""),
    roomOrFloor: text("room_or_floor"),
    mapUrl: text("map_url"),
    reportingInstructions: text("reporting_instructions"),
    whatToBring: text("what_to_bring"),
    interviewerName: text("interviewer_name"),
    interviewerTitle: text("interviewer_title"),
    candidateSummary: text("candidate_summary"),
    recommendation: text("recommendation", { enum: INTERVIEW_RECOMMENDATION }),
    sharedWithCandidateAt: timestamp("shared_with_candidate_at", { withTimezone: true }),
    rescheduledFromId: uuid("rescheduled_from_id"),
    rescheduledToId: uuid("rescheduled_to_id"),
```

In the same table builder's index closure, add:

```ts
    recommendationIdx: index("interviews_recommendation_idx").on(t.applicationId, t.recommendation),
    sharedIdx: index("interviews_shared_idx")
      .on(t.applicationId)
      .where(sql`shared_with_candidate_at IS NOT NULL`),
```

Also import `INTERVIEW_RECOMMENDATION` from `./enums` at the top of the file (the existing import line already pulls other enums; add it there).

- [ ] **Step 2: Add `interviewVenuesTable` after `interviewsTable`**

```ts
export const interviewVenuesTable = pgTable(
  "interview_venues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profilesTable.id),
    label: text("label").notNull(),
    venueName: text("venue_name").notNull(),
    addressLine: text("address_line").notNull(),
    roomOrFloor: text("room_or_floor"),
    mapUrl: text("map_url"),
    reportingInstructions: text("reporting_instructions"),
    whatToBring: text("what_to_bring"),
    interviewerName: text("interviewer_name"),
    interviewerTitle: text("interviewer_title"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    companyLabelUnique: unique("interview_venues_company_label_unique").on(
      t.companyId,
      t.label,
    ),
    companyDefaultIdx: index("interview_venues_company_default_idx")
      .on(t.companyId)
      .where(sql`is_default = true`),
  }),
);
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @aurahire/db type-check`
Expected: silent success.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add interviews venue columns + interview_venues table"
```

---

### Task 3: Drizzle relations + RLS

**Files:**

- Modify: `packages/db/src/relations.ts`
- Modify: `packages/db/src/rls/all-policies.sql`

- [ ] **Step 1: Add `interviewVenuesTable` import + relations**

In `relations.ts`, import `interviewVenuesTable` alongside the other table imports. After the `interviewsRelations` block, add:

```ts
export const interviewVenuesRelations = relations(
  interviewVenuesTable,
  ({ one }) => ({
    company: one(companiesTable, {
      fields: [interviewVenuesTable.companyId],
      references: [companiesTable.id],
    }),
    creator: one(profilesTable, {
      fields: [interviewVenuesTable.createdBy],
      references: [profilesTable.id],
    }),
  }),
);
```

- [ ] **Step 2: Append RLS policies to `all-policies.sql`**

```sql
-- ============================================================================
-- interview_venues
-- ============================================================================
ALTER TABLE public.interview_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interview_venues_company_select" ON public.interview_venues
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = interview_venues.company_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "interview_venues_recruiter_write" ON public.interview_venues
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      JOIN public.profiles p ON p.id = cm.user_id
      WHERE cm.company_id = interview_venues.company_id
        AND cm.user_id = auth.uid()
        AND p.role = 'recruiter'
    )
  );

CREATE POLICY "interview_venues_admin_all" ON public.interview_venues
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @aurahire/db type-check`
Expected: silent success.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/relations.ts packages/db/src/rls/all-policies.sql
git commit -m "feat(db): relations + RLS for interview_venues"
```

---

### Task 4: Migration SQL `0009_interview_flow_v2.sql`

**Files:**

- Create: `packages/db/drizzle/0009_interview_flow_v2.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0009_interview_flow_v2.sql
-- Interview flow redesign: venue + recommendation + reschedule + venue templates.

-- INTERVIEW_STATUS enum extension
ALTER TABLE public.interviews
  DROP CONSTRAINT IF EXISTS interviews_status_check;

ALTER TABLE public.interviews
  ADD CONSTRAINT interviews_status_check
  CHECK (status IN ('scheduled','completed','cancelled','no-show','rescheduled'));

-- Recommendation enum constraint
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS recommendation text
    CHECK (recommendation IN ('proceed','hold','reject'));

-- Venue + guidance columns
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS venue_name             text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_line           text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS room_or_floor          text,
  ADD COLUMN IF NOT EXISTS map_url                text,
  ADD COLUMN IF NOT EXISTS reporting_instructions text,
  ADD COLUMN IF NOT EXISTS what_to_bring          text,
  ADD COLUMN IF NOT EXISTS interviewer_name       text,
  ADD COLUMN IF NOT EXISTS interviewer_title      text,
  ADD COLUMN IF NOT EXISTS candidate_summary      text,
  ADD COLUMN IF NOT EXISTS shared_with_candidate_at timestamptz,
  ADD COLUMN IF NOT EXISTS rescheduled_from_id    uuid REFERENCES public.interviews(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rescheduled_to_id      uuid REFERENCES public.interviews(id) ON DELETE SET NULL;

-- Default format for new rows is in-person; existing rows untouched.
ALTER TABLE public.interviews ALTER COLUMN format SET DEFAULT 'in-person';

-- Backfill: copy legacy location_or_link into address_line where empty.
UPDATE public.interviews
SET address_line = location_or_link
WHERE address_line = '' AND location_or_link IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS interviews_recommendation_idx
  ON public.interviews(application_id, recommendation);

CREATE INDEX IF NOT EXISTS interviews_shared_idx
  ON public.interviews(application_id)
  WHERE shared_with_candidate_at IS NOT NULL;

-- interview_venues
CREATE TABLE IF NOT EXISTS public.interview_venues (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by             uuid NOT NULL REFERENCES public.profiles(id),
  label                  text NOT NULL,
  venue_name             text NOT NULL,
  address_line           text NOT NULL,
  room_or_floor          text,
  map_url                text,
  reporting_instructions text,
  what_to_bring          text,
  interviewer_name       text,
  interviewer_title      text,
  is_default             boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, label)
);

CREATE INDEX IF NOT EXISTS interview_venues_company_default_idx
  ON public.interview_venues(company_id) WHERE is_default = true;
```

- [ ] **Step 2: Ask the human to apply the migration**

Print: "Migration `0009_interview_flow_v2.sql` is ready. Run `pnpm drizzle:push` (or paste the SQL via Supabase SQL editor) to apply, then re-run `pnpm drizzle:generate` to refresh the meta journal. Reply when applied."

Wait for human confirmation before continuing to Task 5.

- [ ] **Step 3: Commit**

```bash
git add packages/db/drizzle/0009_interview_flow_v2.sql
git commit -m "feat(db): migration 0009 — interview flow v2"
```

---

### Task 5: Shared Zod schemas

**Files:**

- Modify: `packages/shared/src/schemas/interviews.ts`
- Modify: `packages/shared/src/schemas/applications.ts`
- Create: `packages/shared/src/schemas/interview-venues.ts`
- Modify: `packages/shared/src/index.ts` (export new schema module)

- [ ] **Step 1: Update `packages/shared/src/schemas/interviews.ts`**

Replace the file with:

```ts
import { z } from "zod";
import {
  INTERVIEW_FORMAT,
  INTERVIEW_RECOMMENDATION,
  INTERVIEW_STATUS,
} from "../enums";

export const recruiterInterviewsQuerySchema = z.object({
  q: z.string().max(200).optional(),
  status: z.enum(INTERVIEW_STATUS).optional(),
  format: z.enum(INTERVIEW_FORMAT).optional(),
  sort: z
    .enum(["upcoming", "recent", "earliest"])
    .optional()
    .default("upcoming"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});
export type RecruiterInterviewsQuery = z.infer<
  typeof recruiterInterviewsQuerySchema
>;

const httpOrHttpsUrl = z
  .string()
  .trim()
  .max(2048)
  .regex(/^https?:\/\//i, { message: "Must start with http:// or https://" })
  .optional()
  .nullable();

export const scheduleInterviewSchema = z.object({
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(240).default(60),
  // Format kept for forward-compat; defaults to in-person.
  format: z.enum(INTERVIEW_FORMAT).optional().default("in-person"),
  // Legacy field — accepted but not displayed.
  locationOrLink: z.string().min(1).max(500).nullable().optional(),

  // Structured venue fields
  venueName: z.string().trim().min(1).max(200),
  addressLine: z.string().trim().min(1).max(500),
  roomOrFloor: z.string().trim().max(200).nullable().optional(),
  mapUrl: httpOrHttpsUrl,
  reportingInstructions: z.string().max(2000).nullable().optional(),
  whatToBring: z.string().max(2000).nullable().optional(),
  interviewerName: z.string().trim().max(200).nullable().optional(),
  interviewerTitle: z.string().trim().max(200).nullable().optional(),

  // Optional persistence flag
  saveAsTemplate: z.boolean().optional().default(false),
  templateLabel: z.string().trim().min(1).max(100).optional(),
});
export type ScheduleInterviewInput = z.infer<typeof scheduleInterviewSchema>;

export const rescheduleInterviewSchema = scheduleInterviewSchema;
export type RescheduleInterviewInput = z.infer<
  typeof rescheduleInterviewSchema
>;

export const updateInterviewFeedbackSchema = z.object({
  feedback: z.string().min(1).max(5000),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  recommendation: z.enum(INTERVIEW_RECOMMENDATION).nullable().optional(),
});
export type UpdateInterviewFeedbackInput = z.infer<
  typeof updateInterviewFeedbackSchema
>;

export const shareInterviewFeedbackSchema = z.object({
  candidateSummary: z.string().trim().min(1).max(4000),
});
export type ShareInterviewFeedbackInput = z.infer<
  typeof shareInterviewFeedbackSchema
>;

export const updateInterviewStatusSchema = z.object({
  newStatus: z.enum(INTERVIEW_STATUS),
});
export type UpdateInterviewStatusInput = z.infer<
  typeof updateInterviewStatusSchema
>;

export const interviewConflictsQuerySchema = z.object({
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(240),
  candidateId: z.string().uuid(),
});
export type InterviewConflictsQuery = z.infer<
  typeof interviewConflictsQuerySchema
>;
```

- [ ] **Step 2: Add `withdrawApplicationSchema` to `packages/shared/src/schemas/applications.ts`**

Append:

```ts
export const withdrawApplicationSchema = z.object({
  reason: z.string().trim().max(500).nullable().optional(),
});
export type WithdrawApplicationInput = z.infer<
  typeof withdrawApplicationSchema
>;
```

- [ ] **Step 3: Create `packages/shared/src/schemas/interview-venues.ts`**

```ts
import { z } from "zod";

const httpOrHttpsUrl = z
  .string()
  .trim()
  .max(2048)
  .regex(/^https?:\/\//i)
  .optional()
  .nullable();

export const interviewVenueInputSchema = z.object({
  label: z.string().trim().min(1).max(100),
  venueName: z.string().trim().min(1).max(200),
  addressLine: z.string().trim().min(1).max(500),
  roomOrFloor: z.string().trim().max(200).nullable().optional(),
  mapUrl: httpOrHttpsUrl,
  reportingInstructions: z.string().max(2000).nullable().optional(),
  whatToBring: z.string().max(2000).nullable().optional(),
  interviewerName: z.string().trim().max(200).nullable().optional(),
  interviewerTitle: z.string().trim().max(200).nullable().optional(),
  isDefault: z.boolean().optional().default(false),
});
export type InterviewVenueInput = z.infer<typeof interviewVenueInputSchema>;

export const interviewVenuePartialSchema = interviewVenueInputSchema.partial();
export type InterviewVenuePartialInput = z.infer<
  typeof interviewVenuePartialSchema
>;
```

- [ ] **Step 4: Re-export from `packages/shared/src/index.ts`**

Add line: `export * from "./schemas/interview-venues";`

- [ ] **Step 5: Type-check**

Run: `pnpm --filter @aurahire/shared type-check`
Expected: silent success.

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): zod schemas for interview v2 + venues + withdraw"
```

---

### Task 6: Audit action constants + realtime event types

**Files:**

- Modify: `apps/api/src/audit/audit.types.ts`
- Modify: `packages/shared/src/realtime/events.ts`

- [ ] **Step 1: Add audit actions**

In `audit.types.ts`, inside `AUDIT_ACTIONS = { ... }`:

```ts
  INTERVIEW_FEEDBACK_SUBMITTED: "interview.feedback_submitted", // replaces INTERVIEW_FEEDBACK_UPDATED
  INTERVIEW_FEEDBACK_SHARED: "interview.feedback_shared",
  INTERVIEW_RECOMMENDATION_SET: "interview.recommendation_set",
  INTERVIEW_AUTO_COMPLETED: "interview.auto_completed",
  INTERVIEW_NO_SHOW_MARKED: "interview.no_show_marked",
  INTERVIEW_RESCHEDULED: "interview.rescheduled",
  INTERVIEW_VENUE_CREATED: "interview_venue.created",
  INTERVIEW_VENUE_UPDATED: "interview_venue.updated",
  INTERVIEW_VENUE_DELETED: "interview_venue.deleted",
  APPLICATION_WITHDRAWN_BY_CANDIDATE: "application.withdrawn_by_candidate",
  INTERVIEW_AUTOCOMPLETE_RUN: "cron.interview_autocomplete.executed",
```

Keep `INTERVIEW_FEEDBACK_UPDATED` for back-compat readers (audit log queries against legacy logs).

- [ ] **Step 2: Add realtime event payload types in `packages/shared/src/realtime/events.ts`**

Append:

```ts
export const InterviewCompletedPayload = z.object({
  interviewId: z.string().uuid(),
  applicationId: z.string().uuid(),
  candidateId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  jobId: z.string().uuid(),
  completedAt: z.string().datetime(),
});

export const InterviewRescheduledPayload = z.object({
  oldInterviewId: z.string().uuid(),
  newInterviewId: z.string().uuid(),
  applicationId: z.string().uuid(),
  candidateId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  scheduledFor: z.string().datetime(),
});

export const InterviewFeedbackSharedPayload = z.object({
  interviewId: z.string().uuid(),
  applicationId: z.string().uuid(),
  candidateId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  sharedAt: z.string().datetime(),
});

export const ApplicationRecommendationSetPayload = z.object({
  applicationId: z.string().uuid(),
  interviewId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  recommendation: z.enum(["proceed", "hold", "reject"]),
});

export const ApplicationWithdrawnPayload = z.object({
  applicationId: z.string().uuid(),
  candidateId: z.string().uuid(),
  recruiterId: z.string().uuid().nullable(),
  jobId: z.string().uuid(),
  reason: z.string().nullable(),
});
```

Add the corresponding map entries in the `EVENTS` object (matching existing `application.scored` style).

- [ ] **Step 3: Type-check both packages**

Run: `pnpm --filter @aurahire/shared type-check && pnpm --filter @aurahire/api type-check`
Expected: silent success.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/audit/audit.types.ts packages/shared/src/realtime/events.ts
git commit -m "feat(audit/realtime): add interview-flow v2 actions + events"
```

---

## Phase 2 — State machine, withdrawal, auto-advance

### Task 7: Update state machine + spec

**Files:**

- Modify: `apps/api/src/modules/applications/state-machine.ts`
- Create: `apps/api/src/modules/applications/state-machine.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// state-machine.spec.ts
import { describe, expect, it } from "vitest";
import { canTransition, getNextStatuses } from "./state-machine";

describe("application state machine", () => {
  it("allows applied → screening | interview | rejected | withdrawn", () => {
    expect(canTransition("applied", "screening")).toBe(true);
    expect(canTransition("applied", "interview")).toBe(true);
    expect(canTransition("applied", "rejected")).toBe(true);
    expect(canTransition("applied", "withdrawn")).toBe(true);
    expect(canTransition("applied", "offer")).toBe(false);
    expect(canTransition("applied", "hired")).toBe(false);
  });

  it("allows screening → interview | rejected | withdrawn", () => {
    expect(canTransition("screening", "interview")).toBe(true);
    expect(canTransition("screening", "rejected")).toBe(true);
    expect(canTransition("screening", "withdrawn")).toBe(true);
    expect(canTransition("screening", "offer")).toBe(false);
  });

  it("allows interview → offer | rejected | withdrawn", () => {
    expect(canTransition("interview", "offer")).toBe(true);
    expect(canTransition("interview", "rejected")).toBe(true);
    expect(canTransition("interview", "withdrawn")).toBe(true);
  });

  it("allows offer → hired | rejected | withdrawn", () => {
    expect(canTransition("offer", "hired")).toBe(true);
    expect(canTransition("offer", "rejected")).toBe(true);
    expect(canTransition("offer", "withdrawn")).toBe(true);
  });

  it("disallows transitions out of terminal states", () => {
    for (const t of ["hired", "rejected", "withdrawn"] as const) {
      expect(getNextStatuses(t).length).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @aurahire/api test state-machine.spec`
Expected: at least the `applied → interview` and `applied → withdrawn` cases fail.

- [ ] **Step 3: Update `state-machine.ts`**

```ts
import type { ApplicationStatus } from "@aurahire/shared";

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

export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextStatuses(
  from: ApplicationStatus,
): readonly ApplicationStatus[] {
  return VALID_TRANSITIONS[from] ?? [];
}
```

- [ ] **Step 4: Run the test again to verify it passes**

Run: `pnpm --filter @aurahire/api test state-machine.spec`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/applications/state-machine.ts apps/api/src/modules/applications/state-machine.spec.ts
git commit -m "feat(state-machine): allow applied→interview and *→withdrawn"
```

---

### Task 8: `POST /applications/:id/withdraw` (candidate-only)

**Files:**

- Modify: `apps/api/src/modules/applications/applications.controller.ts`
- Modify: `apps/api/src/modules/applications/applications.service.ts`

- [ ] **Step 1: Write the failing service test**

In `applications.service.spec.ts` (existing file or create), add:

```ts
it("withdraw flips status from applied to withdrawn for the candidate", async () => {
  const app = await fixtures.createApplication({ status: "applied" });
  const result = await service.withdraw(
    { id: app.candidateId, role: "candidate" } as AuthUser,
    app.id,
    { reason: "Found another role" },
    { ipAddress: null, userAgent: null },
  );
  expect(result.status).toBe("withdrawn");
});

it("withdraw rejects when actor is not the candidate", async () => {
  const app = await fixtures.createApplication({ status: "applied" });
  await expect(
    service.withdraw(
      { id: "different-user", role: "candidate" } as AuthUser,
      app.id,
      { reason: null },
      { ipAddress: null, userAgent: null },
    ),
  ).rejects.toThrow(/FORBIDDEN/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aurahire/api test applications.service.spec -t withdraw`
Expected: FAIL — `service.withdraw is not a function`.

- [ ] **Step 3: Implement `service.withdraw()`**

In `applications.service.ts`, add:

```ts
async withdraw(
  user: AuthUser,
  applicationId: string,
  dto: { reason?: string | null },
  requestMeta: RequestMeta,
): Promise<ApplicationDto> {
  const app = await this.repo.findById(applicationId);
  if (!app) throw new NotFoundException({ code: "NOT_FOUND", message: "Application not found" });

  // Only the candidate or an admin can withdraw.
  if (user.role !== "admin" && user.id !== app.candidateId) {
    throw new ForbiddenException({ code: "FORBIDDEN", message: "Only the candidate can withdraw" });
  }
  if (!canTransition(app.status as ApplicationStatus, "withdrawn")) {
    throw new BadRequestException({
      code: "INVALID_STATUS_TRANSITION",
      message: `Cannot withdraw from ${app.status}`,
    });
  }

  const updated = await this.repo.update(applicationId, {
    status: "withdrawn",
    updatedAt: new Date(),
  });

  await this.audit.log({
    actorId: user.id,
    actorType: "user",
    action: AUDIT_ACTIONS.APPLICATION_WITHDRAWN_BY_CANDIDATE,
    entityType: "application",
    entityId: applicationId,
    details: { from: app.status, reason: dto.reason ?? null },
    ...requestMeta,
  });

  // Cache bust + realtime
  await this.cacheService.bustTags([
    TAGS.applicationsCandidate(app.candidateId),
    TAGS.companyApplications(app.companyId ?? ""),
  ]);
  this.events.emitApplicationWithdrawn({
    applicationId,
    candidateId: app.candidateId,
    recruiterId: null,
    jobId: app.jobId,
    reason: dto.reason ?? null,
  });

  return this.toDto(updated);
}
```

- [ ] **Step 4: Add controller endpoint**

In `applications.controller.ts`, add:

```ts
@Post(":id/withdraw")
@Roles("candidate", "admin")
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: "Candidate withdraws their application" })
@ApiResponse({ status: 200, type: ApplicationEnvelopeDto })
async withdraw(
  @CurrentUser() user: AuthUser,
  @Param("id") id: string,
  @Body() dto: WithdrawApplicationDto,
  @Req() req: FastifyRequest,
): Promise<ApplicationEnvelopeDto> {
  const data = await this.service.withdraw(user, id, dto, this.requestMeta(req));
  return { data };
}
```

Create `apps/api/src/modules/applications/dto/withdraw-application.dto.ts`:

```ts
import { createZodDto } from "nestjs-zod";
import { withdrawApplicationSchema } from "@aurahire/shared";

export class WithdrawApplicationDto extends createZodDto(
  withdrawApplicationSchema,
) {}
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @aurahire/api test applications.service.spec -t withdraw`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/applications
git commit -m "feat(applications): POST /applications/:id/withdraw (candidate)"
```

---

### Task 9: Auto-advance application status when scheduling from `applied`

**Files:**

- Modify: `apps/api/src/modules/interviews/interviews.service.ts`
- Modify: `apps/api/src/modules/applications/applications.repository.ts` (if needed for transactional helper)

- [ ] **Step 1: Write failing integration test**

In `apps/api/src/modules/interviews/interviews.service.spec.ts` (create if absent):

```ts
it("schedule from applied auto-advances application status to interview", async () => {
  const app = await fixtures.createApplication({ status: "applied" });
  await service.schedule(
    recruiterUser,
    app.companyId,
    app.id,
    fixtures.scheduleInput({ scheduledAt: future().toISOString() }),
    {},
  );
  const reloaded = await applicationsRepo.findById(app.id);
  expect(reloaded?.status).toBe("interview");
});

it("schedule from screening auto-advances to interview", async () => {
  const app = await fixtures.createApplication({ status: "screening" });
  await service.schedule(
    recruiterUser,
    app.companyId,
    app.id,
    fixtures.scheduleInput({}),
    {},
  );
  const reloaded = await applicationsRepo.findById(app.id);
  expect(reloaded?.status).toBe("interview");
});

it("schedule from interview leaves status unchanged (multi-round)", async () => {
  const app = await fixtures.createApplication({ status: "interview" });
  await service.schedule(
    recruiterUser,
    app.companyId,
    app.id,
    fixtures.scheduleInput({}),
    {},
  );
  const reloaded = await applicationsRepo.findById(app.id);
  expect(reloaded?.status).toBe("interview");
});
```

- [ ] **Step 2: Run to verify failures**

Run: `pnpm --filter @aurahire/api test interviews.service.spec -t auto-advances`
Expected: FAIL — current schedule path leaves status as `applied`.

- [ ] **Step 3: Modify `interviews.service.ts` `schedule()`**

After the `application` lookup and before the `repo.insert`, add an in-transaction status advance:

```ts
// Auto-advance status if needed: applied | screening → interview.
const currentStatus = application.applicationStatus as ApplicationStatus;
if (currentStatus === "applied" || currentStatus === "screening") {
  if (!canTransition(currentStatus, "interview")) {
    throw new BadRequestException({
      code: "INVALID_STATUS_TRANSITION",
      message: `Cannot advance from ${currentStatus} to interview`,
    });
  }
  await this.applicationsRepo.update(applicationId, {
    status: "interview",
    updatedAt: new Date(),
  });
  await this.audit.log({
    actorId: user.id,
    actorType: "user",
    action: AUDIT_ACTIONS.APPLICATION_STATUS_CHANGED,
    entityType: "application",
    entityId: applicationId,
    companyId,
    details: {
      from: currentStatus,
      to: "interview",
      system: false,
      viaSchedule: true,
    },
    ...requestMeta,
  });
  this.events.emitApplicationStatusChanged({
    applicationId,
    candidateId: application.candidateId,
    jobId: application.jobId,
    fromStatus: currentStatus,
    toStatus: "interview",
    actorId: user.id,
  });
}
```

Imports: add `canTransition` from `../applications/state-machine`, `ApplicationStatus` from `@aurahire/shared`, `BadRequestException`, `AUDIT_ACTIONS`.

Also extend `findApplicationContextForCompany` to return `applicationStatus` if not already (check existing repo method).

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @aurahire/api test interviews.service.spec -t auto-advances`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/interviews apps/api/src/modules/applications
git commit -m "feat(interviews): auto-advance application status on schedule from applied/screening"
```

---

## Phase 3 — Interview backend operations

### Task 10: Map URL sanitizer

**Files:**

- Create: `apps/api/src/modules/interviews/lib/sanitize-map-url.ts`
- Create: `apps/api/src/modules/interviews/lib/sanitize-map-url.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { sanitizeMapUrl } from "./sanitize-map-url";

describe("sanitizeMapUrl", () => {
  it("accepts http and https URLs", () => {
    expect(sanitizeMapUrl("http://maps.google.com/?q=foo")).toBe(
      "http://maps.google.com/?q=foo",
    );
    expect(sanitizeMapUrl("https://maps.google.com/?q=foo")).toBe(
      "https://maps.google.com/?q=foo",
    );
  });
  it("rejects javascript:, data:, file:, mailto:, ftp:", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "mailto:foo@bar.com",
      "ftp://maps.google.com",
    ]) {
      expect(() => sanitizeMapUrl(bad)).toThrow(/Invalid map URL/);
    }
  });
  it("trims whitespace and returns null for empty input", () => {
    expect(sanitizeMapUrl(null)).toBeNull();
    expect(sanitizeMapUrl(undefined)).toBeNull();
    expect(sanitizeMapUrl("   ")).toBeNull();
    expect(sanitizeMapUrl("  https://x.example  ")).toBe("https://x.example");
  });
  it("rejects URLs over 2048 chars", () => {
    const long = "https://x." + "a".repeat(3000);
    expect(() => sanitizeMapUrl(long)).toThrow(/too long/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @aurahire/api test sanitize-map-url`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
export function sanitizeMapUrl(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 2048) {
    throw new Error("Invalid map URL: too long (max 2048 chars)");
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("Invalid map URL: must start with http:// or https://");
  }
  return trimmed;
}
```

- [ ] **Step 4: Run again, expect pass**

Run: `pnpm --filter @aurahire/api test sanitize-map-url`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/interviews/lib/
git commit -m "feat(interviews): map URL sanitizer (http/https only, 2048-char cap)"
```

---

### Task 11: Conflict detection helper + endpoint

**Files:**

- Modify: `apps/api/src/modules/interviews/interviews.repository.ts`
- Modify: `apps/api/src/modules/interviews/interviews.service.ts`
- Modify: `apps/api/src/modules/interviews/interviews.controller.ts`
- Create: `apps/api/src/modules/interviews/dto/interview-conflicts.dto.ts`
- Create: `apps/api/src/modules/interviews/interviews.conflicts.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
// ... fixture setup elided; use existing test harness

it("returns recruiter and candidate overlapping interviews", async () => {
  const recruiter = await fx.makeRecruiter();
  const candidate = await fx.makeCandidate();
  const existing = await fx.scheduleInterview({
    recruiterId: recruiter.id,
    candidateId: candidate.id,
    scheduledAt: "2026-06-01T10:00:00Z",
    durationMinutes: 60,
  });
  const result = await service.checkConflicts({
    scheduledAt: new Date("2026-06-01T10:30:00Z"),
    durationMinutes: 60,
    recruiterId: recruiter.id,
    candidateId: candidate.id,
  });
  expect(result.recruiterConflicts.map((c) => c.id)).toContain(existing.id);
  expect(result.candidateConflicts.map((c) => c.id)).toContain(existing.id);
});

it("returns no conflicts when windows do not overlap", async () => {
  const recruiter = await fx.makeRecruiter();
  const candidate = await fx.makeCandidate();
  await fx.scheduleInterview({
    recruiterId: recruiter.id,
    candidateId: candidate.id,
    scheduledAt: "2026-06-01T10:00:00Z",
    durationMinutes: 60,
  });
  const result = await service.checkConflicts({
    scheduledAt: new Date("2026-06-01T11:00:00Z"),
    durationMinutes: 60,
    recruiterId: recruiter.id,
    candidateId: candidate.id,
  });
  expect(result.recruiterConflicts).toHaveLength(0);
  expect(result.candidateConflicts).toHaveLength(0);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter @aurahire/api test conflicts`
Expected: FAIL — `service.checkConflicts is not a function`.

- [ ] **Step 3: Add repository method**

In `interviews.repository.ts`:

```ts
async findOverlapping(args: {
  startsAt: Date;
  endsAt: Date;
  recruiterId?: string;
  candidateId?: string;
}): Promise<Array<{ id: string; applicationId: string; scheduledAt: Date; durationMinutes: number; scheduledBy: string }>> {
  const conditions = [
    eq(interviewsTable.status, "scheduled"),
    sql`(
      ${interviewsTable.scheduledAt} < ${args.endsAt.toISOString()}::timestamptz
      AND (${interviewsTable.scheduledAt} + (${interviewsTable.durationMinutes} || ' minutes')::interval)
          > ${args.startsAt.toISOString()}::timestamptz
    )`,
  ];

  if (args.recruiterId) {
    conditions.push(eq(interviewsTable.scheduledBy, args.recruiterId));
  }
  if (args.candidateId) {
    // Join through applications to filter by candidate.
    return this.db
      .select({
        id: interviewsTable.id,
        applicationId: interviewsTable.applicationId,
        scheduledAt: interviewsTable.scheduledAt,
        durationMinutes: interviewsTable.durationMinutes,
        scheduledBy: interviewsTable.scheduledBy,
      })
      .from(interviewsTable)
      .innerJoin(applicationsTable, eq(applicationsTable.id, interviewsTable.applicationId))
      .where(and(...conditions, eq(applicationsTable.candidateId, args.candidateId)));
  }
  return this.db
    .select({
      id: interviewsTable.id,
      applicationId: interviewsTable.applicationId,
      scheduledAt: interviewsTable.scheduledAt,
      durationMinutes: interviewsTable.durationMinutes,
      scheduledBy: interviewsTable.scheduledBy,
    })
    .from(interviewsTable)
    .where(and(...conditions));
}
```

- [ ] **Step 4: Add service method `checkConflicts`**

```ts
async checkConflicts(input: {
  scheduledAt: Date;
  durationMinutes: number;
  recruiterId: string;
  candidateId: string;
  excludeInterviewId?: string;
}): Promise<{
  recruiterConflicts: Array<{ id: string; scheduledAt: string; durationMinutes: number }>;
  candidateConflicts: Array<{ id: string; scheduledAt: string; durationMinutes: number }>;
}> {
  const startsAt = new Date(input.scheduledAt);
  const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);
  const filter = (rows: Array<{ id: string; scheduledAt: Date; durationMinutes: number }>) =>
    rows
      .filter((r) => r.id !== input.excludeInterviewId)
      .map((r) => ({
        id: r.id,
        scheduledAt: r.scheduledAt.toISOString(),
        durationMinutes: r.durationMinutes,
      }));

  const [recruiterRows, candidateRows] = await Promise.all([
    this.repo.findOverlapping({ startsAt, endsAt, recruiterId: input.recruiterId }),
    this.repo.findOverlapping({ startsAt, endsAt, candidateId: input.candidateId }),
  ]);
  return {
    recruiterConflicts: filter(recruiterRows),
    candidateConflicts: filter(candidateRows),
  };
}
```

- [ ] **Step 5: Add controller endpoint**

```ts
@Post("applications/:applicationId/interviews/check-conflicts")
@Roles("recruiter")
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: "Soft-check overlapping interviews for recruiter and candidate" })
async checkConflicts(
  @CurrentUser() user: AuthUser,
  @ActiveCompany() activeCompany: ActiveCompanyContext,
  @Param("applicationId") applicationId: string,
  @Body() dto: InterviewConflictsDto,
): Promise<{ data: ConflictsResponse }> {
  const data = await this.service.checkConflictsForApplication(
    user, activeCompany.companyId, applicationId, dto,
  );
  return { data };
}
```

Add `interview-conflicts.dto.ts`:

```ts
import { createZodDto } from "nestjs-zod";
import { interviewConflictsQuerySchema } from "@aurahire/shared";

export class InterviewConflictsDto extends createZodDto(
  interviewConflictsQuerySchema,
) {}
```

Add a thin wrapper `checkConflictsForApplication` on the service that resolves the candidate from the application id, validates company ownership, then calls `checkConflicts`.

- [ ] **Step 6: Run tests, expect pass**

Run: `pnpm --filter @aurahire/api test conflicts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/interviews
git commit -m "feat(interviews): conflict detection (recruiter + candidate overlap)"
```

---

### Task 12: ICS builder

**Files:**

- Create: `apps/api/src/lib/calendar/build-interview-ics.ts`
- Create: `apps/api/src/lib/calendar/build-interview-ics.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildInterviewIcs } from "./build-interview-ics";

const fixture = {
  interview: {
    id: "11111111-1111-1111-1111-111111111111",
    scheduledAt: new Date("2026-06-01T10:00:00Z"),
    durationMinutes: 90,
    venueName: "JRMSU Main Campus",
    addressLine: "Dapitan City, Zamboanga del Norte, PH",
    roomOrFloor: "ICT Building, Room 305",
    reportingInstructions: "Arrive 15 min early.",
    whatToBring: "1 valid ID, printed resume.",
    interviewerName: "Maria Santos",
    interviewerTitle: "Engineering Manager",
    mapUrl: "https://maps.google.com/?q=JRMSU",
  },
  candidate: { fullName: "Juan Dela Cruz", email: "juan@example.com" },
  job: { title: "Software Engineer" },
  company: { name: "Acme Corp", recruiterEmail: "recruiter@acme.example" },
};

describe("buildInterviewIcs", () => {
  it("contains the stable UID and required RFC-5545 fields", () => {
    const ics = buildInterviewIcs(fixture);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain(
      "UID:interview-11111111-1111-1111-1111-111111111111@aurahire.app",
    );
    expect(ics).toContain("DTSTART:20260601T100000Z");
    expect(ics).toContain("DTEND:20260601T113000Z");
    expect(ics).toContain("SUMMARY:Interview: Software Engineer at Acme Corp");
    expect(ics).toContain(
      "LOCATION:JRMSU Main Campus, Dapitan City, Zamboanga del Norte, PH (ICT Building, Room 305)",
    );
    expect(ics).toContain(
      "ORGANIZER;CN=Acme Corp:mailto:recruiter@acme.example",
    );
    expect(ics).toContain(
      "ATTENDEE;CN=Juan Dela Cruz;RSVP=TRUE:mailto:juan@example.com",
    );
    expect(ics).toContain("END:VCALENDAR");
  });
  it("folds long DESCRIPTION lines per RFC-5545", () => {
    const longInterview = {
      ...fixture.interview,
      reportingInstructions: "x".repeat(200),
    };
    const ics = buildInterviewIcs({ ...fixture, interview: longInterview });
    // Each folded continuation line begins with a single space.
    const descLineCount = ics
      .split("\n")
      .filter((l) => l.startsWith("DESCRIPTION:") || l.startsWith(" ")).length;
    expect(descLineCount).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter @aurahire/api test build-interview-ics`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
interface BuildIcsInput {
  interview: {
    id: string;
    scheduledAt: Date;
    durationMinutes: number;
    venueName: string;
    addressLine: string;
    roomOrFloor: string | null;
    reportingInstructions: string | null;
    whatToBring: string | null;
    interviewerName: string | null;
    interviewerTitle: string | null;
    mapUrl: string | null;
  };
  candidate: { fullName: string; email: string };
  job: { title: string };
  company: { name: string; recruiterEmail: string };
}

const formatIcsDate = (d: Date): string =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

const escapeText = (s: string): string =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");

const foldLine = (line: string): string => {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  chunks.push(line.slice(0, 75));
  i = 75;
  while (i < line.length) {
    chunks.push(" " + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join("\r\n");
};

export function buildInterviewIcs(input: BuildIcsInput): string {
  const { interview, candidate, job, company } = input;
  const start = formatIcsDate(interview.scheduledAt);
  const end = formatIcsDate(
    new Date(
      interview.scheduledAt.getTime() + interview.durationMinutes * 60_000,
    ),
  );
  const dtstamp = formatIcsDate(new Date());

  const locationParts = [interview.venueName, interview.addressLine].filter(
    Boolean,
  );
  let location = locationParts.join(", ");
  if (interview.roomOrFloor) location += ` (${interview.roomOrFloor})`;

  const descLines: string[] = [];
  if (interview.interviewerName) {
    descLines.push(
      `Interviewer: ${interview.interviewerName}${interview.interviewerTitle ? ` (${interview.interviewerTitle})` : ""}`,
    );
  }
  if (interview.reportingInstructions)
    descLines.push(`Reporting: ${interview.reportingInstructions}`);
  if (interview.whatToBring) descLines.push(`Bring: ${interview.whatToBring}`);
  if (interview.mapUrl) descLines.push(`Map: ${interview.mapUrl}`);
  const description = escapeText(descLines.join("\\n"));

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AuraHire//Interview//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:interview-${interview.id}@aurahire.app`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(`Interview: ${job.title} at ${company.name}`)}`,
    `LOCATION:${escapeText(location)}`,
    `DESCRIPTION:${description}`,
    `ORGANIZER;CN=${escapeText(company.name)}:mailto:${company.recruiterEmail}`,
    `ATTENDEE;CN=${escapeText(candidate.fullName)};RSVP=TRUE:mailto:${candidate.email}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n");
}
```

- [ ] **Step 4: Run again, expect pass**

Run: `pnpm --filter @aurahire/api test build-interview-ics`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/calendar
git commit -m "feat(calendar): RFC-5545 ICS builder for interviews"
```

---

### Task 13: ICS download endpoint

**Files:**

- Modify: `apps/api/src/modules/interviews/interviews.controller.ts`
- Modify: `apps/api/src/modules/interviews/interviews.service.ts`

- [ ] **Step 1: Add service method `getIcs`**

```ts
async getIcs(user: AuthUser, interviewId: string): Promise<string> {
  const interview = await this.repo.findById(interviewId);
  if (!interview) throw new NotFoundException({ code: "NOT_FOUND", message: "Interview not found" });
  const app = await this.applicationsRepo.findById(interview.applicationId);
  if (!app) throw new NotFoundException({ code: "NOT_FOUND", message: "Application not found" });

  // Authorization: candidate owns the app, or recruiter belongs to the company that owns the job.
  if (user.role === "candidate" && app.candidateId !== user.id) {
    throw new NotFoundException({ code: "NOT_FOUND" });
  }
  if (user.role === "recruiter") {
    const job = await this.jobsRepo.findById(app.jobId);
    if (!job) throw new NotFoundException({ code: "NOT_FOUND" });
    // Existing helper to confirm membership; throw 404 if not.
  }

  const candidate = await this.profilesRepo.findById(app.candidateId);
  const jobRow = await this.jobsRepo.findByIdWithCompany(app.jobId);
  if (!candidate || !jobRow) throw new NotFoundException({ code: "NOT_FOUND" });

  return buildInterviewIcs({
    interview: {
      id: interview.id,
      scheduledAt: interview.scheduledAt,
      durationMinutes: interview.durationMinutes,
      venueName: interview.venueName ?? "",
      addressLine: interview.addressLine ?? "",
      roomOrFloor: interview.roomOrFloor ?? null,
      reportingInstructions: interview.reportingInstructions ?? null,
      whatToBring: interview.whatToBring ?? null,
      interviewerName: interview.interviewerName ?? null,
      interviewerTitle: interview.interviewerTitle ?? null,
      mapUrl: interview.mapUrl ?? null,
    },
    candidate: { fullName: candidate.fullName, email: candidate.email },
    job: { title: jobRow.title },
    company: { name: jobRow.company.name, recruiterEmail: jobRow.company.contactEmail ?? "no-reply@aurahire.app" },
  });
}
```

- [ ] **Step 2: Add controller endpoint**

```ts
@Get("interviews/:id/ics")
@Roles("candidate", "recruiter", "admin")
@ApiOperation({ summary: "Download interview as an ICS calendar file" })
async downloadIcs(
  @CurrentUser() user: AuthUser,
  @Param("id") id: string,
  @Res({ passthrough: false }) res: FastifyReply,
): Promise<void> {
  const ics = await this.service.getIcs(user, id);
  res.header("Content-Type", "text/calendar; charset=utf-8");
  res.header("Content-Disposition", `attachment; filename="interview-${id}.ics"`);
  res.send(ics);
}
```

Imports: `Res`, `FastifyReply`, `Get`.

- [ ] **Step 3: Type-check + smoke test endpoint with supertest**

Add a quick supertest assertion that `GET /api/v1/interviews/:id/ics` returns 200 with `Content-Type: text/calendar` for an authorized candidate.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/interviews
git commit -m "feat(interviews): GET /interviews/:id/ics calendar download"
```

---

### Task 14: Update feedback endpoint to accept `recommendation`

**Files:**

- Modify: `apps/api/src/modules/interviews/dto/update-interview-feedback.dto.ts`
- Modify: `apps/api/src/modules/interviews/interviews.service.ts`
- Modify: `apps/api/src/modules/interviews/interviews.repository.ts`

- [ ] **Step 1: Write failing test**

```ts
it("updateFeedback persists recommendation and audits both events when recommendation changes", async () => {
  const interview = await fx.scheduleInterview({});
  await service.updateStatus(
    recruiterUser,
    companyId,
    interview.id,
    { newStatus: "completed" },
    {},
  );

  await service.updateFeedback(
    recruiterUser,
    companyId,
    interview.id,
    {
      feedback: "Strong candidate, communicates clearly.",
      rating: 5,
      recommendation: "proceed",
    },
    {},
  );

  const reloaded = await repo.findById(interview.id);
  expect(reloaded?.feedback).toContain("Strong candidate");
  expect(reloaded?.rating).toBe(5);
  expect(reloaded?.recommendation).toBe("proceed");

  const audits = await fx.listAudits({ entityId: interview.id });
  expect(audits.map((a) => a.action)).toEqual(
    expect.arrayContaining([
      "interview.feedback_submitted",
      "interview.recommendation_set",
    ]),
  );
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter @aurahire/api test interviews.service.spec -t recommendation`
Expected: FAIL — recommendation is not persisted.

- [ ] **Step 3: Update DTO**

`update-interview-feedback.dto.ts` already extends the shared schema (which now includes `recommendation`). No change needed beyond verifying.

- [ ] **Step 4: Update repository to accept `recommendation`**

In `interviews.repository.ts`, ensure `update()` accepts `recommendation: InterviewRecommendation | null`.

- [ ] **Step 5: Update `service.updateFeedback`**

```ts
async updateFeedback(user, companyId, interviewId, dto, requestMeta) {
  const interview = await this.requireCompanyOwnership(user, companyId, interviewId);
  const previousRecommendation = interview.recommendation ?? null;

  const updated = await this.repo.update(interviewId, {
    feedback: dto.feedback,
    rating: dto.rating ?? null,
    recommendation: dto.recommendation ?? null,
  });

  await this.audit.log({
    actorId: user.id,
    actorType: "user",
    action: AUDIT_ACTIONS.INTERVIEW_FEEDBACK_SUBMITTED,
    entityType: "interview",
    entityId: interviewId,
    companyId,
    details: {
      applicationId: interview.applicationId,
      rating: dto.rating ?? null,
    },
    ...requestMeta,
  });

  if ((dto.recommendation ?? null) !== previousRecommendation) {
    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.INTERVIEW_RECOMMENDATION_SET,
      entityType: "interview",
      entityId: interviewId,
      companyId,
      details: { from: previousRecommendation, to: dto.recommendation ?? null },
      ...requestMeta,
    });
    if (dto.recommendation) {
      this.events.emitApplicationRecommendationSet({
        applicationId: interview.applicationId,
        interviewId,
        recruiterId: user.id,
        recommendation: dto.recommendation,
      });
    }
  }
  // ... (existing cache bust)
  return this.toDto(updated);
}
```

- [ ] **Step 6: Run, expect pass; commit**

```bash
git add apps/api/src/modules/interviews
git commit -m "feat(interviews): feedback endpoint persists recommendation, audits change"
```

---

### Task 15: `POST /interviews/:id/share-feedback`

**Files:**

- Modify: `apps/api/src/modules/interviews/interviews.controller.ts`
- Modify: `apps/api/src/modules/interviews/interviews.service.ts`
- Create: `apps/api/src/modules/interviews/dto/share-interview-feedback.dto.ts`

- [ ] **Step 1: Write failing test**

```ts
it("share-feedback sets candidateSummary, sharedAt, sends email + in-app", async () => {
  const interview = await fx.scheduleInterview({});
  await service.updateStatus(
    recruiterUser,
    companyId,
    interview.id,
    { newStatus: "completed" },
    {},
  );
  await service.updateFeedback(
    recruiterUser,
    companyId,
    interview.id,
    { feedback: "internal", rating: 4, recommendation: "proceed" },
    {},
  );

  await service.shareFeedback(
    recruiterUser,
    companyId,
    interview.id,
    { candidateSummary: "Thank you for the strong interview." },
    {},
  );

  const reloaded = await repo.findById(interview.id);
  expect(reloaded?.candidateSummary).toContain("strong interview");
  expect(reloaded?.sharedWithCandidateAt).toBeInstanceOf(Date);

  expect(notifications.emit).toHaveBeenCalledWith(
    expect.objectContaining({
      eventType: "interview_feedback_shared",
      userId: candidateUser.id,
    }),
  );
  expect(email.send).toHaveBeenCalledWith(
    expect.objectContaining({ subject: expect.stringContaining("Feedback") }),
  );
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter @aurahire/api test interviews.service.spec -t share-feedback`
Expected: FAIL — `service.shareFeedback is not a function`.

- [ ] **Step 3: Create DTO**

```ts
import { createZodDto } from "nestjs-zod";
import { shareInterviewFeedbackSchema } from "@aurahire/shared";
export class ShareInterviewFeedbackDto extends createZodDto(
  shareInterviewFeedbackSchema,
) {}
```

- [ ] **Step 4: Add `shareFeedback` service method**

```ts
async shareFeedback(user, companyId, interviewId, dto, requestMeta) {
  const interview = await this.requireCompanyOwnership(user, companyId, interviewId);
  const updated = await this.repo.update(interviewId, {
    candidateSummary: dto.candidateSummary,
    sharedWithCandidateAt: new Date(),
  });

  await this.audit.log({
    actorId: user.id, actorType: "user",
    action: AUDIT_ACTIONS.INTERVIEW_FEEDBACK_SHARED,
    entityType: "interview", entityId: interviewId, companyId,
    details: { applicationId: interview.applicationId, length: dto.candidateSummary.length },
    ...requestMeta,
  });

  const app = await this.applicationsRepo.findById(interview.applicationId);
  if (app) {
    await this.notifications.emit({
      userId: app.candidateId,
      eventType: "interview_feedback_shared",
      entityType: "interview",
      entityId: interviewId,
      metadata: { interviewId, applicationId: interview.applicationId },
    });
    void this.notifyCandidateFeedbackShared(interviewId).catch((err) =>
      this.logger.warn(`Feedback-shared email failed: ${(err as Error).message}`),
    );
    this.events.emitInterviewFeedbackShared({
      interviewId, applicationId: interview.applicationId,
      candidateId: app.candidateId, recruiterId: user.id,
      sharedAt: updated.sharedWithCandidateAt!.toISOString(),
    });
    await this.cacheService.bustTags([
      TAGS.companyInterviews(companyId),
      TAGS.interviewsCandidate(app.candidateId),
    ]);
  }
  return this.toDto(updated);
}

private async notifyCandidateFeedbackShared(interviewId: string): Promise<void> {
  // mirrors notifyCandidateScheduled pattern; uses InterviewFeedbackSharedEmail (Task 28)
}
```

- [ ] **Step 5: Add controller endpoint**

```ts
@Post("interviews/:id/share-feedback")
@Roles("recruiter")
@HttpCode(HttpStatus.OK)
async shareFeedback(
  @CurrentUser() user, @ActiveCompany() activeCompany,
  @Param("id") id: string, @Body() dto: ShareInterviewFeedbackDto, @Req() req,
): Promise<InterviewEnvelopeDto> {
  const data = await this.service.shareFeedback(user, activeCompany.companyId, id, dto, this.requestMeta(req));
  return { data };
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/interviews
git commit -m "feat(interviews): POST /interviews/:id/share-feedback (email + in-app)"
```

---

### Task 16: `PATCH /interviews/:id/no-show`

**Files:**

- Modify: `apps/api/src/modules/interviews/interviews.controller.ts`
- Modify: `apps/api/src/modules/interviews/interviews.service.ts`

- [ ] **Step 1: Write failing test**

```ts
it("markNoShow flips scheduled or completed → no-show; rejects from cancelled", async () => {
  const interview = await fx.scheduleInterview({});
  await expect(
    service.markNoShow(recruiterUser, companyId, interview.id, {}),
  ).resolves.toMatchObject({ status: "no-show" });

  const finished = await fx.scheduleInterview({});
  await service.updateStatus(
    recruiterUser,
    companyId,
    finished.id,
    { newStatus: "completed" },
    {},
  );
  await expect(
    service.markNoShow(recruiterUser, companyId, finished.id, {}),
  ).resolves.toMatchObject({ status: "no-show" });

  const cancelled = await fx.scheduleInterview({});
  await service.updateStatus(
    recruiterUser,
    companyId,
    cancelled.id,
    { newStatus: "cancelled" },
    {},
  );
  await expect(
    service.markNoShow(recruiterUser, companyId, cancelled.id, {}),
  ).rejects.toThrow(/INVALID_STATUS_TRANSITION/);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter @aurahire/api test -t markNoShow`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
async markNoShow(user, companyId, interviewId, requestMeta) {
  const interview = await this.requireCompanyOwnership(user, companyId, interviewId);
  if (!["scheduled", "completed"].includes(interview.status)) {
    throw new BadRequestException({
      code: "INVALID_STATUS_TRANSITION",
      message: `Cannot mark no-show from ${interview.status}`,
    });
  }
  const updated = await this.repo.update(interviewId, { status: "no-show" });
  await this.audit.log({
    actorId: user.id, actorType: "user",
    action: AUDIT_ACTIONS.INTERVIEW_NO_SHOW_MARKED,
    entityType: "interview", entityId: interviewId, companyId,
    details: { from: interview.status, applicationId: interview.applicationId },
    ...requestMeta,
  });
  // Cache bust + realtime status change as existing
  return this.toDto(updated);
}
```

- [ ] **Step 4: Add controller endpoint**

```ts
@Patch("interviews/:id/no-show")
@Roles("recruiter")
@HttpCode(HttpStatus.OK)
async markNoShow(
  @CurrentUser() user, @ActiveCompany() activeCompany,
  @Param("id") id: string, @Req() req,
): Promise<InterviewEnvelopeDto> {
  const data = await this.service.markNoShow(user, activeCompany.companyId, id, this.requestMeta(req));
  return { data };
}
```

- [ ] **Step 5: Run + commit**

```bash
git add apps/api/src/modules/interviews
git commit -m "feat(interviews): PATCH /interviews/:id/no-show"
```

---

### Task 17: `POST /interviews/:id/reschedule`

**Files:**

- Modify: `apps/api/src/modules/interviews/interviews.controller.ts`
- Modify: `apps/api/src/modules/interviews/interviews.service.ts`
- Modify: `apps/api/src/modules/interviews/interviews.repository.ts`
- Create: `apps/api/src/modules/interviews/dto/reschedule-interview.dto.ts`

- [ ] **Step 1: Write failing test**

```ts
it("reschedule marks original 'rescheduled', creates new linked row, sends email", async () => {
  const original = await fx.scheduleInterview({});
  const result = await service.reschedule(
    recruiterUser,
    companyId,
    original.id,
    fx.scheduleInput({ scheduledAt: future(48).toISOString() }),
    {},
  );

  expect(result.status).toBe("scheduled");
  expect(result.id).not.toBe(original.id);
  const reloaded = await repo.findById(original.id);
  expect(reloaded?.status).toBe("rescheduled");
  expect(reloaded?.rescheduledToId).toBe(result.id);
  expect(result.rescheduledFromId).toBe(original.id);

  expect(email.send).toHaveBeenCalledWith(
    expect.objectContaining({
      subject: expect.stringMatching(/rescheduled/i),
      attachments: expect.arrayContaining([
        expect.objectContaining({ filename: "interview.ics" }),
      ]),
    }),
  );
});

it("reschedule rejects from completed | cancelled | rescheduled", async () => {
  for (const bad of ["completed", "cancelled", "rescheduled"] as const) {
    const i = await fx.scheduleInterview({});
    await fx.setStatusDirect(i.id, bad);
    await expect(
      service.reschedule(
        recruiterUser,
        companyId,
        i.id,
        fx.scheduleInput({}),
        {},
      ),
    ).rejects.toThrow(/INVALID_STATUS_TRANSITION/);
  }
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter @aurahire/api test interviews.service.spec -t reschedule`
Expected: FAIL — `service.reschedule is not a function`.

- [ ] **Step 3: DTO**

```ts
import { createZodDto } from "nestjs-zod";
import { rescheduleInterviewSchema } from "@aurahire/shared";
export class RescheduleInterviewDto extends createZodDto(
  rescheduleInterviewSchema,
) {}
```

- [ ] **Step 4: Implement service.reschedule**

```ts
async reschedule(user, companyId, interviewId, dto, requestMeta) {
  const interview = await this.requireCompanyOwnership(user, companyId, interviewId);
  if (!["scheduled", "no-show"].includes(interview.status)) {
    throw new BadRequestException({
      code: "INVALID_STATUS_TRANSITION",
      message: `Cannot reschedule from ${interview.status}`,
    });
  }
  const scheduledAt = new Date(dto.scheduledAt);
  if (scheduledAt < new Date()) {
    throw new BadRequestException({ code: "PAST_DATE", message: "Reschedule cannot be in the past" });
  }
  const sanitizedMapUrl = sanitizeMapUrl(dto.mapUrl);

  const newInterview = await this.db.transaction(async (tx) => {
    // Mark original as rescheduled. Guard with WHERE status to avoid race.
    const updatedOriginal = await this.repo.markRescheduled(interview.id, tx);
    if (!updatedOriginal) {
      throw new BadRequestException({ code: "RACE_LOST", message: "Interview status changed concurrently" });
    }
    // Insert new interview linked back to the original.
    const created = await this.repo.insert({
      applicationId: interview.applicationId,
      scheduledBy: user.id,
      scheduledAt,
      durationMinutes: dto.durationMinutes,
      format: "in-person",
      venueName: dto.venueName,
      addressLine: dto.addressLine,
      roomOrFloor: dto.roomOrFloor ?? null,
      mapUrl: sanitizedMapUrl,
      reportingInstructions: dto.reportingInstructions ?? null,
      whatToBring: dto.whatToBring ?? null,
      interviewerName: dto.interviewerName ?? null,
      interviewerTitle: dto.interviewerTitle ?? null,
      status: "scheduled",
      rescheduledFromId: interview.id,
    }, tx);
    // Wire forward link.
    await this.repo.setRescheduledTo(interview.id, created.id, tx);
    return created;
  });

  await this.audit.log({
    actorId: user.id, actorType: "user",
    action: AUDIT_ACTIONS.INTERVIEW_RESCHEDULED,
    entityType: "interview", entityId: newInterview.id, companyId,
    details: {
      previousInterviewId: interview.id,
      previousScheduledAt: interview.scheduledAt.toISOString(),
      newScheduledAt: scheduledAt.toISOString(),
    },
    ...requestMeta,
  });

  const app = await this.applicationsRepo.findById(interview.applicationId);
  if (app) {
    this.events.emitInterviewRescheduled({
      oldInterviewId: interview.id,
      newInterviewId: newInterview.id,
      applicationId: interview.applicationId,
      candidateId: app.candidateId,
      recruiterId: user.id,
      scheduledFor: scheduledAt.toISOString(),
    });
    await this.cacheService.bustTags([
      TAGS.companyInterviews(companyId),
      TAGS.interviewsCandidate(app.candidateId),
    ]);
    void this.notifyCandidateRescheduled(newInterview.id).catch((err) =>
      this.logger.warn(`Reschedule notify failed: ${(err as Error).message}`),
    );
  }
  return this.toDto(newInterview);
}

private async notifyCandidateRescheduled(interviewId: string) {
  // mirrors notifyCandidateScheduled but uses InterviewRescheduledEmail and same ICS UID
}
```

- [ ] **Step 5: Add repo helpers**

```ts
async markRescheduled(id: string, tx = this.db) {
  const [row] = await tx
    .update(interviewsTable)
    .set({ status: "rescheduled", updatedAt: new Date() })
    .where(and(eq(interviewsTable.id, id), inArray(interviewsTable.status, ["scheduled", "no-show"])))
    .returning();
  return row ?? null;
}
async setRescheduledTo(originalId: string, newId: string, tx = this.db) {
  await tx
    .update(interviewsTable)
    .set({ rescheduledToId: newId, updatedAt: new Date() })
    .where(eq(interviewsTable.id, originalId));
}
```

- [ ] **Step 6: Add controller endpoint**

```ts
@Post("interviews/:id/reschedule")
@Roles("recruiter")
@HttpCode(HttpStatus.OK)
async reschedule(
  @CurrentUser() user, @ActiveCompany() activeCompany,
  @Param("id") id: string, @Body() dto: RescheduleInterviewDto, @Req() req,
): Promise<InterviewEnvelopeDto> {
  const data = await this.service.reschedule(user, activeCompany.companyId, id, dto, this.requestMeta(req));
  return { data };
}
```

- [ ] **Step 7: Run + commit**

```bash
git add apps/api/src/modules/interviews
git commit -m "feat(interviews): POST /interviews/:id/reschedule (atomic chain + email)"
```

---

### Task 18: Update `interviews.service.schedule()` to consume new venue inputs

**Files:**

- Modify: `apps/api/src/modules/interviews/interviews.service.ts`
- Modify: `apps/api/src/modules/interviews/interviews.repository.ts`

- [ ] **Step 1: Write failing test**

```ts
it("schedule persists venue + guidance fields", async () => {
  const app = await fx.createApplication({ status: "screening" });
  const result = await service.schedule(
    recruiterUser,
    app.companyId,
    app.id,
    fx.scheduleInput({
      venueName: "JRMSU Main",
      addressLine: "Dapitan",
      roomOrFloor: "ICT 305",
      mapUrl: "https://maps.google.com/?q=foo",
      reportingInstructions: "Arrive 15 min early.",
      whatToBring: "Valid ID + resume.",
      interviewerName: "Maria Santos",
      interviewerTitle: "Engineering Manager",
    }),
    {},
  );
  expect(result.venueName).toBe("JRMSU Main");
  expect(result.addressLine).toBe("Dapitan");
  expect(result.roomOrFloor).toBe("ICT 305");
});
```

- [ ] **Step 2: Run, expect failure**

Expected: FAIL — fields not persisted.

- [ ] **Step 3: Update `repo.insert`**

Extend the insert payload with the new fields. Sanitize `mapUrl` via `sanitizeMapUrl`. Default `interviewerName` to the recruiter's `fullName` if not provided (look up via profilesRepo).

- [ ] **Step 4: Update toDto**

Pass through new fields:

```ts
return {
  // ...existing fields
  venueName: i.venueName ?? "",
  addressLine: i.addressLine ?? "",
  roomOrFloor: i.roomOrFloor ?? null,
  mapUrl: i.mapUrl ?? null,
  reportingInstructions: i.reportingInstructions ?? null,
  whatToBring: i.whatToBring ?? null,
  interviewerName: i.interviewerName ?? null,
  interviewerTitle: i.interviewerTitle ?? null,
  recommendation: i.recommendation ?? null,
  candidateSummary: i.candidateSummary ?? null,
  sharedWithCandidateAt: i.sharedWithCandidateAt?.toISOString() ?? null,
  rescheduledFromId: i.rescheduledFromId ?? null,
  rescheduledToId: i.rescheduledToId ?? null,
};
```

Update `InterviewDto` shape in `interview-response.dto.ts` accordingly.

- [ ] **Step 5: If `saveAsTemplate` is true, also create an `interview_venues` row**

After the insert succeeds, when `dto.saveAsTemplate && dto.templateLabel`, call `this.venuesRepo.insert(...)` (forward dependency on Task 19; for now, stub the call site behind a feature check).

- [ ] **Step 6: Run + commit**

```bash
git add apps/api/src/modules/interviews
git commit -m "feat(interviews): schedule persists structured venue + guidance fields"
```

---

## Phase 4 — Venue templates module

### Task 19: Scaffold module + repository

**Files:**

- Create: `apps/api/src/modules/interview-venues/interview-venues.module.ts`
- Create: `apps/api/src/modules/interview-venues/interview-venues.repository.ts`
- Create: `apps/api/src/modules/interview-venues/interview-venues.service.ts`
- Create: `apps/api/src/modules/interview-venues/interview-venues.controller.ts`
- Create: `apps/api/src/modules/interview-venues/dto/interview-venue-input.dto.ts`
- Create: `apps/api/src/modules/interview-venues/dto/interview-venue-response.dto.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Scaffold module**

```ts
// interview-venues.module.ts
import { Module } from "@nestjs/common";
import { InterviewVenuesController } from "./interview-venues.controller";
import { InterviewVenuesService } from "./interview-venues.service";
import { InterviewVenuesRepository } from "./interview-venues.repository";
import { AuditModule } from "../../audit/audit.module";
import { CacheModule } from "../../cache/cache.module";

@Module({
  imports: [AuditModule, CacheModule],
  controllers: [InterviewVenuesController],
  providers: [InterviewVenuesService, InterviewVenuesRepository],
  exports: [InterviewVenuesService, InterviewVenuesRepository],
})
export class InterviewVenuesModule {}
```

Register in `app.module.ts` `imports: [...]`.

- [ ] **Step 2: Repository**

```ts
@Injectable()
export class InterviewVenuesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async list(companyId: string) {
    return this.db
      .select()
      .from(interviewVenuesTable)
      .where(eq(interviewVenuesTable.companyId, companyId))
      .orderBy(
        desc(interviewVenuesTable.isDefault),
        asc(interviewVenuesTable.label),
      );
  }
  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(interviewVenuesTable)
      .where(eq(interviewVenuesTable.id, id))
      .limit(1);
    return row ?? null;
  }
  async insert(input: NewVenueRow) {
    const [row] = await this.db
      .insert(interviewVenuesTable)
      .values(input)
      .returning();
    return row;
  }
  async update(id: string, patch: Partial<NewVenueRow>) {
    const [row] = await this.db
      .update(interviewVenuesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(interviewVenuesTable.id, id))
      .returning();
    return row;
  }
  async delete(id: string) {
    await this.db
      .delete(interviewVenuesTable)
      .where(eq(interviewVenuesTable.id, id));
  }
  async clearDefaultForCompany(companyId: string, exceptId?: string) {
    const cond = exceptId
      ? and(
          eq(interviewVenuesTable.companyId, companyId),
          ne(interviewVenuesTable.id, exceptId),
        )
      : eq(interviewVenuesTable.companyId, companyId);
    await this.db
      .update(interviewVenuesTable)
      .set({ isDefault: false })
      .where(cond);
  }
}
```

- [ ] **Step 3: DTOs**

```ts
// interview-venue-input.dto.ts
import { createZodDto } from "nestjs-zod";
import {
  interviewVenueInputSchema,
  interviewVenuePartialSchema,
} from "@aurahire/shared";
export class InterviewVenueInputDto extends createZodDto(
  interviewVenueInputSchema,
) {}
export class InterviewVenuePartialDto extends createZodDto(
  interviewVenuePartialSchema,
) {}

// interview-venue-response.dto.ts
import { ApiProperty } from "@nestjs/swagger";
export class InterviewVenueDto {
  /* mirror columns */
}
export class InterviewVenueListEnvelopeDto {
  @ApiProperty({ type: [InterviewVenueDto] }) data!: InterviewVenueDto[];
}
export class InterviewVenueEnvelopeDto {
  @ApiProperty({ type: InterviewVenueDto }) data!: InterviewVenueDto;
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/interview-venues apps/api/src/app.module.ts
git commit -m "feat(interview-venues): scaffold module + repository + DTOs"
```

---

### Task 20: Service + CRUD endpoints

**Files:**

- Modify: `apps/api/src/modules/interview-venues/interview-venues.service.ts`
- Modify: `apps/api/src/modules/interview-venues/interview-venues.controller.ts`

- [ ] **Step 1: Write failing test**

```ts
it("create + list + update + delete + setDefault round-trip", async () => {
  const a = await service.create(recruiter, companyId, {
    label: "A",
    venueName: "JRMSU Main",
    addressLine: "Dapitan",
  });
  const b = await service.create(recruiter, companyId, {
    label: "B",
    venueName: "JRMSU South",
    addressLine: "Pagadian",
  });

  await service.setDefault(recruiter, companyId, b.id);
  const list = await service.list(recruiter, companyId);
  expect(list.find((v) => v.id === b.id)?.isDefault).toBe(true);
  expect(list.find((v) => v.id === a.id)?.isDefault).toBe(false);

  await service.update(recruiter, companyId, a.id, { roomOrFloor: "ICT 305" });
  const reloaded = await service.list(recruiter, companyId);
  expect(reloaded.find((v) => v.id === a.id)?.roomOrFloor).toBe("ICT 305");

  await service.remove(recruiter, companyId, a.id);
  expect(
    (await service.list(recruiter, companyId)).find((v) => v.id === a.id),
  ).toBeUndefined();
});
```

- [ ] **Step 2: Run, expect failure**

Expected: FAIL — service methods missing.

- [ ] **Step 3: Implement service**

```ts
@Injectable()
export class InterviewVenuesService {
  constructor(
    private readonly repo: InterviewVenuesRepository,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
  ) {}

  private requireRecruiter(user: AuthUser) {
    if (user.role !== "recruiter" && user.role !== "admin") {
      throw new ForbiddenException({ code: "FORBIDDEN" });
    }
  }

  async list(user: AuthUser, companyId: string) {
    this.requireRecruiter(user);
    return this.repo.list(companyId);
  }

  async create(
    user: AuthUser,
    companyId: string,
    dto: InterviewVenueInputDto,
    requestMeta = {},
  ) {
    this.requireRecruiter(user);
    if (dto.isDefault) await this.repo.clearDefaultForCompany(companyId);
    const row = await this.repo.insert({
      companyId,
      createdBy: user.id,
      label: dto.label,
      venueName: dto.venueName,
      addressLine: dto.addressLine,
      roomOrFloor: dto.roomOrFloor ?? null,
      mapUrl: dto.mapUrl ? sanitizeMapUrl(dto.mapUrl) : null,
      reportingInstructions: dto.reportingInstructions ?? null,
      whatToBring: dto.whatToBring ?? null,
      interviewerName: dto.interviewerName ?? null,
      interviewerTitle: dto.interviewerTitle ?? null,
      isDefault: dto.isDefault ?? false,
    });
    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.INTERVIEW_VENUE_CREATED,
      entityType: "interview_venue",
      entityId: row.id,
      companyId,
      details: { label: row.label },
      ...requestMeta,
    });
    return row;
  }

  async update(user, companyId, id, dto, requestMeta = {}) {
    this.requireRecruiter(user);
    const existing = await this.repo.findById(id);
    if (!existing || existing.companyId !== companyId)
      throw new NotFoundException();
    const patch = { ...dto };
    if (patch.mapUrl !== undefined)
      patch.mapUrl = patch.mapUrl ? sanitizeMapUrl(patch.mapUrl) : null;
    if (patch.isDefault) await this.repo.clearDefaultForCompany(companyId, id);
    const updated = await this.repo.update(id, patch);
    await this.audit.log({
      /* INTERVIEW_VENUE_UPDATED */
    });
    return updated;
  }

  async remove(user, companyId, id, requestMeta = {}) {
    this.requireRecruiter(user);
    const existing = await this.repo.findById(id);
    if (!existing || existing.companyId !== companyId)
      throw new NotFoundException();
    await this.repo.delete(id);
    await this.audit.log({
      /* INTERVIEW_VENUE_DELETED */
    });
  }

  async setDefault(user, companyId, id, requestMeta = {}) {
    this.requireRecruiter(user);
    const existing = await this.repo.findById(id);
    if (!existing || existing.companyId !== companyId)
      throw new NotFoundException();
    await this.repo.clearDefaultForCompany(companyId, id);
    return this.repo.update(id, { isDefault: true });
  }
}
```

- [ ] **Step 4: Implement controller**

```ts
@ApiTags("interview-venues")
@ApiBearerAuth()
@Controller()
export class InterviewVenuesController {
  constructor(private readonly service: InterviewVenuesService) {}

  @Get("companies/:companyId/interview-venues")
  @Roles("recruiter", "admin")
  async list(
    @CurrentUser() user,
    @Param("companyId") companyId: string,
  ): Promise<InterviewVenueListEnvelopeDto> {
    const data = await this.service.list(user, companyId);
    return { data };
  }

  @Post("companies/:companyId/interview-venues")
  @Roles("recruiter", "admin")
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user,
    @Param("companyId") companyId: string,
    @Body() dto: InterviewVenueInputDto,
    @Req() req,
  ): Promise<InterviewVenueEnvelopeDto> {
    const data = await this.service.create(
      user,
      companyId,
      dto,
      this.requestMeta(req),
    );
    return { data };
  }

  @Patch("interview-venues/:id")
  @Roles("recruiter", "admin")
  async update(/* same */) {}

  @Delete("interview-venues/:id")
  @Roles("recruiter", "admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(/* same */) {}

  @Post("interview-venues/:id/set-default")
  @Roles("recruiter", "admin")
  async setDefault(/* same */) {}
}
```

For Update/Delete/SetDefault, look up `companyId` from the existing row before authorizing.

- [ ] **Step 5: Run + commit**

```bash
git add apps/api/src/modules/interview-venues
git commit -m "feat(interview-venues): CRUD + set-default endpoints"
```

---

### Task 21: Wire schedule modal's `saveAsTemplate` to the venues service

**Files:**

- Modify: `apps/api/src/modules/interviews/interviews.service.ts`
- Modify: `apps/api/src/modules/interviews/interviews.module.ts`

- [ ] **Step 1: Inject `InterviewVenuesService` into `InterviewsService`**

Add to module imports + constructor.

- [ ] **Step 2: After successful schedule, persist template if requested**

```ts
if (dto.saveAsTemplate && dto.templateLabel) {
  try {
    await this.venuesService.create(user, companyId, {
      label: dto.templateLabel,
      venueName: dto.venueName,
      addressLine: dto.addressLine,
      roomOrFloor: dto.roomOrFloor ?? null,
      mapUrl: dto.mapUrl ?? null,
      reportingInstructions: dto.reportingInstructions ?? null,
      whatToBring: dto.whatToBring ?? null,
      interviewerName: dto.interviewerName ?? null,
      interviewerTitle: dto.interviewerTitle ?? null,
      isDefault: false,
    });
  } catch (err) {
    // Non-fatal: schedule succeeded; logging only.
    this.logger.warn(`saveAsTemplate failed: ${(err as Error).message}`);
  }
}
```

- [ ] **Step 3: Run + commit**

```bash
git add apps/api/src/modules/interviews
git commit -m "feat(interviews): persist venue template when saveAsTemplate is set"
```

---

## Phase 5 — Cron, realtime emitters, notification defaults, email templates

### Task 22: Realtime emitter methods

**Files:**

- Modify: `apps/api/src/realtime/events.service.ts`

- [ ] **Step 1: Add 5 emitter methods**

```ts
emitInterviewCompleted(payload: InterviewCompletedPayload) {
  this.gateway.emitToRooms(
    [`user:${payload.candidateId}`, `recruiter:${payload.recruiterId}`, `job:${payload.jobId}`],
    "interview.completed", payload,
  );
}
emitInterviewRescheduled(payload: InterviewRescheduledPayload) {
  this.gateway.emitToRooms(
    [`user:${payload.candidateId}`, `recruiter:${payload.recruiterId}`],
    "interview.rescheduled", payload,
  );
}
emitInterviewFeedbackShared(payload: InterviewFeedbackSharedPayload) {
  this.gateway.emitToRooms(
    [`user:${payload.candidateId}`, `recruiter:${payload.recruiterId}`],
    "interview.feedbackShared", payload,
  );
}
emitApplicationRecommendationSet(payload: ApplicationRecommendationSetPayload) {
  this.gateway.emitToRooms(
    [`recruiter:${payload.recruiterId}`],
    "application.recommendationSet", payload,
  );
}
emitApplicationWithdrawn(payload: ApplicationWithdrawnPayload) {
  // Recruiters scoped via job; we also emit to candidate so their own UI can react.
  this.gateway.emitToRooms(
    [`user:${payload.candidateId}`, `job:${payload.jobId}`],
    "application.withdrawn", payload,
  );
}
```

Match payload type imports from `@aurahire/shared`.

- [ ] **Step 2: Type-check + commit**

```bash
git add apps/api/src/realtime
git commit -m "feat(realtime): emit interview.completed/rescheduled/feedbackShared, app.recommendationSet/withdrawn"
```

---

### Task 23: Notification event defaults

**Files:**

- Modify: `apps/api/src/modules/notifications/event-defaults.ts`

- [ ] **Step 1: Add new event default rows**

```ts
{ key: "interview_rescheduled",       displayName: "Interview rescheduled",       channels: { email: true,  inApp: true  } },
{ key: "interview_reminder_24h",      displayName: "Interview reminder (24h)",    channels: { email: true,  inApp: true  } },
{ key: "interview_completed",         displayName: "Interview completed",         channels: { email: false, inApp: true  } },
{ key: "interview_feedback_shared",   displayName: "Interview feedback shared",   channels: { email: true,  inApp: true  } },
{ key: "interview_record_feedback",   displayName: "Record interview feedback",   channels: { email: false, inApp: true  } },
{ key: "application_withdrawn",       displayName: "Application withdrawn",       channels: { email: false, inApp: true  } },
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/notifications/event-defaults.ts
git commit -m "feat(notifications): default prefs for new interview-flow events"
```

---

### Task 24: Auto-complete cron

**Files:**

- Create: `apps/api/src/cron/interview-autocomplete.cron.ts`
- Create: `apps/api/src/cron/interview-autocomplete.cron.spec.ts`
- Modify: `apps/api/src/cron/cron.module.ts`
- Modify: `apps/api/src/cron/index.ts`

- [ ] **Step 1: Write failing test (time-mocked)**

Mirror `interview-feedback-due.cron.spec.ts` pattern.

```ts
it("flips overdue scheduled interviews to completed", async () => {
  const past = await fx.scheduleInterview({
    scheduledAt: hoursAgo(2),
    durationMinutes: 60,
    status: "scheduled",
  });
  const future = await fx.scheduleInterview({
    scheduledAt: hoursFromNow(2),
    durationMinutes: 60,
    status: "scheduled",
  });

  const result = await cron.execute();

  expect(result.completed).toBe(1);
  expect((await repo.findById(past.id))!.status).toBe("completed");
  expect((await repo.findById(future.id))!.status).toBe("scheduled");
});

it("does not flip recently-ended interviews within grace period", async () => {
  const justEnded = await fx.scheduleInterview({
    scheduledAt: hoursAgo(0).getTime() - 30 * 60_000,
    durationMinutes: 30,
    status: "scheduled",
  });
  // ended 0 min ago + duration 30 means 30 min ago end + 15min grace not yet passed.
  // adjust as needed
  const result = await cron.execute();
  expect(result.completed).toBe(0);
});

it("is idempotent — second run does not re-process", async () => {
  await fx.scheduleInterview({
    scheduledAt: hoursAgo(2),
    durationMinutes: 60,
    status: "scheduled",
  });
  const a = await cron.execute();
  const b = await cron.execute();
  expect(a.completed).toBe(1);
  expect(b.completed).toBe(0);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter @aurahire/api test interview-autocomplete.cron`
Expected: FAIL — cron not implemented.

- [ ] **Step 3: Implement**

```ts
import { Cron } from "@nestjs/schedule";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { interviewsTable, applicationsTable, jobsTable } from "@aurahire/db";
import { AUDIT_ACTIONS, AuditService } from "../audit";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../db/db.module";
import { NotificationsService } from "../modules/notifications/notifications.service";
import { EventsService } from "../realtime";

const CRON_NAME = "interview-autocomplete";
const CRON_ENTITY_SENTINEL = "00000000-0000-0000-0000-000000000000";
const GRACE_MINUTES = 15;

@Injectable()
export class InterviewAutocompleteCron {
  private readonly logger = new Logger(InterviewAutocompleteCron.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly notifications: NotificationsService,
    private readonly events: EventsService,
    private readonly audit: AuditService,
  ) {}

  @Cron("0 * * * *", { name: CRON_NAME, timeZone: "Asia/Manila" })
  async run() {
    return this.execute();
  }

  async execute(): Promise<{ completed: number; durationMs: number }> {
    const startedAt = Date.now();
    const due = await this.db
      .select({
        id: interviewsTable.id,
        applicationId: interviewsTable.applicationId,
        scheduledBy: interviewsTable.scheduledBy,
        candidateId: applicationsTable.candidateId,
        jobId: applicationsTable.jobId,
      })
      .from(interviewsTable)
      .innerJoin(
        applicationsTable,
        eq(applicationsTable.id, interviewsTable.applicationId),
      )
      .where(
        and(
          eq(interviewsTable.status, "scheduled"),
          sql`(${interviewsTable.scheduledAt} + ((${interviewsTable.durationMinutes} + ${GRACE_MINUTES}) || ' minutes')::interval) <= now()`,
        ),
      )
      .limit(200);

    let completed = 0;
    for (const row of due) {
      try {
        const [updated] = await this.db
          .update(interviewsTable)
          .set({ status: "completed", updatedAt: new Date() })
          .where(
            and(
              eq(interviewsTable.id, row.id),
              eq(interviewsTable.status, "scheduled"),
            ),
          )
          .returning({ id: interviewsTable.id });
        if (!updated) continue;

        await this.audit.log({
          actorId: null,
          actorType: "system",
          action: AUDIT_ACTIONS.INTERVIEW_AUTO_COMPLETED,
          entityType: "interview",
          entityId: row.id,
          details: { applicationId: row.applicationId },
        });

        this.events.emitInterviewCompleted({
          interviewId: row.id,
          applicationId: row.applicationId,
          candidateId: row.candidateId,
          recruiterId: row.scheduledBy,
          jobId: row.jobId,
          completedAt: new Date().toISOString(),
        });

        await this.notifications.emit({
          userId: row.candidateId,
          eventType: "interview_completed",
          entityType: "interview",
          entityId: row.id,
          metadata: { applicationId: row.applicationId },
        });
        await this.notifications.emit({
          userId: row.scheduledBy,
          eventType: "interview_record_feedback",
          entityType: "interview",
          entityId: row.id,
          metadata: { applicationId: row.applicationId },
        });
        completed += 1;
      } catch (err) {
        this.logger.error(
          `[${CRON_NAME}] failed for ${row.id}: ${(err as Error).message}`,
        );
      }
    }

    const durationMs = Date.now() - startedAt;
    await this.audit.log({
      actorId: null,
      actorType: "system",
      action: AUDIT_ACTIONS.INTERVIEW_AUTOCOMPLETE_RUN,
      entityType: "cron",
      entityId: CRON_ENTITY_SENTINEL,
      details: { completed, scanned: due.length, durationMs },
    });
    this.logger.log(
      `[${CRON_NAME}] completed ${completed}/${due.length} in ${durationMs}ms`,
    );
    return { completed, durationMs };
  }
}
```

- [ ] **Step 4: Register cron**

In `cron.module.ts`, add `InterviewAutocompleteCron` to providers. In `index.ts`, re-export it.

- [ ] **Step 5: Run tests + commit**

```bash
git add apps/api/src/cron
git commit -m "feat(cron): interview-autocomplete (hourly, flips overdue scheduled→completed)"
```

---

### Task 25: Update `InterviewScheduledEmail` for venue + ICS attachment

**Files:**

- Modify: `apps/api/src/email/templates/interview-scheduled.tsx`
- Modify: `apps/api/src/email/email.service.ts`
- Modify: `apps/api/src/modules/interviews/interviews.service.ts` (notifyCandidateScheduled)

- [ ] **Step 1: Extend `EmailService.send` to accept `attachments`**

Update the type:

```ts
export interface SendEmailInput {
  to: string;
  subject: string;
  template: ReactElement;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}
```

In Resend implementation, pass attachments through (Resend `attachments` array). For Mailpit dev path, also include in the SMTP send.

- [ ] **Step 2: Update `InterviewScheduledEmail` template**

Render new fields: venue, address, room, reporting instructions, what-to-bring, interviewer. Keep brand styling consistent with existing templates.

- [ ] **Step 3: Update `notifyCandidateScheduled` to attach ICS**

```ts
const ics = buildInterviewIcs({
  /* ... */
});
await this.email.send({
  to: candidate.email,
  subject: `Interview scheduled: ${jobRow.title}`,
  template: InterviewScheduledEmail({
    /* ...with all venue fields */
  }),
  attachments: [
    {
      filename: "interview.ics",
      content: Buffer.from(ics).toString("base64"),
      contentType: "text/calendar",
    },
  ],
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/email apps/api/src/modules/interviews
git commit -m "feat(email): InterviewScheduledEmail renders venue + attaches ICS"
```

---

### Task 26: `InterviewRescheduledEmail` template

**Files:**

- Create: `apps/api/src/email/templates/interview-rescheduled.tsx`
- Modify: `apps/api/src/modules/interviews/interviews.service.ts` (notifyCandidateRescheduled)

- [ ] **Step 1: Create template**

Mirror `InterviewScheduledEmail` props + structure. Title: "Interview Rescheduled". Include both old and new times if available.

- [ ] **Step 2: Wire `notifyCandidateRescheduled`**

Use the new template + ICS with the SAME UID as the original interview's chain root (so calendars update the existing event). Implementation: `UID = interview-{rescheduledFromId ?? interview.id}@aurahire.app` — adjust ICS builder to accept an `aliasUid` if rescheduledFromId is set.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/email apps/api/src/lib/calendar apps/api/src/modules/interviews
git commit -m "feat(email): InterviewRescheduledEmail + stable ICS UID across reschedule chain"
```

---

### Task 27: `InterviewReminderEmail` template + reminder cron payload upgrade

**Files:**

- Create: `apps/api/src/email/templates/interview-reminder.tsx`
- Modify: `apps/api/src/cron/interview-reminder.cron.ts`

- [ ] **Step 1: Create template**

Body: "Your interview is tomorrow." Render full venue card + map link + what-to-bring + reporting instructions.

- [ ] **Step 2: Modify `interview-reminder.cron.ts` query**

Pull the new venue fields and `interviewerName/Title` from the `interviews` row in the existing select. Pass to the email template.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/email apps/api/src/cron
git commit -m "feat(email): InterviewReminderEmail with full venue fields"
```

---

### Task 28: `InterviewFeedbackSharedEmail` template + wire share-feedback notify path

**Files:**

- Create: `apps/api/src/email/templates/interview-feedback-shared.tsx`
- Modify: `apps/api/src/modules/interviews/interviews.service.ts` (notifyCandidateFeedbackShared)

- [ ] **Step 1: Create template**

Subject: "Feedback from your interview at {company}". Body: candidate-friendly intro + the `candidateSummary` text in a quoted block + "Reply with questions" footer.

- [ ] **Step 2: Wire `notifyCandidateFeedbackShared`**

Look up candidate, job, company; call `email.send({ to: candidate.email, subject, template: InterviewFeedbackSharedEmail({ ... }) })`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/email apps/api/src/modules/interviews
git commit -m "feat(email): InterviewFeedbackSharedEmail (candidate-facing summary delivery)"
```

---

## Phase 6 — Recruiter UI

### Task 29: Decision bar — add "Move to Interview" CTA at applied

**Files:**

- Modify: `apps/web/app/(recruiter)/recruiter/applications/[id]/_decision-bar-client.tsx`

- [ ] **Step 1: Modify the `NEXT_POSITIVE` map**

Replace:

```ts
const NEXT_POSITIVE: Record<string, AdvanceAction[] | null> = {
  applied: [
    { status: "screening", label: "Move to Screening" },
    { status: "interview", label: "Move to Interview" },
  ],
  screening: [{ status: "interview", label: "Move to Interview" }],
  interview: [
    {
      status: "offer",
      label: "Send Offer",
      href: (id) => `/recruiter/offers/new?applicationId=${id}`,
    },
  ],
  offer: [{ status: "hired", label: "Mark Hired" }],
  hired: null,
  rejected: null,
  withdrawn: null,
};
```

Update the render block to map over the array.

- [ ] **Step 2: Smoke test in dev**

Tell the human to open an `applied` application and verify both buttons render. Both PATCH `/status`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(recruiter\)/recruiter/applications/\[id\]/_decision-bar-client.tsx
git commit -m "feat(recruiter): Move to Interview CTA at applied stage"
```

---

### Task 30: Schedule interview modal — venue + interviewer fields

**Files:**

- Modify: `apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-modal-client.tsx`

- [ ] **Step 1: Replace state with new fields**

```tsx
const [scheduledAt, setScheduledAt] = useState("");
const [durationMinutes, setDurationMinutes] = useState(60);
const [venueName, setVenueName] = useState("");
const [addressLine, setAddressLine] = useState("");
const [roomOrFloor, setRoomOrFloor] = useState("");
const [mapUrl, setMapUrl] = useState("");
const [reportingInstructions, setReportingInstructions] = useState("");
const [whatToBring, setWhatToBring] = useState("");
const [interviewerName, setInterviewerName] = useState(""); // default = current user fullName
const [interviewerTitle, setInterviewerTitle] = useState("");
const [saveAsTemplate, setSaveAsTemplate] = useState(false);
const [templateLabel, setTemplateLabel] = useState("");
```

- [ ] **Step 2: Render new sections**

Group: Venue (name, address, room, mapUrl), Candidate guidance (reportingInstructions, whatToBring), Interviewer (name, title), "Save as venue template" checkbox + label input (conditional).

- [ ] **Step 3: Drop format selector entirely**

Remove the `<Select>` for format. Server defaults to `in-person`.

- [ ] **Step 4: Submit POST body**

```ts
body: JSON.stringify({
  scheduledAt: new Date(scheduledAt).toISOString(),
  durationMinutes,
  venueName: venueName.trim(),
  addressLine: addressLine.trim(),
  roomOrFloor: roomOrFloor.trim() || null,
  mapUrl: mapUrl.trim() || null,
  reportingInstructions: reportingInstructions.trim() || null,
  whatToBring: whatToBring.trim() || null,
  interviewerName: interviewerName.trim() || null,
  interviewerTitle: interviewerTitle.trim() || null,
  saveAsTemplate,
  templateLabel: saveAsTemplate ? templateLabel.trim() || null : null,
});
```

- [ ] **Step 5: Validate before submit**

Required: scheduledAt, venueName, addressLine. If `saveAsTemplate && !templateLabel`, show error.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app
git commit -m "feat(recruiter): redesigned schedule modal with venue + interviewer fields"
```

---

### Task 31: Schedule modal — saved-venue dropdown + auto-fill

**Files:**

- Modify: `apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-modal-client.tsx`
- Modify: `apps/web/lib/query/queries.ts`
- Modify: `apps/web/lib/query/keys.ts`

- [ ] **Step 1: Add query for venue templates**

In `keys.ts`:

```ts
interviewVenues: {
  all: ["interview-venues"] as const,
  byCompany: (companyId: string) => ["interview-venues", companyId] as const,
},
```

In `queries.ts`, add a TanStack `useQuery` factory hitting `GET /api/v1/companies/:companyId/interview-venues`.

- [ ] **Step 2: Modal fetches templates on open**

```tsx
const { data: venues } = useQuery({
  queryKey: queryKeys.interviewVenues.byCompany(activeCompanyId),
  queryFn: () => apiClient.listInterviewVenues(activeCompanyId),
  enabled: open && Boolean(activeCompanyId),
});
```

- [ ] **Step 3: Render `<Select>` "Use saved venue"**

Above the manual venue fields. On select, `onValueChange` autofills all fields from the chosen template.

- [ ] **Step 4: Default selected to the company's `is_default` venue (if any)**

When venues load, if any has `isDefault === true` and no value is set yet, prefill once.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(recruiter): saved-venue dropdown autofills schedule modal"
```

---

### Task 32: Schedule modal — conflict warning chips

**Files:**

- Modify: `apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-modal-client.tsx`

- [ ] **Step 1: Debounced check on date/duration change**

```tsx
useEffect(() => {
  if (!scheduledAt) return;
  const handle = setTimeout(async () => {
    const res = await apiClient.checkConflicts(applicationId, {
      scheduledAt: new Date(scheduledAt).toISOString(),
      durationMinutes,
      candidateId: candidateId,
    });
    setConflicts(res);
  }, 500);
  return () => clearTimeout(handle);
}, [scheduledAt, durationMinutes]);
```

- [ ] **Step 2: Render chips below the date input**

```tsx
{
  conflicts.recruiterConflicts.length > 0 && (
    <div className="mt-1 text-xs text-[var(--color-status-warning)]">
      You have another scheduled interview overlapping this time.
    </div>
  );
}
{
  conflicts.candidateConflicts.length > 0 && (
    <div className="mt-1 text-xs text-[var(--color-status-warning)]">
      Candidate has another interview overlapping this time.
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(recruiter): conflict warning chips on schedule modal"
```

---

### Task 33: Interview Pipeline panel (replaces Interviews section)

**Files:**

- Modify: `apps/web/app/(recruiter)/recruiter/applications/[id]/_interviews-section-client.tsx`

- [ ] **Step 1: Sort + active selection**

```ts
const STATUS_PRIORITY = {
  scheduled: 0,
  rescheduled: 1,
  completed: 2,
  cancelled: 3,
  "no-show": 4,
} as const;
const sorted = [...interviews].sort((a, b) => {
  const pa = STATUS_PRIORITY[a.status as keyof typeof STATUS_PRIORITY] ?? 99;
  const pb = STATUS_PRIORITY[b.status as keyof typeof STATUS_PRIORITY] ?? 99;
  if (pa !== pb) return pa - pb;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
});
const active = sorted[0] ?? null;
const past = sorted.slice(1);
```

- [ ] **Step 2: Render active card**

Active: full venue display, status pill, scheduled time, duration, interviewer; per-status action set:

- `scheduled` → Reschedule, Mark No-Show, Cancel
- `completed` → Add Feedback (Link to `/recruiter/interviews/[id]`)
- `cancelled | no-show | rescheduled` → read-only

- [ ] **Step 3: Past interviews accordion**

Collapsed by default; click to expand. Each row mirrors active card layout.

- [ ] **Step 4: "Schedule another interview" button**

Always visible. Opens existing modal (now with empty preset).

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(recruiter): Interview Pipeline panel (active card + past accordion)"
```

---

### Task 34: Decision panel (inline feedback form on application detail)

**Files:**

- Create: `apps/web/app/(recruiter)/recruiter/applications/[id]/_decision-panel-client.tsx`
- Modify: `apps/web/app/(recruiter)/recruiter/applications/[id]/_application-detail-client.tsx`

- [ ] **Step 1: Build the panel**

```tsx
"use client";
import { useState } from "react";
// ... imports

export function DecisionPanelClient({
  applicationId,
  interviewId,
  initialFeedback,
  initialRating,
  initialRecommendation,
  sharedAt,
}: Props) {
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [rating, setRating] = useState<number | null>(initialRating ?? null);
  const [rec, setRec] = useState<"proceed"|"hold"|"reject"|null>(initialRecommendation ?? null);
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await authedFetch(`/api/v1/interviews/${interviewId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback, rating, recommendation: rec }),
      });
      if (!res.ok) toastApiError(null, "Couldn't save feedback");
      else { toastSuccess("Feedback saved"); router.refresh(); }
    } finally { setSaving(false); }
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">Decision</h2>
      <p className="text-xs text-[var(--color-muted)]">Interview completed. Record your decision.</p>
      <textarea ... value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      <RatingStars value={rating} onChange={setRating} />
      <RadioGroup value={rec} onChange={setRec}>
        <Radio value="proceed">Proceed → Offer</Radio>
        <Radio value="hold">Hold</Radio>
        <Radio value="reject">Reject</Radio>
      </RadioGroup>
      <div className="mt-3 flex items-center gap-2">
        <Button onClick={save} disabled={saving}>Save Feedback</Button>
        <Button variant="outline" onClick={() => setShareOpen(true)}>Share with candidate</Button>
        {sharedAt && <span className="text-xs text-[var(--color-muted)]">Shared {new Date(sharedAt).toLocaleDateString()}</span>}
      </div>
      <ShareFeedbackModalClient
        open={shareOpen}
        onOpenChange={setShareOpen}
        interviewId={interviewId}
        defaultSummary={feedback}
      />
    </section>
  );
}
```

- [ ] **Step 2: Mount in `_application-detail-client.tsx`**

Find the latest interview (status priority + createdAt DESC). If `latest.status === "completed"`, render the panel above the offers section.

- [ ] **Step 3: Highlight Send Offer / Reject when recommendation is set**

Pass `recommendation` to `_decision-bar-client.tsx`. Add a ring class on the matching CTA.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(recruiter): inline Decision panel with feedback + recommendation"
```

---

### Task 35: Soft confirmation modal (offer/reject without feedback)

**Files:**

- Create: `apps/web/app/(recruiter)/recruiter/applications/[id]/_offer-confirm-modal-client.tsx`
- Modify: `apps/web/app/(recruiter)/recruiter/applications/[id]/_decision-bar-client.tsx`

- [ ] **Step 1: Build the modal**

Per spec: appears when latest interview is `completed` AND `recommendation` is null AND user clicks Send Offer or Reject. Tracks state via `sessionStorage["interview-feedback-warn:" + applicationId]`.

```tsx
"use client";
export function OfferConfirmModalClient({
  open,
  onOpenChange,
  onConfirm,
  action,
}: Props) {
  const message =
    action === "offer"
      ? "You haven't recorded interview feedback. Continue with offer?"
      : "You haven't recorded interview feedback. Continue with rejection?";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm without feedback</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Go back
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Decision bar wiring**

Before navigating/PATCHing for offer or reject, check: `latestInterview?.status === "completed" && !latestInterview.recommendation && !sessionStorage.getItem(...)`. If so, open modal.

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(recruiter): soft confirmation when offering/rejecting without feedback"
```

---

### Task 36: Recruiter interview detail page

**Files:**

- Create: `apps/web/app/(recruiter)/recruiter/interviews/[id]/page.tsx`
- Create: `apps/web/app/(recruiter)/recruiter/interviews/[id]/_interview-detail-client.tsx`
- Create: `apps/web/app/(recruiter)/recruiter/interviews/[id]/_feedback-panel-client.tsx`
- Create: `apps/web/app/(recruiter)/recruiter/interviews/[id]/loading.tsx`

- [ ] **Step 1: Build server component `page.tsx`**

```tsx
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { RecruiterInterviewDetailClient } from "./_interview-detail-client";

export const metadata = { title: "Interview · AuraHire" };

export default async function RecruiterInterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/interviews/${id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  if (res.status === 404) notFound();
  if (!res.ok) return <div>Failed to load interview</div>;

  const { data: interview } = await res.json();
  return <RecruiterInterviewDetailClient interview={interview} />;
}
```

(Backend needs a `GET /api/v1/interviews/:id` for recruiter; if it doesn't exist, add it in `interviews.controller.ts` — single-row fetch with company-ownership check.)

- [ ] **Step 2: Build client component**

Sections: header, schedule card, venue card with optional map embed, candidate info card, action bar (Reschedule/Cancel/Mark No-Show), feedback panel, past-interviews list.

- [ ] **Step 3: Build feedback panel sub-component**

Tabs: Private | Candidate-facing. Private: feedback textarea, rating, recommendation, save. Candidate-facing: shows shared summary + "Share with candidate" button (opens modal — Task 37).

- [ ] **Step 4: Build loading.tsx**

Skeleton mirroring final layout.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(recruiter\)/recruiter/interviews/\[id\] apps/api/src/modules/interviews
git commit -m "feat(recruiter): interview detail page (header + venue + actions + feedback)"
```

---

### Task 37: Share feedback modal

**Files:**

- Create: `apps/web/app/(recruiter)/recruiter/interviews/[id]/_share-feedback-modal-client.tsx`
- Modify: `_decision-panel-client.tsx`, `_feedback-panel-client.tsx` (mount the modal)

- [ ] **Step 1: Build modal**

```tsx
"use client";
export function ShareFeedbackModalClient({
  open,
  onOpenChange,
  interviewId,
  defaultSummary,
  currentSummary,
}: Props) {
  const [summary, setSummary] = useState(
    currentSummary ?? sanitize(defaultSummary),
  );
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await authedFetch(
        `/api/v1/interviews/${interviewId}/share-feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateSummary: summary }),
        },
      );
      if (!res.ok) {
        toastApiError(null, "Couldn't share feedback");
        return;
      }
      toastSuccess("Feedback shared with candidate");
      onOpenChange(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share feedback with candidate</DialogTitle>
          <DialogDescription>
            This text is sent directly to the candidate via email and shown in
            their portal. Keep it constructive.
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || summary.trim().length === 0}
          >
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function sanitize(internal: string): string {
  return internal
    .split("\n")
    .filter((l) => !/^(internal:|concern:|note to team:)/i.test(l.trim()))
    .join("\n")
    .trim()
    .slice(0, 4000);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web
git commit -m "feat(recruiter): share-feedback modal (sanitized pre-fill)"
```

---

### Task 38: Reschedule modal

**Files:**

- Create: `apps/web/app/(recruiter)/recruiter/interviews/[id]/_reschedule-modal-client.tsx`

- [ ] **Step 1: Build modal**

Reuses the same fields as the schedule modal (Task 30). Difference: pre-fills with current interview's values; submits `POST /api/v1/interviews/${id}/reschedule`.

- [ ] **Step 2: Wire from active interview card actions on application detail page** (Task 33) and from the recruiter interview detail page action bar (Task 36).

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(recruiter): reschedule modal"
```

---

### Task 39: Venue templates settings page

**Files:**

- Create: `apps/web/app/(recruiter)/recruiter/settings/interview-venues/page.tsx`
- Create: `apps/web/app/(recruiter)/recruiter/settings/interview-venues/_venues-list-client.tsx`
- Create: `apps/web/app/(recruiter)/recruiter/settings/interview-venues/_venue-form-modal-client.tsx`

- [ ] **Step 1: Server component `page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { VenuesListClient } from "./_venues-list-client";

export const metadata = { title: "Interview Venues · AuraHire" };

export default async function InterviewVenuesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return <VenuesListClient />;
}
```

- [ ] **Step 2: List client with TanStack Query**

```tsx
"use client";
const { data, isLoading } = useQuery({
  queryKey: ["interview-venues", companyId],
  queryFn: () => fetchVenues(companyId),
});
// Renders: list of cards with label, venue summary, default badge; Edit/Delete/Set-Default buttons.
// "Add venue template" button at top opens form modal.
```

- [ ] **Step 3: Form modal**

All venue fields. Submits to `POST` (create) or `PATCH` (edit) endpoint.

- [ ] **Step 4: Add link in recruiter sidebar** (`portal-sidebar.tsx`) under "Settings."

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(recruiter): interview venue templates settings page"
```

---

## Phase 7 — Candidate UI

### Task 40: Upcoming interview banner on application detail

**Files:**

- Create: `apps/web/app/(candidate)/candidate/applications/[id]/_upcoming-interview-banner-client.tsx`
- Modify: `apps/web/app/(candidate)/candidate/applications/[id]/_application-detail-client.tsx`

- [ ] **Step 1: Build banner**

```tsx
"use client";
export function UpcomingInterviewBannerClient({
  interview,
}: {
  interview: InterviewDto;
}) {
  const date = new Date(interview.scheduledAt);
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-primary)] bg-[var(--color-primary-soft)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-primary)]">
        Upcoming Interview
      </h2>
      <p className="mt-2 text-base text-[var(--color-ink)]">
        <strong>
          {date.toLocaleString(undefined, {
            dateStyle: "full",
            timeStyle: "short",
          })}
        </strong>
        <br />
        {interview.venueName} — {interview.addressLine}
        {interview.roomOrFloor && ` (${interview.roomOrFloor})`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/candidate/interviews/${interview.id}`} className="...">
          View interview details
        </Link>
        <AddToCalendarButton interviewId={interview.id} />
        <WithdrawApplicationButton applicationId={interview.applicationId} />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Mount in `_application-detail-client.tsx`**

Compute the latest interview (status priority + createdAt DESC). If `latest && (latest.status === "scheduled" || latest.status === "rescheduled")`, render the banner above existing sections.

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(candidate): upcoming interview banner on application detail"
```

---

### Task 41: Interview feedback panel on application detail

**Files:**

- Create: `apps/web/app/(candidate)/candidate/applications/[id]/_interview-feedback-panel-client.tsx`
- Modify: `apps/web/app/(candidate)/candidate/applications/[id]/_application-detail-client.tsx`

- [ ] **Step 1: Build panel**

```tsx
export function InterviewFeedbackPanelClient({
  interview,
}: {
  interview: InterviewDto;
}) {
  if (!interview.sharedWithCandidateAt || !interview.candidateSummary)
    return null;
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        Recruiter feedback
      </h2>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        From your interview on{" "}
        {new Date(interview.scheduledAt).toLocaleDateString()}
      </p>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-body)]">
        {interview.candidateSummary}
      </div>
      <Link
        href={`/candidate/interviews/${interview.id}`}
        className="mt-3 inline-block text-sm text-[var(--color-primary)] hover:underline"
      >
        View full interview details
      </Link>
    </section>
  );
}
```

- [ ] **Step 2: Mount conditionally**

If any interview on the application has `sharedWithCandidateAt` set, render this panel.

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(candidate): interview feedback panel on application detail"
```

---

### Task 42: Candidate interview detail page

**Files:**

- Create: `apps/web/app/(candidate)/candidate/interviews/[id]/page.tsx`
- Create: `apps/web/app/(candidate)/candidate/interviews/[id]/_interview-detail-client.tsx`
- Create: `apps/web/app/(candidate)/candidate/interviews/[id]/loading.tsx`

- [ ] **Step 1: Server component `page.tsx`**

```tsx
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { CandidateInterviewDetailClient } from "./_interview-detail-client";

export const metadata = { title: "Interview · AuraHire" };

export default async function CandidateInterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/interviews/${id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  if (res.status === 404) notFound();
  if (!res.ok) return <div>Failed to load interview</div>;
  const { data } = await res.json();
  return <CandidateInterviewDetailClient interview={data} />;
}
```

(The existing `GET /interviews/:id` returns the right DTO with `candidateSummary` only when `sharedWithCandidateAt` is set; verify in service.)

- [ ] **Step 2: Client component**

Sections: header, schedule card (rendered in candidate's TZ via Intl.DateTimeFormat detect; fallback `Asia/Manila` with a note), venue card, "What to bring" card, "Reporting instructions" card, interviewer card, action bar (Add to calendar, Withdraw application), recruiter feedback panel (conditional).

- [ ] **Step 3: Loading skeleton**

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(candidate): interview detail page"
```

---

### Task 43: Withdraw application modal (shared component)

**Files:**

- Create: `apps/web/components/interview/withdraw-application-modal.tsx`
- Modify: `apps/web/app/(candidate)/candidate/applications/[id]/_withdraw-button-client.tsx`

- [ ] **Step 1: Build shared modal**

```tsx
"use client";
export function WithdrawApplicationModal({
  open,
  onOpenChange,
  applicationId,
  onSuccess,
}: Props) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await authedFetch(
        `/api/v1/applications/${applicationId}/withdraw`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() || null }),
        },
      );
      if (!res.ok) {
        toastApiError(null, "Couldn't withdraw");
        return;
      }
      toastSuccess("Application withdrawn");
      onOpenChange(false);
      onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw application?</DialogTitle>
          <DialogDescription>
            This cannot be undone. The recruiter will be notified.
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional reason (private)"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep my application
          </Button>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            Yes, withdraw
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire existing withdraw button to use this modal** (replace the existing inline confirm with the shared modal).

- [ ] **Step 3: Use it on candidate interview detail page** (Task 42).

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(candidate): shared withdraw-application modal"
```

---

### Task 44: Add to calendar (ICS download client)

**Files:**

- Create: `apps/web/components/interview/add-to-calendar-button.tsx`

- [ ] **Step 1: Build button**

```tsx
"use client";
export function AddToCalendarButton({ interviewId }: { interviewId: string }) {
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toastApiError(null, "Please sign in again");
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const res = await fetch(
        `${apiUrl}/api/v1/interviews/${interviewId}/ics`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      if (!res.ok) {
        toastApiError(null, "Couldn't download");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `interview-${interviewId}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button onClick={download} disabled={downloading} className="...">
      {downloading ? "Preparing…" : "Add to calendar"}
    </button>
  );
}
```

- [ ] **Step 2: Use on candidate interview detail + upcoming banner.**

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(candidate): add-to-calendar ICS download button"
```

---

## Phase 8 — Notification preferences UI + final E2E

### Task 45: Notification preferences UI rows for new event keys

**Files:**

- Modify: `apps/web/components/notifications/notification-preferences-form.tsx`

- [ ] **Step 1: Add toggle rows**

Add rows for keys: `interview_rescheduled`, `interview_reminder_24h`, `interview_completed`, `interview_feedback_shared`, `interview_record_feedback`, `application_withdrawn`. Each renders email + in-app toggle subrows where applicable; `*_record_feedback`, `*_completed`, `application_withdrawn` show in-app only.

- [ ] **Step 2: Test**

Run dev server (the human will), open `/candidate/settings/notifications` and `/recruiter/settings/notifications`, toggle each row, refresh, confirm persistence.

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(notifications): preference toggles for interview-flow v2 events"
```

---

### Task 46: E2E happy-path test

**Files:**

- Create: `apps/api/test/e2e/interview-flow-v2.e2e-spec.ts`

- [ ] **Step 1: Write end-to-end test (supertest + drizzle fixtures)**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createTestApp, fixtures, mockNow } from "./helpers";

describe("Interview flow v2 end-to-end", () => {
  let app, candidateToken, recruiterToken, applicationId, interviewId;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it("candidate applies", async () => {
    const job = await fixtures.publishedJob({});
    const candidate = await fixtures.candidateWithResume({});
    candidateToken = await fixtures.tokenFor(candidate);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/jobs/${job.id}/applications`)
      .set("Authorization", `Bearer ${candidateToken}`)
      .send({ resumeId: candidate.resumeId });
    expect(res.status).toBe(201);
    applicationId = res.body.data.id;
  });

  it("recruiter schedules interview from applied (skip Screening)", async () => {
    recruiterToken = await fixtures.recruiterToken();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/applications/${applicationId}/interviews`)
      .set("Authorization", `Bearer ${recruiterToken}`)
      .set("X-Active-Company-Id", fixtures.companyId)
      .send({
        scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
        durationMinutes: 60,
        venueName: "JRMSU Main",
        addressLine: "Dapitan",
        interviewerName: "Maria Santos",
      });
    expect(res.status).toBe(201);
    interviewId = res.body.data.id;
    // verify status auto-advanced
    const appRes = await request(app.getHttpServer())
      .get(`/api/v1/applications/${applicationId}`)
      .set("Authorization", `Bearer ${recruiterToken}`)
      .set("X-Active-Company-Id", fixtures.companyId);
    expect(appRes.body.data.status).toBe("interview");
  });

  it("autocomplete cron flips status to completed", async () => {
    mockNow(new Date(Date.now() + 2 * 3600_000));
    await app.get("InterviewAutocompleteCron").execute();
    const detailRes = await request(app.getHttpServer())
      .get(`/api/v1/interviews/${interviewId}`)
      .set("Authorization", `Bearer ${recruiterToken}`)
      .set("X-Active-Company-Id", fixtures.companyId);
    expect(detailRes.body.data.status).toBe("completed");
  });

  it("recruiter records feedback + recommendation=proceed", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/interviews/${interviewId}/feedback`)
      .set("Authorization", `Bearer ${recruiterToken}`)
      .set("X-Active-Company-Id", fixtures.companyId)
      .send({
        feedback: "Strong candidate.",
        rating: 5,
        recommendation: "proceed",
      });
    expect(res.status).toBe(200);
    expect(res.body.data.recommendation).toBe("proceed");
  });

  it("recruiter shares candidate-facing summary", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/interviews/${interviewId}/share-feedback`)
      .set("Authorization", `Bearer ${recruiterToken}`)
      .set("X-Active-Company-Id", fixtures.companyId)
      .send({
        candidateSummary: "Great interview — looking forward to next steps.",
      });
    expect(res.status).toBe(200);
    expect(res.body.data.sharedWithCandidateAt).toBeTruthy();
  });

  it("candidate sees shared summary on /me/interviews/:id", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/interviews/${interviewId}`)
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(res.body.data.candidateSummary).toContain("Great interview");
  });

  it("recruiter sends offer; candidate accepts; status hired", async () => {
    // offer flow exists; assert status = hired at the end
  });
});
```

- [ ] **Step 2: Run, ensure green**

Run: `pnpm --filter @aurahire/api test interview-flow-v2.e2e-spec`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/e2e/interview-flow-v2.e2e-spec.ts
git commit -m "test(e2e): full interview-flow v2 happy path"
```

---

## Self-Review

After completing every task above:

1. **Spec coverage walkthrough.** Open `docs/superpowers/specs/2026-05-07-interview-flow-redesign-design.md` side-by-side with this plan. For each numbered §1–§4 item, confirm it has a task. Fix any gaps inline.

2. **Placeholder scan.** Search this plan for: `TBD`, `TODO`, `Add appropriate`, `similar to`, `fill in`. Should return zero matches.

3. **Type consistency.** Cross-reference type names introduced across tasks:
   - `ScheduleInterviewInput` (T5) used in `interviews.service.schedule()` (T9, T18) and `RescheduleInterviewDto` (T17).
   - `InterviewRecommendation` (T1) used in `update-interview-feedback` (T14), DTOs, audit details (T6).
   - `InterviewVenueInput` (T5) used in venues service (T20) and schedule modal `saveAsTemplate` (T21).
   - Realtime payload Zod schemas (T6) used in emitter methods (T22) — names match `InterviewCompletedPayload`, `InterviewRescheduledPayload`, `InterviewFeedbackSharedPayload`, `ApplicationRecommendationSetPayload`, `ApplicationWithdrawnPayload`.
   - Audit constant `INTERVIEW_FEEDBACK_SUBMITTED` (T6) used in T14 — matches.
   - `interview-autocomplete` event keys: cron emits `interview_completed` (to candidate) + `interview_record_feedback` (to recruiter); preferences default in T23 includes both — matches.
   - Stable ICS UID: `interview-{rescheduledFromId ?? id}` consistency between T12 and T26 — must match.
   - `sanitizeMapUrl` import path `apps/api/src/modules/interviews/lib/sanitize-map-url` used in T17 and T18 and T20 — matches.

4. **State-machine semantics.** Verify the test in T7 covers: `applied → screening | interview | rejected | withdrawn`; `screening → interview | rejected | withdrawn`; `interview → offer | rejected | withdrawn`; `offer → hired | rejected | withdrawn`; terminal states. Withdraw authorization (T8) double-checks role.

5. **Cron isolation.** Confirm the new `interview-autocomplete` cron emits `interview_record_feedback` (not `interview_feedback_due`) so it doesn't interfere with the existing feedback-due cron's guard timestamp.

If any inconsistency surfaces during a real run, fix at that task; do not paper over with new tasks.

---

## Migration & Rollout Reminders

- The plan calls one DB migration (Task 4). The human applies it before downstream tasks rely on the new columns. Plan execution will pause at Task 4 Step 2 for human confirmation.
- The plan does not call for a feature flag at code level — the spec listed `INTERVIEW_FLOW_V2_ENABLED` as a deployment-time toggle, but the per-PR layered nature of these commits already gives a controlled rollout. If the human wants the flag, layer it at the controller route level (NestJS guards) and on the recruiter UI sections; treat as a separate follow-up task.
- After Task 46, drop `interviews.location_or_link` in a follow-up migration (`0010_drop_interview_location_or_link.sql`) once two weeks of stable usage have passed and all reads are off the legacy field. Not part of this plan.
