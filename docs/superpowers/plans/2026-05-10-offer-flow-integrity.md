# Offer Flow Integrity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close four integrity holes in the offer/hiring flow: Mark Hired without an accepted offer, Decline/expiry leaving the application stuck at `offer`, no cascade auto-reject of sibling applicants, and the unsynchronised Accept ↔ Mark Hired race.

**Architecture:** Adds a new `offer_declined` application status with paired state-machine edges. Introduces an accepted-offer guard for transitions into `hired`. Wraps Accept, Decline, Hire, and the expire-offers cron in `db.transaction` blocks with `SELECT … FOR UPDATE` on the application row to serialise concurrent writers. The new `ApplicationsService.hire()` method optionally cascades — auto-rejecting other in-flight applicants on the same job in the same transaction. The recruiter UI gains a confirmation modal that surfaces sibling counts; the candidate UI shows an "Offer Closed" card variant.

**Tech Stack:** NestJS, Drizzle ORM, PostgreSQL (Supabase), Next.js 16, React, Tailwind, Vitest, React Email.

**Spec:** `docs/superpowers/specs/2026-05-10-offer-flow-integrity-design.md`

---

## File Structure

| File | Role |
|---|---|
| `packages/db/src/enums.ts` | Adds `offer_declined` to `APPLICATION_STATUS` |
| `packages/db/drizzle/0013_offer_declined_status.sql` | Migration record (no DDL — Drizzle uses TS-side enum) |
| `packages/shared/src/schemas/applications.ts` | Extend `updateApplicationStatusSchema` with `autoRejectOthers` |
| `apps/api/src/audit/audit.types.ts` | Add three new audit action constants |
| `apps/api/src/modules/applications/state-machine.ts` | Extend `VALID_TRANSITIONS`; export `STATUSES_REQUIRING_ACCEPTED_OFFER` |
| `apps/api/src/modules/applications/state-machine.spec.ts` | Tests for new edges |
| `apps/api/src/modules/applications/applications.repository.ts` | Add `ApplicationsTx`, `findByIdForUpdate`, `findInflightByJobId` |
| `apps/api/src/modules/offers/offers.repository.ts` | Add `findLatestByApplicationId` |
| `apps/api/src/modules/applications/applications.service.ts` | `transitionFromSystem(tx?)`, `updateStatus` guard, new `hire()` method |
| `apps/api/src/modules/applications/applications.service.hire.spec.ts` | New unit spec for `hire()` |
| `apps/api/src/modules/applications/applications.controller.ts` | Branch on `newStatus === "hired"` to call `hire()` |
| `apps/api/src/modules/offers/offers.service.ts` | Wrap `accept` and `decline` in transactions; trigger auto-transition |
| `apps/api/src/modules/offers/offers.service.spec.ts` (extend if exists, else create) | Unit tests for new flow |
| `apps/api/src/cron/expire-offers.cron.ts` | Per-offer transaction + auto-transition |
| `apps/api/src/cron/expire-offers.cron.spec.ts` | Extend with auto-transition assertion |
| `apps/api/src/email/templates/position-filled.tsx` | New email template |
| `apps/web/app/(candidate)/candidate/applications/[id]/_application-detail-client.tsx` | Add `ClosedOfferCard` variant |
| `apps/web/app/(candidate)/candidate/applications/[id]/_offer-actions-client.tsx` | Update copy; render closed state already partly handled |
| `apps/web/app/(recruiter)/recruiter/applications/[id]/_decision-bar-client.tsx` | Pipeline stage list, disabled Mark Hired, offer-declined actions, modal launch |
| `apps/web/app/(recruiter)/recruiter/applications/[id]/_hire-confirmation-modal-client.tsx` | New modal |
| `apps/web/app/(recruiter)/recruiter/applications/_applications-toolbar-client.tsx` | Add `offer_declined` filter option |
| `apps/web/app/(candidate)/candidate/applications/_applications-toolbar-client.tsx` | Add `offer_declined` filter option |
| `apps/web/app/(admin)/admin/applications/_filters-client.tsx` | Add `offer_declined` filter option |

---

## Task 1: Add `offer_declined` enum value

**Files:**
- Modify: `packages/db/src/enums.ts`
- Modify: `packages/shared/src/enums/index.ts` (verify re-export already covers)

- [ ] **Step 1: Read the current enum file to confirm position**

```bash
sed -n '8,17p' packages/db/src/enums.ts
```
Expected: shows `APPLICATION_STATUS` array with 7 values, `offer` at index 3, `hired` at 4.

- [ ] **Step 2: Edit `packages/db/src/enums.ts` to insert the new value between `offer` and `hired`**

Replace:
```ts
export const APPLICATION_STATUS = [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
] as const;
```

With:
```ts
export const APPLICATION_STATUS = [
  "applied",
  "screening",
  "interview",
  "offer",
  "offer_declined",
  "hired",
  "rejected",
  "withdrawn",
] as const;
```

- [ ] **Step 3: Verify shared package re-exports the enum**

```bash
grep -n "APPLICATION_STATUS\|export \* from" packages/shared/src/enums/index.ts
```
Expected: shows a re-export from `@aurahire/db` or an explicit import that pulls the same constant. If the shared package defines its own copy, mirror the change there too.

- [ ] **Step 4: Type-check both packages**

```bash
pnpm -F @aurahire/db tsc --noEmit
pnpm -F @aurahire/shared tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/enums.ts packages/shared/src/enums/index.ts
git commit -m "feat(db): add offer_declined application status enum value"
```

---

## Task 2: Create migration file (record only)

**Files:**
- Create: `packages/db/drizzle/0013_offer_declined_status.sql`

`applications.status` is currently `text` (no Postgres `enum` constraint, no CHECK). Drizzle enforces the enum at write time. The migration file documents the bump for the migration history; it has no DDL.

- [ ] **Step 1: Create the migration file**

```sql
-- 0013_offer_declined_status.sql
-- Adds the "offer_declined" application status to the TypeScript enum.
-- No DDL is required: applications.status is plain `text`; Drizzle enforces
-- the enum at write time. This file exists only to record the schema bump.

SELECT 1; -- no-op
```

- [ ] **Step 2: Confirm no existing applications carry the new status**

```bash
cat packages/db/drizzle/0013_offer_declined_status.sql
```
Expected: file exists with the comment + no-op SELECT.

- [ ] **Step 3: Commit**

```bash
git add packages/db/drizzle/0013_offer_declined_status.sql
git commit -m "chore(db): record migration for offer_declined enum bump"
```

---

## Task 3: Extend state machine — add `offer_declined` row + edges

**Files:**
- Modify: `apps/api/src/modules/applications/state-machine.ts`
- Modify: `apps/api/src/modules/applications/state-machine.spec.ts`

- [ ] **Step 1: Write the failing tests in `state-machine.spec.ts`**

Append these test blocks after the existing "disallows transitions out of terminal states" test:

```ts
  it("allows offer → offer_declined (system-initiated)", () => {
    expect(canTransition("offer", "offer_declined")).toBe(true);
  });

  it("allows offer_declined → offer (recruiter re-extend)", () => {
    expect(canTransition("offer_declined", "offer")).toBe(true);
  });

  it("allows offer_declined → rejected | withdrawn", () => {
    expect(canTransition("offer_declined", "rejected")).toBe(true);
    expect(canTransition("offer_declined", "withdrawn")).toBe(true);
  });

  it("disallows offer_declined → hired (must re-extend + accept first)", () => {
    expect(canTransition("offer_declined", "hired")).toBe(false);
  });

  it("disallows offer_declined → applied | screening | interview", () => {
    expect(canTransition("offer_declined", "applied")).toBe(false);
    expect(canTransition("offer_declined", "screening")).toBe(false);
    expect(canTransition("offer_declined", "interview")).toBe(false);
  });

  it("exports STATUSES_REQUIRING_ACCEPTED_OFFER containing 'hired'", () => {
    // Imported lazily so the failing test guards the export shape too.
    const sm = require("./state-machine") as typeof import("./state-machine");
    expect(sm.STATUSES_REQUIRING_ACCEPTED_OFFER).toContain("hired");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm -F @aurahire/api vitest run src/modules/applications/state-machine.spec.ts
```
Expected: 6 failing tests; among them "Cannot read property 'STATUSES_REQUIRING_ACCEPTED_OFFER' of undefined" or similar.

