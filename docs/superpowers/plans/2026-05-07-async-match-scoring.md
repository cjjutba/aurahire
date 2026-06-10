# Async Match Scoring + Batched Redaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the 34-second synchronous `POST /api/v1/applications` flow off the request path. Collapse the 10-call serial redaction loop into one batched structured call (prompt v2.0.0). Push the match-score AI call into a BullMQ worker. Stream the completed score to the candidate, recruiter, and admins via the existing `RealtimeGateway` using a new `application.scored` event. Result: apply request returns ~200ms; the score appears live ~13s later without a refresh.

**Architecture:** Three durable changes. (1) **Batched redaction** - one OpenAI structured call returns scrubbed `summary` + every responsibility in a single response keyed by index, replacing 10 sequential text completions. (2) **Async scoring** - apply persists `applications.score_status='computing'`, enqueues a `match-score` BullMQ job, returns 201 immediately; the worker performs redaction + scoring + persistence + audit, then the existing realtime gateway broadcasts `application.scored` to `user:{candidateId}`, `recruiter:{recruiterId}`, `job:{jobId}`. (3) **Frontend live update** - apply page redirects on 201, application detail page shows `AiShimmer` while `score_status='computing'`, subscribes to `application.scored`, replaces shimmer with the live score on event arrival. TanStack Query cache invalidation ensures even windows that joined late catch up.

**Tech Stack:** NestJS 10, BullMQ 5 (Redis), OpenAI structured outputs (gpt-4o-mini), Drizzle ORM, Zod, Supabase Postgres + Auth, Socket.io 4 with Redis adapter, Next.js 16, TanStack Query 5.

---

## File Structure

**Backend changes:**
| Path | Change |
|---|---|
| `apps/api/src/ai/prompts/redact-batch.ts` | **Create.** Prompt v2.0.0 system text + Zod batch schema. |
| `apps/api/src/ai/redact-pii.service.ts` | **Modify.** Replace `Promise.allSettled` text loop with one `generateStructured` call. |
| `apps/api/src/ai/redact-pii.service.spec.ts` | **Modify.** Update parallelism tests to assert single-call batching. |
| `packages/db/src/schema.ts` | **Modify.** Add `scoreStatus` column to `applicationsTable`, add `APPLICATION_SCORE_STATUS` enum. |
| `packages/db/drizzle/0008_application_score_status.sql` | **Create.** Migration adding `score_status` column + index. |
| `packages/shared/src/enums.ts` | **Modify.** Export `APPLICATION_SCORE_STATUS` enum tuple. |
| `packages/shared/src/realtime/events.ts` | **Modify.** Add `ApplicationScored` event + Zod schema + payload type + map entry. |
| `apps/api/src/queue/queue.constants.ts` | **Modify.** Add `MATCH_SCORE_QUEUE` constant. |
| `apps/api/src/queue/match-score-queue.service.ts` | **Create.** Thin enqueue facade. |
| `apps/api/src/queue/queue.module.ts` | **Modify.** Register `MATCH_SCORE_QUEUE`, export new service. |
| `apps/api/src/modules/scoring/processors/match-score.processor.ts` | **Create.** BullMQ worker that runs the AI score + persists + emits event. |
| `apps/api/src/modules/scoring/scoring.module.ts` | **Modify.** Register the new processor. |
| `apps/api/src/modules/scoring/scoring.service.ts` | **Modify.** Set `score_status='completed' \| 'failed'` after work; add `emitApplicationScored` call after `insertMatchScore` returns. |
| `apps/api/src/modules/applications/applications.service.ts` | **Modify.** Replace synchronous `await scoringService.computeMatchScore(...)` with `await matchScoreQueue.enqueue(...)`; set `score_status='computing'`. |
| `apps/api/src/modules/applications/applications.repository.ts` | **Modify.** Update `insert()` to set `scoreStatus='computing'` by default; add `updateScoreStatus()` method. |
| `apps/api/src/modules/applications/dto/application-response.dto.ts` | **Modify.** Add `scoreStatus` field on `ApplicationDto`. |
| `apps/api/src/realtime/events.service.ts` | **Modify.** Add `emitApplicationScored()` method. |

**Frontend changes:**
| Path | Change |
|---|---|
| `apps/web/app/(candidate)/candidate/applications/[id]/_application-scored-client.tsx` | **Create.** Headless realtime listener invalidating TanStack Query on `application.scored`. |
| `apps/web/app/(candidate)/candidate/applications/[id]/page.tsx` | **Modify.** Mount `_application-scored-client` + render `AiShimmer` when `scoreStatus === 'computing'`. |
| `apps/web/app/(candidate)/candidate/jobs/[id]/apply/_apply-form-client.tsx` | **Modify.** Replace "Submitting…" + AiShimmer block with immediate redirect on 201; rely on detail page for the wait UI. |
| `apps/web/hooks/use-applications.ts` | **Modify.** Surface `scoreStatus` on the application type. |

---

## Operating discipline

- **TDD throughout.** Write the failing test, watch it fail, write minimal code, watch it pass, commit. Skip nothing.
- **Migrations:** the human (or Claude with explicit per-step authorization) applies via Supabase MCP `apply_migration`. The plan checkpoints before each migration apply.
- **Prompt versioning is thesis-defensible.** Bumping `REDACT_TEXT_VERSION` 1.0.0 → 2.0.0 is a deliberate event; `prompt_version` audit fields must reflect the new value once the new prompt is live, so old score rows continue to show their original prompt version.
- **No `--no-verify`, no `git stash`, no destructive git.** If a hook fails, fix the cause.
- **Frequent commits.** Each task ends with a commit.

---

## Task 1: Add `APPLICATION_SCORE_STATUS` shared enum

**Why first:** Several later tasks (DB column, DTO, service status writes) all depend on this enum being available from `@aurahire/shared`. Defining it once removes drift risk.

**Files:**

- Modify: `packages/shared/src/enums.ts`

- [ ] **Step 1: Locate the existing enum block**

Run: `grep -n "APPLICATION_STATUS\|export const" packages/shared/src/enums.ts | head -10`
Expected: shows existing tuples like `APPLICATION_STATUS`, `INTERVIEW_STATUS`.

- [ ] **Step 2: Append the new enum**

Add to `packages/shared/src/enums.ts` immediately after the `APPLICATION_STATUS` declaration:

