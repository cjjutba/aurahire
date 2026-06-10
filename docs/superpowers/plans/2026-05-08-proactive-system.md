# Proactive System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AuraHire proactive end-to-end - Profile Score auto-computes at the end of onboarding, match scores compute on-view, every lifecycle event fires a notification with realtime delivery, and every portal sidebar gains a Vercel-style bottom rail with profile dropdown + notifications popover.

**Architecture:** One pattern repeated across every change: _event → handler → realtime emit + DB persistence + UI subscriber_. Backend uses NestJS + BullMQ + `@nestjs/schedule`. Realtime uses the existing Socket.IO `EventsService` with the existing `Rooms.user(id)` helper. Frontend uses Next.js 16 App Router, TanStack Query, Radix UI Popover, and a new `useUserNotifications()` hook for realtime subscription.

**Tech Stack:** TypeScript strict, NestJS, Drizzle ORM, BullMQ, Socket.IO, `@nestjs/schedule`, Next.js 16, React 19, Radix UI, TanStack Query, Zod, Vitest, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-08-onboarding-autoscore-and-buttonless-match-design.md`

---

## File Structure

This plan creates and modifies the following files. Each file has one clear responsibility.

### Backend (`apps/api/`) - created

- `src/modules/scoring/handlers/profile-score-recompute.handler.ts` - handles candidate.profile_changed / preferences_changed events; marks stale and enqueues recompute.
- `src/modules/scoring/processors/profile-score-recompute.processor.ts` - BullMQ processor that runs the actual recompute.
- `src/modules/notifications/notifications.scheduler.ts` - `@Cron` decorated module hosting all five new crons.
- `src/modules/notifications/dto/archive-notification.dto.ts` - DTO for the archive-all endpoint (empty body).
- `src/modules/scoring/dto/match-preview-rate-limit.exception.ts` - custom exception mapping to `429 DAILY_AI_LIMIT`.

### Backend - modified

- `src/modules/candidate-profiles/candidate-profiles.service.ts` - extend `completeOnboarding`, `updatePersonal`, `updatePreferences` to mark stale + enqueue recompute. Server-side guard `enqueueProfileScoreIfMissing`.
- `src/modules/candidate-profiles/candidate-profiles.controller.ts` - change `complete-onboarding` response to include the score.
- `src/modules/scoring/scoring.service.ts` - add `computeMatchPreviewOnView`, redis rate limit check, emit realtime events on writes.
- `src/modules/scoring/scoring.controller.ts` - delegate `POST /scoring/match-preview/:jobId` to `computeMatchPreviewOnView`.
- `src/modules/applications/applications.service.ts` - add `notifications.emit()` calls on create + every status transition.
- `src/modules/offers/offers.service.ts` - add emit calls on accept + decline + (cron-driven) expiration.
- `src/modules/interviews/interviews.service.ts` - plumb email sends for reschedule + share-feedback.
- `src/modules/resumes/resumes.service.ts` - auto-promote on default delete; 409 on last-resume.
- `src/modules/notifications/notifications.service.ts` - add `archive`, `archiveAll` methods; emit realtime on every mutation.
- `src/modules/notifications/notifications.controller.ts` - add archive + archive-all endpoints.
- `src/modules/notifications/notifications.repository.ts` - add archive methods.
- `src/realtime/events.service.ts` - add `emitMatchPreviewCreated`, `emitProfileScoreUpdated`, `emitNotificationCreated`, `emitNotificationRead`, `emitNotificationArchived`, `emitNotificationArchiveAll`.
- `apps/api/scripts/seed-db.ts` - no change required, but verify after migration.

### Database (`packages/db/`) - modified

- `schema/scoring.ts` - add `stale_at` to `profile_scores`, extend match_preview_source enum.
- `schema/notifications.ts` - add `archived_at` if not present.
- `schema/interviews.ts` - add `feedback_reminder_sent_at`.
- `schema/jobs.ts` - add `archived_reason`.
- One new migration SQL file (Drizzle will generate).

### Shared (`packages/shared/`) - modified

- `src/realtime/events.ts` - add new realtime event names + payloads.
- `src/realtime/index.ts` - re-export.
- `src/schemas/scoring.ts` (or equivalent) - Zod schemas for new realtime payloads.

### Frontend (`apps/web/`) - created

- `app/onboarding/candidate/analyzing/page.tsx` - server component shell.
- `app/onboarding/candidate/analyzing/_analyzing-client.tsx` - client component with the state machine.
- `components/portal/sidebar-bottom-rail.tsx` - avatar + name + ⋯ + bell layout.
- `components/portal/sidebar-profile-popover.tsx` - Radix Popover with profile dropdown content.
- `components/portal/sidebar-notifications-popover.tsx` - Radix Popover with Inbox/Archive tabs.
- `lib/realtime/use-user-notifications.ts` - hook subscribing to `user:{id}` for notification events.
- `lib/realtime/use-candidate-realtime.ts` - hook subscribing to `user:{id}` for scoring events (the spec calls this room `candidate:{id}`; in implementation it's the existing `Rooms.user(candidateId)` since candidateId == userId).

### Frontend - modified

- `app/onboarding/candidate/preferences/page.tsx` (and its client) - change redirect target to `/onboarding/candidate/analyzing`.
- `app/(candidate)/candidate/_components/profile-score-card-client.tsx` - remove "Compute my score" button; render score directly with stale handling.
- `app/(candidate)/candidate/jobs/[id]/_match-preview-client.tsx` - remove "See my match" button; auto-compute on mount; 429 banner.
- `app/(candidate)/candidate/_dashboard-client.tsx` - `RecommendedForYouSection` shimmer + realtime subscription.
- `app/(candidate)/candidate/resume/_resume-client.tsx` - remove confirmation modal on set-default; replace with optimistic + undo toast.
- Three portal sidebar files (paths verified during implementation in Phase 3) - wire the new bottom rail.

---

## Phase 1 - Backend Foundation (PR 1)

This phase produces a backend that auto-computes Profile Score on onboarding completion, has the on-view rate limit, recomputes on input changes, emits notifications on every lifecycle event, and runs the five new crons. Frontend behavior is unchanged at end of Phase 1; users still click manual buttons, but a power-user calling the API would observe the new behavior.

### Task 1: DB migration - schema additions

**Files:**

- Modify: `packages/db/src/schema/scoring.ts`
- Modify: `packages/db/src/schema/notifications.ts`
- Modify: `packages/db/src/schema/interviews.ts`
- Modify: `packages/db/src/schema/jobs.ts`
- Create: a new Drizzle migration file (auto-generated)

- [ ] **Step 1: Add `stale_at` to `profile_scores` and extend `matchPreviewSourceEnum`**

In `packages/db/src/schema/scoring.ts`, update the table definition. Find the existing `profileScoresTable` and add the new column:

```typescript
// add to profileScoresTable column list:
staleAt: timestamp("stale_at", { withTimezone: true }),
```

Find the existing `matchPreviewSourceEnum` (likely `pgEnum("match_preview_source", ["system", "candidate"])`) and add the new value:

```typescript
export const matchPreviewSourceEnum = pgEnum("match_preview_source", [
  "system",
  "candidate",
  "candidate_view", // NEW
]);
```

- [ ] **Step 2: Add `archived_at` to notifications**

In `packages/db/src/schema/notifications.ts`, locate `notificationsTable`. If `archivedAt` does not already exist, add:

```typescript
archivedAt: timestamp("archived_at", { withTimezone: true }),
```

If a `dismissedAt` column already exists with the same semantics, reuse it instead and adjust task references to `dismissed_at` where this plan says `archived_at`.

- [ ] **Step 3: Add `feedback_reminder_sent_at` to interviews**

In `packages/db/src/schema/interviews.ts`, add to `interviewsTable`:

```typescript
feedbackReminderSentAt: timestamp("feedback_reminder_sent_at", { withTimezone: true }),
```

- [ ] **Step 4: Add `archived_reason` to jobs**

In `packages/db/src/schema/jobs.ts`, add to `jobsTable`:

```typescript
archivedReason: text("archived_reason"),
```

- [ ] **Step 5: Generate the migration**

The user will run the Drizzle migration generator manually. Tell the user:

> "Run from the repo root: `pnpm -F @aurahire/db db:generate`. This produces a new SQL file in `packages/db/drizzle/`. Review the SQL - it should include the enum addition, four ALTER TABLE statements, and the partial index for `profile_scores`. If the partial index is missing, add manually:
>
> ```sql
> CREATE INDEX idx_profile_scores_candidate_current
>   ON profile_scores (candidate_id, computed_at DESC)
>   WHERE stale_at IS NULL;
>
> CREATE INDEX IF NOT EXISTS idx_notifications_user_inbox
>   ON notifications (user_id, created_at DESC)
>   WHERE archived_at IS NULL AND read_at IS NULL;
>
> CREATE INDEX IF NOT EXISTS idx_notifications_user_archive
>   ON notifications (user_id, archived_at DESC)
>   WHERE archived_at IS NOT NULL;
> ```
>
> Then apply the migration in your local environment: `pnpm -F @aurahire/db db:migrate`."

(Per CLAUDE.md, the agent does not run migrations.)

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/scoring.ts packages/db/src/schema/notifications.ts packages/db/src/schema/interviews.ts packages/db/src/schema/jobs.ts packages/db/drizzle/
git commit -m "feat(db): add stale_at, archived_at, feedback_reminder_sent_at, archived_reason"
```

---

### Task 2: scoring_config - new keys

**Files:**

- Modify: `apps/api/src/modules/scoring/scoring.service.ts` (or wherever the config defaults live - likely `apps/api/src/ai/config/` - verify)

- [ ] **Step 1: Locate scoring_config defaults**

Run: `grep -rn "onview_daily_cap\|precompute_top_n\|scoring_config" apps/api/src/ packages/db/src/schema/`

Identify whether `scoring_config` is a JSON column on a table or a constants file.

- [ ] **Step 2: Add three new keys with defaults**

Wherever the defaults live, add:

```typescript
{
  // ...existing keys...
  onview_daily_cap: 100,
  precompute_top_n: 25,                   // already exists; verify and reuse
  analyzing_screen_wallclock_ms: 10000,
  interview_reminder_lead_hours: 24,
  offer_expiry_warning_lead_hours: 24,
  feedback_reminder_lead_hours: 24,
}
```

