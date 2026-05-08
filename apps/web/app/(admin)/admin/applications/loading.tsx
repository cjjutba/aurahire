import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Header: title + subtext */}
      <header>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-48" />
      </header>

      {/* Toolbar: search + filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 min-w-48 flex-1 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-10 w-40 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-10 w-44 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-10 w-56 rounded-[var(--radius-pill)]" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        {/* Table header band */}
        <div className="grid grid-cols-[1.5fr_1.5fr_1.4fr_1fr_1fr_1fr_40px] gap-4 border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-4 py-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-14" />
          <span />
        </div>
        {/* Table rows */}
        <div className="divide-y divide-[var(--color-hairline-soft)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[1.5fr_1.5fr_1.4fr_1fr_1fr_1fr_40px] items-center gap-4 px-4 py-3"
            >
              {/* Candidate */}
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
              {/* Job */}
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-44" />
              </div>
              {/* Score: ring + number */}
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 w-14" />
              </div>
              {/* Band chip */}
              <Skeleton className="h-5 w-24 rounded-[var(--radius-pill)]" />
              {/* Status chip */}
              <Skeleton className="h-5 w-20 rounded-[var(--radius-pill)]" />
              {/* Applied date */}
              <Skeleton className="h-4 w-24" />
              {/* Actions */}
              <Skeleton className="ml-auto h-8 w-8 rounded-[var(--radius-md)]" />
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Skeleton className="h-3 w-40" />
        <div className="flex items-center gap-1">
          <Skeleton className="h-9 w-9 rounded-[var(--radius-md)]" />
          <Skeleton className="h-9 w-9 rounded-[var(--radius-md)]" />
          <Skeleton className="h-9 w-9 rounded-[var(--radius-md)]" />
          <Skeleton className="h-9 w-9 rounded-[var(--radius-md)]" />
          <Skeleton className="h-9 w-9 rounded-[var(--radius-md)]" />
        </div>
      </div>
    </div>
  );
}