```ts
/**
 * Lifecycle of the AI match-score for an application.
 *  - "computing": worker has been enqueued; UI shows AiShimmer.
 *  - "completed": match_score row exists and was emitted via realtime.
 *  - "failed": worker exhausted retries; UI shows a manual-retry affordance.
 */
export const APPLICATION_SCORE_STATUS = [
  "computing",
  "completed",
  "failed",
] as const;

export type ApplicationScoreStatus = (typeof APPLICATION_SCORE_STATUS)[number];
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @aurahire/shared type-check`
Expected: silent success.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/enums.ts
git commit -m "feat(shared): add APPLICATION_SCORE_STATUS enum for async scoring"
```

---

## Task 2: Add `application.scored` realtime event schema

**Files:**

- Modify: `packages/shared/src/realtime/events.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/realtime/events.spec.ts` (if it doesn't exist) or extend the existing one. The literal file path differs between the repo conventions; if no `events.spec.ts` exists, create it:

```ts
import {
  RealtimeEvent,
  applicationScoredSchema,
  type ApplicationScoredPayload,
} from "./events";

describe("RealtimeEvent.ApplicationScored", () => {
  it("uses the past-tense dotted name", () => {
    expect(RealtimeEvent.ApplicationScored).toBe("application.scored");
  });

  it("validates a complete payload", () => {
    const payload: ApplicationScoredPayload = {
      applicationId: "00000000-0000-4000-8000-000000000001",
      jobId: "00000000-0000-4000-8000-000000000002",
      recruiterId: "00000000-0000-4000-8000-000000000003",
      candidateId: "00000000-0000-4000-8000-000000000004",
      overallScore: 92,
      band: "strong",
      scoredAt: "2026-05-07T12:00:00.000Z",
    };
    expect(() => applicationScoredSchema.parse(payload)).not.toThrow();
  });

  it("rejects out-of-range scores", () => {
    expect(() =>
      applicationScoredSchema.parse({
        applicationId: "00000000-0000-4000-8000-000000000001",
        jobId: "00000000-0000-4000-8000-000000000002",
        recruiterId: "00000000-0000-4000-8000-000000000003",
        candidateId: "00000000-0000-4000-8000-000000000004",
        overallScore: 101,
        band: "strong",
        scoredAt: "2026-05-07T12:00:00.000Z",
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aurahire/shared test -- --testPathPatterns=events`
Expected: FAIL - `applicationScoredSchema` is not exported.

- [ ] **Step 3: Add schema, type, and event constant**

In `packages/shared/src/realtime/events.ts`, add the constant entry inside `RealtimeEvent`:

```ts
export const RealtimeEvent = {
  ApplicationCreated: "application.created",
  ApplicationStatusChanged: "application.status_changed",
  ApplicationScored: "application.scored",
  InterviewScheduled: "interview.scheduled",
  InterviewStatusChanged: "interview.status_changed",
  OfferSent: "offer.sent",
  AuditEntry: "audit.entry",
  BiasFlagCreated: "bias.flag_created",
} as const;
```

Then below the `applicationStatusChangedSchema` block, add:

```ts
export const applicationScoredSchema = z.object({
  applicationId: z.string().uuid(),
  jobId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  candidateId: z.string().uuid(),
  overallScore: z.number().int().min(0).max(100),
  band: z.enum(["strong", "partial", "limited"]),
  scoredAt: isoDate,
});
export type ApplicationScoredPayload = z.infer<typeof applicationScoredSchema>;
```

Then extend `RealtimeEventPayloadMap`:

```ts
export interface RealtimeEventPayloadMap {
  [RealtimeEvent.ApplicationCreated]: ApplicationCreatedPayload;
  [RealtimeEvent.ApplicationStatusChanged]: ApplicationStatusChangedPayload;
  [RealtimeEvent.ApplicationScored]: ApplicationScoredPayload;
  [RealtimeEvent.InterviewScheduled]: InterviewScheduledPayload;
  [RealtimeEvent.InterviewStatusChanged]: InterviewStatusChangedPayload;
  [RealtimeEvent.OfferSent]: OfferSentPayload;
  [RealtimeEvent.AuditEntry]: AuditEntryPayload;
  [RealtimeEvent.BiasFlagCreated]: BiasFlagCreatedPayload;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @aurahire/shared test -- --testPathPatterns=events`
Expected: PASS, 3/3.

- [ ] **Step 5: Type-check the workspace dependents**

Run: `pnpm --filter @aurahire/shared type-check && pnpm --filter @aurahire/api type-check && pnpm --filter @aurahire/web type-check`
Expected: silent success in all three.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/realtime/events.ts packages/shared/src/realtime/events.spec.ts
git commit -m "feat(shared): add application.scored realtime event schema"
```

---

## Task 3: Add `score_status` column to `applications` (schema + migration)

**Files:**

- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/drizzle/0008_application_score_status.sql`

- [ ] **Step 1: Add the column to the Drizzle schema**

In `packages/db/src/schema.ts`, near the top of the file ensure the import for `APPLICATION_SCORE_STATUS` exists. Find the existing `APPLICATION_STATUS` import:

```ts
import { APPLICATION_STATUS /* … */ } from "@aurahire/shared";
```

Extend to:

```ts
import {
  APPLICATION_STATUS,
  APPLICATION_SCORE_STATUS,
  /* … */
} from "@aurahire/shared";
```

In the `applicationsTable` definition (line ~245), add the new column after `status` and before `recruiterNotes`:

```ts
status: text("status", { enum: APPLICATION_STATUS }).notNull().default("applied"),
scoreStatus: text("score_status", { enum: APPLICATION_SCORE_STATUS })
  .notNull()
  .default("computing"),
recruiterNotes: text("recruiter_notes"),
```

In the same table's index block, add:

```ts
scoreStatusIdx: index("applications_score_status_idx").on(t.scoreStatus),
```

- [ ] **Step 2: Author the migration SQL**

Create `packages/db/drizzle/0008_application_score_status.sql`:

```sql
-- =============================================================================
-- Async match scoring - score_status lifecycle column on applications.
-- =============================================================================
--
-- WHAT THIS MIGRATION DOES
--   Adds applications.score_status (computing | completed | failed) so the
--   apply request can return immediately with status 'computing' while a
--   BullMQ worker computes the AI match score in the background. UI uses this
--   column to show AiShimmer vs the rendered score.
--
-- WHY
--   POST /applications used to wait ~34 seconds for sequential redaction +
--   match scoring before responding. With the work moved to a queue, the
--   apply response drops to ~200ms; the score is delivered via the realtime
--   `application.scored` event when the worker finishes. The column exists
--   so detail-page renders that miss the live event still know the work is
--   in progress and show the right placeholder.
--
-- BACKFILL
--   Existing rows are pre-scored under the old synchronous flow, so the
--   defensible default for in-place rows is 'completed'. After the column
--   default is changed to 'computing' for new rows, this UPDATE pins the
--   existing rows to a sensible terminal state.

ALTER TABLE applications
  ADD COLUMN score_status text NOT NULL DEFAULT 'computing'
  CHECK (score_status IN ('computing', 'completed', 'failed'));

UPDATE applications
SET score_status = 'completed'
WHERE id IN (SELECT application_id FROM match_scores);

CREATE INDEX applications_score_status_idx
  ON applications (score_status);
```

- [ ] **Step 3: Type-check the schema package**

Run: `pnpm --filter @aurahire/db type-check`
Expected: silent success.

- [ ] **Step 4: Apply the migration via Supabase MCP**

This is the human-or-Claude-authorized step. Apply the migration:

Tool call (Claude or human via MCP UI):

```
mcp__plugin_supabase_supabase__apply_migration({
  project_id: "fzjvalmouygmmnrgpgtg",
  name: "0008_application_score_status",
  query: "<contents of 0008_application_score_status.sql>"
})
```

Expected: `{ success: true }`.

- [ ] **Step 5: Verify the column landed**

Tool call:

```
mcp__plugin_supabase_supabase__execute_sql({
  project_id: "fzjvalmouygmmnrgpgtg",
  query: "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='applications' AND column_name='score_status'"
})
```

Expected: one row with `column_default = 'computing'::text`.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/0008_application_score_status.sql
git commit -m "feat(db): add applications.score_status for async match scoring"
```

---

## Task 4: Batched redaction prompt v2.0.0 (the 14s → 1s win)

**Files:**

- Create: `apps/api/src/ai/prompts/redact-batch.ts`
- Modify: `apps/api/src/ai/redact-pii.service.ts`
- Modify: `apps/api/src/ai/redact-pii.service.spec.ts`

- [ ] **Step 1: Write the prompt + Zod batch schema**

Create `apps/api/src/ai/prompts/redact-batch.ts`:

```ts
import { z } from "zod";

export const REDACT_BATCH_VERSION = "2.0.0";

export const REDACT_BATCH_SYSTEM_PROMPT = `You are a privacy assistant. You will receive a batch of free-text fields from a candidate's resume, each with an "id" and the original "text". Return cleaned versions keyed by the same "id".

For each field, redact ONLY personal identifiers, replacing them inline with [REDACTED]:
- Person names (full names or first names referring to the candidate)
- Pronouns when used as identity markers (he/she/they referring to the person)
- Age references ("28-year-old", "fresh graduate of 2024", explicit ages)
- Gender markers ("a man with experience in...", "as a woman in tech...", "father/mother of...")

Do NOT redact:
- Technical content (programming languages, frameworks, tools)
- Company names
- Institution names
- Job titles
- Skills
- Industry jargon
- Generic terms (engineer, developer, manager)

Return the array of { id, scrubbed } objects exactly mirroring the input ids - do not drop, reorder, or merge entries.`;

export const redactBatchInputItemSchema = z.object({
  id: z.string(),
  text: z.string(),
});
export type RedactBatchInputItem = z.infer<typeof redactBatchInputItemSchema>;

export const redactBatchOutputItemSchema = z.object({
  id: z.string(),
  scrubbed: z.string(),
});
export const redactBatchOutputSchema = z.object({
  items: z.array(redactBatchOutputItemSchema),
});
export type RedactBatchOutput = z.infer<typeof redactBatchOutputSchema>;

export function buildRedactBatchUserPrompt(
  items: readonly RedactBatchInputItem[],
): string {
  return `Redact each field below. Preserve the same ids in your response.\n\n${JSON.stringify(items, null, 2)}`;
}
```

- [ ] **Step 2: Update the spec to expect a single structured call**

Replace the existing `RedactPiiService.redactResume parallelism` describe block with:

```ts
describe("RedactPiiService.redactResume batching", () => {
  it("makes ONE structured call covering summary + every responsibility", async () => {
    const generateStructured = jest.fn(async (opts: { userPrompt: string }) => {
      // Echo every input id back unchanged-prefixed so we can verify pairing.
      const parsed = JSON.parse(
        opts.userPrompt.slice(opts.userPrompt.indexOf("[")),
      ) as Array<{ id: string; text: string }>;
      return {
        data: {
          items: parsed.map((p) => ({
            id: p.id,
            scrubbed: `scrubbed:${p.id}`,
          })),
        },
        latencyMs: 100,
        model: "gpt-4o-mini",
        promptTokens: 0,
        completionTokens: 0,
      };
    });
    const svc = new RedactPiiService({
      generateStructured,
      generateText: jest.fn(),
    } as never);

    const parsed = buildResume({
      responsibilities: [
        [
          "Led customer-facing API platform serving 8 thousand daily active users.",
          "Owned migration from monolith to NestJS-based service mesh, reducing p95.",
        ],
        [
          "Built React/Redux dashboard consumed by product, support, and finance teams.",
        ],
      ],
    });

    const result = await svc.redactResume(parsed, "test-req");

    expect(generateStructured).toHaveBeenCalledTimes(1);
    expect(result.redacted.summary?.text).toBe("scrubbed:summary");
    expect(result.redacted.experience[0]!.responsibilities[0]).toBe(
      "scrubbed:experience.0.responsibilities.0",
    );
    expect(result.redactedFields).toEqual([
      "contact.full_name",
      "contact.email",
      "contact.phone",
      "contact.linkedin_url",
      "contact.portfolio_url",
      "summary",
      "experience.0.responsibilities.0",
      "experience.0.responsibilities.1",
      "experience.1.responsibilities.0",
    ]);
  });

  it("does not make any AI call when there are no free-text fields", async () => {
    const generateStructured = jest.fn();
    const svc = new RedactPiiService({
      generateStructured,
      generateText: jest.fn(),
    } as never);

    const parsed = buildResume({
      summaryText: null,
      responsibilities: [],
    });

    await svc.redactResume(parsed);
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("falls back to keeping originals if AI returns missing ids", async () => {
    const generateStructured = jest.fn(async () => ({
      data: { items: [] }, // schema-valid but missing all ids
      latencyMs: 0,
      model: "gpt-4o-mini",
      promptTokens: 0,
      completionTokens: 0,
    }));
    const svc = new RedactPiiService({
      generateStructured,
      generateText: jest.fn(),
    } as never);

    const original =
      "Led 4-engineer team migrating legacy Express monolith to a NestJS-based service mesh.";
    const parsed = buildResume({
      summaryText: null,
      responsibilities: [[original]],
    });

    const result = await svc.redactResume(parsed);
    expect(result.redacted.experience[0]!.responsibilities[0]).toBe(original);
    expect(result.redactedFields).not.toContain(
      "experience.0.responsibilities.0",
    );
  });
});
```

Delete the previous `RedactPiiService.redactResume parallelism` describe block - it's superseded by the batching block above.

- [ ] **Step 3: Run the spec to verify RED**

Run: `cd apps/api && pnpm test -- --testPathPatterns=redact-pii`
Expected: FAIL - current code calls `generateText` not `generateStructured`.

- [ ] **Step 4: Rewrite `redactResume` to use the batched call**

In `apps/api/src/ai/redact-pii.service.ts`, replace the parallel-text-loop implementation introduced in this branch with:

```ts
import { Injectable, Logger } from "@nestjs/common";
import type { ParsedResume } from "@aurahire/shared";

import { OpenAIService } from "./openai.service";
import {
  REDACT_BATCH_SYSTEM_PROMPT,
  REDACT_BATCH_VERSION,
  buildRedactBatchUserPrompt,
  redactBatchOutputSchema,
  type RedactBatchInputItem,
} from "./prompts/redact-batch";

const ALWAYS_REDACTED_PATHS = [
  "contact.full_name",
  "contact.email",
  "contact.phone",
  "contact.linkedin_url",
  "contact.portfolio_url",
] as const;

const FREE_TEXT_MIN_LENGTH = 50;

export interface RedactionResult {
  redacted: ParsedResume;
  redactedFields: string[];
}

@Injectable()
export class RedactPiiService {
  private readonly logger = new Logger(RedactPiiService.name);

  constructor(private readonly openai: OpenAIService) {}

  redactStructured(parsed: ParsedResume): RedactionResult {
    const redactedFields: string[] = [];
    const cleaned: ParsedResume = {
      ...parsed,
      contact: { ...parsed.contact },
    };

    for (const path of ALWAYS_REDACTED_PATHS) {
      const [, key] = path.split(".");
      if (!key) continue;
      const k = key as keyof typeof cleaned.contact;
      if (cleaned.contact[k] != null) {
        cleaned.contact[k] = null as never;
        redactedFields.push(path);
      }
    }

    return { redacted: cleaned, redactedFields };
  }

  async redactResume(
    parsed: ParsedResume,
    requestId?: string,
  ): Promise<RedactionResult> {
    const { redacted, redactedFields } = this.redactStructured(parsed);

    type ScrubTask = {
      path: string;
      original: string;
      apply: (scrubbed: string) => void;
    };
    const tasks: ScrubTask[] = [];

    if (
      redacted.summary &&
      redacted.summary.text.length >= FREE_TEXT_MIN_LENGTH
    ) {
      const summary = redacted.summary;
      tasks.push({
        path: "summary",
        original: summary.text,
        apply: (scrubbed) => {
          redacted.summary = { ...summary, text: scrubbed };
        },
      });
    }

    for (let i = 0; i < redacted.experience.length; i++) {
      const exp = redacted.experience[i]!;
      for (let j = 0; j < exp.responsibilities.length; j++) {
        const r = exp.responsibilities[j]!;
        if (r.length >= FREE_TEXT_MIN_LENGTH) {
          const idxI = i;
          const idxJ = j;
          tasks.push({
            path: `experience.${idxI}.responsibilities.${idxJ}`,
            original: r,
            apply: (scrubbed) => {
              redacted.experience[idxI]!.responsibilities[idxJ] = scrubbed;
            },
          });
        }
      }
    }

    if (tasks.length === 0) {
      return { redacted, redactedFields };
    }

    const items: RedactBatchInputItem[] = tasks.map((t) => ({
      id: t.path,
      text: t.original,
    }));

    try {
      const result = await this.openai.generateStructured({
        schema: redactBatchOutputSchema,
        schemaName: "RedactBatchOutput",
        systemPrompt: REDACT_BATCH_SYSTEM_PROMPT,
        userPrompt: buildRedactBatchUserPrompt(items),
        requestId: requestId
          ? `${requestId}:redact-v${REDACT_BATCH_VERSION}`
          : undefined,
      });

      const byId = new Map(result.data.items.map((it) => [it.id, it.scrubbed]));

      for (const task of tasks) {
        const scrubbed = byId.get(task.path);
        if (scrubbed === undefined) {
          this.logger.warn(
            `Redact batch dropped id ${task.path}; keeping original`,
          );
          continue;
        }
        if (scrubbed !== task.original) {
          task.apply(scrubbed);
          redactedFields.push(task.path);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Batched redaction failed; keeping originals: ${(err as Error).message}`,
      );
    }

    return { redacted, redactedFields };
  }
}
```

- [ ] **Step 5: Update audit fields downstream - `prompt_version`**

The `match_scores.prompt_version` audit column has historically pointed at the _match_ prompt, not the redaction prompt. Redaction tracking lives in `redacted_fields`. No code change is required here, but a thesis appendix note should record the bump 1.0.0 → 2.0.0.

- [ ] **Step 6: Run the spec to verify GREEN**

Run: `cd apps/api && pnpm test -- --testPathPatterns=redact-pii`
Expected: PASS, 5/5 (2 redactStructured tests + 3 batching tests).

- [ ] **Step 7: Type-check**

Run: `pnpm --filter @aurahire/api type-check`
Expected: silent success.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/ai/prompts/redact-batch.ts apps/api/src/ai/redact-pii.service.ts apps/api/src/ai/redact-pii.service.spec.ts
git commit -m "feat(api): batch PII redaction into one structured call (prompt v2.0.0)"
```

---

## Task 5: `MATCH_SCORE_QUEUE` constant + enqueue facade

**Files:**

- Modify: `apps/api/src/queue/queue.constants.ts`
- Create: `apps/api/src/queue/match-score-queue.service.ts`
- Modify: `apps/api/src/queue/queue.module.ts`

- [ ] **Step 1: Add the queue constant**

In `apps/api/src/queue/queue.constants.ts`, append:

```ts
/**
 * Queue for the per-application match-score job kicked off by
 * ApplicationsService.apply(). One job per application; the worker computes
 * redaction + match scoring + persistence + emits application.scored over
 * the existing realtime gateway when complete.
 */
export const MATCH_SCORE_QUEUE = "match-score";
```

- [ ] **Step 2: Write the failing test for the enqueue facade**

Create `apps/api/src/queue/match-score-queue.service.spec.ts`:

```ts
import { MatchScoreQueueService } from "./match-score-queue.service";

describe("MatchScoreQueueService.enqueue", () => {
  it("adds a job with id keyed by applicationId for idempotency", async () => {
    const add = jest.fn().mockResolvedValue({ id: "job-1" });
    const queue = { add } as never;
    const svc = new MatchScoreQueueService(queue);

    await svc.enqueue({
      applicationId: "00000000-0000-4000-8000-000000000001",
      candidateId: "00000000-0000-4000-8000-000000000002",
      jobId: "00000000-0000-4000-8000-000000000003",
      resumeId: "00000000-0000-4000-8000-000000000004",
    });

    expect(add).toHaveBeenCalledWith(
      "score",
      expect.objectContaining({
        applicationId: "00000000-0000-4000-8000-000000000001",
      }),
      expect.objectContaining({
        jobId: "score:00000000-0000-4000-8000-000000000001",
        attempts: 3,
      }),
    );
  });

  it("never throws when the queue rejects (best-effort enqueue)", async () => {
    const add = jest.fn().mockRejectedValue(new Error("redis down"));
    const queue = { add } as never;
    const svc = new MatchScoreQueueService(queue);

    await expect(
      svc.enqueue({
        applicationId: "00000000-0000-4000-8000-000000000001",
        candidateId: "00000000-0000-4000-8000-000000000002",
        jobId: "00000000-0000-4000-8000-000000000003",
        resumeId: "00000000-0000-4000-8000-000000000004",
      }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && pnpm test -- --testPathPatterns=match-score-queue`
Expected: FAIL - `MatchScoreQueueService` doesn't exist yet.

- [ ] **Step 4: Implement the facade**

Create `apps/api/src/queue/match-score-queue.service.ts`:

```ts
import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

import { MATCH_SCORE_QUEUE } from "./queue.constants";

export interface MatchScorePayload {
  applicationId: string;
  candidateId: string;
  jobId: string;
  resumeId: string;
}

@Injectable()
export class MatchScoreQueueService {
  private readonly logger = new Logger(MatchScoreQueueService.name);

  constructor(
    @InjectQueue(MATCH_SCORE_QUEUE)
    private readonly queue: Queue<MatchScorePayload>,
  ) {}

  /**
   * Enqueue match-scoring for an application. Idempotent on jobId so
   * retries from the controller don't double-compute. attempts: 3 with
   * exponential backoff covers transient OpenAI timeouts.
   */
  async enqueue(payload: MatchScorePayload): Promise<void> {
    try {
      const job = await this.queue.add("score", payload, {
        jobId: `score:${payload.applicationId}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 7 * 86_400 },
      });
      this.logger.log(
        `Enqueued match-score job ${job.id} for application=${payload.applicationId}`,
      );
    } catch (err) {
      // Never propagate to caller - apply already succeeded; the cron
      // backstop / manual rescore path will catch orphaned 'computing' rows.
      this.logger.warn(
        `Failed to enqueue match-score: ${(err as Error).message}`,
      );
    }
  }
}
```

- [ ] **Step 5: Register the queue and export the service**

In `apps/api/src/queue/queue.module.ts`, extend the existing module:

```ts
import { Global, Logger, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";

import {
  MATCH_PREVIEW_PRECOMPUTE_QUEUE,
  MATCH_SCORE_QUEUE,
  RESCORE_BATCH_QUEUE,
} from "./queue.constants";
import { MatchPreviewQueueService } from "./match-preview-queue.service";
import { MatchScoreQueueService } from "./match-score-queue.service";

const logger = new Logger("QueueModule");

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
        logger.log(`BullMQ root: connecting to Redis at ${url}`);
        return {
          connection: { url },
          defaultJobOptions: {
            attempts: 1,
            removeOnComplete: { age: 86400 },
            removeOnFail: { age: 7 * 86400 },
          },
        };
      },
    }),
    BullModule.registerQueue({ name: RESCORE_BATCH_QUEUE }),
    BullModule.registerQueue({ name: MATCH_PREVIEW_PRECOMPUTE_QUEUE }),
    BullModule.registerQueue({ name: MATCH_SCORE_QUEUE }),
  ],
  providers: [MatchPreviewQueueService, MatchScoreQueueService],
  exports: [BullModule, MatchPreviewQueueService, MatchScoreQueueService],
})
export class QueueModule {}
```

- [ ] **Step 6: Run tests + type-check**

Run: `cd apps/api && pnpm test -- --testPathPatterns=match-score-queue && pnpm type-check`
Expected: PASS 2/2 + silent type-check.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/queue/queue.constants.ts apps/api/src/queue/match-score-queue.service.ts apps/api/src/queue/match-score-queue.service.spec.ts apps/api/src/queue/queue.module.ts
git commit -m "feat(api): add match-score BullMQ queue + enqueue facade"
```

