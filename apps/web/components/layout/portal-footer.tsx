export function PortalFooter() {
  return (
    <footer className="flex h-14 items-center justify-between border-t border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-6 text-xs text-[var(--color-muted)]">
      <span>© {new Date().getFullYear()} AuraHire</span>
      <span>v0.1.0</span>
    </footer>
  );
}
