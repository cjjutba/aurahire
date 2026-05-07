# Help Page "On this page" TOC — Bounded, Scrollable, Auto-Tracking

**Date:** 2026-05-07
**Owner:** UX polish, help/docs surfaces (candidate · recruiter · admin)
**Status:** approved (option A — bounded scrollable TOC with active auto-tracking)

## Problem

`apps/web/components/help/help-view.tsx` powers all three help pages (`/candidate/help`, `/recruiter/help`, `/admin/help`). The desktop right rail (`<aside>`, lines 270–286) renders an "On this page" TOC built from a flat `<TocList>` of every section across every group:

| Variant | Sections | Groups |
|---|---|---|
| Candidate | 18 | 6 |
| Recruiter | 17 | 6 |
| Admin | 18 | 6 |

The aside uses `sticky top-8` but is **not height-bounded**. Once the section list exceeds viewport height, the bottom of the TOC sits below the fold and the items there are unreachable until the user scrolls the *page*. On a 13" laptop (~720 px content height after browser chrome) the candidate TOC clips at "Tracking your applications" — the user cannot click "Notifications" or "Report a bias concern" without first scrolling the page far enough that the sticky aside re-anchors. That's the failure shown in the two screenshots.

Secondary issues:
1. **Active item can scroll out of TOC view.** Even with bounding, on long lists the active item drifts off-screen as page-scroll moves through later sections.
2. **Visual indicator is heavy.** The current active state is a full `bg-[var(--color-primary-soft)]` pill on the TOC item. Enterprise patterns (Vercel, Linear, Stripe, GitHub Docs) use a **2-px left rail bar** with text-color shift — quieter, scans faster on a long list.
3. **Cut-off content is unsignaled.** When the TOC scrolls internally, there's no visual hint that more items exist above/below.

## Goal

Replace the unbounded sticky aside with a height-bounded, internally-scrollable TOC that:
- always fits within the viewport, regardless of section count,
- keeps the active section's TOC item in view automatically as page-scroll progresses,
- hints at clipped content with edge fade masks,
- adopts a quieter active-state indicator that scans well on long lists,
- changes nothing else about the help page (content, search, mobile disclosure, FAQ, contact card all unaffected).

This is presentation-only — no content, route, schema, or backend change.

## Scope

**In scope:**
- Edit `apps/web/components/help/help-view.tsx`:
  - Convert the desktop `<aside>` into a height-bounded scroll container.
  - Add a `useEffect` that scrolls the active TOC item into the TOC viewport (`block: "nearest"`).
  - Restyle the `<TocList>` active state to a left-rail bar pattern.
  - Add top/bottom edge masks (CSS gradient fade) to the scroll container.
- Touch only the desktop branch (the `lg:block` aside). Mobile `<details>` disclosure is unchanged.
- No content edits to `candidate-content.ts` / `recruiter-content.ts` / `admin-content.ts`.
- No new dependencies.

**Out of scope:**
- Restructuring help content or collapsing groups.
- Mobile TOC layout changes.
- Search behavior, FAQ, contact card, hero, scroll-spy threshold logic.
- Cross-page navigation (the TOC remains within-page anchors only).
- Adding new design tokens — uses only existing `{colors.*}` and `{rounded.*}` from `DESIGN.md`.

## Design

### Layout

The desktop right column becomes a fixed-height bounded region:

```
┌─────────────────────────────┐  ← sticky top: 32 px (top-8)
│  ON THIS PAGE               │  ← static header, outside scroll area
├─────────────────────────────┤
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← top fade mask (12 px), visible only when scrolled
│  GETTING STARTED            │
│  │ How AuraHire works…      │  ← active: 2-px left bar in primary, ink text
│    Build your profile       │
│    Upload your resume       │
│                             │
│  APPLYING FOR JOBS          │
│    Browsing & searching     │
│    Applying for a job       │
│    Tracking your apps       │
│  ▼ scrollable region ▼      │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← bottom fade mask (12 px), visible when more below
└─────────────────────────────┘
```

The header ("ON THIS PAGE") sits **outside** the scroll area so it never scrolls with the list — same pattern as Vercel and Linear docs.

### Container math

```jsx
<aside className="hidden lg:block">
  <div className="sticky top-8 flex max-h-[calc(100vh-4rem)] flex-col">
    <div className="mb-3 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
      On this page
    </div>
    <div className="relative min-h-0 flex-1">
      {/* fade masks (top + bottom) */}
      <div ref={scrollRef} className="h-full overflow-y-auto pr-2 ...">
        <TocList ... />
      </div>
    </div>
  </div>
</aside>
```

- `max-h-[calc(100vh-4rem)]` — viewport minus 32 px sticky offset minus 32 px breathing room.
- `flex flex-col` with the header `shrink-0` and the scroll wrapper `flex-1 min-h-0` keeps the header pinned and lets only the list scroll.
- `pr-2` on the scroll wrapper reserves space for the scrollbar so list items don't shift width when the scrollbar appears (Vercel pattern).

### Auto-track active item

A new `useEffect` watches `activeId` and the TOC `scrollRef`:

```ts
useEffect(() => {
  if (!activeId || !tocScrollRef.current) return;
  const btn = tocScrollRef.current.querySelector<HTMLButtonElement>(
    `[data-toc-id="${activeId}"]`
  );
  btn?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}, [activeId]);
```

