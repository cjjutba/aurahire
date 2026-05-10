"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { getActiveCompanyId } from "@/lib/active-company";
import { useConfirm } from "@/components/providers/confirm-provider";
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

interface ConflictCheckResult {
  recruiterConflicts: Array<{ id: string; scheduledAt: string; durationMinutes: number }>;
  candidateConflicts: Array<{ id: string; scheduledAt: string; durationMinutes: number }>;
}

interface Props {
  interviewId: string;
  applicationId: string;
  /** Pre-filled values from the current interview. */
  defaults?: {
    scheduledAt?: string;
    durationMinutes?: number;
    venueName?: string;
    addressLine?: string;
    roomOrFloor?: string | null;
    mapUrl?: string | null;
    reportingInstructions?: string | null;
    whatToBring?: string | null;
    interviewerName?: string | null;
    interviewerTitle?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRescheduled?: () => void;
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
// Format a UTC ISO string to datetime-local value (YYYY-MM-DDTHH:mm)
// ---------------------------------------------------------------------------

function isoToLocalInput(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RescheduleModalClient({
  interviewId,
  applicationId,
  defaults,
  open,
  onOpenChange,
  onRescheduled,
}: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const companyId = getActiveCompanyId();

  // ── Core scheduling fields ────────────────────────────────────────────────
  const [scheduledAt, setScheduledAt] = useState(
    defaults?.scheduledAt ? isoToLocalInput(defaults.scheduledAt) : "",
  );
  const [durationMinutes, setDurationMinutes] = useState(
    defaults?.durationMinutes ?? 60,
  );

  // Native datetime-local min, recomputed when the modal opens so the picker
  // disables past times. Anchor is "now" — a 60s server-side grace handles
  // submit latency.
  const minScheduledAt = useMemo(() => {
    if (!open) return undefined;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }, [open]);

  // ── Venue fields ──────────────────────────────────────────────────────────
  const [venueName, setVenueName] = useState(defaults?.venueName ?? "");
  const [addressLine, setAddressLine] = useState(defaults?.addressLine ?? "");
  const [roomOrFloor, setRoomOrFloor] = useState(defaults?.roomOrFloor ?? "");
  const [mapUrl, setMapUrl] = useState(defaults?.mapUrl ?? "");
  const [mapUrlError, setMapUrlError] = useState("");
  const [reportingInstructions, setReportingInstructions] = useState(
    defaults?.reportingInstructions ?? "",
  );
  const [whatToBring, setWhatToBring] = useState(defaults?.whatToBring ?? "");

  // ── Interviewer ───────────────────────────────────────────────────────────
  const [interviewerName, setInterviewerName] = useState(
    defaults?.interviewerName ?? "",
  );
  const [interviewerTitle, setInterviewerTitle] = useState(
    defaults?.interviewerTitle ?? "",
  );

  // ── Conflict detection ────────────────────────────────────────────────────
  const [hasConflict, setHasConflict] = useState(false);
  const conflictTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Submission ────────────────────────────────────────────────────────────
  const [working, setWorking] = useState(false);

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

  // ── Conflict detection: debounced 500ms ──────────────────────────────────
  useEffect(() => {
    if (!scheduledAt) {
      setHasConflict(false);
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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
        const activeCompanyId = getActiveCompanyId();
        const res = await fetch(
          `${apiUrl}/api/v1/applications/${applicationId}/interviews/check-conflicts`,
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
              // Exclude the current interview so it doesn't flag itself as a conflict.
              excludeInterviewId: interviewId,
            }),
          },
        );
        if (res.ok) {
          const body = (await res.json()) as { data: ConflictCheckResult };
          setHasConflict(
            body.data.recruiterConflicts.length > 0 ||
              body.data.candidateConflicts.length > 0,
          );
        }
      } catch {
        // Silently swallow — conflict check is advisory only.
      }
    }, 500);
    return () => {
      if (conflictTimerRef.current) clearTimeout(conflictTimerRef.current);
    };
  }, [scheduledAt, durationMinutes, applicationId, interviewId]);

  // ── Map URL validation ────────────────────────────────────────────────────
  function validateMapUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed) ? "" : "Must start with http:// or https://";
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

    const ok = await confirm({
      title: "Reschedule this interview?",
      description:
        "The current interview will be marked as rescheduled and the candidate will be notified of the new time.",
      confirmLabel: "Reschedule",
      variant: "info",
    });
    if (!ok) return;

    setWorking(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toastApiError(null, "Couldn't reschedule", "Please sign in again.");
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const activeCompanyId = getActiveCompanyId();

      const res = await fetch(
        `${apiUrl}/api/v1/interviews/${interviewId}/reschedule`,
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
            venueName: venueName.trim(),
            addressLine: addressLine.trim(),
            roomOrFloor: roomOrFloor.trim() || null,
            mapUrl: mapUrl.trim() || null,
            reportingInstructions: reportingInstructions.trim() || null,
            whatToBring: whatToBring.trim() || null,
            interviewerName: interviewerName.trim() || null,
            interviewerTitle: interviewerTitle.trim() || null,
          }),
        },
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toastApiError(null, "Couldn't reschedule interview", body.message);
        return;
      }

      toastSuccess("Interview rescheduled", "Candidate notified.");
      onOpenChange(false);
      onRescheduled?.();
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reschedule Interview</DialogTitle>
          <DialogDescription>
            The original interview will be marked as rescheduled and the
            candidate will receive a new confirmation email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Saved venue selector ──────────────────────────────────────── */}
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
                Selecting a venue autofills the fields below. You can edit them
                before submitting.
              </p>
            </div>
          )}

          {/* ── Date, time, duration ──────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel required>Date &amp; Time</FieldLabel>
              <Input
                type="datetime-local"
                value={scheduledAt}
                min={minScheduledAt}
                onChange={(e) => {
                  setScheduledAt(e.target.value);
                  setHasConflict(false);
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

          {/* ── Conflict chip ─────────────────────────────────────────────── */}
          {hasConflict && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-score-mid-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-score-mid)]">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                Scheduling conflict detected — you may still proceed
              </span>
            </div>
          )}

          {/* ── Venue fields ──────────────────────────────────────────────── */}
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

          {/* ── Candidate guidance ────────────────────────────────────────── */}
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

          {/* ── Interviewer ───────────────────────────────────────────────── */}
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
        </div>

        <DialogFooter>
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
            {working ? "Rescheduling…" : "Reschedule interview"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
