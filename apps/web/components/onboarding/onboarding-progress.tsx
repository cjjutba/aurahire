import { Check } from "lucide-react";

interface Step {
  readonly id: string;
  readonly label: string;
}

interface Props {
  steps: readonly Step[];
  currentStepId: string;
  className?: string;
}

export function OnboardingProgress({ steps, currentStepId, className }: Props) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);
  const valueNow = currentIndex + 1;
  const total = steps.length;
  const percent = Math.round((valueNow / total) * 100);

  return (
    <div className={className}>
      {/* Desktop / tablet ≥ md: full segmented stepper */}
      <ol
        className="hidden items-start md:flex"
        role="progressbar"
        aria-valuenow={valueNow}
        aria-valuemax={total}
        aria-label="Onboarding progress"
      >
        {steps.map((step, i) => {
          const state =
            i < currentIndex
              ? "completed"
              : i === currentIndex
                ? "current"
                : "upcoming";
          const isLast = i === total - 1;
          return (
            <li
              key={step.id}
              className={
                isLast
                  ? "flex flex-col items-center"
                  : "flex flex-1 items-start"
              }
              data-step={step.id}
              data-state={state}
            >
              <div className="flex flex-col items-center">
                <div
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-200",
                    state === "completed" &&
                      "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-[0_2px_8px_rgba(37,99,235,0.18)]",
                    state === "current" &&
                      "border-2 border-[var(--color-primary)] bg-[var(--color-canvas)] text-[var(--color-primary)] ring-4 ring-[var(--color-primary-soft)]",
                    state === "upcoming" &&
                      "border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-muted)]",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label={
                    state === "completed"
                      ? `${step.label} completed`
                      : undefined
                  }
                >
                  {state === "completed" ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={[
                    "mt-3 whitespace-nowrap text-xs font-medium",
                    state === "current"
                      ? "font-semibold text-[var(--color-ink)]"
                      : state === "completed"
                        ? "text-[var(--color-body)]"
                        : "text-[var(--color-muted)]",
                  ].join(" ")}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div className="flex-1 px-3 pt-[18px]">
                  <div
                    className={[
                      "h-[2px] w-full rounded-full transition-all duration-300",
                      state === "completed"
                        ? "bg-[var(--color-primary)]"
                        : "bg-[var(--color-hairline)]",
                    ].join(" ")}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile: compact step header + thin progress bar */}
      <div
        className="md:hidden"
        role="progressbar"
        aria-valuenow={valueNow}
        aria-valuemax={total}
        aria-label="Onboarding progress"
      >
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
              Step {valueNow} of {total}
            </p>
            <p className="mt-1 text-base font-semibold text-[var(--color-ink)]">
              {steps[currentIndex]?.label ?? ""}
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-[var(--color-muted)]">
            {percent}%
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-hairline)]">
          <div
            className="h-full bg-[var(--color-primary)] transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
