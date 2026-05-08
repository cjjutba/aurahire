import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Header: title + subtext */}
      <header className="space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-16" />
      </header>

      {/* Toolbar: search pill + filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 min-w-48 flex-1 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-10 w-32 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-10 w-36 rounded-[var(--radius-pill)]" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        {/* Header band */}
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_40px] gap-4 border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-4 py-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-14" />
          <span />
        </div>
        {/* Rows */}
        <div className="divide-y divide-[var(--color-hairline-soft)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_40px] items-center gap-4 px-4 py-3"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-20 rounded-[var(--radius-pill)]" />
              <Skeleton className="h-5 w-20 rounded-[var(--radius-pill)]" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="ml-auto h-8 w-8 rounded-[var(--radius-md)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
