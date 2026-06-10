# AuraHire DESIGN

## Overview

AuraHire reads like an institutional, AI-forward platform that takes hiring seriously - the marketing surfaces are quiet, white-canvas, editorially-spaced, and almost monochromatic. The single brand voltage is **AuraHire Blue** (`{colors.primary}` - #2563eb), used scarcely: every primary CTA pill, the brand wordmark, and inline emphasis links. Beyond that one blue, the system is white canvas + ink + soft gray elevation bands + a deep near-black editorial canvas (`{colors.surface-dark}` - #0a0b0d) for full-bleed product-mockup heroes.

Type pairs **Inter Display** for hero headlines with **Inter** for body, captions, and navigation; numbers always render in **JetBrains Mono**. Display sits at **weight 400** - not the 700+ typical of automation-first platforms. The choice signals editorial calm and explainable AI rather than algorithmic urgency.

The page rhythm rotates three modes: bright white editorial sections, soft-gray elevation bands, and **full-bleed dark editorial heroes** carrying layered Score Ring + Breakdown Bar mockup cards. The dark hero with floating scoring mockups is the single most distinctive component.

**Key Characteristics:**

- Single accent color: `{colors.primary}` (#2563eb AuraHire Blue) carries every primary CTA, wordmark, and inline brand link. Used scarcely.
- Modest display weights - Inter Display at weight 400, never 700+.
- Editorial pill geometry: every CTA is `{rounded.pill}` (100px), every avatar/score glyph is `{rounded.full}`, every card is `{rounded.xl}` (24px). Sharp corners absent.
- Full-bleed dark heroes with floating Score Ring + Breakdown Bar mockup cards: `{component.hero-band-dark}` plus inline `{component.product-ui-card-dark}` mockups is the brand's strongest signature pattern.
- Scoring semantics: `{colors.score-low}` (#dc2626 red), `{colors.score-mid}` (#f59e0b amber), `{colors.score-high}` (#10b981 green) - used as fill on Score Ring + Breakdown Bar segments and as text-only on inline match labels. Not used as button backgrounds.
- 96px section rhythm on marketing; 24-32px section rhythm in portals - generous editorial pacing, denser content for working surfaces.

## Colors

### Brand & Accent

- **AuraHire Blue** (`{colors.primary}` - #2563eb): The single brand color. Every primary CTA pill, the AuraHire wordmark, inline brand links, score-progress fill, focus ring.
- **AuraHire Blue Active** (`{colors.primary-active}` - #1e40af): Press-state darken on the primary pill.
- **AuraHire Blue Soft** (`{colors.primary-soft}` - #dbeafe): Score-progress track, primary-tinted backgrounds, "AI Suggested" badge background.
- **AuraHire Blue Disabled** (`{colors.primary-disabled}` - #a8b8cc): Faded-blue tint for disabled CTAs.

### Surface

- **Canvas** (`{colors.canvas}` - #ffffff): The default page floor.
- **Surface Soft** (`{colors.surface-soft}` - #f7f7f7): Subtle alternating band surface, portal content background.
- **Surface Strong** (`{colors.surface-strong}` - #eef0f3): The light-gray fill behind secondary buttons, search pills, avatar plates.
- **Surface Dark** (`{colors.surface-dark}` - #0a0b0d): Deep near-black canvas for full-bleed dark heroes, CTA bands. Same hex as `{colors.ink}` - page-floor and text-color share the value.
- **Surface Dark Elevated** (`{colors.surface-dark-elevated}` - #16181c): One step lighter, used for floating Score Ring + Breakdown Bar mockup cards inside dark heroes.

### Hairlines

- **Hairline** (`{colors.hairline}` - #dee1e6): Default 1px divider on white surfaces.
- **Hairline Soft** (`{colors.hairline-soft}` - #eef0f3): Lighter divider - same hex as `{colors.surface-strong}`.

### Text

- **Ink** (`{colors.ink}` - #0a0b0d): Display headings, primary nav, body emphasis.
- **Body** (`{colors.body}` - #5b616e): Default running-text - slightly cool gray.
- **Body Strong** (`{colors.body-strong}` - #0a0b0d): Same as ink, used for stronger emphasis.
- **Muted** (`{colors.muted}` - #7c828a): Sub-titles, breadcrumbs, footer secondary, helper text.
- **Muted Soft** (`{colors.muted-soft}` - #a8acb3): Disabled link text, placeholders.
- **On Primary** (`{colors.on-primary}` - #ffffff): White text on AuraHire Blue CTAs.
- **On Dark** (`{colors.on-dark}` - #ffffff): White text on dark heroes.
- **On Dark Soft** (`{colors.on-dark-soft}` - #a8acb3): Muted off-white for secondary text on dark.

### Scoring Semantics

- **Score Low** (`{colors.score-low}` - #dc2626): "Limited Match" (0-39). Score Ring fill + Breakdown Bar segments + match-band-chip text.
- **Score Mid** (`{colors.score-mid}` - #f59e0b): "Partial Match" (40-69). Same uses.
- **Score High** (`{colors.score-high}` - #10b981): "Strong Match" (70-100). Same uses.
- **Score Low Soft** (`{colors.score-low-soft}` - #fee2e2): Chip background, soft fill.
- **Score Mid Soft** (`{colors.score-mid-soft}` - #fef3c7): Chip background, soft fill.
- **Score High Soft** (`{colors.score-high-soft}` - #d1fae5): Chip background, soft fill.

Scoring colors visualize the _computed score against stated job criteria_, not a value judgment of the candidate. Fairness lives upstream - in PII redaction, transparent weight configuration, and audit logs of every score and override.

### Status Semantics (text-only inline)

- **Status Success** (`{colors.status-success}` - #05b169): "Verified", "Hired", "Completed".
- **Status Warning** (`{colors.status-warning}` - #f59e0b): "Bias Flag", "Needs Review", "Pending Action".
- **Status Danger** (`{colors.status-danger}` - #cf202f): "Rejected", "Expired", "Failed".
- **Status Info** (`{colors.status-info}` - #2563eb): "Scheduled", "In Progress", "New".

Status colors apply to lifecycle states (where an application is in the funnel), not to score values.

## Typography

### Font Family

The system runs **Inter Display** (display headlines), **Inter** (body, navigation, captions, buttons), **Lucide React** (icon component library), and **JetBrains Mono** for tabular numerical data - score values, percentages, salary ranges, time-to-hire. Fallback stack: `-apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`.

The display/body split is functional: Inter Display carries hero headlines only; Inter carries everything else.

### Hierarchy

| Token                         | Size | Weight | Line Height | Letter Spacing | Use                                                |
| ----------------------------- | ---- | ------ | ----------- | -------------- | -------------------------------------------------- |
| `{typography.display-mega}`   | 80px | 400    | 1.0         | -2px           | Marketing landing h1                               |
| `{typography.display-xl}`     | 64px | 400    | 1.0         | -1.6px         | Subsidiary heroes                                  |
| `{typography.display-lg}`     | 52px | 400    | 1.0         | -1.3px         | Section heads                                      |
| `{typography.display-md}`     | 44px | 400    | 1.09        | -1px           | CTA-band headlines, portal hero h1                 |
| `{typography.display-sm}`     | 36px | 400    | 1.11        | -0.5px         | Sub-section heads - Inter                          |
| `{typography.title-lg}`       | 32px | 400    | 1.13        | -0.4px         | Card group titles, dashboard widget titles         |
| `{typography.title-md}`       | 18px | 600    | 1.33        | 0              | Component titles, list-row primary                 |
| `{typography.title-sm}`       | 16px | 600    | 1.25        | 0              | List labels, form section titles                   |
| `{typography.body-md}`        | 16px | 400    | 1.5         | 0              | Default body                                       |
| `{typography.body-strong}`    | 16px | 600    | 1.5         | 0              | Emphasized body                                    |
| `{typography.body-sm}`        | 14px | 400    | 1.5         | 0              | Helper text, table body                            |
| `{typography.caption}`        | 13px | 400    | 1.5         | 0              | Captions, labels                                   |
| `{typography.caption-strong}` | 12px | 600    | 1.5         | 0.04em         | Badge / chip labels (uppercase)                    |
| `{typography.number-display}` | 18px | 500    | 1.4         | 0              | Score values, percentages, counts - JetBrains Mono |
| `{typography.number-large}`   | 36px | 500    | 1.0         | -0.5px         | Score Ring center number - JetBrains Mono          |
| `{typography.button}`         | 16px | 600    | 1.15        | 0              | Standard CTA pill                                  |
| `{typography.nav-link}`       | 14px | 500    | 1.4         | 0              | Top-nav menu items, sidebar items                  |

### Principles

- **Display weight stays at 400.** The single most distinctive typographic choice - signals "calm, transparent platform" rather than "automation-first urgency."
- **Negative letter-spacing on display only.** Display uses -1px to -2px tracking; body and titles stay at 0.
- **JetBrains Mono on every number.** Score values, percentages, salary ranges, application counts, durations - anything tabular renders in JetBrains Mono.

### Note on Font Substitutes

Inter and JetBrains Mono are the documented brand typefaces (open-licensed substitutes for premium typefaces). Both load via `next/font/google` for optimal performance.

- **Inter Display** at weight 400, letter-spacing -1.5%.
- **Inter** at weight 400/500/600.
- **JetBrains Mono** (or Geist Mono fallback) at weight 500.

## Layout

### Spacing System

- **Base unit:** 4px.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.base}` 16px · `{spacing.md}` 20px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 96px · `{spacing.portal-section}` 32px.
- **Marketing section padding:** `{spacing.section}` (96px) for every major editorial band.
- **Portal section padding:** `{spacing.portal-section}` (32px) - denser, content-first.
- **Card internal padding:** `{spacing.xl}` (32px) for marketing feature cards; `{spacing.lg}` (24px) for portal widgets.

### Grid & Container

- **Marketing max content width:** ~1200px centered. Hero photography full-bleed.
- **Portal layout:** persistent sidebar 256px + topbar 64px + scrollable content area, max-width 1280px.
- **Editorial body:** Single 12-column grid with 24px gutter on marketing, 16px on portal.
- **Feature card grids:** 2-up at desktop for hero splits, 3-up for benefit grids.
- **Footer:** 6-column link list at desktop.

### Whitespace Philosophy

Generous editorial pacing on marketing - closer to Bloomberg or Linear's marketing site than to a recruitment dashboard. 96px between bands; cards inside bands sit 24-32px apart. Density lives behind login walls, not on marketing. **Two modes, one system:** marketing follows Coinbase-style editorial calm; portals follow Linear/Vercel-style dense calm. Tokens are shared; layouts differ.

## Elevation & Depth

| Level           | Treatment                                     | Use                                                        |
| --------------- | --------------------------------------------- | ---------------------------------------------------------- |
| Flat            | No shadow, no border                          | 80% of surfaces                                            |
| Hairline border | 1px `{colors.hairline}`                       | Feature card outlines on white, table cell rows            |
| Soft drop       | `0 4px 12px rgba(0, 0, 0, 0.04)`              | Single shadow tier - hovered cards, dropdown menu, popover |
| Modal           | `0 16px 48px rgba(0, 0, 0, 0.12)`             | Modal/dialog overlay only                                  |
| Photographic    | Full-bleed Score Ring + Breakdown Bar mockups | Hero depth                                                 |

### Decorative Depth

- **Layered Score Ring + Breakdown Bar mockup cards inside dark heroes** is the most distinctive decorative pattern - a `{component.product-ui-card-dark}` floats above a darker base canvas, often with a second smaller card overlapping at an angle, displaying a sample candidate-to-job match.
- **Geometric brand illustrations** carry illustrative depth where shadows would otherwise.

## Shapes

### Border Radius Scale

| Token            | Value  | Use                                                        |
| ---------------- | ------ | ---------------------------------------------------------- |
| `{rounded.none}` | 0px    | Reserved (essentially unused)                              |
| `{rounded.xs}`   | 4px    | Inline tags                                                |
| `{rounded.sm}`   | 8px    | Compact rows                                               |
| `{rounded.md}`   | 12px   | Form inputs                                                |
| `{rounded.lg}`   | 16px   | Mid-size cards, dashboard widgets                          |
| `{rounded.xl}`   | 24px   | Hero cards, Score Ring containers, marketing feature cards |
| `{rounded.pill}` | 100px  | All CTA buttons, search pills, chips, badges               |
| `{rounded.full}` | 9999px | Avatars, score-icon circles                                |

Pill for interactive, card-radius (24px) for marketing containers / 16px for portal containers, full circle for identity glyphs. Sharp corners absent.

## Components

### Top Navigation

**`top-nav-light`** - Default top nav on white pages. Background `{colors.canvas}`, text `{colors.ink}`, height 64px. Layout: AuraHire wordmark left, primary horizontal menu (Product / Solutions / About / Browse Jobs), Sign In + Get Started CTAs right.

**`top-nav-on-dark`** - Top nav over a dark hero band. Background transparent → `{colors.surface-dark}` on scroll, text `{colors.on-dark}`. Same layout.

**`portal-sidebar`** - Persistent left sidebar across all three portals (Candidate, Recruiter, Admin). Width 256px desktop, drawer at < 1024px. Background `{colors.surface-soft}`, role badge top, primary nav center, user dropdown bottom.

### Buttons

**`button-primary`** - The signature AuraHire Blue pill. Background `{colors.primary}`, text `{colors.on-primary}`, type `{typography.button}` (16px / 600), padding 12px × 20px, height 44px, rounded `{rounded.pill}` (100px).

**`button-primary-active`** - Press state. Background `{colors.primary-active}`, deeper blue.

**`button-primary-disabled`** - Faded blue tint. Background `{colors.primary-disabled}`. Cursor not-allowed.

**`button-secondary-light`** - Soft-gray secondary on white surfaces. Background `{colors.surface-strong}`, text `{colors.ink}`, same pill geometry.

**`button-secondary-dark`** - Used on dark heroes. Background `{colors.surface-dark-elevated}`, text `{colors.on-dark}`, same pill geometry.

**`button-outline-on-dark`** - Transparent pill with white outline. Background transparent, text `{colors.on-dark}`, 1px white border.

**`button-tertiary-text`** - Inline text link. Background transparent, text `{colors.primary}`, type `{typography.button}`.

**`button-pill-cta`** - Larger pill CTA used on the homepage hero ("Get Started"). Same AuraHire Blue palette but with 56px height and 16px × 32px padding for a prouder stance.

### Hero Bands

**`hero-band-dark`** - The signature full-bleed dark hero. Background `{colors.surface-dark}`, text `{colors.on-dark}`, full-bleed layered Score Ring + Breakdown Bar mockup cards. Display headline left in `{typography.display-mega}` (80px / 400), subhead in `{typography.body-md}`, two CTAs.

**`hero-band-light`** - White-canvas variant used on About and informational pages. Background `{colors.canvas}`, text `{colors.ink}`. Same skeleton, light palette.

### Cards

**`product-ui-card-dark`** - The floating Score Ring + Breakdown Bar mockup. Background `{colors.surface-dark-elevated}`, text `{colors.on-dark}`, rounded `{rounded.xl}` (24px), padding 32px. Often shown as 2-3 stacked cards at slight rotation, mimicking a layered scoring breakdown.

**`product-ui-card-light`** - Light-canvas variant used on portal dashboards. Background `{colors.canvas}`, text `{colors.ink}`, same geometry, 1px hairline border.

**`feature-card`** - Used in 3-up and 2-up grids. Background `{colors.canvas}`, text `{colors.ink}`, type `{typography.title-md}`, rounded `{rounded.xl}`, padding 32px.

### Score Surfaces

**`score-ring`** - Circular progress ring with center number. Sizes `sm` 80px, `md` 120px, `lg` 200px. Track `{colors.primary-soft}`, fill in `{colors.score-low}` / `{colors.score-mid}` / `{colors.score-high}` based on band. Center: `{typography.number-large}` score + `{typography.caption}` "of 100" label. Animated 800ms ease-out on initial render.

**`score-breakdown-bar`** - Horizontal stacked bar showing component contribution. Track `{colors.surface-strong}`, segments proportional to weights, fill in score-band colors. Click any segment opens evidence panel.

**`evidence-callout`** - Quoted excerpt from resume with highlight. Background `{colors.surface-soft}`, leading 4px solid border in score band color. Header "EVIDENCE FROM RESUME" `{typography.caption-strong}`, italic body, footer with contribution points.

**`match-band-chip`** - Plain-language match label paired with every numeric score. "Strong Match" (`{colors.score-high-soft}` bg / `{colors.score-high}` text), "Partial Match", "Limited Match". Geometry `{rounded.pill}`.

**`pipeline-card-compact`** - Application row in pipeline kanban or list. Avatar + name + role + score breakdown bar + match band chip. Click opens application detail.

### Bias Mitigation Surfaces

**`chip-bias-flag`** - Inline chip in job description editor when AI flags discriminatory language. Background `{colors.score-mid-soft}` (amber soft), text `{colors.score-mid}`, leading alert-triangle icon. Click opens popover with explanation + suggestion + override option.

### AI Affordances

**`ai-shimmer`** - Loading state for sections where AI is processing. Subtle gradient sweep `{colors.surface-strong}` → `{colors.surface-soft}` infinite 1.5s ease-in-out. Always paired with caption: "AI is parsing your resume...", "Computing your Profile Score...", "Checking job description for biased language...".

**`badge-ai-suggested`** - Tiny pill next to fields prefilled by resume parsing. Background `{colors.primary-soft}`, text `{colors.primary}`, leading sparkles icon, label "AI SUGGESTED". Becomes "EDITED" in `{colors.muted}` when user modifies.

### Forms

**`text-input`** - Standard text input. Background `{colors.canvas}`, text `{colors.ink}`, rounded `{rounded.md}` (12px), padding 14px × 16px, height 48px, 1px hairline border. On focus, border thickens to 2px AuraHire Blue.

**`search-input-pill`** - Pill-shaped search bar. Background `{colors.surface-strong}`, rounded `{rounded.pill}`, padding 12px × 20px, height 44px.

**`file-upload-dropzone`** - Resume upload zone. 200px min height, dashed `{colors.hairline}` border, padding `{spacing.xl}`. On drag-over, becomes 2px solid AuraHire Blue with `{colors.primary-soft}` background. Lucide upload-cloud icon + headline + subtext + accepted formats caption.

### Tags & Badges

**`badge-pill`** - Small uppercase pill used as section labels ("AI-POWERED", "REMOTE", "FULL-TIME"). Background `{colors.surface-strong}`, text `{colors.ink}`, type `{typography.caption-strong}`, rounded `{rounded.pill}`.

**`chip-status`** - Lifecycle status chip (Applied / Screening / Interview / Offer / Hired / Rejected). Each variant pairs a soft background with the corresponding status color text.

### CTA / Footer

**`cta-band-dark`** - Pre-footer "Hire fairly. Hire transparently. Hire faster." band. Background `{colors.surface-dark}`, text `{colors.on-dark}`, vertical padding 96px. Centered headline + two CTAs.

**`footer-marketing`** - Closing white-canvas footer. Background `{colors.canvas}`, text `{colors.body}`. 6-column link list (Product / Solutions / Resources / Company / Legal / Contact).

**`footer-link`** - Individual footer link. Background transparent, text `{colors.body}`.

**`legal-band`** - Bottom strip beneath footer columns. All text `{colors.muted}` at `{typography.caption}`.

## Do's and Don'ts

### Do

- Reserve `{colors.primary}` (AuraHire Blue) for primary CTAs, wordmark, brand-glyph illustrations, inline accent links, score-progress fill, focus rings.
- Set every CTA as `{rounded.pill}` (100px); every avatar/score glyph as `{rounded.full}`.
- Keep Inter Display headlines at weight 400.
- Use the dark/light band rotation as marketing page rhythm.
- Render every numerical value in JetBrains Mono via `{typography.number-display}`, `{typography.number-large}`, or `{typography.number-small}`.
- Pair every dark hero with a layered Score Ring + Breakdown Bar mockup card stack.
- Apply `{colors.score-low}` / `{colors.score-mid}` / `{colors.score-high}` only inside Score Ring fill, Breakdown Bar segments, and inline match labels.
- Show "AI Suggested" badges on every field prefilled by resume parsing.
- Pair every AI Shimmer with a caption explaining what the AI is doing.

### Don't

- Don't introduce a secondary brand color. AuraHire Blue is the only action color.
- Don't bold display copy - display sits at weight 400; bolding shifts the brand voice.
- Don't add drop-shadow tiers - system has one shadow tier.
- Don't use `{rounded.none}` (0px) on CTAs or interactive elements.
- Don't use scoring red/amber/green as a button background. Scoring colors are fill or text only.
- Don't use scoring colors for application lifecycle states. Use `{colors.status-*}` instead.
- Don't render scores in Inter. Always JetBrains Mono.
- Don't display a score without a click-through to its breakdown. Numbers without explanation violate the thesis.
- Don't equate score color with candidate worth in copy. Match labels are "Strong Match," "Partial Match," "Limited Match" - never "Excellent Candidate," "Mediocre Candidate."
- Don't mix Inter Display and Inter inside the same headline.
- Don't extract a CTA color from a third-party widget (cookie consent, analytics modal). The brand's CTA color is what appears on actual product CTAs.

## Responsive Behavior

### Breakpoints

| Name    | Width       | Marketing                                                                                                         | Portal                                                            |
| ------- | ----------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Mobile  | < 640px     | Hero h1 80→40px; feature card grid 1-up; layered mockup cards collapse to single card; nav collapses to hamburger | Sidebar → drawer; tables → vertical card list; Score Ring sm size |
| Tablet  | 640-1024px  | Hero h1 64px; feature card grid 2-up; mockup 2 stacked                                                            | Sidebar drawer; topbar full; tables compress                      |
| Desktop | 1024-1280px | Full editorial hero 80px; feature card grid 3-up                                                                  | Persistent sidebar 256px; full topbar                             |
| Wide    | > 1280px    | Content caps at 1200px; hero photography full-bleed                                                               | Content max-width 1280px                                          |

### Touch Targets

- Primary CTA pill at 44px height - at WCAG AAA.
- Larger hero pill (`{component.button-pill-cta}`) at 56px - well above AAA.
- Avatar / score icon circles at 32-40px - padded into 48px effective tap zone via row padding.
- Search pill at 44px height - at AAA.
- Sidebar nav item at 44px height - at AAA.

### Collapsing Strategy

- Top nav switches to hamburger sheet below 768px. Sign Up CTA stays visible.
- Hero h1 steps down: 80 → 64 → 52 → 44 → 36px on smallest screens.
- Layered Score Ring + Breakdown Bar mockup cards collapse from 2-3 stacked into a single card on mobile.
- Pipeline board: horizontal scroll on mobile (each column min-width 280px).
- Score Ring: lg → md → sm at narrower viewports.
- Score Breakdown Bar: full layout → compact (no labels above) → tap to reveal popover.
- Tables convert to vertically stacked cards (each row becomes a card with label-value pairs).

## Iteration Guide

1. Focus on a single component at a time. Reference token keys directly.
2. New CTAs default to `{rounded.pill}` (100px); new icon plates default to `{rounded.full}`. Cards use `{rounded.lg}` (portal) or `{rounded.xl}` (marketing).
3. Variants live as separate entries inside the `components:` block.
4. Use `{token.refs}` everywhere - never inline hex.
5. Hover state never documented exhaustively; rule is "background darkens 4-8% or moves up one elevation tier." Only Default and Active/Pressed are formally specified.
6. Inter Display 400 for display, Inter 400/500/600 for body. JetBrains Mono on every number.
7. AuraHire Blue stays scarce - one or two blue moments per band.
8. Score Ring + Score Breakdown Bar + Evidence Callout always travel together when explaining a score. Never show a number alone without click-through to breakdown.

## Known Gaps

- Inter and JetBrains Mono are the open-licensed brand typefaces (no premium licensing required).
- In-product real-time messaging surfaces (candidate-recruiter chat) are not in sprint scope - this document covers up to the offer flow.
- Animation timings beyond hover, AI Shimmer (1.5s ease-in-out infinite), Score Ring fill (800ms ease-out), and modal enter (200ms) are intentionally unspecified.
- Component dark-mode variants beyond marketing dark hero are out of sprint scope.
- Form validation states beyond focus + error are not documented for every component; pattern follows: error border 2px `{colors.status-danger}` + error message below in danger color + leading alert-circle icon.
- Print stylesheet not designed (export-to-PDF in admin uses screen styles for sprint).
- Bias detection surfaces (`chip-bias-flag`, override popover) are AuraHire-specific patterns extending beyond standard institutional design vocabulary; their inclusion is a thesis-defining choice.
