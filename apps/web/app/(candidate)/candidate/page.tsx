export const metadata = { title: "Candidate Dashboard" };

export default function CandidateDashboard() {
  return (
    <div className="mx-auto max-w-[1280px]">
      <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
        Welcome back
      </h1>
      <p className="mt-2 text-[var(--color-body)]">
        Your AuraHire dashboard is coming together.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {["Profile Score", "Active Applications", "Upcoming Interviews"].map(
          (card) => (
            <div
              key={card}
              className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6"
            >
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {card}
              </h3>
              <p className="mt-3 text-sm text-[var(--color-body)]">
                Coming in a future slice.
              </p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
