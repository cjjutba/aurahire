"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreRing } from "@/components/score/score-ring";
import { MatchBandChip } from "@/components/score/match-band-chip";
import { ScoreBreakdownBar } from "@/components/score/score-breakdown-bar";
import { EvidenceCallout } from "@/components/score/evidence-callout";
import { RawOutputJsonViewer } from "@/components/admin/raw-output-json-viewer";
import { RedactedResumePreview } from "@/components/admin/redacted-resume-preview";
import { AuditTrailTimeline } from "@/components/admin/audit-trail-timeline";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

interface Detail {
  id: string;
  status: string;
  coverLetter: string | null;
  recruiterNotes: string | null;
  appliedAt: string;
  statusUpdatedAt: string;
  candidate: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    headline: string | null;
  };
  job: {
    id: string;
    title: string;
    descriptionPlain: string;
    requiredSkills: string[];
    experienceLevel: string;
    educationRequirement: string | null;
    recruiter: { id: string; fullName: string; email: string };
    company: { id: string; name: string };
  };
  matchScore: {
    id: string;
    overallScore: number;
    band: "strong" | "partial" | "limited";
    components: Array<{
      name: string;
      score: number;
      max: number;
      weight: number;
      explanation: string;
      evidence: Array<{
        excerpt: string;
        source: string | null;
        relevance: "positive" | "negative" | "neutral";
        contributionPoints: number | null;
        reasoning?: string | null;
      }>;
    }>;
    summary: string;
    redFlags: string[] | null;
    greenFlags: string[] | null;
    redactedFields: string[];
    weightsUsed: Record<string, unknown>;
    promptVersion: string;
    modelUsed: string;
    latencyMs: number | null;
    rawOutput: Record<string, unknown>;
    createdAt: string;
  } | null;
  resume: {
    id: string;
    filename: string;
    parseStatus: string;
    parsedData: Record<string, unknown> | null;
    uploadedAt: string;
  };
  auditTrail: Array<{
    id: string;
    action: string;
    actorType: string;
    actorId: string | null;
    details: Record<string, unknown> | null;
    createdAt: string;
  }>;
}

interface Props {
  applicationId: string;
  open: boolean;
  onClose: () => void;
}

const COMPONENT_LABELS: Record<string, string> = {
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  cultural_fit: "Cultural Fit",
};

