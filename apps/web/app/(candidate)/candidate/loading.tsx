import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-80" />
      </header>

      {/* Section 1: KPI Hero Row + range filter */}
      <section>
        <div className="mb-3 flex items-center justify-end">
          <Skeleton className="h-9 w-36 rounded-[var(--radius-pill)]" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiTileSkeleton key={i} />
          ))}
        </div>
      </section>

      {/* Section 2: Snapshot */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Skeleton className="h-3.5 w-3.5 rounded-[var(--radius-xs)]" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ProfileScoreCardSkeleton />
          <StatusBreakdownCardSkeleton />
          <UpcomingInterviewsCardSkeleton />
        </div>
      </section>

      {/* Section 3: Recent Applications */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-3.5 rounded-[var(--radius-xs)]" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
          <ul className="divide-y divide-[var(--color-hairline-soft)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-5 w-20 rounded-[var(--radius-pill)]" />
                <Skeleton className="h-8 w-8 shrink-0 rounded-[var(--radius-sm)]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="hidden h-5 w-24 rounded-[var(--radius-pill)] md:block" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="hidden h-3 w-20 sm:block" />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function KpiTileSkeleton() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-4 rounded-[var(--radius-xs)]" />
      </div>
      <Skeleton className="mt-3 h-9 w-20" />
      <Skeleton className="mt-2 h-3 w-28" />
    </div>
  );
}

function ProfileScoreCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <Skeleton className="h-4 w-28" />
      <div className="mt-4 flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-28 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

function StatusBreakdownCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="h-3.5 w-3.5 rounded-[var(--radius-xs)]" />
        <Skeleton className="h-4 w-44" />
      </div>
      <ul className="space-y-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-2 flex-1 rounded-[var(--radius-sm)]" />
            <Skeleton className="h-3 w-6" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function UpcomingInterviewsCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-3.5 rounded-[var(--radius-xs)]" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-3 w-14" />
      </div>
      <ul className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-[var(--radius-md)]" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-32" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
