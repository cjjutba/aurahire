import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-40 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-40 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-40 rounded-[var(--radius-lg)]" />
      </div>
    </div>
  );
}