- [ ] **Step 3: Implement the state-machine changes in `state-machine.ts`**

Replace the file contents with:

```ts
import type { ApplicationStatus } from "@aurahire/shared";

const VALID_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  applied:        ["screening", "interview", "rejected", "withdrawn"],
  screening:      ["interview",              "rejected", "withdrawn"],
  interview:      ["offer",                  "rejected", "withdrawn"],
  offer:          ["hired", "offer_declined", "rejected", "withdrawn"],
  offer_declined: ["offer",                   "rejected", "withdrawn"],
  hired:          [],
  rejected:       [],
  withdrawn:      [],
};

/**
 * Statuses that require a separate semantic check beyond the state machine —
 * specifically that the application has an accepted offer attached. Today only
 * `hired` qualifies. Used by ApplicationsService.hire() and updateStatus().
 */
export const STATUSES_REQUIRING_ACCEPTED_OFFER: readonly ApplicationStatus[] = [
  "hired",
];

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

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm -F @aurahire/api vitest run src/modules/applications/state-machine.spec.ts
```
Expected: all tests pass (original 5 + new 6).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/applications/state-machine.ts apps/api/src/modules/applications/state-machine.spec.ts
git commit -m "feat(applications): state-machine support for offer_declined + accepted-offer guard list"
```

---

## Task 4: Extend `updateApplicationStatusSchema` DTO

**Files:**
- Modify: `packages/shared/src/schemas/applications.ts`

- [ ] **Step 1: Edit the schema**

Replace:
```ts
export const updateApplicationStatusSchema = z.object({
  newStatus: z.enum(APPLICATION_STATUS),
  note: z.string().max(2000).nullable().optional(),
});
```

With:
```ts
export const updateApplicationStatusSchema = z.object({
  newStatus: z.enum(APPLICATION_STATUS),
  note: z.string().max(2000).nullable().optional(),
  /**
   * When true AND newStatus is "hired", server cascades: every other
   * in-flight application on the same job is auto-rejected with a
   * "position filled" notification. Honored only for hire transitions.
   */
  autoRejectOthers: z.boolean().optional(),
});
```

- [ ] **Step 2: Type-check**

```bash
pnpm -F @aurahire/shared tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/schemas/applications.ts
git commit -m "feat(shared): updateApplicationStatusSchema accepts autoRejectOthers"
```

---

## Task 5: Add new audit action constants

**Files:**
- Modify: `apps/api/src/audit/audit.types.ts`

- [ ] **Step 1: Edit `AUDIT_ACTIONS` block — append to the Offers section**

After the line `OFFER_EXPIRED: "offer.expired",` insert:

```ts
  // Application auto-transitions driven by offer events
  APPLICATION_AUTO_TRANSITION_OFFER_DECLINED:
    "application.auto_transition_offer_declined",
  APPLICATION_AUTO_TRANSITION_OFFER_EXPIRED:
    "application.auto_transition_offer_expired",
  APPLICATION_AUTO_REJECTED_POSITION_FILLED:
    "application.auto_rejected_position_filled",
```

- [ ] **Step 2: Type-check**

```bash
pnpm -F @aurahire/api tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/audit/audit.types.ts
git commit -m "feat(audit): action constants for offer_declined / position_filled cascades"
```

---

## Task 6: Add `OffersRepository.findLatestByApplicationId`

**Files:**
- Modify: `apps/api/src/modules/offers/offers.repository.ts`

- [ ] **Step 1: Add the method below `findPendingByApplicationId`**

```ts
  /**
   * Most recent offer (by sentAt DESC) for an application — or null if no
   * offer has ever been sent. Used by ApplicationsService to enforce that
   * a "hired" transition requires an accepted offer.
   */
  async findLatestByApplicationId(applicationId: string): Promise<Offer | null> {
    const [row] = await this.db
      .select()
      .from(offersTable)
      .where(eq(offersTable.applicationId, applicationId))
      .orderBy(desc(offersTable.sentAt))
      .limit(1);
    return row ?? null;
  }
```

- [ ] **Step 2: Type-check**

```bash
pnpm -F @aurahire/api tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/offers/offers.repository.ts
git commit -m "feat(offers): repo method findLatestByApplicationId"
```

---

## Task 7: Add `ApplicationsTx`, `findByIdForUpdate`, `findInflightByJobId`

**Files:**
- Modify: `apps/api/src/modules/applications/applications.repository.ts`

- [ ] **Step 1: Add imports + Tx type at top of file**

After the existing imports add:

```ts
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import * as schema from "@aurahire/db";

export type ApplicationsTx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

type Executor = DrizzleClient | ApplicationsTx;
```

- [ ] **Step 2: Inside the class, add `findByIdForUpdate` after `findById`**

```ts
  /**
   * Lock the row for the duration of the surrounding transaction. Used by
   * the offer accept / decline / hire flows to serialise writers so that
   * the application's status + the latest offer's status stay consistent.
   */
  async findByIdForUpdate(tx: ApplicationsTx, id: string): Promise<Application | null> {
    const [row] = await tx
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id))
      .for("update")
      .limit(1);
    return row ?? null;
  }
```

- [ ] **Step 3: Add `findInflightByJobId` after `findByJobIdSortedByMatchScore`**

```ts
  /**
   * In-flight applications on a job — used by the cascade auto-reject when
   * another candidate is hired. Excludes the just-hired application (passed
   * as `excludeId`) and any already-terminal application.
   */
  async findInflightByJobId(
    tx: ApplicationsTx,
    jobId: string,
    excludeId: string,
  ): Promise<Application[]> {
    return tx
      .select()
      .from(applicationsTable)
      .where(
        and(
          eq(applicationsTable.jobId, jobId),
          ne(applicationsTable.id, excludeId),
          sql`${applicationsTable.status} NOT IN ('hired', 'rejected', 'withdrawn', 'offer_declined')`,
        ),
      );
  }
```

- [ ] **Step 4: Add the missing `ne` import to the existing drizzle-orm import line**

Locate the existing line:
```ts
import { and, count, desc, eq, isNotNull, sql, type SQL } from "drizzle-orm";
```

Replace with:
```ts
import { and, count, desc, eq, isNotNull, ne, sql, type SQL } from "drizzle-orm";
```

- [ ] **Step 5: Add overload to `update()` so it accepts an optional tx executor**

Replace the existing `update` method:
```ts
  async update(id: string, patch: Partial<NewApplication>): Promise<Application> {
    const [row] = await this.db
      .update(applicationsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(applicationsTable.id, id))
      .returning();
    if (!row) throw new Error("Application update failed");
    return row;
  }
```

With:
```ts
  async update(
    id: string,
    patch: Partial<NewApplication>,
    tx?: ApplicationsTx,
  ): Promise<Application> {
    const exec: Executor = tx ?? this.db;
    const [row] = await exec
      .update(applicationsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(applicationsTable.id, id))
      .returning();
    if (!row) throw new Error("Application update failed");
    return row;
  }
```

- [ ] **Step 6: Type-check**

```bash
pnpm -F @aurahire/api tsc --noEmit
```
Expected: no errors. (Existing call sites of `update(id, patch)` keep working — the tx param is optional.)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/applications/applications.repository.ts
git commit -m "feat(applications): repo methods findByIdForUpdate, findInflightByJobId, ApplicationsTx"
```

---

## Task 8: `ApplicationsService.transitionFromSystem` accepts optional tx

**Files:**
- Modify: `apps/api/src/modules/applications/applications.service.ts`

- [ ] **Step 1: Import `ApplicationsTx` at the top of the file**

After the existing repo import add:

```ts
import type { ApplicationsTx } from "./applications.repository";
```

- [ ] **Step 2: Update the method signature + DB call**

Replace the existing signature (line ~731):
```ts
  async transitionFromSystem(
    actor: AuthUser,
    id: string,
    newStatus: ApplicationStatus,
    note: string,
    requestMeta: RequestMeta = {},
  ): Promise<ApplicationDto> {
```

With:
```ts
  async transitionFromSystem(
    actor: AuthUser | null,
    id: string,
    newStatus: ApplicationStatus,
    note: string,
    requestMeta: RequestMeta = {},
    tx?: ApplicationsTx,
  ): Promise<ApplicationDto> {
```

