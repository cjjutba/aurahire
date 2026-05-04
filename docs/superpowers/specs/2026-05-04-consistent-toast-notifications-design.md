# Consistent Toast Notifications — Design

**Date:** 2026-05-04
**Author:** brainstormed with Claude Code
**Status:** Approved (pending implementation plan)
**Scope:** `apps/web` only. No backend changes.

## Problem

Toast feedback is patchy across the three portals (candidate, recruiter, admin) and the auth/onboarding flows. Errors are well-covered (~30 sites), but ~10 successful mutations are silent — most notably login, register, logout, verify-email, forgot-password, and every onboarding step. Wording is also inconsistent: some toasts use em-dashes (`"Offer accepted — welcome aboard!"`), some use string interpolation in the title (`"Moved to ${newStatus}"`), some use generic fallbacks (`"Something went wrong"`) instead of API error messages. There is no central error-extraction helper, so each site reaches into the error shape differently.

The user reported this after noticing no toast on successful login.

## Goals

1. Every user-initiated mutation in `apps/web` produces a clear success or error toast (with documented exceptions).
2. Wording follows a single convention: terse past-tense titles, optional context as a separate description field, no emojis, no exclamation marks, no em/en-dashes, user-friendly language.
3. Error toasts surface the API error message via the `ApiErrorResponse` shape in `packages/shared`, with a sensible fallback when the message is missing or unreadable.
4. The convention is enforced via a thin helper module (`apps/web/lib/toast.ts`) so future sites cannot drift.

## Non-goals

- Real-time / websocket notifications (no server-pushed toasts for events caused by other users or background jobs).
- Notification center / persistent inbox / push notifications.
- Per-user notification preferences or muting.
- i18n — all literals are English.
- Toast accessibility tweaks beyond Sonner's defaults (`aria-live="polite"` is already correct).
- Sonner config changes (position, theme, package version unchanged).
- Backend changes — the `ApiErrorResponse` shape is already correct.
- Toast unit tests — manual verification across the three portals is sufficient for this sprint.

## Scope rules (what fires a toast)

A toast fires **only** when:
- The current user initiated the action via a UI interaction in this session (form submit, button click, link click that triggers a mutation).
- The action has a discrete result (success or failure) that the user is waiting on.

A toast does **not** fire for:
- Background jobs (cron, BullMQ workers, scheduled rescores).
- State changes caused by other users (e.g., a recruiter changing the status of an application the candidate happens to be viewing — no surprise toast).
- Polling-driven server-state updates that the current user did not trigger.
- Reads (page loads, list fetches, cache refreshes).
- Intermediate steps in multi-step flows where the page navigation is itself the success signal (see "Onboarding exception" below).

### Onboarding exception

Intermediate onboarding steps stay silent on success. The user clicking "Continue" and landing on the next step is sufficient feedback. Only the **final** step in each role's onboarding fires a success toast (`"Onboarding complete"`), because the destination dashboard is generic and the user benefits from explicit confirmation.

Exceptions to the exception:
- **Resume upload** is the first candidate onboarding step but takes 3–8s and produces a discrete result (parsed fields). It fires a success toast (`"Resume processed"`) because the user is waiting on a real action result, not a navigation.
- Error toasts fire on every step's failure (intermediate or final).

## Architecture

### Helper module: `apps/web/lib/toast.ts`

Two exports. No more.

```ts
import { toast } from "sonner";
import type { ApiErrorResponse } from "@aurahire/shared";

export function toastSuccess(title: string, description?: string) {
  toast.success(title, description ? { description } : undefined);
}

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
    if (typeof msg === "string" && msg.length > 0 && msg !== "Failed to fetch") return msg;
  }
  return null;
}
```

**Why no `toastInfo` / `toastWarning` / `toastValidation`:**
Validation toasts go through `toastApiError` with a `null` error and an explicit description: `toastApiError(null, "Check your input", zodMessages.join(", "))`. The `null` causes both `extractApiErrorMessage` branches to return null, so the explicit description shows. We don't need a fourth function. Info and warning toasts have no current callers and are not in scope.

