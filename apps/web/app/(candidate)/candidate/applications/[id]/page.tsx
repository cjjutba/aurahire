import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { ScoreRing } from "@/components/score/score-ring";
import { MatchBandChip } from "@/components/score/match-band-chip";
import { ScoreBreakdownBar } from "@/components/score/score-breakdown-bar";
import { EvidenceCallout } from "@/components/score/evidence-callout";
import { WithdrawButtonClient } from "./_withdraw-button-client";

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
  redactedFields: string[];
  promptVersion: string;
  modelUsed: string;
  latencyMs: number;
}

interface AppDetail {
  id: string;
  status: string;
  appliedAt: string;
  job: { id: string; title: string; company: { name: string } } | null;
  matchScore: MatchScoreData | null;
}

export const metadata = { title: "Application Detail" };

export default async function ApplicationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/applications/${id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (res.status === 404) notFound();
  if (!res.ok) {
    return <div className="text-[var(--color-status-danger)]">Failed to load.</div>;
  }

  const body = (await res.json()) as { data: AppDetail };
  const app = body.data;
  const score = app.matchScore;
  const canWithdraw = !["hired", "rejected", "withdrawn"].includes(app.status);

  return (
    <div className="mx-auto max-w-[1024px] space-y-12">
      <Link
        href="/candidate/applications"
        className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back to applications
      </Link>

      {!score ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-8 text-center">
          <h2 className="text-xl font-semibold text-[var(--color-ink)]">
            Score pending
          </h2>
          <p className="mt-2 text-sm text-[var(--color-body)]">
            Match scoring failed or is still in progress. Try refreshing in a moment.
          </p>
        </div>
      ) : (
        <>
          <header className="flex flex-col gap-8 md:flex-row md:items-center">
            <ScoreRing score={score.overallScore} band={score.band} size="lg" />
            <div className="space-y-3">
              <p className="text-sm text-[var(--color-muted)]">
                Application for{" "}
                <Link
                  href={`/candidate/jobs/${app.job?.id ?? ""}`}
                  className="text-[var(--color-primary)] hover:underline"
                >
                  {app.job?.title ?? "Job"}
                </Link>{" "}
                at {app.job?.company.name ?? ""}
              </p>
              <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
                Your match
              </h1>
              <MatchBandChip band={score.band} />
              <p className="text-sm text-[var(--color-muted)]">
                Applied {new Date(app.appliedAt).toLocaleString()} · Status:{" "}
                <strong>{app.status}</strong>
              </p>
              {canWithdraw && <WithdrawButtonClient applicationId={app.id} />}
            </div>
          </header>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Summary
            </h2>
            <p className="text-sm text-[var(--color-body)]">{score.summary}</p>
          </section>

          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Component Breakdown
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
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-score-high)]">
                Standout Strengths
              </h2>
              <ul className="space-y-1 text-sm text-[var(--color-body)]">
                {score.greenFlags.map((g, i) => (
                  <li key={i}>• {g}</li>
                ))}
              </ul>
            </section>
          )}

          {score.redFlags && score.redFlags.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-score-low)]">
                Significant Gaps
              </h2>
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
                <h2 className="text-xl font-semibold text-[var(--color-ink)]">
                  {COMPONENT_LABELS[c.name] ?? c.name}
                </h2>
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

          <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Fairness &amp; Transparency
            </h2>
            <p className="mt-3 text-sm text-[var(--color-body)]">
              Before scoring, your personal information was redacted so the AI scores
              you on skills + experience, not identity markers.
            </p>
            {score.redactedFields.length > 0 && (
              <p className="mt-3 text-xs text-[var(--color-muted)]">
                <strong className="text-[var(--color-body)]">
                  Redacted before scoring:
                </strong>{" "}
                {score.redactedFields.join(", ")}
              </p>
            )}
            <p className="mt-3 text-xs text-[var(--color-muted)]">
              Scored by {score.modelUsed} with prompt v{score.promptVersion}.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
