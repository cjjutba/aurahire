import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-12">
      <Skeleton className="h-5 w-32" />
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="space-y-2 text-right">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-8 md:flex-row md:items-center">
        <Skeleton className="h-48 w-48 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-6 w-32 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-[var(--radius-pill)]" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-20 w-full rounded-[var(--radius-lg)]" />
        </div>
      ))}
      <Skeleton className="h-48 w-full rounded-[var(--radius-lg)]" />
    </div>
  );
}
