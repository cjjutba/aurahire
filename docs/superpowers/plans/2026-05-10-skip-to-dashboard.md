# Skip-to-Dashboard from Analyzing - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Skip to dashboard" affordance on `/onboarding/candidate/analyzing` that lets the candidate proceed to `/candidate` while match-preview computation continues in the background. Make the dashboard's pending and failure states calm and self-healing so a skipped candidate is never stranded.

**Architecture:** Frontend-heavy slice. The reducer state machine in `_analyzing-client.tsx` already has a `REDIRECT` action - the skip button dispatches it and uses `router.replace()` (not `push`) so `/analyzing` is dropped from history. A small backend endpoint `POST /candidate-profiles/me/onboarding/skipped-analyzing` records an audit row for thesis-defense data ("how often candidates skip, at what point"). The dashboard's `ProfileScoreCardClient` and the `RecommendedForYouSection` gain a 30-second pending-then-error timeout so a wedged AI call surfaces a calm retry path rather than an infinite shimmer. A new layout-level guard at `apps/web/app/onboarding/layout.tsx` redirects already-completed candidates forward to `/candidate` so back-button presses can't land on stale onboarding pages.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Zod schemas in `@aurahire/shared`, NestJS + nestjs-zod DTOs, Drizzle ORM, Vitest for FE unit tests, Vitest for BE service spec, TanStack Query (existing), Supabase Realtime (existing). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-10-skip-to-dashboard-design.md` is authoritative. When in doubt, defer to that spec.

---

## File Structure

### New files

- `apps/api/src/modules/candidate-profiles/dto/onboarding-skipped.dto.ts` - `nestjs-zod` DTO wrapping the new shared schema.

### Modified files

- `packages/shared/src/schemas/onboarding.ts` - add `onboardingSkippedAnalyzingSchema` Zod schema and inferred `OnboardingSkippedAnalyzing` type.
- `packages/shared/src/index.ts` - re-export the new schema and type (auto-handled by the `schemas` barrel re-export; verify).
- `apps/api/src/audit/audit.types.ts` - add `USER_ONBOARDING_SKIPPED_ANALYZING` to the `AUDIT_ACTIONS` constant.
- `apps/api/src/modules/candidate-profiles/candidate-profiles.controller.ts` - add `POST me/onboarding/skipped-analyzing` endpoint.
- `apps/api/src/modules/candidate-profiles/candidate-profiles.service.ts` - add `recordOnboardingSkipped(user, payload, requestMeta)` method.
- `apps/api/src/modules/candidate-profiles/candidate-profiles.service.spec.ts` - add unit test for the new method.
- `apps/web/app/onboarding/layout.tsx` - add `profileCompleted=true` redirect to `/candidate`.
- `apps/web/app/onboarding/candidate/analyzing/_analyzing-client.tsx` - add `canSkip(state)` exported helper, skip button JSX, click handler with audit fire + `router.replace`. Switch the auto-redirect's `router.push` to `router.replace` for symmetry.
- `apps/web/app/onboarding/candidate/analyzing/_analyzing-client.test.tsx` - add unit tests for `canSkip(state)`.
- `apps/web/app/(candidate)/candidate/_components/profile-score-card-client.tsx` - add 30-second shimmer-then-error transition with a `[Try again]` button wired to the existing recompute mutation.
- `apps/web/app/(candidate)/candidate/_dashboard-client.tsx` - add inline `· N of 5 ready` counter on the `Recommended for You` section header, and a 30-second stall handler that drops shimmer placeholder slots + shows a small "Some matches couldn't be loaded - browse all jobs →" caption.

### Untouched (intentionally)

- `apps/api/src/modules/candidate-profiles/candidate-profiles.module.ts` - no new providers needed; `AuditService` is already injected into the service.
- `packages/db/**` - no schema, RLS, or migration changes.
- All other backend modules (scoring, queue, resumes, …) - unchanged.
- `apps/web/app/(candidate)/candidate/profile/page.tsx` and `_profile-score-dashboard-client.tsx` - the deep-dive view receives a non-null `data` prop from its server component, so the null-state shimmer-then-error path never runs there. No change.
- The existing 10-second `ANALYZING_SCREEN_WALLCLOCK_MS` cap - unchanged. Skip is purely additive.

---

## Conventions used in every step

- **Brand tokens only:** `var(--color-primary)`, `var(--color-primary-active)`, `var(--color-ink)`, `var(--color-body)`, `var(--color-muted)`, `var(--color-canvas)`, `var(--color-surface-soft)`, `var(--color-surface-strong)`, `var(--color-hairline)`, `var(--color-status-danger)`. No raw hex.
- **Radius tokens:** `var(--radius-pill)` for buttons, `var(--radius-lg)` and `var(--radius-xl)` for cards (match the existing surface).
- **Strict TS:** no `any`, no `as` casts beyond what an existing file already had.
- **Engineer cannot run dev servers, migrations, or deploys** (per `CLAUDE.md` Hard Rules). Verification is `pnpm tsc --noEmit`, `pnpm lint`, targeted `pnpm vitest run <path>`, and a manual browser smoke-test by the human.
- **Each task ends with a commit step.** Commits are atomic per task; co-author trailer per `CLAUDE.md` template.
- **Audit string:** `"user.onboarding.skipped_analyzing"` (already typed as `string` in `AuditAction`; the `AUDIT_ACTIONS` constant is the canonical home).

---

## Task 1: Add the shared Zod schema for the skip-tracking payload

**Files:**

- Modify: `packages/shared/src/schemas/onboarding.ts`

**What:** Adds the request-body schema that both the frontend `clientApiFetch` call and the backend `nestjs-zod` DTO will consume. Single source of truth.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/schemas/onboarding.test.ts` if it doesn't already exist (check first with `ls packages/shared/src/schemas/onboarding.test.ts`). If it doesn't exist, create with this content:

```ts
import { describe, expect, it } from "vitest";

import { onboardingSkippedAnalyzingSchema } from "./onboarding";

describe("onboardingSkippedAnalyzingSchema", () => {
  it("accepts a valid payload with score_ready=true and previews_ready in 0..5", () => {
    const parsed = onboardingSkippedAnalyzingSchema.parse({
      scoreReady: true,
      previewsReady: 3,
    });
    expect(parsed).toEqual({ scoreReady: true, previewsReady: 3 });
  });

  it("accepts previewsReady=0 (skip happened the moment score landed)", () => {
    const parsed = onboardingSkippedAnalyzingSchema.parse({
      scoreReady: true,
      previewsReady: 0,
    });
    expect(parsed.previewsReady).toBe(0);
  });

  it("accepts previewsReady=5 (skip happened after all five matches landed but before auto-redirect)", () => {
    const parsed = onboardingSkippedAnalyzingSchema.parse({
      scoreReady: true,
      previewsReady: 5,
    });
    expect(parsed.previewsReady).toBe(5);
  });

  it("rejects previewsReady > 5", () => {
    expect(() =>
      onboardingSkippedAnalyzingSchema.parse({
        scoreReady: true,
        previewsReady: 6,
      }),
    ).toThrow();
  });

  it("rejects negative previewsReady", () => {
    expect(() =>
      onboardingSkippedAnalyzingSchema.parse({
        scoreReady: true,
        previewsReady: -1,
      }),
    ).toThrow();
  });

  it("rejects non-integer previewsReady", () => {
    expect(() =>
      onboardingSkippedAnalyzingSchema.parse({
        scoreReady: true,
        previewsReady: 2.5,
      }),
    ).toThrow();
  });

  it("rejects missing fields", () => {
    expect(() => onboardingSkippedAnalyzingSchema.parse({})).toThrow();
  });
});
```

If the test file already exists, append the `describe("onboardingSkippedAnalyzingSchema", …)` block to it.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @aurahire/shared vitest run src/schemas/onboarding.test.ts
```

Expected: FAIL with `Cannot find name 'onboardingSkippedAnalyzingSchema'` or similar.

- [ ] **Step 3: Add the schema**

Open `packages/shared/src/schemas/onboarding.ts` and append at the end of the file (after the last `recruiterFocusSchema` block, line ~67):

```ts
// ============================================================================
// CANDIDATE ONBOARDING - analyzing-screen skip telemetry (Skip-to-Dashboard)
// ============================================================================

/**
 * Body of `POST /candidate-profiles/me/onboarding/skipped-analyzing`.
 *
 * Fired by the analyzing screen when the candidate clicks the manual
 * "Skip to dashboard" link. Pure telemetry: lets us measure how often the
 * skip is exercised and at what stage of preview-streaming it happens. The
 * endpoint records an audit row and returns 204; it has no scoring side
 * effects.
 */