If `precompute_top_n` already exists with a different value, do not change it.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/scoring/
git commit -m "feat(scoring): add proactive-system config keys"
```

---

### Task 3: ScoringService.computeMatchPreviewOnView - failing test

**Files:**

- Test: `apps/api/src/modules/scoring/scoring.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/modules/scoring/scoring.service.spec.ts`:

```typescript
describe("computeMatchPreviewOnView", () => {
  it("writes preview row with source = 'candidate_view' and increments redis counter", async () => {
    const candidateId = "test-candidate-id";
    const jobId = "test-job-id";
    // arrange: seeded job + candidate + parsed default resume
    // (use existing test helpers in the spec file for fixture setup)

    const result = await service.computeMatchPreviewOnView(candidateId, jobId);

    expect(result.source).toBe("candidate_view");
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);

    const redisKey = `scoring:onview:${candidateId}:${new Date().toISOString().slice(0, 10)}`;
    const count = Number(await redis.get(redisKey));
    expect(count).toBe(1);
  });

  it("returns cached preview without incrementing counter on cache hit", async () => {
    const candidateId = "test-candidate-id";
    const jobId = "test-job-id";
    await service.computeMatchPreviewOnView(candidateId, jobId); // first call

    const redisKeyBefore = `scoring:onview:${candidateId}:${new Date().toISOString().slice(0, 10)}`;
    const countBefore = Number(await redis.get(redisKeyBefore));

    const second = await service.computeMatchPreviewOnView(candidateId, jobId); // cache hit

    const countAfter = Number(await redis.get(redisKeyBefore));
    expect(countAfter).toBe(countBefore); // not incremented
    expect(second).toBeDefined();
  });

  it("throws TooManyRequestsException with code DAILY_AI_LIMIT when cap exceeded", async () => {
    const candidateId = "test-candidate-id";
    const jobId = "test-job-id";
    const cap = 100;
    const redisKey = `scoring:onview:${candidateId}:${new Date().toISOString().slice(0, 10)}`;
    await redis.set(redisKey, cap); // pre-set at cap

    await expect(
      service.computeMatchPreviewOnView(candidateId, jobId),
    ).rejects.toMatchObject({
      response: { code: "DAILY_AI_LIMIT", cap },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @aurahire/api test -- scoring.service.spec`
Expected: FAIL with "service.computeMatchPreviewOnView is not a function"

- [ ] **Step 3: Commit (test only)**

```bash
git add apps/api/src/modules/scoring/scoring.service.spec.ts
git commit -m "test(scoring): failing test for computeMatchPreviewOnView"
```

---

### Task 4: ScoringService.computeMatchPreviewOnView - implementation

**Files:**

- Modify: `apps/api/src/modules/scoring/scoring.service.ts`
- Create: `apps/api/src/modules/scoring/dto/match-preview-rate-limit.exception.ts`

- [ ] **Step 1: Add the rate-limit exception**

Create `apps/api/src/modules/scoring/dto/match-preview-rate-limit.exception.ts`:

```typescript
import { HttpException, HttpStatus } from "@nestjs/common";

export class MatchPreviewRateLimitException extends HttpException {
  constructor(cap: number) {
    super({ code: "DAILY_AI_LIMIT", cap }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
```

- [ ] **Step 2: Add the method to ScoringService**

In `apps/api/src/modules/scoring/scoring.service.ts`, inject `Redis` (from `ioredis` - the project already wires it; check imports of any existing service that uses redis) and add the method:

```typescript
async computeMatchPreviewOnView(
  candidateId: string,
  jobId: string,
): Promise<MatchPreviewDto> {
  // 1. Check cache first - never increments the counter
  const cached = await this.repo.findMatchPreviewByCandidateJob(candidateId, jobId);
  if (cached) return this.mapPreviewToDto(cached);

  // 2. Rate limit check
  const cap = await this.scoringConfigService.getOnViewDailyCap();
  const today = new Date().toISOString().slice(0, 10);
  const key = `scoring:onview:${candidateId}:${today}`;
  const count = await this.redis.incr(key);
  if (count === 1) await this.redis.expire(key, 90_000);
  if (count > cap) {
    throw new MatchPreviewRateLimitException(cap);
  }

  // 3. Compute (delegates to existing internal method)
  return this.computeMatchPreviewInternal(candidateId, jobId, "candidate_view");
}
```

If `computeMatchPreviewInternal` does not yet exist, refactor the existing manual-compute path into one. The signature should accept `source: MatchPreviewSource` and pass it to the repository on insert.

- [ ] **Step 3: Run tests to verify they pass**

Run: `pnpm -F @aurahire/api test -- scoring.service.spec`
Expected: PASS - three new tests green.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/scoring/scoring.service.ts apps/api/src/modules/scoring/dto/
git commit -m "feat(scoring): computeMatchPreviewOnView with daily rate limit"
```

---

### Task 5: ScoringController delegates to new method

**Files:**

- Modify: `apps/api/src/modules/scoring/scoring.controller.ts`
- Test: `apps/api/src/modules/scoring/scoring.controller.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `scoring.controller.spec.ts`:

```typescript
it("POST /scoring/match-preview/:jobId returns 429 with code DAILY_AI_LIMIT when cap reached", async () => {
  // arrange: pre-set redis to cap
  const cap = 100;
  await redis.set(`scoring:onview:${TEST_CANDIDATE_ID}:${todayUtc()}`, cap);

  const res = await request(app.getHttpServer())
    .post(`/scoring/match-preview/${TEST_JOB_ID}`)
    .set("Authorization", `Bearer ${TEST_CANDIDATE_TOKEN}`);

  expect(res.status).toBe(429);
  expect(res.body).toMatchObject({ code: "DAILY_AI_LIMIT", cap });
});
```

- [ ] **Step 2: Run to fail**

Run: `pnpm -F @aurahire/api test -- scoring.controller.spec`
Expected: FAIL - controller still uses old method.

- [ ] **Step 3: Implementation - delegate**

In `scoring.controller.ts`, find the `POST /match-preview/:jobId` handler. Change it to call `service.computeMatchPreviewOnView(user.id, jobId)`.

- [ ] **Step 4: Run to pass**

Run: `pnpm -F @aurahire/api test -- scoring.controller.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/scoring/scoring.controller.ts apps/api/src/modules/scoring/scoring.controller.spec.ts
git commit -m "feat(scoring): controller delegates POST match-preview to on-view path"
```

---

### Task 6: Default-resume-change handler - failing test

**Files:**

- Test: `apps/api/src/modules/resumes/resumes.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
describe("ResumesService.setAsDefault", () => {
  it("on default change: marks profile_scores stale, enqueues recompute jobs, cancels old in-flight jobs", async () => {
    // arrange: candidate with two resumes, R1 currently default, R1 has match-preview precompute job in flight
    const oldJob = await matchPreviewQueue.add("precompute", {
      candidateId,
      resumeId: R1,
    });

    await service.setAsDefault(candidateId, R2);

    // assert profile_scores marked stale
    const score = await db
      .select()
      .from(profileScoresTable)
      .where(eq(profileScoresTable.candidateId, candidateId));
    expect(score[0]?.staleAt).not.toBeNull();

    // assert old job removed
    const stillThere = await matchPreviewQueue.getJob(oldJob.id);
    expect(stillThere).toBeNull();

    // assert new jobs enqueued for R2
    const counts = await matchPreviewQueue.getJobCounts();
    expect(counts.waiting + counts.active).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `pnpm -F @aurahire/api test -- resumes.service.spec`
Expected: FAIL - current `setAsDefault` doesn't do these things.

- [ ] **Step 3: Implementation**

In `apps/api/src/modules/resumes/resumes.service.ts`, find the `setAsDefault` method (or equivalent path). Wrap in a transaction:

```typescript
async setAsDefault(candidateId: string, resumeId: string): Promise<void> {
  await this.db.transaction(async (tx) => {
    // 1. flip the default flag
    const previousDefault = await this.repo.getCurrentDefault(candidateId, tx);
    await this.repo.setDefault(candidateId, resumeId, tx);

    // 2. cancel any in-flight match-preview-precompute jobs for the OLD resume
    if (previousDefault) {
      await this.cancelInFlightPrecompute(previousDefault.id);
    }

    // 3. mark profile_scores stale
    await tx
      .update(profileScoresTable)
      .set({ staleAt: new Date() })
      .where(
        and(
          eq(profileScoresTable.candidateId, candidateId),
          isNull(profileScoresTable.staleAt),
        ),
      );

    // 4. enqueue Profile Score recompute + match-preview precompute
    await this.profileScoreQueue.add("recompute", { candidateId, resumeId, reason: "resume_change" });
    await this.matchPreviewQueue.add("precompute", { candidateId, resumeId });
  });
}

private async cancelInFlightPrecompute(oldResumeId: string): Promise<void> {
  // BullMQ: scan jobs whose data.resumeId matches and remove
  const states: JobState[] = ["waiting", "active", "delayed", "paused"];
  for (const state of states) {
    const jobs = await this.matchPreviewQueue.getJobs([state], 0, 200);
    for (const job of jobs) {
      if (job.data.resumeId === oldResumeId) {
        await job.remove();
      }
    }
  }
}
```

- [ ] **Step 4: Run to pass**

Run: `pnpm -F @aurahire/api test -- resumes.service.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/resumes/
git commit -m "feat(resumes): default-change cascades to profile-score and match-preview recompute"
```

---

### Task 7: Resume delete cascade with auto-promote (F3)

**Files:**

- Modify: `apps/api/src/modules/resumes/resumes.service.ts`
- Test: `apps/api/src/modules/resumes/resumes.service.spec.ts`

- [ ] **Step 1: Failing test - auto-promote**

```typescript
it("delete-default with multiple resumes: promotes most-recently-uploaded remaining resume", async () => {
  // arrange: candidate has R1 (default, uploaded 3 days ago), R2 (1 day ago), R3 (today, default)
  await service.delete(candidateId, R3);

  const fresh = await db
    .select()
    .from(resumesTable)
    .where(eq(resumesTable.candidateId, candidateId));
  expect(fresh.find((r) => r.isDefault)?.id).toBe(R2);
});

it("delete-default with last resume: returns 409 LAST_RESUME_PROTECTED", async () => {
  // arrange: candidate has only R1 (default)
  await expect(service.delete(candidateId, R1)).rejects.toMatchObject({
    response: { code: "LAST_RESUME_PROTECTED" },
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `pnpm -F @aurahire/api test -- resumes.service.spec`
Expected: FAIL.

- [ ] **Step 3: Implementation**

In `resumes.service.ts`, modify the `delete` method:

```typescript
async delete(candidateId: string, resumeId: string): Promise<void> {
  await this.db.transaction(async (tx) => {
    const target = await this.repo.findById(resumeId, tx);
    if (!target || target.candidateId !== candidateId) {
      throw new NotFoundException();
    }

    if (target.isDefault) {
      // find replacement
      const remaining = await tx
        .select()
        .from(resumesTable)
        .where(and(eq(resumesTable.candidateId, candidateId), ne(resumesTable.id, resumeId)))
        .orderBy(desc(resumesTable.updatedAt), desc(resumesTable.createdAt));

      if (remaining.length === 0) {
        throw new HttpException(
          { code: "LAST_RESUME_PROTECTED", message: "Cannot delete your last resume" },
          HttpStatus.CONFLICT,
        );
      }

      // promote the first remaining
      await this.repo.setDefault(candidateId, remaining[0].id, tx);
      // recompute chain (same as setAsDefault)
      // ... (or factor into shared helper)
    }

    await this.repo.softDelete(resumeId, tx);
  });
}
```

- [ ] **Step 4: Run to pass + Commit**

```bash
pnpm -F @aurahire/api test -- resumes.service.spec
git add apps/api/src/modules/resumes/
git commit -m "feat(resumes): delete-default auto-promotes; last-resume protected"
```

---

### Task 8: Profile-personal edit triggers recompute (F1)

**Files:**

- Modify: `apps/api/src/modules/candidate-profiles/candidate-profiles.service.ts`
- Test: `apps/api/src/modules/candidate-profiles/candidate-profiles.service.spec.ts`

- [ ] **Step 1: Failing test**

```typescript
it("updatePersonal: marks profile_scores stale and enqueues recompute job", async () => {
  await service.updatePersonal(candidateId, { headline: "Senior Engineer" });

  const score = await db
    .select()
    .from(profileScoresTable)
    .where(eq(profileScoresTable.candidateId, candidateId));
  expect(score[0]?.staleAt).not.toBeNull();

  const counts = await profileScoreQueue.getJobCounts();
  expect(counts.waiting + counts.active).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run to fail**

Run: `pnpm -F @aurahire/api test -- candidate-profiles.service.spec`
Expected: FAIL.

- [ ] **Step 3: Implementation**

In `candidate-profiles.service.ts`, after successful `updatePersonal`:

```typescript
async updatePersonal(candidateId: string, dto: UpdatePersonalDto): Promise<void> {
  await this.repo.updatePersonal(candidateId, dto);
  await this.markScoreStaleAndEnqueueRecompute(candidateId, "profile_change");
}

async updatePreferences(candidateId: string, dto: UpdatePreferencesDto): Promise<void> {
  await this.repo.updatePreferences(candidateId, dto);
  await this.markScoreStaleAndEnqueueRecompute(candidateId, "preferences_change");
}

private async markScoreStaleAndEnqueueRecompute(
  candidateId: string,
  reason: ProfileScoreReason,
): Promise<void> {
  const defaultResume = await this.resumesRepo.findDefault(candidateId);
  if (!defaultResume) return;  // no resume yet - nothing to recompute

  await this.db
    .update(profileScoresTable)
    .set({ staleAt: new Date() })
    .where(and(
      eq(profileScoresTable.candidateId, candidateId),
      isNull(profileScoresTable.staleAt),
    ));

  await this.profileScoreQueue.add("recompute", {
    candidateId,
    resumeId: defaultResume.id,
    reason,
  });
}
```

- [ ] **Step 4: Run to pass + Commit**

```bash
pnpm -F @aurahire/api test -- candidate-profiles.service.spec
git add apps/api/src/modules/candidate-profiles/
git commit -m "feat(candidate-profiles): updatePersonal/updatePreferences mark score stale and enqueue recompute"
```

---

### Task 9: Profile Score recompute processor

**Files:**

- Create: `apps/api/src/modules/scoring/processors/profile-score-recompute.processor.ts`
- Modify: `apps/api/src/modules/scoring/scoring.module.ts` (register processor + queue)
- Test: `apps/api/src/modules/scoring/processors/profile-score-recompute.processor.spec.ts`

- [ ] **Step 1: Failing test**

```typescript
describe("ProfileScoreRecomputeProcessor", () => {
  it("computes new profile score and writes row with the given reason", async () => {
    const job = createJob({
      candidateId,
      resumeId: defaultResumeId,
      reason: "profile_change",
    });
    await processor.process(job);

    const score = await db
      .select()
      .from(profileScoresTable)
      .where(
        and(
          eq(profileScoresTable.candidateId, candidateId),
          isNull(profileScoresTable.staleAt),
        ),
      );
    expect(score).toHaveLength(1);
    expect(score[0].overallScore).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `pnpm -F @aurahire/api test -- profile-score-recompute.processor.spec`
Expected: FAIL - processor doesn't exist yet.

- [ ] **Step 3: Implementation**

Create `apps/api/src/modules/scoring/processors/profile-score-recompute.processor.ts`:

```typescript
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { ScoringService } from "../scoring.service";

export const PROFILE_SCORE_RECOMPUTE_QUEUE = "profile-score-recompute";

export interface ProfileScoreRecomputeJobData {
  candidateId: string;
  resumeId: string;
  reason:
    | "resume_change"
    | "preferences_change"
    | "profile_change"
    | "manual_recompute";
}

@Processor(PROFILE_SCORE_RECOMPUTE_QUEUE, { concurrency: 3 })
export class ProfileScoreRecomputeProcessor extends WorkerHost {
  private readonly logger = new Logger(ProfileScoreRecomputeProcessor.name);

  constructor(private readonly scoring: ScoringService) {
    super();
  }

  async process(job: Job<ProfileScoreRecomputeJobData>): Promise<void> {
    const { candidateId, resumeId, reason } = job.data;
    this.logger.log(
      `recompute: candidate=${candidateId} resume=${resumeId} reason=${reason}`,
    );
    await this.scoring.computeProfileScore(candidateId, resumeId, { reason });
  }
}
```

`ScoringService.computeProfileScore` signature already exists; if the `reason` arg is new, plumb it through to the audit log + the realtime emit (in Phase 2 we'll add the emit).

In `scoring.module.ts`, register the queue and the processor:

```typescript
imports: [
  // ...existing
  BullModule.registerQueue({ name: PROFILE_SCORE_RECOMPUTE_QUEUE }),
],
providers: [
  // ...existing
  ProfileScoreRecomputeProcessor,
],
```

- [ ] **Step 4: Run to pass + Commit**

```bash
pnpm -F @aurahire/api test -- profile-score-recompute
git add apps/api/src/modules/scoring/
git commit -m "feat(scoring): profile-score-recompute processor"
```

---

### Task 10: Extend complete-onboarding response - happy path test

**Files:**

- Test: `apps/api/src/modules/candidate-profiles/candidate-profiles.controller.spec.ts`

- [ ] **Step 1: Failing test**

```typescript
describe("PATCH /candidate-profiles/me/complete-onboarding", () => {
  it("returns extended response with profileScore + precomputeJobId", async () => {
    // arrange: candidate with parsed default resume + completed personal/preferences
    const res = await request(app.getHttpServer())
      .patch("/candidate-profiles/me/complete-onboarding")
      .set("Authorization", `Bearer ${candidateToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      profileCompleted: true,
      profileScore: expect.objectContaining({
        overallScore: expect.any(Number),
        band: expect.stringMatching(/^(strong|partial|limited)$/),
        components: expect.any(Array),
        promptVersion: expect.any(String),
        computedAt: expect.any(String),
      }),
      precomputeJobId: expect.any(String),
    });
  });

  it("on AI failure: returns 200 with profileScore=null and errors.profileScore='transient'", async () => {
    // arrange: mock OpenAI to throw
    mockOpenAI.mockRejectedValueOnce(new Error("simulated AI failure"));

    const res = await request(app.getHttpServer())
      .patch("/candidate-profiles/me/complete-onboarding")
      .set("Authorization", `Bearer ${candidateToken}`);

    expect(res.status).toBe(200);
    expect(res.body.profileCompleted).toBe(true);
    expect(res.body.profileScore).toBeNull();
    expect(res.body.errors?.profileScore).toBe("transient");
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `pnpm -F @aurahire/api test -- candidate-profiles.controller.spec`
Expected: FAIL - current response doesn't include profileScore or precomputeJobId.

- [ ] **Step 3: Commit (test only)**

```bash
git add apps/api/src/modules/candidate-profiles/candidate-profiles.controller.spec.ts
git commit -m "test(candidate-profiles): failing test for extended complete-onboarding response"
```

---

### Task 11: Extend complete-onboarding - implementation

**Files:**

- Modify: `apps/api/src/modules/candidate-profiles/candidate-profiles.service.ts`
- Modify: `apps/api/src/modules/candidate-profiles/candidate-profiles.controller.ts`

- [ ] **Step 1: Service implementation**

In `candidate-profiles.service.ts`:

```typescript
async completeOnboarding(candidateId: string): Promise<CompleteOnboardingResponse> {
  // 1. Mark profile completed (always succeeds first)
  await this.repo.markProfileCompleted(candidateId);

  // 2. Enqueue match-preview precompute (async)
  const defaultResume = await this.resumesRepo.findDefault(candidateId);
  let precomputeJobId = "";
  if (defaultResume) {
    const job = await this.matchPreviewQueue.add("precompute", {
      candidateId,
      resumeId: defaultResume.id,
    });
    precomputeJobId = String(job.id);
  }

  // 3. Attempt inline Profile Score compute
  let profileScore: ProfileScoreDto | null = null;
  let profileScoreError: "transient" | "missing_resume" | undefined;
  try {
    if (!defaultResume) {
      profileScoreError = "missing_resume";
    } else {
      profileScore = await this.scoring.computeProfileScore(
        candidateId,
        defaultResume.id,
        { reason: "onboarding" },
      );
    }
  } catch (err) {
    this.logger.warn("inline profile-score compute failed", { err, candidateId });
    profileScoreError = "transient";
    // enqueue retry job
    await this.profileScoreQueue.add("recompute", {
      candidateId,
      resumeId: defaultResume!.id,
      reason: "onboarding",
    });
  }

  return {
    profileCompleted: true,
    profileScore,
    precomputeJobId,
    ...(profileScoreError ? { errors: { profileScore: profileScoreError } } : {}),
  };
}
```

- [ ] **Step 2: Controller no-op (response shape comes from service)**

Verify `candidate-profiles.controller.ts` returns the service result directly. If not, adjust.

- [ ] **Step 3: Run tests**

Run: `pnpm -F @aurahire/api test -- candidate-profiles.controller.spec`
Expected: PASS - both happy path and AI failure path.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/candidate-profiles/
git commit -m "feat(candidate-profiles): complete-onboarding returns profileScore + precomputeJobId"
```

---

### Task 12: Server-side enqueueProfileScoreIfMissing guard

**Files:**

- Create: `apps/api/src/modules/candidate-profiles/guards/profile-score-backfill.guard.ts` (or interceptor - verify project pattern)
- Modify: portal entry route handler (or the candidate dashboard data-fetch path)

- [ ] **Step 1: Identify entry point**

Run: `grep -rn "candidateController\|candidate.controller" apps/api/src/modules/candidate-profiles/` to find the candidate-portal "me" data-fetch endpoint.

Hint: it's likely `GET /candidate-profiles/me/dashboard` or similar. The guard fires when this is called and the user is `profile_completed=true` but has no current profile_scores row.

- [ ] **Step 2: Add the helper**

In `candidate-profiles.service.ts`:

```typescript
async enqueueProfileScoreIfMissing(candidateId: string): Promise<void> {
  const hasCurrent = await this.scoringRepo.hasCurrentProfileScore(candidateId);
  if (hasCurrent) return;

  const defaultResume = await this.resumesRepo.findDefault(candidateId);
  if (!defaultResume) return;

  // BullMQ enqueue with deduplication via jobId
  await this.profileScoreQueue.add(
    "recompute",
    { candidateId, resumeId: defaultResume.id, reason: "manual_recompute" },
    { jobId: `profile-score:${candidateId}:${defaultResume.id}` },  // dedupe
  );
}
```

Call it from the dashboard data-fetch endpoint at the top of the handler. Awaiting is unnecessary - fire and forget.

- [ ] **Step 3: Test + Commit**

Add a test asserting that calling the dashboard endpoint with no current score enqueues a job. Then:

```bash
pnpm -F @aurahire/api test -- candidate-profiles
git add apps/api/src/modules/candidate-profiles/
git commit -m "feat(candidate-profiles): backfill missing profile-score on portal entry"
```

---

### Task 13: Notification emission on application status change (F4)

**Files:**

- Modify: `apps/api/src/modules/applications/applications.service.ts`
- Test: `apps/api/src/modules/applications/applications.service.spec.ts`

- [ ] **Step 1: Failing test**

```typescript
it("application status change emits notification to candidate", async () => {
  const emitSpy = jest.spyOn(notifications, "emit");
  await service.updateStatus(applicationId, "screening", recruiterId);

  expect(emitSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: candidateId,
      eventType: "application_status_changed",
      metadata: expect.objectContaining({
        fromStatus: "applied",
        toStatus: "screening",
        jobId: expect.any(String),
      }),
    }),
  );
});
```

- [ ] **Step 2: Run to fail**

Run: `pnpm -F @aurahire/api test -- applications.service.spec`
Expected: FAIL.

- [ ] **Step 3: Implementation**

In `applications.service.ts`, find the `updateStatus` method (and any other status-mutating paths). After the DB update succeeds, call:

```typescript
await this.notifications.emit({
  userId: application.candidateId,
  eventType: "application_status_changed",
  scope: "personal",
  entityType: "application",
  entityId: applicationId,
  actorId: recruiterId,
  metadata: {
    applicationId,
    jobId: application.jobId,
    fromStatus: previousStatus,
    toStatus: newStatus,
    occurredAt: new Date().toISOString(),
  },
});
```

If the `application_status_changed` event type isn't already in `NotificationEventType` (likely is - verify via `event-defaults.ts`), add it.

- [ ] **Step 4: Run + Commit**

```bash
pnpm -F @aurahire/api test -- applications.service.spec
git add apps/api/src/modules/applications/
git commit -m "feat(applications): emit notification on status change"
```

---

### Task 14: Notification emission on application create (F6)

**Files:**

- Modify: `apps/api/src/modules/applications/applications.service.ts`
- Test: `apps/api/src/modules/applications/applications.service.spec.ts`

- [ ] **Step 1: Failing test**

```typescript
it("create emits 'new_application_received' to recruiter team", async () => {
  const emitManySpy = jest.spyOn(notifications, "emitMany");
  await service.create(candidateId, jobId, applicationDto);

  expect(emitManySpy).toHaveBeenCalledWith(
    expect.arrayContaining([recruiterId]),
    expect.objectContaining({
      eventType: "new_application_received",
      metadata: expect.objectContaining({ jobId, candidateId }),
    }),
  );
});
```

- [ ] **Step 2: Run, fail, implement**

In `applications.service.ts` `create` method, after successful insert:

```typescript
const recruiterUserIds = await this.jobsRepo.getHiringTeamUserIds(jobId);
await this.notifications.emitMany(recruiterUserIds, {
  eventType: "new_application_received",
  scope: "personal",
  entityType: "application",
  entityId: created.id,
  actorId: candidateId,
  metadata: {
    applicationId: created.id,
    jobId,
    candidateId,
    occurredAt: new Date().toISOString(),
  },
});
```

- [ ] **Step 3: Run + Commit**

```bash
pnpm -F @aurahire/api test -- applications.service.spec
git add apps/api/src/modules/applications/
git commit -m "feat(applications): emit new-application notification to recruiter team"
```

---

### Task 15: Notification emission on offer accept/decline (F5)

**Files:**

- Modify: `apps/api/src/modules/offers/offers.service.ts`
- Test: `apps/api/src/modules/offers/offers.service.spec.ts`

- [ ] **Step 1: Failing test**

```typescript
it("accept emits 'offer_accepted' to recruiter team", async () => {
  const emitManySpy = jest.spyOn(notifications, "emitMany");
  await service.accept(offerId, candidateId);

  expect(emitManySpy).toHaveBeenCalledWith(
    expect.arrayContaining([recruiterId]),
    expect.objectContaining({ eventType: "offer_accepted" }),
  );
});

it("decline emits 'offer_declined' to recruiter team", async () => {
  const emitManySpy = jest.spyOn(notifications, "emitMany");
  await service.decline(offerId, candidateId);

  expect(emitManySpy).toHaveBeenCalledWith(
    expect.arrayContaining([recruiterId]),
    expect.objectContaining({ eventType: "offer_declined" }),
  );
});
```

- [ ] **Step 2: Run, fail, implement**

In `offers.service.ts`, in both `accept` and `decline` methods, after the DB transition:

```typescript
const recruiterUserIds = await this.jobsRepo.getHiringTeamUserIds(offer.jobId);
await this.notifications.emitMany(recruiterUserIds, {
  eventType: status === "accepted" ? "offer_accepted" : "offer_declined",
  scope: "personal",
  entityType: "offer",
  entityId: offerId,
  actorId: candidateId,
  metadata: {
    offerId,
    applicationId: offer.applicationId,
    candidateId,
    occurredAt: new Date().toISOString(),
  },
});
```

If `offer_accepted` / `offer_declined` aren't in `NotificationEventType`, add them to `event-defaults.ts`.

- [ ] **Step 3: Run + Commit**

```bash
pnpm -F @aurahire/api test -- offers.service.spec
git add apps/api/src/modules/offers/ apps/api/src/modules/notifications/event-defaults.ts
git commit -m "feat(offers): emit notification on accept/decline"
```

---

### Task 16: Plumb interview reschedule + share-feedback emails (F8)

**Files:**

- Modify: `apps/api/src/modules/interviews/interviews.service.ts`
- Test: `apps/api/src/modules/interviews/interviews.service.spec.ts`

- [ ] **Step 1: Failing test**

```typescript
it("reschedule plumbs email send for the candidate", async () => {
  const queueAddSpy = jest.spyOn(emailQueue, "add");
  await service.reschedule(interviewId, recruiterId, {
    newScheduledAt: tomorrow,
  });

  expect(queueAddSpy).toHaveBeenCalledWith(
    expect.stringContaining("instant-email"),
    expect.objectContaining({ kind: "instant" }),
    expect.any(Object),
  );
});

it("shareFeedback plumbs email send to candidate", async () => {
  const queueAddSpy = jest.spyOn(emailQueue, "add");
  await service.shareFeedback(interviewId, recruiterId, feedbackDto);

  expect(queueAddSpy).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run, fail, implement**

The interview commits explicitly note the email TODO. After each in-app `notifications.emit()` call inside `reschedule` and `shareFeedback`, the existing `NotificationsService.emit()` already handles email enqueue based on `mode === "instant"`. Verify the `event-defaults.ts` lists `interview_rescheduled` and `interview_feedback_shared` as instant-mode events.

If they are configured as `digest`, change to `instant` for these events.

If the interview service emits some events without going through `notifications.emit()` (i.e., direct EventsService realtime emits without the row insert), wire them through `notifications.emit()` so the email + in-app + realtime all fire.

- [ ] **Step 3: Run + Commit**

```bash
pnpm -F @aurahire/api test -- interviews.service.spec
git add apps/api/src/modules/interviews/ apps/api/src/modules/notifications/event-defaults.ts
git commit -m "feat(interviews): plumb reschedule and share-feedback emails (Tasks 26 + 28)"
```

---

### Task 17: Cron - interview reminder 24h before (F9)

**Files:**

- Create: `apps/api/src/modules/notifications/notifications.scheduler.ts`
- Modify: `apps/api/src/modules/notifications/notifications.module.ts`
- Test: `apps/api/src/modules/notifications/notifications.scheduler.spec.ts`

- [ ] **Step 1: Failing test**

```typescript
describe("NotificationsScheduler.interviewReminder", () => {
  it("emits interview_reminder_24h for interviews scheduled 23-24h from now", async () => {
    // arrange: 3 interviews - one in 23.5h, one in 25h, one in 22h
    const inWindow = await seedInterview({ scheduledAt: addHours(now, 23.5) });
    const tooEarly = await seedInterview({ scheduledAt: addHours(now, 25) });
    const tooLate = await seedInterview({ scheduledAt: addHours(now, 22) });

    const emitSpy = jest.spyOn(notifications, "emit");
    await scheduler.runInterviewReminder();

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "interview_reminder_24h",
        entityId: inWindow.id,
      }),
    );
    expect(emitSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ entityId: tooEarly.id }),
    );
    expect(emitSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ entityId: tooLate.id }),
    );
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `pnpm -F @aurahire/api test -- notifications.scheduler.spec`
Expected: FAIL - scheduler doesn't exist.

- [ ] **Step 3: Implementation**

Create `apps/api/src/modules/notifications/notifications.scheduler.ts`:

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { sql } from "drizzle-orm";
import { Db } from "../../infrastructure/db";
import { NotificationsService } from "./notifications.service";
import { interviewsTable, offersTable, jobsTable } from "@aurahire/db/schema";

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    private readonly db: Db,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron("0 5 * * *", { timeZone: "UTC" }) // 00:05 UTC daily
  async runInterviewReminder(): Promise<void> {
    try {
      const interviews = await this.db
        .select()
        .from(interviewsTable)
        .where(
          sql`
          status = 'scheduled'
          AND scheduled_at BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '24 hours'
        `,
        )
        .limit(500);

      this.logger.log(`interviewReminder: ${interviews.length} matching`);
      for (const iv of interviews) {
        await this.notifications.emit({
          userId: iv.candidateId,
          eventType: "interview_reminder_24h",
          scope: "personal",
          entityType: "interview",
          entityId: iv.id,
          metadata: {
            jobId: iv.jobId,
            scheduledAt: iv.scheduledAt.toISOString(),
          },
        });
      }
    } catch (err) {
      this.logger.error("interviewReminder failed", err);
    }
  }
}
```

In `notifications.module.ts`, register the scheduler in `providers`. Ensure `ScheduleModule.forRoot()` is imported in the AppModule (likely already is - verify).

- [ ] **Step 4: Run + Commit**

```bash
pnpm -F @aurahire/api test -- notifications.scheduler.spec
git add apps/api/src/modules/notifications/notifications.scheduler.ts apps/api/src/modules/notifications/notifications.module.ts
git commit -m "feat(notifications): cron - interview reminder 24h before (F9)"
```

---

### Task 18: Cron - offer expiration (F10)

**Files:**

- Modify: `apps/api/src/modules/notifications/notifications.scheduler.ts`
- Test: `apps/api/src/modules/notifications/notifications.scheduler.spec.ts`

- [ ] **Step 1: Failing tests**

```typescript
describe("NotificationsScheduler.offerExpiration", () => {
  it("emits offer_expiring_soon 24h before expiry", async () => {
    const expiringSoon = await seedOffer({
      expiresAt: addHours(now, 12),
      status: "pending",
    });
    const emitSpy = jest.spyOn(notifications, "emit");

    await scheduler.runOfferExpiration();

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "offer_expiring_soon",
        entityId: expiringSoon.id,
      }),
    );
  });

  it("transitions expired offers and emits offer_expired to both parties", async () => {
    const expired = await seedOffer({
      expiresAt: addHours(now, -1),
      status: "pending",
    });
    const emitSpy = jest.spyOn(notifications, "emit");

    await scheduler.runOfferExpiration();

    const fresh = await db
      .select()
      .from(offersTable)
      .where(eq(offersTable.id, expired.id));
    expect(fresh[0].status).toBe("expired");

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "offer_expired",
        userId: candidateId,
      }),
    );
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "offer_expired",
        userId: recruiterId,
      }),
    );
  });
});
```

- [ ] **Step 2: Run, fail, implement**

Add to `NotificationsScheduler`:

```typescript
@Cron("10 0 * * *", { timeZone: "UTC" })
async runOfferExpiration(): Promise<void> {
  try {
    // Pass A - expiring soon
    const expiringSoon = await this.db
      .select()
      .from(offersTable)
      .where(sql`
        status = 'pending'
        AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
      `)
      .limit(500);

    for (const offer of expiringSoon) {
      await this.notifications.emit({
        userId: offer.candidateId,
        eventType: "offer_expiring_soon",
        entityType: "offer",
        entityId: offer.id,
        metadata: { jobId: offer.jobId, expiresAt: offer.expiresAt.toISOString() },
      });
    }

    // Pass B - already expired → transition + notify both sides
    const expired = await this.db
      .select()
      .from(offersTable)
      .where(sql`status = 'pending' AND expires_at < NOW()`)
      .limit(500);

    for (const offer of expired) {
      await this.db
        .update(offersTable)
        .set({ status: "expired" })
        .where(eq(offersTable.id, offer.id));

      // candidate
      await this.notifications.emit({
        userId: offer.candidateId,
        eventType: "offer_expired",
        entityType: "offer",
        entityId: offer.id,
        metadata: { jobId: offer.jobId },
      });
      // recruiter team
      const recruiterUserIds = await this.jobsRepo.getHiringTeamUserIds(offer.jobId);
      await this.notifications.emitMany(recruiterUserIds, {
        eventType: "offer_expired",
        entityType: "offer",
        entityId: offer.id,
        metadata: { jobId: offer.jobId, candidateId: offer.candidateId },
      });
    }
  } catch (err) {
    this.logger.error("offerExpiration failed", err);
  }
}
```

Add `offer_expiring_soon` and `offer_expired` to `NotificationEventType` in `event-defaults.ts`.

- [ ] **Step 3: Run + Commit**

```bash
pnpm -F @aurahire/api test -- notifications.scheduler.spec
git add apps/api/src/modules/notifications/
git commit -m "feat(notifications): cron - offer expiration warning + auto-transition (F10)"
```

---

### Task 19: Cron - job deadline auto-archive (F11)

**Files:**

- Modify: `apps/api/src/modules/notifications/notifications.scheduler.ts`
- Test: `apps/api/src/modules/notifications/notifications.scheduler.spec.ts`

- [ ] **Step 1: Failing test**

```typescript
it("auto-archives published jobs past application_deadline; emits notification to recruiter", async () => {
  const past = await seedJob({
    status: "published",
    applicationDeadline: addDays(now, -1),
  });
  const future = await seedJob({
    status: "published",
    applicationDeadline: addDays(now, 1),
  });
  const emitSpy = jest.spyOn(notifications, "emit");

  await scheduler.runJobDeadlineArchive();

  const fresh = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, past.id));
  expect(fresh[0].status).toBe("archived");
  expect(fresh[0].archivedReason).toBe("deadline_passed");

  const stillPublished = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, future.id));
  expect(stillPublished[0].status).toBe("published");

  expect(emitSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      eventType: "job_archived_by_deadline",
      entityId: past.id,
    }),
  );
});
```

- [ ] **Step 2: Run, fail, implement**

```typescript
@Cron("15 0 * * *", { timeZone: "UTC" })
async runJobDeadlineArchive(): Promise<void> {
  try {
    const past = await this.db
      .select()
      .from(jobsTable)
      .where(sql`status = 'published' AND application_deadline < NOW()`)
      .limit(500);

    for (const job of past) {
      await this.db
        .update(jobsTable)
        .set({ status: "archived", archivedReason: "deadline_passed" })
        .where(eq(jobsTable.id, job.id));

      const recruiterUserIds = await this.jobsRepo.getHiringTeamUserIds(job.id);
      await this.notifications.emitMany(recruiterUserIds, {
        eventType: "job_archived_by_deadline",
        entityType: "job",
        entityId: job.id,
        metadata: { title: job.title, deadline: job.applicationDeadline?.toISOString() },
      });
    }
  } catch (err) {
    this.logger.error("jobDeadlineArchive failed", err);
  }
}
```

Add `job_archived_by_deadline` to `NotificationEventType`.

- [ ] **Step 3: Run + Commit**

```bash
pnpm -F @aurahire/api test -- notifications.scheduler.spec
git add apps/api/src/modules/notifications/
git commit -m "feat(notifications): cron - auto-archive jobs past application deadline (F11)"
```

---

### Task 20: Cron - interview feedback due reminder (F12)

**Files:**

- Modify: `apps/api/src/modules/notifications/notifications.scheduler.ts`
- Test: `apps/api/src/modules/notifications/notifications.scheduler.spec.ts`

- [ ] **Step 1: Failing test**

```typescript
it("emits interview_feedback_due for completed interviews missing feedback past 24h", async () => {
  const stale = await seedInterview({
    status: "completed",
    completedAt: addHours(now, -25),
    feedbackId: null,
    feedbackReminderSentAt: null,
  });
  const recent = await seedInterview({
    status: "completed",
    completedAt: addHours(now, -10),
    feedbackId: null,
  });
  const recentlyReminded = await seedInterview({
    status: "completed",
    completedAt: addHours(now, -25),
    feedbackId: null,
    feedbackReminderSentAt: addHours(now, -5),
  });

  const emitSpy = jest.spyOn(notifications, "emit");
  await scheduler.runFeedbackDueReminder();

  expect(emitSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      eventType: "interview_feedback_due",
      entityId: stale.id,
    }),
  );
  expect(emitSpy).not.toHaveBeenCalledWith(
    expect.objectContaining({ entityId: recent.id }),
  );
  expect(emitSpy).not.toHaveBeenCalledWith(
    expect.objectContaining({ entityId: recentlyReminded.id }),
  );

  const fresh = await db
    .select()
    .from(interviewsTable)
    .where(eq(interviewsTable.id, stale.id));
  expect(fresh[0].feedbackReminderSentAt).not.toBeNull();
});
```

- [ ] **Step 2: Implement**

```typescript
@Cron("0 */6 * * *", { timeZone: "UTC" })
async runFeedbackDueReminder(): Promise<void> {
  try {
    const due = await this.db
      .select()
      .from(interviewsTable)
      .where(sql`
        status = 'completed'
        AND feedback_id IS NULL
        AND completed_at < NOW() - INTERVAL '24 hours'
        AND (feedback_reminder_sent_at IS NULL OR feedback_reminder_sent_at < NOW() - INTERVAL '24 hours')
      `)
      .limit(500);

    for (const iv of due) {
      await this.notifications.emit({
        userId: iv.recruiterId,
        eventType: "interview_feedback_due",
        entityType: "interview",
        entityId: iv.id,
        metadata: { candidateId: iv.candidateId, jobId: iv.jobId, completedAt: iv.completedAt!.toISOString() },
      });
      await this.db
        .update(interviewsTable)
        .set({ feedbackReminderSentAt: new Date() })
        .where(eq(interviewsTable.id, iv.id));
    }
  } catch (err) {
    this.logger.error("feedbackDueReminder failed", err);
  }
}
```

Add `interview_feedback_due` to `NotificationEventType`.

- [ ] **Step 3: Run + Commit**

```bash
pnpm -F @aurahire/api test -- notifications.scheduler.spec
git add apps/api/src/modules/notifications/
git commit -m "feat(notifications): cron - feedback-due reminder (F12)"
```

---

### Task 21: Cron - notification digest (F13)

**Files:**

- Modify: `apps/api/src/modules/notifications/notifications.scheduler.ts`
- Test: `apps/api/src/modules/notifications/notifications.scheduler.spec.ts`

- [ ] **Step 1: Failing test**

```typescript
it("groups digest_pending=true notifications by user and enqueues digest jobs", async () => {
  await seedNotification({ userId: u1, digestPending: true });
  await seedNotification({ userId: u1, digestPending: true });
  await seedNotification({ userId: u2, digestPending: true });
  await seedNotification({ userId: u3, digestPending: false });

  const queueAddSpy = jest.spyOn(emailQueue, "add");
  await scheduler.runDigest();

  // u1 + u2 each get one digest job; u3 has no pending
  const calls = queueAddSpy.mock.calls.filter((c) => c[1]?.kind === "digest");
  expect(calls).toHaveLength(2);
});
```

- [ ] **Step 2: Implement**

```typescript
@Cron("0 9 * * *", { timeZone: "UTC" })
async runDigest(): Promise<void> {
  try {
    const groups = await this.db.execute(sql`
      SELECT user_id, ARRAY_AGG(id) as notification_ids
      FROM notifications
      WHERE digest_pending = true AND archived_at IS NULL
      GROUP BY user_id
      LIMIT 500
    `);

    for (const row of groups.rows as Array<{ user_id: string; notification_ids: string[] }>) {
      await this.emailQueue.add(
        "digest-email",
        { kind: "digest", userId: row.user_id, notificationIds: row.notification_ids },
        { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
      );
      // reset digest_pending so they don't re-fire tomorrow
      await this.db
        .update(notificationsTable)
        .set({ digestPending: false })
        .where(inArray(notificationsTable.id, row.notification_ids));
    }
  } catch (err) {
    this.logger.error("digest failed", err);
  }
}
```

The existing `notification-email.processor.ts` already handles `kind: "digest"` (lines 69-98).

- [ ] **Step 3: Run + Commit**

```bash
pnpm -F @aurahire/api test -- notifications.scheduler.spec
git add apps/api/src/modules/notifications/
git commit -m "feat(notifications): cron - daily digest emission (F13)"
```

---

### Task 22: Phase 1 checkpoint - type-check, full backend test pass

- [ ] **Step 1: Type-check**

Run: `pnpm -F @aurahire/api typecheck`
Expected: PASS, zero errors.

- [ ] **Step 2: Full backend test suite**

Run: `pnpm -F @aurahire/api test`
Expected: all green.

- [ ] **Step 3: Lint**

Run: `pnpm -F @aurahire/api lint`
Expected: zero warnings/errors.

- [ ] **Step 4: Verify with the user**

Tell the user:

> "Phase 1 complete. The backend now: (a) auto-computes Profile Score on `complete-onboarding`, (b) recomputes on resume/preferences/personal changes, (c) auto-promotes a remaining resume on default delete, (d) emits notifications on application status / new application / offer accept-decline, (e) plumbs interview reschedule + share-feedback emails, (f) has 5 new crons (interview reminder, offer expiration, job deadline auto-archive, feedback-due, digest), (g) the on-view match-preview path is rate-limited.
>
> No user-visible UI change yet - Phase 2 wires realtime + the notifications API surface; Phase 3 cuts over the frontend.
>
> Please run the migration locally (`pnpm -F @aurahire/db db:migrate`) and confirm the new columns + indexes are in place. Then we can proceed to Phase 2."

---

## Phase 2 - Realtime Infrastructure (PR 2)

This phase adds realtime emissions for scoring + notification events, and the new notifications API surface (archive, archive-all). Phase 2 alone is invisible to users; it's foundation for Phase 3.

### Task 23: Realtime event names + Zod payload schemas in shared

**Files:**

- Modify: `packages/shared/src/realtime/events.ts`
- Modify: `packages/shared/src/realtime/index.ts`
- Create: `packages/shared/src/realtime/scoring-payloads.ts`
- Create: `packages/shared/src/realtime/notification-payloads.ts`

- [ ] **Step 1: Add event names**

In `packages/shared/src/realtime/events.ts`, extend the `RealtimeEvent` enum:

```typescript
export const RealtimeEvent = {
  // ...existing
  MatchPreviewCreated: "match-preview.created",
  ProfileScoreUpdated: "profile-score.updated",
  NotificationCreated: "notification.created",
  NotificationRead: "notification.read",
  NotificationArchived: "notification.archived",
  NotificationArchiveAll: "notification.archive_all",
} as const;
export type RealtimeEvent = (typeof RealtimeEvent)[keyof typeof RealtimeEvent];
```

- [ ] **Step 2: Add Zod schemas**

Create `packages/shared/src/realtime/scoring-payloads.ts`:

```typescript
import { z } from "zod";

export const matchPreviewCreatedPayloadSchema = z.object({
  candidateId: z.string().uuid(),
  jobId: z.string().uuid(),
  resumeId: z.string().uuid(),
  source: z.enum(["system", "candidate", "candidate_view"]),
  overallScore: z.number().min(0).max(100),
  band: z.enum(["strong", "partial", "limited"]),
  createdAt: z.string().datetime(),
});
export type MatchPreviewCreatedPayload = z.infer<
  typeof matchPreviewCreatedPayloadSchema
>;

export const profileScoreUpdatedPayloadSchema = z.object({
  candidateId: z.string().uuid(),
  resumeId: z.string().uuid(),
  overallScore: z.number().min(0).max(100),
  band: z.enum(["strong", "partial", "limited"]),
  reason: z.enum([
    "onboarding",
    "resume_change",
    "preferences_change",
    "profile_change",
    "manual_recompute",
  ]),
  updatedAt: z.string().datetime(),
});
export type ProfileScoreUpdatedPayload = z.infer<
  typeof profileScoreUpdatedPayloadSchema
>;
```

Create `packages/shared/src/realtime/notification-payloads.ts`:

```typescript
import { z } from "zod";

export const notificationCreatedPayloadSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  kind: z.string(), // = NotificationEventType from db enum
  title: z.string(),
  bodyExcerpt: z.string(),
  linkUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  unreadCount: z.number().int().min(0),
});
export type NotificationCreatedPayload = z.infer<
  typeof notificationCreatedPayloadSchema
