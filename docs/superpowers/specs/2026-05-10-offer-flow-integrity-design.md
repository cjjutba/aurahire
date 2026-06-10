# Offer Flow Integrity - Design

**Status:** Proposed
**Date:** 2026-05-10
**Owner:** CJ Jutba
**Touches:** `apps/api/src/modules/offers`, `apps/api/src/modules/applications`, `apps/api/src/cron/expire-offers.cron.ts`, `apps/web/app/(recruiter)/recruiter/applications/[id]`, `apps/web/app/(candidate)/candidate/applications/[id]`, `packages/db/src/enums.ts`, `packages/db/src/schema.ts`, `packages/shared/src/enums/index.ts`, `packages/shared/src/schemas/applications.ts`

---

## 1. Problem

Three integrity holes exist in the offer/hiring flow:

1. **Recruiter can Mark Hired regardless of offer state.** `ApplicationsService.updateStatus()` only consults the application state machine (`offer → hired` is allowed) and never checks whether an offer was sent or accepted. A recruiter can mark a candidate hired who declined the offer, who never received an offer, or whose offer is still pending.
2. **Candidate Decline (and offer expiry) leaves the application stuck at `offer`.** `OffersService.decline` only updates the offer row. The application status remains `offer` indefinitely, polluting recruiter pipelines and giving the candidate a confusing "Offer Extended" UI even though they declined.
3. **Marking one candidate hired does not affect other applicants on the same job.** Other open applications stay in flight, leading to mixed signals (candidates think they're still being considered after the role is filled).

A fourth latent issue - concurrent Accept ↔ Mark Hired writes - produces the right end state today but emits double notifications and double audit rows. Closing the integrity holes also requires solving the race because the new guards depend on consistent reads.

The expire-offers cron already runs hourly (`apps/api/src/cron/expire-offers.cron.ts`), so the only gap on offer expiry is propagating the expiry into the application's lifecycle.

---

## 2. Goals & non-goals

**Goals**

- Server enforces that "hired" means "candidate accepted an offer."
- Application status accurately reflects whether the deal is still in play.
- Hiring one candidate gives recruiter the option (default on) to auto-reject other applicants on the same job, with a clear notification to those candidates.
- Concurrent Accept and Mark Hired writes produce one terminal state, one audit row per actor action, and one notification per recipient.

**Non-goals**

- Redesigning offer-withdraw UX (recruiter-side `offer.status = "withdrawn"`); behavior is preserved.
- Auto-archiving the job posting when a candidate is hired.
- Adding new notification preferences (bulk-reject email piggybacks the existing `application_status_changed` event).
- Multi-offer-per-application semantics beyond what already exists (one pending offer at a time, supported by `findPendingByApplicationId`).

---

## 3. Approach

### 3.1 New application status: `offer_declined`

Add one terminal-but-revivable status. It captures both candidate decline and system-driven offer expiry. The audit log + the offer row's own `status` distinguish the cause for UI copy and reporting.

This is preferred over reusing `rejected` because `rejected` carries a recruiter-action connotation in the existing UI ("Reject" button); muddling it with candidate-driven outcomes hurts explainability - a thesis-load-bearing principle.

**Enum addition** in `packages/db/src/enums.ts`:

```ts
export const APPLICATION_STATUS = [
  "applied",
  "screening",
  "interview",
  "offer",
  "offer_declined", // NEW
  "hired",
  "rejected",
  "withdrawn",
] as const;
```

Mirror the same value in `packages/shared/src/enums/index.ts` (it re-exports from `@aurahire/db`, so this should be automatic - verify during implementation).

**Migration** - `packages/db/drizzle/0013_offer_declined_status.sql`:

`applications.status` is currently `text` constrained by Drizzle's `text({ enum })` (string list). No DB-level enum to alter. The migration is a no-op SQL file documenting the schema bump (Drizzle uses the TS-side enum at write time). If a CHECK constraint is later introduced, this is where it would live.

### 3.2 State machine update

`apps/api/src/modules/applications/state-machine.ts`:

```ts
const VALID_TRANSITIONS: Record<
  ApplicationStatus,
  readonly ApplicationStatus[]
> = {
  applied: ["screening", "interview", "rejected", "withdrawn"],
  screening: ["interview", "rejected", "withdrawn"],
  interview: ["offer", "rejected", "withdrawn"],
  offer: ["hired", "offer_declined", "rejected", "withdrawn"],
  offer_declined: ["offer", "rejected", "withdrawn"],
  hired: [],
  rejected: [],
  withdrawn: [],
};

export const STATUSES_REQUIRING_ACCEPTED_OFFER: ReadonlyArray<ApplicationStatus> =
  ["hired"];
```

Two new edges:

- `offer → offer_declined` - system action when candidate declines or offer expires.
- `offer_declined → offer` - recruiter re-extends a new offer (the existing `OffersService.create` auto-advance handles the transition).
- `offer_declined → rejected` and `offer_declined → withdrawn` - terminal closures.

The accepted-offer guard layers _on top_ of the state machine; it is checked only when transitioning into a status in `STATUSES_REQUIRING_ACCEPTED_OFFER`.

### 3.3 Backend service changes

**`OffersService.decline`** - wrap in `db.transaction` with `SELECT … FOR UPDATE` on the application row, then append app auto-transition after the offer update:

```ts
return this.db.transaction(async (tx) => {
  const app = await this.applicationsRepo.findByIdForUpdate(
    tx,
    offer.applicationId,
  );
  // re-validate ownership + offer.status === "pending"
  // update offer to declined (with reason)
  await this.applicationsService.transitionFromSystem(
    user,
    offer.applicationId,
    "offer_declined",
    "Candidate declined offer",
    requestMeta,
    tx, // pass transaction handle
  );
});
```

The lock prevents a Decline arriving in the narrow window between Accept's offer-update and Accept's app-update from observing inconsistent state.

**`OffersService.create`** - already calls `transitionFromSystem(... "offer", ...)`. With `offer_declined → offer` now valid, the same call works for the re-extend path. No code change needed; the state machine permits it.

**`ExpireOffersCron.execute`** - for each expired offer, after the offer row UPDATE, transition the app inside its own per-offer transaction (the cron processes offers in a loop; one failure should not poison sibling rows):

```ts
await this.db.transaction(async (tx) => {
  await this.applicationsRepo.findByIdForUpdate(tx, c.applicationId); // lock
  await this.applicationsService.transitionFromSystem(
    null, // system actor
    c.applicationId,
    "offer_declined",
    "Offer expired without response",
    {},
    tx,
  );
});
```

Add an audit action `application.auto_transition_offer_expired` (distinct from the candidate-driven decline path) so reports can separate the two. The cron's existing `OFFER_EXPIRED` audit row stays.

**`ApplicationsService.updateStatus`** - accepted-offer guard:

```ts
if (STATUSES_REQUIRING_ACCEPTED_OFFER.includes(dto.newStatus)) {
  const latestOffer = await this.offersRepo.findLatestByApplicationId(id);
  if (!latestOffer || latestOffer.status !== "accepted") {
    throw new BadRequestException({
      code: "OFFER_NOT_ACCEPTED",
      message: "Cannot mark hired - candidate has not accepted an offer.",
    });
  }
}
```

The check happens **inside the row-locking transaction** (see §3.4) so a concurrent accept can't slip in between the read and the write.

**`ApplicationsService.hire`** - extracted method (called from the controller when `newStatus === "hired"`):

```ts
async hire(
  user: AuthUser,
  companyId: string,
  applicationId: string,
  dto: { autoRejectOthers: boolean; note?: string },
  requestMeta: RequestMeta,
): Promise<{ application: ApplicationDto; otherApplicationsRejected: number }> {
  return this.db.transaction(async (tx) => {
    // 1. Lock + re-validate inside the transaction
    const app = await this.repo.findByIdForUpdate(tx, applicationId);
    if (!app) throw new NotFoundException(...);
    // (company ownership, state machine, accepted-offer guard - same as updateStatus)

    // 2. Hire the chosen candidate
    await this.repo.update(tx, applicationId, { status: "hired", statusUpdatedAt: now() });
    // audit: application.status_changed { from, to: "hired" }

    let rejectedCount = 0;
    if (dto.autoRejectOthers) {
      // 3. Find other in-flight apps on the same job
      const others = await this.repo.findInflightByJobId(tx, app.jobId, applicationId);
      // in-flight = status NOT IN ("hired", "rejected", "withdrawn", "offer_declined")

      for (const other of others) {
        await this.repo.update(tx, other.id, {
          status: "rejected",
          statusUpdatedAt: now(),
          recruiterNotes: this.appendNote(
            other.recruiterNotes,
            "[Auto-rejected: position filled by another candidate]",
          ),
        });
        // audit: application.auto_rejected_position_filled { hiredApplicationId, hiredCandidateId }
        rejectedCount++;
      }
    }

    return { app, others: dto.autoRejectOthers ? others : [] };
  }).then(async ({ app, others }) => {
    // 4. Outside transaction: cache busts, notifications, emails (best-effort, async)
    //    Includes one position-filled email per affected candidate.
    return { application: this.toDto(applicationId), otherApplicationsRejected: others.length };
  });
}
```

Notes:

- Side effects (cache bust, realtime emit, email send, in-app notify) happen **after commit**, not inside the transaction. A failed email must not roll back the hire.
- The bulk-reject loop is a tight `for` rather than a single `UPDATE` because each row needs a distinct audit row and notification; the loop is bounded by typical job applicant counts (sprint scale: tens, not thousands).

**`OffersService.accept`** - wrap in the same transaction shape, locking the application row before reading offer status. The candidate path becomes:

```ts
return this.db.transaction(async (tx) => {
  const app = await this.applicationsRepo.findByIdForUpdate(
    tx,
    offer.applicationId,
  );
  // re-validate offer is still pending
  // update offer to accepted
  // transition app to hired (already in transaction; transitionFromSystem must accept tx)
});
```

Side effects (audit write, recruiter email, in-app notify) happen after commit.

**Endpoint change** - `PATCH /applications/:id/status`:

DTO extension in `packages/shared/src/schemas/applications.ts`:

```ts
export const updateApplicationStatusSchema = z.object({
  newStatus: z.enum(APPLICATION_STATUS),
  note: z.string().max(2000).optional(),
  autoRejectOthers: z.boolean().optional(), // NEW; honored only when newStatus === "hired"
});
```

Response shape extension when `newStatus === "hired"`:

```ts
{
  application: ApplicationDto,
  otherApplicationsRejected: number  // NEW field, 0 if autoRejectOthers !== true
}
```

For all other status transitions, the response keeps its current shape (returns the `ApplicationDto` directly). The controller branches on `newStatus === "hired"` and calls `hire()` instead of `updateStatus()`.

**`OffersRepository.findLatestByApplicationId`** - new method returning the most recent offer (by `sentAt DESC`) for an application, or null. Used by the accepted-offer guard.

**`ApplicationsRepository.findByIdForUpdate(tx, id)`** - new method using `SELECT … FOR UPDATE` via Drizzle's `.for("update")`.

**`ApplicationsRepository.findInflightByJobId(tx, jobId, excludeId)`** - new method returning all applications on a job whose status is not in (`hired`, `rejected`, `withdrawn`, `offer_declined`), excluding the one passed in.

**`ApplicationsService.transitionFromSystem` signature change** - accept an optional final `tx?: DrizzleTransaction` parameter. When passed, the auto-transition's UPDATE + audit row writes to the transaction handle instead of the root `db` client. Existing call sites (offers `accept`, `create`, etc.) pass `tx` when they themselves run in a transaction; the cron does the same. Backward-compatible: omitting the argument falls back to the existing root-client behavior.

### 3.4 Concurrency strategy

Both write paths into `applications` for hire-related transitions (`OffersService.accept` and `ApplicationsService.hire`) are wrapped in `db.transaction` with `SELECT … FOR UPDATE` on the application row at the top of the block. Postgres serializes them naturally:

- **Candidate Accept wins:** offer becomes `accepted`, app becomes `hired`, transaction commits. Recruiter Mark Hired then acquires the lock, reads `app.status = "hired"`, fails the state-machine check (`hired → hired` is invalid), returns `INVALID_STATUS_TRANSITION`. UI shows "Already hired."
- **Recruiter Mark Hired wins:** app becomes `hired`. Candidate Accept then acquires the lock, reads `app.status = "hired"`, the offer accept proceeds (offer row update is independent), but the embedded `transitionFromSystem(... "hired" ...)` call is a no-op (state machine rejects the transition; `transitionFromSystem` swallows it via the existing try/catch and warning log).

Either path yields exactly one application UPDATE that matters and one set of side-effect notifications.

This avoids a version column and retry loop - both add complexity disproportionate to the contention level (one application, one candidate accept, at most a handful of recruiters per company per second).

### 3.5 Frontend changes

**Recruiter `_decision-bar-client.tsx`**

Pass `latestOffer.status` from the server-rendered application page (already loaded for the offer card) into the client component. Two new behaviors:

- **App at `offer` AND `latestOffer.status !== "accepted"`** - Mark Hired button rendered as `disabled` with a tooltip: _"Waiting for candidate to accept the offer."_ Reject button stays enabled.
- **App at `offer_declined`** - replace the `[Mark Hired] [Reject]` button pair with `[Re-extend Offer] [Close as Rejected]`. "Re-extend Offer" opens the existing offer creation modal pre-filled with the prior offer's terms (title, salary, start date, manager) so the recruiter can adjust. "Close as Rejected" calls `PATCH /applications/:id/status` with `newStatus: "rejected"`.

**Recruiter Hire confirmation modal** - new file `apps/web/components/recruiter/hire-confirmation-modal.tsx`:

```
┌───────────────────────────────────────────────┐
│  Hire Christian Jutba?                        │
│                                               │
│  This will mark Christian as hired and        │
│  ☑ Auto-reject the 47 other open applicants   │
│      on Staff Backend Engineer.               │
│                                               │
│  Auto-rejected candidates receive a           │
│  "Position has been filled" email.            │
│                                               │
│         [ Cancel ]  [ Confirm Hire ]          │
└───────────────────────────────────────────────┘
```

The recruiter can uncheck the auto-reject box. On Confirm, the client calls the status endpoint with `{ newStatus: "hired", autoRejectOthers: <checkbox state> }` and shows a success toast: _"Christian Jutba hired. 47 other applicants auto-rejected."_ (count omitted if 0 or auto-reject was unchecked).

The "47 other open applicants" count comes from a small new endpoint `GET /applications/:id/sibling-count` (or is added to the existing application detail payload). Choose whichever requires fewer changes during implementation.

**Candidate `/candidate/applications/[id]`** - when `app.status === "offer_declined"`:

Replace the "OFFER EXTENDED" card with an "OFFER CLOSED" card that shows the offer terms (read-only) and one of two footers based on `offer.status`:

- `declined` → "You declined this offer on May 10, 2026." (+ the candidate's reason if provided)
- `expired` → "This offer expired on May 24, 2026 without a response."

No action buttons.

**Recruiter pipeline** - kanban + filter chips (`apps/web/app/(recruiter)/recruiter/applications/`):

- Add a new column `"Offer Declined"` between `"Offer"` and `"Hired"`.
- Add a filter chip `"Offer Declined"` to the list-view filter set.
- Pipeline counts naturally exclude `offer_declined` from the "active offers" total because they are computed from `app.status`.

**Status chip token** - new variant in `apps/web/components/ui/status-chip.tsx`:

`offer_declined` → background `{colors.score-mid-soft}` (amber), text `{colors.score-mid}` (amber), label `"Offer Declined"`. Slots between `Offer` (info-blue) and `Rejected` (danger-red).

### 3.6 Audit + notifications

**New audit actions** in `apps/api/src/audit/audit.types.ts`:

```ts
APPLICATION_AUTO_TRANSITION_OFFER_DECLINED: "application.auto_transition_offer_declined",
APPLICATION_AUTO_TRANSITION_OFFER_EXPIRED:  "application.auto_transition_offer_expired",
APPLICATION_AUTO_REJECTED_POSITION_FILLED:  "application.auto_rejected_position_filled",
```

Each carries enough metadata to reconstruct the cause:

- `offer_declined`: `{ offerId, applicationId }`
- `offer_expired`: `{ offerId, applicationId, expiresAt }`
- `auto_rejected_position_filled`: `{ hiredApplicationId, hiredCandidateId, jobId }`

**New email template** - `apps/api/src/email/templates/position-filled.tsx`:

Subject: `Update on your application - {{jobTitle}} at {{companyName}}`
Body: warm, neutral copy explaining that another candidate was selected; thanks them for applying; offers a link to browse other open roles.

**Notification reuse** - bulk-rejected candidates receive one `application_status_changed` notification with `metadata.reason = "position_filled"` and `metadata.hiredJobTitle = "..."`. The notifications panel can render a slightly different copy for this reason without needing a new event type.

---

## 4. Components & ownership

| File                                                                            | Change                                                                                                |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `packages/db/src/enums.ts`                                                      | Add `offer_declined` to `APPLICATION_STATUS`                                                          |
| `packages/db/drizzle/0013_offer_declined_status.sql`                            | New migration (no-op DDL with comment)                                                                |
| `apps/api/src/modules/applications/state-machine.ts`                            | Add `offer_declined` row + edges; export `STATUSES_REQUIRING_ACCEPTED_OFFER`                          |
| `apps/api/src/modules/applications/applications.repository.ts`                  | Add `findByIdForUpdate(tx, id)`, `findInflightByJobId(tx, jobId, excludeId)`                          |
| `apps/api/src/modules/applications/applications.service.ts`                     | New `hire()` method; `updateStatus()` gets accepted-offer guard; controller routes hire to new method |
| `apps/api/src/modules/applications/applications.controller.ts`                  | DTO accepts `autoRejectOthers`; response shape extended for hire                                      |
| `apps/api/src/modules/offers/offers.repository.ts`                              | Add `findLatestByApplicationId(appId)`                                                                |
| `apps/api/src/modules/offers/offers.service.ts`                                 | Wrap `accept` in transaction; `decline` triggers app auto-transition                                  |
| `apps/api/src/cron/expire-offers.cron.ts`                                       | Per expired offer, transition app to `offer_declined`                                                 |
| `apps/api/src/audit/audit.types.ts`                                             | Three new audit action constants                                                                      |
| `apps/api/src/email/templates/position-filled.tsx`                              | New email template                                                                                    |
| `packages/shared/src/schemas/applications.ts`                                   | DTO accepts `autoRejectOthers`; response type extended                                                |
| `apps/web/components/recruiter/hire-confirmation-modal.tsx`                     | New modal                                                                                             |
| `apps/web/app/(recruiter)/recruiter/applications/[id]/_decision-bar-client.tsx` | Disabled state, `offer_declined` action set, modal launch                                             |
| `apps/web/app/(candidate)/candidate/applications/[id]/page.tsx`                 | "Offer Closed" variant of card                                                                        |
| `apps/web/components/ui/status-chip.tsx`                                        | `offer_declined` variant                                                                              |
| `apps/web/app/(recruiter)/recruiter/applications/_pipeline.tsx` (or equivalent) | New column + filter chip                                                                              |

---

## 5. Tests

**Unit - state machine** (`state-machine.spec.ts`):

- `canTransition("offer", "offer_declined")` → true
- `canTransition("offer_declined", "offer")` → true
- `canTransition("offer_declined", "rejected")` → true
- `canTransition("offer_declined", "hired")` → false
- All other transitions out of `offer_declined` to non-allowed states → false

**Unit - applications service**:

- `updateStatus` with `newStatus: "hired"` and no offer → throws `OFFER_NOT_ACCEPTED`
- `updateStatus` with `newStatus: "hired"` and offer in `pending` → throws `OFFER_NOT_ACCEPTED`
- `updateStatus` with `newStatus: "hired"` and offer in `declined` → throws `OFFER_NOT_ACCEPTED`
- `hire()` with `autoRejectOthers: true` rejects all other in-flight apps; emits one audit row each
- `hire()` with `autoRejectOthers: false` leaves other apps untouched
- `hire()` skips already-terminal applications (`rejected`, `withdrawn`, `hired`, `offer_declined`)

**Unit - offers service**:

- `decline` transitions app from `offer` to `offer_declined`
- `accept` transitions app from `offer` to `hired` (existing test, verify still passes)
- Concurrent `accept` + recruiter `hire()` simulated via parallel promises → exactly one ends in `hired`, the other returns `INVALID_STATUS_TRANSITION`

**Cron** (`expire-offers.cron.spec.ts` extension):

- Expired offer triggers app transition to `offer_declined`
- App already in non-`offer` state when cron fires → transition skipped (logged but no error)

**Integration - controller**:

- `PATCH /applications/:id/status` body `{ newStatus: "hired", autoRejectOthers: true }` returns `{ application, otherApplicationsRejected: N }`
- Same body without an accepted offer → 400 `OFFER_NOT_ACCEPTED`

---

## 6. Migration & rollout

1. Apply migration `0013_offer_declined_status.sql` (Drizzle: schema bump only, no DDL).
2. Deploy backend with the new state machine + guards.
3. Deploy frontend with the new chip variant, modal, and offer-closed card.
4. No existing data carries `offer_declined` status, so no backfill is required.
5. Existing applications stuck at `offer` (with declined or expired offers) can be optionally backfilled by a one-time admin script - out of scope for this design but trivial to write later.

---

## 7. Open questions (for plan stage)

- Should the recruiter modal's "Auto-reject others" checkbox state persist as a per-recruiter preference? Probably not for sprint scope.
- Should the "Position has been filled" email be debounced if a recruiter hires multiple candidates on the same job within minutes? Edge case; defer.
- Should the sibling-applicants count for the modal come from a new `GET /applications/:id/sibling-count` endpoint or be added to the application detail payload? Plan stage picks based on which file requires fewer changes.
