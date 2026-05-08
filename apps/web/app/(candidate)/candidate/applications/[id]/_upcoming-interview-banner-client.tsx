"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";

import { AddToCalendarButton } from "@/components/interview/add-to-calendar-button";
import { WithdrawApplicationModal } from "@/components/interview/withdraw-application-modal";

export interface UpcomingInterviewBannerInterview {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  venueName?: string | null;
  addressLine?: string | null;
  roomOrFloor?: string | null;
}

interface UpcomingInterviewBannerClientProps {
  interview: UpcomingInterviewBannerInterview;
  applicationId: string;
  canWithdraw: boolean;
}

export function UpcomingInterviewBannerClient({
  interview,
  applicationId,
  canWithdraw,
}: UpcomingInterviewBannerClientProps) {
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const date = new Date(interview.scheduledAt);
  const dateString = date.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-primary)] bg-[var(--color-primary-soft)] p-6">
      <div className="flex items-start gap-3">
        <Calendar
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            Upcoming interview
          </h2>
          <p className="mt-1 text-base font-semibold text-[var(--color-ink)]">
            {dateString}
          </p>
          <p className="mt-0.5 font-mono text-xs text-[var(--color-body)]">
            {interview.durationMinutes} min
          </p>
          {(interview.venueName ?? interview.addressLine) && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-sm text-[var(--color-body)]">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {interview.venueName ? (
                <strong className="text-[var(--color-ink)]">
                  {interview.venueName}
                </strong>
              ) : null}
              {interview.addressLine ? (
                <span> — {interview.addressLine}</span>
              ) : null}
              {interview.roomOrFloor ? (
                <span> ({interview.roomOrFloor})</span>
              ) : null}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/candidate/interviews/${interview.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
            >
              View interview details
            </Link>
            <AddToCalendarButton interviewId={interview.id} />
            {canWithdraw && (
              <button
                type="button"
                onClick={() => setWithdrawOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-status-danger)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-status-danger)] transition hover:bg-[var(--color-status-danger)] hover:text-white"
              >
                Withdraw application
              </button>
            )}
          </div>
        </div>
      </div>

      <WithdrawApplicationModal
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        applicationId={applicationId}
      />
    </section>
  );
}
