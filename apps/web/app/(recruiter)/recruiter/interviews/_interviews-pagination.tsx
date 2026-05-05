import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface InterviewsPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  queryString: string; // serialized params WITHOUT "page="
}

function buildHref(queryString: string, page: number): string {
  const params = new URLSearchParams(queryString);
  params.set("page", String(page));
  return `/recruiter/interviews?${params.toString()}`;
}

function pageWindow(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

export function InterviewsPagination({
  page,
  totalPages,
  total,
  limit,
  queryString,
}: InterviewsPaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const window = pageWindow(page, totalPages);

  const baseCell =
    "inline-flex h-9 min-w-[36px] items-center justify-center rounded-[var(--radius-sm)] px-2 text-sm font-medium transition";
  const activeCell = `${baseCell} bg-[var(--color-primary)] text-[var(--color-on-primary)]`;
  const inactiveCell = `${baseCell} text-[var(--color-body)] hover:bg-[var(--color-surface-soft)]`;
  const disabledCell = `${baseCell} cursor-not-allowed text-[var(--color-muted-soft)]`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
      <p className="text-sm text-[var(--color-muted)]">
        Showing {from}–{to} of {total}
      </p>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        {page > 1 ? (
          <Link href={buildHref(queryString, page - 1)} className={inactiveCell}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span className={disabledCell}>
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}

        {window.map((w, i) =>
          w === "..." ? (
            <span key={`ellipsis-${i}`} className={`${baseCell} text-[var(--color-muted)]`}>
              …
            </span>
          ) : w === page ? (
            <span key={w} className={activeCell} aria-current="page">
              {w}
            </span>
          ) : (
            <Link key={w} href={buildHref(queryString, w as number)} className={inactiveCell}>
              {w}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link href={buildHref(queryString, page + 1)} className={inactiveCell}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className={disabledCell}>
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </nav>
    </div>
  );
}