export function ApplicationDetailSheetClient({
  applicationId,
  open,
  onClose,
}: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setDetail(null);
      setError(null);
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Not signed in");
        return;
      }
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const res = await fetch(
        `${apiUrl}/api/v1/admin/applications/${applicationId}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        },
      );
      if (cancelled) return;
      if (!res.ok) {
        setError(`Failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as { data: Detail };
      if (cancelled) return;
      setDetail(body.data);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full overflow-y-auto bg-[var(--color-canvas)] sm:max-w-3xl"
      >
        <SheetHeader>
          <SheetTitle>{detail?.candidate.fullName ?? "Loading…"}</SheetTitle>
        </SheetHeader>

        {error && (
          <p className="mt-6 text-sm text-[var(--color-status-danger)]">
            {error}
          </p>
        )}

        {!detail && !error && (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-32 rounded-[var(--radius-lg)]" />
            <Skeleton className="h-12 rounded-[var(--radius-md)]" />
            <Skeleton className="h-48 rounded-[var(--radius-lg)]" />
          </div>
        )}

        {detail && (
          <div className="mt-6 space-y-8 px-4 pb-8">
            <header className="space-y-1 border-b border-[var(--color-hairline)] pb-4">
              <p className="text-sm text-[var(--color-body)]">
                {detail.candidate.email}
              </p>
              {detail.candidate.phone && (
                <p className="text-xs text-[var(--color-muted)]">
                  {detail.candidate.phone}
                </p>
              )}
              <p className="text-xs text-[var(--color-muted)]">
                Applied to <strong>{detail.job.title}</strong> at{" "}
                {detail.job.company.name} · Status:{" "}
                <strong>{detail.status}</strong>
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                Recruiter: {detail.job.recruiter.fullName} (
                {detail.job.recruiter.email})
              </p>
            </header>

            {detail.matchScore ? (
              <>
                <section className="flex flex-col gap-6 sm:flex-row sm:items-center">
                  <ScoreRing
                    score={detail.matchScore.overallScore}
                    band={detail.matchScore.band}
                    size="lg"
                  />
                  <div className="space-y-2">
                    <h2 className="text-xl font-normal text-[var(--color-ink)]">
                      Match Score
                    </h2>
                    <MatchBandChip band={detail.matchScore.band} />
                    <p className="text-sm text-[var(--color-body)]">
                      {detail.matchScore.summary}
                    </p>
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Component Breakdown
                  </h3>
                  <ScoreBreakdownBar
                    components={detail.matchScore.components.map((c) => ({
                      name: c.name,
                      label: COMPONENT_LABELS[c.name] ?? c.name,
                      score: c.score,
                      max: c.max,
                      weight: c.weight,
                      href: `#cmp-${c.name}`,
                    }))}
                  />
                </section>

                {detail.matchScore.greenFlags &&
                  detail.matchScore.greenFlags.length > 0 && (
                    <section>
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-score-high)]">
                        Green Flags
                      </h3>
                      <ul className="space-y-1 text-sm text-[var(--color-body)]">
                        {detail.matchScore.greenFlags.map((g, i) => (
                          <li key={i}>• {g}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                {detail.matchScore.redFlags &&
                  detail.matchScore.redFlags.length > 0 && (
                    <section>
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-score-low)]">
                        Red Flags
                      </h3>
                      <ul className="space-y-1 text-sm text-[var(--color-body)]">
                        {detail.matchScore.redFlags.map((r, i) => (
                          <li key={i}>• {r}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                {detail.matchScore.components.map((c) => (
                  <section
                    key={c.name}
                    id={`cmp-${c.name}`}
                    className="space-y-3"
                  >
                    <header className="flex items-baseline justify-between">
                      <h3 className="text-base font-semibold text-[var(--color-ink)]">
                        {COMPONENT_LABELS[c.name] ?? c.name}
                      </h3>
                      <span className="font-mono text-xs text-[var(--color-muted)]">
                        {c.score} / {c.max} (weight {c.weight}%)
                      </span>
                    </header>
                    <p className="text-sm text-[var(--color-body)]">
                      {c.explanation}
                    </p>
                    {c.evidence.length > 0 && (
                      <div className="space-y-2">
                        {c.evidence.map((ev, i) => (
                          <EvidenceCallout
                            key={`${c.name}-${i}`}
                            excerpt={ev.excerpt}
                            source={ev.source ?? ""}
                            relevance={ev.relevance}
                            contributionPoints={ev.contributionPoints}
                            reasoning={ev.reasoning ?? null}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                ))}

                <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Fairness & Transparency
                  </h3>
                  <dl className="mt-3 grid gap-2 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--color-muted)]">
                        Redacted before scoring
                      </dt>
                      <dd className="text-right font-mono text-[var(--color-ink)]">
                        {detail.matchScore.redactedFields.length > 0
                          ? detail.matchScore.redactedFields.join(", ")
                          : "(none)"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--color-muted)]">Model</dt>
                      <dd className="font-mono text-[var(--color-ink)]">
                        {detail.matchScore.modelUsed}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--color-muted)]">
                        Prompt version
                      </dt>
                      <dd className="font-mono text-[var(--color-ink)]">
                        {detail.matchScore.promptVersion}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--color-muted)]">Latency</dt>
                      <dd className="font-mono text-[var(--color-ink)]">
                        {detail.matchScore.latencyMs ?? "?"}ms
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--color-muted)]">
                        Weights used
                      </dt>
                      <dd className="text-right font-mono text-[var(--color-ink)]">
                        {Object.entries(detail.matchScore.weightsUsed)
                          .map(([k, v]) => `${k}=${String(v)}`)
                          .join(", ")}
                      </dd>
                    </div>
                  </dl>
                </section>

                <RawOutputJsonViewer
                  value={detail.matchScore.rawOutput}
                  title="Raw AI Output"
                />

                <RedactedResumePreview
                  parsedResume={detail.resume.parsedData}
                  redactedFields={detail.matchScore.redactedFields}
                />
              </>
            ) : (
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-5 text-sm text-[var(--color-body)]">
                No match score persisted for this application — scoring may
                have failed during apply.
              </div>
            )}

            {detail.coverLetter && (
              <section>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Cover Letter
                </h3>
                <div className="whitespace-pre-wrap rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-4 text-sm text-[var(--color-body)]">
                  {detail.coverLetter}
                </div>
              </section>
            )}

            {detail.recruiterNotes && (
              <section>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Recruiter Notes
                </h3>
                <div className="whitespace-pre-wrap rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-4 text-sm text-[var(--color-body)]">
                  {detail.recruiterNotes}
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Audit Trail
              </h3>
              <AuditTrailTimeline entries={detail.auditTrail} />
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
