import type { ReactNode } from "react";
import { OnboardingProgress } from "./onboarding-progress";
import { SaveStatusIndicator, type SaveStatus } from "./save-status-indicator";

interface Step {
  readonly id: string;
  readonly label: string;
}

interface Props {
  steps: readonly Step[];
  currentStepId: string;
  saveStatus: SaveStatus;
  onSaveRetry?: () => void;
  /** Right pane content. If null/undefined, the body becomes single-column. */
  rightPane?: ReactNode;
  /** Mobile-only "View resume" / "View preview" trigger. */
  mobileRightPaneToggle?: ReactNode;
  /**
   * Optional uppercase eyebrow above the page heading. Defaults to
   * "STEP {n} · {label}" when omitted but a `title` is set.
   */
  eyebrow?: string;
  /** Page H1. */
  title?: string;
  /** Subtitle below the H1. */
  subtitle?: ReactNode;
  children: ReactNode;
}

export function OnboardingShell({
  steps,
  currentStepId,
  saveStatus,
  onSaveRetry,
  rightPane,
  mobileRightPaneToggle,
  eyebrow,
  title,
  subtitle,
  children,
}: Props) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);
  const stepCount = steps.length;
  const currentLabel = steps[currentIndex]?.label ?? "";
  const wideContainerCls = rightPane ? "max-w-[1280px]" : "max-w-[720px]";

  const computedEyebrow =
    eyebrow ??
    (title ? `Step ${currentIndex + 1} · ${currentLabel}` : undefined);

  const headingBlock =
    title || subtitle ? (
      <div className="mb-6">
        {computedEyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
            {computedEyebrow}
          </p>
        )}
        {title && (
          <h1 className="mt-2 font-[var(--font-display)] text-[26px] font-normal tracking-[-0.5px] text-[var(--color-ink)] sm:text-[28px]">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-body)]">
            {subtitle}
          </p>
        )}
      </div>
    ) : null;

  return (
    <div className="flex flex-1 flex-col">
      {/* Wizard progress — floats on the page canvas, compact spacing. */}
      <div
        className={`mx-auto w-full px-4 pt-5 pb-3 sm:px-6 sm:pt-7 sm:pb-4 ${wideContainerCls}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="font-mono text-xs tabular-nums text-[var(--color-muted)]">
            <span className="text-[var(--color-ink)]">
              Step {currentIndex + 1}
            </span>
            <span className="text-[var(--color-muted-soft)]"> / </span>
            {stepCount}
          </p>
          <div className="flex items-center gap-3">
            <SaveStatusIndicator status={saveStatus} onRetry={onSaveRetry} />
            {mobileRightPaneToggle && (
              <span className="lg:hidden">{mobileRightPaneToggle}</span>
            )}
          </div>
        </div>
        <OnboardingProgress steps={steps} currentStepId={currentStepId} />
      </div>

      {/* Content — no card wrapper, no background. Children render on canvas. */}
      {rightPane ? (
        <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-0 lg:grid-cols-[1.3fr_1fr]">
          <section className="min-w-0 px-4 pb-10 pt-2 sm:px-6 sm:pb-12 sm:pt-4">
            {headingBlock}
            {children}
          </section>
          {/* min-w-0 + overflow-hidden so wide right-pane content (PDF canvas)
              cannot blow out the fr-ratio and squash the form column. */}
          <aside className="hidden min-w-0 overflow-hidden border-l border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-6 py-6 lg:block">
            {rightPane}
          </aside>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[720px] px-4 pb-10 pt-2 sm:px-6 sm:pb-12 sm:pt-4">
          {headingBlock}
          {children}
        </div>
      )}
    </div>
  );
}