---

## Task 6: Add `emitApplicationScored` to `EventsService`

**Files:**

- Modify: `apps/api/src/realtime/events.service.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/realtime/events.service.spec.ts` (create if absent - pattern below works either way):

```ts
import { EventsService } from "./events.service";

describe("EventsService.emitApplicationScored", () => {
  it("broadcasts to candidate user room, recruiter room, and job room", () => {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const gateway = { server: { to } } as never;
    const svc = new EventsService(gateway);

    svc.emitApplicationScored({
      applicationId: "00000000-0000-4000-8000-000000000001",
      jobId: "00000000-0000-4000-8000-000000000002",
      recruiterId: "00000000-0000-4000-8000-000000000003",
      candidateId: "00000000-0000-4000-8000-000000000004",
      overallScore: 92,
      band: "strong",
      scoredAt: "2026-05-07T12:00:00.000Z",
    });

    return new Promise((resolve) =>
      setImmediate(() => {
        expect(to).toHaveBeenCalledWith([
          "user:00000000-0000-4000-8000-000000000004",
          "recruiter:00000000-0000-4000-8000-000000000003",
          "job:00000000-0000-4000-8000-000000000002",
        ]);
        expect(emit).toHaveBeenCalledWith(
          "application.scored",
          expect.objectContaining({ overallScore: 92 }),
        );
        resolve(undefined);
      }),
    );
  });
});
```

