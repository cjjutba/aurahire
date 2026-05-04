# Consistent Toast Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add consistent user-initiated toast feedback across all auth, onboarding, candidate, recruiter, and admin flows in `apps/web`, enforced via a thin helper at `apps/web/lib/toast.ts`.

**Architecture:** Introduce two helper functions (`toastSuccess`, `toastApiError`) that wrap `sonner`. Every site that previously called `toast.success(...)` or `toast.error(...)` migrates to the helper. ~10 silent success paths get success toasts added (login, register, logout, verify-email, forgot-password, onboarding completion). Wording is restandardized to terse past-tense titles with optional descriptions, no em/en-dashes, no exclamation marks. Background jobs and other-user actions never fire toasts (user-initiated only).

**Tech Stack:** Next.js 16 (App Router), React 19, sonner, TypeScript strict mode, `@aurahire/shared` (Zod schemas + `ApiErrorResponse` type), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-05-04-consistent-toast-notifications-design.md` is authoritative for wording and scope. When in doubt, defer to the spec's "Toast inventory" section.

---

## File Structure

### New file
- `apps/web/lib/toast.ts` — exports `toastSuccess` and `toastApiError`. Single source of truth for the convention.

### Modified files (32 confirmed)
Grouped by area; full list with exact change per file lives in Tasks 3–8.

- **Auth (7):** `login-form.tsx`, `register-candidate-form.tsx`, `register-recruiter-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`, `verify-email-client.tsx`, `portal-topbar.tsx`.
- **Onboarding (6):** `resume-upload.tsx`, `personal-info-form.tsx`, `preferences-form.tsx`, `about-form.tsx`, `company-form.tsx`, `focus-form.tsx`.
- **Recruiter portal (6):** settings, job-actions, application actions, schedule-interview-modal, offer-form, job-form.
- **Candidate portal (6):** settings, recompute-button, profile-score-card, offer-actions, withdraw-button, apply-form.
- **Admin portal (5):** action-modals, apply-to-existing, config-editor, export-button, job-detail-sheet.
- **Other (2):** `bias-override-modal.tsx`, `raw-output-json-viewer.tsx`.

### Maybe-modified files (data-dependent, resolved in Task 1)
- `apps/web/app/onboarding/candidate/education/page.tsx`
- `apps/web/app/onboarding/candidate/experience/page.tsx`
- `apps/web/app/onboarding/candidate/skills/page.tsx`

### Unchanged
- `apps/web/components/ui/sonner.tsx` (Toaster component config)
- `apps/web/app/layout.tsx` (Toaster mount point)
- `package.json` (no dependency changes)
- `apps/api/`, `packages/db/`, `packages/shared/` (no backend changes)

---

## Conventions used in every migration task

Every migration step follows this pattern. Apply it identically across files.

### 1. Replace the import

**Find** (anywhere near the top of the file):
```ts
import { toast } from "sonner";
```

**Replace with**:
```ts
import { toastSuccess, toastApiError } from "@/lib/toast";
```

If a file uses **only** `toast.success` calls, you can omit `toastApiError` from the named imports. If a file uses **only** `toast.error` calls, omit `toastSuccess`. TypeScript will surface unused imports during type-check.

### 2. Replace `toast.success(...)` calls

| Old form | New form |
|---|---|
| `toast.success("Title")` | `toastSuccess("Title")` |
| `toast.success("Title", { description: "Desc." })` | `toastSuccess("Title", "Desc.")` |

If the wording does not match the spec inventory, **rewrite it to match the spec**. Per-file mappings are listed inside each task.

### 3. Replace `toast.error(...)` calls

| Old form | New form |
|---|---|
| `toast.error("Title", { description: (err as Error).message })` | `toastApiError(err, "Title")` |
| `toast.error("Title", { description: "Some hardcoded message." })` | `toastApiError(null, "Title", "Some hardcoded message.")` |
| `toast.error("Title")` | `toastApiError(null, "Title")` |
| `toast.error("Validation failed", { description: zodMessages })` | `toastApiError(null, "Check your input", zodMessages)` |

Where `err` is the variable in scope (from `catch (err)` or `onError: (err) =>`). If the call site has access to a parsed JSON error body via manual fetch, prefer passing the raw error object (`err`) — `toastApiError` extracts `.body.message` automatically.

For sites that build a custom error message (e.g. `body.message ?? "fallback"`), pass the already-built string as the third arg: `toastApiError(null, "Title", customMessage)`.

### 4. Add a success toast where currently silent

Only at the sites listed in Tasks 3–4 (auth + onboarding final steps). Never invent new toast sites — the inventory is closed.

### 5. After every task, type-check

Run from the repo root:
```bash
pnpm --filter @aurahire/web run type-check
```
Expected: no new errors. If type errors appear, fix them before committing.

### 6. Commit

Each task gets exactly one commit. Use the commit message in the task.

---

## Task 1: Audit onboarding pages (education, experience, skills)

**Files:**
- Read: `apps/web/app/onboarding/candidate/education/page.tsx`
- Read: `apps/web/app/onboarding/candidate/experience/page.tsx`
- Read: `apps/web/app/onboarding/candidate/skills/page.tsx`
- Read: any client component these pages render (look for `_*.tsx` siblings or imports under `apps/web/components/onboarding/candidate/`)

- [ ] **Step 1: Read the three page files**

For each of the three paths above, open the file. Look for:
- A `"use client"` directive (means the file itself does mutations).
- Imports of `useMutation`, `fetch(`, or any auto-generated controller method from `@aurahire/shared`.
- Imports of a sibling client component (e.g. `import { EducationForm } from "@/components/onboarding/candidate/education-form";`).

- [ ] **Step 2: Read each rendered client component**

If a page imports a client component, read that component too. Look for `toast.error(...)` or `toast.success(...)` calls.

- [ ] **Step 3: Record findings**

Append the findings to this plan file as a new sub-section titled "Task 1 results" under the **Open log** section at the bottom of this document. For each of the three steps, record:
- File path of the form-level component (page or client component).
- Whether it has a mutation handler.
- Whether it currently uses `toast.*`.

Apply this rule per finding:
- **Has mutation, has toast** → add to Task 4 file list. Migrate (error toast only — intermediate step, no success toast).
- **Has mutation, no toast** → add to Task 4 file list. Add `toastApiError(err, "Couldn't save <step>")` only.
- **No mutation** (server component or pure rendering) → no change needed.

- [ ] **Step 4: Commit findings**

If Task 1 results require touching code in Task 4, commit only the appended notes here:
```bash
git add docs/superpowers/plans/2026-05-04-consistent-toast-notifications.md
git commit -m "docs: record onboarding page audit for toast plan"
```
If no findings warrant a code change, skip the commit and proceed to Task 2.

---

## Task 2: Create the toast helper module

**Files:**
- Create: `apps/web/lib/toast.ts`

- [ ] **Step 1: Create the helper file**

Create `apps/web/lib/toast.ts` with this exact content:

```ts
import { toast } from "sonner";
import type { ApiErrorResponse } from "@aurahire/shared";

/**
 * Fire a success toast. Title is required; description is optional.
 * Use for any user-initiated successful mutation. Do not use for background
 * jobs, polling that completed without user intent, or actions taken by other
 * users.
 */
export function toastSuccess(title: string, description?: string) {
  toast.success(title, description ? { description } : undefined);
}

/**
 * Fire an error toast. Pass the raw error from a catch block or onError
 * callback. The helper extracts the API error message from the standard
 * `ApiErrorResponse` shape, falling back to the error's own `message`, and
 * finally to the provided `fallbackDescription` when no usable message is
 * available.
 *
 * For client-side validation toasts (no real error), pass `null` and an
 * explicit description: `toastApiError(null, "Check your input", zodMessages)`.
 */
export function toastApiError(
  err: unknown,
  fallbackTitle: string,
  fallbackDescription = "Please try again.",
) {
  const description = extractApiErrorMessage(err) ?? fallbackDescription;
  toast.error(fallbackTitle, { description });
}

function extractApiErrorMessage(err: unknown): string | null {
  if (err && typeof err === "object" && "body" in err) {
    const body = (err as { body?: ApiErrorResponse }).body;
    if (body?.message) return body.message;
  }
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0 && msg !== "Failed to fetch") {
      return msg;
    }
  }
  return null;
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @aurahire/web run type-check
```
Expected: no errors. The helper imports `ApiErrorResponse` from `@aurahire/shared`, which is already exported via `packages/shared/src/index.ts:export * from "./types/api-error.ts"`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/toast.ts
git commit -m "feat(web): add toast helper module

Adds apps/web/lib/toast.ts with toastSuccess and toastApiError.
Single source of truth for the toast wording convention. The error
helper extracts ApiErrorResponse.message consistently across the app.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Migrate auth flows

**Files:**
- Modify: `apps/web/components/auth/login-form.tsx`
- Modify: `apps/web/components/auth/register-candidate-form.tsx`
- Modify: `apps/web/components/auth/register-recruiter-form.tsx`
- Modify: `apps/web/components/auth/forgot-password-form.tsx`
- Modify: `apps/web/components/auth/reset-password-form.tsx`
- Modify: `apps/web/app/(auth)/verify-email/verify-email-client.tsx`
- Modify: `apps/web/components/layout/portal-topbar.tsx`

- [ ] **Step 1: Migrate `login-form.tsx`**

Read `apps/web/components/auth/login-form.tsx`. Apply the import migration from "Conventions" §1.

Rewrite the five existing `toast.error` calls and **add** a success toast just before `router.push(dest)` on the happy path:

| Location | Before | After |
|---|---|---|
| Email-not-confirmed branch | `toast.error("Please verify your email first", { description: "Check your inbox for the verification link." })` | `toastApiError(null, "Sign in failed", "Please verify your email first. Check your inbox for the verification link.")` |
| Generic auth fail | `toast.error("Sign in failed", { description: "Email or password incorrect." })` | `toastApiError(null, "Sign in failed", "Email or password incorrect.")` |
| No session | `toast.error("Sign in failed", { description: "No session created." })` | `toastApiError(null, "Sign in failed", "No session created.")` |
| Profile 404 | `toast.error("Profile not found", { description: "Please complete registration." })` | `toastApiError(null, "Profile not found", "Please complete registration.")` |
| Profile load fail | `toast.error("Sign in failed", { description: "Could not load profile." })` | `toastApiError(null, "Sign in failed", "Could not load profile.")` |
| Catch-all | `toast.error("Unexpected error", { description: (err as Error).message })` | `toastApiError(err, "Sign in failed")` |

Add the success toast **before** the `router.push(dest)` line on the happy path:
```ts
toastSuccess("Signed in");
router.push(dest);
```

- [ ] **Step 2: Migrate `register-candidate-form.tsx`**

Apply the import migration. Rewrite the existing error and add a success toast.

Rewrite (find the existing `toast.error(...)` call):
```ts
// Before:
toast.error("Registration failed", { description: (err as Error).message });
// After:
toastApiError(err, "Couldn't create account");
```

Add success toast on the happy path, immediately before the redirect to `/verify-email/sent`:
```ts
toastSuccess("Account created", "Check your email to verify.");
router.push("/verify-email/sent");
```

- [ ] **Step 3: Migrate `register-recruiter-form.tsx`**

Same as Step 2 but in the recruiter registration form. Apply identical title/description (`"Account created"` + `"Check your email to verify."`).

- [ ] **Step 4: Migrate `forgot-password-form.tsx`**

Read the file. Replace the silent error swallow `.catch(() => {})` with proper error handling and add success + error toasts.

Before (around lines 29–40):
```ts
async function onSubmit(values: ForgotPasswordInput) {
  setIsSubmitting(true);
  try {
    await fetcher("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(values),
    }).catch(() => {});
    setSent(true);
  } finally {
    setIsSubmitting(false);
  }
}
```

After:
```ts
async function onSubmit(values: ForgotPasswordInput) {
  setIsSubmitting(true);
  try {
    await fetcher("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(values),
    });
    toastSuccess("Reset link sent", "Check your inbox.");
    setSent(true);
  } catch (err) {
    toastApiError(err, "Couldn't send reset link");
  } finally {
    setIsSubmitting(false);
  }
}
```

Apply the import migration. Note the security model from the spec edge cases: the API always returns success regardless of whether the email exists. Do not branch on existence — the `try` succeeds either way.

- [ ] **Step 5: Migrate `reset-password-form.tsx`**

Apply the import migration. Restandardize wording.

Before (the existing success toast):
```ts
toast.success("Password updated. Please sign in.");
```
After:
```ts
toastSuccess("Password updated", "Please sign in.");
```

Before (the existing error toast):
```ts
toast.error("Reset failed", { description: (err as Error).message });
```
After:
```ts
toastApiError(err, "Couldn't reset password");
```

- [ ] **Step 6: Migrate `verify-email-client.tsx`**

Read `apps/web/app/(auth)/verify-email/verify-email-client.tsx`. The current behavior is a silent state machine (`setStatus("success")` on success, `setStatus("error")` on failure). Add toasts at both transitions.

Apply the import migration if `sonner` is not already imported. Otherwise add the helper import.

When the verification call succeeds, just before or just after `setStatus("success")`:
```ts
toastSuccess("Email verified", "Redirecting to your dashboard.");
setStatus("success");
```

When the verification call fails, just before or just after `setStatus("error")`:
```ts
toastApiError(err, "Verification failed");
setStatus("error");
```

If the file uses a switch on a returned status code rather than try/catch, fire `toastApiError(null, "Verification failed", body.message)` in the failure branch where `body.message` is the parsed error message.

- [ ] **Step 7: Migrate `portal-topbar.tsx`**

Apply the import migration. The existing `toast.error("Logout failed", ...)` becomes `toastApiError(err, "Sign out failed")`. Add a success toast immediately before the redirect.

The relevant block:
```ts
// Before (around the logout handler):
async function handleLogout() {
  try {
    await supabase.auth.signOut();
    router.push("/");
  } catch (err) {
    toast.error("Logout failed", { description: (err as Error).message });
  }
}
```

After:
```ts
async function handleLogout() {
  try {
    await supabase.auth.signOut();
    toastSuccess("Signed out");
    router.push("/");
  } catch (err) {
    toastApiError(err, "Sign out failed");
  }
}
```

If the actual control flow differs (e.g. uses `await router.push` or has additional cleanup), preserve the structure and only change the toast lines.

- [ ] **Step 8: Type-check**

```bash
pnpm --filter @aurahire/web run type-check
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/components/auth apps/web/components/layout/portal-topbar.tsx apps/web/app/\(auth\)/verify-email/verify-email-client.tsx
git commit -m "feat(web): consistent toasts in auth flows

