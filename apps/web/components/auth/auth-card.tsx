import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
        <h1 className="mb-1 text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          {title}
        </h1>
        {description && (
          <p className="mb-6 text-sm text-[var(--color-body)]">{description}</p>
        )}
        {children}
      </div>
      {footer && (
        <div className="mt-4 text-center text-sm text-[var(--color-body)]">{footer}</div>
      )}
    </div>
  );
}
