# Recruiter Portal — Shell + Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt an AutoSend-inspired all-white shell (sidebar dissolves into content, no topbar, no breadcrumb) and rebuild the recruiter Dashboard page as three dense sections — Active Jobs cards with inline metric strips, Pipeline Analytics with date filter, Recent Applications with leading status pills.

**Architecture:**

- Backend extends two existing endpoints (`GET /api/v1/applications/recruiter-stats` with `?range`, `GET /api/v1/jobs/mine` with `?include=stats`) and adds one new (`GET /api/v1/applications/recent`). Each delivers its data in one query — replaces the dashboard's current N+1 fan-out.
- Frontend replaces `PortalTopbar` + `PortalFooter` + breadcrumb with a self-contained `PortalSidebar` that carries brand wordmark + tenant chip + sectioned nav + sticky-bottom user chip dropdown (which absorbs the sign-out flow). Dashboard `page.tsx` is rewritten in three sections; a small client component handles the Pipeline Analytics date filter.

**Tech Stack:**

- **Backend:** NestJS 10 + Drizzle ORM (Postgres), `nestjs-zod` for DTOs, `@nestjs/swagger` for the OpenAPI spec.
- **Frontend:** Next.js 16 App Router (Server Components by default), Tailwind v4 with CSS-variable design tokens (`var(--color-*)`), Lucide React icons, the auto-generated React Query client in `packages/shared/src/api-client/generated.ts`, `@radix-ui` primitives (already wrapped in `apps/web/components/ui/`).
- **Verification:** No automated test harness exists in this repo (no `*.spec.ts`, no `test` script). Verification per task = `pnpm type-check` passes + `pnpm lint` passes + a manual smoke checklist the human runs at the end.

---

## Spec Reference

The authoritative spec is `docs/superpowers/specs/2026-05-04-recruiter-portal-shell-dashboard-redesign-design.md`. Read it before starting. This plan implements that spec exactly.

---

## File Structure

| Path                                                                     | Role                                                                                                         | Touch      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ---------- |
| `apps/api/src/modules/applications/applications.repository.ts`           | New repo methods for `recruiter-stats` w/ range + `recentForRecruiter`                                       | Modify     |
| `apps/api/src/modules/applications/applications.service.ts`              | Service-layer wrappers + new ranged stats type                                                               | Modify     |
| `apps/api/src/modules/applications/applications.controller.ts`           | New `GET /recent` route + `?range` on `/recruiter-stats`                                                     | Modify     |
| `apps/api/src/modules/applications/dto/recruiter-stats-query.dto.ts`     | New DTO for `?range` query param                                                                             | Create     |
| `apps/api/src/modules/applications/dto/recent-applications-query.dto.ts` | New DTO for `?limit` on `/recent`                                                                            | Create     |
| `apps/api/src/modules/jobs/jobs.repository.ts`                           | New `listMineWithStats` repo method                                                                          | Modify     |
| `apps/api/src/modules/jobs/jobs.service.ts`                              | `listMine` accepts `include` flag and dispatches                                                             | Modify     |
| `apps/api/src/modules/jobs/jobs.controller.ts`                           | Document `?include=stats` query param                                                                        | Modify     |
| `apps/api/src/modules/jobs/dto/list-jobs-query.dto.ts`                   | Re-export same Zod schema (schema gets new optional field)                                                   | Modify     |
| `packages/shared/src/schemas/jobs.ts`                                    | Add `include` optional field to `listJobsQuerySchema`                                                        | Modify     |
| `packages/shared/openapi.json`                                           | Regenerated after backend changes                                                                            | Regenerate |
| `packages/shared/src/api-client/generated.ts`                            | Regenerated React Query hooks                                                                                | Regenerate |
| `apps/web/app/(recruiter)/layout.tsx`                                    | Pull `company.name` from profile and pass to PortalShell                                                     | Modify     |
| `apps/web/components/layout/portal-shell.tsx`                            | Drop topbar + footer, accept `companyName`, flip bg to canvas                                                | Modify     |
| `apps/web/components/layout/portal-sidebar.tsx`                          | Major restructure: wordmark + tenant chip + sections + sticky bottom (Docs + user chip dropdown w/ sign-out) | Modify     |
| `apps/web/components/layout/portal-topbar.tsx`                           | **Delete**                                                                                                   | Delete     |
| `apps/web/components/layout/portal-footer.tsx`                           | **Delete**                                                                                                   | Delete     |
| `apps/web/components/layout/breadcrumb.tsx`                              | **Delete** (no longer imported anywhere)                                                                     | Delete     |
| `apps/web/app/(recruiter)/recruiter/page.tsx`                            | Full rewrite into 3-section dashboard                                                                        | Modify     |
| `apps/web/app/(recruiter)/recruiter/_dashboard-client.tsx`               | New client component: Pipeline Analytics card with date-range filter                                         | Create     |

---

## Task 1: Backend — Add `GET /api/v1/applications/recent`

Adds the recruiter's most recent applications across all owned jobs in a single query. Replaces the dashboard's current N+1 fan-out (5 sequential `by-job/[id]` calls + manual flatten/sort).

**Files:**

- Create: `apps/api/src/modules/applications/dto/recent-applications-query.dto.ts`
- Modify: `apps/api/src/modules/applications/applications.repository.ts` (add `listRecentForRecruiter`)
- Modify: `apps/api/src/modules/applications/applications.service.ts` (add `recentForRecruiter`)
- Modify: `apps/api/src/modules/applications/applications.controller.ts` (add `@Get("recent")` route)

### Steps

- [ ] **Step 1: Add Zod schema for the query DTO**

In `packages/shared/src/schemas/applications.ts`, append:

```ts
export const recentApplicationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional().default(6),
});

export type RecentApplicationsQuery = z.infer<
  typeof recentApplicationsQuerySchema
>;
```

Make sure `z` is imported (already is). Then export the schema from the package barrel `packages/shared/src/index.ts` — find the line that re-exports the other application schemas and add `recentApplicationsQuerySchema` and `RecentApplicationsQuery` to that block. (Pattern: `export * from "./schemas/applications"` likely already covers it; if not, add a named re-export.)

- [ ] **Step 2: Create the NestJS DTO class**

Create `apps/api/src/modules/applications/dto/recent-applications-query.dto.ts`:

```ts
import { createZodDto } from "nestjs-zod";
import { recentApplicationsQuerySchema } from "@aurahire/shared";

export class RecentApplicationsQueryDto extends createZodDto(
  recentApplicationsQuerySchema,
) {}
```

- [ ] **Step 3: Add the repository method**

In `apps/api/src/modules/applications/applications.repository.ts`, append a new method **after** the `recruiterApplicationsByStatus` method (so it sits with the other recruiter-scoped queries):

```ts
  async listRecentForRecruiter(
    recruiterId: string,
    limit: number,
  ): Promise<
    Array<
      Application & {
        matchScore: MatchScore | null;
        candidateFullName: string | null;
        candidateEmail: string | null;
        jobTitle: string | null;
      }
    >
  > {
    const rows = await this.db
      .select({
        application: applicationsTable,
        matchScore: matchScoresTable,
        candidateFullName: profilesTable.fullName,
        candidateEmail: profilesTable.email,
        jobTitle: jobsTable.title,
      })
      .from(applicationsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .leftJoin(profilesTable, eq(profilesTable.id, applicationsTable.candidateId))
      .leftJoin(matchScoresTable, eq(matchScoresTable.applicationId, applicationsTable.id))
      .where(eq(jobsTable.recruiterId, recruiterId))
      .orderBy(desc(applicationsTable.appliedAt))
      .limit(limit);
    return rows.map((r) => ({
      ...r.application,
      matchScore: r.matchScore,
      candidateFullName: r.candidateFullName,
      candidateEmail: r.candidateEmail,
      jobTitle: r.jobTitle,
    }));
  }
```

The `profilesTable` import already exists in `jobs.repository.ts` — but **not** in `applications.repository.ts` today. Add it to the existing `import` block from `@aurahire/db`:

```ts
import {
  applicationsTable,
  jobsTable,
  matchScoresTable,
  profilesTable, // ← add this line
  type Application,
  type NewApplication,
  type MatchScore,
} from "@aurahire/db";
```

- [ ] **Step 4: Add the service method**

In `apps/api/src/modules/applications/applications.service.ts`, find the `recruiterStats` method (~line 201) and add **after** it (before `recruiterAnalytics`):

```ts
  async recentForRecruiter(
    user: AuthUser,
    limit: number,
  ): Promise<ApplicationDto[]> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }

    const rows = await this.repo.listRecentForRecruiter(user.id, limit);
    return rows.map((row) => this.toDashboardDto(row));
  }
```

Now add the `toDashboardDto` private helper at the bottom of the class (above the closing brace):

