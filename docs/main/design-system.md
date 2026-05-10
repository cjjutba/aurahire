# AuraHire Design System

**Version:** 1.0.0
**Last Updated:** May 1, 2026
**Status:** Locked for Sprint

---

## Overview

AuraHire reads like an institutional, AI-forward platform that takes hiring seriously. Marketing surfaces are quiet, white-canvas, editorially-spaced. Authenticated portals are dense but calm — content-first, no ornamentation. The single brand voltage is **AuraHire Blue** (`{colors.primary}` — `#2563EB`), used scarcely: every primary CTA pill, the brand wordmark, inline links, and as the score-progress fill.

Beyond that one blue, the system is white canvas + ink + soft gray elevation bands + a deep near-black canvas (`{colors.surface-dark}` — `#0A0B0D`) for full-bleed marketing heroes that carry layered product-UI mockup cards.

Type pairs **Inter** (display + body, substituting for licensed system fonts) with **JetBrains Mono** for every numerical value — scores, percentages, counts, weights, time-to-hire. Display sits at **weight 400**, never 700+. The choice signals **editorial calm and explainable AI** rather than aggressive automation.

The page rhythm rotates three modes across marketing surfaces: bright white editorial sections, soft-gray elevation bands, and full-bleed dark editorial heroes carrying floating Score Ring + Breakdown Bar mockups. Inside the portals, the rhythm changes to a sidebar + dense content area (Linear / Vercel-app aesthetic) sharing the same tokens.

### Key Characteristics

- **Single accent color** — `{colors.primary}` carries every primary CTA, wordmark, and inline brand link. Used scarcely.
- **Modest display weights** — Inter at weight 400 for all display copy. Never bold.
- **Pill geometry for actions** — every CTA is `{rounded.pill}` (100px), every chip is pill, every avatar/glyph is `{rounded.full}`, every card is `{rounded.xl}` (24px) or `{rounded.lg}` (16px). Sharp corners absent.
- **Full-bleed dark heroes with floating UI cards** — `{component.hero-band-dark}` plus inline `{component.product-ui-card-dark}` mockups (Score Ring + Breakdown Bar) is the brand's strongest signature pattern.
- **Scoring semantics** — `{colors.score-low}` (red), `{colors.score-mid}` (amber), `{colors.score-high}` (green). Used as fill on Score Ring + Breakdown Bar; used as text-only on inline labels and badges. Not used as button backgrounds.
- **96px section rhythm** on marketing; **24–32px section rhythm** inside portals.

---

## Foundational Principles

1. **Restraint over ornament.** Every pixel earns its place. No shadows where a hairline will do. No second action color. No bold display.
2. **Numbers always in mono.** Every score, percent, count, currency, duration renders in JetBrains Mono. Tabular alignment + visual identity for "this is data."
3. **AI moments are visible, not hidden.** When the system runs AI — parsing, scoring, bias-checking — the surface explicitly says so (badge, shimmer, "AI suggested" tag). Transparency is the brand.
4. **Score color signals outcome, not judgment.** Fairness lives in the algorithm (PII redaction, weight transparency, audit logs). Color is value-neutral display of the computed result. We do not equate red with "bad candidate" — we equate red with "low match against this specific job's stated criteria."
5. **Two modes, one system.** Marketing surfaces use Coinbase-style editorial pacing. Portal surfaces use Linear/Vercel-style dense calm. Tokens are shared; layouts differ.

---

## Colors

### Brand & Accent

| Token                       | Hex       | Usage                                                                       |
| --------------------------- | --------- | --------------------------------------------------------------------------- |
| `{colors.primary}`          | `#2563EB` | Primary CTAs, wordmark, inline brand links, score-progress fill, focus ring |
| `{colors.primary-active}`   | `#1E40AF` | Press-state on primary pill                                                 |
| `{colors.primary-soft}`     | `#DBEAFE` | Score-progress track, primary-tinted backgrounds                            |
| `{colors.primary-disabled}` | `#A8B8CC` | Disabled CTA fill                                                           |