Migrates login, register (candidate + recruiter), forgot-password,
reset-password, verify-email, and logout to the toast helper.
Adds previously-missing success toasts on sign in, sign out,
account creation, password reset email send, and email verification.
Replaces silent .catch(() => {}) in forgot-password with proper
error surfacing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Migrate onboarding flows

**Files:**
- Modify: `apps/web/components/onboarding/candidate/resume-upload.tsx`
- Modify: `apps/web/components/onboarding/candidate/personal-info-form.tsx`
- Modify: `apps/web/components/onboarding/candidate/preferences-form.tsx`
- Modify: `apps/web/components/onboarding/recruiter/about-form.tsx`
- Modify: `apps/web/components/onboarding/recruiter/company-form.tsx`
- Modify: `apps/web/components/onboarding/recruiter/focus-form.tsx`
- Modify: any additional files identified in Task 1's audit results

- [ ] **Step 1: Migrate `resume-upload.tsx`**

Apply the import migration. Restandardize wording.

Before:
```ts
toast.success("Resume parsed successfully");
// or:
toast.success("Resume parsed", { description: "Review the prefilled fields below." });
```
After:
```ts
toastSuccess("Resume processed", "Review the prefilled fields before continuing.");
```

Before (error path):
```ts
toast.error("Resume parse failed", { description: (err as Error).message });
```
After:
```ts
toastApiError(err, "Couldn't process resume");
```

