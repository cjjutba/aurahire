import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-32 rounded-[var(--radius-pill)]" />
      </header>

      {/* Two-column dashboard */}
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Left rail */}
        <aside className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-[120px] w-[120px] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-6 w-28 rounded-[var(--radius-pill)]" />
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="mt-5 border-t border-[var(--color-hairline-soft)] pt-4">
            <Skeleton className="mb-3 h-3 w-40" />
            <ul className="space-y-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="rounded-[var(--radius-md)] px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="mt-2 h-1.5 w-full rounded-[var(--radius-pill)]" />
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Right pane */}
        <section className="space-y-5 rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-hairline-soft)] pb-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="ml-auto h-6 w-20" />
              <Skeleton className="ml-auto h-1.5 w-32 rounded-[var(--radius-pill)]" />
            </div>
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-24 w-full rounded-[var(--radius-md)]"
              />
            ))}
          </div>
        </section>
      </div>

      {/* Improvements grid */}
      <section>
        <header className="mb-3 flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-[var(--radius-xs)]" />
          <Skeleton className="h-3 w-32" />
        </header>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <article
              key={i}
              className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4"
            >
              <header className="mb-2 flex items-start justify-between gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-14 rounded-[var(--radius-pill)]" />
              </header>
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Fairness disclosure */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-4 w-4 rounded-[var(--radius-xs)]" />
        </div>
      </div>
    </div>
  );
}