```ts
  private toDashboardDto(row: {
    id: string;
    jobId: string;
    candidateId: string;
    resumeId: string;
    coverLetter: string | null;
    status: ApplicationStatus;
    recruiterNotes: string | null;
    appliedAt: Date;
    statusUpdatedAt: Date;
    matchScore: { id: string; overallScore: number; band: string } | null;
    candidateFullName: string | null;
    candidateEmail: string | null;
    jobTitle: string | null;
  }): ApplicationDto {
    return {
      id: row.id,
      jobId: row.jobId,
      candidateId: row.candidateId,
      resumeId: row.resumeId,
      coverLetter: row.coverLetter,
      status: row.status,
      recruiterNotes: row.recruiterNotes,
      appliedAt: row.appliedAt.toISOString(),
      statusUpdatedAt: row.statusUpdatedAt.toISOString(),
      matchScore: row.matchScore
        ? ({
            id: row.matchScore.id,
            overallScore: row.matchScore.overallScore,
            band: row.matchScore.band,
            // Dashboard rows do not need the full breakdown — only score + band.
            components: [],
            summary: "",
            redFlags: null,
            greenFlags: null,
            redactedFields: [],
            promptVersion: "",
            modelUsed: "",
            latencyMs: 0,
            createdAt: "",
          } as unknown as MatchScoreDto)
        : null,
      candidate:
        row.candidateFullName && row.candidateEmail
          ? {
              id: row.candidateId,
              fullName: row.candidateFullName,
              email: row.candidateEmail,
              phone: null,
              headline: null,
            }
          : null,
      job: row.jobTitle
        ? ({
            id: row.jobId,
            title: row.jobTitle,
            department: null,
            employmentType: "",
            workMode: "",
            company: { id: "", name: "" },
          } as ApplicationJobDto)
        : null,
    };
  }
```

This deliberately returns a _trimmed_ `ApplicationDto` — the dashboard only renders name, email, job title, score, status, and date. The full `MatchScoreDto` shape is preserved in the type signature (so the API client doesn't need parallel types) but irrelevant fields are zero-valued. This is the same trimming the existing `recruiterTopJobsByApplications` does.

The `ApplicationStatus` type already comes in via the existing `import type { ApplicationStatus }` line — verify; if not present add it to the import block.

- [ ] **Step 5: Add the controller route**

In `apps/api/src/modules/applications/applications.controller.ts`, **between** `recruiterAnalytics` and `listForJob` (the existing comment "CRITICAL: declare the literal ... routes BEFORE @Get(":id")" applies here too — `recent` is a literal):

```ts
  @Get("recent")
  @Roles("recruiter")
  @ApiOperation({
    summary: "Recent applications across all of this recruiter's jobs",
  })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, type: ApplicationListEnvelopeDto })
  async recent(
    @CurrentUser() user: AuthUser,
    @Query() query: RecentApplicationsQueryDto,
  ): Promise<ApplicationListEnvelopeDto> {
    const data = await this.service.recentForRecruiter(user, query.limit);
    return { data };
  }
```

Add the missing imports at the top of the file:

```ts
import { ApiQuery } from "@nestjs/swagger";
import { Query } from "@nestjs/common";
import { RecentApplicationsQueryDto } from "./dto/recent-applications-query.dto";
```

(`Query` may already be imported from `@nestjs/common` via another route — check; if so, just add it to the destructured import. `ApiQuery` likely needs adding to the existing `@nestjs/swagger` import line.)

- [ ] **Step 6: Verify build**

```bash
pnpm --filter @aurahire/shared build
pnpm --filter @aurahire/api type-check
pnpm --filter @aurahire/api lint
```

Expected: all three commands exit 0. If `@aurahire/shared` build is needed for the API to pick up the new schema, ensure it runs first.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/applications packages/shared/src/schemas/applications.ts packages/shared/src/index.ts
git commit -m "feat(api): GET /applications/recent returns recruiter's latest apps in one query

Replaces the dashboard's N+1 (5 sequential by-job calls + manual flatten/sort)
with a single joined query. Returns a trimmed ApplicationDto containing only
the fields the dashboard row renders: name, email, job title, score, status,
applied-at."
```

---

## Task 2: Backend — Extend `GET /api/v1/applications/recruiter-stats` with `?range` + 4 new metrics

Adds `?range=7d|30d|90d|all` (default `7d`) and four new metrics: `inInterview`, `offered`, `hired`, `biasFlags`. Existing fields (`activeJobs`, `totalApplications`, `pendingReviews`, `avgMatchScore`) keep their old names for one release as aliases so old callers don't break.

**Files:**

- Create: `apps/api/src/modules/applications/dto/recruiter-stats-query.dto.ts`
- Modify: `packages/shared/src/schemas/applications.ts` (add `recruiterStatsQuerySchema`)
- Modify: `apps/api/src/modules/applications/applications.repository.ts` (rewrite `recruiterStats`)
- Modify: `apps/api/src/modules/applications/applications.service.ts` (pass `range` through)
- Modify: `apps/api/src/modules/applications/applications.controller.ts` (accept `?range`)

### Steps

- [ ] **Step 1: Add the Zod schema**

In `packages/shared/src/schemas/applications.ts`, append:

```ts
export const recruiterStatsQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d", "all"]).optional().default("7d"),
});

export type RecruiterStatsQuery = z.infer<typeof recruiterStatsQuerySchema>;
export type RecruiterStatsRange = RecruiterStatsQuery["range"];
```

- [ ] **Step 2: Create the NestJS DTO**

Create `apps/api/src/modules/applications/dto/recruiter-stats-query.dto.ts`:

```ts
import { createZodDto } from "nestjs-zod";
import { recruiterStatsQuerySchema } from "@aurahire/shared";

export class RecruiterStatsQueryDto extends createZodDto(
  recruiterStatsQuerySchema,
) {}
```

- [ ] **Step 3: Rewrite the repository method**

In `apps/api/src/modules/applications/applications.repository.ts`, replace the existing `recruiterStats` method body with the ranged version:

```ts
  async recruiterStats(
    recruiterId: string,
    range: "7d" | "30d" | "90d" | "all",
  ): Promise<{
    activeJobs: number;
    totalApplications: number;       // alias for totalApps (deprecated, keep for one release)
    totalApps: number;
    pendingReviews: number;          // alias for pendingReview (deprecated, keep for one release)
    pendingReview: number;
    inInterview: number;
    offered: number;
    hired: number;
    avgMatchScore: number;
    biasFlags: number;
  }> {
    const rangeFilter = this.rangeFilter(range);

    const [activeJobsRow] = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.recruiterId, recruiterId),
          eq(jobsTable.status, "published"),
        ),
      );

    const [appsRow] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${applicationsTable.status} = 'applied')::int`,
        interview: sql<number>`count(*) filter (where ${applicationsTable.status} = 'interview')::int`,
        offered: sql<number>`count(*) filter (where ${applicationsTable.status} = 'offer')::int`,
        hired: sql<number>`count(*) filter (where ${applicationsTable.status} = 'hired')::int`,
      })
      .from(applicationsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .where(
        and(
          eq(jobsTable.recruiterId, recruiterId),
          ...(rangeFilter
            ? [sql`${applicationsTable.appliedAt} >= ${rangeFilter}`]
            : []),
        ),
      );

    const [avgRow] = await this.db
      .select({ avg: sql<number | null>`avg(${matchScoresTable.overallScore})::float` })
      .from(matchScoresTable)
      .innerJoin(jobsTable, eq(jobsTable.id, matchScoresTable.jobId))
      .where(eq(jobsTable.recruiterId, recruiterId));

    const biasFlags = await this.countUnresolvedBiasFlagsForRecruiter(recruiterId);

    const total = appsRow?.total ?? 0;
    const pending = appsRow?.pending ?? 0;

    return {
      activeJobs: activeJobsRow?.c ?? 0,
      totalApplications: total,
      totalApps: total,
      pendingReviews: pending,
      pendingReview: pending,
      inInterview: appsRow?.interview ?? 0,
      offered: appsRow?.offered ?? 0,
      hired: appsRow?.hired ?? 0,
      avgMatchScore: Math.round(avgRow?.avg ?? 0),
      biasFlags,
    };
  }

  private rangeFilter(range: "7d" | "30d" | "90d" | "all"): Date | null {
    if (range === "all") return null;
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  private async countUnresolvedBiasFlagsForRecruiter(
    recruiterId: string,
  ): Promise<number> {
    const [row] = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(biasFlagsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, biasFlagsTable.jobId))
      .where(
        and(
          eq(jobsTable.recruiterId, recruiterId),
          eq(biasFlagsTable.resolved, false),
        ),
      );
    return row?.c ?? 0;
  }
```

`biasFlagsTable` needs importing — add to the `@aurahire/db` import block at the top of the file:

```ts
import {
  applicationsTable,
  biasFlagsTable, // ← add this line
  jobsTable,
  matchScoresTable,
  profilesTable,
  type Application,
  type NewApplication,
  type MatchScore,
} from "@aurahire/db";
```