- [ ] **Step 2: Migrate `personal-info-form.tsx`**

Apply the import migration. **Do not add a success toast** (intermediate step). Restandardize the existing error.

Before:
```ts
toast.error("Save failed", { description: (err as Error).message });
```
After:
```ts
toastApiError(err, "Couldn't save personal info");
```

- [ ] **Step 3: Migrate `preferences-form.tsx`**

Apply the import migration. Restandardize the two existing errors and **add** a success toast on the final-step completion.

Error 1 (validation): `toast.error("Validation failed", { description: parsed.error.errors.map(e => e.message).join(", ") })` →
```ts
toastApiError(null, "Check your input", parsed.error.errors.map((e) => e.message).join(", "));
```

Error 2 (save fail): `toast.error("Save failed", { description: (err as Error).message })` →
```ts
toastApiError(err, "Couldn't save preferences");
```

Add the success toast **immediately after** `completeOnboarding` resolves and before the redirect to `/candidate`:
```ts
await completeOnboardingMutation.mutateAsync(...);
toastSuccess("Onboarding complete", "Welcome to AuraHire.");
router.push("/candidate");
```

If the existing code uses a TanStack `useMutation`'s `onSuccess` callback chained from `updatePreferences` → `completeOnboarding`, fire the toast inside the `completeOnboarding` `onSuccess` handler, not after `updatePreferences`.

