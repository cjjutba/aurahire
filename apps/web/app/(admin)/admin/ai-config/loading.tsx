import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[840px] space-y-6">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-5 w-96" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-48 rounded-[var(--radius-lg)]" />
      ))}
      <Skeleton className="h-12 w-64 rounded-[var(--radius-pill)]" />
    </div>
  );
}