**Note on `biasFlagsTable.resolved`:** before committing, verify the column name in `packages/db/src/schema/bias.ts` (or wherever it's defined). If the schema uses a different field name (e.g., `resolvedAt IS NOT NULL`), adjust the predicate accordingly. If the table is named differently (e.g., `bias_detection`), adjust the import. **Do not invent column names** — read the schema file first and use what's there.

- [ ] **Step 4: Update the service**

In `apps/api/src/modules/applications/applications.service.ts`, replace the `recruiterStats` method:

```ts
  async recruiterStats(
    user: AuthUser,
    range: "7d" | "30d" | "90d" | "all" = "7d",
  ): Promise<{
    data: {
      activeJobs: number;
      totalApplications: number;
      totalApps: number;
      pendingReviews: number;
      pendingReview: number;
      inInterview: number;
      offered: number;
      hired: number;
      avgMatchScore: number;
      biasFlags: number;
    };
  }> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }
    const data = await this.repo.recruiterStats(user.id, range);
    return { data };
  }
```

Wait — the repo method already returns `{ ... }`, not `{ data: { ... } }`. Verify by reading the existing return of the repo's `recruiterStats` after Step 3 — it returns a flat object. The service wraps it. Compare with the existing `recruiterStats` method (~line 201): the existing service method returns `this.repo.recruiterStats(user.id)` directly without rewrapping, and the controller wraps in `{ data }`. **Match the existing pattern** — return the flat object from the service:

```ts
  async recruiterStats(
    user: AuthUser,
    range: "7d" | "30d" | "90d" | "all" = "7d",
  ): Promise<{
    activeJobs: number;
    totalApplications: number;
    totalApps: number;
    pendingReviews: number;
    pendingReview: number;
    inInterview: number;
    offered: number;
    hired: number;
    avgMatchScore: number;
    biasFlags: number;
  }> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }
    return this.repo.recruiterStats(user.id, range);
  }
```

The `recruiterAnalytics` method (~line 232) also calls `this.repo.recruiterStats(user.id)`. Update that call to pass a range — use `"all"` to preserve current behavior (analytics is lifetime, not windowed):

```ts
this.repo.recruiterStats(user.id, "all"),
```

- [ ] **Step 5: Update the controller**

In `apps/api/src/modules/applications/applications.controller.ts`, replace the `recruiterStats` route:

```ts
  @Get("recruiter-stats")
  @Roles("recruiter")
  @ApiOperation({
    summary: "Dashboard summary for the current recruiter (range-filterable)",
  })
  @ApiQuery({ name: "range", required: false, enum: ["7d", "30d", "90d", "all"] })
  async recruiterStats(
    @CurrentUser() user: AuthUser,
    @Query() query: RecruiterStatsQueryDto,
  ): Promise<{
    data: {
      activeJobs: number;
      totalApplications: number;
      totalApps: number;
      pendingReviews: number;
      pendingReview: number;
      inInterview: number;
      offered: number;
      hired: number;
      avgMatchScore: number;
      biasFlags: number;
    };
  }> {
    const data = await this.service.recruiterStats(user, query.range);
    return { data };
  }
```

Add the `RecruiterStatsQueryDto` import at the top:

```ts
import { RecruiterStatsQueryDto } from "./dto/recruiter-stats-query.dto";
```

- [ ] **Step 6: Verify build**

```bash
pnpm --filter @aurahire/shared build
pnpm --filter @aurahire/api type-check
pnpm --filter @aurahire/api lint
```

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/applications packages/shared/src/schemas/applications.ts
git commit -m "feat(api): recruiter-stats accepts ?range and returns 4 new metrics

Adds inInterview / offered / hired / biasFlags to the dashboard stats endpoint
plus a 7d/30d/90d/all date filter (default 7d). Old field names (totalApplications,
pendingReviews) are preserved as aliases for one release; new names use the
shorter forms (totalApps, pendingReview)."
```

---

## Task 3: Backend — Extend `GET /api/v1/jobs/mine` with `?include=stats`

Adds an opt-in per-job stats payload so the dashboard can render Active Jobs cards with one query instead of five.

**Files:**

- Modify: `packages/shared/src/schemas/jobs.ts` (add `include` field to `listJobsQuerySchema`)
- Modify: `apps/api/src/modules/jobs/jobs.repository.ts` (add `listMineWithStats`)
- Modify: `apps/api/src/modules/jobs/jobs.service.ts` (dispatch on `include`)
- Modify: `apps/api/src/modules/jobs/jobs.controller.ts` (document param)

### Steps

- [ ] **Step 1: Extend the Zod schema**

In `packages/shared/src/schemas/jobs.ts`, modify `listJobsQuerySchema`:

```ts
export const listJobsQuerySchema = paginationSchema.extend({
  q: z.string().max(200).optional(),
  mode: z.enum(WORK_MODE).optional(),
  experienceLevel: z.enum(EXPERIENCE_LEVEL).optional(),
  locationCountry: z.string().max(100).optional(),
  sort: z
    .enum(["recent", "best-match", "salary-high", "recent-activity"])
    .default("recent")
    .optional(),
  status: z.enum(JOB_STATUS).optional(),
  include: z.enum(["stats"]).optional(),
});
```

Note the new `"recent-activity"` sort option — used by the dashboard to order by most recent applied-at across each job's apps. Existing `recent`/`best-match`/`salary-high` are unchanged.

- [ ] **Step 2: Add the per-job stats type and repository method**

In `apps/api/src/modules/jobs/jobs.repository.ts`, append a new exported interface and method.

First, add the interface near the top with the other exports:

```ts
export interface JobStats {
  candidates: number;
  new: number;
  shortlisted: number;
  interviewed: number;
  offered: number;
  hired: number;
  avgScore: number;
}

export interface JobWithCompanyAndStats extends JobWithCompany {
  stats: JobStats;
}
```

Then add the method **after** the existing `list` method (which `listMine` already calls). The new method joins applications + match_scores per job, aggregates with `count(case when ...)` and `avg`, and orders by `MAX(applications.applied_at)` if requested:

```ts
  async listMineWithStats(
    recruiterId: string,
    options: {
      page: number;
      limit: number;
      status?: JobStatus;
      sort?: "recent" | "recent-activity";
    },
  ): Promise<{ rows: JobWithCompanyAndStats[]; total: number }> {
    const conditions: SQL[] = [eq(jobsTable.recruiterId, recruiterId)];
    if (options.status) {
      conditions.push(eq(jobsTable.status, options.status));
    }
    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(jobsTable)
      .where(where);

    const orderClause =
      options.sort === "recent-activity"
        ? sql`max(${applicationsTable.appliedAt}) desc nulls last`
        : desc(jobsTable.createdAt);

    const rows = await this.db
      .select({
        job: jobsTable,
        company: companiesTable,
        candidates: sql<number>`count(distinct ${applicationsTable.id})::int`,
        newCount: sql<number>`count(distinct ${applicationsTable.id}) filter (where ${applicationsTable.status} = 'applied')::int`,
        shortlisted: sql<number>`count(distinct ${applicationsTable.id}) filter (where ${applicationsTable.status} = 'shortlisted')::int`,
        interviewed: sql<number>`count(distinct ${applicationsTable.id}) filter (where ${applicationsTable.status} = 'interview')::int`,
        offered: sql<number>`count(distinct ${applicationsTable.id}) filter (where ${applicationsTable.status} = 'offer')::int`,
        hired: sql<number>`count(distinct ${applicationsTable.id}) filter (where ${applicationsTable.status} = 'hired')::int`,
        avgScore: sql<number | null>`avg(${matchScoresTable.overallScore})::float`,
      })
      .from(jobsTable)
      .innerJoin(companiesTable, eq(companiesTable.id, jobsTable.companyId))
      .leftJoin(applicationsTable, eq(applicationsTable.jobId, jobsTable.id))
      .leftJoin(matchScoresTable, eq(matchScoresTable.jobId, jobsTable.id))
      .where(where)
      .groupBy(jobsTable.id, companiesTable.id)
      .orderBy(orderClause)
      .limit(options.limit)
      .offset((options.page - 1) * options.limit);

    return {
      rows: rows
        .filter((r) => r.company !== null)
        .map((r) => ({
          ...r.job,
          company: r.company as Company,
          stats: {
            candidates: r.candidates,
            new: r.newCount,
            shortlisted: r.shortlisted,
            interviewed: r.interviewed,
            offered: r.offered,
            hired: r.hired,
            avgScore: Math.round(r.avgScore ?? 0),
          },
        })),
      total,
    };
  }
```

Add `applicationsTable` and `matchScoresTable` to the import block:

```ts
import {
  applicationsTable,
  biasFlagsTable,
  jobsTable,
  companiesTable,
  matchScoresTable,
  profilesTable,
  ...
} from "@aurahire/db";
```

(Some of these may already be imported — adjust to the existing block.)

**Note on the `'shortlisted'` status:** before running, verify the application status enum includes `'shortlisted'`. The state machine constants live in `packages/shared/src/enums.ts` under `APPLICATION_STATUS`. If the enum does **not** include `'shortlisted'`, then the spec's `SHORTLISTED` column needs reframing — drop the column and drop the `case when 'shortlisted'` filter. If shortlisting is tracked in a separate `shortlists` table (or via a flag, not a status), the query needs to join that source instead. **Read `packages/shared/src/enums.ts` first; do not assume.**

- [ ] **Step 3: Update the service to dispatch on `include`**

In `apps/api/src/modules/jobs/jobs.service.ts`, replace the `listMine` method:

```ts
  async listMine(user: AuthUser, query: ListJobsQueryDto): Promise<{
    data: JobResponseDto[] | (JobResponseDto & { stats: JobStats })[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Recruiter role required" });
    }

    if (query.include === "stats") {
      const sort: "recent" | "recent-activity" =
        query.sort === "recent-activity" ? "recent-activity" : "recent";
      const { rows, total } = await this.repo.listMineWithStats(user.id, {
        page: query.page,
        limit: query.limit,
        status: query.status,
        sort,
      });
      return {
        data: rows.map((r) => ({ ...this.toResponse(r), stats: r.stats })),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
      };
    }

    const filters: ListJobsFilters = {
      q: query.q,
      mode: query.mode,
      experienceLevel: query.experienceLevel,
      locationCountry: query.locationCountry,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
      recruiterId: user.id,
      status: query.status,
    };

    const { rows, total } = await this.repo.list(filters);
    return {
      data: rows.map((r) => this.toResponse(r)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }
```

Add the import for `JobStats`:

```ts
import {
  JobsRepository,
  type JobWithCompany,
  type ListJobsFilters,
  type JobStats,
} from "./jobs.repository";
```

- [ ] **Step 4: Document the new query param in the controller**

In `apps/api/src/modules/jobs/jobs.controller.ts`, modify the `listMine` route's decorators to document `?include`:

```ts
  @Get("mine")
  @ApiBearerAuth()
  @Roles("recruiter")
  @ApiOperation({
    summary: "List own jobs (any status); paginated. Supports ?include=stats for per-job aggregates.",
  })
  @ApiQuery({ name: "include", required: false, enum: ["stats"] })
  @ApiResponse({ status: 200, type: JobListResponseDto })
  async listMine(
    @CurrentUser() user: AuthUser,
    @Query() query: ListJobsQueryDto,
  ): Promise<JobListResponseDto> {
    return this.service.listMine(user, query);
  }
```

`@ApiQuery` is already imported at the top of this file — verify.

**Note on `JobListResponseDto`:** the response when `include=stats` carries `stats` on each item. The Swagger DTO doesn't need updating in this slice — the dashboard consumes the regenerated React Query hook with whatever shape the `@ApiResponse` declares, and will type the new fields via the regenerated client. Keeping the DTO declaration as-is (without `stats`) is acceptable for sprint scope; the regenerated TS types pick up the runtime shape via OpenAPI's `additionalProperties`. (If strict OpenAPI typing is required later, extend `JobResponseDto` with an optional `stats` block.)

- [ ] **Step 5: Verify build**

```bash
pnpm --filter @aurahire/shared build
pnpm --filter @aurahire/api type-check
pnpm --filter @aurahire/api lint
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/jobs packages/shared/src/schemas/jobs.ts
git commit -m "feat(api): jobs/mine ?include=stats returns per-job aggregates in one query

Replaces dashboard's 5x sequential by-job calls with a single grouped query
joining applications + match_scores. Each job includes stats: candidates,
new, shortlisted, interviewed, offered, hired, avgScore. Adds 'recent-activity'
sort option for ordering by most recent applied-at."
```

---

## Task 4: Regenerate OpenAPI spec and frontend client

After the three backend changes, regenerate the spec and the frontend client so the new shapes are typed end-to-end.

**Files:**

- Modify: `packages/shared/openapi.json` (regenerated)
- Modify: `packages/shared/src/api-client/generated.ts` (regenerated)

### Steps

- [ ] **Step 1: Regenerate the spec**

```bash
pnpm --filter @aurahire/api generate:openapi
```

This runs `apps/api/scripts/generate-openapi.ts` which boots Nest in spec-only mode and writes `packages/shared/openapi.json`. Expected: success message, file modified.

- [ ] **Step 2: Regenerate the frontend client**

The codegen step depends on the project — find the script in `package.json` (likely `pnpm --filter @aurahire/shared codegen` or similar). Run it:

```bash
pnpm --filter @aurahire/shared codegen
```

If the script name is different, look in `packages/shared/package.json` under `scripts` for a generation step. Common names: `codegen`, `generate-client`, `openapi-codegen`.

If no codegen script exists, the regenerated TypeScript file likely needs manual sync — but inspect the file's header to see whether it's auto-generated. The header on existing `generated.ts` will say so. If the header indicates a tool, run that tool.

Expected: `packages/shared/src/api-client/generated.ts` updated with new hooks:

- `useApplicationsControllerRecentV1` (or similar — the exact name follows the existing naming pattern)
- Updated signature for `useApplicationsControllerRecruiterStatsV1` (now accepts `range` query)
- Updated signature for `useJobsControllerListMineV1` (now accepts `include` query)

- [ ] **Step 3: Build shared and verify type-check passes**

```bash
pnpm --filter @aurahire/shared build
pnpm --filter @aurahire/web type-check
pnpm --filter @aurahire/api type-check
```

Expected: exit 0. If `apps/web` type-check fails because existing call sites (e.g., the current dashboard) reference fields whose types changed, **don't fix them yet** — they'll be rewritten in Task 8. Note the error and proceed.

If `apps/web/app/(recruiter)/recruiter/page.tsx`'s current code references `totalApplications` / `pendingReviews` (which now coexist as aliases), it should still compile. If it doesn't, the alias step in Task 2 broke — go back and fix.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/openapi.json packages/shared/src/api-client/generated.ts
git commit -m "chore(shared): regenerate openapi spec + client for recruiter dashboard endpoints"
```

---

## Task 5: Frontend — Pass `companyName` from profile down through `PortalShell`

`PortalShell` and `PortalSidebar` need `companyName` to render the tenant chip. The data already exists on the recruiter profile under `company.name` — it just isn't being threaded through.

**Files:**

- Modify: `apps/web/app/(recruiter)/layout.tsx`
- Modify: `apps/web/components/layout/portal-shell.tsx`

### Steps

- [ ] **Step 1: Update the recruiter layout to read `company.name`**

In `apps/web/app/(recruiter)/layout.tsx`, expand the `profile` type cast and pass `companyName`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { PortalShell } from "@/components/layout/portal-shell";

export default async function RecruiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = (await getCurrentProfile()) as {
    id: string;
    role: string;
    fullName: string;
    email: string;
    profileCompleted: boolean;
    company: { id: string; name: string } | null;
  } | null;

  if (!profile) redirect("/login");
  if (profile.role !== "recruiter" && profile.role !== "admin") {
    redirect("/login");
  }

  if (profile.role === "recruiter" && !profile.profileCompleted) {
    redirect("/onboarding/recruiter");
  }

  return (
    <PortalShell
      role="recruiter"
      fullName={profile.fullName}
      email={profile.email}
      companyName={profile.company?.name ?? null}
    >
      {children}
    </PortalShell>
  );
}
```

- [ ] **Step 2: Add `companyName` to `PortalShell` props**

In `apps/web/components/layout/portal-shell.tsx`, extend the props interface and pass through to the sidebar. (Drop `<PortalTopbar>` and `<PortalFooter>` is done in Task 7 — this task only adds the prop.)

For now, just thread the prop through:

```tsx
import type { UserRole } from "@aurahire/shared";
import { PortalSidebar } from "./portal-sidebar";
import { PortalTopbar } from "./portal-topbar";
import { PortalFooter } from "./portal-footer";

interface PortalShellProps {
  role: UserRole;
  fullName: string;
  email: string;
  companyName: string | null;
  children: React.ReactNode;
}

export function PortalShell({
  role,
  fullName,
  email,
  companyName,
  children,
}: PortalShellProps) {
  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)]">
      <PortalSidebar
        role={role}
        fullName={fullName}
        email={email}
        companyName={companyName}
      />
      <div className="flex min-h-screen flex-1 flex-col">
        <PortalTopbar fullName={fullName} email={email} role={role} />
        <main className="flex-1 bg-[var(--color-surface-soft)] px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
        <PortalFooter />
      </div>
    </div>
  );
}
```

The sidebar prop signature changes here (`fullName`, `email`, `companyName` added). The sidebar will accept-but-ignore them in this task; Task 6 makes them functional.

- [ ] **Step 3: Update `PortalSidebar` props signature (placeholder)**

In `apps/web/components/layout/portal-sidebar.tsx`, modify the existing `PortalSidebarProps` and `PortalSidebarContentProps`:

```tsx
interface PortalSidebarProps {
  role: UserRole;
  fullName: string;
  email: string;
  companyName: string | null;
}