### Surface

| Token                            | Hex       | Usage                                                  |
| -------------------------------- | --------- | ------------------------------------------------------ |
| `{colors.canvas}`                | `#FFFFFF` | Default page floor                                     |
| `{colors.surface-soft}`          | `#F7F7F7` | Subtle alternating band, portal content background     |
| `{colors.surface-strong}`        | `#EEF0F3` | Secondary button fill, search pill, asset/avatar plate |
| `{colors.surface-dark}`          | `#0A0B0D` | Full-bleed dark hero, dark CTA bands                   |
| `{colors.surface-dark-elevated}` | `#16181C` | Floating product-UI mockup cards inside dark heroes    |

### Hairlines

| Token                    | Hex       | Usage                                                  |
| ------------------------ | --------- | ------------------------------------------------------ |
| `{colors.hairline}`      | `#DEE1E6` | Default 1px divider on white surfaces                  |
| `{colors.hairline-soft}` | `#EEF0F3` | Lighter divider; same hex as `{colors.surface-strong}` |

### Text

| Token                   | Hex       | Usage                                                  |
| ----------------------- | --------- | ------------------------------------------------------ |
| `{colors.ink}`          | `#0A0B0D` | Display headings, primary nav, body emphasis           |
| `{colors.body}`         | `#5B616E` | Default running text                                   |
| `{colors.body-strong}`  | `#0A0B0D` | Stronger emphasis (same as ink)                        |
| `{colors.muted}`        | `#7C828A` | Sub-titles, breadcrumbs, footer secondary, helper text |
| `{colors.muted-soft}`   | `#A8ACB3` | Disabled link text, placeholders                       |
| `{colors.on-primary}`   | `#FFFFFF` | White text on primary blue                             |
| `{colors.on-dark}`      | `#FFFFFF` | White text on dark heroes                              |
| `{colors.on-dark-soft}` | `#A8ACB3` | Muted off-white on dark surfaces                       |

### Scoring Semantics

These three colors are AuraHire's signature data colors. Used as **fill** on Score Ring + Score Breakdown Bar segments, as **text** on inline match labels, and as **soft background** on chips and band indicators.

| Token                      | Hex       | Score Range | Label                      |
| -------------------------- | --------- | ----------- | -------------------------- |
| `{colors.score-low}`       | `#DC2626` | 0–39        | "Limited Match"            |
| `{colors.score-mid}`       | `#F59E0B` | 40–69       | "Partial Match"            |
| `{colors.score-high}`      | `#10B981` | 70–100      | "Strong Match"             |
| `{colors.score-low-soft}`  | `#FEE2E2` | —           | Chip background, soft fill |
| `{colors.score-mid-soft}`  | `#FEF3C7` | —           | Chip background, soft fill |
| `{colors.score-high-soft}` | `#D1FAE5` | —           | Chip background, soft fill |

**Fairness note:** scoring colors communicate the _computed score against the stated job criteria_, not a value judgment of the candidate. The fairness story lives upstream — in PII redaction before scoring, in transparent weight configuration, in audit logs of every score and override. The color layer is honest visualization of the algorithmic result.

### Status Semantics (text-only inline)

| Token                     | Hex       | Usage                                         |
| ------------------------- | --------- | --------------------------------------------- |
| `{colors.status-success}` | `#05B169` | "Verified", "Completed", "Hired" labels       |
| `{colors.status-warning}` | `#F59E0B` | "Bias Flag", "Needs Review", "Pending Action" |
| `{colors.status-danger}`  | `#CF202F` | "Rejected", "Expired", "Failed"               |
| `{colors.status-info}`    | `#2563EB` | "Scheduled", "In Progress", "New"             |

These differ from scoring semantics: status colors apply to lifecycle states (where the application is in the funnel), not to a numeric score.

---

## Typography

### Font Stack

