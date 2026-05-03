import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-20 rounded-[var(--radius-lg)]" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-[var(--radius-md)]" />
        ))}
      </div>
    </div>
  );
}
