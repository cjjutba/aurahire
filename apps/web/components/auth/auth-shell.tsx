import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  subtitle?: ReactNode;
  /** Renders above the title, used for "Candidate" / "Recruiter" wayfinding chip */
  topSlot?: ReactNode;
  children?: ReactNode;
  /** Renders below the form (e.g. "Don't have an account? Sign up") */
  footer?: ReactNode;
}

export function AuthShell({ title, subtitle, topSlot, children, footer }: AuthShellProps) {
  return (
    <div className="mx-auto w-full max-w-[360px] sm:max-w-[400px]">
      {topSlot && <div className="mb-4 flex justify-center">{topSlot}</div>}
      <h1 className="mb-2 text-center font-[var(--font-display)] text-[28px] font-normal tracking-[-0.5px] text-[var(--color-ink)] sm:text-[30px]">
        {title}
      </h1>
      {subtitle ? (
        <p className="mx-auto mb-8 max-w-[320px] text-center text-sm leading-relaxed text-[var(--color-body)]">
          {subtitle}
        </p>
      ) : (
        <div className="mb-8" />
      )}
      {children}
      {footer && (
        <div className="mt-6 text-center text-sm text-[var(--color-body)]">{footer}</div>
      )}
    </div>
  );
}