- **Display & body:** `Inter`, fallback `-apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- **Numbers (mono):** `JetBrains Mono`, fallback `"Geist Mono", "SF Mono", Menlo, Consolas, monospace`
- **Icon font:** Lucide React (component-based, not a font)

CoinbaseDisplay/Mono are licensed; Inter + JetBrains Mono are the documented substitutes.

### Hierarchy

| Token                         | Size | Weight | Line Height | Tracking | Use                                                 |
| ----------------------------- | ---- | ------ | ----------- | -------- | --------------------------------------------------- |
| `{typography.display-mega}`   | 80px | 400    | 1.0         | -2px     | Marketing landing h1                                |
| `{typography.display-xl}`     | 64px | 400    | 1.0         | -1.6px   | Subsidiary marketing heroes                         |
| `{typography.display-lg}`     | 52px | 400    | 1.0         | -1.3px   | Section heads on marketing                          |
| `{typography.display-md}`     | 44px | 400    | 1.09        | -1px     | CTA-band headlines, portal hero h1                  |
| `{typography.display-sm}`     | 36px | 400    | 1.11        | -0.5px   | Sub-section heads, score-display large              |
| `{typography.title-lg}`       | 32px | 400    | 1.13        | -0.4px   | Card group titles, dashboard widget titles          |
| `{typography.title-md}`       | 18px | 600    | 1.33        | 0        | Component titles, table headers, list-row primary   |
| `{typography.title-sm}`       | 16px | 600    | 1.25        | 0        | List labels, form section titles                    |
| `{typography.body-md}`        | 16px | 400    | 1.5         | 0        | Default body                                        |
| `{typography.body-strong}`    | 16px | 600    | 1.5         | 0        | Emphasized body                                     |
| `{typography.body-sm}`        | 14px | 400    | 1.5         | 0        | Helper text, table body, secondary copy             |
| `{typography.caption}`        | 13px | 400    | 1.5         | 0        | Photo captions, labels                              |
| `{typography.caption-strong}` | 12px | 600    | 1.5         | 0.04em   | Badge / chip labels (uppercase)                     |
| `{typography.number-display}` | 18px | 500    | 1.4         | 0        | Score values, percentages, counts — JetBrains Mono  |
| `{typography.number-large}`   | 36px | 500    | 1.0         | -0.5px   | Score Ring center number — JetBrains Mono           |
| `{typography.number-small}`   | 14px | 500    | 1.4         | 0        | Inline metrics, table cell numbers — JetBrains Mono |
| `{typography.button}`         | 16px | 600    | 1.15        | 0        | Standard CTA pill                                   |
| `{typography.button-sm}`      | 14px | 600    | 1.15        | 0        | Compact CTA, table action button                    |
| `{typography.nav-link}`       | 14px | 500    | 1.4         | 0        | Top-nav menu items, sidebar items                   |

### Principles

- **Display weight stays at 400.** The single most distinctive typographic choice — signals "calm, transparent platform" rather than "automation-first urgency."
- **Negative letter-spacing on display only.** Display tracking is -1px to -2px; body and titles stay at 0.
- **JetBrains Mono on every number.** Score values, percentages, salary ranges, application counts, durations, dates with numerical content (e.g., "2026-05-01"). Tabular alignment + signal that "this is data."
- **No bold display.** If a marketing headline needs emphasis, use color or size, not weight.
- **Don't mix display and body inside a single headline.** Headlines are either display or sentence-case title — never blended.

---

## Spacing System

Base unit: **4px**. All spacing tokens are multiples of 4.

| Token                      | Value | Use                                            |
| -------------------------- | ----- | ---------------------------------------------- |
| `{spacing.xxs}`            | 4px   | Icon-text gap, micro padding                   |
| `{spacing.xs}`             | 8px   | Inline gap, chip padding-x                     |
| `{spacing.sm}`             | 12px  | Form field internal gap                        |
| `{spacing.base}`           | 16px  | Card content gap, paragraph margin             |
| `{spacing.md}`             | 20px  | Form section gap                               |
| `{spacing.lg}`             | 24px  | Card padding (portal), grid gap                |
| `{spacing.xl}`             | 32px  | Card padding (marketing), section internal gap |
| `{spacing.xxl}`            | 48px  | Sub-section gap on marketing                   |
| `{spacing.section}`        | 96px  | Major editorial band on marketing              |
| `{spacing.portal-section}` | 32px  | Major section gap inside authenticated portals |

**Marketing rhythm:** 96px between bands; cards inside bands sit 24–32px apart.
**Portal rhythm:** 32px between sections; cards inside sit 16–24px apart.

---

## Radius Scale

| Token            | Value  | Use                                                       |
| ---------------- | ------ | --------------------------------------------------------- |
| `{rounded.none}` | 0      | Reserved (unused — sharp corners absent)                  |
| `{rounded.xs}`   | 4px    | Inline tags, code chips                                   |
| `{rounded.sm}`   | 8px    | Compact rows, table cell highlight                        |
| `{rounded.md}`   | 12px   | Form inputs, dropdown menus, modal corners                |
| `{rounded.lg}`   | 16px   | Mid-size cards, dashboard widgets                         |
| `{rounded.xl}`   | 24px   | Hero cards, Score Ring container, marketing feature cards |
| `{rounded.pill}` | 100px  | All CTA buttons, chips, search pills, badge pills         |
| `{rounded.full}` | 9999px | Avatars, asset/score icon circles                         |

**Pill for interactive, `lg`/`xl` for containers, full circle for identity glyphs.** Sharp corners (0px) are intentionally absent from the system.

---

## Elevation

The system uses **one shadow tier**. Most surfaces are flat. Depth comes from hairline borders and (on dark hero) layered cards, not from shadow ramps.

| Level        | Treatment                              | Use                                     |
| ------------ | -------------------------------------- | --------------------------------------- |
| Flat         | No shadow, no border                   | 80% of surfaces                         |
| Hairline     | 1px `{colors.hairline}`                | Card outlines on white, table cell rows |
| Soft drop    | `0 4px 12px rgba(0, 0, 0, 0.04)`       | Hovered cards, dropdown menu, popover   |
| Modal        | `0 16px 48px rgba(0, 0, 0, 0.12)`      | Modal/dialog overlay only               |
| Photographic | Layered floating UI cards on dark hero | Marketing hero depth                    |

No drop-shadow ramps. No layered shadows. No "elevated" tiers (z1, z2, z3) — flat or hairline by default.

---

## Layout Grid

### Marketing Surfaces

- **Max content width:** 1200px centered.
- **Column grid:** 12-column with 24px gutter on desktop.
- **Section padding:** `{spacing.section}` (96px) vertical.
- **Hero photography:** full-bleed (no max-width).

### Authenticated Portals

- **Layout:** Persistent sidebar (256px) + topbar (64px) + scrollable content area.
- **Content max-width:** 1280px (denser pages can extend to full viewport).
- **Column grid:** 12-column with 16px gutter.
- **Section padding:** `{spacing.portal-section}` (32px) vertical, `{spacing.lg}` (24px) horizontal.
- **Sidebar:** fixed left at desktop, slide-out drawer at mobile.

### Whitespace Philosophy

- **Marketing:** generous editorial pacing — closer to Bloomberg or Linear's marketing site than to a SaaS dashboard.
- **Portal:** dense but breathing — Linear / Vercel app aesthetic. Information-rich without feeling cramped.

---

## Iconography

- **Library:** [Lucide React](https://lucide.dev) — pairs naturally with shadcn/ui.
- **Default size:** 20px (1.25rem) inline; 16px (1rem) for compact UI; 24px (1.5rem) for prominent actions.
- **Stroke width:** 2px (Lucide default).
- **Color:** inherits text color by default. Use `{colors.muted}` for inactive icons; `{colors.primary}` only for active/selected nav state.
- **Icon-text gap:** `{spacing.xxs}` (4px) for compact; `{spacing.xs}` (8px) for standard.

Avoid filled/colored icons except for status semantics (e.g., a green check for "verified," a red X for "rejected"). Default is outline.

---

## Motion

The system uses minimal motion. Defaults:

- **Hover transitions:** 150ms ease-out on background, border, color.
- **Focus ring transition:** instant.
- **Modal/sheet enter:** 200ms ease-out, fade + slight scale or slide.
- **AI Shimmer:** 1.5s ease-in-out infinite gradient sweep (see `ui-patterns.md`).
- **Score Ring fill animation:** 800ms ease-out on initial render, instant on update.

No bouncy easings. No scroll-triggered animations on marketing. Motion serves comprehension (state change, AI processing), not delight.

---

## Do's and Don'ts

### Do

- Reserve `{colors.primary}` (AuraHire Blue) for primary CTAs, wordmark, brand-glyph illustrations, inline accent links, score-progress fill, focus ring.
- Set every CTA as `{rounded.pill}` (100px); every avatar/glyph as `{rounded.full}`.
- Keep Inter display headlines at weight 400.
- Use the dark/light band rotation as marketing page rhythm.
- Render every numerical value in JetBrains Mono via `{typography.number-display}`, `{typography.number-large}`, or `{typography.number-small}`.
- Pair every dark hero with a layered Score Ring + Breakdown Bar mockup card stack.
- Apply `{colors.score-low}` / `{colors.score-mid}` / `{colors.score-high}` only inside Score Ring fill, Breakdown Bar segments, and inline match labels.
- Show "AI Suggested" badges on any field prefilled by resume parsing.

### Don't

- Don't introduce a secondary brand color. AuraHire Blue is the only action color.
- Don't bold display copy — display sits at weight 400; bolding shifts the brand voice.
- Don't add drop-shadow tiers — system has one shadow tier.
- Don't use `{rounded.none}` (0px) on CTAs or interactive elements.
- Don't use scoring red/amber/green as a button background. Scoring colors are fill or text only.
- Don't use scoring colors for application lifecycle states. Use `{colors.status-*}` instead.
- Don't render scores in Inter. Always JetBrains Mono.
- Don't display a score without an accompanying explanation route (a click-through to the breakdown). Numbers without explanation violate the thesis.
- Don't equate score color with candidate worth in copy. Match labels are "Strong Match," "Partial Match," "Limited Match" — never "Excellent Candidate," "Mediocre Candidate," "Poor Candidate."

---

## Token Reference Summary

For implementation in Tailwind v4, define tokens in `app/globals.css` under `@theme`. Names map directly to CSS custom properties (e.g., `--color-primary`, `--rounded-pill`, `--typography-display-mega-size`).

```css
@theme {
  --color-primary: #2563eb;
  --color-primary-active: #1e40af;
  --color-primary-soft: #dbeafe;
  --color-ink: #0a0b0d;
  --color-body: #5b616e;
  --color-muted: #7c828a;
  --color-canvas: #ffffff;
  --color-surface-soft: #f7f7f7;
  --color-surface-strong: #eef0f3;
  --color-surface-dark: #0a0b0d;
  --color-surface-dark-elevated: #16181c;
  --color-hairline: #dee1e6;
  --color-score-low: #dc2626;
  --color-score-mid: #f59e0b;
  --color-score-high: #10b981;
  --color-score-low-soft: #fee2e2;
  --color-score-mid-soft: #fef3c7;
  --color-score-high-soft: #d1fae5;
  --radius-pill: 9999px;
  --radius-xl: 24px;
  --radius-lg: 16px;
  --radius-md: 12px;
  --font-display: "Inter", -apple-system, system-ui, sans-serif;
  --font-body: "Inter", -apple-system, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Geist Mono", "SF Mono", monospace;
}
```

(Full token map lives in code; this is the design source of truth.)

---

## Known Gaps

- Inter and JetBrains Mono are documented substitutes for licensed fonts; final type may be tightened during implementation.
- Animation timings beyond hover/AI shimmer/Score Ring fill are intentionally out of scope for the sprint.
- Print stylesheet not designed (export-to-PDF uses screen styles).
- Dark mode for portal interfaces is out of sprint scope. Marketing dark heroes are component-level dark surfaces, not a full dark-mode theme.