interface PortalSidebarContentProps {
  role: UserRole;
  fullName?: string;
  email?: string;
  companyName?: string | null;
  onNavClick?: () => void;
}

export function PortalSidebar({
  role,
  fullName,
  email,
  companyName,
}: PortalSidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-[var(--color-hairline)] bg-[var(--color-surface-soft)] lg:flex lg:flex-col">
      <PortalSidebarContent
        role={role}
        fullName={fullName}
        email={email}
        companyName={companyName}
      />
    </aside>
  );
}
```

The mobile drawer in `PortalTopbar` calls `<PortalSidebarContent role={role} onNavClick={...} />` without these props — that's why they're optional. They'll become required when `PortalTopbar` is deleted in Task 7 and the mobile hamburger is relocated.

The `PortalSidebarContent` body still uses only `role` and `onNavClick` after this task — no rendering changes yet. That's intentional.

- [ ] **Step 4: Verify type-check**

```bash
pnpm --filter @aurahire/web type-check
```

Expected: exit 0. If the candidate or admin layouts also call `<PortalShell>`, they now need the `companyName` prop. Search and update:

```bash

```

Run a Grep for `<PortalShell` to find all callers, and add `companyName={null}` to candidate and admin layouts (they don't have a tenant — or do they? Per the spec, candidate gets "AuraHire" / "My Workspace" and admin gets "Admin Console" — but those mappings are slice-2 work; for now, passing `null` is fine and the sidebar will fall back to the AuraHire wordmark only).

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(recruiter)/layout.tsx apps/web/components/layout/portal-shell.tsx apps/web/components/layout/portal-sidebar.tsx apps/web/app/\(candidate\)/layout.tsx apps/web/app/\(admin\)/layout.tsx
git commit -m "refactor(web): thread companyName from profile to PortalShell

Extends PortalShell + PortalSidebar prop signatures to accept companyName.
No behavioral change yet — sidebar restructure in next commit will consume it."
```

