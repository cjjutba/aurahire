"use client";

interface AuditEntry {
  id: string;
  action: string;
  actorType: string;
  actorId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

interface Props {
  entries: AuditEntry[];
}

const ACTOR_COLOR: Record<string, string> = {
  user: "var(--color-primary)",
  ai: "var(--color-score-mid)",
  system: "var(--color-muted)",
};

function detailSnippet(
  action: string,
  details: Record<string, unknown> | null,
): string | null {
  if (!details) return null;
  if ("from" in details && "to" in details) {
    return `${String(details.from)} → ${String(details.to)}`;
  }
  if (action === "score.match.computed") {
    const overallScore = details.overallScore;
    const band = details.band;
    return overallScore != null ? `${String(overallScore)}/100 (${String(band)})` : null;
  }
  if (action === "application.email_sent") {
    return (details.kind as string) ?? null;
  }
  return null;
}

export function AuditTrailTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="text-sm text-[var(--color-muted)]">
        No audit entries for this application.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((e) => {
        const snippet = detailSnippet(e.action, e.details);
        const dotColor = ACTOR_COLOR[e.actorType] ?? "var(--color-muted)";
        return (
          <li key={e.id} className="flex items-start gap-3">
            <span
              className="mt-2 h-2 w-2 flex-shrink-0 rounded-full"
              style={{ backgroundColor: dotColor }}
              aria-hidden
            />
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <code className="rounded-[var(--radius-xs)] bg-[var(--color-surface-soft)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-ink)]">
                  {e.action}
                </code>
                <time className="text-xs text-[var(--color-muted)]">
                  {new Date(e.createdAt).toLocaleString()}
                </time>
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                actor: <span className="capitalize">{e.actorType}</span>
                {snippet ? <span> · {snippet}</span> : null}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
