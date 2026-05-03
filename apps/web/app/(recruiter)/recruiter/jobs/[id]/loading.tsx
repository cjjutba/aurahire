import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1024px] space-y-6">
      <Skeleton className="h-5 w-32" />
      <div className="space-y-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-20 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-9 w-32 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-9 w-24 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-9 w-28 rounded-[var(--radius-pill)]" />
        </div>
      </div>
      <Skeleton className="h-64 w-full rounded-[var(--radius-lg)]" />
      <Skeleton className="h-32 w-full rounded-[var(--radius-lg)]" />
    </div>
  );
}
