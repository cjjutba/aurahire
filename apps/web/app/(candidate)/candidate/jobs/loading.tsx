import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Header */}
      <header>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 min-w-48 flex-1 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-10 w-32 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-10 w-40 rounded-[var(--radius-pill)]" />
        <div className="flex-1" />
        <Skeleton className="h-10 w-32 rounded-[var(--radius-pill)]" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <JobCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function JobCardSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
      {/* Header: logo + company */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-[var(--radius-sm)]" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>

      {/* Title + department */}
      <div className="min-h-[3.25rem] space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-1 h-3 w-20" />
      </div>

      {/* Meta chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Skeleton className="h-6 w-20 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-6 w-16 rounded-[var(--radius-pill)]" />
      </div>

      {/* Match score row slot — kept here so the route-level skeleton has
          the same vertical rhythm as a hydrated card with a preview. */}
      <Skeleton className="h-1.5 w-full rounded-[var(--radius-pill)]" />

      {/* Footer: location + salary */}
      <div className="mt-auto space-y-2 border-t border-[var(--color-hairline-soft)] pt-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}
