# Help Page TOC - Bounded Scrollable + Auto-Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the unbounded "On this page" right-rail TOC on `/candidate/help`, `/recruiter/help`, `/admin/help` so that long lists become internally scrollable, the active item auto-tracks with page scroll, and the visual signature matches enterprise docs (Vercel/Linear/Stripe).

**Architecture:** Single-file change to `apps/web/components/help/help-view.tsx`. Convert the desktop sticky aside from a free-flowing block into a flex-column with a height cap of `calc(100vh - 4rem)`; the inner list becomes `overflow-y-auto`. Add a small `prefersReducedMotion()` helper, a `useEffect` that calls `scrollIntoView({ block: "nearest" })` on the active TOC button when `activeId` changes, edge fade masks at top/bottom of the scroll wrapper, and a 2-px primary left-rail bar as the active-state indicator (replacing the current filled-pill background). Mobile `<details>` disclosure is unchanged but inherits the new active-state style.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 + brand CSS variables (`var(--color-*)`, `var(--radius-*)`), `lucide-react`, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-07-help-toc-scrollable-design.md` is authoritative for behavior, tokens, and out-of-scope decisions. When in doubt, defer to that spec.

---

## File Structure

### Modified file

- `apps/web/components/help/help-view.tsx` - the only file touched.

### Untouched (intentionally)

- `apps/web/components/help/help-block.tsx`
- `apps/web/components/help/content/{candidate,recruiter,admin}-content.ts`
- `apps/web/app/(candidate)/candidate/help/page.tsx`
- `apps/web/app/(recruiter)/recruiter/help/page.tsx`
- `apps/web/app/(admin)/admin/help/page.tsx`
- The mobile `<details>` block (lines 192-215). It re-uses `<TocList>`, so it inherits the new active-state styling automatically - that's correct per spec.

### No new files

The `prefersReducedMotion()` helper is local to `help-view.tsx` (single consumer; YAGNI). No new hook in `apps/web/hooks/`, no new util in `apps/web/lib/`.

---

## Conventions used in every step

- **Brand tokens only:** `var(--color-primary)`, `var(--color-ink)`, `var(--color-body)`, `var(--color-canvas)`, `var(--color-muted)`, `var(--color-hairline)`, `var(--color-hairline-soft)`, `var(--color-surface-strong)`, `var(--color-primary-soft)`. No raw hex.
- **Radius tokens:** `var(--radius-sm)` (8 px) for TOC items, `var(--radius-md)` (12 px) for mobile disclosure, `var(--radius-pill)` for buttons. Already in use - no change.
- **`cn` utility:** continue using `cn(...)` from `@/lib/utils` for conditional classnames.
- **No new imports:** all needed icons (`ChevronDown`, `Hash`, `Mail`, etc.) already imported. The implementation doesn't need anything new from `lucide-react`.
- **Strict TS:** no `any`, no `as` casts beyond what already exists.

---

## Task 1: Add the `prefersReducedMotion()` helper

**Files:**

- Modify: `apps/web/components/help/help-view.tsx`

**What:** A tiny safe-on-server helper used by both `handleTocClick` and the new auto-track effect. It returns `true` only when the user has explicitly opted into reduced motion, so smooth scrolling falls back to instant.

- [ ] **Step 1: Add the helper above the `HelpView` component**

Place this immediately under the `HELP_CONTENT` constant (around line 26), above `interface HelpViewProps`:

```ts
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
```

Rationale: simple read, no React state needed (callers invoke it at the moment of an action - click or scroll-spy update - so they always get the current preference). Server-safe via the `typeof window` guard.

- [ ] **Step 2: Type-check the file**

Run from repo root:

```bash
pnpm --filter web type-check
```

Expected: PASS (no errors). The helper is unused at this point but valid.

---

## Task 2: Add `data-toc-id` and `aria-current` to TOC buttons; restyle active state

**Files:**

- Modify: `apps/web/components/help/help-view.tsx` - the `TocList` component (currently lines 351-419), specifically both `<button>` blocks (the per-group buttons and the `extra` buttons).

**What:** Replace the filled-pill active treatment with a 2-px left-rail bar in primary blue + ink text. Drop the hover-background fill on inactive items (hover becomes text-color shift only). Add `data-toc-id` so the auto-track effect can find the active button, and `aria-current="location"` for screen readers.

- [ ] **Step 1: Replace the per-group `<button>` markup**

Find this block (around lines 372-386):

```tsx
<li key={s.id}>
  <button
    type="button"
    onClick={() => onPick(s.id)}
    className={cn(
      "block w-full truncate rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition",
      active
        ? "bg-[var(--color-primary-soft)] font-medium text-[var(--color-primary)]"
        : "text-[var(--color-body)] hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]",
    )}
  >
    {s.title}
  </button>
