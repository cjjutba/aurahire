import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-1 h-4 w-96 max-w-full" />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Left rail: dropzone + list */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          {/* Upload dropzone */}
          <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
            <Skeleton className="h-8 w-8 rounded-[var(--radius-sm)]" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>

          {/* List header */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-4" />
            </div>
            <ul className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3"
                >
                  <Skeleton className="h-10 w-10 shrink-0 rounded-[var(--radius-md)]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-40 max-w-full" />
                    <Skeleton className="h-3 w-48 max-w-full" />
                  </div>
                  <Skeleton className="h-8 w-8 shrink-0 rounded-[var(--radius-md)]" />
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Right pane: preview card */}
        <section className="min-w-0">
          <div className="flex h-full min-h-[520px] flex-col rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
            {/* Preview header */}
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-hairline)] p-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-64 max-w-full" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
              <Skeleton className="h-7 w-52 rounded-[var(--radius-pill)]" />
            </header>

            {/* Preview body */}
            <div className="min-h-0 flex-1 space-y-8 overflow-hidden p-4">
              {/* AI extraction header */}
              <div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-24 rounded-[var(--radius-pill)]" />
                </div>
                <Skeleton className="mt-1 h-3 w-72 max-w-full" />
              </div>

              {/* Contact section */}
              <ParsedSectionSkeleton labelWidth="w-20">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3"
                    >
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="mt-1.5 h-4 w-40 max-w-full" />
                    </div>
                  ))}
                </div>
              </ParsedSectionSkeleton>

              {/* Summary section */}
              <ParsedSectionSkeleton labelWidth="w-20">
                <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </ParsedSectionSkeleton>

              {/* Experience section */}
              <ParsedSectionSkeleton labelWidth="w-24">
                <ol className="space-y-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <li
                      key={i}
                      className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <Skeleton className="h-4 w-48 max-w-full" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="mt-1 h-3 w-32" />
                      <div className="mt-2 space-y-1.5 pl-5">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-11/12" />
                        <Skeleton className="h-3 w-4/5" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {Array.from({ length: 4 }).map((_, j) => (
                          <Skeleton
                            key={j}
                            className="h-5 w-16 rounded-[var(--radius-pill)]"
                          />
                        ))}
                      </div>
                    </li>
                  ))}
                </ol>
              </ParsedSectionSkeleton>

              {/* Education section */}
              <ParsedSectionSkeleton labelWidth="w-24">
                <ul className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <li
                      key={i}
                      className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <Skeleton className="h-4 w-56 max-w-full" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="mt-1 h-3 w-44 max-w-full" />
                    </li>
                  ))}
                </ul>
              </ParsedSectionSkeleton>

              {/* Skills section */}
              <ParsedSectionSkeleton labelWidth="w-20">
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      className="h-7 w-20 rounded-[var(--radius-pill)]"
                    />
                  ))}
                </div>
              </ParsedSectionSkeleton>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ParsedSectionSkeleton({
  labelWidth,
  children,
}: {
  labelWidth: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Skeleton className="h-3.5 w-3.5 rounded-[var(--radius-xs)]" />
        <Skeleton className={`h-3 ${labelWidth}`} />
      </div>
      {children}
    </section>
  );
}
