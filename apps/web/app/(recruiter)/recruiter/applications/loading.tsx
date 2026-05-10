import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Header: title + subtext */}
      <header className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </header>

      {/* Toolbar: search + filter pills + sort */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 min-w-48 flex-1 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-10 w-40 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-10 w-40 rounded-[var(--radius-pill)]" />
        <div className="flex-1" />
        <Skeleton className="h-10 w-36 rounded-[var(--radius-pill)]" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        {/* Table header band */}
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_0.8fr_1fr_40px] gap-4 border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-4 py-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="ml-auto h-3 w-12" />
          <Skeleton className="h-3 w-14" />
          <span />
        </div>
        {/* Table rows */}
        <div className="divide-y divide-[var(--color-hairline-soft)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[2fr_1.5fr_1fr_1fr_0.8fr_1fr_40px] items-center gap-4 px-4 py-3"
            >
              {/* Candidate: avatar + name + secondary line */}
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-[var(--radius-full)]" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
              {/* Job: logo + title */}
              <div className="flex min-w-0 items-center gap-2">
                <Skeleton className="h-7 w-7 shrink-0 rounded-[var(--radius-sm)]" />
                <Skeleton className="h-4 w-32" />
              </div>
              {/* Status pill */}
              <Skeleton className="h-5 w-20 rounded-[var(--radius-pill)]" />
              {/* Match band chip */}
              <Skeleton className="h-5 w-24 rounded-[var(--radius-pill)]" />
              {/* Score */}
              <Skeleton className="ml-auto h-4 w-12" />
              {/* Applied date */}
              <Skeleton className="h-4 w-20" />
              {/* Row actions */}
              <Skeleton className="ml-auto h-6 w-6 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