- [ ] **Step 4: Migrate `about-form.tsx`**

Apply the import migration. **No success toast** (intermediate step).
Before: `toast.error("Save failed", { description: (err as Error).message })` →
After: `toastApiError(err, "Couldn't save about info")`.

- [ ] **Step 5: Migrate `company-form.tsx`**

Apply the import migration. **No success toast** (intermediate step).
Before: `toast.error("Save failed", { description: (err as Error).message })` →
After: `toastApiError(err, "Couldn't save company info")`.

- [ ] **Step 6: Migrate `focus-form.tsx`**

Same pattern as Step 3 but for the recruiter side. Two errors to migrate; add success toast on `completeOnboarding`.

Validation error: `toastApiError(null, "Check your input", joinedZodMessages)`.
Save error: `toastApiError(err, "Couldn't save focus areas")`.
Success: `toastSuccess("Onboarding complete", "Welcome to AuraHire.");` before `router.push("/recruiter")`.

- [ ] **Step 7: Apply Task 1 results (if any)**

If Task 1 identified any of the education/experience/skills pages as needing a toast, apply error-only migration here. Pattern:
```ts
// Before:
toast.error("Save failed", { description: (err as Error).message });
// After:
toastApiError(err, "Couldn't save <step name>");
```
No success toast on these intermediate steps.