export const onboardingSkippedAnalyzingSchema = z.object({
  /** True if the Profile Score had landed (state was past `computingProfileScore`)
   * by the time the candidate clicked Skip. False only on the degraded path. */
  scoreReady: z.boolean(),
  /** How many `match-preview.created` events had ticked into the reducer
   * by the time of the skip. Capped at 5 because the precompute target is 5. */
  previewsReady: z.number().int().min(0).max(5),
});

export type OnboardingSkippedAnalyzing = z.infer<
  typeof onboardingSkippedAnalyzingSchema
>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm --filter @aurahire/shared vitest run src/schemas/onboarding.test.ts
```

Expected: PASS, all tests in the new `describe` block green.

- [ ] **Step 5: Verify the export is reachable from `@aurahire/shared`**

Open `packages/shared/src/index.ts` and confirm there is a barrel re-export from `./schemas/onboarding` (or from `./schemas`). If absent, add:

```ts
export * from "./schemas/onboarding";
```

to the appropriate location. Then run:

```bash
pnpm --filter @aurahire/shared tsc --noEmit
```

Expected: clean exit.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/schemas/onboarding.ts packages/shared/src/schemas/onboarding.test.ts packages/shared/src/index.ts
git commit -m "$(cat <<'EOF'
feat(shared): onboardingSkippedAnalyzingSchema for skip telemetry

Adds the Zod schema + inferred type for the new
POST /candidate-profiles/me/onboarding/skipped-analyzing payload. Drives
the backend nestjs-zod DTO and the frontend clientApiFetch body so both
sides share a single source of truth.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add the audit action constant

**Files:**

- Modify: `apps/api/src/audit/audit.types.ts`

**What:** Adds `USER_ONBOARDING_SKIPPED_ANALYZING` to `AUDIT_ACTIONS`. The action string is what the service writes; the constant exists for discoverability and grep-ability across the codebase.

- [ ] **Step 1: Modify the constant**

In `apps/api/src/audit/audit.types.ts`, find the `AUDIT_ACTIONS` constant (starts at line 32). Add a new entry inside the user-related cluster - insert after line 33's `USER_REGISTERED_CANDIDATE: "user.registered.candidate",`:

```ts
  USER_REGISTERED_CANDIDATE: "user.registered.candidate",
  USER_ONBOARDING_SKIPPED_ANALYZING: "user.onboarding.skipped_analyzing",
  USER_REGISTERED_RECRUITER: "user.registered.recruiter",
