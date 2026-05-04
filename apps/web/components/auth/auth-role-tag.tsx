interface AuthRoleTagProps {
  children: React.ReactNode;
}

export function AuthRoleTag({ children }: AuthRoleTagProps) {
  return (
    <span className="inline-block rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-body)]">
      {children}
    </span>
  );
}