- [ ] **Step 2: Run to confirm RED**

Run: `cd apps/api && pnpm test -- --testPathPatterns=events.service`
Expected: FAIL - `emitApplicationScored` is not a method.

- [ ] **Step 3: Implement**

In `apps/api/src/realtime/events.service.ts`, add the import:

```ts
import {
  RealtimeEvent,
  type ApplicationCreatedPayload,
  type ApplicationScoredPayload,
  type ApplicationStatusChangedPayload,
  type AuditEntryPayload,
  type BiasFlagCreatedPayload,
  type InterviewScheduledPayload,
  type InterviewStatusChangedPayload,
  type OfferSentPayload,
} from "@aurahire/shared";
```

Add the method (after `emitApplicationStatusChanged`, before `emitInterviewScheduled`):

```ts
emitApplicationScored(payload: ApplicationScoredPayload): void {
  this.broadcast(
    RealtimeEvent.ApplicationScored,
    payload,
    [
      Rooms.user(payload.candidateId),
      Rooms.recruiter(payload.recruiterId),
      Rooms.job(payload.jobId),
    ],
  );
}
```

- [ ] **Step 4: Run to confirm GREEN**

Run: `cd apps/api && pnpm test -- --testPathPatterns=events.service`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `pnpm --filter @aurahire/api type-check`
Expected: silent success.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/realtime/events.service.ts apps/api/src/realtime/events.service.spec.ts
git commit -m "feat(api): emit application.scored event over realtime gateway"
```

---

## Task 7: `MatchScoreProcessor` - the BullMQ worker

**Files:**

- Create: `apps/api/src/modules/scoring/processors/match-score.processor.ts`
- Modify: `apps/api/src/modules/scoring/scoring.module.ts`

- [ ] **Step 1: Locate the scoring module**

Run: `cat apps/api/src/modules/scoring/scoring.module.ts`
Note its current `providers:` list - the new processor must be added.

- [ ] **Step 2: Create the processor**

Create `apps/api/src/modules/scoring/processors/match-score.processor.ts`:

```ts
import { Inject, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { applicationsTable, jobsTable } from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../../db/db.module";
import { EventsService } from "../../../realtime";
import { MATCH_SCORE_QUEUE } from "../../../queue/queue.constants";
import type { MatchScorePayload } from "../../../queue/match-score-queue.service";
import { ScoringService } from "../scoring.service";

/**
 * Runs the match-scoring AI pipeline asynchronously after an application
 * is created. On success: persists the score, sets applications.score_status
 * = 'completed', and emits application.scored over the realtime gateway.
 * On terminal failure (after attempts exhausted): sets score_status='failed'
 * - the UI shows a manual retry affordance.
 *
 * Concurrency 3 keeps OpenAI calls bounded; backoff is configured at the
 * enqueue site (3 attempts, exponential 5s base).
 */
@Processor(MATCH_SCORE_QUEUE, { concurrency: 3 })
export class MatchScoreProcessor extends WorkerHost {
  private readonly logger = new Logger(MatchScoreProcessor.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly scoring: ScoringService,
    private readonly events: EventsService,
  ) {
    super();
  }

  async process(job: Job<MatchScorePayload>): Promise<void> {
    const { applicationId, candidateId, jobId, resumeId } = job.data;
    const startedAt = Date.now();

    const [jobRow] = await this.db
      .select({
        title: jobsTable.title,
        department: jobsTable.department,
        experienceLevel: jobsTable.experienceLevel,
        educationRequirement: jobsTable.educationRequirement,
        requiredSkills: jobsTable.requiredSkills,
        descriptionPlain: jobsTable.descriptionPlain,
        companyId: jobsTable.companyId,
        recruiterId: jobsTable.recruiterId,
      })
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);

    if (!jobRow) {
      this.logger.warn(
        `[score-job ${job.id}] job ${jobId} no longer exists; marking failed`,
      );
      await this.markFailed(applicationId);
      return;
    }

    let dto;
    try {
      dto = await this.scoring.computeMatchScore(
        applicationId,
        candidateId,
        jobId,
        resumeId,
        {
          title: jobRow.title,
          department: jobRow.department,
          experienceLevel: jobRow.experienceLevel,
          educationRequirement: jobRow.educationRequirement,
          requiredSkills: jobRow.requiredSkills,
          descriptionPlain: jobRow.descriptionPlain,
          companyId: jobRow.companyId,
        },
      );
    } catch (err) {
      const attemptsMade = job.attemptsMade + 1;
      const attemptsTotal = job.opts.attempts ?? 1;
      this.logger.warn(
        `[score-job ${job.id}] attempt ${attemptsMade}/${attemptsTotal} failed: ${(err as Error).message}`,
      );
      if (attemptsMade >= attemptsTotal) {
        await this.markFailed(applicationId);
      }
      throw err;
    }

    await this.db
      .update(applicationsTable)
      .set({ scoreStatus: "completed", updatedAt: new Date() })
      .where(eq(applicationsTable.id, applicationId));

    this.events.emitApplicationScored({
      applicationId,
      jobId,
      recruiterId: jobRow.recruiterId,
      candidateId,
      overallScore: dto.overallScore,
      band: dto.band,
      scoredAt: new Date().toISOString(),
    });

    this.logger.log(
      `[score-job ${job.id}] ok in ${Date.now() - startedAt}ms - ${dto.overallScore}/100`,
    );
  }

  private async markFailed(applicationId: string): Promise<void> {
    await this.db
      .update(applicationsTable)
      .set({ scoreStatus: "failed", updatedAt: new Date() })
      .where(eq(applicationsTable.id, applicationId));
  }
}
```

- [ ] **Step 3: Register the processor in the scoring module**

In `apps/api/src/modules/scoring/scoring.module.ts`, add the import and provider entry:

```ts
import { MatchScoreProcessor } from "./processors/match-score.processor";

