"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

  // Native datetime-local min, recomputed when the sheet opens so the picker
  // disables past times. Anchor is "now" — a 60s server-side grace handles
  // submit latency.
  const minScheduledAt = useMemo(() => {
    if (!open) return undefined;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }, [open]);

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
    return /^https?:\/\//i.test(trimmed) ? "" : "Must start with http:// or https://";
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
      toastApiError(null, "Check your input", "Enter a label for the saved venue.");
      return;
    }

    setWorking(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toastApiError(null, "Couldn't schedule interview", "Please sign in again.");
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
        className="flex w-full flex-col gap-0 bg-[var(--color-canvas)] p-0 sm:max-w-2xl"
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
                  min={minScheduledAt}
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
              working || !scheduledAt || !venueName.trim() || !addressLine.trim()
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