(If candidate/admin layouts didn't need touching, drop them from the `git add`.)

---

## Task 6: Frontend — Restructure `PortalSidebar`

Major rewrite of the sidebar: brand wordmark + tenant chip + section labels + sectioned nav + sticky-bottom Docs link + user chip dropdown (which absorbs the sign-out flow currently in the topbar).

**Files:**

- Modify: `apps/web/components/layout/portal-sidebar.tsx` (full rewrite)

### Steps

- [ ] **Step 1: Rewrite the sidebar**

Replace the contents of `apps/web/components/layout/portal-sidebar.tsx` entirely:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Calendar,
  User,
  Settings,
  Users,
  Star,
  BarChart3,
  Building2,
  ShieldAlert,
  ScrollText,
  Sliders,
  BookOpen,
  ExternalLink,
  ChevronsUpDown,
  LogOut,
} from "lucide-react";
import type { ComponentType } from "react";
import { toast } from "sonner";
import type { UserRole } from "@aurahire/shared";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { setSessionOnlyMarker } from "@/lib/auth/cookie-persistence.client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: Record<UserRole, NavSection[]> = {
  candidate: [
    {
      label: "Main",
      items: [
        { href: "/candidate", label: "Dashboard", icon: LayoutDashboard },
        { href: "/candidate/jobs", label: "Browse Jobs", icon: Briefcase },
      ],
    },
    {
      label: "Pipeline",
      items: [
        {
          href: "/candidate/applications",
          label: "Applications",
          icon: FileText,
        },
        { href: "/candidate/interviews", label: "Interviews", icon: Calendar },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/candidate/profile", label: "Profile", icon: User },
        { href: "/candidate/resume", label: "Resume", icon: FileText },
        { href: "/candidate/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  recruiter: [
    {
      label: "Main",
      items: [
        { href: "/recruiter", label: "Dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: "Pipeline",
      items: [
        { href: "/recruiter/jobs", label: "Jobs", icon: Briefcase },
        { href: "/recruiter/shortlist", label: "Shortlist", icon: Star },
        { href: "/recruiter/interviews", label: "Interviews", icon: Calendar },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/recruiter/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/recruiter/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  admin: [
    {
      label: "Main",
      items: [
        { href: "/admin", label: "Command Center", icon: LayoutDashboard },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/jobs", label: "Job Moderation", icon: Building2 },
        { href: "/admin/applications", label: "Applications", icon: FileText },
      ],
    },
    {
      label: "Insights",
      items: [
        { href: "/admin/ai-config", label: "AI Config", icon: Sliders },
        { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
        { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
        {
          href: "/admin/bias-monitor",
          label: "Bias Monitor",
          icon: ShieldAlert,
        },
      ],
    },
  ],
};

interface PortalSidebarProps {
  role: UserRole;
  fullName: string;
  email: string;
  companyName: string | null;
}

export function PortalSidebar({
  role,
  fullName,
  email,
  companyName,
}: PortalSidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 bg-[var(--color-canvas)] lg:flex lg:flex-col">
      <PortalSidebarContent
        role={role}
        fullName={fullName}
        email={email}
        companyName={companyName}
      />
    </aside>
  );
}

interface PortalSidebarContentProps {
  role: UserRole;
  fullName: string;
  email: string;
  companyName: string | null;
  onNavClick?: () => void;
}

export function PortalSidebarContent({
  role,
  fullName,
  email,
  companyName,
  onNavClick,
}: PortalSidebarContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const sections = NAV_SECTIONS[role];
  const initials = getInitials(fullName);
  const tenantInitials = companyName ? getInitials(companyName) : "AH";

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Sign out failed", { description: error.message });
      return;
    }
    setSessionOnlyMarker(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top: brand wordmark + tenant chip */}
      <div className="px-6 pt-6 pb-4">
        <Link
          href="/"
          onClick={onNavClick}
          className="text-base font-semibold tracking-tight text-[var(--color-ink)]"
        >
          AuraHire
        </Link>
        <button
          type="button"
          className="mt-4 flex w-full items-center gap-2 text-left"
          aria-label="Workspace"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-[var(--color-surface-strong)] text-xs font-semibold text-[var(--color-ink)]">
              {tenantInitials}
            </AvatarFallback>
          </Avatar>
          <span className="flex-1 truncate text-sm font-medium text-[var(--color-ink)]">
            {companyName ?? "Workspace"}
          </span>
          <ChevronsUpDown
            className="h-4 w-4 text-[var(--color-muted)]"
            aria-hidden
          />
        </button>
      </div>

      {/* Sections */}
      <nav className="flex-1 space-y-6 px-3">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              {section.label}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavClick}
                    className={[
                      "flex h-9 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm transition",
                      isActive
                        ? "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]"
                        : "text-[var(--color-body)] hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]",
                    ].join(" ")}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom block: Docs + user chip */}
      <div className="border-t border-[var(--color-hairline-soft)] p-3">
        <Link
          href="/help"
          onClick={onNavClick}
          className="flex h-9 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm text-[var(--color-body)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]"
        >
          <BookOpen className="h-[18px] w-[18px]" />
          <span className="flex-1">Docs</span>
          <ExternalLink
            className="h-3.5 w-3.5 text-[var(--color-muted)]"
            aria-hidden
          />
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="mt-1 flex h-12 w-full items-center gap-2 rounded-[var(--radius-md)] px-3 text-left transition hover:bg-[var(--color-surface-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              />
            }
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-[var(--color-surface-strong)] text-xs font-semibold text-[var(--color-ink)]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate text-sm font-medium text-[var(--color-ink)]">
              {fullName}
            </span>
            <ChevronsUpDown
              className="h-4 w-4 text-[var(--color-muted)]"
              aria-hidden
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="font-semibold text-[var(--color-ink)]">
                  {fullName}
                </div>
                <div className="text-xs font-normal text-[var(--color-muted)]">
                  {email}
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
```

Key things in this rewrite:

- The `border-r` on the `<aside>` is gone (sidebar dissolves into content).
- Background flips from `--color-surface-soft` to `--color-canvas`.
- `NAV_ITEMS` becomes `NAV_SECTIONS` with `Main` / `Pipeline` / `Account` groupings (Operations / Insights for admin).
- The brand wordmark + tenant chip live in a 24px-padded top block.
- Section labels use `text-[11px]` uppercase tracking-wider muted (matching the spec's `caption-strong` rule of 12px / 600 / 0.04em — close enough; Tailwind's `text-[11px]` + `tracking-wider` + `font-semibold` lands there).
- Active nav state preserves the existing `--color-primary-soft` + `--color-primary` color treatment per DESIGN.md.
- The bottom block has a top border (`border-t border-hairline-soft`) and contains Docs + user chip; the user chip's `DropdownMenu` opens upward (`side="top"` and `align="start"`).
- Sign-out logic moved here from `PortalTopbar`.

- [ ] **Step 2: Verify type-check**

```bash
pnpm --filter @aurahire/web type-check
pnpm --filter @aurahire/web lint
```

Expected: exit 0. The mobile drawer (called from `PortalTopbar`) still passes only `role` to `<PortalSidebarContent>` — type-check will fail because the new prop signature requires `fullName` / `email` / `companyName`. **That's expected** — the next task deletes the topbar entirely. **For this commit only, leave the breakage.** It's an intermediate state that gets fixed in Task 7.

If type-check breaking commits are not acceptable in this repo (some teams enforce it), an alternative is to make the props optional with defaults inside the function body. That works but is a temporary scaffold. Recommended: leave the breakage and complete Task 7 before pushing.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/portal-sidebar.tsx
git commit -m "refactor(web): restructure PortalSidebar with sectioned nav + tenant chip + bottom user dropdown

Brand wordmark + tenant chip at top, MAIN/PIPELINE/ACCOUNT sections, sticky-bottom
Docs link + user chip dropdown that absorbs the sign-out flow. Drops the sidebar's
right-edge border so the sidebar dissolves into the content area.

Note: this commit leaves PortalTopbar's call to PortalSidebarContent in a
type-broken state. Task 7 deletes the topbar and completes the migration."
```

---

## Task 7: Frontend — Drop topbar/footer/breadcrumb, add mobile hamburger

Deletes `PortalTopbar`, `PortalFooter`, `breadcrumb.tsx`. Adds a mobile hamburger button to `<main>` so the drawer is still reachable on `< lg` viewports.

**Files:**

- Modify: `apps/web/components/layout/portal-shell.tsx`
- Delete: `apps/web/components/layout/portal-topbar.tsx`
- Delete: `apps/web/components/layout/portal-footer.tsx`
- Delete: `apps/web/components/layout/breadcrumb.tsx`

### Steps

- [ ] **Step 1: Rewrite `PortalShell` without topbar/footer**

Replace `apps/web/components/layout/portal-shell.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import type { UserRole } from "@aurahire/shared";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PortalSidebar, PortalSidebarContent } from "./portal-sidebar";

interface PortalShellProps {
  role: UserRole;
  fullName: string;
  email: string;
  companyName: string | null;
  children: React.ReactNode;
}

export function PortalShell({
  role,
  fullName,
  email,
  companyName,
  children,
}: PortalShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)]">
      <PortalSidebar
        role={role}
        fullName={fullName}
        email={email}
        companyName={companyName}
      />
      <main className="relative flex-1 px-4 py-6 md:px-8 md:py-8">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger
            className="absolute left-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-ink)] hover:bg-[var(--color-surface-strong)] lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-72 bg-[var(--color-canvas)] p-0"
          >
            <PortalSidebarContent
              role={role}
              fullName={fullName}
              email={email}
              companyName={companyName}
              onNavClick={() => setDrawerOpen(false)}
            />
          </SheetContent>
        </Sheet>
        {children}
      </main>
    </div>
  );
}
```

The shell is now just sidebar + main. The mobile hamburger is an absolute-positioned 44×44 button top-left of `<main>`, hidden on `lg` (where the sidebar is always visible). Page content adds its own top spacing so the hamburger doesn't overlap H1 — pages get 32px top padding via `py-8` on `<main>` plus their own header structure.

The `bg-[var(--color-surface-soft)]` on `<main>` is removed — it's now `bg-[var(--color-canvas)]` from the parent. AutoSend's all-white shell.

- [ ] **Step 2: Delete the dead files**

```bash
git rm apps/web/components/layout/portal-topbar.tsx
git rm apps/web/components/layout/portal-footer.tsx
git rm apps/web/components/layout/breadcrumb.tsx
```

- [ ] **Step 3: Find and remove any lingering imports**

```bash

```

Run a Grep across `apps/web/` for `PortalTopbar`, `PortalFooter`, and `Breadcrumb` to find any remaining import sites. The candidate and admin layouts should already be using `<PortalShell>` (which no longer references these), so they should not have direct imports — but verify. If anything still imports `breadcrumb.tsx`, remove that usage.

- [ ] **Step 4: Verify**

```bash
pnpm --filter @aurahire/web type-check
pnpm --filter @aurahire/web lint
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/layout/portal-shell.tsx
git commit -m "refactor(web): drop topbar/footer/breadcrumb from portal shell

Sidebar now carries brand + nav + user identity end-to-end. Mobile hamburger
relocates to a 44x44 button top-left of <main> (lg:hidden). Content area
becomes all-white (was surface-soft).

The deleted topbar's sign-out flow already lives on the sidebar's bottom
user-chip dropdown after the previous commit."
```

---

## Task 8: Frontend — Rewrite the recruiter Dashboard with three sections

Replace the four-tile + recent-list dashboard with: Active Jobs cards (using `?include=stats`), Pipeline Analytics card with date filter (using `?range`), Recent Applications rows (using `/applications/recent`).

**Files:**

- Modify: `apps/web/app/(recruiter)/recruiter/page.tsx` (full rewrite)
- Create: `apps/web/app/(recruiter)/recruiter/_dashboard-client.tsx`

### Steps

- [ ] **Step 1: Create the date-filter client component**

Create `apps/web/app/(recruiter)/recruiter/_dashboard-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ChevronDown, BarChart3, Info } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Range = "7d" | "30d" | "90d" | "all";

const RANGE_LABEL: Record<Range, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

export interface PipelineAnalyticsData {
  activeJobs: number;
  totalApps: number;
  pendingReview: number;
  inInterview: number;
  offered: number;
  hired: number;
  avgMatchScore: number;
  biasFlags: number;
}

interface PipelineAnalyticsCardProps {
  initialRange: Range;
  initialData: PipelineAnalyticsData;
  fetchForRange: (range: Range) => Promise<PipelineAnalyticsData>;
}

export function PipelineAnalyticsCard({
  initialRange,
  initialData,
  fetchForRange,
}: PipelineAnalyticsCardProps) {
  const [range, setRange] = useState<Range>(initialRange);
  const [data, setData] = useState<PipelineAnalyticsData>(initialData);
  const [loading, setLoading] = useState(false);

  async function changeRange(next: Range) {
    setRange(next);
    setLoading(true);
    try {
      const fresh = await fetchForRange(next);
      setData(fresh);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <BarChart3
          className="h-3.5 w-3.5 text-[var(--color-muted)]"
          aria-hidden
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Pipeline Analytics
        </span>
      </div>
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <p className="text-sm text-[var(--color-muted)]">
            Where every candidate sits in your pipeline right now.
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 text-sm font-medium text-[var(--color-ink)] disabled:opacity-60"
                  disabled={loading}
                />
              }
            >
              <span>{RANGE_LABEL[range]}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
                <DropdownMenuItem key={r} onClick={() => changeRange(r)}>
                  {RANGE_LABEL[r]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-4">
          <MetricCell
            label="Active Jobs"
            value={data.activeJobs}
            dot="muted"
            tip="Jobs currently published and accepting applications."
          />
          <MetricCell
            label="Total Apps"
            value={data.totalApps}
            dot="muted"
            tip="Applications received in the selected range, across all your jobs."
          />
          <MetricCell
            label="Pending Review"
            value={data.pendingReview}
            dot={data.pendingReview > 0 ? "amber" : "muted"}
            tip="Applications still in 'applied' status — not yet screened."
          />
          <MetricCell
            label="In Interview"
            value={data.inInterview}
            dot="info"
            tip="Candidates scheduled for or completed interviews."
          />
        </div>

        <div className="my-4 border-t border-[var(--color-hairline-soft)]" />

        <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-4">
          <MetricCell
            label="Offered"
            value={data.offered}
            dot="muted"
            tip="Candidates with an active offer extended."
          />
          <MetricCell
            label="Hired"
            value={data.hired}
            dot="success"
            tip="Candidates whose application reached 'hired' status."
          />
          <MetricCell
            label="Avg Match Score"
            value={data.avgMatchScore}
            dot={scoreBand(data.avgMatchScore)}
            tip="Mean of overall match scores across all your applications, 0–100."
          />
          <MetricCell
            label="Bias Flags"
            value={data.biasFlags}
            dot={data.biasFlags > 0 ? "amber" : "muted"}
            tip="Job descriptions flagged by the bias detector that you have not resolved."
          />
        </div>

        <div className="-mx-6 mt-6 border-t border-[var(--color-hairline-soft)]" />
        <div className="mt-4 text-center">
          <a
            href="/recruiter/applications"
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            View applications →
          </a>
        </div>
      </div>
    </section>
  );
}

type DotKind = "muted" | "amber" | "info" | "success" | "low" | "mid" | "high";

function scoreBand(score: number): "low" | "mid" | "high" {
  if (score < 40) return "low";
  if (score < 70) return "mid";
  return "high";
}

const DOT_CLASS: Record<DotKind, string> = {
  muted: "bg-[var(--color-muted)]",
  amber: "bg-[var(--color-status-warning)]",
  info: "bg-[var(--color-status-info)]",
  success: "bg-[var(--color-status-success)]",
  low: "bg-[var(--color-score-low)]",
  mid: "bg-[var(--color-score-mid)]",
  high: "bg-[var(--color-score-high)]",
};

function MetricCell({
  label,
  value,
  dot,
  tip,
}: {
  label: string;
  value: number;
  dot: DotKind;
  tip: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${DOT_CLASS[dot]}`}
          aria-hidden
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </span>
        <span title={tip} className="cursor-help">
          <Info className="h-3 w-3 text-[var(--color-muted)]" aria-hidden />
        </span>
      </div>
      <div className="mt-1 font-mono text-lg font-medium text-[var(--color-ink)]">
        {value}
      </div>
    </div>
  );
}
```

Notes on this component:

- Uses native `title` attribute for tooltip (keyboard-accessible via focus). If the project has a `<Tooltip>` component, swap it in — but `title` is acceptable for sprint scope.
- The `fetchForRange` callback is provided by the server parent — keeps the API call in the parent's scope, avoids re-implementing token handling here.
- `MetricCell` is internal — reused twice for the two-row grid.

- [ ] **Step 2: Rewrite `page.tsx`**

Replace `apps/web/app/(recruiter)/recruiter/page.tsx` entirely:

```tsx
import { redirect } from "next/navigation";
import { Briefcase, Inbox, MoreHorizontal } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import {
  PipelineAnalyticsCard,
  type PipelineAnalyticsData,
} from "./_dashboard-client";

export const metadata = { title: "Recruiter Dashboard" };

interface JobWithStats {
  id: string;
  title: string;
  status: "draft" | "published" | "closed" | "archived";
  workMode: string;
  employmentType: string;
  locationCountry: string | null;
  salaryMin: string | null;
  salaryMax: string | null;
  salaryCurrency: string | null;
  publishedAt: string | null;
  stats: {
    candidates: number;
    new: number;
    shortlisted: number;
    interviewed: number;
    offered: number;
    hired: number;
    avgScore: number;
  };
}

interface RecentApp {
  id: string;
  status: string;
  appliedAt: string;
  candidate: { fullName: string; email: string } | null;
  job: { id: string; title: string } | null;
  matchScore: { band: string; overallScore: number } | null;
}

const APP_STATUS: Record<string, { label: string; dot: string; text: string }> =
  {
    applied: {
      label: "Applied",
      dot: "bg-[var(--color-status-info)]",
      text: "text-[var(--color-status-info)]",
    },
    screening: {
      label: "Screening",
      dot: "bg-[var(--color-status-info)]",
      text: "text-[var(--color-status-info)]",
    },
    interview: {
      label: "Interview",
      dot: "bg-[var(--color-status-info)]",
      text: "text-[var(--color-status-info)]",
    },
    offer: {
      label: "Offer",
      dot: "bg-[var(--color-status-success)]",
      text: "text-[var(--color-status-success)]",
    },
    hired: {
      label: "Hired",
      dot: "bg-[var(--color-status-success)]",
      text: "text-[var(--color-status-success)]",
    },
    rejected: {
      label: "Rejected",
      dot: "bg-[var(--color-status-danger)]",
      text: "text-[var(--color-status-danger)]",
    },
    withdrawn: {
      label: "Withdrawn",
      dot: "bg-[var(--color-muted)]",
      text: "text-[var(--color-muted)]",
    },
  };

const JOB_STATUS: Record<string, { label: string; dot: string; text: string }> =
  {
    published: {
      label: "Published",
      dot: "bg-[var(--color-status-success)]",
      text: "text-[var(--color-status-success)]",
    },
    draft: {
      label: "Draft",
      dot: "bg-[var(--color-muted)]",
      text: "text-[var(--color-muted)]",
    },
    closed: {
      label: "Closed",
      dot: "bg-[var(--color-status-danger)]",
      text: "text-[var(--color-status-danger)]",
    },
    archived: {
      label: "Archived",
      dot: "bg-[var(--color-muted)]",
      text: "text-[var(--color-muted)]",
    },
  };

function scoreBandColor(score: number): string {
  if (score === 0) return "text-[var(--color-muted)]";
  if (score < 40) return "text-[var(--color-score-low)]";
  if (score < 70) return "text-[var(--color-score-mid)]";
  return "text-[var(--color-score-high)]";
}

export default async function RecruiterDashboard() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const headers = { Authorization: `Bearer ${session.access_token}` };
  const accessToken = session.access_token;

  const [jobsRes, statsRes, recentRes] = await Promise.all([
    fetch(
      `${apiUrl}/api/v1/jobs/mine?include=stats&sort=recent-activity&limit=5`,
      { headers, cache: "no-store" },
    ),
    fetch(`${apiUrl}/api/v1/applications/recruiter-stats?range=7d`, {
      headers,
      cache: "no-store",
    }),
    fetch(`${apiUrl}/api/v1/applications/recent?limit=6`, {
      headers,
      cache: "no-store",
    }),
  ]);

  const jobs: JobWithStats[] = jobsRes.ok
    ? ((await jobsRes.json()) as { data: JobWithStats[] }).data
    : [];

  const initialStats: PipelineAnalyticsData = statsRes.ok
    ? (await statsRes.json()).data
    : {
        activeJobs: 0,
        totalApps: 0,
        pendingReview: 0,
        inInterview: 0,
        offered: 0,
        hired: 0,
        avgMatchScore: 0,
        biasFlags: 0,
      };

  const recent: RecentApp[] = recentRes.ok
    ? ((await recentRes.json()) as { data: RecentApp[] }).data
    : [];

  async function fetchStats(
    range: "7d" | "30d" | "90d" | "all",
  ): Promise<PipelineAnalyticsData> {
    "use server";
    const res = await fetch(
      `${apiUrl}/api/v1/applications/recruiter-stats?range=${range}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    if (!res.ok) throw new Error("Failed to fetch stats");
    const body = (await res.json()) as { data: PipelineAnalyticsData };
    return body.data;
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <header>
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          Recruiter Dashboard
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          Pipeline at a glance.
        </p>
      </header>

      {/* Section 1: Active Jobs */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase
              className="h-3.5 w-3.5 text-[var(--color-muted)]"
              aria-hidden
            />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Active Jobs
            </span>
          </div>
          <a
            href="/recruiter/jobs"
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            View all jobs →
          </a>
        </div>
        {jobs.length === 0 ? (
          <EmptyJobsState />
        ) : (
          <ul className="space-y-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </ul>
        )}
      </section>

      {/* Section 2: Pipeline Analytics */}
      <PipelineAnalyticsCard
        initialRange="7d"
        initialData={initialStats}
        fetchForRange={fetchStats}
      />

      {/* Section 3: Recent Applications */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox
              className="h-3.5 w-3.5 text-[var(--color-muted)]"
              aria-hidden
            />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Recent Applications
            </span>
          </div>
          <a
            href="/recruiter/applications"
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            View all →
          </a>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
          {recent.length === 0 ? (
            <EmptyAppsState />
          ) : (
            <ul className="divide-y divide-[var(--color-hairline-soft)]">
              {recent.map((app) => (
                <RecentAppRow key={app.id} app={app} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function JobCard({ job }: { job: JobWithStats }) {
  const status = JOB_STATUS[job.status] ?? JOB_STATUS.draft;
  const subtitle = [
    job.workMode,
    job.employmentType,
    job.locationCountry,
    job.salaryMin && job.salaryMax
      ? `${formatSalary(job.salaryMin)}–${formatSalary(job.salaryMax)} ${job.salaryCurrency ?? "USD"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <a
        href={`/recruiter/jobs/${job.id}`}
        className="block rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 transition hover:border-[var(--color-primary-soft)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${status.text}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                aria-hidden
              />
              {status.label}
            </span>
            {job.publishedAt && (
              <span className="text-xs text-[var(--color-muted)]">
                · Posted{" "}
                {new Date(job.publishedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label="More actions"
            className="rounded-[var(--radius-md)] p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface-strong)]"
            onClick={(e) => e.preventDefault()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 text-base font-semibold text-[var(--color-ink)]">
          {job.title}
        </div>
        <div className="mt-1 text-sm text-[var(--color-body)]">{subtitle}</div>
        <div className="mt-4 grid grid-cols-7 gap-2 border-t border-[var(--color-hairline-soft)] pt-4">
          <Metric label="Candidates" value={job.stats.candidates} />
          <Metric label="New" value={job.stats.new} />
          <Metric label="Shortlisted" value={job.stats.shortlisted} />
          <Metric label="Interviewed" value={job.stats.interviewed} />
          <Metric label="Offered" value={job.stats.offered} />
          <Metric label="Hired" value={job.stats.hired} />
          <Metric
            label="Avg Score"
            value={job.stats.avgScore}
            valueClass={scoreBandColor(job.stats.avgScore)}
          />
        </div>
      </a>
    </li>
  );
}

function Metric({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-base font-medium ${valueClass ?? "text-[var(--color-ink)]"}`}
      >
        {value}
      </div>
    </div>
  );
}

function RecentAppRow({ app }: { app: RecentApp }) {
  const status = APP_STATUS[app.status] ?? APP_STATUS.applied;
  return (
    <li>
      <a
        href={`/recruiter/applications/${app.id}`}
        className="flex items-center gap-4 px-4 py-3 transition hover:bg-[var(--color-surface-soft)]"
      >
        <span
          className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${status.text}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
            aria-hidden
          />
          {status.label}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-xs font-semibold text-[var(--color-ink)]">
          {getInitials(app.candidate?.fullName ?? "?")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-[var(--color-ink)]">
            {app.candidate?.fullName ?? "(unknown candidate)"}
          </div>
          <div className="truncate text-xs text-[var(--color-muted)]">
            Applied to{" "}
            <strong className="font-semibold">
              {app.job?.title ?? "(job)"}
            </strong>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {app.matchScore && (
            <span className="font-mono text-xs">
              <span className={scoreBandColor(app.matchScore.overallScore)}>
                {app.matchScore.overallScore}
              </span>
              <span className="text-[var(--color-muted)]">/100</span>
            </span>
          )}
          <time className="text-xs text-[var(--color-muted)]">
            {new Date(app.appliedAt).toLocaleDateString()}
          </time>
        </div>
      </a>
    </li>
  );
}

function EmptyJobsState() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <Briefcase
        className="mx-auto h-6 w-6 text-[var(--color-muted)]"
        aria-hidden
      />
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No active jobs
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Post your first opening to start collecting candidates.
      </div>
      <a
        href="/recruiter/jobs/new"
        className="mt-4 inline-flex h-11 items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
      >
        + Create your first job
      </a>
    </div>
  );
}

function EmptyAppsState() {
  return (
    <div className="px-4 py-12 text-center">
      <Inbox
        className="mx-auto h-6 w-6 text-[var(--color-muted)]"
        aria-hidden
      />
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No applications yet
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Once candidates apply to your jobs, they&apos;ll appear here.
      </div>
    </div>
  );
}

function formatSalary(s: string): string {
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString();
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
```

Notes:

- The `fetchStats` function is marked `"use server"` so the client component can invoke it as a Server Action. This keeps the access token server-side and uses the existing session.
- All scoring colors are confined to score values (`scoreBandColor`). All status pills use `--color-status-*` tokens — no scoring colors leak into lifecycle states.
- Numbers in JetBrains Mono via `font-mono` (the design tokens map this to JetBrains Mono).
- The 3-dot menu button on each job card has `onClick={(e) => e.preventDefault()}` to swallow the click without navigating; functional menu items are slice-2 work.

- [ ] **Step 3: Verify**

```bash
pnpm --filter @aurahire/web type-check
pnpm --filter @aurahire/web lint
```

Expected: exit 0.

If the API client types from Task 4 don't yet match what `page.tsx` consumes (e.g., the response shape differs), the inline interfaces (`JobWithStats`, `RecentApp`) carry the burden — they're declared at the top of the file as a type contract with the API. This is intentional: server fetches use raw `fetch()` here, not the React Query client.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(recruiter\)/recruiter/page.tsx apps/web/app/\(recruiter\)/recruiter/_dashboard-client.tsx
git commit -m "feat(web): rewrite recruiter dashboard with three dense sections

Active Jobs cards with inline 7-column metric strip per job; Pipeline Analytics
single card with date filter + 8-cell metric grid + tooltips; Recent Applications
rows with leading status pill + candidate + job + score + date. Status pills
use status-* tokens per DESIGN.md (no more score-color/status-color mixing).
Score-band colors confined to score values only."
```

---

## Self-Review

**Spec coverage:**

| Spec section                                                    | Implementing task                                                                                            | OK? |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --- |
| Goals 1 (all-white shell, no topbar)                            | Task 7                                                                                                       | ✓   |
| Goals 2 (brand discipline preserved)                            | Tasks 6 + 8                                                                                                  | ✓   |
| Goals 3 (3-section dashboard)                                   | Task 8                                                                                                       | ✓   |
| Goals 4 (page-header pattern)                                   | Task 8 (applied to dashboard); other pages deferred per spec Non-Goals                                       | ✓   |
| Section 1: Sidebar                                              | Tasks 5 + 6                                                                                                  | ✓   |
| Section 2: Page header pattern                                  | Task 8 (24px H1, no max-width cap, sub)                                                                      | ✓   |
| Section 3: Active Jobs                                          | Task 8 (`JobCard`, 7-column metric strip, status pill, More menu trigger)                                    | ✓   |
| Section 4: Pipeline Analytics                                   | Task 8 (`PipelineAnalyticsCard` in `_dashboard-client.tsx`, date filter, 8-cell grid, tooltips, bottom CTA)  | ✓   |
| Section 5: Recent Applications                                  | Task 8 (`RecentAppRow`, leading status pill, score colored by band, applied date)                            | ✓   |
| Backend: `?include=stats` on `/jobs/mine`                       | Task 3                                                                                                       | ✓   |
| Backend: `?range` on `/recruiter-stats` + 4 new metrics + alias | Task 2                                                                                                       | ✓   |
| Backend: `GET /applications/recent`                             | Task 1                                                                                                       | ✓   |
| Codegen                                                         | Task 4                                                                                                       | ✓   |
| Status pill tokens (Option b: neutral bg + colored dot + text)  | Task 8 (`JOB_STATUS` and `APP_STATUS` maps both use `--color-surface-strong` bg + `--color-status-*` colors) | ✓   |
| Score band only on score values                                 | Task 8 (`scoreBandColor` only used on `Metric` valueClass for AVG SCORE and on RecentAppRow score)           | ✓   |
| Mobile drawer behavior                                          | Task 7 (relocated hamburger to `<main>` absolute, opens `<Sheet>`)                                           | ✓   |
| Sign-out from new user chip                                     | Task 6 (`handleSignOut` in sidebar)                                                                          | ✓   |
| Backend audit/RLS preserved                                     | Tasks 1–3 (existing `@Roles` decorators kept; SQL `WHERE recruiter_id = current_user.id` enforced)           | ✓   |

**Gaps caught during review:**

- The spec's "View applications →" link routes to `/recruiter/applications`. The plan's Task 8 uses that path. If the index page doesn't exist yet it will 404 — acceptable per spec Non-Goals.
- The spec mentioned `/help` for Docs link. Plan's Task 6 routes there. May 404 — acceptable per spec Open Decisions.
- Bias flag column name was flagged in Task 2 Step 3 as a "verify before committing" — that's the right pattern (don't invent column names).
- Shortlisted column on jobs cards depends on whether the application status enum includes `shortlisted` — Task 3 Step 2 flags this as a "verify in `enums.ts` first" check. If the enum lacks it, the implementer needs to drop the SHORTLISTED column from the metric strip and the SQL filter — make this explicit:
  - **If `shortlisted` is not in `APPLICATION_STATUS`:** drop `shortlisted` from `JobStats`, drop the `count(*) filter (where status = 'shortlisted')` in the repo query, and drop the `Shortlisted` `<Metric>` from `JobCard` in `page.tsx`. Reduce `grid-cols-7` to `grid-cols-6`.

**Placeholder scan:** no TBD/TODO markers, all code shown explicitly, exact paths everywhere, exact commit messages provided.

**Type consistency:**

- `RecentApp` shape in `page.tsx` matches what `applications/recent` returns (Task 1 Step 4 builds the trimmed `ApplicationDto`).
- `JobWithStats` shape in `page.tsx` matches what `jobs/mine?include=stats` returns (Task 3 Step 2 builds the per-job aggregates with same field names: `candidates`, `new`, `shortlisted`, `interviewed`, `offered`, `hired`, `avgScore`).
- `PipelineAnalyticsData` shape in `_dashboard-client.tsx` matches the `recruiterStats` repo return shape (Task 2 Step 3): both use `totalApps`, `pendingReview`, `inInterview`, `offered`, `hired`, `avgMatchScore`, `biasFlags`, `activeJobs`. Old aliases (`totalApplications`, `pendingReviews`) exist on the API response but the client only reads the new names.
- The `Range` type in `_dashboard-client.tsx` (`"7d" | "30d" | "90d" | "all"`) matches the backend Zod enum exactly.

---

## Manual Smoke Checklist (post-implementation, run by the human)

After all tasks land:

1. Sign in as the seeded recruiter (`recruiter@gmail.com`).
2. Confirm sidebar renders with: AuraHire wordmark top, tenant chip showing "TechCorp Inc." (or whatever the seed sets), MAIN/PIPELINE/ACCOUNT sections, Docs link near bottom, user chip at bottom-bottom.
3. Confirm topbar is gone — no breadcrumb, no avatar dropdown at top of `<main>`, no notification bell.
4. Confirm Dashboard renders three sections in order: Active Jobs (cards) → Pipeline Analytics (single card) → Recent Applications (rows).
5. Confirm each Active Jobs card shows the 7 metrics (or 6 if `shortlisted` was dropped), with Avg Score colored by band.
6. Switch the Pipeline Analytics date range — values should re-fetch and update.
7. Click an Active Jobs card → navigates to job detail.
8. Click a Recent Applications row → navigates to application detail.
9. Click the user chip → dropdown opens upward → click Sign out → returns to home.
10. Resize to mobile → hamburger appears top-left of `<main>` → opens drawer with same sidebar contents → tap a nav item → drawer closes and route changes.
11. Confirm `pnpm type-check` and `pnpm lint` both clean across the workspace.

If any step fails, the underlying task needs revisit.
