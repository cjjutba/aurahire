import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-32 rounded-[var(--radius-lg)]" />
      <div className="space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-[var(--radius-md)]" />
        ))}
      </div>
    </div>
  );
}
