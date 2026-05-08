"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Hash,
  Mail,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LegalBlockRenderer } from "./legal-block";
import { termsOfService } from "./content/terms-content";
import { privacyPolicy } from "./content/privacy-content";
import type { LegalDocument, LegalSection } from "./legal-types";

export type LegalVariant = "terms" | "privacy";

const LEGAL_DOCUMENTS: Record<LegalVariant, LegalDocument> = {
  terms: termsOfService,
  privacy: privacyPolicy,
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface LegalViewProps {
  variant: LegalVariant;
}

export function LegalView({ variant }: LegalViewProps) {
  const doc = LEGAL_DOCUMENTS[variant];
  const [activeId, setActiveId] = useState<string | null>(
    doc.sections[0]?.id ?? null,
  );
  const [tocOpen, setTocOpen] = useState(false);
  const tocScrollRef = useRef<HTMLDivElement | null>(null);

  const sectionIds = useMemo(
    () => doc.sections.map((s) => s.id),
    [doc.sections],
  );

  useEffect(() => {
    if (sectionIds.length === 0) return;
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
    sectionIds.forEach((id) => {
      const el = window.document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sectionIds]);

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
    const el = window.document.getElementById(id);
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

  return (
    <div className="bg-[var(--color-canvas)]">
      {/* Hero band */}
      <header className="border-b border-[var(--color-hairline-soft)] bg-gradient-to-b from-[var(--color-surface-soft)] to-[var(--color-canvas)]">
        <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-[760px]">
            <div className="mb-4 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-1">
              <ScrollText
                className="h-3.5 w-3.5 text-[var(--color-primary)]"
                aria-hidden
              />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {doc.hero.eyebrow}
              </span>
            </div>
            <h1 className="text-4xl font-normal tracking-tight text-[var(--color-ink)] sm:text-[52px] sm:leading-[1.05]">
              {doc.hero.title}
            </h1>
            <p className="mt-5 max-w-[640px] text-base leading-7 text-[var(--color-body)] sm:text-[17px] sm:leading-8">
              {doc.hero.lede}
            </p>

            {/* Metadata strip */}
            <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-hairline-soft)] pt-6 text-sm">
              <div className="flex items-baseline gap-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Effective
                </dt>
                <dd className="font-mono text-[13px] text-[var(--color-ink)]">
                  {doc.hero.effectiveDate}
                </dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Last updated
                </dt>
                <dd className="font-mono text-[13px] text-[var(--color-ink)]">
                  {doc.hero.lastUpdated}
                </dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Version
                </dt>
                <dd className="font-mono text-[13px] text-[var(--color-ink)]">
                  {doc.hero.version}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      {/* Summary "at a glance" panel */}
      {doc.summary.length > 0 && (
        <section className="border-b border-[var(--color-hairline-soft)] bg-[var(--color-canvas)]">
          <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-gradient-to-br from-[var(--color-canvas)] to-[var(--color-primary-soft)]/30 p-6 sm:p-8">
              <div className="mb-5 flex items-center gap-2">
                <Sparkles
                  className="h-4 w-4 text-[var(--color-primary)]"
                  aria-hidden
                />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  At a glance
                </span>
              </div>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                {doc.summary.map((item, idx) => (
                  <div
                    key={idx}
                    className="border-l-2 border-[var(--color-primary)] pl-4"
                  >
                    <dt className="text-sm font-semibold text-[var(--color-ink)]">
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-sm leading-6 text-[var(--color-body)]">
                      {item.body}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>
      )}

      {/* Body: TOC + sections */}
      <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        {/* Mobile TOC disclosure */}
        <details
          open={tocOpen}
          onToggle={(e) => setTocOpen((e.target as HTMLDetailsElement).open)}
          className="mb-8 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] lg:hidden"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--color-ink)] [&::-webkit-details-marker]:hidden">
            <span>Contents · {doc.sections.length} sections</span>
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
              sections={doc.sections}
              activeId={activeId}
              onPick={handleTocClick}
            />
          </div>
        </details>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_260px] lg:gap-16">
          {/* Sections */}
          <div className="min-w-0">
            <div className="space-y-14">
              {doc.sections.map((section) => (
                <SectionView key={section.id} section={section} />
              ))}
            </div>

            {/* Cross-link card */}
            <div className="mt-16">
              <Link
                href={doc.crossLink.href}
                className="group flex items-start gap-5 rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 transition hover:border-[var(--color-primary)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] sm:p-7"
              >
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)]">
                  <ScrollText
                    className="h-4 w-4 text-[var(--color-primary)]"
                    aria-hidden
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Continue reading
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[var(--color-ink)]">
                    {doc.crossLink.label}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-body)]">
                    {doc.crossLink.description}
                  </p>
                </div>
                <ArrowRight
                  className="mt-3 h-5 w-5 shrink-0 text-[var(--color-muted)] transition-all group-hover:translate-x-1 group-hover:text-[var(--color-primary)]"
                  aria-hidden
                />
              </Link>
            </div>

            {/* Contact card */}
            <ContactCard contact={doc.contact} />
          </div>

          {/* Sticky desktop TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-8 flex max-h-[calc(100vh-4rem)] flex-col">
              <div className="mb-3 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                On this page
              </div>
              <div
                ref={tocScrollRef}
                className="min-h-0 flex-1 overflow-y-auto pb-8 pr-2 pt-1 [scrollbar-color:var(--color-hairline)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--color-hairline)] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5"
              >
                <TocList
                  sections={doc.sections}
                  activeId={activeId}
                  onPick={handleTocClick}
                />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function SectionView({ section }: { section: LegalSection }) {
  const Icon = section.icon;
  return (
    <section
      id={section.id}
      className="scroll-mt-24 border-t border-[var(--color-hairline-soft)] pt-10 first:border-t-0 first:pt-0"
    >
      <div className="flex flex-wrap items-start gap-4">
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)]">
          <Icon className="h-4 w-4 text-[var(--color-primary)]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Section {section.number}
          </div>
          <h2 className="group flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-[28px] sm:leading-[1.15]">
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
                window.document.getElementById(section.id)?.scrollIntoView({
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
            <p className="mt-2 text-[15px] leading-7 text-[var(--color-body)]">
              {section.lede}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-4 sm:pl-14">
        {section.blocks.map((block, idx) => (
          <LegalBlockRenderer key={idx} block={block} />
        ))}
      </div>
    </section>
  );
}

function TocList({
  sections,
  activeId,
  onPick,
}: {
  sections: LegalSection[];
  activeId: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <nav>
      <ol className="space-y-0.5 text-sm">
        {sections.map((s) => {
          const active = activeId === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                data-toc-id={s.id}
                aria-current={active ? "location" : undefined}
                onClick={() => onPick(s.id)}
                className={cn(
                  "relative flex w-full items-baseline gap-2 rounded-[var(--radius-sm)] py-1.5 pl-3 pr-2 text-left transition",
                  "before:absolute before:inset-y-1 before:left-0 before:w-[2px] before:rounded-full before:transition-colors before:content-['']",
                  active
                    ? "font-medium text-[var(--color-ink)] before:bg-[var(--color-primary)]"
                    : "text-[var(--color-body)] before:bg-transparent hover:text-[var(--color-ink)]",
                )}
              >
                <span className="font-mono text-[11px] text-[var(--color-muted)]">
                  {s.number}
                </span>
                <span className="truncate">{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ContactCard({ contact }: { contact: LegalDocument["contact"] }) {
  return (
    <section
      id="contact"
      className="mt-8 scroll-mt-24 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-surface-dark)] p-6 sm:p-8"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-[440px]">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-dark-elevated)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-on-dark-soft)]">
            <Mail className="h-3 w-3" aria-hidden />
            Get in touch
          </div>
          <h3 className="text-xl font-semibold text-[var(--color-on-dark)]">
            {contact.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--color-on-dark-soft)]">
            {contact.body}
          </p>
          {contact.addressLines && contact.addressLines.length > 0 && (
            <address className="mt-4 not-italic text-xs leading-6 text-[var(--color-on-dark-soft)]">
              {contact.addressLines.map((line, idx) => (
                <span key={idx} className="block">
                  {line}
                </span>
              ))}
            </address>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <a
            href={`mailto:${contact.email}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
          >
            <Mail className="h-4 w-4" aria-hidden />
            {contact.email}
          </a>
          <span className="text-[11px] font-medium text-[var(--color-on-dark-soft)]">
            We respond within 5 business days.
          </span>
        </div>
      </div>
    </section>
  );
}
