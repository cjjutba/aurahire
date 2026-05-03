import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-5 w-2/3" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-[var(--radius-lg)]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-80 rounded-[var(--radius-lg)]" />
      </div>
      <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
      <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
    </div>
  );
}