### Sonner setup (unchanged)

- File: `apps/web/components/ui/sonner.tsx`
- Mount point: `apps/web/app/layout.tsx:35`
- Config: `position="bottom-right" richColors closeButton`

## Wording convention

### Title rules

- Terse past-tense action + object: `"Job published"`, `"Profile updated"`, `"Application sent"`.
- No emojis. No exclamation marks. No em/en-dashes.
- No string interpolation in the title — interpolated values go in the description.
- User-friendly language. Avoid technical jargon ("rescored", "redacted", "PII", "DTO"). Prefer plain English ("Score recalculated", "Resume processed").

### Description rules

- Optional. Only when there is meaningful side-effect context.
- One sentence, ends with a period.
- Holds interpolated values: `"Now in Interview."`, `"5 applications updated."`.
- No em/en-dashes. Two clauses become two sentences or one.

### Note on API error messages

The em-dash and wording rules above apply to **our** literals (titles and descriptions written in this codebase). When an API error message surfaces through `toastApiError` as a description, it appears verbatim — we do not rewrite backend-authored error strings. Backend wording is governed by `apps/api`, not this design.

### Error fallback

- `fallbackDescription = "Please try again."` when the API error message is missing or unreadable (e.g., network errors that surface as `"Failed to fetch"`).

## Toast inventory

### Auth (12 toasts across 7 sites)

| Action | Title | Description |
|---|---|---|
| Sign in success | `Signed in` | — |
| Sign in error | `Sign in failed` | API msg or fallback |
| Register success (candidate or recruiter) | `Account created` | `Check your email to verify.` |
| Register error | `Couldn't create account` | API msg |
| Sign out success | `Signed out` | — |
| Sign out error | `Sign out failed` | API msg |
| Verify email success | `Email verified` | `Redirecting to your dashboard.` |
| Verify email error | `Verification failed` | API msg |
| Forgot password success | `Reset link sent` | `Check your inbox.` |
| Forgot password error | `Couldn't send reset link` | API msg |
| Reset password success | `Password updated` | `Please sign in.` |
| Reset password error | `Couldn't reset password` | API msg |

### Onboarding (final-step toast only)

| Action | Title | Description |
|---|---|---|
| Resume parsed (candidate step 1) | `Resume processed` | `Review the prefilled fields before continuing.` |
| Resume upload error | `Couldn't process resume` | API msg |
| Candidate onboarding complete | `Onboarding complete` | `Welcome to AuraHire.` |
| Recruiter onboarding complete | `Onboarding complete` | `Welcome to AuraHire.` |
| Intermediate step saves (personal-info, education, experience, skills, about, company) | **silent on success** | — |
| Intermediate step errors | site-specific title (e.g. `Couldn't save personal info`) | API msg |

### Candidate portal

| Action | Title | Description |
|---|---|---|
| Update profile settings | `Profile updated` | — |
| Recompute profile score | `Score recalculated` | — |
| Apply to job | `Application sent` | `We'll notify you when there's an update.` |
| Withdraw application | `Application withdrawn` | — |
| Accept offer | `Offer accepted` | `Welcome aboard.` |
| Decline offer | `Offer declined` | — |

### Recruiter portal

| Action | Title | Description |
|---|---|---|
| Update profile settings | `Profile updated` | — |
| Create job | `Job created` | — |
| Update job | `Job updated` | — |
| Publish job | `Job published` | — |
| Archive job | `Job archived` | — |
| Change application status | `Status updated` | `` Now in ${newStatus}. `` |
| Save application notes | `Notes saved` | — |
| Schedule interview | `Interview scheduled` | `Candidate notified.` |
| Send offer | `Offer sent` | `Candidate notified.` |

### Admin portal