>;

export const notificationReadPayloadSchema = z.object({
  id: z.string().uuid(),
  unreadCount: z.number().int().min(0),
});
export type NotificationReadPayload = z.infer<
  typeof notificationReadPayloadSchema
>;

export const notificationArchivedPayloadSchema = z.object({
  id: z.string().uuid(),
  unreadCount: z.number().int().min(0),
});
export type NotificationArchivedPayload = z.infer<
  typeof notificationArchivedPayloadSchema
>;

export const notificationArchiveAllPayloadSchema = z.object({
  unreadCount: z.literal(0),
});
export type NotificationArchiveAllPayload = z.infer<
  typeof notificationArchiveAllPayloadSchema
>;
```

In `packages/shared/src/realtime/index.ts`, re-export everything from the two new files.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/realtime/
git commit -m "feat(shared): realtime event names + Zod payloads for scoring/notification events"
```

---

### Task 24: EventsService - new emit methods

**Files:**

- Modify: `apps/api/src/realtime/events.service.ts`
- Test: `apps/api/src/realtime/events.service.spec.ts`

- [ ] **Step 1: Failing tests**

```typescript
describe("EventsService - proactive system events", () => {
  it("emitMatchPreviewCreated broadcasts to user:{candidateId} room", () => {
    const broadcastSpy = jest.spyOn(gateway, "broadcastToRoom");
    service.emitMatchPreviewCreated({
      candidateId: "c1",
      jobId: "j1",
      resumeId: "r1",
      source: "system",
      overallScore: 85,
      band: "strong",
      createdAt: new Date().toISOString(),
    });

    expect(broadcastSpy).toHaveBeenCalledWith(
      "user:c1",
      RealtimeEvent.MatchPreviewCreated,
      expect.any(Object),
    );
  });
  // similar for profileScoreUpdated, notificationCreated, notificationRead, etc.
});
```