The `actor` parameter is widened to `AuthUser | null` so the cron (system actor) can pass `null` without a cast.

- [ ] **Step 3: Use `tx` when updating the row**

Find the call:
```ts
    await this.repo.update(id, {
      status: newStatus,
      statusUpdatedAt: new Date(),
      recruiterNotes: this.appendNote(app.recruiterNotes, note),
    });
```

Replace with:
```ts
    await this.repo.update(
      id,
      {
        status: newStatus,
        statusUpdatedAt: new Date(),
        recruiterNotes: this.appendNote(app.recruiterNotes, note),
      },
      tx,
    );
```

- [ ] **Step 4: Update the audit + notification calls to handle null actor**

Find:
```ts
    await this.audit.log({
      actorId: actor.id,
      actorType: "user",
```

Replace with:
```ts
    await this.audit.log({
      actorId: actor?.id ?? null,
      actorType: actor ? "user" : "system",
```

Find further down in the same method:
```ts
        actorId: actor.id,
        metadata: {
```

Replace with:
```ts
        actorId: actor?.id ?? null,
        metadata: {
```

- [ ] **Step 5: Type-check**

```bash
pnpm -F @aurahire/api tsc --noEmit
```
Expected: no errors. Existing callers passing an `AuthUser` continue to work; the cron (Task 14) and decline/accept flows (Task 12, 13) will pass `null` and `tx`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/applications/applications.service.ts
git commit -m "feat(applications): transitionFromSystem accepts optional tx + null actor"
```

---

## Task 9: Add accepted-offer guard to `ApplicationsService.updateStatus`

**Files:**
- Modify: `apps/api/src/modules/applications/applications.service.ts`

This task adds the guard but does NOT yet branch hire to a separate method — that happens in Task 10. Putting the guard in `updateStatus` first means it covers all callers immediately.

- [ ] **Step 1: Import the new constants + repo**

Update the imports near the top:

```ts
import { canTransition, STATUSES_REQUIRING_ACCEPTED_OFFER } from "./state-machine";
```

Add to the constructor signature an `OffersRepository`:

```ts
import { OffersRepository } from "../offers/offers.repository";
```

Inside the `constructor(...)` arg list (around line 54), add:

```ts
    private readonly offersRepo: OffersRepository,
```

- [ ] **Step 2: Update `ApplicationsModule` to provide `OffersRepository`**

Open `apps/api/src/modules/applications/applications.module.ts` and add `OffersRepository` to the `providers` array (and import it). If it's already provided via the `OffersModule`, instead add `forwardRef(() => OffersModule)` to `imports` — match the existing pattern.

```bash
grep -n "imports\|providers" apps/api/src/modules/applications/applications.module.ts
```
Expected: shows the module's `imports` and `providers` arrays. Pattern-match the existing approach (most modules expose their repository via `exports` so a sibling module imports the whole module).

If `OffersModule` already exports `OffersRepository`, add `forwardRef(() => OffersModule)` to `ApplicationsModule.imports` and to `OffersModule.imports` (already cycles).

- [ ] **Step 3: In `updateStatus`, after the state-machine check, add the guard**

Find:
```ts
    if (!canTransition(app.status as ApplicationStatus, dto.newStatus)) {
      throw new BadRequestException({
        code: "INVALID_STATUS_TRANSITION",
        message: `Cannot transition from ${app.status} to ${dto.newStatus}`,
      });
    }
```

After that block insert:
```ts
    if (STATUSES_REQUIRING_ACCEPTED_OFFER.includes(dto.newStatus)) {
      const latestOffer = await this.offersRepo.findLatestByApplicationId(id);
      if (!latestOffer || latestOffer.status !== "accepted") {
        throw new BadRequestException({
          code: "OFFER_NOT_ACCEPTED",
          message:
            "Cannot mark hired — candidate has not accepted an offer.",
        });
      }
    }
```

- [ ] **Step 4: Type-check**

```bash
pnpm -F @aurahire/api tsc --noEmit
```
Expected: no errors. If `OffersRepository` injection complains about a circular dep, see Step 2 — use `forwardRef`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/applications/applications.service.ts apps/api/src/modules/applications/applications.module.ts
git commit -m "feat(applications): updateStatus blocks hire without accepted offer"
```

---

## Task 10: Implement `ApplicationsService.hire()` with cascade + transaction

**Files:**
- Modify: `apps/api/src/modules/applications/applications.service.ts`
- Modify: `apps/api/src/modules/applications/applications.controller.ts`
- Create: `apps/api/src/modules/applications/applications.service.hire.spec.ts`

This is the largest task; it pulls hire out of `updateStatus` so it can run in a transaction with the cascade.

- [ ] **Step 1: Inject the Drizzle client into ApplicationsService**

Add to the existing imports:
```ts
import { Inject } from "@nestjs/common";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";
import { AUDIT_ACTIONS } from "../../audit/audit.types";
```