- [ ] **Step 8: Type-check**

```bash
pnpm --filter @aurahire/web run type-check
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/components/onboarding apps/web/app/onboarding
git commit -m "feat(web): consistent toasts in onboarding flows

Migrates candidate (resume upload, personal info, preferences) and
recruiter (about, company, focus) onboarding forms to the toast
helper. Intermediate step saves stay silent on success per the
design (page navigation is the success signal). Final-step
completeOnboarding fires \"Onboarding complete\". Resume parse
toast restandardized to \"Resume processed\".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Migrate recruiter portal

**Files:**
- Modify: `apps/web/app/(recruiter)/recruiter/settings/_settings-form-client.tsx`
- Modify: `apps/web/app/(recruiter)/recruiter/jobs/[id]/job-actions.tsx`
- Modify: `apps/web/app/(recruiter)/recruiter/applications/[id]/_actions-client.tsx`
- Modify: `apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-modal-client.tsx`
- Modify: `apps/web/app/(recruiter)/recruiter/offers/new/_offer-form-client.tsx`
- Modify: `apps/web/components/jobs/job-form.tsx`

- [ ] **Step 1: Migrate `_settings-form-client.tsx`**

Apply the import migration.

Success: `toast.success("Profile updated")` → `toastSuccess("Profile updated")`.
Error: `toast.error("Update failed", { description: (err as Error).message })` → `toastApiError(err, "Couldn't update profile")`.

- [ ] **Step 2: Migrate `job-actions.tsx`**

Apply the import migration.

Publish success: `toast.success("Job published")` → `toastSuccess("Job published")`.
Publish error: `toast.error("Publish failed", { description: ... })` → `toastApiError(err, "Couldn't publish job")`.
Archive success: `toast.success("Job archived")` → `toastSuccess("Job archived")`.
Archive error: `toast.error("Archive failed", { description: ... })` → `toastApiError(err, "Couldn't archive job")`.

- [ ] **Step 3: Migrate `_actions-client.tsx` (application actions)**

Apply the import migration. Rewrite `"Moved to ${newStatus}"` to use the new convention with title and description split.

Before:
```ts
toast.success(`Moved to ${newStatus}`);
```
After:
```ts
toastSuccess("Status updated", `Now in ${newStatus}.`);
```

Save notes:
```ts
// Before:
toast.success("Notes saved");
// After:
toastSuccess("Notes saved");
```

Errors:
- Status change error: `toastApiError(err, "Couldn't update status")`.
- Save notes error: `toastApiError(err, "Couldn't save notes")`.
- Download archive error (if present): `toastApiError(err, "Couldn't download")`.

- [ ] **Step 4: Migrate `_schedule-interview-modal-client.tsx`**

Apply the import migration.

Success: `toast.success("Interview scheduled — candidate notified")` → `toastSuccess("Interview scheduled", "Candidate notified.")`.

Errors (3): wherever each error fires, use:
- Validation: `toastApiError(null, "Check your input", joinedMessages)`.
- Auth: `toastApiError(err, "Couldn't schedule interview")` or `toastApiError(null, "Couldn't schedule interview", "Please sign in again.")`.
- API fail: `toastApiError(err, "Couldn't schedule interview")`.

- [ ] **Step 5: Migrate `_offer-form-client.tsx`**

Apply the import migration. Remove the em-dash from the success toast and split title/description.

Success: `toast.success("Offer sent — candidate notified")` → `toastSuccess("Offer sent", "Candidate notified.")`.

Six errors. Map each by current title:
- `toast.error("Validation failed", ...)` → `toastApiError(null, "Check your input", joinedMessages)`.
- `toast.error("Authorization failed", ...)` → `toastApiError(err, "Couldn't send offer")`.
- `toast.error("Duplicate offer", { description })` (where description is body.message about pending offer) → `toastApiError(err, "Couldn't send offer")` (the helper will surface the API description automatically since the error has a body).
- `toast.error("Network error", ...)` → `toastApiError(err, "Couldn't send offer")`.
- Any other contextual errors → `toastApiError(err, "Couldn't send offer")`.

If the existing code parses `body.message` itself for the duplicate-offer case, you can keep that logic and pass it explicitly: `toastApiError(null, "Couldn't send offer", body.message)`.

- [ ] **Step 6: Migrate `job-form.tsx`**

Apply the import migration. **Distinguish create vs update** in the success title.

Inspect the form's submit handler to find the create vs update branch (typically based on whether an `id` prop is present, or which mutation is called). Use:
- Create success → `toastSuccess("Job created")`.
- Update success → `toastSuccess("Job updated")`.

Errors:
- Validation: `toastApiError(null, "Check your input", joinedZodMessages)`.
- Save fail: `toastApiError(err, "Couldn't save job")`.

- [ ] **Step 7: Type-check**

```bash
pnpm --filter @aurahire/web run type-check
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/\(recruiter\) apps/web/components/jobs/job-form.tsx
git commit -m "feat(web): consistent toasts in recruiter portal