- [ ] **Step 2: Implementation**

In `events.service.ts`, add the methods:

```typescript
emitMatchPreviewCreated(payload: MatchPreviewCreatedPayload): void {
  this.broadcast(
    RealtimeEvent.MatchPreviewCreated,
    payload,
    [Rooms.user(payload.candidateId)],
  );
}

emitProfileScoreUpdated(payload: ProfileScoreUpdatedPayload): void {
  this.broadcast(
    RealtimeEvent.ProfileScoreUpdated,
    payload,
    [Rooms.user(payload.candidateId)],
  );
}

emitNotificationCreated(payload: NotificationCreatedPayload): void {
  this.broadcast(
    RealtimeEvent.NotificationCreated,
    payload,
    [Rooms.user(payload.userId)],
  );
}

emitNotificationRead(userId: string, payload: NotificationReadPayload): void {
  this.broadcast(RealtimeEvent.NotificationRead, payload, [Rooms.user(userId)]);
}

emitNotificationArchived(userId: string, payload: NotificationArchivedPayload): void {
  this.broadcast(RealtimeEvent.NotificationArchived, payload, [Rooms.user(userId)]);
}

emitNotificationArchiveAll(userId: string, payload: NotificationArchiveAllPayload): void {
  this.broadcast(RealtimeEvent.NotificationArchiveAll, payload, [Rooms.user(userId)]);
}
```