@Module({
  // …
  providers: [
    // existing providers
    MatchScoreProcessor,
  ],
})
export class ScoringModule {}
```

- [ ] **Step 4: Type-check**

Run: `pnpm --filter @aurahire/api type-check`
Expected: silent success. If `EventsService` isn't visible from the scoring module, ensure `RealtimeModule` is in scoring's `imports` list (or that EventsService is `@Global()` exported - check the existing realtime module).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/scoring/processors/match-score.processor.ts apps/api/src/modules/scoring/scoring.module.ts
git commit -m "feat(api): MatchScoreProcessor - async BullMQ worker for match scoring"
```

---

## Task 8: Refactor `applications.service.ts` to enqueue instead of compute

**Files:**

- Modify: `apps/api/src/modules/applications/applications.service.ts`
- Modify: `apps/api/src/modules/applications/applications.repository.ts`
- Modify: `apps/api/src/modules/applications/dto/application-response.dto.ts`

- [ ] **Step 1: Surface `scoreStatus` on `ApplicationDto`**

In `apps/api/src/modules/applications/dto/application-response.dto.ts`, find the `ApplicationDto` class. Add the field (mirror its existing decorator style - likely `@ApiProperty(...)` from `@nestjs/swagger`). Insert near `status`:

```ts
@ApiProperty({ enum: APPLICATION_SCORE_STATUS })
scoreStatus!: ApplicationScoreStatus;
```

