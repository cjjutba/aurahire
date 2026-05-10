import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56" />
      </header>

      {/* Toolbar: search */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 min-w-48 flex-1 rounded-[var(--radius-pill)]" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        {/* Table header band */}
        <div className="grid grid-cols-[2fr_1.4fr_0.7fr_0.6fr_0.9fr_0.9fr_40px] gap-4 border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-4 py-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="ml-auto h-3 w-14" />
          <Skeleton className="ml-auto h-3 w-10" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-12" />
          <span />
        </div>
        {/* Table rows */}
        <div className="divide-y divide-[var(--color-hairline-soft)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[2fr_1.4fr_0.7fr_0.6fr_0.9fr_0.9fr_40px] items-center gap-4 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-[var(--radius-sm)]" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="ml-auto h-4 w-6" />
              <Skeleton className="ml-auto h-4 w-6" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-20 rounded-[var(--radius-pill)]" />
              <Skeleton className="ml-auto h-6 w-6 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