- [ ] **Step 3: Run + Commit**

```bash
pnpm -F @aurahire/api test -- events.service.spec
git add apps/api/src/realtime/events.service.ts apps/api/src/realtime/events.service.spec.ts
git commit -m "feat(realtime): emit methods for scoring + notification events"
```

---

### Task 25: ScoringService emits realtime events on writes

**Files:**

- Modify: `apps/api/src/modules/scoring/scoring.service.ts`
- Test: `apps/api/src/modules/scoring/scoring.service.spec.ts`

- [ ] **Step 1: Failing test**

```typescript
it("after computeMatchPreviewOnView, emits match-preview.created", async () => {
  const eventsSpy = jest.spyOn(events, "emitMatchPreviewCreated");
  await service.computeMatchPreviewOnView(candidateId, jobId);

  expect(eventsSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      candidateId,
      jobId,
      source: "candidate_view",
    }),
  );
});

it("after computeProfileScore, emits profile-score.updated", async () => {
  const eventsSpy = jest.spyOn(events, "emitProfileScoreUpdated");
  await service.computeProfileScore(candidateId, resumeId, {
    reason: "manual_recompute",
  });

  expect(eventsSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      candidateId,
      resumeId,
      reason: "manual_recompute",
    }),
  );
});
```

- [ ] **Step 2: Run, fail, implement**

In `scoring.service.ts`, after every `match_score_previews` insert, call `this.events.emitMatchPreviewCreated(...)`. After every `profile_scores` insert, call `this.events.emitProfileScoreUpdated(...)`. Pass through the appropriate fields. Both calls happen via the centralized `EventsService` injected into `ScoringService`.

- [ ] **Step 3: Run + Commit**

```bash
pnpm -F @aurahire/api test -- scoring.service.spec
git add apps/api/src/modules/scoring/scoring.service.ts
git commit -m "feat(scoring): emit realtime events on preview + profile-score writes"
```

---

### Task 26: NotificationsService emits realtime on row insert + mutations

**Files:**

- Modify: `apps/api/src/modules/notifications/notifications.service.ts`
- Modify: `apps/api/src/modules/notifications/notifications.repository.ts`
- Test: `apps/api/src/modules/notifications/notifications.service.spec.ts`

- [ ] **Step 1: Failing test**

```typescript
it("emit() broadcasts notification.created with unreadCount", async () => {
  const eventsSpy = jest.spyOn(events, "emitNotificationCreated");

  await service.emit({
    userId: "u1",
    eventType: "application_status_changed",
    metadata: { fromStatus: "applied", toStatus: "screening" },
  });

  expect(eventsSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: "u1",
      kind: "application_status_changed",
      unreadCount: expect.any(Number),
    }),
  );
});

it("markRead emits notification.read with new unreadCount", async () => {
  const id = await seedNotification({ userId: "u1" });
  const eventsSpy = jest.spyOn(events, "emitNotificationRead");

  await service.markRead(id, "u1");

  expect(eventsSpy).toHaveBeenCalledWith(
    "u1",
    expect.objectContaining({
      id,
      unreadCount: expect.any(Number),
    }),
  );
});

it("archive emits notification.archived", async () => {
  const id = await seedNotification({ userId: "u1" });
  const eventsSpy = jest.spyOn(events, "emitNotificationArchived");

  await service.archive(id, "u1");

  expect(eventsSpy).toHaveBeenCalled();
});

it("archiveAll emits notification.archive_all", async () => {
  await seedNotification({ userId: "u1" });
  await seedNotification({ userId: "u1" });
  const eventsSpy = jest.spyOn(events, "emitNotificationArchiveAll");

  await service.archiveAll("u1");

  expect(eventsSpy).toHaveBeenCalledWith("u1", { unreadCount: 0 });
});
```

- [ ] **Step 2: Implementation**

In `notifications.service.ts`, after `repo.insertOne(...)` returns:

```typescript
const unreadCount = await this.repo.getUnreadCount(params.userId);
this.events.emitNotificationCreated({
  id: row.id,
  userId: row.userId,
  kind: row.eventType,
  title: row.title,
  bodyExcerpt: row.body.slice(0, 200),
  linkUrl: row.link,
  createdAt: row.createdAt.toISOString(),
  unreadCount,
});
```

Add new methods:

```typescript
async archive(id: string, userId: string): Promise<void> {
  await this.repo.archive(id, userId);
  const unreadCount = await this.repo.getUnreadCount(userId);
  this.events.emitNotificationArchived(userId, { id, unreadCount });
}

async archiveAll(userId: string): Promise<void> {
  await this.repo.archiveAllForUser(userId);
  this.events.emitNotificationArchiveAll(userId, { unreadCount: 0 });
}
```

In `notifications.repository.ts`, add:

```typescript
async archive(id: string, userId: string): Promise<void> {
  await this.db
    .update(notificationsTable)
    .set({ archivedAt: new Date(), readAt: sql`COALESCE(read_at, NOW())` })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)));
}

async archiveAllForUser(userId: string): Promise<void> {
  await this.db
    .update(notificationsTable)
    .set({ archivedAt: new Date(), readAt: sql`COALESCE(read_at, NOW())` })
    .where(and(eq(notificationsTable.userId, userId), isNull(notificationsTable.archivedAt)));
}
```

Modify `markRead` (existing) to emit `notification.read` after the update.

- [ ] **Step 3: Run + Commit**