(`AUDIT_ACTIONS` may already be re-exported via `../../audit`. Pattern-match the file's existing import style.)

In the constructor add:
```ts
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
```

- [ ] **Step 2: Write the failing spec at `applications.service.hire.spec.ts`**

```ts
import { Test, TestingModule } from "@nestjs/testing";
import { ApplicationsService } from "./applications.service";
import { ApplicationsRepository } from "./applications.repository";
import { JobsRepository } from "../jobs/jobs.repository";
import { OffersRepository } from "../offers/offers.repository";
import { AuditService } from "../../audit";
import { CacheService } from "../../cache";
import { EventsService } from "../../realtime";
import { EmailService } from "../../email/email.service";
import { MatchScoreQueueService } from "../../queue/match-score-queue.service";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { ResumesRepository } from "../resumes/resumes.repository";
import { ScoringService } from "../scoring/scoring.service";
import { StorageService } from "../../storage/storage.service";
import { NotificationsService } from "../notifications/notifications.service";
import { DRIZZLE_CLIENT } from "../../db/db.module";
import { BadRequestException } from "@nestjs/common";

const noopRepo = { findById: jest.fn(), update: jest.fn(), findByIdForUpdate: jest.fn(), findInflightByJobId: jest.fn() };
const noopJobs = { findById: jest.fn() };
const noopOffers = { findLatestByApplicationId: jest.fn() };
const noopAudit = { log: jest.fn() };
const noopCache = { bustTags: jest.fn() };
const noopEvents = { emitApplicationStatusChanged: jest.fn() };
const noopEmail = { send: jest.fn() };
const noopNotifs = { emit: jest.fn(), emitMany: jest.fn() };

function fakeDb() {
  return {
    transaction: jest.fn(async <T>(fn: (tx: unknown) => Promise<T>) => fn({})),
  };
}

const recruiter = { id: "rec-1", role: "recruiter" as const, email: "r@x" } as any;

describe("ApplicationsService.hire()", () => {
  let svc: ApplicationsService;
  let repo: typeof noopRepo;
  let offers: typeof noopOffers;
  let jobs: typeof noopJobs;

  beforeEach(async () => {
    repo = { ...noopRepo, findById: jest.fn(), update: jest.fn(), findByIdForUpdate: jest.fn(), findInflightByJobId: jest.fn() };
    offers = { ...noopOffers, findLatestByApplicationId: jest.fn() };
    jobs = { ...noopJobs, findById: jest.fn() };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: ApplicationsRepository, useValue: repo },
        { provide: JobsRepository, useValue: jobs },
        { provide: OffersRepository, useValue: offers },
        { provide: AuditService, useValue: noopAudit },
        { provide: CacheService, useValue: noopCache },
        { provide: EventsService, useValue: noopEvents },
        { provide: EmailService, useValue: noopEmail },
        { provide: MatchScoreQueueService, useValue: { enqueue: jest.fn() } },
        { provide: ProfilesRepository, useValue: { findById: jest.fn() } },
        { provide: ResumesRepository, useValue: { findById: jest.fn() } },
        { provide: ScoringService, useValue: {} },
        { provide: StorageService, useValue: {} },
        { provide: NotificationsService, useValue: noopNotifs },
        { provide: DRIZZLE_CLIENT, useValue: fakeDb() },
      ],
    }).compile();

    svc = mod.get(ApplicationsService);
  });

  it("rejects when latest offer is not accepted", async () => {
    repo.findByIdForUpdate.mockResolvedValue({ id: "a-1", status: "offer", jobId: "j-1", candidateId: "c-1" });
    jobs.findById.mockResolvedValue({ id: "j-1", companyId: "co-1", recruiterId: "rec-1" });
    offers.findLatestByApplicationId.mockResolvedValue({ status: "pending" });

    await expect(
      svc.hire(recruiter, "co-1", "a-1", { autoRejectOthers: false }, {}),
    ).rejects.toThrow(BadRequestException);
  });

  it("hires the candidate when offer is accepted, no cascade", async () => {
    repo.findByIdForUpdate.mockResolvedValue({ id: "a-1", status: "offer", jobId: "j-1", candidateId: "c-1", recruiterNotes: null });
    jobs.findById.mockResolvedValue({ id: "j-1", companyId: "co-1", recruiterId: "rec-1" });
    offers.findLatestByApplicationId.mockResolvedValue({ status: "accepted" });
    repo.findInflightByJobId.mockResolvedValue([]);
    repo.update.mockResolvedValue({ id: "a-1", status: "hired" });

    const result = await svc.hire(recruiter, "co-1", "a-1", { autoRejectOthers: false }, {});

    expect(repo.update).toHaveBeenCalledWith(
      "a-1",
      expect.objectContaining({ status: "hired" }),
      expect.anything(),
    );
    expect(result.otherApplicationsRejected).toBe(0);
  });

  it("cascades — auto-rejects in-flight siblings when autoRejectOthers=true", async () => {
    repo.findByIdForUpdate.mockResolvedValue({ id: "a-1", status: "offer", jobId: "j-1", candidateId: "c-1", recruiterNotes: null });
    jobs.findById.mockResolvedValue({ id: "j-1", companyId: "co-1", recruiterId: "rec-1" });
    offers.findLatestByApplicationId.mockResolvedValue({ status: "accepted" });
    repo.findInflightByJobId.mockResolvedValue([
      { id: "a-2", candidateId: "c-2", recruiterNotes: null },
      { id: "a-3", candidateId: "c-3", recruiterNotes: "prior note" },
    ]);
    repo.update.mockResolvedValue({ id: "a-1", status: "hired" });

    const result = await svc.hire(recruiter, "co-1", "a-1", { autoRejectOthers: true }, {});

    // 1 hire UPDATE + 2 cascade UPDATEs = 3 total
    expect(repo.update).toHaveBeenCalledTimes(3);
    expect(result.otherApplicationsRejected).toBe(2);
  });

  it("does not touch siblings when autoRejectOthers=false", async () => {
    repo.findByIdForUpdate.mockResolvedValue({ id: "a-1", status: "offer", jobId: "j-1", candidateId: "c-1", recruiterNotes: null });
    jobs.findById.mockResolvedValue({ id: "j-1", companyId: "co-1", recruiterId: "rec-1" });
    offers.findLatestByApplicationId.mockResolvedValue({ status: "accepted" });
    repo.findInflightByJobId.mockResolvedValue([{ id: "a-2", candidateId: "c-2" }]);
    repo.update.mockResolvedValue({ id: "a-1", status: "hired" });

    const result = await svc.hire(recruiter, "co-1", "a-1", { autoRejectOthers: false }, {});

    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(result.otherApplicationsRejected).toBe(0);
  });
});
```

- [ ] **Step 3: Run the spec to verify it fails**

```bash
pnpm -F @aurahire/api vitest run src/modules/applications/applications.service.hire.spec.ts
```
Expected: tests fail because `svc.hire` does not exist.

- [ ] **Step 4: Implement `hire()` in `applications.service.ts`**

Add this method directly above `updateStatus` (around line 583):

```ts
  /**
   * Hire a candidate. Wrapped in a transaction so the application UPDATE,
   * the accepted-offer guard, and the optional cascade auto-reject of
   * sibling applications all commit atomically. Side effects (email,
   * realtime emit, in-app notifications) fire after commit.
   */
  async hire(
    user: AuthUser,
    companyId: string,
    applicationId: string,
    dto: { autoRejectOthers: boolean; note?: string | null },
    requestMeta: RequestMeta = {},
  ): Promise<{ application: ApplicationDto; otherApplicationsRejected: number }> {
    if (user.role !== "recruiter") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Recruiter role required",
      });
    }

    const result = await this.db.transaction(async (tx) => {
      const app = await this.repo.findByIdForUpdate(tx as ApplicationsTx, applicationId);
      if (!app) {
        throw new NotFoundException({ code: "NOT_FOUND", message: "Application not found" });
      }

      const job = await this.jobsRepo.findById(app.jobId);
      if (!job || job.companyId !== companyId) {
        throw new NotFoundException({ code: "NOT_FOUND", message: "Application not found" });
      }

      if (!canTransition(app.status as ApplicationStatus, "hired")) {
        throw new BadRequestException({
          code: "INVALID_STATUS_TRANSITION",
          message: `Cannot transition from ${app.status} to hired`,
        });
      }

      const latestOffer = await this.offersRepo.findLatestByApplicationId(applicationId);
      if (!latestOffer || latestOffer.status !== "accepted") {
        throw new BadRequestException({
          code: "OFFER_NOT_ACCEPTED",
          message: "Cannot mark hired — candidate has not accepted an offer.",
        });
      }

      // 1) Hire the chosen candidate
      await this.repo.update(
        applicationId,
        {
          status: "hired",
          statusUpdatedAt: new Date(),
          ...(dto.note
            ? { recruiterNotes: this.appendNote(app.recruiterNotes, dto.note) }
            : {}),
        },
        tx as ApplicationsTx,
      );

      await this.audit.log({
        actorId: user.id,
        actorType: "user",
        action: "application.status_changed",
        entityType: "application",
        entityId: applicationId,
        companyId,
        details: { from: app.status, to: "hired", note: dto.note ?? null },
        ...requestMeta,
      });

      // 2) Cascade — auto-reject other in-flight applicants on the same job
      let cascaded: Array<{ id: string; candidateId: string }> = [];
      if (dto.autoRejectOthers) {
        const others = await this.repo.findInflightByJobId(
          tx as ApplicationsTx,
          app.jobId,
          applicationId,
        );

        for (const other of others) {
          await this.repo.update(
            other.id,
            {
              status: "rejected",
              statusUpdatedAt: new Date(),
              recruiterNotes: this.appendNote(
                other.recruiterNotes,
                "[Auto-rejected: position filled by another candidate]",
              ),
            },
            tx as ApplicationsTx,
          );

          await this.audit.log({
            actorId: user.id,
            actorType: "user",
            action: AUDIT_ACTIONS.APPLICATION_AUTO_REJECTED_POSITION_FILLED,
            entityType: "application",
            entityId: other.id,
            companyId,
            details: {
              hiredApplicationId: applicationId,
              hiredCandidateId: app.candidateId,
              jobId: app.jobId,
            },
            ...requestMeta,
          });
        }

        cascaded = others.map((o) => ({ id: o.id, candidateId: o.candidateId }));
      }

      return { app, job, cascaded };
    });

    // 3) After-commit side effects (best-effort, fire-and-forget)
    await this.cacheService.bustTags([
      TAGS.companyDashboard(companyId),
      TAGS.companyApplications(companyId),
      TAGS.companyShortlist(companyId),
      TAGS.applicationsCandidate(result.app.candidateId),
      ...result.cascaded.map((c) => TAGS.applicationsCandidate(c.candidateId)),
    ]);

    this.events.emitApplicationStatusChanged({
      applicationId,
      jobId: result.app.jobId,
      recruiterId: result.job.recruiterId,
      candidateId: result.app.candidateId,
      previousStatus: result.app.status as ApplicationStatus,
      status: "hired",
      changedAt: new Date().toISOString(),
    });

    void this.notifyCandidateOfStatusChange(applicationId, result.app.status, "hired").catch(
      (err) => this.logger.warn(`Hire candidate notify failed: ${(err as Error).message}`),
    );

    void this.notifications
      .emit({
        userId: result.app.candidateId,
        eventType: "application_status_changed",
        scope: "personal",
        entityType: "application",
        entityId: applicationId,
        actorId: user.id,
        metadata: {
          applicationId,
          jobId: result.app.jobId,
          fromStatus: result.app.status,
          toStatus: "hired",
          occurredAt: new Date().toISOString(),
        },
      })
      .catch((err) =>
        this.logger.warn(`hire notification failed: ${(err as Error).message}`),
      );

    // Cascade notifications + position-filled email per affected sibling
    for (const other of result.cascaded) {
      void this.notifyPositionFilled(other.id, other.candidateId, result.job.id).catch(
        (err) =>
          this.logger.warn(
            `position-filled notify failed for ${other.id}: ${(err as Error).message}`,
          ),
      );

      void this.notifications
        .emit({
          userId: other.candidateId,
          eventType: "application_status_changed",
          scope: "personal",
          entityType: "application",
          entityId: other.id,
          actorId: user.id,
          metadata: {
            applicationId: other.id,
            jobId: result.app.jobId,
            fromStatus: "(cascade)",
            toStatus: "rejected",
            reason: "position_filled",
            hiredApplicationId: applicationId,
            occurredAt: new Date().toISOString(),
          },
        })
        .catch((err) =>
          this.logger.warn(
            `cascade notify failed for ${other.id}: ${(err as Error).message}`,
          ),
        );
    }

    return {
      application: await this.toDto(applicationId),
      otherApplicationsRejected: result.cascaded.length,
    };
  }

  /**
   * Sends the position-filled email to a bulk-rejected candidate. Helper
   * extracted so the cascade loop stays readable.
   */
  private async notifyPositionFilled(
    applicationId: string,
    candidateId: string,
    jobId: string,
  ): Promise<void> {
    const candidate = await this.profilesRepo.findById(candidateId);
    const jobRow = await this.jobsRepo.findByIdWithCompany(jobId);
    if (!candidate || !jobRow) return;

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    await this.email.send({
      to: candidate.email,
      subject: `Update on your application — ${jobRow.title}`,
      template: PositionFilledEmail({
        candidateName: candidate.fullName,
        jobTitle: jobRow.title,
        applicationUrl: `${appUrl}/candidate/applications/${applicationId}`,
        company: { name: jobRow.company.name, logoUrl: jobRow.company.logoUrl },
      }),
    });
  }
```

Add the import of the new template at the top:
```ts
import { PositionFilledEmail } from "../../email/templates/position-filled";
```

(The template is created in Task 11.)

- [ ] **Step 5: Branch the controller to call `hire()` for hire transitions**

In `applications.controller.ts`, replace the `updateStatus` handler body (line ~224):

```ts
  async updateStatus(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("id") id: string,
    @Body() dto: UpdateApplicationStatusDto,
    @Req() req: FastifyRequest,
  ): Promise<ApplicationEnvelopeDto | { data: ApplicationDto; otherApplicationsRejected: number }> {
    const meta = this.requestMeta(req);
    if (dto.newStatus === "hired") {
      const result = await this.service.hire(
        user,
        activeCompany.companyId,
        id,
        { autoRejectOthers: dto.autoRejectOthers ?? false, note: dto.note ?? null },
        meta,
      );
      return { data: result.application, otherApplicationsRejected: result.otherApplicationsRejected };
    }
    const data = await this.service.updateStatus(
      user,
      activeCompany.companyId,
      id,
      dto,
      meta,
    );
    return { data };
  }
```

(Adjust the response type / DTO to match the project's existing envelope conventions — if necessary, define a small `HireApplicationEnvelopeDto`.)

- [ ] **Step 6: Run the spec — should pass**

```bash
pnpm -F @aurahire/api vitest run src/modules/applications/applications.service.hire.spec.ts
```
Expected: 4 passing tests.

- [ ] **Step 7: Run the full applications module specs to catch regressions**

```bash
pnpm -F @aurahire/api vitest run src/modules/applications
```
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/applications/
git commit -m "feat(applications): hire() with cascade + transactional accepted-offer guard"
```

---

## Task 11: Position-filled email template

**Files:**
- Create: `apps/api/src/email/templates/position-filled.tsx`

- [ ] **Step 1: Create the template**

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

import { EmailBrandHeader } from "./_brand-header";

interface Props {
  candidateName: string;
  jobTitle: string;
  applicationUrl: string;
  company?: { name: string; logoUrl: string | null } | null;
}

export function PositionFilledEmail({
  candidateName,
  jobTitle,
  applicationUrl,
  company,
}: Props): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>{`Update on your application for ${jobTitle}`}</Preview>
      <Body
        style={{
          fontFamily: "Inter, sans-serif",
          backgroundColor: "#f7f7f7",
          padding: "32px 16px",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "32px",
            borderRadius: "16px",
            maxWidth: "560px",
            margin: "0 auto",
          }}
        >
          <EmailBrandHeader company={company} />
          <Heading style={{ color: "#0a0b0d", fontWeight: 400, fontSize: "24px" }}>
            Update on your application
          </Heading>
          <Section>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              Hi {candidateName},
            </Text>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              We wanted to let you know that the{" "}
              <strong style={{ color: "#0a0b0d" }}>{jobTitle}</strong> position
              has been filled. We appreciate the time you took to apply and the
              chance to learn more about your background.
            </Text>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              We'll keep your profile on file for future roles. In the meantime,
              there are other openings on AuraHire that may be a good fit.
            </Text>
          </Section>
          <Section style={{ marginTop: "24px" }}>
            <Button
              href={applicationUrl}
              style={{
                backgroundColor: "#2563eb",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "9999px",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              View application
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm -F @aurahire/api tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/email/templates/position-filled.tsx
git commit -m "feat(email): position-filled template for cascade auto-reject"
```

---

## Task 12: `OffersService.accept` — wrap in transaction with FOR UPDATE

**Files:**
- Modify: `apps/api/src/modules/offers/offers.service.ts`

- [ ] **Step 1: Inject the Drizzle client**

Add imports:
```ts
import { Inject } from "@nestjs/common";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";
import type { ApplicationsTx } from "../applications/applications.repository";
```

In the constructor add:
```ts
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
```

Also expose an `update` overload on `OffersRepository` that accepts an optional `tx`. In `apps/api/src/modules/offers/offers.repository.ts` replace the `update` method:

```ts
  async update(
    id: string,
    patch: Partial<NewOffer>,
    tx?: ApplicationsTx,
  ): Promise<Offer> {
    const exec = tx ?? this.db;
    const [row] = await exec
      .update(offersTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(offersTable.id, id))
      .returning();
    if (!row) throw new Error("Offer update failed");
    return row;
  }
```

Add the `ApplicationsTx` import to the offers repository:
```ts
import type { ApplicationsTx } from "../applications/applications.repository";
```

- [ ] **Step 2: Refactor the `accept` method**

Replace the body of `accept` (after the existing role check + initial offer/application reads) with a transactional block. The full method:

```ts
  async accept(
    user: AuthUser,
    offerId: string,
    requestMeta: RequestMeta = {},
  ): Promise<OfferDto> {
    if (user.role !== "candidate") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Candidate role required" });
    }

    const offer = await this.repo.findById(offerId);
    if (!offer) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Offer not found" });
    }
    const application = await this.applicationsRepo.findById(offer.applicationId);
    if (!application || application.candidateId !== user.id) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Offer not found" });
    }

    const job = await this.jobsRepo.findById(application.jobId);

    const updated = await this.db.transaction(async (tx) => {
      // Lock the application row so concurrent decline / Mark Hired serialise.
      const lockedApp = await this.applicationsRepo.findByIdForUpdate(
        tx as ApplicationsTx,
        offer.applicationId,
      );
      if (!lockedApp) {
        throw new NotFoundException({ code: "NOT_FOUND", message: "Offer not found" });
      }

      // Re-read the offer inside the lock to defeat racing accept/decline.
      const lockedOffer = await this.repo.findById(offerId);
      if (!lockedOffer || lockedOffer.status !== "pending") {
        throw new BadRequestException({
          code: "OFFER_NOT_PENDING",
          message: `Cannot accept offer in status '${lockedOffer?.status ?? "unknown"}'`,
        });
      }

      const updatedOffer = await this.repo.update(
        offerId,
        { status: "accepted", respondedAt: new Date() },
        tx as ApplicationsTx,
      );

      // Auto-advance app → hired (only if not already terminal). The state
      // machine permits offer → hired.
      if (lockedApp.status === "offer") {
        await this.applicationsService.transitionFromSystem(
          user,
          offer.applicationId,
          "hired",
          "Offer accepted",
          requestMeta,
          tx as ApplicationsTx,
        );
      }

      return updatedOffer;
    });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.OFFER_ACCEPTED,
      entityType: "offer",
      entityId: offerId,
      companyId: job?.companyId ?? null,
      details: { applicationId: offer.applicationId },
      ...requestMeta,
    });

    void this.notifyRecruiterDecision(offerId, "accepted").catch((err) => {
      this.logger.warn(`Notify recruiter failed: ${(err as Error).message}`);
    });

    const recruiterUserIds = Array.from(
      new Set(
        [job?.recruiterId, offer.sentBy].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    );
    void this.notifications
      .emitMany(recruiterUserIds, {
        eventType: "offer_accepted",
        scope: "personal",
        entityType: "offer",
        entityId: offerId,
        actorId: user.id,
        metadata: {
          offerId,
          applicationId: offer.applicationId,
          candidateId: application.candidateId,
          occurredAt: new Date().toISOString(),
        },
      })
      .catch((err) => {
        this.logger.warn(
          `notifications.emitMany(offer_accepted) failed: ${(err as Error).message}`,
        );
      });

    return this.toDto(updated);
  }
```

- [ ] **Step 3: Run any existing offers specs**

```bash
pnpm -F @aurahire/api vitest run src/modules/offers
```
Expected: green. If existing notifications spec mocks the offers service's `db` field, add a stub for `db.transaction` that calls the inner fn directly with `{}`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/offers/offers.service.ts apps/api/src/modules/offers/offers.repository.ts
git commit -m "feat(offers): accept() runs in transaction with FOR UPDATE on application row"
```

---

## Task 13: `OffersService.decline` — transaction + auto-transition app

**Files:**
- Modify: `apps/api/src/modules/offers/offers.service.ts`

- [ ] **Step 1: Replace the `decline` method**

```ts
  async decline(
    user: AuthUser,
    offerId: string,
    dto: DeclineOfferInput,
    requestMeta: RequestMeta = {},
  ): Promise<OfferDto> {
    if (user.role !== "candidate") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Candidate role required" });
    }

    const offer = await this.repo.findById(offerId);
    if (!offer) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Offer not found" });
    }
    const application = await this.applicationsRepo.findById(offer.applicationId);
    if (!application || application.candidateId !== user.id) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Offer not found" });
    }

    const declinedJob = await this.jobsRepo.findById(application.jobId);

    const updated = await this.db.transaction(async (tx) => {
      const lockedApp = await this.applicationsRepo.findByIdForUpdate(
        tx as ApplicationsTx,
        offer.applicationId,
      );
      if (!lockedApp) {
        throw new NotFoundException({ code: "NOT_FOUND", message: "Offer not found" });
      }

      const lockedOffer = await this.repo.findById(offerId);
      if (!lockedOffer || lockedOffer.status !== "pending") {
        throw new BadRequestException({
          code: "OFFER_NOT_PENDING",
          message: `Cannot decline offer in status '${lockedOffer?.status ?? "unknown"}'`,
        });
      }

      const updatedOffer = await this.repo.update(
        offerId,
        {
          status: "declined",
          respondedAt: new Date(),
          ...(dto.reason
            ? {
                customMessage: `${lockedOffer.customMessage ?? ""}\n\n[Candidate declined: ${dto.reason}]`.trim(),
              }
            : {}),
        },
        tx as ApplicationsTx,
      );

      // Auto-advance app → offer_declined when still at offer. Other terminal
      // states are left alone (e.g., recruiter rejected during the same window).
      if (lockedApp.status === "offer") {
        await this.applicationsService.transitionFromSystem(
          user,
          offer.applicationId,
          "offer_declined",
          "Candidate declined offer",
          requestMeta,
          tx as ApplicationsTx,
        );
      }

      return updatedOffer;
    });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: AUDIT_ACTIONS.OFFER_DECLINED,
      entityType: "offer",
      entityId: offerId,
      companyId: declinedJob?.companyId ?? null,
      details: { applicationId: offer.applicationId, reasonLength: dto.reason?.length ?? 0 },
      ...requestMeta,
    });

    void this.notifyRecruiterDecision(offerId, "declined").catch((err) => {
      this.logger.warn(`Notify recruiter failed: ${(err as Error).message}`);
    });

    const recruiterUserIds = Array.from(
      new Set(
        [declinedJob?.recruiterId, offer.sentBy].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    );
    void this.notifications
      .emitMany(recruiterUserIds, {
        eventType: "offer_declined",
        scope: "personal",
        entityType: "offer",
        entityId: offerId,
        actorId: user.id,
        metadata: {
          offerId,
          applicationId: offer.applicationId,
          candidateId: application.candidateId,
          occurredAt: new Date().toISOString(),
        },
      })
      .catch((err) => {
        this.logger.warn(
          `notifications.emitMany(offer_declined) failed: ${(err as Error).message}`,
        );
      });

    return this.toDto(updated);
  }
