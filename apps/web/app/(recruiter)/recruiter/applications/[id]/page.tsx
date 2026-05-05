import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { ScoreRing } from "@/components/score/score-ring";
import { MatchBandChip } from "@/components/score/match-band-chip";
import { ScoreBreakdownBar } from "@/components/score/score-breakdown-bar";
import { EvidenceCallout } from "@/components/score/evidence-callout";
import { ApplicationActionsClient } from "./_actions-client";
import { ShortlistButtonClient } from "./_shortlist-button-client";
import {
  RecruiterInterviewsSection,
  type InterviewRow,
} from "./_interviews-section-client";
import {
  RecruiterOffersSection,
  type OfferRow,
} from "./_offers-section";

const COMPONENT_LABELS: Record<string, string> = {
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  cultural_fit: "Cultural Fit",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

interface MatchEvidence {
  excerpt: string;
  source: string;
  relevance: "positive" | "negative" | "neutral";
  contributionPoints: number | null;
}

interface MatchComponent {
  name: string;
  score: number;
  max: number;
  weight: number;
  explanation: string;
  evidence: MatchEvidence[];
}

interface MatchScoreData {
  overallScore: number;
  band: "strong" | "partial" | "limited";
  components: MatchComponent[];
  summary: string;
  redFlags: string[] | null;
  greenFlags: string[] | null;
}

interface AppDetail {
  id: string;
  status: string;
  appliedAt: string;
  coverLetter: string | null;
  recruiterNotes: string | null;
  candidate: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    headline: string | null;
  } | null;
  job: { id: string; title: string; company: { name: string } } | null;
  matchScore: MatchScoreData | null;
  shortlistedAt: string | null;
}

export const metadata = { title: "Application Review" };

export default async function RecruiterApplicationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const authHeaders = { Authorization: `Bearer ${session.access_token}` };
  const [res, interviewsRes, offersRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/applications/${id}`, { headers: authHeaders, cache: "no-store" }),
    fetch(`${apiUrl}/api/v1/applications/${id}/interviews`, {
      headers: authHeaders,
      cache: "no-store",
    }),
    fetch(`${apiUrl}/api/v1/applications/${id}/offers`, {
      headers: authHeaders,
      cache: "no-store",
    }),
  ]);

  if (res.status === 404) notFound();
  if (!res.ok) {
    return <div className="text-[var(--color-status-danger)]">Failed to load.</div>;
  }

  const body = (await res.json()) as { data: AppDetail };
  const app = body.data;
  const score = app.matchScore;

  const interviews: InterviewRow[] = interviewsRes.ok
    ? ((await interviewsRes.json()) as { data: InterviewRow[] }).data
    : [];
  const offers: OfferRow[] = offersRes.ok
    ? ((await offersRes.json()) as { data: OfferRow[] }).data
    : [];

  return (
    <div className="mx-auto max-w-[1280px] space-y-12">
      <Link
        href={`/recruiter/jobs/${app.job?.id ?? ""}/applications`}
        className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back to applications
      </Link>

      <header className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
              {app.candidate?.fullName}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-body)]">
              {app.candidate?.headline}
            </p>
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              {app.candidate?.email}
              {app.candidate?.phone ? ` · ${app.candidate.phone}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ShortlistButtonClient
              applicationId={app.id}
              initialShortlistedAt={app.shortlistedAt}
            />
            <p className="text-xs text-[var(--color-muted)]">
              Applied {new Date(app.appliedAt).toLocaleString()}
            </p>
            <p className="text-sm">
              Status: <strong>{app.status}</strong>
            </p>
          </div>
        </div>
      </header>

      {score && (
        <>
          <section className="flex flex-col gap-8 md:flex-row md:items-center">
            <ScoreRing score={score.overallScore} band={score.band} size="lg" />
            <div className="space-y-3">
              <h2 className="text-2xl font-normal text-[var(--color-ink)]">
                AI Match Score
              </h2>
              <MatchBandChip band={score.band} />
              <p className="text-sm text-[var(--color-body)]">{score.summary}</p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Breakdown
            </h2>
            <ScoreBreakdownBar
              components={score.components.map((c) => ({
                name: c.name,
                label: COMPONENT_LABELS[c.name] ?? c.name,
                score: c.score,
                max: c.max,
                weight: c.weight,
                href: `#component-${c.name}`,
              }))}
            />
          </section>

          {score.greenFlags && score.greenFlags.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-score-high)]">
                Green Flags
              </h3>
              <ul className="space-y-1 text-sm text-[var(--color-body)]">
                {score.greenFlags.map((g, i) => (
                  <li key={i}>• {g}</li>
                ))}
              </ul>
            </section>
          )}

          {score.redFlags && score.redFlags.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-score-low)]">
                Red Flags
              </h3>
              <ul className="space-y-1 text-sm text-[var(--color-body)]">
                {score.redFlags.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </section>
          )}

          {score.components.map((c) => (
            <section key={c.name} id={`component-${c.name}`} className="space-y-4">
              <header className="flex items-baseline justify-between">
                <h3 className="text-xl font-semibold text-[var(--color-ink)]">
                  {COMPONENT_LABELS[c.name] ?? c.name}
                </h3>
                <span className="font-mono text-sm text-[var(--color-muted)]">
                  {c.score} / {c.max}
                </span>
              </header>
              <p className="text-sm text-[var(--color-body)]">{c.explanation}</p>
              {c.evidence.length > 0 && (
                <div className="space-y-3">
                  {c.evidence.map((ev, i) => (
                    <EvidenceCallout
                      key={`${c.name}-${i}`}
                      excerpt={ev.excerpt}
                      source={ev.source}
                      relevance={ev.relevance}
                      contributionPoints={ev.contributionPoints}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </>
      )}

      {app.coverLetter && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Cover Letter
          </h2>
          <div className="whitespace-pre-wrap rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-5 text-sm text-[var(--color-body)]">
            {app.coverLetter}
          </div>
        </section>
      )}

      <RecruiterInterviewsSection applicationId={app.id} interviews={interviews} />

      <RecruiterOffersSection applicationId={app.id} offers={offers} />

      <ApplicationActionsClient
        applicationId={app.id}
        currentStatus={app.status}
        currentNotes={app.recruiterNotes ?? ""}
      />
    </div>
  );
}
