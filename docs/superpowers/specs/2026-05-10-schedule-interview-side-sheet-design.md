# Schedule Interview - Center Modal → Right-Side Sheet

**Date:** 2026-05-10
**Owner:** UX polish, recruiter portal (application detail → schedule interview)
**Status:** approved (option B - port the existing form to a right-side sheet, reorganize for the new canvas, drop the redundant nested confirm dialog)

## Problem

`apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-modal-client.tsx` renders the Schedule Interview form inside a centered `Dialog` capped at `max-w-lg` (512px) and `max-h-[90vh]`. The form has six logical sections - saved-venue selector, date/time + duration, venue details, candidate guidance, interviewer, save-as-template panel - and it visibly cramps in the modal. Users describe the result as "a lot of fields in a small box."

Two specific UX smells flow from the format:

1. **Nested confirmation.** Submitting calls `confirm()` (`apps/web/components/providers/confirm-provider`) which opens a second confirm dialog _on top of_ the modal - a "are you sure?" centered dialog inside another centered dialog. The body copy of that confirm ("Candidate will receive an email…") is also already present as the modal's `DialogDescription`, so it's a duplicate gesture, not added safety.
2. **Inset gray "Save as venue template" panel.** The current modal wraps the template checkbox in a `bg-[var(--color-surface-soft)]` rounded card to visually separate it from the rest of the form. That visual separation only exists because the modal is too narrow to let whitespace alone do the job - it's a concession to cramped real estate, not an editorial choice.

The application detail surface this modal opens from already uses a right-side sheet pattern in the admin portal (`apps/web/app/(admin)/admin/applications/_application-detail-sheet-client.tsx`, plus admin jobs/audit/feedback). The Sheet primitive (`apps/web/components/ui/sheet.tsx`) is shadcn-equivalent with `data-side` slide-in and backdrop blur. Moving Schedule Interview to a right sheet brings:

- Substantially more vertical room → form sections can breathe with whitespace alone.
- Sticky header (title + description) and sticky footer (Cancel + primary CTA) → the commit action is always reachable without scrolling.
- The sheet's own pill CTA becomes the explicit commit, so the nested confirm dialog becomes redundant and is removed.
- Visual continuity with the admin portal's existing right-sheet pattern, which already lives in this codebase.

## Goal

Replace the centered Dialog with a right-side `Sheet`, sized and laid out so the existing form contents can be read top-to-bottom without horizontal cramping, and remove the redundant nested confirm step.

This is **presentation + flow polish only** - no backend changes, no schema changes, no API changes, no new fields. Only the recruiter-facing component that wraps the existing form changes.

## Scope

**In scope:**

- Convert `apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-modal-client.tsx` to render a `Sheet` from `@/components/ui/sheet` instead of a `Dialog` from `@/components/ui/dialog`.
- Override the Sheet's default `sm:max-w-sm` to `sm:max-w-2xl` (672px); keep mobile behavior at the primitive's default `w-3/4`.
- Sticky `SheetHeader` (title + description, hairline divider below) and sticky `SheetFooter` (Cancel + primary pill, hairline divider above). The middle scrolls.
- Drop the `confirm()` step in `submit()` - the sheet's footer pill CTA is the explicit commit. The candidate-notification copy already lives in the SheetDescription, so no information is lost.
- Drop the inset gray "save as template" card; render the checkbox flat with the same indent grid as the rest of the form, and reveal the "Template label" input below it on toggle.
- Keep section eyebrow labels (`VENUE DETAILS`, `CANDIDATE GUIDANCE`, `INTERVIEWER`) - they match the DESIGN.md `caption-strong` token (12px / 600 / uppercase / 0.04em tracking) and the editorial brand voice.
- Keep Date & Time and Duration side-by-side at `sm:` and up (single column on mobile, already handled by the existing `grid sm:grid-cols-2`).
- Rename the component's exported function from `ScheduleInterviewModalClient` → `ScheduleInterviewSheetClient` and rename the file from `_schedule-interview-modal-client.tsx` → `_schedule-interview-sheet-client.tsx`. Update the single import site (`_interviews-section-client.tsx`).

**Out of scope:**

- The reschedule modal (`apps/web/components/interview/reschedule-modal-client.tsx`) - it's a different flow with its own design and its own call sites; not touched here.
- Adding a candidate-context strip (score ring + match band + job title) inside the sheet - explicitly rejected during brainstorming. Stays a focused form, not a hybrid context view.
- Adding interviewer-availability/calendar conflict detection beyond what already exists. The current `/check-conflicts` POST + advisory chip behavior is preserved as-is.
- Backend changes (interviews controller, service, DTO, queue, email templates, audit logging - all unchanged).
- Any change to the `?schedule=1` URL-param auto-open trigger from `_decision-bar-client.tsx`. The sheet binds to the same `open` / `onOpenChange` props the modal exposed today.
- An "unsaved changes" guard on dismiss. YAGNI for the sprint; the Cancel button and Escape are deliberate dismiss actions, and the form auto-resets on next open.
- A new top-level `/recruiter/interviews/new` route. The sheet stays a child of the application detail page so the recruiter doesn't lose the candidate context they just acted on.