| Action | Title | Description |
|---|---|---|
| Suspend user | `User suspended` | — |
| Reactivate user | `User reactivated` | — |
| Change user role | `User role changed` | `` Now ${newRole}. `` |
| Delete user | `User deleted` | — |
| Force password reset (temp password mode) | `Reset link sent` | `Temporary credentials copied to clipboard.` |
| Force password reset (email-only mode) | `Reset link sent` | — |
| Save AI config | `Configuration saved` | — |
| Apply config to existing | `Rescore complete` | `` ${n} applications updated. `` (when polling completes) |
| Archive job | `Job archived` | — |
| Export audit log | `Audit log exported` | `Download started.` |
| Bias override saved | `Override saved` | — |
| Copy to clipboard | `Copied to clipboard` | — |

### Validation (Zod schema fail before submit)

| Action | Title | Description |
|---|---|---|
| Client-side Zod validation fail | `Check your input` | comma-joined Zod field messages |

## Files affected

**1 new file** + **~32 file edits**.

### New
- `apps/web/lib/toast.ts`

### Auth (7)
- `apps/web/components/auth/login-form.tsx` — migrate 5 errors; add success toast.
- `apps/web/components/auth/register-candidate-form.tsx` — migrate; add success toast.
- `apps/web/components/auth/register-recruiter-form.tsx` — migrate; add success toast.
- `apps/web/components/auth/forgot-password-form.tsx` — add success + error toasts (currently swallows errors at `.catch(() => {})`; remove that suppression).
- `apps/web/components/auth/reset-password-form.tsx` — migrate; restandardize wording.
- `apps/web/app/(auth)/verify-email/verify-email-client.tsx` — add success + error toasts when status resolves.
- `apps/web/components/layout/portal-topbar.tsx` — migrate logout error; add success toast.

### Onboarding (6 confirmed)
- `apps/web/components/onboarding/candidate/resume-upload.tsx` — migrate; restandardize wording.
- `apps/web/components/onboarding/candidate/personal-info-form.tsx` — migrate error only; intermediate step stays silent on success.
- `apps/web/components/onboarding/candidate/preferences-form.tsx` — migrate errors; add success toast on `completeOnboarding`.
- `apps/web/components/onboarding/recruiter/about-form.tsx` — migrate error only.
- `apps/web/components/onboarding/recruiter/company-form.tsx` — migrate error only.
- `apps/web/components/onboarding/recruiter/focus-form.tsx` — migrate errors; add success toast on `completeOnboarding`.

### Onboarding pages — first action of implementation plan: confirm shape
The implementation plan's first task includes reading `apps/web/app/onboarding/candidate/education/page.tsx`, `experience/page.tsx`, and `skills/page.tsx` (plus any client components they render) to determine whether they contain client-side mutations. Apply this rule per file:
- If the file contains a mutation handler (form submit calling an API): add error-only toast (no success toast — intermediate step).
- If the file is a server component or a thin wrapper with no mutation: do not modify.
The file count above (32) does not include these three; whether they are touched is data-dependent and resolved during implementation, not now.

### Recruiter portal (6)
- `apps/web/app/(recruiter)/recruiter/settings/_settings-form-client.tsx`
- `apps/web/app/(recruiter)/recruiter/jobs/[id]/job-actions.tsx`
- `apps/web/app/(recruiter)/recruiter/applications/[id]/_actions-client.tsx` — rewrite `"Moved to ${newStatus}"` to use new convention.
- `apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-modal-client.tsx`
- `apps/web/app/(recruiter)/recruiter/offers/new/_offer-form-client.tsx` — remove em-dash from `"Offer sent — candidate notified"`.
- `apps/web/components/jobs/job-form.tsx` — distinguish `"Job created"` vs `"Job updated"`.