Each TOC `<button>` carries `data-toc-id={s.id}` so the lookup is stable. `block: "nearest"` is the canonical choice — it only scrolls if the item is outside the visible region, so it doesn't fight the user when they scroll the TOC manually (Stripe pattern).

`behavior: "smooth"` keeps it calm. Active state is driven by the existing scroll-spy `IntersectionObserver` (lines 89–110) — that logic doesn't change.

### Active-state indicator (TOC item)

Current:
```css
bg-[var(--color-primary-soft)] font-medium text-[var(--color-primary)]
```

New:
```jsx
<button
  className={cn(
    "relative block w-full truncate rounded-[var(--radius-sm)] py-1.5 pl-3 pr-2 text-left transition",
    active
      ? "font-medium text-[var(--color-ink)] before:absolute before:inset-y-1 before:left-0 before:w-[2px] before:rounded-full before:bg-[var(--color-primary)]"
      : "text-[var(--color-body)] hover:text-[var(--color-ink)]"
  )}
>
```

Rationale:
- 2-px primary rail is quieter and scans faster than the filled pill — matches Vercel, Linear, Stripe, GitHub Docs.
- Inactive items lose the hover background fill (`hover:bg-surface-strong`) — on a long list of 17–18 items, fills create visual noise. Hover becomes text-color shift only.
- Group labels (`{group.label}`, e.g., "GETTING STARTED") keep their existing caption-strong style, unchanged.
- Indent goes from `px-2` to `pl-3 pr-2` so the 2-px rail has room to breathe without overlapping the text.

### Edge fade masks

Two absolutely-positioned 12-px gradient overlays in the scroll wrapper:

```jsx
<div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-[var(--color-canvas)] to-transparent" />
<div className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-[var(--color-canvas)] to-transparent" />
```

Both are always rendered. They effectively fade the first/last few pixels of any clipped content. We do not toggle them based on scroll position — keeping them permanent matches Vercel/Linear and avoids a scroll-listener for a marginal effect. `pointer-events-none` so they don't block clicks on the top/bottom items.

### TOC dimension and rhythm

Item height stays `py-1.5` (28 px effective). 18 items at 28 px = 504 px, plus group labels (~24 px × 6 = 144 px) and group spacing (`space-y-5` = 20 px × 5 = 100 px) ≈ **750 px**. On a 720-px content viewport the list overflows by ~30 px → bounded scroll engages. On a 1080-px viewport it fits without scroll. Both are correct.

The aside column width stays 240 px (line 218 grid template untouched).

## Behavior summary

| State | Visual |
|---|---|
| TOC fits in viewport | No internal scroll. Identical to current rendering minus the active-pill fill (now left-rail bar). |
| TOC exceeds viewport | Internal scroll engaged. Top + bottom fade masks visible. Header pinned. |
| User scrolls page | Scroll-spy updates `activeId`. Effect scrolls active TOC item into view (`block: "nearest"`, smooth). |
| User scrolls TOC manually | No fight — `block: "nearest"` is a no-op when target is already visible. |
| User clicks TOC item | Existing `handleTocClick` (lines 112–121) runs unchanged: smooth-scroll to section + history.replaceState. |
| Mobile (< 1024 px) | `<details>` disclosure unchanged. The scrollable bounded pattern is desktop-only. |
| Search filters list | TOC re-renders against `filtered.groups` (existing). Bounded scroll still applies; auto-track fires on next active change. |

## Accessibility

- Buttons keep their existing semantics (`<button type="button">`) — no role changes.
- Scroll container is `tabindex` defaulted (not focusable itself), but every nested button is keyboard-reachable.
- `aria-current="location"` added to the active TOC button for screen readers (currently absent — minor a11y win folded in here).
- Edge fades use `pointer-events-none` and are decorative — no aria treatment needed.
- Reduced-motion: browser support for `prefers-reduced-motion` on programmatic `scrollIntoView` is inconsistent (Safari respects it; Chrome/Firefox often do not). Implementation guards via `window.matchMedia("(prefers-reduced-motion: reduce)").matches` and falls back to `behavior: "auto"` (instant) when reduce is set. Same guard applied to `handleTocClick`'s smooth scroll for consistency.

## Files touched

| File | Change |
|---|---|
| `apps/web/components/help/help-view.tsx` | Bounded sticky aside, auto-track effect, restyled `<TocList>` active state, edge fade masks, `aria-current` on active item, `data-toc-id` attribute on buttons. |

No other file touched. The mobile `<details>` block at lines 192–215 keeps using the same `<TocList>` and inherits the new active-state styling automatically — that's correct (a quieter active indicator works on mobile too).

## Risk

Low. Single component edit, no API surface change, no content change, fully backward-compatible with existing scroll-spy. Worst case: revert this commit and the help pages render as before.

## Verification

After implementing:

1. `pnpm --filter web tsc --noEmit` clean.
2. `pnpm --filter web lint` clean.
3. Human-driven browser checks (Claude does not run dev server):
   - On 13" laptop viewport (~1366×768), candidate help page: TOC bounded, internal scroll engaged, active item auto-tracks as user scrolls page.
   - On 27" desktop (~2560×1440), recruiter help page: TOC fits without internal scroll, no fade masks visually intrude.
   - Click a TOC item below the fold: page scrolls smoothly, TOC updates active rail.
   - Type "bias" in search: TOC list filters, bounded behavior still correct.
   - Resize from 1440 → 1024 → mobile: desktop bounded → mobile `<details>` disclosure transition is clean.
   - Same three checks for admin help page.
   - Screen reader (VoiceOver): active item announces "current location".