## Design

### Anatomy

```
┌──────────────────────────────────────────────────────┐
│ STICKY HEADER (border-b hairline)                     │
│  Schedule Interview                              ╳    │
│  Candidate will receive an email with the date,       │
│  time, and venue details.                             │
├──────────────────────────────────────────────────────┤
│ SCROLLABLE BODY (overflow-y-auto, px-6 py-5)          │
│                                                       │
│  Use saved venue         (only if templates exist)    │
│  [Select template…                              ▾]   │
│                                                       │
│  ┌─Date & Time *────────┐ ┌─Duration (min)──┐        │
│  │ datetime-local       │ │ 60              │        │
│  └──────────────────────┘ └─────────────────┘        │
│  ⚠ Scheduling conflict detected - proceed anyway      │
│  (chip; only shown when /check-conflicts returns true)│
│                                                       │
│  VENUE DETAILS                                        │
│  Venue name *  […]                                    │
│  Address *     […]                                    │
│  ┌─Room/Floor──────────┐ ┌─Map URL ─────────────┐    │
│  │ […]                 │ │ […]                  │    │
│  └─────────────────────┘ └──────────────────────┘    │
│                                                       │
│  CANDIDATE GUIDANCE                                   │
│  Reporting instructions   [textarea, 3 rows]          │
│  What to bring            [textarea, 2 rows]          │
│                                                       │
│  INTERVIEWER                                          │
│  ┌─Name─────────────┐ ┌─Title──────────────────┐    │
│  │ […]              │ │ […]                    │    │
│  └──────────────────┘ └────────────────────────┘    │
│                                                       │
│  ☐ Save as venue template for future interviews       │
│  └ (when checked, reveals "Template label *" input)   │
│                                                       │
├──────────────────────────────────────────────────────┤
│ STICKY FOOTER (border-t hairline)                     │
│  [Cancel]              [✓ Schedule interview]         │
└──────────────────────────────────────────────────────┘
```

### Component shape

The component's prop contract is unchanged from today:

```ts
interface Props {
  applicationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

All internal state, queries, conflict detection, validation, and submit logic are preserved verbatim from the existing modal. The only structural changes are:

1. **Outer shell** - `<Dialog>` / `<DialogContent>` / `<DialogHeader>` / `<DialogTitle>` / `<DialogDescription>` / `<DialogFooter>` → `<Sheet>` / `<SheetContent side="right">` / `<SheetHeader>` / `<SheetTitle>` / `<SheetDescription>` / `<SheetFooter>`.
2. **`<SheetContent>` className** - override the primitive's default `sm:max-w-sm` with `sm:max-w-2xl`, and stack as `flex flex-col` so header/footer pin and the middle div takes `flex-1 overflow-y-auto`.
3. **Submit handler** - delete the `confirm({...})` call and the `if (!ok) return` early-out. Keep the rest of `submit()` exactly as today.
4. **Save-template panel** - drop the surrounding `<div className="rounded-md border bg-surface-soft p-3">`. Replace with a flat `<label className="flex items-start gap-2.5">` for the checkbox, then conditionally render the template-label `<Input>` below it without an inset background.
5. **File + symbol rename** - `_schedule-interview-modal-client.tsx` → `_schedule-interview-sheet-client.tsx`; `ScheduleInterviewModalClient` → `ScheduleInterviewSheetClient`. Update import in `_interviews-section-client.tsx`.

### Layout tokens

| Surface               | Value                                                                                      | Source                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sheet width (≥ sm)    | `sm:max-w-2xl` (672px)                                                                     | Form has 6 sections + side-by-side fields; 672px gives room for two-column inner grids without crowding. Default `sm:max-w-sm` (384px) is too narrow. |
| Sheet width (mobile)  | `w-3/4`                                                                                    | Sheet primitive default; full-bleed feel without losing the dismiss-by-overlay-tap affordance.                                                        |
| Outer padding         | `px-6 py-5` on body, `p-4` on header/footer (per primitive)                                | Matches existing admin sheets (`_application-detail-sheet-client.tsx`).                                                                               |
| Section gap           | `space-y-6`                                                                                | Editorial pacing; one step looser than the modal's `space-y-5`.                                                                                       |
| Section eyebrow       | 12px / 600 / uppercase / `tracking-wider` / `text-muted`                                   | DESIGN.md `caption-strong`. Identical to today.                                                                                                       |
| Field label           | 12px / 600 / uppercase / `tracking-wider` / `text-muted`                                   | Same `FieldLabel` component, identical to today.                                                                                                      |
| Sticky-header divider | `border-b border-[var(--color-hairline)]`                                                  | Hairline only, no shadow tier. Matches DESIGN.md "one shadow tier" rule.                                                                              |
| Sticky-footer divider | `border-t border-[var(--color-hairline)]`                                                  | Same.                                                                                                                                                 |
| Footer alignment      | Right-aligned actions; Cancel as `variant="outline"`, primary as `bg-primary` rounded-pill | Matches the existing modal's footer pattern.                                                                                                          |

### Behavior

| Surface                    | Behavior                                                                                                                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open trigger               | Same `?schedule=1` URL param read by `_interviews-section-client.tsx`. The sheet binds to `open` / `onOpenChange` exactly like the modal.                                                                                               |
| Close affordances          | (a) ✕ button in top-right (rendered by Sheet primitive's `showCloseButton`); (b) Escape key (Base UI dialog default); (c) clicking the backdrop overlay (Base UI default); (d) Cancel button in footer. All call `onOpenChange(false)`. |
| Submit                     | Footer primary pill calls existing `submit()` - minus the nested `confirm()` step. Validation toasts (`toastApiError`) unchanged. Success path: `toastSuccess`, `reset()`, `onOpenChange(false)`, `router.refresh()`.                   |
| Conflict detection         | Unchanged. 500ms debounce on `scheduledAt` / `durationMinutes`, advisory chip when conflicts found, recruiter can still proceed.                                                                                                        |
| Saved-venue auto-fill      | Unchanged. Selecting a venue from the dropdown autofills the form fields below.                                                                                                                                                         |
| Form reset on close        | Existing `reset()` behavior preserved - runs on successful submit only. (Closing without submitting keeps form state for the session, same as today.)                                                                                   |
| Auto-seed interviewer name | Existing `useEffect` on `open` change - unchanged.                                                                                                                                                                                      |
| Mobile (< sm)              | Sheet primitive's default behavior: slides in from right at `w-3/4`, body scrolls, header/footer remain pinned.                                                                                                                         |

### Out-of-modal-confirm-dialog rationale

Today the submit path is:

```
User clicks "Schedule interview" pill
  → confirm() opens nested dialog with title
    "Schedule this interview?" + same email-notification copy
  → user clicks "Schedule interview" again to confirm
  → actual POST happens
