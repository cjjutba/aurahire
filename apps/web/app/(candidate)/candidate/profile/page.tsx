import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { ScoreRing } from "@/components/score/score-ring";
import { MatchBandChip } from "@/components/score/match-band-chip";
import { ScoreBreakdownBar } from "@/components/score/score-breakdown-bar";
import { EvidenceCallout } from "@/components/score/evidence-callout";
import { RecomputeButtonClient } from "./_recompute-button-client";

export const metadata = { title: "My Profile Score" };

const COMPONENT_LABELS: Record<string, string> = {
  completeness: "Completeness",
  skill_depth: "Skill Depth",
  experience_clarity: "Experience Clarity",
  education_quality: "Education Quality",
};

interface ProfileScoreData {
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
      source: string;
      relevance: "positive" | "negative" | "neutral";
    }>;
  }>;
  improvementSuggestions: Array<{
    title: string;
    description: string;
    estimatedImpact: number;
  }>;
  redactedFields: string[];
  promptVersion: string;
  modelUsed: string;
  latencyMs: number;
  createdAt: string;
}

export default async function ProfilePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/scoring/profile/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="mx-auto max-w-[840px] py-12 text-center">
        <p className="text-[var(--color-status-danger)]">
          Failed to load profile score.
        </p>
      </div>
    );
  }

  const body = (await res.json()) as { data: ProfileScoreData | null };

  if (!body.data) {
    return (
      <div className="mx-auto max-w-[840px] py-16 text-center">
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          No score yet
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          Compute your Profile Score from the dashboard.
        </p>
        <Link
          href="/candidate"
          className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 py-2 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          Go to dashboard
        </Link>
      </div>
    );
  }

  const data = body.data;

  return (
    <div className="mx-auto max-w-[1024px] space-y-12">
      <header className="flex flex-col items-start gap-8 md:flex-row md:items-center">
        <ScoreRing score={data.overallScore} band={data.band} size="lg" />
        <div className="space-y-3">
          <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
            Your Profile Score
          </h1>
          <MatchBandChip band={data.band} />
          <p className="text-sm text-[var(--color-muted)]">
            Computed {new Date(data.createdAt).toLocaleString()} ·{" "}
            <span className="font-mono">{data.latencyMs}ms</span> · {data.modelUsed}
          </p>
          <RecomputeButtonClient />
        </div>
      </header>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Component Breakdown
        </h2>
        <ScoreBreakdownBar
          components={data.components.map((c) => ({
            name: c.name,
            label: COMPONENT_LABELS[c.name] ?? c.name,
            score: c.score,
            max: c.max,
            weight: c.weight,
            href: `#component-${c.name}`,
          }))}
        />
      </section>

      {data.components.map((c) => (
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
                  key={`${c.name}-ev-${i}`}
                  excerpt={ev.excerpt}
                  source={ev.source}
                  relevance={ev.relevance}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      {data.improvementSuggestions.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-[var(--color-ink)]">
            How to improve
          </h2>
          <div className="space-y-3">
            {data.improvementSuggestions.map((s, i) => (
              <article
                key={i}
                className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5"
              >
                <header className="mb-1 flex items-center justify-between">
                  <h3 className="font-semibold text-[var(--color-ink)]">
                    {s.title}
                  </h3>
                  <span className="font-mono text-xs text-[var(--color-primary)]">
                    +{s.estimatedImpact} pts
                  </span>
                </header>
                <p className="text-sm text-[var(--color-body)]">{s.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Fairness &amp; Transparency
        </h2>
        <p className="mt-3 text-sm text-[var(--color-body)]">
          Before scoring, we redacted personal information from your resume so the
          AI scores you on your skills and experience — not on identity markers.
        </p>
        {data.redactedFields.length > 0 && (
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            <strong className="text-[var(--color-body)]">
              Redacted before scoring:
            </strong>{" "}
            {data.redactedFields.join(", ")}
          </p>
        )}
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Scored by {data.modelUsed} with prompt v{data.promptVersion}.
        </p>
      </section>
    </div>
  );
}
