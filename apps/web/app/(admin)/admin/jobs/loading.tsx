import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Header: title + count, no CTA */}
      <header>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-16" />
      </header>

      {/* Toolbar pills: search + 2 filter dropdowns + spacer */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 min-w-48 flex-1 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-10 w-40 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-10 w-36 rounded-[var(--radius-pill)]" />
        <div className="flex-1" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        {/* Header band */}
        <div className="grid grid-cols-[2fr_1fr_1fr_0.9fr_0.5fr_0.5fr_1fr_40px] gap-4 border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-4 py-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="ml-auto h-3 w-10" />
          <Skeleton className="ml-auto h-3 w-10" />
          <Skeleton className="h-3 w-14" />
          <span />
        </div>
        {/* Rows */}
        <div className="divide-y divide-[var(--color-hairline-soft)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[2fr_1fr_1fr_0.9fr_0.5fr_0.5fr_1fr_40px] items-center gap-4 px-4 py-3"
            >
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-20 rounded-[var(--radius-pill)]" />
              <Skeleton className="ml-auto h-4 w-6" />
              <Skeleton className="ml-auto h-4 w-6" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="ml-auto h-6 w-6 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
