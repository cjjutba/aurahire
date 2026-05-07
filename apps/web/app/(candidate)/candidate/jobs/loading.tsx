import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

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
          <Skeleton key={i} className="h-56 rounded-[var(--radius-lg)]" />
        ))}
      </div>
    </div>
  );
}
