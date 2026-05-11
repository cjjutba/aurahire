import Link from "next/link";
import { BiasFlagChip } from "@/components/bias/bias-flag-chip";

interface TermRow {
  term: string;
  count: number;
  exampleJobIds: string[];
}

interface Props {
  terms: TermRow[];
}

export function TopTermsTable({ terms }: Props) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
      <header className="border-b border-[var(--color-hairline)] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Top Flagged Terms
        </h3>
        <p className="mt-1 text-xs text-[var(--color-body)]">
          The AI&apos;s most-flagged words and phrases this period. Recurring
          terms suggest a default vocabulary worth coaching recruiters away from
         , or, if the term is genuinely role-specific, worth the override.
        </p>
      </header>

      {terms.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-[var(--color-muted)]">
          No flags in this period.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--color-hairline-soft)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                <th className="p-4">Term</th>
                <th className="p-4 text-center">Count</th>
                <th className="p-4 text-center">Jobs</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => (
                <tr
                  key={t.term}
                  className="border-b border-[var(--color-hairline-soft)] last:border-b-0"
                >
                  <td className="p-4">
                    <BiasFlagChip flag={{ term: t.term, category: "other" }} />
                  </td>
                  <td className="p-4 text-center font-mono text-sm text-[var(--color-ink)]">
                    {t.count}
                  </td>
                  <td className="p-4 text-center font-mono text-xs text-[var(--color-muted)]">
                    {t.exampleJobIds.length}
                    {t.exampleJobIds.length >= 3 && "+"}
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      href={`/admin/jobs?hasBiasFlags=true&q=${encodeURIComponent(t.term)}`}
                      className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-3 py-1 text-xs text-[var(--color-body)] transition-colors hover:bg-[var(--color-surface-soft)]"
                    >
                      View jobs →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
