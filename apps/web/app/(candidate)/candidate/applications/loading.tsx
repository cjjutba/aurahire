import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-11 w-36 rounded-[var(--radius-pill)]" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 flex-1 min-w-48 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-10 w-28 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-10 w-32 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-10 w-28 rounded-[var(--radius-pill)] ml-auto" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-[var(--radius-lg)]" />
        ))}
      </div>
    </div>
  );
}