Migrates settings, job actions (publish/archive), application
status changes, save notes, schedule interview, send offer, and
job-form (create/update) to the toast helper. Removes em-dashes,
restandardizes \"Moved to X\" as \"Status updated\" + \"Now in X.\"
description. Distinguishes \"Job created\" vs \"Job updated\".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Migrate candidate portal

**Files:**
- Modify: `apps/web/app/(candidate)/candidate/settings/_settings-form-client.tsx`
- Modify: `apps/web/app/(candidate)/candidate/profile/_recompute-button-client.tsx`
- Modify: `apps/web/app/(candidate)/candidate/_components/profile-score-card-client.tsx`
- Modify: `apps/web/app/(candidate)/candidate/applications/[id]/_offer-actions-client.tsx`
- Modify: `apps/web/app/(candidate)/candidate/applications/[id]/_withdraw-button-client.tsx`
- Modify: `apps/web/app/(candidate)/candidate/jobs/[id]/apply/_apply-form-client.tsx`

- [ ] **Step 1: Migrate `_settings-form-client.tsx` (candidate)**

Apply the import migration.
Success: `toastSuccess("Profile updated")`.
Error: `toastApiError(err, "Couldn't update profile")`.

- [ ] **Step 2: Migrate `_recompute-button-client.tsx`**

Apply the import migration. Restandardize wording.

Success (any current text like "Score recomputed" or "Profile rescored"): → `toastSuccess("Score recalculated")`.

Errors (2). Map by intent:
- Throttle: `toastApiError(err, "Couldn't recalculate")` (the helper surfaces the API throttle message automatically) or, if the existing code has a hardcoded throttle message, `toastApiError(null, "Couldn't recalculate", "Please wait a moment before recalculating.")`.
- Generic fail: `toastApiError(err, "Couldn't recalculate")`.

- [ ] **Step 3: Migrate `profile-score-card-client.tsx`**

Apply the import migration. This component has 4 errors and 1 success.

Success (any "Score computed" wording): → `toastSuccess("Score recalculated")`.

Errors (map by current title):
- Auth missing: `toastApiError(null, "Couldn't recalculate", "Please sign in again.")`.
- Throttle: `toastApiError(err, "Couldn't recalculate")` (helper surfaces API msg).
- Not ready: `toastApiError(null, "Couldn't recalculate", "Complete your profile before recalculating.")` (or keep the existing literal description if more accurate).
- Generic fail: `toastApiError(err, "Couldn't recalculate")`.

If the existing wording deviates from "Couldn't recalculate", the engineer should choose the closest title and put any contextual nuance into the description argument.

- [ ] **Step 4: Migrate `_offer-actions-client.tsx`**

Apply the import migration. **Remove the em-dash** from the existing success.

Accept success: `toast.success("Offer accepted — welcome aboard!")` → `toastSuccess("Offer accepted", "Welcome aboard.")`.
Accept error: `toastApiError(err, "Couldn't accept offer")`.
Decline success: `toast.success("Offer declined")` → `toastSuccess("Offer declined")`.
Decline error: `toastApiError(err, "Couldn't decline offer")`.

- [ ] **Step 5: Migrate `_withdraw-button-client.tsx`**

Apply the import migration.
Success: `toastSuccess("Application withdrawn")`.
Error: `toastApiError(err, "Couldn't withdraw application")`.

- [ ] **Step 6: Migrate `_apply-form-client.tsx`**

Apply the import migration. Restandardize success wording.

Success: `toast.success("Application submitted")` → `toastSuccess("Application sent", "We'll notify you when there's an update.")`.

Errors (4). Map by intent:
- Pick resume validation: `toastApiError(null, "Check your input", "Please pick a resume to apply with.")` or whatever the existing literal message is.
- Auth missing: `toastApiError(null, "Couldn't apply", "Please sign in again.")`.
- Duplicate: `toastApiError(err, "Couldn't apply")` (helper surfaces API msg about already applied).
- Apply fail: `toastApiError(err, "Couldn't apply")`.

- [ ] **Step 7: Type-check**

