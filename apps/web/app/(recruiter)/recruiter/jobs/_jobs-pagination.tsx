import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  meta: { page: number; limit: number; total: number; totalPages: number };
  searchParams: Record<string, string | undefined>;
}

export function JobsPagination({ meta, searchParams }: Props) {
  if (meta.totalPages <= 1) return null;

  const start = (meta.page - 1) * meta.limit + 1;
  const end = Math.min(meta.page * meta.limit, meta.total);

  function hrefFor(page: number): string {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v != null && v !== "" && k !== "page") params.set(k, v);
    });
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/recruiter/jobs${qs ? `?${qs}` : ""}`;
  }

  const pages = pageWindow(meta.page, meta.totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <div className="text-xs text-[var(--color-muted)]">
        Showing <span className="font-mono">{start}</span>-
        <span className="font-mono">{end}</span> of{" "}
        <span className="font-mono">{meta.total}</span>
      </div>
      <div className="flex items-center gap-1">
        <PageLink
          href={hrefFor(meta.page - 1)}
          disabled={meta.page === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </PageLink>

        {pages.map((w, i) =>
          w === "..." ? (
            <span
              key={`gap-${i}`}
              className="px-2 text-sm text-[var(--color-muted)]"
            >
              …
            </span>
          ) : (
            <PageLink key={w} href={hrefFor(w)} active={w === meta.page}>
              {w}
            </PageLink>
          ),
        )}

        <PageLink
          href={hrefFor(meta.page + 1)}
          disabled={meta.page === meta.totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  children,
  href,
  active,
  disabled,
  ...rest
}: {
  children: React.ReactNode;
  href: string;
  active?: boolean;
  disabled?: boolean;
} & React.HTMLAttributes<HTMLElement>) {
  const className = [
    "inline-flex h-9 min-w-9 items-center justify-center rounded-[var(--radius-md)] px-2 text-sm transition",
    active
      ? "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]"
      : "text-[var(--color-body)] hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]",
    disabled ? "pointer-events-none opacity-40" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (disabled)
    return (
      <span className={className} {...rest}>
        {children}
      </span>
    );
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}

function pageWindow(current: number, total: number): Array<number | "..."> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | "..."> = [1];
  if (current > 4) out.push("...");
  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);
  for (let i = start; i <= end; i++) out.push(i);
  if (current < total - 3) out.push("...");
  out.push(total);
  return out;
}