```

- [ ] **Step 2: Re-run offers specs**

```bash
pnpm -F @aurahire/api vitest run src/modules/offers
```
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/offers/offers.service.ts
git commit -m "feat(offers): decline() auto-transitions application to offer_declined"
```

---

## Task 14: Expire-offers cron — auto-transition application

**Files:**
- Modify: `apps/api/src/cron/expire-offers.cron.ts`
- Modify: `apps/api/src/cron/expire-offers.cron.spec.ts`

- [ ] **Step 1: Inject `ApplicationsService` + repo into the cron**

Add imports at the top:
```ts
import { ApplicationsService } from "../modules/applications/applications.service";
import { ApplicationsRepository, type ApplicationsTx } from "../modules/applications/applications.repository";
```

Add to the `constructor`:
```ts
    private readonly applicationsService: ApplicationsService,
    private readonly applicationsRepo: ApplicationsRepository,
```

Verify the cron's owning module (likely `cron.module.ts`) imports `ApplicationsModule`. If not, add it.

- [ ] **Step 2: After the bulk offer UPDATE, transition each application**

Locate the existing per-offer side-effect loop (`for (const c of candidates)`). After the in-app notify section but inside the same `try` block, add:

```ts
          // Auto-advance the application to offer_declined so it leaves the
          // recruiter's offer pipeline. Wrapped in its own transaction with
          // FOR UPDATE so a race with a recruiter action serialises.
          await this.db.transaction(async (tx) => {
            const lockedApp = await this.applicationsRepo.findByIdForUpdate(
              tx as ApplicationsTx,
              c.applicationId,
            );
            if (!lockedApp || lockedApp.status !== "offer") return;

            await this.applicationsService.transitionFromSystem(
              null,
              c.applicationId,
              "offer_declined",
              "Offer expired without response",
              {},
              tx as ApplicationsTx,
            );
          });

          // Distinct audit row so reports separate decline vs expiry causes.
          await this.audit.log({
            actorId: null,
            actorType: "system",
            action: AUDIT_ACTIONS.APPLICATION_AUTO_TRANSITION_OFFER_EXPIRED,
            entityType: "application",
            entityId: c.applicationId,
            details: {
              offerId: c.offerId,
              jobId: c.jobId,
              expiredAt: new Date().toISOString(),
            },
          });
```

