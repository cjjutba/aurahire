import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <Skeleton className="h-4 w-40" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-[var(--radius-md)]" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-5 w-28 rounded-[var(--radius-pill)]" />
          </div>
        </div>
        <Skeleton className="h-10 w-32 rounded-[var(--radius-pill)]" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-[120px] w-[120px] rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-28 rounded-[var(--radius-pill)]" />
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="mt-5 space-y-2 border-t border-[var(--color-hairline-soft)] pt-4">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-12 w-full rounded-[var(--radius-md)]"
              />
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <Skeleton className="h-16 w-full rounded-[var(--radius-lg)]" />
          <div className="flex items-end justify-between border-b border-[var(--color-hairline-soft)] pb-4">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-24 w-full rounded-[var(--radius-lg)]"
            />
          ))}
        </div>
      </div>

      <Skeleton className="h-20 w-full rounded-[var(--radius-lg)]" />
    </div>
  );
}