```bash
pnpm -F @aurahire/api test -- notifications.service.spec
git add apps/api/src/modules/notifications/
git commit -m "feat(notifications): emit realtime events on emit/read/archive/archive-all"
```

---

### Task 27: Notifications controller - archive endpoints + tab parameter

**Files:**

- Modify: `apps/api/src/modules/notifications/notifications.controller.ts`
- Modify: `apps/api/src/modules/notifications/dto/list-notifications.dto.ts`
- Test: `apps/api/src/modules/notifications/notifications.controller.spec.ts`

- [ ] **Step 1: Failing test**

```typescript
it("GET /notifications?tab=inbox returns archived_at IS NULL rows", async () => {
  await seedNotification({ userId: u1, archivedAt: null });
  await seedNotification({ userId: u1, archivedAt: new Date() });

  const res = await request(app.getHttpServer())
    .get("/notifications?tab=inbox")
    .set("Authorization", `Bearer ${tokenU1}`);

  expect(res.status).toBe(200);
  expect(res.body.items).toHaveLength(1);
});

it("PATCH /notifications/:id/archive returns 200 and emits realtime event", async () => {
  const id = await seedNotification({ userId: u1 });
  const res = await request(app.getHttpServer())
    .patch(`/notifications/${id}/archive`)
    .set("Authorization", `Bearer ${tokenU1}`);

  expect(res.status).toBe(200);
});

it("POST /notifications/archive-all returns 200", async () => {
  await seedNotification({ userId: u1 });
  await seedNotification({ userId: u1 });

  const res = await request(app.getHttpServer())
    .post("/notifications/archive-all")
    .set("Authorization", `Bearer ${tokenU1}`);

  expect(res.status).toBe(200);
});
```

- [ ] **Step 2: Implementation**

In `dto/list-notifications.dto.ts`, replace `tab: "unread" | "all"` with `tab: "inbox" | "archive"`. Update validators.

In `notifications.controller.ts`:

```typescript
@Patch(":id/archive")
@HttpCode(HttpStatus.OK)
async archive(@CurrentUser() user: AuthUser, @Param("id") id: string) {
  await this.service.archive(id, user.id);
  await this.audit.log({
    actorId: user.id, actorType: "user",
    action: AUDIT_ACTIONS.NOTIFICATION_ARCHIVED,
    entityType: "notification", entityId: id, details: {},
  });
  return { ok: true };
}

@Post("archive-all")
@HttpCode(HttpStatus.OK)
async archiveAll(@CurrentUser() user: AuthUser) {
  await this.service.archiveAll(user.id);
  await this.audit.log({
    actorId: user.id, actorType: "user",
    action: AUDIT_ACTIONS.NOTIFICATIONS_ARCHIVED_ALL,
    entityType: "notifications", entityId: user.id, details: {},
  });
  return { ok: true };
}
```

Update the existing `list` handler to read the `tab` and pass it to `listForUser` accordingly.

In `notifications.repository.ts` `listForUser`, branch on `tab`: `inbox` ⇒ `WHERE archived_at IS NULL`; `archive` ⇒ `WHERE archived_at IS NOT NULL`.

- [ ] **Step 3: Run + Commit**

```bash
pnpm -F @aurahire/api test -- notifications.controller.spec
git add apps/api/src/modules/notifications/
git commit -m "feat(notifications): inbox/archive tabs + archive endpoints"
```

---

### Task 28: Phase 2 checkpoint

- [ ] **Step 1: Type-check / test / lint**

```bash
pnpm -F @aurahire/api typecheck
pnpm -F @aurahire/api test
pnpm -F @aurahire/api lint
pnpm -F @aurahire/shared typecheck
```

Expected: all green.

- [ ] **Step 2: Verify with the user**

> "Phase 2 complete. The backend now emits realtime events on every score insert and every notification mutation, plus exposes `inbox`/`archive` tabs and archive endpoints. Still no UI change. Phase 3 cuts over the frontend."

---

## Phase 3 - Frontend Cutover (PR 3)

This phase produces all user-visible changes: the analyzing screen, buttonless score surfaces, dashboard shimmer + realtime fill, default-resume undo toast, and the sidebar bottom rail across all three portals.

### Task 29: useCandidateRealtime hook

**Files:**

- Create: `apps/web/lib/realtime/use-candidate-realtime.ts`
- Test: `apps/web/lib/realtime/use-candidate-realtime.test.ts`

- [ ] **Step 1: Failing test**

```typescript
import { renderHook, act } from "@testing-library/react";
import { useCandidateRealtime } from "./use-candidate-realtime";

it("subscribes to match-preview.created and exposes the event stream", () => {
  const { result } = renderHook(() => useCandidateRealtime("c1"));
  expect(result.current.matchPreviewCount).toBe(0);

  act(() => {
    mockSocket.emit("match-preview.created", {
      candidateId: "c1",
      jobId: "j1",
      overallScore: 80,
      band: "strong",
      createdAt: "...",
    });
  });

  expect(result.current.matchPreviewCount).toBe(1);
});
```

- [ ] **Step 2: Implement**

Create `apps/web/lib/realtime/use-candidate-realtime.ts`:

```typescript
import { useEffect, useState } from "react";
import { useSocket } from "./use-socket"; // existing hook - verify path
import {
  matchPreviewCreatedPayloadSchema,
  profileScoreUpdatedPayloadSchema,
} from "@aurahire/shared";

export function useCandidateRealtime(candidateId: string) {
  const socket = useSocket();
  const [matchPreviewCount, setMatchPreviewCount] = useState(0);
  const [latestMatchPreview, setLatestMatchPreview] =
    useState<MatchPreviewCreatedPayload | null>(null);
  const [latestProfileScore, setLatestProfileScore] =
    useState<ProfileScoreUpdatedPayload | null>(null);

  useEffect(() => {
    if (!socket || !candidateId) return;

    const handleMatchPreview = (raw: unknown) => {
      const parsed = matchPreviewCreatedPayloadSchema.safeParse(raw);
      if (!parsed.success || parsed.data.candidateId !== candidateId) return;
      setMatchPreviewCount((c) => c + 1);
      setLatestMatchPreview(parsed.data);
    };

    const handleProfileScore = (raw: unknown) => {
      const parsed = profileScoreUpdatedPayloadSchema.safeParse(raw);
      if (!parsed.success || parsed.data.candidateId !== candidateId) return;
      setLatestProfileScore(parsed.data);
    };

    socket.on("match-preview.created", handleMatchPreview);
    socket.on("profile-score.updated", handleProfileScore);
    return () => {
      socket.off("match-preview.created", handleMatchPreview);
      socket.off("profile-score.updated", handleProfileScore);
    };
  }, [socket, candidateId]);

  return { matchPreviewCount, latestMatchPreview, latestProfileScore };
}
```

- [ ] **Step 3: Run + Commit**

```bash
pnpm -F @aurahire/web test -- use-candidate-realtime
git add apps/web/lib/realtime/
git commit -m "feat(web): useCandidateRealtime hook"
```

---

### Task 30: useUserNotifications hook

**Files:**

- Create: `apps/web/lib/realtime/use-user-notifications.ts`
- Test: `apps/web/lib/realtime/use-user-notifications.test.ts`

- [ ] **Step 1: Failing test**

```typescript
it("on notification.created event, increments unreadCount and prepends to inbox cache", async () => {
  const { result } = renderHook(() => useUserNotifications("u1"));

  act(() => {
    mockSocket.emit("notification.created", {
      id: "n1",
      userId: "u1",
      kind: "application_status_changed",
      title: "Status changed",
      bodyExcerpt: "...",
      linkUrl: "/x",
      createdAt: "...",
      unreadCount: 1,
    });
  });

  expect(result.current.unreadCount).toBe(1);
  expect(result.current.inbox[0].id).toBe("n1");
});
```

- [ ] **Step 2: Implementation**

Create `apps/web/lib/realtime/use-user-notifications.ts`:

```typescript
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSocket } from "./use-socket";
import { apiClient } from "@/lib/api-client";

const INBOX_KEY = (userId: string) => ["notifications", "inbox", userId];
const ARCHIVE_KEY = (userId: string) => ["notifications", "archive", userId];
const UNREAD_KEY = (userId: string) => [
  "notifications",
  "unread-count",
  userId,
];

export function useUserNotifications(userId: string) {
  const socket = useSocket();
  const qc = useQueryClient();

  const inbox = useQuery({
    queryKey: INBOX_KEY(userId),
    queryFn: () => apiClient.get("/notifications", { tab: "inbox", limit: 50 }),
    staleTime: 30_000,
  });

  const archive = useQuery({
    queryKey: ARCHIVE_KEY(userId),
    queryFn: () =>
      apiClient.get("/notifications", { tab: "archive", limit: 50 }),
    staleTime: 30_000,
    enabled: false, // only fetched when archive tab is opened
  });

  const unreadCount = useQuery({
    queryKey: UNREAD_KEY(userId),
    queryFn: () => apiClient.get("/notifications/unread-count"),
    staleTime: 30_000,
  });

  // realtime
  useEffect(() => {
    if (!socket || !userId) return;
    const onCreated = (raw: any) => {
      qc.setQueryData(INBOX_KEY(userId), (old: any) => ({
        ...(old ?? { items: [] }),
        items: [raw, ...((old?.items as any[]) ?? [])],
      }));
      qc.setQueryData(UNREAD_KEY(userId), { count: raw.unreadCount });
    };
    const onRead = (raw: any) => {
      qc.setQueryData(UNREAD_KEY(userId), { count: raw.unreadCount });
    };
    const onArchived = (raw: any) => {
      qc.setQueryData(INBOX_KEY(userId), (old: any) => ({
        ...(old ?? { items: [] }),
        items: ((old?.items as any[]) ?? []).filter(
          (n: any) => n.id !== raw.id,
        ),
      }));
      qc.setQueryData(UNREAD_KEY(userId), { count: raw.unreadCount });
    };
    const onArchiveAll = () => {
      qc.setQueryData(INBOX_KEY(userId), { items: [] });
      qc.setQueryData(UNREAD_KEY(userId), { count: 0 });
    };
    socket.on("notification.created", onCreated);
    socket.on("notification.read", onRead);
    socket.on("notification.archived", onArchived);
    socket.on("notification.archive_all", onArchiveAll);
    return () => {
      socket.off("notification.created", onCreated);
      socket.off("notification.read", onRead);
      socket.off("notification.archived", onArchived);
      socket.off("notification.archive_all", onArchiveAll);
    };
  }, [socket, userId, qc]);

  const markRead = useMutation({
    mutationFn: (id: string) => apiClient.post(`/notifications/${id}/read`),
  });
  const archiveOne = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/archive`),
  });
  const archiveAllMutation = useMutation({
    mutationFn: () => apiClient.post("/notifications/archive-all"),
  });

  return {
    inbox: inbox.data?.items ?? [],
    archive: archive.data?.items ?? [],
    unreadCount: unreadCount.data?.count ?? 0,
    fetchArchive: () =>
      qc.fetchQuery({
        queryKey: ARCHIVE_KEY(userId),
        queryFn: archive.refetch,
      }),
    markRead: markRead.mutate,
    archive: archiveOne.mutate,
    archiveAll: archiveAllMutation.mutate,
  };
}
```

- [ ] **Step 3: Run + Commit**

```bash
pnpm -F @aurahire/web test -- use-user-notifications
git add apps/web/lib/realtime/
git commit -m "feat(web): useUserNotifications hook with realtime sync"
```

---

### Task 31: Analyzing page - server shell + state machine setup

**Files:**

- Create: `apps/web/app/onboarding/candidate/analyzing/page.tsx`
- Create: `apps/web/app/onboarding/candidate/analyzing/_analyzing-client.tsx`

- [ ] **Step 1: Server component**

`page.tsx`:

```tsx
import { AnalyzingClient } from "./_analyzing-client";
import { getServerSession } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export default async function AnalyzingPage() {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");
  return <AnalyzingClient candidateId={session.user.id} />;
}
```

- [ ] **Step 2: Client component shell with the state machine**

`_analyzing-client.tsx`:

```tsx
"use client";

import { useEffect, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCandidateRealtime } from "@/lib/realtime/use-candidate-realtime";
import { apiClient } from "@/lib/api-client";
import { ScoreRing } from "@/components/score/score-ring";
import { AiShimmer } from "@/components/ai/ai-shimmer";

type State =
  | { kind: "computingProfileScore" }
  | { kind: "profileScoreReady"; score: ProfileScoreDto; readyAt: number }
  | {
      kind: "streamingPreviews";
      score: ProfileScoreDto;
      readyAt: number;
      previewCount: number;
    }
  | { kind: "profileScoreDegraded" }
  | { kind: "error"; message: string }
  | { kind: "redirecting" };

type Action =
  | { type: "PROFILE_SCORE_OK"; score: ProfileScoreDto }
  | { type: "PROFILE_SCORE_DEGRADED" }
  | { type: "PROFILE_SCORE_ERROR"; message: string }
  | { type: "PREVIEW_TICK" }
  | { type: "REDIRECT" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "PROFILE_SCORE_OK":
      return {
        kind: "profileScoreReady",
        score: action.score,
        readyAt: Date.now(),
      };
    case "PROFILE_SCORE_DEGRADED":
      return { kind: "profileScoreDegraded" };
    case "PROFILE_SCORE_ERROR":
      return { kind: "error", message: action.message };
    case "PREVIEW_TICK":
      if (
        state.kind === "profileScoreReady" ||
        state.kind === "streamingPreviews"
      ) {
        return {
          kind: "streamingPreviews",
          score: state.score,
          readyAt: state.readyAt,
          previewCount:
            (state.kind === "streamingPreviews" ? state.previewCount : 0) + 1,
        };
      }
      return state;
    case "REDIRECT":
      return { kind: "redirecting" };
  }
}