- [ ] **Step 3: Update the cron spec**

Open `expire-offers.cron.spec.ts`. Add an assertion that when an expired offer is found, `applicationsService.transitionFromSystem` is called once with `"offer_declined"`. Mock the new dependencies in the existing test bed (the spec already constructs the cron — pattern-match additions to the providers list).

Skeleton of new test (append after existing tests):

```ts
  it("auto-transitions the application to offer_declined", async () => {
    // Arrange: one expired offer, app still at offer
    setupExpiredOffer({ applicationStatus: "offer" });
    const transitionSpy = jest.spyOn(applicationsService, "transitionFromSystem");

    // Act
    await cron.execute();

    // Assert
    expect(transitionSpy).toHaveBeenCalledWith(
      null,
      expect.any(String),
      "offer_declined",
      "Offer expired without response",
      {},
      expect.anything(), // tx handle
    );
  });
```

(Use the existing helpers in the spec; if they don't exist, write a minimal `setupExpiredOffer` against the same mocks the file already uses.)

- [ ] **Step 4: Run the cron spec**

```bash
pnpm -F @aurahire/api vitest run src/cron/expire-offers.cron.spec.ts
```
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/cron/expire-offers.cron.ts apps/api/src/cron/expire-offers.cron.spec.ts
git commit -m "feat(cron): expire-offers transitions application to offer_declined"
```

---

## Task 15: Recruiter pipeline — add `offer_declined` stage + filter chip

**Files:**
- Modify: `apps/web/app/(recruiter)/recruiter/applications/[id]/_decision-bar-client.tsx`
- Modify: `apps/web/app/(recruiter)/recruiter/applications/_applications-toolbar-client.tsx`
- Modify: `apps/web/app/(candidate)/candidate/applications/_applications-toolbar-client.tsx`
- Modify: `apps/web/app/(admin)/admin/applications/_filters-client.tsx`

- [ ] **Step 1: Decision-bar stage list — add `offer_declined`**

Open `_decision-bar-client.tsx`. Replace `PIPELINE_STAGES`:

```ts
const PIPELINE_STAGES: Array<{ key: string; label: string }> = [
  { key: "applied", label: "Applied" },
  { key: "screening", label: "Screening" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "offer_declined", label: "Offer Declined" },
  { key: "hired", label: "Hired" },
];
```

Update `TERMINAL_STATUSES` (no change needed — `offer_declined` is *not* terminal because re-extending is allowed; the UI handles its actions explicitly in Task 16).

- [ ] **Step 2: Recruiter list toolbar — add `Offer Declined` to the status dropdown**

In `_applications-toolbar-client.tsx`, replace:
```ts
const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];
```

With:
```ts
const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "offer_declined", label: "Offer Declined" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];
```

- [ ] **Step 3: Candidate applications toolbar — same dropdown addition**

Open `apps/web/app/(candidate)/candidate/applications/_applications-toolbar-client.tsx` and pattern-match the same change. (The candidate list also filters by status.)

- [ ] **Step 4: Admin filter — same dropdown addition**

Open `apps/web/app/(admin)/admin/applications/_filters-client.tsx` and pattern-match the same change.

- [ ] **Step 5: Type-check the web app**

```bash
pnpm -F @aurahire/web tsc --noEmit
```
Expected: no errors. (TypeScript will likely surface any switch statement that exhausts `ApplicationStatus` and now needs an `offer_declined` arm — fix each by adding the new case with a sensible label/color.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/
git commit -m "feat(web): pipeline + filter UI surfaces offer_declined status"
```

