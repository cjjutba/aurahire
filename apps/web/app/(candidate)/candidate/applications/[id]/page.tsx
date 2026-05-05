import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { ScoreRing } from "@/components/score/score-ring";
import { MatchBandChip } from "@/components/score/match-band-chip";
import { ScoreBreakdownBar } from "@/components/score/score-breakdown-bar";
import { EvidenceCallout } from "@/components/score/evidence-callout";
import { WithdrawButtonClient } from "./_withdraw-button-client";
import { OfferActionsClient } from "./_offer-actions-client";

interface InterviewRow {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  format: string;
  status: string;
  locationOrLink: string | null;
}

interface OfferRow {
  id: string;
  status: string;
  title: string;
  salary: number;
  salaryCurrency: string;
  startDate: string;
  managerName: string | null;
  benefitsSummary: string | null;
  customMessage: string | null;
  expiresAt: string | null;
  sentAt: string;
  respondedAt: string | null;
}

const INTERVIEW_FORMAT_LABELS: Record<string, string> = {
  phone: "Phone",
  video: "Video",
  "in-person": "In-Person",
};

function formatSalary(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

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
  const canWithdraw = !["hired", "rejected", "withdrawn"].includes(app.status);

  const interviews: InterviewRow[] = interviewsRes.ok
    ? ((await interviewsRes.json()) as { data: InterviewRow[] }).data
    : [];
  const offers: OfferRow[] = offersRes.ok
    ? ((await offersRes.json()) as { data: OfferRow[] }).data
    : [];
  const pendingOffer = offers.find((o) => o.status === "pending") ?? null;
  const pastOffers = offers.filter((o) => o.status !== "pending");

  return (
    <div className="mx-auto max-w-[1280px] space-y-12">
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

          {pendingOffer && (
            <section className="space-y-4 rounded-[var(--radius-lg)] border-2 border-[var(--color-primary)] bg-[var(--color-primary-soft)] p-6">
              <header>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                  Offer Extended
                </h2>
                <p className="mt-2 text-xl font-semibold text-[var(--color-ink)]">
                  {pendingOffer.title}
                </p>
              </header>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                    Salary
                  </dt>
                  <dd className="mt-1 font-mono text-base text-[var(--color-ink)]">
                    {formatSalary(pendingOffer.salary, pendingOffer.salaryCurrency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                    Start date
                  </dt>
                  <dd className="mt-1 font-mono text-base text-[var(--color-ink)]">
                    {pendingOffer.startDate}
                  </dd>
                </div>
                {pendingOffer.managerName && (
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                      Hiring manager
                    </dt>
                    <dd className="mt-1 text-base text-[var(--color-ink)]">
                      {pendingOffer.managerName}
                    </dd>
                  </div>
                )}
                {pendingOffer.expiresAt && (
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                      Respond by
                    </dt>
                    <dd className="mt-1 text-base text-[var(--color-ink)]">
                      {new Date(pendingOffer.expiresAt).toLocaleDateString()}
                    </dd>
                  </div>
                )}
              </dl>
              {pendingOffer.benefitsSummary && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Benefits
                  </h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-body)]">
                    {pendingOffer.benefitsSummary}
                  </p>
                </div>
              )}
              {pendingOffer.customMessage && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Note from the recruiter
                  </h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-body)]">
                    {pendingOffer.customMessage}
                  </p>
                </div>
              )}
              <OfferActionsClient offer={pendingOffer} />
            </section>
          )}

          {pastOffers.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Offer history
              </h2>
              <ul className="space-y-2">
                {pastOffers.map((o) => (
                  <li
                    key={o.id}
                    className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <strong className="text-[var(--color-ink)]">{o.title}</strong>
                      <span className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                        {o.status}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-[var(--color-body)]">
                      {formatSalary(o.salary, o.salaryCurrency)} · {o.startDate}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {interviews.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Interviews
              </h2>
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
                        {INTERVIEW_FORMAT_LABELS[i.format] ?? i.format} · {i.durationMinutes} min ·{" "}
                        {i.status}
                      </span>
                    </div>
                    {i.locationOrLink && (
                      <p className="mt-1 break-all text-xs text-[var(--color-body)]">
                        {i.locationOrLink}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

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
