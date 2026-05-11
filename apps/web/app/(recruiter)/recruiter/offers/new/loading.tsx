import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Back link */}
      <Skeleton className="h-4 w-40" />

      {/* Header: title + subtext */}
      <header className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </header>

      {/* Form card */}
      <div className="space-y-8 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8">
        {/* Basics */}
        <section className="space-y-4">
          <Skeleton className="h-4 w-16" />
          <FormField labelWidth="w-20" />
        </section>

        {/* Compensation */}
        <section className="space-y-4">
          <Skeleton className="h-4 w-32" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <FormField labelWidth="w-16" />
            </div>
            <FormField labelWidth="w-20" />
          </div>
        </section>

        {/* Schedule */}
        <section className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField labelWidth="w-24" />
            <FormField labelWidth="w-28" />
          </div>
        </section>

        {/* Details */}
        <section className="space-y-4">
          <Skeleton className="h-4 w-20" />
          <FormField labelWidth="w-32" />
          <div className="grid gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-[72px] w-full rounded-lg" />
          </div>
          <div className="grid gap-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-[96px] w-full rounded-lg" />
          </div>
        </section>

        {/* Buttons: Cancel + Send offer */}
        <div className="flex justify-end gap-2 border-t border-[var(--color-hairline)] pt-6">
          <Skeleton className="h-9 w-20 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-9 w-28 rounded-[var(--radius-pill)]" />
        </div>
      </div>
    </div>
  );
}

function FormField({ labelWidth }: { labelWidth: string }) {
  return (
    <div className="grid gap-2">
      <Skeleton className={`h-4 ${labelWidth}`} />
      <Skeleton className="h-9 w-full rounded-lg" />
    </div>
  );
}