```bash
pnpm --filter @aurahire/web run type-check
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/\(candidate\)
git commit -m "feat(web): consistent toasts in candidate portal

Migrates settings, recompute score, profile score card, accept/
decline offer, withdraw application, and apply-to-job to the toast
helper. Removes em-dash from \"Offer accepted\". Restandardizes
\"Application submitted\" to \"Application sent\". Restandardizes
score recomputation wording to \"Score recalculated\".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Migrate admin portal

**Files:**
- Modify: `apps/web/app/(admin)/admin/users/_action-modals-client.tsx`
- Modify: `apps/web/app/(admin)/admin/ai-config/_apply-to-existing-client.tsx`
- Modify: `apps/web/app/(admin)/admin/ai-config/_config-editor-client.tsx`
- Modify: `apps/web/app/(admin)/admin/audit/_export-button-client.tsx`
- Modify: `apps/web/app/(admin)/admin/jobs/_job-detail-sheet-client.tsx`

- [ ] **Step 1: Migrate `_action-modals-client.tsx`**

Apply the import migration. This file has 3 successes and 6 errors. Rewrite `"Role changed to X"` to use new convention.

Suspend success: `toastSuccess("User suspended")`.
Suspend error: `toastApiError(err, "Couldn't suspend user")`.

Reactivate success: `toastSuccess("User reactivated")`.
Reactivate error: `toastApiError(err, "Couldn't reactivate user")`.

Role change success: `toast.success(\`Role changed to ${newRole}\`)` → `toastSuccess("User role changed", \`Now ${newRole}.\`)`.
Role change error: `toastApiError(err, "Couldn't change role")`.

Delete success: `toastSuccess("User deleted")`.
Delete error: `toastApiError(err, "Couldn't delete user")`.

Force password reset (this is the conditional one; the existing code branches based on whether a temporary password is returned):

If the API response returns a temporary password (i.e., `tempPassword` field present) and the code copies it to clipboard:
```ts
await navigator.clipboard.writeText(tempPassword);
toastSuccess("Reset link sent", "Temporary credentials copied to clipboard.");
```

If the API response does not return a temporary password (email-only mode):
```ts
toastSuccess("Reset link sent");
```

Force password reset error: `toastApiError(err, "Couldn't send reset link")`.

- [ ] **Step 2: Migrate `_apply-to-existing-client.tsx`**

Apply the import migration. The success toast fires when polling completes.

Success: `toast.success("Re-score complete", { description: \`${n} updated\` })` (or similar) → `toastSuccess("Rescore complete", \`${count} applications updated.\`)` where `count` is the count of updated applications already available in the polling response handler.

Errors (3). Map:
- Status check fail: `toastApiError(err, "Couldn't start rescore")`.
- Polling fail: `toastApiError(err, "Couldn't complete rescore")`.
- Enqueue fail: `toastApiError(err, "Couldn't queue rescore")`.

- [ ] **Step 3: Migrate `_config-editor-client.tsx`**

Apply the import migration.

Success: `toastSuccess("Configuration saved")`.

Errors (3):
- Validation: `toastApiError(null, "Check your input", joinedZodMessages)`.
- Changes check: `toastApiError(err, "Couldn't save configuration")` (or whatever fits the existing branch).
- Save fail: `toastApiError(err, "Couldn't save configuration")`.

- [ ] **Step 4: Migrate `_export-button-client.tsx`**

Apply the import migration.

Success: `toast.success("Audit log exported")` → `toastSuccess("Audit log exported", "Download started.")`.

Errors (3):
- Auth: `toastApiError(null, "Couldn't export audit log", "Please sign in again.")`.
- Size: `toastApiError(null, "Couldn't export audit log", existingSizeMessage)` (preserve existing context message about size limits).
- Export fail: `toastApiError(err, "Couldn't export audit log")`.

- [ ] **Step 5: Migrate `_job-detail-sheet-client.tsx`**

Apply the import migration.

Archive success: `toastSuccess("Job archived")`.
Archive error: `toastApiError(err, "Couldn't archive job")`.

- [ ] **Step 6: Type-check**

```bash
pnpm --filter @aurahire/web run type-check
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(admin\)
git commit -m "feat(web): consistent toasts in admin portal

Migrates user actions (suspend/reactivate/role change/delete/
force password reset), AI config (save + apply to existing),
audit log export, and job archive to the toast helper.
Restandardizes \"Role changed to X\" as \"User role changed\" +
\"Now X.\" description. Adds \"Download started.\" subtext to
audit export.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Migrate misc + final verification

**Files:**
- Modify: `apps/web/components/bias/bias-override-modal.tsx`
- Modify: `apps/web/components/admin/raw-output-json-viewer.tsx`

- [ ] **Step 1: Migrate `bias-override-modal.tsx`**

Apply the import migration.

Success: `toast.success("Override saved")` → `toastSuccess("Override saved")`.

Errors (2):
- Validation: `toastApiError(null, "Check your input", "Please provide a justification before overriding.")` (preserve existing literal context if different).
- Auth / API fail: `toastApiError(err, "Couldn't save override")`.

- [ ] **Step 2: Migrate `raw-output-json-viewer.tsx`**

Apply the import migration.
Success: `toast.success("Copied to clipboard")` → `toastSuccess("Copied to clipboard")`.

- [ ] **Step 3: Confirm no `toast` imports from `sonner` remain in app code**

Run from repo root:
```bash
grep -rn "from \"sonner\"" apps/web/components apps/web/app apps/web/lib --include="*.tsx" --include="*.ts" || echo "No matches"
```
Expected: only one match — `apps/web/components/ui/sonner.tsx` (the Toaster component itself, which legitimately imports from sonner). No other file should import from `sonner` directly.

If any other file appears in the grep output, it was missed. Re-read the spec's "Files affected" section and apply the migration to that file before continuing.

- [ ] **Step 4: Type-check**

```bash
pnpm --filter @aurahire/web run type-check
```
Expected: no errors.

- [ ] **Step 5: Lint**

```bash
pnpm --filter @aurahire/web run lint
```
Expected: no new errors. The script runs `next lint`.

- [ ] **Step 6: Build**

```bash
pnpm --filter @aurahire/web run build
```
Expected: build succeeds. This is the strongest static check available without running the dev server (which Claude Code is forbidden from doing per CLAUDE.md hard rules).

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/bias/bias-override-modal.tsx apps/web/components/admin/raw-output-json-viewer.tsx
git commit -m "feat(web): consistent toasts in bias modal and clipboard

Final migration commit. Bias override modal and raw JSON viewer
moved to the toast helper. All app code now imports toast
helpers from @/lib/toast; only components/ui/sonner.tsx imports
from sonner directly (the Toaster component).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 8: Hand off to human for manual verification**

Output a message like:
> Implementation complete. Build passes. The toast helper, success-path additions, and wording standardization are committed across 8 commits.
>
> **Manual verification needed (Claude Code can't run the dev server):**
> 1. Start the app: `pnpm dev` (from repo root).
> 2. Auth: sign in (candidate, recruiter, admin), sign out, register a new account, forgot password, verify email link, reset password.
> 3. Onboarding: complete candidate flow end-to-end. Confirm only resume upload + final step toasts on success; intermediate steps are silent. Same for recruiter.
> 4. Recruiter portal: create/update/publish/archive a job; change application status; save notes; schedule interview; send offer.
> 5. Candidate portal: apply to job; withdraw; accept/decline offer; recompute score; update profile.
> 6. Admin portal: suspend/reactivate/role-change/delete user; force password reset; save AI config; apply config to existing; archive job; export audit log; save bias override.
> 7. Error paths: unplug Wi-Fi mid-submit and confirm fallback `Please try again.` shows; trigger known 4xx errors and confirm API messages surface in descriptions.

---

## Open log

Notes appended during implementation. Task 1 writes its audit results here.

### Task 1 results

Audit of the three read-only review pages in the candidate onboarding wizard.

**`apps/web/app/onboarding/candidate/education/page.tsx`**
- Component type: async server component (no `"use client"` directive)
- Mutation handler: none — page fetches parsed resume data server-side and renders a static list of education entries or an empty-state card
- Toast usage: none
- No client component imported with mutations
- Classification: **(c) no mutation** → no change needed

**`apps/web/app/onboarding/candidate/experience/page.tsx`**
- Component type: async server component (no `"use client"` directive)
- Mutation handler: none — page fetches parsed resume data server-side and renders a static list of work experience entries or an empty-state card
- Toast usage: none
- No client component imported with mutations
- Classification: **(c) no mutation** → no change needed

**`apps/web/app/onboarding/candidate/skills/page.tsx`**
- Component type: async server component (no `"use client"` directive)
- Mutation handler: none — page fetches parsed resume data server-side and renders skill chips and certification entries or an empty-state card
- Toast usage: none
- No client component imported with mutations
- Classification: **(c) no mutation** → no change needed

**Summary:** All three pages are pure server-rendered review steps in the wizard. They display data already parsed from the resume (fetched via `fetchLatestParsedResume`) and provide only `<Link>` navigation (Back / Continue). There are no `useMutation` hooks, no `fetch(` calls, no `@aurahire/shared` controller imports, and no rendered client components with mutation logic. Task 4 Step 7 ("Apply Task 1 results") is a no-op — no additional files need to be added to Task 4.
