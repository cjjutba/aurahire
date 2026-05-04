"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScheduleInterviewModalClient } from "./_schedule-interview-modal-client";

export interface InterviewRow {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  format: string;
  status: string;
  locationOrLink: string | null;
}

interface Props {
  applicationId: string;
  interviews: InterviewRow[];
}

const FORMAT_LABELS: Record<string, string> = {
  phone: "Phone",
  video: "Video",
  "in-person": "In-Person",
};

export function RecruiterInterviewsSection({ applicationId, interviews }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Interviews
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Schedule and track interviews for this candidate.
          </p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          Schedule interview
        </Button>
      </header>

      {interviews.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No interviews scheduled yet.</p>
      ) : (
        <ul className="space-y-2">
          {interviews.map((i) => (
            <li
              key={i.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <strong className="text-[var(--color-ink)]">
                  {new Date(i.scheduledAt).toLocaleString()}
                </strong>
                <span className="text-xs text-[var(--color-muted)]">
                  {FORMAT_LABELS[i.format] ?? i.format} · {i.durationMinutes} min ·{" "}
                  <span className="font-semibold">{i.status}</span>
                </span>
              </div>
              {i.locationOrLink && (
                <p className="mt-1 break-all text-xs text-[var(--color-body)]">{i.locationOrLink}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <ScheduleInterviewModalClient
        applicationId={applicationId}
        open={open}
        onOpenChange={setOpen}
      />
    </section>
  );
}
