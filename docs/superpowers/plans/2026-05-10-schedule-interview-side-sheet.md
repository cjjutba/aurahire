# Schedule Interview — Center Modal → Right-Side Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the centered `Dialog` Schedule Interview modal at `apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-modal-client.tsx` with a right-side `Sheet` that gives the form room to breathe, removes the redundant nested confirm dialog on submit, and follows the same right-sheet pattern already used by the admin portal.

**Architecture:** Single-file rewrite + one-line import update + one-file delete. New file `_schedule-interview-sheet-client.tsx` exports `ScheduleInterviewSheetClient` with the same `{ applicationId, open, onOpenChange }` prop contract. All form state, queries, conflict-detection, validation, saved-venue auto-fill, and submit logic are preserved verbatim except the inner `confirm()` step which is removed (the sheet's footer pill is the explicit commit). Outer shell swaps `Dialog/DialogContent/...` → `Sheet/SheetContent/...` from `@/components/ui/sheet`. Width override: `sm:max-w-2xl`. Save-as-template panel sheds its inset gray card and renders flat.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 + brand CSS variables (`var(--color-*)`, `var(--radius-*)`), `@base-ui/react/dialog` (already a dep, used by `Sheet` primitive), TanStack Query (already a dep), `lucide-react` (already a dep). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-10-schedule-interview-side-sheet-design.md` is authoritative for behavior, tokens, and out-of-scope decisions. When in doubt, defer to that spec.

---

## File Structure

### New file

- `apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-sheet-client.tsx` — sheet-shelled Schedule Interview form. Replaces the modal version.

### Modified file

- `apps/web/app/(recruiter)/recruiter/applications/[id]/_interviews-section-client.tsx` — single import + JSX symbol update (`ScheduleInterviewModalClient` → `ScheduleInterviewSheetClient`).

### Deleted file

- `apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-modal-client.tsx` — superseded by the sheet client.

### Untouched (intentionally)

- `apps/web/components/ui/sheet.tsx` — primitive is already correct; the per-usage width override goes on `<SheetContent>`'s `className`, not on the primitive.
- `apps/web/components/ui/dialog.tsx` — still used elsewhere (Reject confirm, reschedule modal, other dialogs).
- `apps/web/components/interview/reschedule-modal-client.tsx` — different flow, untouched.
- `apps/web/app/(recruiter)/recruiter/applications/[id]/_decision-bar-client.tsx` — already redirects to `?schedule=1` after Move to Interview; behavior preserved.
- `apps/web/components/providers/confirm-provider.tsx` — still used by Reject and other destructive paths; only the schedule-submit nested call goes away.
- `apps/api/**` — backend is unchanged. No DTO, controller, service, queue, audit, or email change.
- `packages/shared/**` and `packages/db/**` — unchanged.

### No new files beyond the one above

The sheet width override is local to one usage; we are not extracting a shared "wide sheet" component (YAGNI per spec).

---

## Conventions used in every step

- **Brand tokens only:** `var(--color-primary)`, `var(--color-primary-active)`, `var(--color-primary-soft)`, `var(--color-on-primary)`, `var(--color-ink)`, `var(--color-body)`, `var(--color-muted)`, `var(--color-muted-soft)`, `var(--color-canvas)`, `var(--color-surface-soft)`, `var(--color-hairline)`, `var(--color-status-danger)`, `var(--color-score-mid)`, `var(--color-score-mid-soft)`. No raw hex.
- **Radius tokens:** `var(--radius-pill)` for buttons, `var(--radius-md)` for inputs/textareas. The Sheet primitive's container does not use a radius (full-height edge panel).
- **No new imports beyond the Sheet replacements.** The new file removes `Dialog*` imports from `@/components/ui/dialog` and adds `Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle` from `@/components/ui/sheet`. It also removes `useConfirm` from `@/components/providers/confirm-provider` (no longer used). Everything else is identical.
- **Strict TS:** no `any`, no `as` casts beyond what the modal already had (`session.user.user_metadata?.full_name as string | undefined` at line 139 — preserved verbatim).
- **Engineer cannot run dev servers, migrations, or deploys** (per `CLAUDE.md` Hard Rules). Verification is `pnpm tsc --noEmit`, `pnpm lint`, and a manual browser smoke-test by the human.
- **Each task ends with a commit step.** Commits are atomic per task — if the human asks the engineer to skip a commit, mark the step manually skipped and continue.

---

## Task 1: Create `_schedule-interview-sheet-client.tsx`

**Files:**

- Create: `apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-sheet-client.tsx`

**What:** Writes the new sheet-shelled component. Same prop contract, same form fields, same logic, except: (a) outer shell uses `Sheet`/`SheetContent`/etc. instead of `Dialog`/`DialogContent`/etc.; (b) the `submit()` function no longer calls `confirm()`; (c) the save-as-template area is a flat checkbox; (d) the content has a sticky header / scrollable body / sticky footer layout.

- [ ] **Step 1: Confirm starting state of the modal file**

Run:

```bash
wc -l apps/web/app/\(recruiter\)/recruiter/applications/\[id\]/_schedule-interview-modal-client.tsx
```

Expected: `565 apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-modal-client.tsx` (or close; confirms you're working from the same starting point as this plan). If the line count differs by more than ±20, stop and reconcile with the spec before continuing — the modal may have been modified since the spec was written.

Read the imports block (lines 1–32) and the prop interface (line 59–63). The `Props` interface should be:

```ts
interface Props {
  applicationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

If it differs, stop.

- [ ] **Step 2: Create the new file with the sheet implementation**

Write `apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-sheet-client.tsx` with this exact content:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Building2 } from "lucide-react";

import { toastSuccess, toastApiError } from "@/lib/toast";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { getActiveCompanyId } from "@/lib/active-company";
import { queryKeys } from "@/lib/query";
import { clientApiFetch } from "@/hooks/_client-fetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InterviewVenueItem {
  id: string;
  label: string;
  venueName: string;
  addressLine: string;
  roomOrFloor: string | null;
  mapUrl: string | null;
  reportingInstructions: string | null;
  whatToBring: string | null;
  interviewerName: string | null;
  interviewerTitle: string | null;
}

interface VenueListResponse {
  data: InterviewVenueItem[];
}

interface ConflictCheck {
  hasConflicts: boolean;
  conflicts?: Array<{ candidateName: string; scheduledAt: string }>;
}

interface Props {
  applicationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Field label helper
// ---------------------------------------------------------------------------

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
      {children}
      {required && (
        <span aria-hidden className="ml-0.5 text-[var(--color-status-danger)]">
          *
        </span>
      )}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScheduleInterviewSheetClient({
  applicationId,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const companyId = getActiveCompanyId();

  // ── Core scheduling fields ────────────────────────────────────────────────
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);

  // ── Structured venue fields ───────────────────────────────────────────────
  const [venueName, setVenueName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [roomOrFloor, setRoomOrFloor] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [mapUrlError, setMapUrlError] = useState("");
  const [reportingInstructions, setReportingInstructions] = useState("");
  const [whatToBring, setWhatToBring] = useState("");

  // ── Interviewer ───────────────────────────────────────────────────────────
  const [interviewerName, setInterviewerName] = useState("");
  const [interviewerTitle, setInterviewerTitle] = useState("");

  // ── Template save ─────────────────────────────────────────────────────────
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateLabel, setTemplateLabel] = useState("");

  // ── Conflict detection ────────────────────────────────────────────────────
  const [conflicts, setConflicts] = useState<ConflictCheck | null>(null);
  const conflictTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Submission ────────────────────────────────────────────────────────────
  const [working, setWorking] = useState(false);

  // ── Seed interviewer name from session on first open ─────────────────────
  useEffect(() => {
    if (!open) return;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const fullName =
        (session.user.user_metadata?.full_name as string | undefined) ??
        session.user.email?.split("@")[0] ??
        "";
      setInterviewerName((prev) => (prev ? prev : fullName));
    })();
  }, [open]);

  // ── Saved venues query ────────────────────────────────────────────────────
  const venuesQuery = useQuery({
    queryKey: queryKeys.interviewVenues.byCompany(companyId ?? ""),
    queryFn: ({ signal }) =>
      clientApiFetch<VenueListResponse>(
        `/api/v1/companies/${companyId}/interview-venues`,
        { signal },
      ),
    enabled: open && Boolean(companyId),
    staleTime: 60_000,
  });

  const venues = venuesQuery.data?.data ?? [];

  // ── Autofill from saved venue ─────────────────────────────────────────────
  function applyVenue(venueId: string | null) {
    if (!venueId) return;
    const venue = venues.find((v) => v.id === venueId);
    if (!venue) return;
    setVenueName(venue.venueName);
    setAddressLine(venue.addressLine);
    setRoomOrFloor(venue.roomOrFloor ?? "");
    setMapUrl(venue.mapUrl ?? "");
    setMapUrlError("");
    setReportingInstructions(venue.reportingInstructions ?? "");
    setWhatToBring(venue.whatToBring ?? "");
    if (venue.interviewerName) setInterviewerName(venue.interviewerName);
    if (venue.interviewerTitle) setInterviewerTitle(venue.interviewerTitle);
  }

  // ── Conflict detection: debounced 500ms after scheduledAt or duration changes
  useEffect(() => {
    if (!scheduledAt) {
      setConflicts(null);
      return;
    }
    if (conflictTimerRef.current) clearTimeout(conflictTimerRef.current);
    conflictTimerRef.current = setTimeout(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
        const res = await fetch(
          `${apiUrl}/api/v1/applications/${applicationId}/interviews/check-conflicts`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              scheduledAt: new Date(scheduledAt).toISOString(),
              durationMinutes,
            }),
          },
        );
        if (res.ok) {
          const body = (await res.json()) as { data: ConflictCheck };
          setConflicts(body.data);
        }
      } catch {
        // Silently swallow — conflict check is advisory only.
      }
    }, 500);
    return () => {
      if (conflictTimerRef.current) clearTimeout(conflictTimerRef.current);
    };
  }, [scheduledAt, durationMinutes, applicationId]);

  // ── Map URL validation ────────────────────────────────────────────────────
  function validateMapUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed)
      ? ""
      : "Must start with http:// or https://";
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function reset() {
    setScheduledAt("");
    setDurationMinutes(60);
    setVenueName("");
    setAddressLine("");
    setRoomOrFloor("");
    setMapUrl("");
    setMapUrlError("");
    setReportingInstructions("");
    setWhatToBring("");
    setInterviewerName("");
    setInterviewerTitle("");
    setSaveAsTemplate(false);
    setTemplateLabel("");
    setConflicts(null);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function submit() {
    if (!scheduledAt) {
      toastApiError(null, "Check your input", "Pick a date and time.");
      return;
    }
    if (!venueName.trim()) {
      toastApiError(null, "Check your input", "Venue name is required.");
      return;
    }
    if (!addressLine.trim()) {
      toastApiError(null, "Check your input", "Address is required.");
      return;
    }
    const urlErr = validateMapUrl(mapUrl);
    if (urlErr) {
      setMapUrlError(urlErr);
      return;
    }
    if (saveAsTemplate && !templateLabel.trim()) {
      toastApiError(
        null,
        "Check your input",
        "Enter a label for the saved venue.",
      );
      return;
    }

    setWorking(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toastApiError(
          null,
          "Couldn't schedule interview",
          "Please sign in again.",
        );
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const activeCompanyId = getActiveCompanyId();

      const res = await fetch(
        `${apiUrl}/api/v1/applications/${applicationId}/interviews`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            ...(activeCompanyId
              ? { "X-Active-Company-Id": activeCompanyId }
              : {}),
          },
          body: JSON.stringify({
            scheduledAt: new Date(scheduledAt).toISOString(),
            durationMinutes,
            format: "in-person",
            venueName: venueName.trim(),
            addressLine: addressLine.trim(),
            roomOrFloor: roomOrFloor.trim() || null,
            mapUrl: mapUrl.trim() || null,
            reportingInstructions: reportingInstructions.trim() || null,
            whatToBring: whatToBring.trim() || null,
            interviewerName: interviewerName.trim() || null,
            interviewerTitle: interviewerTitle.trim() || null,
            saveAsTemplate,
            templateLabel: saveAsTemplate ? templateLabel.trim() : undefined,
          }),
        },
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toastApiError(null, "Couldn't schedule interview", body.message);
        return;
      }

      toastSuccess("Interview scheduled", "Candidate notified.");
      reset();
      onOpenChange(false);
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-[var(--color-hairline)] p-6">
          <SheetTitle className="text-base font-semibold text-[var(--color-ink)]">
            Schedule Interview
          </SheetTitle>
          <SheetDescription className="text-sm text-[var(--color-body)]">
            Candidate will receive an email with the date, time, and venue
            details.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            {/* ── Saved venue selector ─────────────────────────────────── */}
            {venues.length > 0 && (
              <div>
                <FieldLabel>Use saved venue</FieldLabel>
                <Select onValueChange={applyVenue}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a venue template…" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        <span className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted)]" />
                          {v.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                  Selecting a venue autofills the fields below. You can edit
                  them before submitting.
                </p>
              </div>
            )}

            {/* ── Date, time, duration ─────────────────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel required>Date &amp; Time</FieldLabel>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => {
                    setScheduledAt(e.target.value);
                    setConflicts(null);
                  }}
                />
              </div>
              <div>
                <FieldLabel>Duration (minutes)</FieldLabel>
                <Input
                  type="number"
                  min={15}
                  max={240}
                  value={durationMinutes}
                  onChange={(e) =>
                    setDurationMinutes(Number(e.target.value) || 60)
                  }
                />
              </div>
            </div>

            {/* ── Conflict chips ───────────────────────────────────────── */}
            {conflicts?.hasConflicts && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-score-mid-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-score-mid)]">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  Scheduling conflict detected — you may still proceed
                </span>
              </div>
            )}

            {/* ── Venue fields ─────────────────────────────────────────── */}
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Venue Details
              </p>
              <div className="space-y-3">
                <div>
                  <FieldLabel required>Venue name</FieldLabel>
                  <Input
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    placeholder="e.g. AuraHire HQ — Floor 3"
                  />
                </div>
                <div>
                  <FieldLabel required>Address</FieldLabel>
                  <Input
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)}
                    placeholder="123 Main St, City, Country"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Room / Floor</FieldLabel>
                    <Input
                      value={roomOrFloor}
                      onChange={(e) => setRoomOrFloor(e.target.value)}
                      placeholder="e.g. Room 3B"
                    />
                  </div>
                  <div>
                    <FieldLabel>Map URL</FieldLabel>
                    <Input
                      value={mapUrl}
                      onChange={(e) => {
                        setMapUrl(e.target.value);
                        setMapUrlError(validateMapUrl(e.target.value));
                      }}
                      placeholder="https://maps.google.com/…"
                    />
                    {mapUrlError && (
                      <p className="mt-1 text-[11px] text-[var(--color-status-danger)]">
                        {mapUrlError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Candidate guidance ───────────────────────────────────── */}
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Candidate Guidance
              </p>
              <div className="space-y-3">
                <div>
                  <FieldLabel>Reporting instructions</FieldLabel>
                  <textarea
                    value={reportingInstructions}
                    onChange={(e) => setReportingInstructions(e.target.value)}
                    rows={3}
                    placeholder="Ask for John at reception. Bring photo ID."
                    className="w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)]"
                  />
                </div>
                <div>
                  <FieldLabel>What to bring</FieldLabel>
                  <textarea
                    value={whatToBring}
                    onChange={(e) => setWhatToBring(e.target.value)}
                    rows={2}
                    placeholder="Portfolio, references, government-issued ID…"
                    className="w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)]"
                  />
                </div>
              </div>
            </div>

            {/* ── Interviewer ──────────────────────────────────────────── */}
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Interviewer
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Name</FieldLabel>
                  <Input
                    value={interviewerName}
                    onChange={(e) => setInterviewerName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <FieldLabel>Title</FieldLabel>
                  <Input
                    value={interviewerTitle}
                    onChange={(e) => setInterviewerTitle(e.target.value)}
                    placeholder="e.g. Engineering Manager"
                  />
                </div>
              </div>
            </div>

            {/* ── Save as venue template (flat, no inset card) ─────────── */}
            <div>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={saveAsTemplate}
                  onChange={(e) => setSaveAsTemplate(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-[var(--color-primary)]"
                />
                <span className="text-sm text-[var(--color-body)]">
                  Save as venue template for future interviews
                </span>
              </label>
              {saveAsTemplate && (
                <div className="mt-3">
                  <FieldLabel required>Template label</FieldLabel>
                  <Input
                    value={templateLabel}
                    onChange={(e) => setTemplateLabel(e.target.value)}
                    placeholder="e.g. Main Office — Conference Room A"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t border-[var(--color-hairline)] p-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-[var(--radius-pill)]"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              working ||
              !scheduledAt ||
              !venueName.trim() ||
              !addressLine.trim()
            }
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
          >
            {working && <ButtonSpinner />}
            {working ? "Scheduling…" : "Schedule interview"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Type-check the new file**

Run:

```bash
pnpm --filter web tsc --noEmit
```

Expected: clean exit, zero errors. The new file should type-check against existing imports and hooks. If you see errors, the most likely causes are:

- A wrong import path on `Sheet` (must be `@/components/ui/sheet`, lower-case file name).
- A renamed icon export from `lucide-react` (none of `AlertTriangle`, `Building2` were renamed).
- The `clientApiFetch` import path (must be `@/hooks/_client-fetch`).

Fix and re-run until clean.

- [ ] **Step 4: Lint the new file**

Run:

```bash
pnpm --filter web lint
```

Expected: clean exit. If `react-hooks/exhaustive-deps` warns on the seed-interviewer `useEffect` (because the IIFE inside has no deps tracking), that's the same warning the old modal had (or the same eslint-disable comment). Match the existing modal's behavior — do not add new disable comments unless the old file already had them.

- [ ] **Step 5: Commit Task 1**

```bash
git add apps/web/app/\(recruiter\)/recruiter/applications/\[id\]/_schedule-interview-sheet-client.tsx
git commit -m "$(cat <<'EOF'
feat(recruiter): add schedule-interview side-sheet client

Mirrors the existing modal client but renders inside a right-side Sheet
with a sticky header / scrollable body / sticky footer. Form logic is
unchanged. Drops the nested confirm() before submit (the footer pill is
the explicit commit; candidate-notification copy lives in the description).
Save-as-template renders flat, no inset gray card.

Spec: docs/superpowers/specs/2026-05-10-schedule-interview-side-sheet-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Verify:

```bash
git status
```

Expected: working tree clean (or only the upcoming task's changes pending).

---

## Task 2: Switch the import in `_interviews-section-client.tsx`

**Files:**

- Modify: `apps/web/app/(recruiter)/recruiter/applications/[id]/_interviews-section-client.tsx`

**What:** Updates the single import + JSX usage from the modal name to the sheet name. Two lines change.

- [ ] **Step 1: Locate the current import and usage**

Run:

```bash
grep -n "ScheduleInterviewModalClient" apps/web/app/\(recruiter\)/recruiter/applications/\[id\]/_interviews-section-client.tsx
```

Expected output (exact line numbers may differ if the file changed since plan-write — match by content):

```
19:import { ScheduleInterviewModalClient } from "./_schedule-interview-modal-client";
453:      <ScheduleInterviewModalClient
```

- [ ] **Step 2: Edit line 19 — update the import**

Replace:

```tsx
import { ScheduleInterviewModalClient } from "./_schedule-interview-modal-client";
```

With:

```tsx
import { ScheduleInterviewSheetClient } from "./_schedule-interview-sheet-client";
```

- [ ] **Step 3: Edit line 453 — update the JSX symbol**

Replace:

```tsx
<ScheduleInterviewModalClient
  applicationId={applicationId}
  open={scheduleOpen}
  onOpenChange={setScheduleOpen}
/>
```

With:

```tsx
<ScheduleInterviewSheetClient
  applicationId={applicationId}
  open={scheduleOpen}
  onOpenChange={setScheduleOpen}
/>
```

- [ ] **Step 4: Verify no stale references remain**

Run:

```bash
grep -rn "ScheduleInterviewModalClient" apps/web
```

Expected: no output (zero matches). If any line still references the old name, repeat Step 2 / Step 3 for those files. (Spec confirms there is only the one consumer; if `grep` finds anything else, stop and reconcile with the spec.)

Run:

```bash
grep -rn "_schedule-interview-modal-client" apps/web
```

Expected: only `apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-modal-client.tsx` itself (the file we're about to delete in Task 3).

- [ ] **Step 5: Type-check**

Run:

```bash
pnpm --filter web tsc --noEmit
```

Expected: clean exit. If TS complains that the import path doesn't exist, you forgot to do Task 1 Step 2 first — go back.

- [ ] **Step 6: Commit Task 2**

```bash
git add apps/web/app/\(recruiter\)/recruiter/applications/\[id\]/_interviews-section-client.tsx
git commit -m "$(cat <<'EOF'
refactor(recruiter): point interviews section at schedule-interview sheet

Single import + JSX symbol swap from ScheduleInterviewModalClient to
ScheduleInterviewSheetClient. No behavior change in this file.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Delete the old modal file

**Files:**

- Delete: `apps/web/app/(recruiter)/recruiter/applications/[id]/_schedule-interview-modal-client.tsx`

**What:** Removes the superseded modal client. Nothing imports it anymore (verified in Task 2 Step 4).

- [ ] **Step 1: Final guard — confirm no references**

Run:

```bash
grep -rn "_schedule-interview-modal-client" apps/web packages
```

Expected: only the file itself. If anything else matches, stop, fix that consumer, return.

Run:

```bash
grep -rn "ScheduleInterviewModalClient" apps/web packages
```

Expected: no matches.

- [ ] **Step 2: Delete the file**

```bash
rm apps/web/app/\(recruiter\)/recruiter/applications/\[id\]/_schedule-interview-modal-client.tsx
```

- [ ] **Step 3: Type-check**

Run:

```bash
pnpm --filter web tsc --noEmit
```

Expected: clean exit. If TS now complains about a missing module, you missed an import — restore the file (`git checkout HEAD -- <path>`) and find/fix the import you missed, then redo Steps 1–2.

- [ ] **Step 4: Lint**

Run:

```bash
pnpm --filter web lint
```

Expected: clean exit.

- [ ] **Step 5: Commit Task 3**

```bash
git add -A apps/web/app/\(recruiter\)/recruiter/applications/\[id\]/_schedule-interview-modal-client.tsx
git commit -m "$(cat <<'EOF'
chore(recruiter): remove superseded schedule-interview modal client

Replaced by _schedule-interview-sheet-client.tsx. No remaining consumers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Note: `git add -A <path>` is correct here because the path is being deleted — this stages the deletion. We are not using `git add -A` against a directory.)

---

## Task 4: Verify end-to-end

**Files:** none (verification only)

**What:** Type-check, lint, and request a manual browser smoke-test from the human (the engineer cannot run dev servers per `CLAUDE.md` Hard Rules).

- [ ] **Step 1: Type-check the entire web app**

Run:

```bash
pnpm --filter web tsc --noEmit
```

Expected: clean exit, zero errors.

- [ ] **Step 2: Lint the entire web app**

Run:

```bash
pnpm --filter web lint
```

Expected: clean exit.

- [ ] **Step 3: Build verification (optional but recommended)**

Run:

```bash
pnpm --filter web build
```

Expected: build completes successfully. Skipping is acceptable if the human prefers to manually smoke-test instead.

- [ ] **Step 4: Request human smoke-test**

Tell the human: "Implementation done. Please run `pnpm dev` and verify the following:

1. Navigate to a recruiter application detail page at `applied` status.
2. Click **Move to Interview** → confirm dialog → **Move to Interview** in the dialog.
3. The status flips to `interview` and a **right-side sheet** slides in (not a centered modal). The sheet should be ~672px wide on desktop with a sticky header reading 'Schedule Interview', a scrollable body, and a sticky footer with Cancel + Schedule interview pill.
4. Fill in date/time and a venue name + address. Click **Schedule interview** in the footer.
5. The interview should be scheduled in **one click** — there should NOT be a second 'Are you sure?' dialog. The candidate should receive the email per existing behavior, and a success toast should fire.
6. Open the sheet again, check the **Save as venue template** checkbox, type a label, schedule. The next time the sheet opens it should appear in the saved-venues dropdown.
7. Close the sheet via ✕, Escape, backdrop click, and Cancel — all should dismiss it.
8. The **Reject** action's confirm dialog should still work (test on a separate application). The **Reschedule** modal on existing interviews should still work."

- [ ] **Step 5: If smoke-test passes, mark plan complete**

No commit needed for this task — it's verification only. If the human reports issues, capture them as follow-up tasks rather than amending committed work.

---

## Acceptance criteria (mirrors the spec)

1. Move to Interview from `/recruiter/applications/[id]` → status changes to `interview` → URL gains `?schedule=1` → a right-side sheet slides in (not a centered modal).
2. The sheet is ~672px wide on desktop, slides full-width-ish on mobile, has a sticky header with title and description, a scrollable body, and a sticky footer with Cancel + primary pill.
3. All form fields, validation, conflict-detection chip, saved-venue dropdown, and save-as-template behavior work exactly as before.
4. Clicking the primary "Schedule interview" pill submits in one click — there is no second confirm dialog.
5. The save-as-template area is a flat checkbox on the sheet body (no inset gray card).
6. Closing the sheet via any affordance (✕, Escape, backdrop click, Cancel) sets `scheduleOpen = false` and unmounts the sheet body. The `?schedule=1` URL scrub already happens on auto-open detection — no change needed there.
7. No regressions to interview-list rendering, no regressions to the reschedule modal, no regressions to the Reject confirm dialog.
8. `pnpm tsc --noEmit` and `pnpm lint` both pass.

---

## Self-review notes

**Spec coverage check:** Each acceptance criterion in the spec has a task that implements it (Tasks 1 + 2 produce AC 1–6; Task 3 produces AC 7 by removing the superseded file; Task 4 verifies AC 8 + provides the smoke-test for AC 1–7).

**Type consistency check:** The new component is named `ScheduleInterviewSheetClient` and lives in `_schedule-interview-sheet-client.tsx`. The single consumer (`_interviews-section-client.tsx`) imports the same name. The prop contract `{ applicationId: string; open: boolean; onOpenChange: (open: boolean) => void }` is identical between Task 1 and Task 2. No name drift.

**Placeholder scan:** No "TBD", no "TODO", no "implement later", no "add appropriate error handling", no "similar to Task N". Every code change is fully spelled out.

**Why no automated UI tests:** This codebase's `apps/web/**/*.test.tsx` suite is sparse and scoped to specific edge-case logic (parsing progress, low-confidence banner, sidebar rail, job card). Modals/sheets in this repo are not unit-tested today; their verification mechanism is type-check + lint + human browser smoke-test. This plan follows that established convention rather than introducing a one-off test file. If the team later adopts a sheet-testing pattern, the new component is simple enough to retrofit a test against.