Add the import:

```ts
import {
  APPLICATION_SCORE_STATUS,
  type ApplicationScoreStatus,
} from "@aurahire/shared";
```

- [ ] **Step 2: Update the repository to expose `scoreStatus`**

In `apps/api/src/modules/applications/applications.repository.ts`, locate `insert()`. Confirm it uses the `applicationsTable` schema and include the new column in the inserted shape (the Drizzle default of `'computing'` will fire if you omit it - recommended). For the `findById`/`findByCandidateId` selects, confirm `scoreStatus` is included by `.select()` (it is - Drizzle `.select()` with no projection grabs all columns).

Add a focused method:

```ts
async updateScoreStatus(
  id: string,
  scoreStatus: ApplicationScoreStatus,
): Promise<void> {
  await this.db
    .update(applicationsTable)
    .set({ scoreStatus, updatedAt: new Date() })
    .where(eq(applicationsTable.id, id));
}
```

(Imports: `ApplicationScoreStatus` from `@aurahire/shared`, `eq` from `drizzle-orm`, `applicationsTable` from `@aurahire/db`.)

- [ ] **Step 3: Write the failing service test**

Update `apps/api/src/modules/applications/applications.service.spec.ts` (or create if absent - follow the pattern from existing `*.service.spec.ts` files in the repo):