```

- [ ] **Step 2: Verify type-check**

Run:

```bash
pnpm --filter @aurahire/api tsc --noEmit
```

Expected: clean exit. (No callers exist yet - that's Task 4.)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/audit/audit.types.ts
git commit -m "$(cat <<'EOF'
feat(api): add user.onboarding.skipped_analyzing audit action

Vocabulary entry for the audit row written when a candidate clicks the
manual Skip on the analyzing screen.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add the `nestjs-zod` DTO for the skip-tracking endpoint

**Files:**

- Create: `apps/api/src/modules/candidate-profiles/dto/onboarding-skipped.dto.ts`

**What:** A one-line `createZodDto` wrapper around the shared schema. Mirrors the pattern in `dto/personal.dto.ts`.

- [ ] **Step 1: Create the file**

Write `apps/api/src/modules/candidate-profiles/dto/onboarding-skipped.dto.ts` with this exact content:

```ts
import { createZodDto } from "nestjs-zod";
import { onboardingSkippedAnalyzingSchema } from "@aurahire/shared";

export class OnboardingSkippedAnalyzingDto extends createZodDto(
  onboardingSkippedAnalyzingSchema,
) {}
```

- [ ] **Step 2: Verify type-check**

Run:

```bash
pnpm --filter @aurahire/api tsc --noEmit
```

Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/candidate-profiles/dto/onboarding-skipped.dto.ts
git commit -m "$(cat <<'EOF'
feat(api): OnboardingSkippedAnalyzingDto

nestjs-zod DTO wrapping the shared schema for the Skip telemetry endpoint.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add the service method that records the skip audit row

**Files:**

- Modify: `apps/api/src/modules/candidate-profiles/candidate-profiles.service.ts`
- Modify: `apps/api/src/modules/candidate-profiles/candidate-profiles.service.spec.ts`

**What:** A new public method `recordOnboardingSkipped(user, payload, requestMeta)` that asserts the user is a candidate, fires one audit log row, and returns void. Mirrors the existing `complete(user, requestMeta)` pattern (which similarly is a thin audit-only wrapper).

- [ ] **Step 1: Read the existing spec file to learn the test pattern**

Read `apps/api/src/modules/candidate-profiles/candidate-profiles.service.spec.ts` end-to-end. Note:

- How the `AuditService` mock is constructed (`audit.log` typically a `jest.fn()` / `vi.fn()`).
- How `assertCandidate` is exercised (callers pass a candidate `AuthUser`).
- How `requestMeta` is forwarded.

You'll mirror that pattern in Step 5.

- [ ] **Step 2: Write the failing service-spec test**

In `candidate-profiles.service.spec.ts`, find the existing `describe("CandidateProfilesService", …)` block. Inside it, add a new nested `describe` near the existing `describe("complete", …)` block:

```ts
describe("recordOnboardingSkipped", () => {
  it("writes an audit row with the skip telemetry payload and returns void", async () => {
    const user = {
      id: "candidate-uuid",
      role: "candidate",
    } as unknown as AuthUser;
    const requestMeta = { ipAddress: "127.0.0.1", userAgent: "vitest" };

    await service.recordOnboardingSkipped(
      user,
      { scoreReady: true, previewsReady: 3 },
      requestMeta,
    );

    expect(audit.log).toHaveBeenCalledWith({
      actorId: "candidate-uuid",
      actorType: "user",
      action: "user.onboarding.skipped_analyzing",
      entityType: "candidate_profile",
      entityId: "candidate-uuid",
      details: { scoreReady: true, previewsReady: 3 },
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });
  });

  it("rejects non-candidate users", async () => {
    const user = {
      id: "recruiter-uuid",
      role: "recruiter",
    } as unknown as AuthUser;
    await expect(
      service.recordOnboardingSkipped(
        user,
        { scoreReady: true, previewsReady: 0 },
        {},
      ),
    ).rejects.toThrow();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
```

If `AuthUser` is not yet imported at the top of the spec file, add `import type { AuthUser } from "@aurahire/shared";` to the imports.

- [ ] **Step 3: Run the test to verify it fails**

Run:

```bash
pnpm --filter @aurahire/api vitest run src/modules/candidate-profiles/candidate-profiles.service.spec.ts -t "recordOnboardingSkipped"
```

Expected: FAIL with `service.recordOnboardingSkipped is not a function` or similar.

- [ ] **Step 4: Add the service method**

In `apps/api/src/modules/candidate-profiles/candidate-profiles.service.ts`, find the `complete(user, requestMeta)` method (around line 200). Immediately after it (just before the existing `completeOnboarding` method, around line 219 in the current file), insert:

```ts
  /**
   * Records an audit row when the candidate manually clicks "Skip to
   * dashboard" on the analyzing screen. Pure telemetry - no DB writes
   * besides the audit log, no scoring side effects, no notifications.
   *
   * Returns void. Callers should fire-and-forget; a failing audit write
   * must never block the candidate's navigation.
   */
  async recordOnboardingSkipped(
    user: AuthUser,
    payload: { scoreReady: boolean; previewsReady: number },
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<void> {
    this.assertCandidate(user);

    void this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "user.onboarding.skipped_analyzing",
      entityType: "candidate_profile",
      entityId: user.id,
      details: { scoreReady: payload.scoreReady, previewsReady: payload.previewsReady },
      ...requestMeta,
    });
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
pnpm --filter @aurahire/api vitest run src/modules/candidate-profiles/candidate-profiles.service.spec.ts -t "recordOnboardingSkipped"
```

Expected: PASS, both new tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/candidate-profiles/candidate-profiles.service.ts apps/api/src/modules/candidate-profiles/candidate-profiles.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): CandidateProfilesService.recordOnboardingSkipped

Writes an audit row capturing the Skip telemetry (scoreReady,
previewsReady). Asserts the actor is a candidate; fire-and-forget so a
flaky audit write cannot block the navigation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add the controller endpoint

**Files:**

- Modify: `apps/api/src/modules/candidate-profiles/candidate-profiles.controller.ts`

**What:** Adds `POST me/onboarding/skipped-analyzing` returning 204. Authenticated, candidate-only.

- [ ] **Step 1: Add the import**

At the top of `apps/api/src/modules/candidate-profiles/candidate-profiles.controller.ts`, add the new DTO import alongside the others (preserving alphabetical order with the existing imports):

```ts
import { OnboardingSkippedAnalyzingDto } from "./dto/onboarding-skipped.dto";
```

- [ ] **Step 2: Add the endpoint method**

Inside the `CandidateProfilesController` class, just before the `private requestMeta(req: FastifyRequest)` helper at the bottom, add:

```ts
  @Post("me/onboarding/skipped-analyzing")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("candidate")
  @ApiOperation({
    summary: "Record that the candidate skipped the analyzing screen",
    description:
      "Pure telemetry. Writes an audit row capturing whether the Profile Score had landed and how many match-preview events had streamed in by the time of the skip. Returns 204.",
  })
  @ApiResponse({ status: 204, description: "Skip recorded" })
  async recordOnboardingSkipped(
    @CurrentUser() user: AuthUser,
    @Body() dto: OnboardingSkippedAnalyzingDto,
    @Req() req: FastifyRequest,
  ): Promise<void> {
    await this.service.recordOnboardingSkipped(
      user,
      { scoreReady: dto.scoreReady, previewsReady: dto.previewsReady },
      this.requestMeta(req),
    );
  }
```

- [ ] **Step 3: Verify type-check + lint**

Run in parallel:

```bash
pnpm --filter @aurahire/api tsc --noEmit
pnpm --filter @aurahire/api lint
```

Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/candidate-profiles/candidate-profiles.controller.ts
git commit -m "$(cat <<'EOF'
feat(api): POST candidate-profiles/me/onboarding/skipped-analyzing

Telemetry endpoint for the analyzing-screen Skip button. Returns 204.
Wraps the new CandidateProfilesService.recordOnboardingSkipped.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Layout-level guard - redirect completed candidates away from `/onboarding/*`

**Files:**

- Modify: `apps/web/app/onboarding/layout.tsx`

**What:** Today the layout only redirects unauthenticated users to `/login`. After this task, candidates with `profileCompleted = true` who somehow land back inside `/onboarding/*` (browser back, stale bookmark) get bounced forward to `/candidate`. Recruiters with completed onboarding similarly bounce to `/recruiter`. This closes the back-button hole opened by Task 8's `router.replace`.

- [ ] **Step 1: Update the layout**

Open `apps/web/app/onboarding/layout.tsx`. Replace the body of `OnboardingLayout` so the post-`getCurrentProfile` block reads:

```tsx
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = (await getCurrentProfile()) as {
    id: string;
    role: string;
    profileCompleted: boolean;
  } | null;
  if (!profile) redirect("/login");

  // Candidates / recruiters who already finished onboarding never need to
  // re-enter the wizard. A back-button press from /candidate or a stale
  // bookmark would otherwise re-render the wizard's loading shells against
  // an already-complete profile. Send them forward to their portal home.
  if (profile.profileCompleted) {
    if (profile.role === "candidate") redirect("/candidate");
    if (profile.role === "recruiter") redirect("/recruiter");
    // Fall through for admin or unexpected roles - render the layout so any
    // unusual state surfaces normally rather than silently 302.
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)]">
      {/* Header - centered AuraHire wordmark, matches the auth shell. */}
      <header className="border-b border-[var(--color-hairline-soft)] bg-[var(--color-canvas)]">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-center px-4 sm:px-6">
          <Link href="/" aria-label="AuraHire home" className="inline-flex">
            <BrandWordmark size="md" />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <AuthFooter />
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check + lint**

Run in parallel:

```bash
pnpm --filter @aurahire/web tsc --noEmit
pnpm --filter @aurahire/web lint
```

Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/onboarding/layout.tsx
git commit -m "$(cat <<'EOF'
feat(web): redirect completed users away from /onboarding/*

Closes the back-button hole: candidates and recruiters who already have
profileCompleted=true bounce forward to their portal home rather than
re-rendering the wizard's loading shells.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add the `canSkip(state)` helper + tests on the analyzing reducer

**Files:**

- Modify: `apps/web/app/onboarding/candidate/analyzing/_analyzing-client.tsx`
- Modify: `apps/web/app/onboarding/candidate/analyzing/_analyzing-client.test.tsx`

**What:** Exports a tiny pure function `canSkip(state)` that returns `true` for the three reducer states where the Skip button should be visible: `profileScoreReady`, `streamingPreviews`, `profileScoreDegraded`. Hidden everywhere else (initial computing, error, validation error, redirecting). Pure function so it's testable without mounting the component.

- [ ] **Step 1: Write the failing test**

Open `apps/web/app/onboarding/candidate/analyzing/_analyzing-client.test.tsx`. Add at the bottom, after the closing `});` of `describe("analyzingReducer", …)`:

```ts
import { canSkip } from "./_analyzing-client";

describe("canSkip", () => {
  it("is false during the initial computing state", () => {
    expect(canSkip({ kind: "computingProfileScore" })).toBe(false);
  });

  it("is true once the Profile Score is ready", () => {
    expect(
      canSkip({ kind: "profileScoreReady", score: SCORE, readyAt: NOW }),
    ).toBe(true);
  });

  it("is true while match previews are streaming", () => {
    expect(
      canSkip({
        kind: "streamingPreviews",
        score: SCORE,
        readyAt: NOW,
        previewCount: 2,
      }),
    ).toBe(true);
  });

  it("is true on the degraded path so the candidate can leave the spinner", () => {
    expect(canSkip({ kind: "profileScoreDegraded" })).toBe(true);
  });

  it("is false in the unrecoverable error state", () => {
    expect(canSkip({ kind: "error", message: "Network down" })).toBe(false);
  });

  it("is false in the validation-error state - the user must fix the wizard step", () => {
    expect(
      canSkip({
        kind: "validationError",
        message: "Add a desired role first",
        backToStep: "/onboarding/candidate/preferences",
        backLabel: "Go back to Preferences",
      }),
    ).toBe(false);
  });

  it("is false once a redirect is already in flight (no double-fire)", () => {
    expect(canSkip({ kind: "redirecting" })).toBe(false);
  });
});
```

The top of the file already imports `analyzingReducer`, `AnalyzingProfileScore`, `AnalyzingState`. Adding the `canSkip` import to the existing import block is fine, but the new `import { canSkip } …` line above keeps the diff scoped - pick whichever style matches the file's existing convention.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @aurahire/web vitest run app/onboarding/candidate/analyzing/_analyzing-client.test.tsx -t "canSkip"
```

Expected: FAIL with `Cannot find name 'canSkip'` or similar.

- [ ] **Step 3: Add the helper**

In `apps/web/app/onboarding/candidate/analyzing/_analyzing-client.tsx`, find the closing brace of `analyzingReducer` (around line 143). Immediately after it, add:

```ts
/**
 * Pure derivation: should the manual "Skip to dashboard" link be visible
 * for this reducer state?
 *
 *  - Hidden during `computingProfileScore` because the `complete-onboarding`
 *    PATCH may not have committed `profileCompleted=true` yet; bailing now
 *    risks a layout-guard bounce on the dashboard side.
 *  - Hidden during `error` and `validationError` because those have their
 *    own remediation surfaces (Try again / Go back to step).
 *  - Hidden during `redirecting` so a fast double-click can't fire two
 *    navigations or two telemetry calls.
 */
export function canSkip(state: AnalyzingState): boolean {
  return (
    state.kind === "profileScoreReady" ||
    state.kind === "streamingPreviews" ||
    state.kind === "profileScoreDegraded"
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm --filter @aurahire/web vitest run app/onboarding/candidate/analyzing/_analyzing-client.test.tsx -t "canSkip"
```

Expected: PASS, all 7 cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/onboarding/candidate/analyzing/_analyzing-client.tsx apps/web/app/onboarding/candidate/analyzing/_analyzing-client.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): canSkip(state) derivation for the analyzing screen

Pure helper that the upcoming Skip button uses to decide whether to
render. Hidden during computing, error, validationError, and redirecting;
visible during profileScoreReady, streamingPreviews, profileScoreDegraded.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Render the Skip button + wire the click handler

**Files:**

- Modify: `apps/web/app/onboarding/candidate/analyzing/_analyzing-client.tsx`

**What:** Adds the visible affordance, the click handler that fires the telemetry endpoint (fire-and-forget), dispatches `REDIRECT`, and calls `router.replace("/candidate")`. Also flips the existing auto-redirect from `router.push` to `router.replace` so back-button behavior is consistent regardless of whether the user skipped manually or hit the wall-clock cap.

- [ ] **Step 1: Add the imports**

At the top of `apps/web/app/onboarding/candidate/analyzing/_analyzing-client.tsx`, the existing imports include `useEffect, useReducer, useRef`. No new React imports are needed.

The component already calls `clientApiFetch`. Re-use it for the telemetry POST; no new import.

The component already has `state` from the reducer. We'll derive `canSkip(state)` inline.

- [ ] **Step 2: Switch the auto-redirect from push to replace**

Find the redirecting effect at the bottom of the component (currently around line 288-290):

```tsx
useEffect(() => {
  if (state.kind === "redirecting") router.push("/candidate");
}, [state, router]);
```

Replace with:

```tsx
useEffect(() => {
  if (state.kind === "redirecting") router.replace("/candidate");
}, [state, router]);
```

Also find the degraded redirect effect (currently around line 279-283):

```tsx
useEffect(() => {
  if (state.kind !== "profileScoreDegraded") return;
  const t = setTimeout(
    () => router.push("/candidate?profileScoreRetry=1"),
    2000,
  );
  return () => clearTimeout(t);
}, [state, router]);
```

Leave that one alone - `router.push` here preserves the `?profileScoreRetry=1` query param and the 2s pause, both deliberate. The skip button supersedes this path because clicking Skip dispatches `REDIRECT`, which clears the degraded state via the redirecting effect (which now uses `replace`).

- [ ] **Step 3: Add the click handler**

Inside `AnalyzingClient`, just above the `return (` line (around line 292), add:

```tsx
const onSkipClick = (): void => {
  // Fire-and-forget telemetry. We deliberately do not await - a failing
  // POST must never block the navigation. The endpoint returns 204 on
  // success and is rate-unlimited; backend swallowing the row would
  // simply mean one missing audit log.
  const previewsReady =
    state.kind === "streamingPreviews" ? state.previewCount : 0;
  const scoreReady =
    state.kind === "profileScoreReady" || state.kind === "streamingPreviews"; // both states imply score landed
  void clientApiFetch(
    "/api/v1/candidate-profiles/me/onboarding/skipped-analyzing",
    {
      method: "POST",
      body: JSON.stringify({ scoreReady, previewsReady }),
      headers: { "Content-Type": "application/json" },
    },
  ).catch(() => {
    // Intentional swallow - telemetry must not block UX.
  });
  dispatch({ type: "REDIRECT" });
  router.replace("/candidate");
};
```

Note: `previewsReady=0` on the degraded path matches the spec - we don't have a preview count there.

- [ ] **Step 4: Render the skip link**

The current `return` has a single `<section>` with one `<div>` containing the state-keyed children. We want the Skip link OUTSIDE the card but inside the section so it sits below the loading card.

Replace the existing `return ( … )` block with:

```tsx
return (
  <section className="flex flex-1 flex-col items-center justify-center px-4 py-12">
    <div className="w-full max-w-md space-y-6 rounded-[var(--radius-xl)] border border-[var(--color-hairline-soft)] bg-[var(--color-canvas)] p-8 text-center">
      {state.kind === "computingProfileScore" && (
        <div aria-live="polite" className="space-y-4">
          <AiShimmer caption="Computing your Profile Score…" height={120} />
        </div>
      )}

      {state.kind === "profileScoreReady" && (
        <div aria-live="polite" className="flex flex-col items-center gap-4">
          <ScoreRing
            score={state.score.overallScore}
            band={state.score.band}
            size="md"
          />
          <p className="text-sm text-[var(--color-body)]">
            <span aria-hidden="true">✓ </span>
            Profile Score ready. Finding your top matches…
          </p>
        </div>
      )}

      {state.kind === "streamingPreviews" && (
        <div aria-live="polite" className="flex flex-col items-center gap-4">
          <ScoreRing
            score={state.score.overallScore}
            band={state.score.band}
            size="md"
          />
          <p className="text-sm text-[var(--color-body)]">
            <span style={{ fontFamily: "var(--font-mono)" }}>
              {state.previewCount}
            </span>{" "}
            of <span style={{ fontFamily: "var(--font-mono)" }}>5</span> matches
            ready
          </p>
        </div>
      )}

      {state.kind === "profileScoreDegraded" && (
        <p aria-live="polite" className="text-sm text-[var(--color-body)]">
          We&rsquo;re still working on your score - taking you to your dashboard
          now.
        </p>
      )}

      {state.kind === "redirecting" && (
        <p aria-live="polite" className="text-sm text-[var(--color-muted)]">
          Taking you to your dashboard…
        </p>
      )}

      {state.kind === "error" && (
        <div role="alert" className="space-y-4">
          <p className="text-sm text-[var(--color-status-danger)]">
            {state.message}
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="inline-flex items-center justify-center rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
          >
            Try again
          </button>
        </div>
      )}

      {state.kind === "validationError" && (
        <div role="alert" className="space-y-4">
          <p className="text-sm text-[var(--color-status-danger)]">
            {state.message}
          </p>
          <button
            type="button"
            onClick={() => router.push(state.backToStep)}
            className="inline-flex items-center justify-center rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
          >
            {state.backLabel}
          </button>
        </div>
      )}
    </div>

    {canSkip(state) && (
      <button
        type="button"
        onClick={onSkipClick}
        className="mt-6 inline-flex items-center gap-1 text-sm text-[var(--color-body)] transition hover:text-[var(--color-ink)]"
      >
        Skip to dashboard
        <span aria-hidden="true">→</span>
      </button>
    )}
  </section>
);
```

Two structural changes in the JSX above versus the original:

1. The outer `<section>` now uses `flex-col` (was `flex` only) so the new skip button stacks vertically below the card with `mt-6` spacing.
2. The conditional `{canSkip(state) && (…)}` block sits as a sibling to the card.

- [ ] **Step 5: Verify type-check + lint + reducer tests still pass**

Run:

```bash
pnpm --filter @aurahire/web tsc --noEmit
pnpm --filter @aurahire/web lint
pnpm --filter @aurahire/web vitest run app/onboarding/candidate/analyzing/_analyzing-client.test.tsx
```

Expected: all clean / all tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/onboarding/candidate/analyzing/_analyzing-client.tsx
git commit -m "$(cat <<'EOF'
feat(web): Skip to dashboard button on /onboarding/candidate/analyzing

Manual escape hatch for the analyzing screen. Visible during
profileScoreReady, streamingPreviews, profileScoreDegraded. Fires the
new skipped-analyzing telemetry endpoint (fire-and-forget), dispatches
REDIRECT, and uses router.replace so /analyzing drops out of history.

Also switches the existing auto-redirect from push to replace for
symmetry - the wall-clock cap should leave the same back-button shape
as a manual skip.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Profile Score card - 30s shimmer-then-error transition

**Files:**

- Modify: `apps/web/app/(candidate)/candidate/_components/profile-score-card-client.tsx`

**What:** Today the card shows `AiShimmer` indefinitely when `score === null`. After this task, if 30 seconds pass on the dashboard with the score still null, the card swaps to a calm error state with a `[Try again]` button wired to the existing recompute mutation. Realtime arrival of the score still cancels the timer cleanly.

- [ ] **Step 1: Add the timeout state**

In `apps/web/app/(candidate)/candidate/_components/profile-score-card-client.tsx`, replace the existing imports block at the top so it includes `useState` (currently only `useEffect` is imported):

```tsx
import { useEffect, useState } from "react";
```

Inside `ProfileScoreCardClient`, just below the existing `useCandidateRealtime` line (around line 37), add a stalled-pending tracker:

```tsx
// 30s timeout: if the score is still null this many ms after the card
// mounts, surface a calm error state with a manual retry. Realtime
// arrivals cancel the timer naturally because `score` becomes truthy.
const PROFILE_SCORE_PENDING_TIMEOUT_MS = 30_000;
const [pendingTimedOut, setPendingTimedOut] = useState(false);

useEffect(() => {
  if (score) {
    // Score has landed - reset the timeout so a future stale-and-recompute
    // cycle gets its own fresh 30s window.
    if (pendingTimedOut) setPendingTimedOut(false);
    return;
  }
  // Already timed out: don't spawn a second timer when the effect re-runs
  // because `pendingTimedOut` is in the deps. The next `score` arrival will
  // flip pendingTimedOut back to false and re-arm naturally.
  if (pendingTimedOut) return;
  const t = setTimeout(
    () => setPendingTimedOut(true),
    PROFILE_SCORE_PENDING_TIMEOUT_MS,
  );
  return () => clearTimeout(t);
}, [score, pendingTimedOut]);
```

- [ ] **Step 2: Replace the null-score branch**

The current null-score branch (around lines 86-97) renders an indefinite shimmer. Replace it so the shimmer becomes the error state once `pendingTimedOut` is true:

```tsx
// 1. No score yet - shimmer for the first PROFILE_SCORE_PENDING_TIMEOUT_MS,
//    then transition to a calm error card with manual retry. The backend
//    has already enqueued a recompute on the degraded path; this UI only
//    surfaces the failure if the recompute also doesn't land in time.
if (!score) {
  if (pendingTimedOut) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Profile Score
        </h3>
        <div className="mt-4 space-y-3">
          <p className="text-sm text-[var(--color-ink)]">
            We couldn&rsquo;t compute your score yet.
          </p>
          <p className="text-xs text-[var(--color-muted)]">
            This usually self-resolves within a minute. You can also try again
            now.
          </p>
          <button
            type="button"
            onClick={() => recompute.mutate()}
            disabled={isRecomputing}
            className="inline-flex h-9 items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:opacity-60"
          >
            {isRecomputing ? "Trying…" : "Try again"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        Profile Score
      </h3>
      <div className="mt-4">
        <AiShimmer caption="Computing your Profile Score…" height={120} />
      </div>
    </div>
  );
}
```

The second `return` (the existing rendering when `score` is truthy, currently lines 102-145) stays as is.

- [ ] **Step 3: Verify type-check + lint**

Run:

```bash
pnpm --filter @aurahire/web tsc --noEmit
pnpm --filter @aurahire/web lint
```

Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(candidate\)/candidate/_components/profile-score-card-client.tsx
git commit -m "$(cat <<'EOF'
feat(web): Profile Score card - 30s shimmer-then-error fallback

If the score is still null 30 seconds after the dashboard mounts, swap
the indefinite shimmer for a calm error state with a manual [Try again]
button (uses the existing recompute mutation). Realtime arrival of the
score resets the timer naturally - the happy path is unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Recommended-for-You - inline `N of 5 ready` counter + 30s stall

**Files:**

- Modify: `apps/web/app/(candidate)/candidate/_dashboard-client.tsx`

**What:** The section currently fills its 5 slots with shimmer cards indefinitely while previews stream in. After this task, the section header shows ` · N of 5 ready` while previews land, and after 30 seconds without progress the shimmer slots disappear and a small caption invites the candidate to browse all jobs. Existing empty-state (zero previews) behavior is preserved.

- [ ] **Step 1: Add a stall tracker to `RecommendedForYouSection`**

In `apps/web/app/(candidate)/candidate/_dashboard-client.tsx`, find `RecommendedForYouSection` (around line 712). At the top of the function, add:

```tsx
const RECOMMENDED_STALL_TIMEOUT_MS = 30_000;
const [stalled, setStalled] = useState(false);
const lastSeenCountRef = useRef(0);

// Reset the stall window whenever a new preview lands. A no-op once we
// already hit the target - there's nothing left to wait for. Stall is a
// one-way transition for simplicity; if a late preview arrives after we
// stalled, it still renders (the `.slice(0, RECOMMENDED_TARGET)` above
// picks it up) but the caption stays at "some matches couldn't be loaded."
useEffect(() => {
  if (top.length >= RECOMMENDED_TARGET) {
    lastSeenCountRef.current = top.length;
    if (stalled) setStalled(false);
    return;
  }
  // Already stalled: don't spawn another timer. Once stalled, only a full
  // refresh (e.g., navigating away and back) clears it.
  if (stalled) return;
  if (top.length > lastSeenCountRef.current) {
    lastSeenCountRef.current = top.length;
  }
  const t = setTimeout(() => {
    if (top.length < RECOMMENDED_TARGET) setStalled(true);
  }, RECOMMENDED_STALL_TIMEOUT_MS);
  return () => clearTimeout(t);
}, [top.length, stalled]);
```

You'll need `useState` and `useRef` imported. Add them to the existing React import at the top of the file: change `import { useEffect, useMemo, useState } from "react";` so it includes `useRef` if not already present:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
```

- [ ] **Step 2: Update the shimmer-slot count to respect stalled**

Inside `RecommendedForYouSection`, find the line currently reading:

```tsx
const shimmerCount = Math.max(0, RECOMMENDED_TARGET - top.length);
```

Replace with:

```tsx
// Once we've stalled (no new previews in the timeout window), drop the
// shimmer slots - the candidate isn't waiting on anything that's coming.
const shimmerCount = stalled ? 0 : Math.max(0, RECOMMENDED_TARGET - top.length);
```

- [ ] **Step 3: Add the inline counter to the section header**

Find the populated-state header inside `RecommendedForYouSection` (around line 781):

```tsx
<div className="mb-3 flex items-center justify-between">
  <div className="flex items-center gap-2">
    <Sparkles className="h-3.5 w-3.5 text-[var(--color-primary)]" aria-hidden />
    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
      Recommended for You
    </span>
    <span className="text-[11px] text-[var(--color-muted)]">
      · auto-scored against your resume
    </span>
  </div>
  <Link
    href="/candidate/jobs"
    className="text-sm font-medium text-[var(--color-primary)] hover:underline"
  >
    Browse all →
  </Link>
</div>
```

Replace the inner `<span className="text-[11px] text-[var(--color-muted)]">…</span>` (the auto-scored caption) with a state-aware caption:

```tsx
<span className="text-[11px] text-[var(--color-muted)]">
  {top.length < RECOMMENDED_TARGET && !stalled
    ? `· ${top.length} of ${RECOMMENDED_TARGET} ready`
    : stalled && top.length < RECOMMENDED_TARGET
      ? "· some matches couldn't be loaded"
      : "· auto-scored against your resume"}
</span>
```

- [ ] **Step 4: Verify type-check + lint**

Run:

```bash
pnpm --filter @aurahire/web tsc --noEmit
pnpm --filter @aurahire/web lint
```

Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(candidate\)/candidate/_dashboard-client.tsx
git commit -m "$(cat <<'EOF'
feat(web): N-of-5 inline counter + 30s stall on Recommended for You

Replaces the indefinite shimmer slots on the dashboard's recommended
matches section with: (a) an inline "N of 5 ready" counter while
previews stream in, (b) a 30-second stall timeout that drops shimmer
slots and surfaces a "some matches couldn't be loaded" caption when the
precompute job partially fails. Empty-state (zero previews) behavior
is unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Final verification

**Files:** none modified.

**What:** Confirms the whole slice type-checks, lints, and passes targeted tests before handoff.

- [ ] **Step 1: Run the workspace type-check**

Run in parallel:

```bash
pnpm --filter @aurahire/shared tsc --noEmit
pnpm --filter @aurahire/api tsc --noEmit
pnpm --filter @aurahire/web tsc --noEmit
```

Expected: all three clean.

- [ ] **Step 2: Run the lint pass**

Run:

```bash
pnpm --filter @aurahire/api lint
pnpm --filter @aurahire/web lint
```

Expected: both clean.

- [ ] **Step 3: Run the targeted tests**

Run:

```bash
pnpm --filter @aurahire/shared vitest run src/schemas/onboarding.test.ts
pnpm --filter @aurahire/api vitest run src/modules/candidate-profiles/candidate-profiles.service.spec.ts
pnpm --filter @aurahire/web vitest run app/onboarding/candidate/analyzing/_analyzing-client.test.tsx
```

Expected: all green.

- [ ] **Step 4: Manual QA checklist (the human runs the dev server)**

Hand the human this checklist. Do not start the dev server yourself.

```
HUMAN QA CHECKLIST - Skip-to-Dashboard

Setup:
  - Sign in as a fresh candidate with no profile completed.
  - Walk through onboarding: personal → review → preferences.
  - Click "Finish" on preferences. You should land on /onboarding/candidate/analyzing.

Happy-path skip:
  ✓ Wait until "✓ Profile Score ready. Finding your top matches…" appears.
  ✓ The "Skip to dashboard →" link appears below the card.
  ✓ Click it. You go to /candidate immediately.
  ✓ The Profile Score KPI tile shows your score.
  ✓ The Snapshot row's Profile Score card shows your ScoreRing.
  ✓ "Recommended for You" header shows " · N of 5 ready" while matches stream in.
  ✓ When the 5th preview lands, the caption flips back to " · auto-scored against your resume".

Streaming-skip:
  ✓ Re-do onboarding (clear cookies). Walk to /analyzing, wait for the first
    match preview (counter "1 of 5"), then click Skip.
  ✓ Land on /candidate. The Recommended-for-You section starts at 1 visible
    match + 4 shimmer slots, ticks up to N of 5 over the next ~5 seconds.

Back button:
  ✓ After landing on /candidate via skip, hit the browser back button.
  ✓ You should NOT land on /analyzing. You should land on /onboarding/candidate/preferences,
    which then redirects you forward to /candidate (because profileCompleted=true).

Failure path - Profile Score:
  ✓ With network DevTools, throttle the API or block POST /scoring/profile/compute.
  ✓ Land on /candidate with a null Profile Score. Card shows shimmer for 30s.
  ✓ At ~30s, swaps to "We couldn't compute your score yet" + [Try again] button.
  ✓ Click [Try again]. Mutation fires. On 200, score appears. On 429, toast says
    "Please wait a moment before recalculating."

Failure path - Match previews:
  ✓ With network DevTools, drop the Supabase Realtime channel after the first
    preview lands.
  ✓ Header shows "1 of 5 ready" for 30s.
  ✓ At ~30s, header flips to "some matches couldn't be loaded". Shimmer slots
    disappear. The single visible preview card stays.

Telemetry:
  ✓ With DevTools Network panel open, click Skip. Confirm a POST to
    /api/v1/candidate-profiles/me/onboarding/skipped-analyzing fires with
    body { scoreReady: …, previewsReady: … } and returns 204.
  ✓ Optionally, query the audit_logs table to verify a row with action
    "user.onboarding.skipped_analyzing" landed.

Don't:
  ✗ Don't see a Skip button during the very first "Computing your Profile Score…" frame.
  ✗ Don't see a Skip button if you got bounced to the validation-error state.
  ✗ Don't see a Skip button after clicking it once (state went to redirecting).
```

- [ ] **Step 5: Commit (no-op if nothing changed)**

If any tracked file changed during verification (e.g., snapshots regenerated), commit it. Otherwise skip this step.

---

## Out-of-scope reminders

(Repeated from the spec - do **not** implement any of these, even if they look easy.)

- No banner on the dashboard announcing "matches still streaming." Inline-only.
- No toast on "matches ready." Inline-only.
- No cross-page indicator in the sidebar/header. Off-page is silent.
- No change to the 10-second `ANALYZING_SCREEN_WALLCLOCK_MS` cap.
- No backend scoring/queue/scheduler changes.
- No DB schema or RLS changes.
- No recruiter or admin portal changes.
- No "apply gated until score ready" rule.
- No new Profile Score card on `/candidate/profile` - that page renders the deep-dive view from a non-null `data` prop.
