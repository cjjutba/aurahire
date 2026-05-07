"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Hash,
  Mail,
  MessageCircleQuestionMark,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpBlockRenderer } from "./help-block";
import { adminHelp } from "./content/admin-content";
import { candidateHelp } from "./content/candidate-content";
import { recruiterHelp } from "./content/recruiter-content";
import type { HelpFaqItem, HelpPageContent, HelpSection } from "./help-types";

export type HelpVariant = "recruiter" | "candidate" | "admin";

const HELP_CONTENT: Record<HelpVariant, HelpPageContent> = {
  recruiter: recruiterHelp,
  candidate: candidateHelp,
  admin: adminHelp,
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface HelpViewProps {
  variant: HelpVariant;
}

export function HelpView({ variant }: HelpViewProps) {
  const content = HELP_CONTENT[variant];
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(
    content.groups[0]?.sections[0]?.id ?? null,
  );
  const [tocOpen, setTocOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const tocScrollRef = useRef<HTMLDivElement | null>(null);

  // Cmd/Ctrl+K focuses search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Filter sections + groups by query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { groups: content.groups, faq: content.faq };

    const filterSection = (s: HelpSection): boolean => {
      if (s.title.toLowerCase().includes(q)) return true;
      if (s.lede?.toLowerCase().includes(q)) return true;
      if (s.kicker?.toLowerCase().includes(q)) return true;
      return s.blocks.some((b) => blockMatches(b, q));
    };

    const groups = content.groups
      .map((g) => ({ ...g, sections: g.sections.filter(filterSection) }))
      .filter((g) => g.sections.length > 0);

    const faq = content.faq.filter(
      (f: HelpFaqItem) =>
        f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q),
    );

    return { groups, faq };
  }, [query, content]);

  const allSectionIds = useMemo(
    () => filtered.groups.flatMap((g) => g.sections.map((s) => s.id)),
    [filtered],
  );

  // Scroll spy for active TOC item
  useEffect(() => {
    if (allSectionIds.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              (a.target.getBoundingClientRect().top ?? 0) -
              (b.target.getBoundingClientRect().top ?? 0),
          );
        const first = visible[0];
        if (first?.target.id) setActiveId(first.target.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: [0, 0.5, 1] },
    );
    allSectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [allSectionIds]);

  // Keep the active TOC item visible inside the bounded scroll container.
  // `block: "nearest"` is a no-op when the target is already on-screen,
  // so this never fights manual TOC scrolling.
  useEffect(() => {
    if (!activeId) return;
    const container = tocScrollRef.current;
    if (!container) return;
    const btn = container.querySelector<HTMLButtonElement>(
      `[data-toc-id="${activeId}"]`,
    );
    if (!btn) return;
    btn.scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [activeId]);

  function handleTocClick(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    setActiveId(id);
    setTocOpen(false);
    el.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
    if (typeof history !== "undefined") {
      history.replaceState(null, "", `#${id}`);
    }
  }

  const noResults =
    query.trim().length > 0 &&
    filtered.groups.length === 0 &&
    filtered.faq.length === 0;

  return (
    <div className="mx-auto max-w-[1080px]">
      {/* Hero */}
      <header className="mb-10">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles
            className="h-3.5 w-3.5 text-[var(--color-primary)]"
            aria-hidden
          />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {content.hero.eyebrow}
          </span>
        </div>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)] sm:text-[40px] sm:leading-[1.1]">
          {content.hero.title}
        </h1>
        <p className="mt-3 max-w-[640px] text-[15px] leading-7 text-[var(--color-body)]">
          {content.hero.lede}
        </p>

        {/* Search */}
        <div className="relative mt-6 max-w-[560px]">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]"
            aria-hidden
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help — try 'scoring', 'bias', 'interview'…"
            aria-label="Search help"
            className="h-11 w-full rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] pl-11 pr-24 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 inline-flex h-7 -translate-y-1/2 items-center gap-1 rounded-[var(--radius-pill)] px-2 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Clear
            </button>
          ) : (
            <span
              className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 sm:inline-flex"
              aria-hidden
            >
              <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-[var(--radius-xs)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-1.5 font-mono text-[11px] font-semibold text-[var(--color-muted)]">
                ⌘
              </kbd>
              <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-[var(--radius-xs)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-1.5 font-mono text-[11px] font-semibold text-[var(--color-muted)]">
                K
              </kbd>
            </span>
          )}
        </div>
      </header>

      {/* Mobile TOC disclosure */}
      <details
        open={tocOpen}
        onToggle={(e) => setTocOpen((e.target as HTMLDetailsElement).open)}
        className="mb-6 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] lg:hidden"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--color-ink)] [&::-webkit-details-marker]:hidden">
          <span>On this page</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-[var(--color-muted)] transition-transform",
              tocOpen && "rotate-180",
            )}
            aria-hidden
          />
        </summary>
        <div className="border-t border-[var(--color-hairline-soft)] p-3">
          <TocList
            groups={filtered.groups}
            activeId={activeId}
            onPick={handleTocClick}
          />
        </div>
      </details>

      {/* Content + sticky TOC */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_240px]">
        {/* Sections */}
        <div className="min-w-0">
          {noResults ? (
            <NoResults query={query} onClear={() => setQuery("")} />
          ) : (
            <div className="space-y-12">
              {filtered.groups.map((group) => (
                <div key={group.label} className="space-y-8">
                  <div className="flex items-center gap-2">
                    <span className="h-px w-6 bg-[var(--color-hairline)]" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      {group.label}
                    </span>
                  </div>
                  {group.sections.map((section) => (
                    <SectionView key={section.id} section={section} />
                  ))}
                </div>
              ))}

              {/* FAQ */}
              {filtered.faq.length > 0 && (
                <div id="faq" className="scroll-mt-24 space-y-6">
                  <div className="flex items-center gap-2">
                    <MessageCircleQuestionMark
                      className="h-4 w-4 text-[var(--color-muted)]"
                      aria-hidden
                    />
                    <h2 className="text-xl font-semibold text-[var(--color-ink)]">
                      Frequently asked
                    </h2>
                  </div>
                  <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
                    {filtered.faq.map((item, idx) => (
                      <FaqRow
                        key={idx}
                        item={item}
                        isLast={idx === filtered.faq.length - 1}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Contact */}
              <ContactCard contact={content.contact} />
            </div>
          )}
        </div>

        {/* Desktop sticky TOC */}
        <aside className="hidden lg:block">
          <div className="sticky top-8 flex max-h-[calc(100vh-4rem)] flex-col">
            <div className="mb-3 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              On this page
            </div>
            <div className="relative min-h-0 flex-1">
              {/* top edge fade — hides clipped content above the fold */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-3 bg-gradient-to-b from-[var(--color-canvas)] to-transparent"
                aria-hidden
              />
              {/* scroll surface */}
              <div
                ref={tocScrollRef}
                className="h-full overflow-y-auto pb-3 pr-2 pt-1 [scrollbar-width:thin]"
              >
                <TocList
                  groups={filtered.groups}
                  activeId={activeId}
                  onPick={handleTocClick}
                  extra={
                    filtered.faq.length > 0
                      ? [{ id: "faq", title: "Frequently asked" }]
                      : []
                  }
                />
              </div>
              {/* bottom edge fade — hides clipped content below the fold */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-3 bg-gradient-to-t from-[var(--color-canvas)] to-transparent"
                aria-hidden
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SectionView({ section }: { section: HelpSection }) {
  const Icon = section.icon;
  return (
    <section
      id={section.id}
      className="scroll-mt-24 space-y-5 border-t border-[var(--color-hairline-soft)] pt-8 first:border-t-0 first:pt-0"
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)]">
          <Icon className="h-4 w-4 text-[var(--color-primary)]" />
        </span>
        <div className="min-w-0 flex-1">
          {section.kicker && (
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              {section.kicker}
            </div>
          )}
          <h2 className="group flex items-center gap-2 text-xl font-semibold tracking-tight text-[var(--color-ink)]">
            {section.title}
            <a
              href={`#${section.id}`}
              aria-label={`Permalink to ${section.title}`}
              onClick={(e) => {
                e.preventDefault();
                const url = new URL(window.location.href);
                url.hash = section.id;
                navigator.clipboard
                  ?.writeText(url.toString())
                  .catch(() => undefined);
                document.getElementById(section.id)?.scrollIntoView({
                  behavior: prefersReducedMotion() ? "auto" : "smooth",
                  block: "start",
                });
                if (typeof history !== "undefined") {
                  history.replaceState(null, "", `#${section.id}`);
                }
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-xs)] text-[var(--color-muted-soft)] opacity-0 transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-primary)] focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Hash className="h-3.5 w-3.5" aria-hidden />
            </a>
          </h2>
          {section.lede && (
            <p className="mt-1 text-[15px] leading-7 text-[var(--color-body)]">
              {section.lede}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 sm:pl-12">
        {section.blocks.map((block, idx) => (
          <HelpBlockRenderer key={idx} block={block} />
        ))}
      </div>
    </section>
  );
}

function TocList({
  groups,
  activeId,
  onPick,
  extra,
}: {
  groups: HelpPageContent["groups"];
  activeId: string | null;
  onPick: (id: string) => void;
  extra?: { id: string; title: string }[];
}) {
  return (
    <nav className="space-y-5 text-sm">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {group.label}
          </div>
          <ul className="space-y-0.5">
            {group.sections.map((s) => {
              const active = activeId === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    data-toc-id={s.id}
                    aria-current={active ? "location" : undefined}
                    onClick={() => onPick(s.id)}
                    className={cn(
                      "relative block w-full truncate rounded-[var(--radius-sm)] py-1.5 pl-3 pr-2 text-left transition",
                      "before:absolute before:inset-y-1 before:left-0 before:w-[2px] before:rounded-full before:transition-colors before:content-['']",
                      active
                        ? "font-medium text-[var(--color-ink)] before:bg-[var(--color-primary)]"
                        : "text-[var(--color-body)] before:bg-transparent hover:text-[var(--color-ink)]",
                    )}
                  >
                    {s.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {extra && extra.length > 0 && (
        <div className="border-t border-[var(--color-hairline-soft)] pt-4">
          <ul className="space-y-0.5">
            {extra.map((item) => {
              const active = activeId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    data-toc-id={item.id}
                    aria-current={active ? "location" : undefined}
                    onClick={() => onPick(item.id)}
                    className={cn(
                      "relative block w-full truncate rounded-[var(--radius-sm)] py-1.5 pl-3 pr-2 text-left transition",
                      "before:absolute before:inset-y-1 before:left-0 before:w-[2px] before:rounded-full before:transition-colors before:content-['']",
                      active
                        ? "font-medium text-[var(--color-ink)] before:bg-[var(--color-primary)]"
                        : "text-[var(--color-body)] before:bg-transparent hover:text-[var(--color-ink)]",
                    )}
                  >
                    {item.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );
}

function FaqRow({ item, isLast }: { item: HelpFaqItem; isLast: boolean }) {
  return (
    <details
      className={cn(
        "group",
        !isLast && "border-b border-[var(--color-hairline-soft)]",
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-surface-soft)] [&::-webkit-details-marker]:hidden">
        <span>{item.q}</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-[var(--color-hairline-soft)] bg-[var(--color-surface-soft)] px-5 py-4 text-sm leading-6 text-[var(--color-body)]">
        {item.a}
      </div>
    </details>
  );
}

function ContactCard({ contact }: { contact: HelpPageContent["contact"] }) {
  return (
    <section
      id="contact"
      className="scroll-mt-24 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-gradient-to-br from-[var(--color-canvas)] to-[var(--color-primary-soft)]/30 p-6 sm:p-8"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-[420px]">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            <Mail className="h-3 w-3" aria-hidden />
            Contact
          </div>
          <h3 className="text-lg font-semibold text-[var(--color-ink)]">
            {contact.title}
          </h3>
          <p className="mt-1 text-sm leading-6 text-[var(--color-body)]">
            {contact.body}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <a
            href={`mailto:${contact.email}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
          >
            <Mail className="h-4 w-4" aria-hidden />
            {contact.email}
          </a>
          {contact.secondaryLink && (
            <a
              href={contact.secondaryLink.href}
              className="text-xs font-medium text-[var(--color-primary)] hover:underline"
            >
              {contact.secondaryLink.label} →
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-6 py-16 text-center">
      <Search
        className="mx-auto h-8 w-8 text-[var(--color-muted-soft)]"
        aria-hidden
      />
      <h3 className="mt-4 text-base font-semibold text-[var(--color-ink)]">
        No results for &ldquo;{query}&rdquo;
      </h3>
      <p className="mt-1 text-sm text-[var(--color-body)]">
        Try a different keyword, or browse all topics by clearing your search.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-strong)]"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
        Clear search
      </button>
    </div>
  );
}

function blockMatches(
  block: HelpPageContent["groups"][number]["sections"][number]["blocks"][number],
  q: string,
): boolean {
  switch (block.kind) {
    case "paragraph":
      return block.text.toLowerCase().includes(q);
    case "list":
      return block.items.some((i) => i.toLowerCase().includes(q));
    case "steps":
      return block.items.some(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q),
      );
    case "fields":
      return block.entries.some(
        (e) =>
          e.label.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q),
      );
    case "definitions":
      return block.entries.some(
        (e) =>
          e.term.toLowerCase().includes(q) ||
          e.definition.toLowerCase().includes(q),
      );
    case "callout":
      return (
        block.title.toLowerCase().includes(q) ||
        block.body.toLowerCase().includes(q)
      );
    case "quote":
      return (
        block.text.toLowerCase().includes(q) ||
        (block.cite?.toLowerCase().includes(q) ?? false)
      );
    case "kbd":
      return block.entries.some((e) =>
        e.description.toLowerCase().includes(q),
      );
    case "matrix":
      return (
        block.head.some((h) => h.toLowerCase().includes(q)) ||
        block.rows.some((r) => r.some((c) => c.toLowerCase().includes(q)))
      );
  }
}
