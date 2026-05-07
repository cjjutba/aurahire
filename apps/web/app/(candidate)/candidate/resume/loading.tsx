import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Left rail: dropzone + list */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          {/* Upload dropzone */}
          <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>

          {/* List header */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-4" />
            </div>
            {/* List items */}
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-16 w-full rounded-[var(--radius-lg)]"
                />
              ))}
            </div>
          </div>
        </aside>

        {/* Right pane: preview card */}
        <section className="min-w-0">
          <div className="flex h-full min-h-[520px] flex-col rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
            {/* Preview header */}
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-hairline)] p-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-64 max-w-full" />
                <Skeleton className="h-3 w-80 max-w-full" />
              </div>
              <Skeleton className="h-7 w-44 rounded-[var(--radius-pill)]" />
            </header>

            {/* Preview body */}
            <div className="min-h-0 flex-1 space-y-8 overflow-hidden p-4">
              {/* AI extraction header */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-24 rounded-[var(--radius-pill)]" />
                </div>
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>

              {/* Contact section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3"
                    >
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-4 w-40 max-w-full" />
                    </div>
                  ))}
                </div>
              </section>

              {/* Summary section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </section>

              {/* Experience section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-3 w-24" />
                </div>
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Skeleton className="h-4 w-48 max-w-full" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-3 w-32" />
                    <div className="space-y-1.5 pt-1">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-11/12" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  </div>
                ))}
              </section>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
