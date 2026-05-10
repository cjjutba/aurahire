import Link from "next/link";

export interface OfferRow {
  id: string;
  title: string;
  salary: number;
  salaryCurrency: string;
  startDate: string;
  status: string;
  sentAt: string;
  respondedAt: string | null;
  expiresAt: string | null;
}

interface Props {
  applicationId: string;
  offers: OfferRow[];
  applicationStatus: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "var(--color-status-info)",
  accepted: "var(--color-score-high)",
  declined: "var(--color-status-danger)",
  expired: "var(--color-muted)",
  withdrawn: "var(--color-muted)",
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

export function RecruiterOffersSection({ applicationId, offers, applicationStatus }: Props) {
  const hasPending = offers.some((o) => o.status === "pending");
  const canSendOffer =
    !hasPending &&
    (applicationStatus === "interview" || applicationStatus === "offer_declined");

  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Offers
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Send and track offers for this candidate.
          </p>
        </div>
        {canSendOffer && (
          <Link
            href={`/recruiter/offers/new?applicationId=${applicationId}`}
            className="inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
          >
            Send offer
          </Link>
        )}
      </header>

      {offers.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No offers sent yet.</p>
      ) : (
        <ul className="space-y-2">
          {offers.map((o) => (
            <li
              key={o.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <strong className="text-[var(--color-ink)]">{o.title}</strong>
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: STATUS_COLORS[o.status] ?? "var(--color-muted)" }}
                >
                  {o.status}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-[var(--color-body)]">
                {formatSalary(o.salary, o.salaryCurrency)} · starts {o.startDate}
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Sent {new Date(o.sentAt).toLocaleString()}
                {o.respondedAt && (
                  <> · responded {new Date(o.respondedAt).toLocaleString()}</>
                )}
                {o.expiresAt && o.status === "pending" && (
                  <> · expires {new Date(o.expiresAt).toLocaleDateString()}</>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