export function AnalyzingClient({ candidateId }: { candidateId: string }) {
  const [state, dispatch] = useReducer(reducer, {
    kind: "computingProfileScore",
  });
  const router = useRouter();
  const { matchPreviewCount } = useCandidateRealtime(candidateId);
  const fired = useRef(false);

  // 1. Kick off the API call once on mount
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    apiClient
      .patch("/candidate-profiles/me/complete-onboarding")
      .then((res) => {
        if (res.profileScore) {
          dispatch({ type: "PROFILE_SCORE_OK", score: res.profileScore });
        } else {
          dispatch({ type: "PROFILE_SCORE_DEGRADED" });
        }
      })
      .catch((err) => {
        dispatch({ type: "PROFILE_SCORE_ERROR", message: err.message });
      });
  }, []);

  // 2. Tick on each match-preview event
  useEffect(() => {
    if (matchPreviewCount > 0) dispatch({ type: "PREVIEW_TICK" });
  }, [matchPreviewCount]);

  // 3. Wall-clock cap on streaming
  useEffect(() => {
    if (
      state.kind !== "profileScoreReady" &&
      state.kind !== "streamingPreviews"
    )
      return;
    const elapsed = Date.now() - state.readyAt;
    const remaining = 10_000 - elapsed;
    if (
      remaining <= 0 ||
      (state.kind === "streamingPreviews" && state.previewCount >= 5)
    ) {
      dispatch({ type: "REDIRECT" });
      return;
    }
    const t = setTimeout(() => dispatch({ type: "REDIRECT" }), remaining);
    return () => clearTimeout(t);
  }, [state]);

  // 4. Degraded path - short pause then redirect
  useEffect(() => {
    if (state.kind !== "profileScoreDegraded") return;
    const t = setTimeout(
      () => router.push("/candidate?profileScoreRetry=1"),
      2000,
    );
    return () => clearTimeout(t);
  }, [state, router]);

  // 5. Final redirect
  useEffect(() => {
    if (state.kind === "redirecting") router.push("/candidate");
  }, [state, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="w-full max-w-md space-y-8 p-8 text-center">
        {state.kind === "computingProfileScore" && (
          <>
            <AiShimmer />
            <p className="text-body-md text-body">
              Computing your Profile Score…
            </p>
          </>
        )}
        {state.kind === "profileScoreReady" && (
          <>
            <ScoreRing
              score={state.score.overallScore}
              band={state.score.band}
              size="md"
            />
            <p className="text-body-md text-body">
              ✓ Profile Score ready. Finding your top matches…
            </p>
          </>
        )}
        {state.kind === "streamingPreviews" && (
          <>
            <ScoreRing
              score={state.score.overallScore}
              band={state.score.band}
              size="md"
            />
            <p className="text-body-md text-body">
              {state.previewCount} of 5 matches ready
            </p>
          </>
        )}
        {state.kind === "profileScoreDegraded" && (
          <p className="text-body-md text-body">
            We're still working on your score - taking you to your dashboard
            now.
          </p>
        )}
        {state.kind === "error" && (
          <>
            <p className="text-body-md text-status-danger">{state.message}</p>
            <button onClick={() => location.reload()} className="btn-primary">
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Render-state tests + Commit**

Add Vitest + RTL tests for each state of the reducer. Then:

```bash
pnpm -F @aurahire/web test -- analyzing
git add apps/web/app/onboarding/candidate/analyzing/
git commit -m "feat(onboarding): analyzing screen state machine"
```

---

### Task 32: Preferences final step redirects to /analyzing

**Files:**

- Modify: `apps/web/app/onboarding/candidate/preferences/_preferences-client.tsx` (verify exact path)

- [ ] **Step 1: Edit redirect target**

Find the success handler on the preferences form. Change `router.push("/candidate")` to `router.push("/onboarding/candidate/analyzing")`.

The form should NOT call `complete-onboarding` directly anymore - that's now done by the analyzing page. The preferences form just saves preferences and redirects.

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/onboarding/candidate/preferences/
git commit -m "feat(onboarding): preferences redirects to /analyzing instead of /candidate"
```

---

### Task 33: Remove "Compute my score" button from dashboard card

**Files:**

- Modify: `apps/web/app/(candidate)/candidate/_components/profile-score-card-client.tsx`

- [ ] **Step 1: Edit the card**

Replace the conditional render of the "Compute my score" button (lines 84-99) with direct render of the Score Ring + "Recompute" affordance only when `staleAt != null`. When recompute is in flight (mutation pending), overlay AiShimmer on the score number.

Concrete diff:

- Remove the existing button + caption block.
- If `score == null && !staleAt && !isComputing`: render the empty state pointing to "set your default resume" (legacy backfill - guard handles this server-side; UI just waits).
- Else: render `<ScoreRing>` with the value. Overlay `<AiShimmer>` if a recompute is in flight.
- If `staleAt != null` and recompute not in flight: show small "Recompute" button below.

Remove all references to manual `compute()` triggers.

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/(candidate)/candidate/_components/profile-score-card-client.tsx
git commit -m "feat(candidate): remove 'Compute my score' button; render score directly"
```

---

### Task 34: Remove "See my match" button + auto-compute on mount

**Files:**

- Modify: `apps/web/app/(candidate)/candidate/jobs/[id]/_match-preview-client.tsx`

- [ ] **Step 1: Edit the component**

Replace the lines 225-231 button. Add a `useEffect` on mount that triggers compute if no cached preview exists. Render shimmer during the call. Render banner on 429.

Pseudo-diff:

```tsx
const hasCached = !!preview;
const [autoComputeMutation, { isPending, error }] = useMutation(...);

useEffect(() => {
  if (!hasCached && !isPending && !error) {
    autoComputeMutation.mutate(jobId);
  }
}, [hasCached, isPending, error, jobId]);

if (isPending) return <AiShimmer caption="Computing your match for this role…" />;
if (error?.code === "DAILY_AI_LIMIT") {
  return (
    <Banner>
      Daily AI compute limit reached. Apply to score this match as part of your application.
      <Link href={`/candidate/jobs/${jobId}/apply`}>Apply</Link>
    </Banner>
  );
}
if (error?.code === "MISSING_RESUME") {
  return <Banner>Upload a resume to see your match. <Link href="/candidate/profile/resumes">Upload</Link></Banner>;
}
if (error) return <InlineError onRetry={() => autoComputeMutation.mutate(jobId)} />;

return <ScoreRing ... />;  // existing
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/(candidate)/candidate/jobs/[id]/_match-preview-client.tsx
git commit -m "feat(candidate): auto-compute match on view; remove 'See my match' button"
```

---

### Task 35: Dashboard RecommendedForYouSection shimmer + realtime fill

**Files:**

- Modify: `apps/web/app/(candidate)/candidate/_dashboard-client.tsx`

- [ ] **Step 1: Edit the section**

Find `RecommendedForYouSection` (lines 669-757). Adjust:

```tsx
const { latestMatchPreview } = useCandidateRealtime(candidateId);
const { data: previews, refetch } = useMyMatchPreviewsQuery();

useEffect(() => {
  if (latestMatchPreview) {
    refetch(); // OR optimistically prepend to the cached list
  }
}, [latestMatchPreview, refetch]);

const items = previews ?? [];
const SLOTS = 5;
const shimmerCount = Math.max(0, SLOTS - items.length);

return (
  <Section>
    {items.map((p) => (
      <RecommendedJobCard key={p.id} preview={p} />
    ))}
    {Array.from({ length: shimmerCount }).map((_, i) => (
      <ShimmerCard key={`shim-${i}`} />
    ))}
    {items.length === 0 && shimmerCount === 0 && (
      <EmptyState>
        We're still finding the right matches for you.
        <button onClick={() => refetch()}>Retry</button>
      </EmptyState>
    )}
  </Section>
);
```

Subscribe to `profile-score.updated` similarly to update the Profile Score card on incoming events.

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/(candidate)/candidate/_dashboard-client.tsx
git commit -m "feat(candidate): dashboard shimmer slots + realtime preview/score updates"
```

---

### Task 36: Default-resume confirmation removed; undo toast added

**Files:**

- Modify: `apps/web/app/(candidate)/candidate/resume/_resume-client.tsx`

- [ ] **Step 1: Remove modal, add undo toast**

Delete lines 840-846 (confirmation modal). Replace with:

```tsx
async function handleSetDefault(resumeId: string) {
  const previousDefaultId = currentDefaultId;
  await setDefaultMutation.mutateAsync(resumeId);
  toast({
    title: `Set ${resumeName(resumeId)} as default`,
    action: previousDefaultId
      ? {
          label: "Undo",
          onClick: () => setDefaultMutation.mutate(previousDefaultId),
        }
      : undefined,
    duration: 6000,
  });
}
```

Wire the `handleSetDefault` to the row click / "Set as default" menu item.

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/(candidate)/candidate/resume/_resume-client.tsx
git commit -m "feat(candidate): instant set-default with undo toast (remove confirmation modal)"
```

---

### Task 37: SidebarBottomRail component - visual layout

**Files:**

- Create: `apps/web/components/portal/sidebar-bottom-rail.tsx`

- [ ] **Step 1: Implementation**

```tsx
"use client";

import { MoreHorizontal, Bell } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useUserNotifications } from "@/lib/realtime/use-user-notifications";
import { SidebarProfilePopover } from "./sidebar-profile-popover";
import { SidebarNotificationsPopover } from "./sidebar-notifications-popover";

export interface SidebarBottomRailProps {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: "candidate" | "recruiter" | "admin";
  };
}

export function SidebarBottomRail({ user }: SidebarBottomRailProps) {
  const { unreadCount } = useUserNotifications(user.id);

  return (
    <div className="flex items-center gap-2 border-t border-hairline px-3 py-3">
      <Popover.Root>
        <Popover.Trigger asChild>
          <button className="flex flex-1 items-center gap-2 rounded-lg p-1 hover:bg-surface-strong">
            <Avatar src={user.avatarUrl} name={user.name} size={32} />
            <span className="title-md truncate">{user.name}</span>
          </button>
        </Popover.Trigger>
        <SidebarProfilePopover user={user} />
      </Popover.Root>

      <Popover.Root>
        <Popover.Trigger asChild>
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-strong">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </Popover.Trigger>
        <SidebarProfilePopover user={user} />
      </Popover.Root>

      <Popover.Root>
        <Popover.Trigger asChild>
          <button className="relative flex h-8 w-8 items-center justify-center rounded-full bg-surface-strong">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </button>
        </Popover.Trigger>
        <SidebarNotificationsPopover userId={user.id} />
      </Popover.Root>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/portal/sidebar-bottom-rail.tsx
git commit -m "feat(portal): sidebar bottom rail with avatar + 3-dot + bell"
```

---

### Task 38: SidebarProfilePopover

**Files:**

- Create: `apps/web/components/portal/sidebar-profile-popover.tsx`

- [ ] **Step 1: Implementation**

```tsx
import * as Popover from "@radix-ui/react-popover";
import {
  Settings,
  Smile,
  Sun,
  Moon,
  Monitor,
  BookOpen,
  HelpCircle,
  LogOut,
} from "lucide-react";
import Link from "next/link";

export interface SidebarProfilePopoverProps {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: "candidate" | "recruiter" | "admin";
  };
}

const SETTINGS_PATH: Record<string, string> = {
  candidate: "/candidate/settings",
  recruiter: "/recruiter/settings",
  admin: "/admin/settings",
};

export function SidebarProfilePopover({ user }: SidebarProfilePopoverProps) {
  return (
    <Popover.Portal>
      <Popover.Content
        side="top"
        align="start"
        sideOffset={8}
        className="w-80 rounded-lg border border-hairline bg-canvas p-6 shadow-soft"
      >
        <div className="mb-4 flex items-start gap-3">
          <Avatar src={user.avatarUrl} name={user.name} size={40} />
          <div className="flex-1 min-w-0">
            <p className="title-md truncate">{user.name}</p>
            <p className="caption text-muted truncate">{user.email}</p>
          </div>
          <Link
            href={SETTINGS_PATH[user.role]}
            className="text-muted hover:text-ink"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>

        <div className="space-y-1">
          <a
            href={`mailto:cjjutbaofficial@gmail.com?subject=AuraHire feedback`}
            className="popover-item"
          >
            <Smile className="h-4 w-4" />
            Send feedback
          </a>
          <ThemeRow />
          <Link href="/how-it-works" className="popover-item">
            <BookOpen className="h-4 w-4" />
            How it works
          </Link>
          <Link href="/help" className="popover-item">
            <HelpCircle className="h-4 w-4" />
            Help
          </Link>
          <button
            onClick={() => signOut()}
            className="popover-item w-full text-left"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>

        <div className="mt-4 border-t border-hairline pt-3">
          <AiStatusPill />
        </div>
      </Popover.Content>
    </Popover.Portal>
  );
}

function ThemeRow() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="popover-item flex items-center justify-between">
      <span>Theme</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setTheme("system")}
          aria-pressed={theme === "system"}
        >
          <Monitor className="h-4 w-4" />
        </button>
        <button
          onClick={() => setTheme("light")}
          aria-pressed={theme === "light"}
        >
          <Sun className="h-4 w-4" />
        </button>
        <button
          onClick={() => setTheme("dark")}
          aria-pressed={theme === "dark"}
        >
          <Moon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AiStatusPill() {
  const { data } = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => apiClient.get("/health/ai"),
  });
  const status = data?.status ?? "ok";
  return (
    <div className="flex items-center justify-between text-sm text-muted">
      <span>
        AI Status - {status === "ok" ? "All systems normal." : "Degraded."}
      </span>
      <span
        className={`h-2 w-2 rounded-full ${status === "ok" ? "bg-score-high" : "bg-score-mid"}`}
      />
    </div>
  );
}
```

The `signOut()` function should map to whatever Supabase Auth signout helper exists in the project (likely from `@/lib/auth/client`).

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/portal/sidebar-profile-popover.tsx
git commit -m "feat(portal): profile dropdown popover (Vercel-style)"
```

---

### Task 39: SidebarNotificationsPopover

**Files:**

- Create: `apps/web/components/portal/sidebar-notifications-popover.tsx`

- [ ] **Step 1: Implementation**

```tsx
"use client";

import * as Popover from "@radix-ui/react-popover";
import * as Tabs from "@radix-ui/react-tabs";
import { Settings as SettingsIcon } from "lucide-react";
import { useUserNotifications } from "@/lib/realtime/use-user-notifications";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export interface SidebarNotificationsPopoverProps {
  userId: string;
}

export function SidebarNotificationsPopover({
  userId,
}: SidebarNotificationsPopoverProps) {
  const {
    inbox,
    archive,
    unreadCount,
    fetchArchive,
    markRead,
    archive: archiveOne,
    archiveAll,
  } = useUserNotifications(userId);
  const router = useRouter();

  function handleRowClick(n: any) {
    markRead(n.id);
    if (n.linkUrl) router.push(n.linkUrl);
  }

  return (
    <Popover.Portal>
      <Popover.Content
        side="top"
        align="start"
        sideOffset={8}
        className="w-96 max-h-[80vh] overflow-hidden rounded-lg border border-hairline bg-canvas shadow-soft"
      >
        <Tabs.Root
          defaultValue="inbox"
          onValueChange={(v) => v === "archive" && fetchArchive()}
        >
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <Tabs.List className="flex gap-4">
              <Tabs.Trigger
                value="inbox"
                className="nav-link data-[state=active]:underline"
              >
                Inbox{" "}
                {unreadCount > 0 ? (
                  <span className="ml-1 rounded-full bg-surface-strong px-1.5 text-xs">
                    {unreadCount}
                  </span>
                ) : null}
              </Tabs.Trigger>
              <Tabs.Trigger
                value="archive"
                className="nav-link data-[state=active]:underline"
              >
                Archive
              </Tabs.Trigger>
            </Tabs.List>
            <Link
              href="/settings/notifications"
              className="text-muted hover:text-ink"
            >
              <SettingsIcon className="h-4 w-4" />
            </Link>
          </div>

          <Tabs.Content value="inbox" className="max-h-[60vh] overflow-y-auto">
            {inbox.length === 0 ? (
              <EmptyState>
                No new notifications. We'll let you know when something happens.
              </EmptyState>
            ) : (
              inbox.map((n) => (
                <Row
                  key={n.id}
                  n={n}
                  onClick={() => handleRowClick(n)}
                  onArchive={() => archiveOne(n.id)}
                />
              ))
            )}
          </Tabs.Content>

          <Tabs.Content
            value="archive"
            className="max-h-[60vh] overflow-y-auto"
          >
            {archive.length === 0 ? (
              <EmptyState>No archived notifications yet.</EmptyState>
            ) : (
              archive.map((n) => (
                <Row key={n.id} n={n} onClick={() => handleRowClick(n)} />
              ))
            )}
          </Tabs.Content>

          {inbox.length > 0 && (
            <div className="border-t border-hairline p-3">
              <button
                onClick={() => archiveAll()}
                className="btn-secondary-light w-full"
              >
                Archive all
              </button>
            </div>
          )}
        </Tabs.Root>
      </Popover.Content>
    </Popover.Portal>
  );
}

function Row({
  n,
  onClick,
  onArchive,
}: {
  n: any;
  onClick: () => void;
  onArchive?: () => void;
}) {
  const isUnread = !n.readAt;
  return (
    <div
      className="flex items-start gap-3 border-b border-hairline-soft px-4 py-3 hover:bg-surface-soft cursor-pointer"
      onClick={onClick}
    >
      <NotificationIcon kind={n.kind} />
      <div className="flex-1 min-w-0">
        <p className="body-sm font-semibold">{n.title}</p>
        <p className="body-sm text-muted">{n.bodyExcerpt}</p>
        <p className="caption text-muted">
          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
        </p>
      </div>
      {isUnread && <span className="mt-1 h-2 w-2 rounded-full bg-primary" />}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-12 text-center text-body-sm text-muted">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/portal/sidebar-notifications-popover.tsx
git commit -m "feat(portal): notifications popover with Inbox/Archive tabs"
```

---

### Task 40: Wire bottom rail into all three portal sidebars

**Files:**

- Modify: candidate sidebar component
- Modify: recruiter sidebar component
- Modify: admin sidebar component

- [ ] **Step 1: Locate the three sidebars**

Run: `grep -rln "Sidebar\|Nav" apps/web/components apps/web/app | grep -i sidebar`

Identify the three role-specific sidebar files. Likely paths:

- `apps/web/components/portal/candidate-sidebar.tsx` (or similar)
- `apps/web/components/portal/recruiter-sidebar.tsx`
- `apps/web/components/portal/admin-sidebar.tsx`

If a shared base sidebar exists, edit that single file.

- [ ] **Step 2: Wire the bottom rail**

In each sidebar's bottom anchor area, replace the current user info / logout button with:

```tsx
import { SidebarBottomRail } from "./sidebar-bottom-rail";

// inside the JSX, at the bottom of the sidebar:
<SidebarBottomRail user={user} />;
```

`user` comes from the existing session/auth context.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/portal/ apps/web/app/
git commit -m "feat(portal): wire sidebar bottom rail into all 3 portals"
```

---

### Task 41: E2E - full onboarding flow

**Files:**

- Create: `apps/web/tests/e2e/onboarding-autoscore.spec.ts` (or existing e2e folder)

- [ ] **Step 1: Test**

```typescript
import { test, expect } from "@playwright/test";

test("candidate onboarding lands on dashboard with score and recommendations", async ({
  page,
}) => {
  await loginAsCandidate(page);
  // upload resume → fill personal → review → preferences (helper functions in e2e utils)
  await uploadResume(page, "fixtures/sample-cv.pdf");
  await fillPersonal(page, { name: "Test User", phone: "..." });
  await reviewExperience(page);
  await fillPreferences(page);
  await page.click("text=Complete setup");

  // analyzing screen
  await expect(page).toHaveURL(/\/onboarding\/candidate\/analyzing/);
  await expect(page.locator("text=Computing your Profile Score")).toBeVisible();

  // dashboard
  await page.waitForURL("/candidate", { timeout: 30000 });
  await expect(page.locator("[data-testid=profile-score-ring]")).toBeVisible();
  await expect(
    page.locator("[data-testid=recommended-job-card]").first(),
  ).toBeVisible({ timeout: 15000 });
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/tests/e2e/
git commit -m "test(e2e): full onboarding -> analyzing -> dashboard flow"
```

---

### Task 42: E2E - notification round-trip per role

**Files:**

- Create: `apps/web/tests/e2e/notification-roundtrip.spec.ts`

- [ ] **Step 1: Test**

```typescript
test("candidate sees new notification when application status changes", async ({
  page,
  browser,
}) => {
  // candidate session
  await loginAsCandidate(page);
  const initialUnread = await page
    .locator("[data-testid=bell-unread-count]")
    .textContent();

  // recruiter session in second context - advances application status
  const recruiterCtx = await browser.newContext();
  const rPage = await recruiterCtx.newPage();
  await loginAsRecruiter(rPage);
  await rPage.goto(`/recruiter/applications/${APPLICATION_ID}`);
  await rPage.click("text=Move to Screening");

  // candidate page should auto-update
  await expect(page.locator("[data-testid=bell-unread-count]")).not.toHaveText(
    initialUnread!,
    { timeout: 5000 },
  );

  // open popover and verify the notification
  await page.click("[data-testid=bell-button]");
  await expect(page.locator("text=Status changed to Screening")).toBeVisible();
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/tests/e2e/
git commit -m "test(e2e): notification round-trip across two role sessions"
```

---

### Task 43: Phase 3 checkpoint

- [ ] **Step 1: Type-check / unit / lint**

```bash
pnpm -F @aurahire/web typecheck
pnpm -F @aurahire/web test
pnpm -F @aurahire/web lint
```

Expected: all green.

- [ ] **Step 2: E2E**

Tell the user:

> "Frontend changes complete. Please run the dev servers (`pnpm dev` from the repo root) and verify manually:
>
> 1. Sign up a new candidate → onboarding wizard → at the end, you see the analyzing screen with milestones, then land on dashboard with score and recommendations.
> 2. On a recommended job's detail page, the score renders without a button.
> 3. On a non-recommended job, the score auto-computes (shimmer → score).
> 4. Open the sidebar bell - empty inbox shows the empty state.
> 5. Trigger a notification (advance an application status as a recruiter) - the bell badge updates without refresh.
> 6. Profile dropdown opens from name OR ⋯ button. Theme picker switches themes.
> 7. Settings gear in the dropdown navigates to the role-specific settings page.
> 8. Set-default-resume action works without a confirmation modal; undo toast appears.
> 9. Delete the default resume with another resume present → toast says new default was set.
> 10. Try to delete the last remaining resume → 409 surfaces as inline error.
>
> Run `pnpm -F @aurahire/web exec playwright test` to validate the e2e suite. If everything passes, the proactive system is ready for review/merge."

- [ ] **Step 3: Tag the implementation complete**

```bash
git log --oneline -25
```

Confirm the commit history for the three phases is clean and ordered.

---

## Self-Review Notes

### Spec coverage

Mapping each spec area to a task or tasks:

| Spec area                         | Tasks                                                                                                                                                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A - Candidate scoring             | 1 (migration), 3, 4, 5 (rate-limited on-view), 6 (resume-default change handler), 9 (recompute processor), 10, 11 (extended complete-onboarding), 12 (legacy backfill guard), 25 (realtime emit), 31 (analyzing screen), 32, 33, 34, 35 |
| B - F1 Profile-edit recompute     | 8                                                                                                                                                                                                                                       |
| C - F2 Resume default UX          | 36                                                                                                                                                                                                                                      |
| C - F3 Resume delete cascade      | 7                                                                                                                                                                                                                                       |
| D - F4 Application status emit    | 13                                                                                                                                                                                                                                      |
| D - F5 Offer accept/decline emit  | 15                                                                                                                                                                                                                                      |
| D - F6 New application emit       | 14                                                                                                                                                                                                                                      |
| D - F7 Bell badge realtime        | 26, 27, 30, 37                                                                                                                                                                                                                          |
| D - F8 Interview email plumbing   | 16                                                                                                                                                                                                                                      |
| E - F9 Interview reminder cron    | 17                                                                                                                                                                                                                                      |
| E - F10 Offer expiration cron     | 18                                                                                                                                                                                                                                      |
| E - F11 Job deadline auto-archive | 19                                                                                                                                                                                                                                      |
| E - F12 Feedback-due cron         | 20                                                                                                                                                                                                                                      |
| E - F13 Digest cron               | 21                                                                                                                                                                                                                                      |
| F - Sidebar bottom rail           | 37, 38, 39, 40                                                                                                                                                                                                                          |
| G - DB migration                  | 1, 2                                                                                                                                                                                                                                    |
| H - Realtime contract             | 23, 24                                                                                                                                                                                                                                  |
| I - Error matrix                  | covered implicitly across all tasks                                                                                                                                                                                                     |
| J - Testing strategy              | embedded in every task; E2E in 41, 42                                                                                                                                                                                                   |
| K - Rollout plan                  | Phase boundaries 22, 28, 43                                                                                                                                                                                                             |

No spec area is left without a task.

### Placeholder scan

Several task steps say "verify exact path during implementation" for sidebar files and a couple of repo paths. These are not "TBD" placeholders - they're explicit verification steps for paths the agent can locate with one Glob. The tasks are otherwise concrete.

### Type consistency

- `MatchPreviewSource` enum extension: uniformly `"candidate_view"` across schema, Zod, and code.
- `ProfileScoreReason`: `"onboarding" | "resume_change" | "preferences_change" | "profile_change" | "manual_recompute"` - matches the spec and Zod schema.
- `NotificationEventType` enum: new values (`offer_accepted`, `offer_declined`, `offer_expiring_soon`, `offer_expired`, `interview_reminder_24h`, `interview_feedback_due`, `job_archived_by_deadline`) added consistently in `event-defaults.ts`.
- Realtime room helper: every task uses `Rooms.user(...)` (not the spec's notational `candidate:{id}`). Confirmed consistent.
- Rate-limit error code: `DAILY_AI_LIMIT` consistent across exception, controller, frontend banner.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-08-proactive-system.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