### Candidate portal (6)
- `apps/web/app/(candidate)/candidate/settings/_settings-form-client.tsx`
- `apps/web/app/(candidate)/candidate/profile/_recompute-button-client.tsx`
- `apps/web/app/(candidate)/candidate/_components/profile-score-card-client.tsx`
- `apps/web/app/(candidate)/candidate/applications/[id]/_offer-actions-client.tsx` — remove em-dash from `"Offer accepted — welcome aboard!"`.
- `apps/web/app/(candidate)/candidate/applications/[id]/_withdraw-button-client.tsx`
- `apps/web/app/(candidate)/candidate/jobs/[id]/apply/_apply-form-client.tsx`

### Admin portal (5)
- `apps/web/app/(admin)/admin/users/_action-modals-client.tsx` — rewrite `"Role changed to ${newRole}"` to use new convention.
- `apps/web/app/(admin)/admin/ai-config/_apply-to-existing-client.tsx`
- `apps/web/app/(admin)/admin/ai-config/_config-editor-client.tsx`
- `apps/web/app/(admin)/admin/audit/_export-button-client.tsx`
- `apps/web/app/(admin)/admin/jobs/_job-detail-sheet-client.tsx`

### Other (2)
- `apps/web/components/bias/bias-override-modal.tsx`
- `apps/web/components/admin/raw-output-json-viewer.tsx`

### Not changing
- `apps/web/components/ui/sonner.tsx`
- `apps/web/app/layout.tsx`
- `package.json` (no version bump)
- Any backend code

## Edge cases

1. **Forgot-password security model.** API always returns success regardless of whether the email exists (anti-enumeration). Always show `"Reset link sent"`. Never reveal email existence.
2. **Email-already-registered during signup.** Surfaces as a form field error (not a toast). Don't double up.
3. **Throttle (429) responses.** Custom messages from the API (e.g. `"Hold on — we just rescored a moment ago."`) flow through `toastApiError` as descriptions. No special-casing needed.
4. **Validation runs before mutation.** Every form: Zod validation toast (`"Check your input"`) fires first with early return, then mutation runs. The two never fire together.
5. **Verify-email already-verified state.** Treat as success (`"Email verified"`), not warning. Goal achieved either way.
6. **Network failures.** When `err.message === "Failed to fetch"`, `extractApiErrorMessage` returns null, caller's fallback `"Please try again."` shows.
7. **Double-click protection.** Sonner doesn't dedupe. We rely on existing `isSubmitting` button-disabled pattern in every form. No additional dedupe logic.
8. **Slow actions (resume parse, AI rescore, audit export).** Loading state is the button spinner, not a `toast.promise()` call. Toast fires only on result.
9. **Polling for user-initiated long actions.** The admin "Apply config to existing" action polls until done. The user clicked the button, so the eventual success toast is in scope. If they navigate away mid-poll, the polling promise still resolves; this is existing behavior and not in scope to change.

## Open questions

None. All four clarifying questions resolved during brainstorming:
- Q1 scope: maximalist except intermediate onboarding steps; user-initiated only.
- Q2 centralization: thin helper at `lib/toast.ts`.
- Q3 wording: terse past-tense, no emojis/exclamations/em-dashes, user-friendly.
- Q4 loading: keep button spinner; no `toast.promise()`.

## Verification plan

Manual verification across the three portals after implementation:
- **Auth:** sign in (candidate/recruiter/admin), sign out, register, forgot password, verify email, reset password.
- **Onboarding:** complete candidate flow end-to-end (resume upload, personal info, education, experience, skills, preferences). Confirm only resume upload + final step toast on success; intermediate steps are silent. Same for recruiter (about, company, focus).
- **Recruiter portal:** create/update/publish/archive a job; change application status; save notes; schedule interview; send offer.
- **Candidate portal:** apply to job; withdraw; accept/decline offer; recompute score; update profile.
- **Admin portal:** suspend/reactivate/role-change/delete user; force password reset; save AI config; apply config to existing; archive job; export audit log; save bias override.
- **Error paths:** unplug Wi-Fi mid-submit, confirm fallback `"Please try again."` shows; trigger known 4xx errors, confirm API message surfaces in description.
