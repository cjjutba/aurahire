"use client";

import Link from "next/link";

export interface InterviewWithSharedFeedback {
  id: string;
  scheduledAt: string;
  candidateSummary: string;
  sharedWithCandidateAt: string;
}

interface InterviewFeedbackPanelClientProps {
  interview: InterviewWithSharedFeedback;
}

export function InterviewFeedbackPanelClient({
  interview,
}: InterviewFeedbackPanelClientProps) {
  const interviewDate = new Date(interview.scheduledAt).toLocaleDateString(
    undefined,
    { month: "long", day: "numeric", year: "numeric" },
  );

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        Recruiter feedback
      </h2>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        From your interview on {interviewDate}
      </p>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-body)]">
        {interview.candidateSummary}
      </div>
      <Link
        href={`/candidate/interviews/${interview.id}`}
        className="mt-3 inline-block text-sm text-[var(--color-primary)] hover:underline"
      >
        View interview details →
      </Link>
    </section>
  );
}