---

## Task 16: Decision bar — accepted-offer guard + offer_declined actions

**Files:**
- Modify: `apps/web/app/(recruiter)/recruiter/applications/[id]/_decision-bar-client.tsx`
- Modify: `apps/web/app/(recruiter)/recruiter/applications/[id]/page.tsx` (or its data-fetching parent — needs to pass `latestOffer.status` + `siblingInflightCount` down)

- [ ] **Step 1: Extend props on `DecisionBarClient`**

Add to `DecisionBarProps`:

```ts
  /**
   * Status of the most recently sent offer for this application, or null if
   * no offer has ever been sent. Drives the accepted-offer guard on the
   * Mark Hired button.
   */
  latestOfferStatus?: "pending" | "accepted" | "declined" | "expired" | "withdrawn" | null;
  /**
   * Number of other in-flight applications on the same job. Surfaced in the
   * hire confirmation modal so the recruiter sees the cascade impact.
   */
  siblingInflightCount?: number;
```

- [ ] **Step 2: Pipe these props in from the page**

Open `apps/web/app/(recruiter)/recruiter/applications/[id]/page.tsx` (or the wrapper that renders `<DecisionBarClient>`). After the existing application fetch, also fetch the latest offer (existing offer card already does this — pass `offer.status ?? null`) and the sibling count.

For the sibling count, the simplest path is to extend the existing application detail endpoint response. Open `apps/api/src/modules/applications/applications.service.ts` and find `getById`. In the returned DTO add a derived field:

```ts
const siblingInflightCount = await this.repo.countInflightOnJob(
  app.jobId,
  app.id,
);
```

Add the repo method (one line) — `countInflightOnJob(jobId, excludeId)` — running the same predicate as `findInflightByJobId` but with `count(*)`.

Then pass `siblingInflightCount` through the DTO chain into the page component, then into `<DecisionBarClient>`.

If extending the DTO is too disruptive, add a small dedicated endpoint:
- `GET /api/v1/applications/:id/sibling-count` returning `{ data: { count: number } }`
- Fetched client-side from the page; default render uses 0 until it loads.

Choose whichever requires fewer file changes. Prefer the DTO approach (one trip, fewer roundtrips).

- [ ] **Step 3: Render Mark Hired as disabled when latest offer is not accepted**

Inside `nextActions?.map(...)` (the action button render block), after detecting Mark Hired (`action.status === "hired"`):

```tsx
            const isMarkHired = action.status === "hired";
            const isHireBlocked =
              isMarkHired && latestOfferStatus !== "accepted";

            if (isMarkHired) {
              return (
                <button
                  key={action.status}
                  type="button"
                  disabled={isPending || isHireBlocked}
                  title={
                    isHireBlocked
                      ? "Waiting for candidate to accept the offer."
                      : undefined
                  }
                  onClick={() => {
                    if (isHireBlocked) return;
                    setHireConfirmOpen(true);
                  }}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {pending === actionKey ? <ButtonSpinner /> : <Check className="h-4 w-4" aria-hidden />}
                  <span>{action.label}</span>
                </button>
              );
            }
```

(The `setHireConfirmOpen` state + the modal itself are added in Task 17.)

- [ ] **Step 4: When `currentStatus === "offer_declined"`, swap the action set**

Right before the `nextActions?.map(...)` call, add:

```tsx
          {currentStatus === "offer_declined" && (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  router.push(`/recruiter/offers/new?applicationId=${applicationId}`)
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:opacity-60"
              >
                <Check className="h-4 w-4" aria-hidden />
                <span>Re-extend Offer</span>
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Close as Rejected?",
                    description:
                      "The application will be marked as rejected and removed from your active pipeline.",
                    confirmLabel: "Close",
                    variant: "destructive",
                  });
                  if (!ok) return;
                  await changeStatus("rejected", "reject");
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-status-danger)] bg-[var(--color-canvas)] px-3 text-sm font-medium text-[var(--color-status-danger)] transition hover:bg-[var(--color-status-danger)] hover:text-[var(--color-on-primary)] disabled:opacity-60"
              >
                <X className="h-4 w-4" aria-hidden />
                <span>Close as Rejected</span>
              </button>
            </>
          )}
```

Also update `NEXT_POSITIVE` so `offer_declined` doesn't render the default Mark Hired pair:

```ts
  offer_declined: null,
```

And make sure `TERMINAL_STATUSES` is not used to hide the new buttons — `offer_declined` is intentionally NOT in `TERMINAL_STATUSES` so the standard Reject button stays accessible when needed (or remove the standalone Reject button when our explicit "Close as Rejected" is rendered — pattern-match the existing `!isTerminal && (<Reject button>)` block and gate it with `&& currentStatus !== "offer_declined"`).

- [ ] **Step 5: Type-check**

```bash
pnpm -F @aurahire/web tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/
git commit -m "feat(web): decision bar enforces accepted-offer guard + offer_declined actions"
```

---

## Task 17: Hire confirmation modal

