import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { ONBOARDING_STEPS } from "@/app/onboarding/candidate/_steps";

export default function PersonalStepLoading() {
  return (
    <OnboardingShell
      steps={ONBOARDING_STEPS}
      currentStepId="personal"
      saveStatus="idle"
      title="Tell us about yourself"
      subtitle="Some fields are prefilled from your resume — review and edit as needed."
      rightPane={<RightPaneSkeleton />}
    >
      <FormSkeleton />
    </OnboardingShell>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldSkeleton labelWidth="w-20" />
        <FieldSkeleton labelWidth="w-16" />
      </div>
      <FieldSkeleton labelWidth="w-28" withBadge />
      <FieldSkeleton labelWidth="w-44" withBadge tall />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldSkeleton labelWidth="w-12" withBadge />
        <FieldSkeleton labelWidth="w-28" />
        <FieldSkeleton labelWidth="w-20" withBadge />
      </div>
      <div className="flex justify-between pt-3">
        <Skeleton className="h-10 w-20 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
    </div>
  );
}

function FieldSkeleton({
  labelWidth,
  withBadge,
  tall,
}: {
  labelWidth: string;
  withBadge?: boolean;
  tall?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Skeleton className={`h-3 ${labelWidth}`} />
        {withBadge && (
          <Skeleton className="h-4 w-20 rounded-[var(--radius-pill)]" />
        )}
      </div>
      <Skeleton
        className={`${tall ? "h-24" : "h-10"} w-full rounded-xl`}
      />
    </div>
  );
}

function RightPaneSkeleton() {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-44 rounded-[var(--radius-pill)]" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
          <div className="h-3" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-4/5" />
          <div className="h-3" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}