```ts
describe("ApplicationsService.apply (async scoring)", () => {
  it("returns 201 with scoreStatus='computing' and enqueues a match-score job", async () => {
    const enqueue = jest.fn().mockResolvedValue(undefined);
    const matchScoreQueue = { enqueue } as never;
    // build the rest of the deps via the existing pattern in this file …
    const svc = new ApplicationsService(/* deps including matchScoreQueue */);

    const dto = await svc.apply(/* user, dto, requestMeta */);

    expect(dto.scoreStatus).toBe("computing");
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: dto.id,
      }),
    );
  });

  it("does not call scoringService.computeMatchScore directly", async () => {
    const computeMatchScore = jest.fn();
    // build deps; assert computeMatchScore is never called from apply()
    expect(computeMatchScore).not.toHaveBeenCalled();
  });
});
```

(If the file already mocks ApplicationsService deps, follow the same builder. The two important assertions are: response carries `scoreStatus='computing'`, queue enqueue is called once, sync `computeMatchScore` is not called from `apply()`.)

- [ ] **Step 4: Run to confirm RED**

Run: `cd apps/api && pnpm test -- --testPathPatterns=applications.service`
Expected: FAIL - apply still calls `computeMatchScore` synchronously.

- [ ] **Step 5: Refactor `apply()`**

In `apps/api/src/modules/applications/applications.service.ts`:

1. Import the queue facade:

```ts
import { MatchScoreQueueService } from "../../queue/match-score-queue.service";
```

2. Add the dep to the constructor:

```ts
constructor(
  private readonly repo: ApplicationsRepository,
  private readonly jobsRepo: JobsRepository,
  private readonly profilesRepo: ProfilesRepository,
  private readonly resumesRepo: ResumesRepository,
  private readonly scoringService: ScoringService,
  private readonly storage: StorageService,
  private readonly email: EmailService,
  private readonly audit: AuditService,
  private readonly cacheService: CacheService,
  private readonly events: EventsService,
  private readonly matchScoreQueue: MatchScoreQueueService,
) {}
```

3. Replace the existing match-score block (lines 167-189) with:

```ts
await this.matchScoreQueue.enqueue({
  applicationId: application.id,
  candidateId: user.id,
  jobId: dto.jobId,
  resumeId,
});
```

4. The fire-and-forget `notifyRecruiterOfApplication(...)` call stays as-is - recruiter email shouldn't wait on scoring (they get a separate notification when the score is ready, via the realtime + notifications pipeline).

5. Update the final return - `toDto` already pulls all DB columns, so it will surface the new `scoreStatus='computing'` automatically. Strip the `{ matchScore: matchScoreDto }` argument because there is no synchronous match score now.

```ts
return this.toDto(application.id);
```

- [ ] **Step 6: Run to confirm GREEN**

Run: `cd apps/api && pnpm test -- --testPathPatterns=applications.service`
Expected: PASS.

- [ ] **Step 7: Type-check**

Run: `pnpm --filter @aurahire/api type-check`
Expected: silent success.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/applications apps/api/src/modules/applications.service.ts
git commit -m "feat(api): apply enqueues match-score job; returns 201 immediately"
```

---

## Task 9: Frontend - apply page redirects immediately

**Files:**

- Modify: `apps/web/app/(candidate)/candidate/jobs/[id]/apply/_apply-form-client.tsx`

- [ ] **Step 1: Strip the synchronous AiShimmer wait state**

In `_apply-form-client.tsx`, the `if (submitting) { … }` block (lines 120-144 currently) renders either a Loader2 spinner ("Submitting application…") or AiShimmer ("Computing your match…"). Since the apply request now returns in ~200ms, we no longer need the AiShimmer fallback here - the wait UI lives on the application detail page.

Replace the entire `if (submitting) { … }` block with a single Loader2 fallback:

```tsx
if (submitting) {
  return (
    <div
      role="status"
      aria-busy={true}
      className="flex items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-sm text-[var(--color-body)]"
    >
      <Loader2
        className="h-4 w-4 animate-spin text-[var(--color-primary)]"
        aria-hidden
      />
      <span>Submitting application…</span>
    </div>
  );
}
```

The redirect on success (`router.push(\`/candidate/applications/${body.data.id}\`)`) already exists at the bottom of the `submit()` function - no change needed there. Remove now-unused imports (`AiShimmer` is gone from this file).

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @aurahire/web type-check`
Expected: silent success.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(candidate\)/candidate/jobs/\[id\]/apply/_apply-form-client.tsx
git commit -m "feat(web): apply page redirects immediately; wait UI moves to detail page"
```

---

## Task 10: Frontend - application detail page shows shimmer + listens for `application.scored`

**Files:**

- Create: `apps/web/app/(candidate)/candidate/applications/[id]/_application-scored-client.tsx`
- Modify: `apps/web/app/(candidate)/candidate/applications/[id]/page.tsx`
- Modify: `apps/web/hooks/use-applications.ts`

- [ ] **Step 1: Surface `scoreStatus` on the frontend types**

In `apps/web/hooks/use-applications.ts`, find the application type/interface (it likely mirrors the backend `ApplicationDto`). Add `scoreStatus: "computing" | "completed" | "failed"`. If types come from a generated API client (`packages/shared/api-client/`), regenerate it via the project's standard flow (likely `pnpm generate:openapi` then `pnpm generate:api-client`). Confirm the generated file picks up the new field.

- [ ] **Step 2: Write the failing realtime-client test**

