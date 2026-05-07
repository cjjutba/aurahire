import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6 pb-24 lg:pb-6">
      {/* Back link */}
      <Skeleton className="h-5 w-32" />

      {/* Header card */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 sm:p-8">
        <div className="flex items-start gap-5">
          <Skeleton className="h-14 w-14 rounded-[var(--radius-md)]" />
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="hidden h-10 w-40 rounded-[var(--radius-pill)] sm:block" />
            </div>
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-7 w-20 rounded-[var(--radius-pill)]" />
              <Skeleton className="h-7 w-24 rounded-[var(--radius-pill)]" />
              <Skeleton className="h-7 w-20 rounded-[var(--radius-pill)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Skeleton className="h-32 rounded-[var(--radius-lg)]" />
          <Skeleton className="h-72 rounded-[var(--radius-lg)]" />
          <Skeleton className="h-24 rounded-[var(--radius-lg)]" />
        </div>
        <aside className="space-y-4">
          <Skeleton className="h-44 rounded-[var(--radius-lg)]" />
          <Skeleton className="h-32 rounded-[var(--radius-lg)]" />
          <Skeleton className="h-56 rounded-[var(--radius-lg)]" />
          <Skeleton className="h-24 rounded-[var(--radius-lg)]" />
        </aside>
      </div>
    </div>
  );
}