**Files:**
- Create: `apps/web/app/(recruiter)/recruiter/applications/[id]/_hire-confirmation-modal-client.tsx`
- Modify: `apps/web/app/(recruiter)/recruiter/applications/[id]/_decision-bar-client.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  candidateName: string;
  jobTitle: string;
  siblingInflightCount: number;
  /** Resolves with the recruiter's choice. Caller invokes the hire request. */
  onConfirm: (autoRejectOthers: boolean) => Promise<void>;
}

export function HireConfirmationModalClient({
  open,
  onOpenChange,
  candidateName,
  jobTitle,
  siblingInflightCount,
  onConfirm,
}: Props) {
  const [autoReject, setAutoReject] = useState<boolean>(siblingInflightCount > 0);
  const [working, setWorking] = useState(false);

  async function handleConfirm() {
    setWorking(true);
    try {
      await onConfirm(autoReject);
      onOpenChange(false);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (working && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md gap-0 p-6">
        <DialogHeader className="gap-2">
          <DialogTitle className="text-base font-semibold">
            Hire {candidateName}?
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[var(--color-body)]">
            This will mark {candidateName} as hired for {jobTitle}.
          </DialogDescription>
        </DialogHeader>

        {siblingInflightCount > 0 && (
          <label className="mt-4 flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-3 text-sm">
            <input
              type="checkbox"
              checked={autoReject}
              onChange={(e) => setAutoReject(e.target.checked)}
              disabled={working}
              className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
            />
            <span className="text-[var(--color-ink)]">
              Auto-reject the {siblingInflightCount} other open applicant
              {siblingInflightCount === 1 ? "" : "s"} on this job.
              <span className="mt-1 block text-xs text-[var(--color-muted)]">
                Auto-rejected candidates receive a "Position has been filled" email.
              </span>
            </span>
          </label>
        )}

        <DialogFooter className="mt-6 pt-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={working}
            className="rounded-[var(--radius-pill)] px-5"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={working}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
          >
            {working && <ButtonSpinner />}
            {working ? "Hiring…" : "Confirm Hire"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire the modal into the decision bar**

In `_decision-bar-client.tsx` add:

```tsx
import { HireConfirmationModalClient } from "./_hire-confirmation-modal-client";
```

Add state near the other `useState` declarations:
```tsx
const [hireConfirmOpen, setHireConfirmOpen] = useState(false);
```

Update `DecisionBarProps` to include the candidate + job names already passed by the parent (or accept them as new props if not — pattern-match existing usage):

```ts
  candidateName?: string;
  jobTitle?: string;
```

Add a hire executor that POSTs with the chosen `autoRejectOthers`:

```tsx
async function hireWithCascade(autoRejectOthers: boolean) {
  setPending("advance-0");
  try {
    const res = await authedFetch(
      `/api/v1/applications/${applicationId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus: "hired", autoRejectOthers }),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      toastApiError(null, "Couldn't hire candidate", body.message);
      return;
    }
    const json = (await res.json()) as {
      otherApplicationsRejected?: number;
    };
    const rejected = json.otherApplicationsRejected ?? 0;
    toastSuccess(
      "Hired",
      rejected > 0
        ? `${rejected} other applicant${rejected === 1 ? "" : "s"} auto-rejected.`
        : undefined,
    );
    router.refresh();
  } finally {
    setPending(null);
  }
}
```

Render at the bottom of the component:

```tsx
<HireConfirmationModalClient
  open={hireConfirmOpen}
  onOpenChange={setHireConfirmOpen}
  candidateName={candidateName ?? "this candidate"}
  jobTitle={jobTitle ?? "this position"}
  siblingInflightCount={siblingInflightCount ?? 0}
  onConfirm={hireWithCascade}
/>
```

- [ ] **Step 3: Type-check**

```bash
pnpm -F @aurahire/web tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/
git commit -m "feat(web): hire confirmation modal with cascade auto-reject opt-in"
```

---

## Task 18: Candidate "Offer Closed" card variant

**Files:**
- Modify: `apps/web/app/(candidate)/candidate/applications/[id]/_application-detail-client.tsx`

- [ ] **Step 1: Add a `ClosedOfferCard` component below the existing `PendingOfferCard`**

```tsx
function ClosedOfferCard({ offer, applicationStatus }: { offer: OfferRow; applicationStatus: string }) {
  const isDeclined = offer.status === "declined" || applicationStatus === "offer_declined";
  const isExpired = offer.status === "expired";

  let footerLine: string | null = null;
  if (isDeclined) {
    footerLine = offer.respondedAt
      ? `You declined this offer on ${new Date(offer.respondedAt).toLocaleDateString()}.`
      : "You declined this offer.";
  } else if (isExpired) {
    footerLine = offer.expiresAt
      ? `This offer expired on ${new Date(offer.expiresAt).toLocaleDateString()} without a response.`
      : "This offer expired without a response.";
  }

  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-6">
      <header>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Offer Closed
        </h2>
        <p className="mt-2 text-xl font-semibold text-[var(--color-ink)]">
          {offer.title}
        </p>
      </header>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wider text-[var(--color-muted)]">Salary</dt>
          <dd className="mt-1 font-mono text-base text-[var(--color-ink)]">
            {formatSalary(offer.salary, offer.salaryCurrency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-[var(--color-muted)]">Start date</dt>
          <dd className="mt-1 font-mono text-base text-[var(--color-ink)]">{offer.startDate}</dd>
        </div>
      </dl>
      {footerLine && (
        <p className="text-sm text-[var(--color-body)]">{footerLine}</p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Branch the rendering near the `<PendingOfferCard>` call site**

Find where `<PendingOfferCard offer={offer} />` is rendered. Replace with:

```tsx
{offer.status === "pending" ? (
  <PendingOfferCard offer={offer} />
) : (
  <ClosedOfferCard offer={offer} applicationStatus={application.status} />
)}
```

(The `offer` object must include `respondedAt`. If the existing fetch doesn't surface it, extend the `OfferRow` type + the API response shape — Drizzle's `Offer` already carries it.)

- [ ] **Step 3: Type-check**

```bash
pnpm -F @aurahire/web tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/
git commit -m "feat(web): candidate sees Offer Closed card after decline / expiry"
```

---

## Task 19: Manual smoke test — happy path + key edge cases

This task is a verification gate, not new code. The agent runs through the scenarios with the human (who controls the dev server).

- [ ] **Step 1: Ask the human to start `pnpm dev` from the repo root**

The agent does NOT start the dev server. Wait for the human to confirm both `apps/web` (port 3000) and `apps/api` (port 3333) are up.

- [ ] **Step 2: Walkthrough A — Decline path**

Human steps:
1. Recruiter sends an offer to a candidate on a published job.
2. Candidate opens `/candidate/applications/[id]`, clicks **Decline**, optionally enters a reason.
3. Verify the candidate page now shows "Offer Closed" + decline date.
4. Verify the recruiter page now shows the application stage chip "Offer Declined" with **Re-extend Offer** + **Close as Rejected** buttons.

- [ ] **Step 3: Walkthrough B — Mark Hired guard**

Human steps:
1. Recruiter sends an offer; candidate does NOT respond.
2. Recruiter opens the application; verify **Mark Hired** is disabled with tooltip "Waiting for candidate to accept the offer."
3. Candidate accepts.
4. Recruiter clicks **Mark Hired** — modal opens showing sibling count.
5. With "Auto-reject others" checked, confirm. Toast: "Hired. N other applicants auto-rejected."
6. Open one of the auto-rejected applications and verify status = `rejected` with audit trail showing `application.auto_rejected_position_filled`.

- [ ] **Step 4: Walkthrough C — Expiry**

Human steps:
1. Recruiter sends an offer with `expiresAt` in the past (or wait for the hourly cron).
2. After cron runs, verify candidate sees "Offer Closed — expired" and recruiter sees `Offer Declined` stage.

- [ ] **Step 5: Report findings**

Document any UX gaps in a follow-up task list. No commit required for this task.

---

## Self-Review

The plan covers each spec section:

| Spec § | Covered by tasks |
|---|---|
| §3.1 Schema enum | Tasks 1, 2 |
| §3.2 State machine | Task 3 |
| §3.3 Backend service changes | Tasks 5–13 |
| §3.4 Concurrency | Tasks 7, 8, 10, 12, 13, 14 |
| §3.5 Frontend changes | Tasks 15, 16, 17, 18 |
| §3.6 Audit + notifications | Tasks 5, 10, 14, 11 |
| §5 Tests | Tasks 3, 10, 14 (state machine, hire(), cron) |
| §6 Migration & rollout | Task 2 |

No `TBD`, `TODO`, or "implement later" placeholders remain. All code blocks are concrete. Type names are consistent across tasks: `ApplicationsTx` (Task 7) is referenced verbatim in Tasks 8, 10, 12, 13, 14. `STATUSES_REQUIRING_ACCEPTED_OFFER` (Task 3) is referenced verbatim in Task 9. `findByIdForUpdate` / `findInflightByJobId` / `findLatestByApplicationId` are used with the same signatures everywhere they appear.
