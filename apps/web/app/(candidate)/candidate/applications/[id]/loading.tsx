import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-12">
      <Skeleton className="h-5 w-32" />
      <div className="flex flex-col gap-8 md:flex-row md:items-center">
        <Skeleton className="h-48 w-48 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-32 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-[var(--radius-pill)]" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-20 w-full rounded-[var(--radius-lg)]" />
        </div>
      ))}
    </div>
  );
}