```

Two clicks, two dialogs, with the second dialog re-asserting copy already visible at the top of the first. This is "double-tap confirm" - the pattern reserved for destructive or hard-to-reverse actions. Scheduling an interview is neither. The sheet's footer pill is the explicit commit (the same affordance as a Send button on a compose form), and the candidate-notification copy is already permanent in the SheetDescription. Removing the nested confirm reduces the action to one click without losing the warning.

The `Reject` action's confirm-dialog stays as-is - that one _is_ destructive and benefits from the double-tap. This change is scoped to schedule-interview only.

## Files touched

| Path                                                                                        | Change                                                                                                                               |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-sheet-client.tsx` | **New file** (renamed from `_schedule-interview-modal-client.tsx`). Same logic minus nested `confirm()`, with Sheet primitive shell. |
| `apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-modal-client.tsx` | **Deleted.**                                                                                                                         |
| `apps/web/app/(recruiter)/recruiter/applications/[id]/_interviews-section-client.tsx`       | Update single import: `ScheduleInterviewModalClient` → `ScheduleInterviewSheetClient`, file path swap. No other change.              |

No other files in the repo reference the modal.

## Acceptance criteria

1. Move to Interview from `/recruiter/applications/[id]` → status changes to `interview` → URL gains `?schedule=1` → a right-side sheet slides in (not a centered modal).
2. The sheet is ~672px wide on desktop, slides full-bleed-ish on mobile, has a sticky header with title and description, a scrollable body, and a sticky footer with Cancel + primary pill.
3. All form fields, validation, conflict-detection chip, saved-venue dropdown, and save-as-template behavior work exactly as before.
4. Clicking the primary "Schedule interview" pill submits in one click - there is no second confirm dialog.
5. The save-as-template area is a flat checkbox on the sheet body (no inset gray card).
6. Closing the sheet via any affordance (✕, Escape, backdrop click, Cancel) sets `scheduleOpen = false` and unmounts the sheet body. The `?schedule=1` URL scrub already happens on auto-open detection (`_interviews-section-client.tsx` line 365 `router.replace(pathname)`) and is unrelated to close.
7. No regressions to interview-list rendering, no regressions to the reschedule modal, no regressions to the Reject confirm dialog.
8. `pnpm tsc --noEmit` and `pnpm lint` both pass.

## Known non-goals (explicit YAGNI)

- No new sheet variants in the design system. Only this one usage adopts the wider `sm:max-w-2xl` override; no shared "wide sheet" component is extracted.
- No motion / animation changes. The Sheet primitive's existing slide-in-from-right and backdrop-blur transitions are unchanged.
- No new fields, no new venue templates UI, no new interviewer roster lookup.
- No analytics events added.
- No internationalization changes; copy stays English.