</li>
```

Replace with:

```tsx
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
```

Notes:

- `pl-3 pr-2` replaces `px-2` to give the 2-px rail breathing room without overlapping text.
- `before:` pseudo-element renders the rail. Always present in DOM; color is transparent when inactive so it doesn't shift layout on activation.
- `inset-y-1` keeps the rail visually shorter than the full button height (1 px gap above/below) - matches Vercel/Linear.
- Hover for inactive items: text shifts from `body` to `ink`, no background fill.

- [ ] **Step 2: Replace the `extra` `<button>` markup with the same shape**

Find the `extra` buttons block (around lines 397-410):

```tsx
<li key={item.id}>
  <button
    type="button"
    onClick={() => onPick(item.id)}
    className={cn(
      "block w-full truncate rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition",
      active
        ? "bg-[var(--color-primary-soft)] font-medium text-[var(--color-primary)]"
        : "text-[var(--color-body)] hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]",
    )}
  >
    {item.title}
  </button>
</li>
```

Replace with:

```tsx
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
```

(Identical to the per-group button shape so both lookups by `data-toc-id` work the same way. The "Frequently asked" extra item uses `id="faq"`.)

- [ ] **Step 3: Type-check**

Run:

```bash
pnpm --filter web type-check
```

Expected: PASS. (`aria-current` accepts `"location"` per ARIA; the `undefined` branch when inactive silences the attribute.)

---

## Task 3: Restructure the desktop aside - bounded scroll wrapper + edge fade masks

**Files:**

- Modify: `apps/web/components/help/help-view.tsx` - the desktop aside (currently lines 269-286).

**What:** Convert the sticky block into a flex column. The header ("On this page") sits outside the scroll area with `shrink-0`. The list sits inside a `relative` wrapper that contains a `ref`-attached scrollable inner div plus two `pointer-events-none` gradient masks at the top and bottom edges.

- [ ] **Step 1: Add the scroll-container ref to component state**

In the `HelpView` function body, immediately after the `searchRef` declaration (around line 39):

```tsx
const searchRef = useRef<HTMLInputElement | null>(null);
```

Add directly below:

```tsx
const tocScrollRef = useRef<HTMLDivElement | null>(null);
```

- [ ] **Step 2: Replace the desktop aside markup**

Find this block (lines 269-286):

```tsx
{
  /* Desktop sticky TOC */
}
<aside className="hidden lg:block">
  <div className="sticky top-8">
    <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
      On this page
    </div>
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
</aside>;
```

Replace with:

```tsx
{
  /* Desktop sticky TOC */
}
<aside className="hidden lg:block">
  <div className="sticky top-8 flex max-h-[calc(100vh-4rem)] flex-col">
    <div className="mb-3 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
      On this page
    </div>
    <div className="relative min-h-0 flex-1">
      {/* top edge fade - hides clipped content above the fold */}
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
      {/* bottom edge fade - hides clipped content below the fold */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-3 bg-gradient-to-t from-[var(--color-canvas)] to-transparent"
        aria-hidden
      />
    </div>
  </div>
</aside>;
```

Notes:

- `max-h-[calc(100vh-4rem)]`: viewport minus 32 px sticky offset minus 32 px breathing room.
- `flex flex-col` + `shrink-0` on header + `flex-1 min-h-0` on the scroll wrapper is the canonical "fixed header, scrolling body" pattern. `min-h-0` is required - without it, the flex child refuses to shrink below content height and overflow never engages.
- `pr-2` reserves space for the scrollbar so list-item widths don't shift when scrolling becomes active.
- `pt-1 pb-3` keeps the active-rail's `inset-y-1` from being clipped by the fade overlays at the top.
- `[scrollbar-width:thin]` is a Tailwind v4 arbitrary property - narrows the Firefox scrollbar (matches Vercel).
- `z-10` on the masks ensures they paint above the scroll content (otherwise the overlay is below and invisible).

- [ ] **Step 3: Type-check**

Run:

```bash
pnpm --filter web type-check
```

Expected: PASS. The new `tocScrollRef` is unused at this point - TypeScript won't complain because `useRef<HTMLDivElement | null>(null)` has a defined type and the `ref={...}` assignment satisfies it.

---

## Task 4: Wire the auto-track effect

**Files:**

- Modify: `apps/web/components/help/help-view.tsx` - add a new `useEffect` after the existing scroll-spy effect.

**What:** When `activeId` changes (driven by the existing `IntersectionObserver`), find the matching button via `data-toc-id` inside `tocScrollRef` and call `scrollIntoView({ block: "nearest" })`. `block: "nearest"` only scrolls when the target is outside the visible region - it's a no-op when the active item is already in view, which prevents fighting with manual TOC scrolling.

- [ ] **Step 1: Insert the effect after the existing IntersectionObserver effect**

Locate the existing scroll-spy effect (lines 89-110) - it ends with `}, [allSectionIds]);`.

Immediately after that closing line, add:

```tsx
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
```

Notes:

- The query lives inside `tocScrollRef.current` (not `document`), so it scopes the lookup to the desktop aside. The mobile `<details>` rendering of `<TocList>` also has `data-toc-id` buttons but lives outside this ref - they're correctly ignored.
- `behavior: "auto"` under reduced-motion preference jumps instantly. No animation, no nausea trigger.
- `useCallback` not needed - the effect runs on `activeId` change only.

- [ ] **Step 2: Type-check**

Run:

```bash
pnpm --filter web type-check
```

Expected: PASS.

- [ ] **Step 3: Lint**

Run:

```bash
pnpm --filter web lint
```

Expected: PASS. (No new ESLint warnings - the effect's dependency array is correct and exhaustive.)

---

## Task 5: Honor reduced-motion in `handleTocClick`

**Files:**

- Modify: `apps/web/components/help/help-view.tsx` - `handleTocClick` (currently lines 112-121).

**What:** Mirror the new helper into the existing click handler so click-driven scrolls also respect the user's preference. Same applied to the in-section permalink scroll (`SectionView`, lines 314-328) for consistency.

- [ ] **Step 1: Update `handleTocClick`**

Find:

```tsx
function handleTocClick(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  setActiveId(id);
  setTocOpen(false);
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  if (typeof history !== "undefined") {
    history.replaceState(null, "", `#${id}`);
  }
}
```

Replace with:

```tsx
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
```

- [ ] **Step 2: Update the permalink scroll inside `SectionView`**

Find this fragment inside `SectionView`'s `<a>` `onClick` (around lines 320-324):

```tsx
document.getElementById(section.id)?.scrollIntoView({
  behavior: "smooth",
  block: "start",
});
```

Replace with:

```tsx
document.getElementById(section.id)?.scrollIntoView({
  behavior: prefersReducedMotion() ? "auto" : "smooth",
  block: "start",
});
```

(Optional but consistent - the permalink hash button on each section heading should obey the same preference.)

- [ ] **Step 3: Type-check + lint**

Run:

```bash
pnpm --filter web type-check && pnpm --filter web lint
```

Expected: both PASS.

---

## Task 6: Whole-app type-check + lint gate

**Files:** none modified.

**What:** Verify the change ripples cleanly across the workspace (catches anything Next.js's incremental build might have missed in per-package runs).

- [ ] **Step 1: Workspace-level type-check**

Run from repo root:

```bash
pnpm --filter web type-check
```

Expected: PASS.

- [ ] **Step 2: Workspace-level lint**

Run from repo root:

```bash
pnpm --filter web lint
```

Expected: PASS, zero new warnings or errors attributable to `help-view.tsx`.

- [ ] **Step 3: Optional - production build sanity check (no dev server)**

This is allowed by CLAUDE.md (`turbo run build` is explicitly permitted).

Run:

```bash
pnpm --filter web build
```

Expected: PASS. Build size for the help routes should be effectively unchanged (±1-2 KB at most - all changes are markup/classnames; no new imports).

If build fails for an unrelated reason (e.g., env vars), document it but do not block this task - the lint + type-check gates are authoritative for this scoped change.

---

## Task 7: Browser verification (human-driven)

**Files:** none modified.

**What:** Claude does NOT run the dev server (per CLAUDE.md hard rule 1). The implementing engineer must hand this checklist to the human, who runs `pnpm dev` and verifies in a real browser. List every check; do not approximate.

- [ ] **Step 1: Hand off the checklist**

Ask the human to run:

```bash
pnpm dev
```

Then in a browser, navigate through these checks:

| #   | Check                                                                     | Expected                                                                                                                                                  |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/candidate/help` at viewport ~1366×768 (13" laptop)                      | Right-rail TOC is bounded - visible scrollbar inside the aside; "Notifications" and "Report a bias concern" reachable by scrolling the TOC, not the page. |
| 2   | Same page - scroll the page from top to bottom                            | Active TOC item updates per scroll-spy AND auto-scrolls into the TOC viewport so it's always visible.                                                     |
| 3   | Same page - viewport ≥ 1440 px tall                                       | TOC fits without internal scroll; fade masks present but visually negligible against full content.                                                        |
| 4   | Click a TOC item below the fold (e.g., "How to improve your match score") | Page scrolls smoothly to section; TOC active rail moves to that item; URL hash updates.                                                                   |
| 5   | Type "bias" in the search box                                             | TOC list filters; bounded behavior intact; auto-track still works on the filtered list.                                                                   |
| 6   | Resize from 1440 → 1024 → 768 (mobile breakpoint)                         | Desktop bounded aside vanishes at < 1024 px; mobile `<details>` "On this page" disclosure appears with the same active-rail style applied.                |
| 7   | Repeat checks 1-4 on `/recruiter/help`                                    | Same behavior.                                                                                                                                            |
| 8   | Repeat checks 1-4 on `/admin/help`                                        | Same behavior.                                                                                                                                            |
| 9   | macOS: System Settings → Accessibility → Display → Reduce motion ON       | TOC item clicks and auto-track snap instantly with no smooth-scroll animation.                                                                            |
| 10  | VoiceOver / NVDA on the desktop TOC                                       | The active button announces "current location" (from `aria-current="location"`).                                                                          |

- [ ] **Step 2: Capture screenshots**

Two before/after screenshots requested:

- 13" viewport, candidate page, scrolled into "Privacy & fairness" - confirm "Report a bias concern" is now visible inside the TOC.
- 13" viewport, recruiter page, scrolled into final section - confirm last item visible.

- [ ] **Step 3: Wait for human sign-off before commit**

The human responds with PASS/FAIL per check. On PASS, proceed to Task 8. On any FAIL, return to the relevant earlier task to investigate.

---

## Task 8: Commit

**Files:** none modified after Task 5.

**What:** Single conventional commit covering the whole single-file change.

- [ ] **Step 1: Stage the modified file**

Run:

```bash
git add apps/web/components/help/help-view.tsx
```

Do NOT use `git add -A` or `git add .` - per CLAUDE.md, stage by exact path.

- [ ] **Step 2: Verify staged diff**

Run:

```bash
git diff --staged --stat
```

Expected: only `apps/web/components/help/help-view.tsx` listed. Should be roughly +60 / −15 lines.

- [ ] **Step 3: Commit**

Run:

```bash
git commit -m "$(cat <<'EOF'
feat(web): bounded scrollable TOC on help pages

Replace the unbounded sticky right-rail "On this page" TOC with a
height-capped flex container that internally scrolls long lists.
Active TOC item auto-scrolls into the bounded viewport on page-scroll
via `scrollIntoView({ block: "nearest" })` keyed off the existing
scroll-spy. Active state shifts from a filled-pill background to a
2-px primary left-rail bar (Vercel/Linear/Stripe pattern). Edge fade
masks hint at clipped content. `prefers-reduced-motion` honored on
all programmatic scrolls. Mobile <details> disclosure unchanged.

Fixes the failure case on /candidate/help, /recruiter/help, and
/admin/help where TOC items below the fold were unreachable on
viewports under ~1080 px tall.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Verify the commit**

Run:

```bash
git log -1 --stat
```

Expected: one commit, one file changed, message matches.

---

## Self-review checklist

After all tasks complete, the implementing engineer (or supervising agent) should run this:

- [ ] **Spec coverage:** Every section in `2026-05-07-help-toc-scrollable-design.md` has a corresponding task:
  - Bounded sticky aside → Task 3 ✓
  - Auto-track active item → Task 4 ✓
  - 2-px left-rail active indicator → Task 2 ✓
  - Edge fade masks → Task 3 ✓
  - `aria-current="location"` → Task 2 ✓
  - `data-toc-id` attribute → Task 2 ✓
  - `prefers-reduced-motion` guard → Tasks 1, 4, 5 ✓
  - Mobile disclosure unchanged → not a task; verified via Task 7 #6 ✓
  - Hover-fill removal → Task 2 ✓
- [ ] **Placeholder scan:** No "TBD", "TODO", "as appropriate", "etc." in any task above. (Verified - none present.)
- [ ] **Type consistency:** `tocScrollRef` declared `useRef<HTMLDivElement | null>(null)` in Task 3 Step 1, used in Task 3 Step 2 (`ref={tocScrollRef}`) and Task 4 Step 1 (`tocScrollRef.current`) - matching shape throughout. `prefersReducedMotion()` defined in Task 1, called in Tasks 4 and 5 - same name, same return type.
- [ ] **No dependency added.** All imports already present.
- [ ] **No file outside `help-view.tsx` modified.**