Create `apps/web/app/(candidate)/candidate/applications/[id]/_application-scored-client.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { ApplicationScoredClient } from "./_application-scored-client";

const refreshMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const handlers = new Map<string, (payload: unknown) => void>();
jest.mock("@/hooks/use-realtime-channel", () => ({
  useRealtimeChannel: (event: string, handler: (p: unknown) => void) => {
    handlers.set(event, handler);
  },
}));

describe("ApplicationScoredClient", () => {
  it("calls router.refresh() when the scored event is for this application", () => {
    render(<ApplicationScoredClient applicationId="A1" />);
    handlers.get("application.scored")?.({
      applicationId: "A1",
      jobId: "J1",
      recruiterId: "R1",
      candidateId: "C1",
      overallScore: 92,
      band: "strong",
      scoredAt: new Date().toISOString(),
    });
    expect(refreshMock).toHaveBeenCalled();
  });

  it("ignores events for a different application", () => {
    refreshMock.mockClear();
    render(<ApplicationScoredClient applicationId="A1" />);
    handlers.get("application.scored")?.({
      applicationId: "OTHER",
      jobId: "J1",
      recruiterId: "R1",
      candidateId: "C1",
      overallScore: 92,
      band: "strong",
      scoredAt: new Date().toISOString(),
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run to confirm RED**

Run: `pnpm --filter @aurahire/web test -- --testPathPatterns=application-scored-client`
Expected: FAIL - component not implemented.

- [ ] **Step 4: Implement the headless client**

Create `apps/web/app/(candidate)/candidate/applications/[id]/_application-scored-client.tsx`:

```tsx
"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { RealtimeEvent, type ApplicationScoredPayload } from "@aurahire/shared";

import { useRealtimeChannel } from "@/hooks/use-realtime-channel";

interface Props {
  applicationId: string;
}

export function ApplicationScoredClient({ applicationId }: Props) {
  const router = useRouter();
  const handler = useCallback(
    (payload: ApplicationScoredPayload) => {
      if (payload.applicationId !== applicationId) return;
      router.refresh();
    },
    [applicationId, router],
  );
  useRealtimeChannel(RealtimeEvent.ApplicationScored, handler);
  return null;
}
```

- [ ] **Step 5: Mount in the detail page + add the shimmer**

In `apps/web/app/(candidate)/candidate/applications/[id]/page.tsx`:

1. Import the client + AiShimmer:

```tsx
import { ApplicationScoredClient } from "./_application-scored-client";
import { AiShimmer } from "@/components/ai/ai-shimmer";
```

2. After fetching the application, branch on `scoreStatus`:

```tsx
{application.scoreStatus === "computing" && (
  <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8">
    <AiShimmer
      caption="Computing your match against this job - analyzing skills, experience, education, and cultural fit..."
      height={240}
    />
  </div>
)}

{application.scoreStatus === "failed" && (
  <div className="rounded-[var(--radius-lg)] border border-[var(--color-status-danger)] bg-[var(--color-canvas)] p-6 text-sm text-[var(--color-body)]">
    Match score couldn't be computed. <button onClick={/* manual retry */}>Try again</button>
  </div>
)}

{application.scoreStatus === "completed" && (
  /* existing score-ring + breakdown UI */
)}

<ApplicationScoredClient applicationId={application.id} />
```

(Wire the manual retry to the existing rescore endpoint if one exists; if not, defer to a follow-up - flag it in the commit message.)

- [ ] **Step 6: Run to confirm GREEN**

Run: `pnpm --filter @aurahire/web test -- --testPathPatterns=application-scored-client`
Expected: PASS, 2/2.

- [ ] **Step 7: Type-check**

Run: `pnpm --filter @aurahire/web type-check`
Expected: silent success.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/\(candidate\)/candidate/applications apps/web/hooks/use-applications.ts
git commit -m "feat(web): live match-score updates via application.scored event"
```

---

## Task 11: Smoke-test checklist (human runs)

After all prior tasks pass + type-check is silent + tests are green, the human must run a manual smoke test. Claude does not start servers or apply migrations; the steps below are for the human.

- [ ] **Step 1: Confirm services are up**

```bash
docker compose -f docker-compose.dev.yml ps
# Expect Mailpit + Redis healthy
```

```bash
pnpm dev
# Both apps/web and apps/api must boot cleanly, no port conflicts
```

- [ ] **Step 2: Confirm migrations are applied**

In Supabase Studio SQL editor (or via the MCP):

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='applications' AND column_name='score_status';
```

Expected: one row.

- [ ] **Step 3: End-to-end apply**

1. Sign in as a candidate, ensure the candidate has a parsed resume.
2. Navigate to a published job, click Apply.
3. Confirm the "Submitting application…" Loader2 disappears within ~1 second.
4. The browser should land on `/candidate/applications/[id]` showing the AiShimmer with caption "Computing your match against this job…".
5. Within ~13 seconds, the AiShimmer should disappear and the score ring + breakdown appears WITHOUT a page reload.
6. Open DevTools → Network → WS frames; confirm an `application.scored` payload was received.

- [ ] **Step 4: Recruiter live-update check**

1. In a second browser (or incognito), sign in as the recruiter who owns this job.
2. Open the job's pipeline page.
3. Have the candidate apply (Step 3).
4. The new application card should appear immediately (existing `application.created` event), and ~13s later the score on that card should fill in.

- [ ] **Step 5: Failure path check**

1. Temporarily set `OPENAI_API_KEY=invalid` in `apps/api/.env`, restart API.
2. Apply again. After ~3 retries (≈30s with exponential backoff), the application detail page should show the "Match score couldn't be computed" failure surface.
3. Restore the real key; restart.

- [ ] **Step 6: Cron sanity (regression check for the bug we fixed)**

1. Wait until top-of-the-hour or trigger via test endpoint.
2. Server logs should show `interview-reminder` and `offer-expiry-reminder` crons running without `42703 column does not exist` errors.

- [ ] **Step 7: Final commit / PR if all green**

If smoke tests all pass:

```bash
git status
# Should show only the documentation update for the smoke results, if any.
```

If not opening a PR, leave the branch as-is for review.

---

## Self-review

Before handing off to execution:

1. **Spec coverage:** Every recommendation from the synthesis (batched redaction, `scoreStatus`, queue, `application.scored`, frontend wiring, smoke test) → mapped to Tasks 1-11. ✓
2. **Placeholder scan:** No "TBD" / "implement later" / "similar to Task X" placeholders. Code blocks present in every code step. ✓
3. **Type consistency:** `APPLICATION_SCORE_STATUS` (Task 1) → consumed by Task 3 (DB column), Task 8 (DTO), Task 10 (frontend type). `ApplicationScoredPayload` (Task 2) → consumed by Tasks 6 (emit) and 10 (frontend listener). `MatchScorePayload` (Task 5) → consumed by Task 7 (processor) and Task 8 (enqueue call). All names match across tasks. ✓
4. **Migration discipline:** Task 3 is the only DDL step; explicitly scoped to one migration; verification queries included. ✓
5. **Order:** Shared enums → shared events → DB schema → batched prompt → queue → emitter → processor → service refactor → frontend. Each task is independently testable; later tasks compile against earlier tasks. ✓
