import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div className="max-w-[720px] space-y-6">
        {/* Back link */}
        <Skeleton className="h-4 w-40" />

        {/* Header: title + subtext */}
        <header className="space-y-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-4 w-96" />
        </header>

        {/* Form card */}
        <div className="space-y-6 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          {/* Job title */}
          <FormField labelWidth="w-20" />

          {/* Salary + Currency */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <FormField labelWidth="w-16" />
            </div>
            <FormField labelWidth="w-20" />
          </div>

          {/* Start date + Offer expires */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField labelWidth="w-24" />
            <FormField labelWidth="w-28" />
          </div>

          {/* Hiring manager */}
          <FormField labelWidth="w-32" />

          {/* Benefits summary (textarea, rows=3) */}
          <div>
            <Skeleton className="mb-2 h-3 w-36" />
            <Skeleton className="h-[72px] w-full rounded-lg" />
          </div>

          {/* Personal note (textarea, rows=4) */}
          <div>
            <Skeleton className="mb-2 h-3 w-44" />
            <Skeleton className="h-[96px] w-full rounded-lg" />
          </div>

          {/* Buttons: Cancel + Send offer */}
          <div className="flex justify-end gap-2">
            <Skeleton className="h-9 w-20 rounded-[var(--radius-pill)]" />
            <Skeleton className="h-9 w-28 rounded-[var(--radius-pill)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ labelWidth }: { labelWidth: string }) {
  return (
    <div>
      <Skeleton className={`mb-2 h-3 ${labelWidth}`} />
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  );
}
