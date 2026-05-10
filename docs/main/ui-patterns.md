# AuraHire UI Patterns & Components

**Version:** 1.0.0
**Last Updated:** May 1, 2026
**Status:** Locked for Sprint
**Depends on:** `design-system.md`

This document defines every component in the AuraHire system. All references to color, spacing, radius, and typography use tokens from `design-system.md`. Implementation uses **shadcn/ui** primitives extended with AuraHire-specific patterns.

---

## 1. Navigation

### `nav-marketing-top` — Marketing top nav (light)

Default top nav on white pages.

- **Background:** `{colors.canvas}`
- **Text:** `{colors.ink}`
- **Height:** 64px
- **Padding:** 0 `{spacing.lg}` (24px)
- **Border bottom:** 1px `{colors.hairline-soft}` on scroll only
- **Layout:** AuraHire wordmark left, primary horizontal menu (Product / Solutions / About / Browse Jobs) center, "Sign In" text link + "Get Started" `{component.button-primary}` right.
- **Type:** wordmark in `{typography.title-md}`; menu items in `{typography.nav-link}`.

### `nav-marketing-on-dark` — Marketing top nav (over dark hero)

Same skeleton as `nav-marketing-top` but transparent until scroll, white text.

- **Background:** transparent → `{colors.surface-dark}` on scroll
- **Text:** `{colors.on-dark}`

### `nav-portal-sidebar` — Authenticated sidebar

Persistent left sidebar across all three portals (candidate, recruiter, admin).

- **Width:** 256px (desktop) → drawer at < 1024px
- **Background:** `{colors.surface-soft}`
- **Border right:** 1px `{colors.hairline}`
- **Padding:** `{spacing.lg}` 0
- **Sections:**
  - Top: AuraHire wordmark + role badge (e.g., "Candidate")
  - Middle: primary nav items (icon + label)
  - Bottom: user avatar + name + dropdown (Profile, Settings, Logout)
- **Nav item:**
  - Default: `{colors.body}` text, transparent background, 44px height, padding `{spacing.sm}` `{spacing.lg}`, `{rounded.md}`
  - Active: `{colors.primary}` text, `{colors.primary-soft}` background, semibold
  - Hover: `{colors.surface-strong}` background
- **Icon:** Lucide 20px, leading

### `nav-portal-topbar` — Authenticated topbar

Persistent across portal pages above content.

- **Height:** 64px
- **Background:** `{colors.canvas}`
- **Border bottom:** 1px `{colors.hairline}`
- **Padding:** 0 `{spacing.lg}`
- **Layout:** breadcrumb left → search pill (when applicable) → notifications bell + avatar dropdown right

### `nav-mobile-drawer` — Mobile sidebar (sheet)

The portal sidebar collapses to a slide-out drawer at `< 1024px`. Triggered by hamburger icon in topbar.

- **Width:** 80vw, max 320px
- **Animation:** 200ms ease-out slide from left
- **Backdrop:** `rgba(0,0,0,0.4)` overlay

### `breadcrumb` — Breadcrumb trail

Inside portal topbar.

- **Type:** `{typography.body-sm}`
- **Color:** `{colors.muted}` for path; `{colors.ink}` for current page
- **Separator:** `/` in `{colors.muted-soft}`

---

## 2. Buttons

All buttons share `{rounded.pill}` (100px) geometry. No exceptions.

### `button-primary` — Signature blue pill

- **Background:** `{colors.primary}` → `{colors.primary-active}` on press
- **Text:** `{colors.on-primary}`, `{typography.button}` (16/600)
- **Padding:** 12px 20px
- **Height:** 44px
- **Disabled:** `{colors.primary-disabled}` background, cursor `not-allowed`
- **Loading:** spinner replaces icon, label dims to 60%, button non-interactive

### `button-primary-large` — Hero CTA

Used on marketing hero "Get Started" and major in-app CTAs ("Apply Now," "Post Job").

- Same palette as primary
- **Height:** 56px
- **Padding:** 16px 32px
- **Text:** `{typography.button}` at 16/600

### `button-secondary` — Soft gray pill

- **Background:** `{colors.surface-strong}` → darker on press
- **Text:** `{colors.ink}`, `{typography.button}`
- Same dimensions as `button-primary`

### `button-secondary-on-dark` — Used on dark hero/band

- **Background:** `{colors.surface-dark-elevated}`
- **Text:** `{colors.on-dark}`

### `button-outline-on-dark` — Dark hero secondary CTA

- **Background:** transparent
- **Border:** 1px `{colors.on-dark}`
- **Text:** `{colors.on-dark}`

### `button-tertiary` — Inline text link button

- **Background:** transparent
- **Text:** `{colors.primary}`, `{typography.button}`
- No padding, no border, underline on hover

### `button-destructive` — Reject, delete, suspend

- **Background:** `{colors.status-danger}` → darker on press
- **Text:** `{colors.on-primary}` (white)
- Used sparingly: only on confirmed-destructive actions inside modals

### `button-ghost` — Subtle action

- **Background:** transparent → `{colors.surface-strong}` on hover
- **Text:** `{colors.body}` → `{colors.ink}` on hover
- Used for less-prominent actions inside cards (e.g., "View details").

### `button-icon` — Icon-only button

- **Size:** 36px × 36px (default), 40px × 40px (topbar)
- **Background:** transparent → `{colors.surface-strong}` on hover
- **Radius:** `{rounded.full}`
- **Icon:** Lucide 20px, `{colors.body}`

### `button-sm` — Compact pill

For dense table rows and inline actions.

- **Height:** 32px
- **Padding:** 8px 16px
- **Text:** `{typography.button-sm}` (14/600)

### Button States Matrix

| State          | Treatment                                                         |
| -------------- | ----------------------------------------------------------------- |
| Default        | Base palette                                                      |
| Hover          | Background darkens 4–8%; cursor pointer                           |
| Focus-visible  | `{colors.primary}` 2px outer ring, 2px offset                     |
| Active/Pressed | Press-state palette                                               |
| Disabled       | `disabled` palette, cursor `not-allowed`, no hover                |
| Loading        | Spinner replaces leading icon, label dims, button non-interactive |

---

## 3. Form Controls

### `text-input` — Default text input

- **Background:** `{colors.canvas}`
- **Border:** 1px `{colors.hairline}` → 2px `{colors.primary}` on focus
- **Radius:** `{rounded.md}` (12px)
- **Padding:** 14px 16px
- **Height:** 48px
- **Text:** `{colors.ink}`, `{typography.body-md}`
- **Placeholder:** `{colors.muted-soft}`
- **Error state:** border becomes 2px `{colors.status-danger}`, error text below in `{colors.status-danger}` `{typography.caption}`
- **Disabled:** background `{colors.surface-strong}`, text `{colors.muted-soft}`, cursor `not-allowed`

### `textarea` — Multi-line input

Same palette as `text-input`. Min height 96px. Resizable vertical only.

### `select` — Dropdown select

- **Trigger:** identical to `text-input` with chevron-down icon (Lucide, 16px) right
- **Menu:** `{colors.canvas}` background, 1px `{colors.hairline}` border, `{rounded.md}`, shadow `soft drop`
- **Item:** 40px height, padding `{spacing.sm}` `{spacing.base}`, hover `{colors.surface-soft}`
- **Item active:** `{colors.primary-soft}` background, `{colors.primary}` text, leading check icon

### `multi-select` — Tag-style multi-select

Selected values shown as pill chips inside the input. Each chip has a small "×" close icon. Used for skills, locations, tags.

### `checkbox` — Checkbox

- **Box:** 20px × 20px, `{rounded.xs}` (4px), 2px `{colors.hairline}` border → 2px `{colors.primary}` border + `{colors.primary}` fill when checked
- **Label:** `{typography.body-md}`, leading 12px from box

### `radio` — Radio button

- **Circle:** 20px × 20px, `{rounded.full}`, 2px `{colors.hairline}` border → 2px `{colors.primary}` border + 8px center dot when selected

### `toggle` — Toggle switch

- **Track:** 44px × 24px, `{rounded.pill}`, `{colors.surface-strong}` → `{colors.primary}` when on
- **Thumb:** 20px circle, `{rounded.full}`, white, slides 20px on toggle
- **Transition:** 150ms ease-out

### `file-upload-dropzone` — Resume upload zone

- **Container:** 200px min height, `{colors.canvas}` background, 2px dashed `{colors.hairline}`, `{rounded.lg}`, padding `{spacing.xl}`
- **Hover/dragover:** border becomes 2px solid `{colors.primary}`, background `{colors.primary-soft}`
- **Content:** Lucide upload-cloud icon (32px) + "Drag & drop your resume" headline + "or click to browse" subtext + accepted formats caption ("PDF, DOCX up to 10MB")
- **Uploaded state:** file icon + filename + size + "×" remove icon + "Replace" button
- **Processing state:** see `ai-shimmer` pattern

### `search-pill` — Search input

- **Background:** `{colors.surface-strong}`
- **Border:** none
- **Radius:** `{rounded.pill}`
- **Padding:** 12px 20px
- **Height:** 44px
- **Leading icon:** Lucide search 20px in `{colors.muted}`

### `date-picker` — Date input

Trigger looks like `text-input` with calendar icon. Popover calendar uses shadcn Calendar primitive on `{colors.canvas}` background.

### Form Validation Pattern

| State    | Treatment                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------- |
| Default  | Hairline border                                                                                      |
| Focus    | Primary 2px border, no error/success colors yet                                                      |
| Error    | Danger 2px border, error message below in danger color, Lucide alert-circle icon leading the message |
| Success  | Success 2px border (only after async validation, e.g., email already taken check)                    |
| Disabled | Strong-soft background, muted-soft text                                                              |

Error messages appear **below** the field, separated by 4px, in `{typography.caption}` and `{colors.status-danger}`.

---

## 4. Multi-Step Wizard

Used for onboarding flows.

### `wizard-shell`

- **Layout:** centered single column, max-width 720px
- **Header:** wizard title in `{typography.display-sm}` + step indicator
- **Body:** current step content, padded `{spacing.xl}`
- **Footer:** sticky bar with Back (`button-secondary`) left + Next (`button-primary`) right + step counter ("Step 3 of 6") center in `{colors.muted}` `{typography.caption}`

### `wizard-progress` — Step indicator

Horizontal indicator above wizard body.

- **Each step:** circular dot 24px diameter, `{rounded.full}`
  - Completed: `{colors.primary}` fill, white check icon
  - Current: `{colors.primary}` border, white fill, primary text inside (step number)
  - Future: `{colors.hairline}` fill, muted text inside
- **Connector:** 2px line between dots, `{colors.primary}` if both dots completed, else `{colors.hairline}`
- **Label:** below each dot, `{typography.caption}` `{colors.muted}` (current step bold, primary)

### `wizard-step-resume-upload` — Special: candidate onboarding step 1

This first step of candidate onboarding is the primary AI moment. After upload:

1. File enters `file-upload-dropzone` "uploaded" state
2. Dropzone replaced with **AI Shimmer** card showing "Parsing your resume..." with skeleton fields representing the data being extracted
3. On completion, user sees a confirmation card: "We extracted X fields from your resume. Review them in the next steps." with primary continue CTA
4. On parse failure, fallback message: "We couldn't parse your resume. Don't worry — you can fill out your profile manually."

---

## 5. Cards

### `card-feature` — Marketing feature card

- **Background:** `{colors.canvas}`
- **Border:** 1px `{colors.hairline}`
- **Radius:** `{rounded.xl}` (24px)
- **Padding:** `{spacing.xl}` (32px)
- **Layout:** Lucide icon (32px in `{colors.primary}`) + title `{typography.title-md}` + body `{typography.body-md}` `{colors.body}`
- **Hover:** `soft drop` shadow appears, no border change

### `card-widget` — Portal dashboard widget

- **Background:** `{colors.canvas}`
- **Border:** 1px `{colors.hairline}`
- **Radius:** `{rounded.lg}` (16px)
- **Padding:** `{spacing.lg}` (24px)
- **Header:** title `{typography.title-md}` + optional action button right (e.g., "View all")
- **Body:** widget content (chart, list, metric tile)

### `card-stat` — Metric tile

For dashboards. A single number with label and optional change indicator.

- **Layout vertical:**
  - Label `{typography.caption}` `{colors.muted}` uppercase
  - Number `{typography.display-sm}` (36px JetBrains Mono) `{colors.ink}`
  - Change indicator: Lucide trending-up/down icon + `+12%` in mono, color = `{colors.status-success}` or `{colors.status-danger}`
- **Padding:** `{spacing.lg}`
- **Background:** `{colors.canvas}`
- **Border:** 1px `{colors.hairline}`
- **Radius:** `{rounded.lg}`

### `card-list-row` — Asset / candidate / job row

Horizontal row used in lists.

- **Background:** transparent
- **Border bottom:** 1px `{colors.hairline}` (last row no border)
- **Padding:** `{spacing.base}` `{spacing.lg}`
- **Layout:** leading icon/avatar (40px) + primary text column + meta column + trailing actions (chevron-right or button-icon)
- **Hover:** `{colors.surface-soft}` background

### `card-product-ui-dark` — Floating product UI mockup (marketing)

The signature floating card on dark hero.

- **Background:** `{colors.surface-dark-elevated}`
- **Text:** `{colors.on-dark}`
- **Radius:** `{rounded.xl}`
- **Padding:** `{spacing.xl}`
- **Shadow:** photographic depth (large soft drop, often with secondary card overlapping at slight rotation)
- **Content:** mockup of Score Ring + Score Breakdown Bar showing a sample candidate-to-job match (the strongest single brand image AuraHire owns)

### `card-product-ui-light` — Light variant of above

Used inside white-canvas marketing sections.

- **Background:** `{colors.canvas}`
- **Border:** 1px `{colors.hairline}`
- Same geometry as dark variant

---

## 6. Tables

### `table-data` — Standard data table

- **Background:** `{colors.canvas}`
- **Border:** 1px `{colors.hairline}` outer, `{rounded.lg}` corners
- **Header row:** `{colors.surface-soft}` background, `{typography.caption-strong}` uppercase `{colors.muted}`, padding `{spacing.sm}` `{spacing.base}`, sortable headers have chevron icon
- **Body row:** padding `{spacing.base}`, border-bottom 1px `{colors.hairline-soft}`, hover `{colors.surface-soft}`
- **Cell text:** `{typography.body-sm}` `{colors.body}`; numerical cells `{typography.number-small}` `{colors.ink}` right-aligned
- **Action column:** right-aligned, `button-icon` or `button-ghost` size sm
- **Row select:** leading checkbox column when bulk actions enabled
- **Empty state:** see `empty-state` pattern

### `table-pagination`

Below table.

- **Layout:** "Showing 1–25 of 142" `{colors.muted}` left + page number pills (current `{colors.primary-soft}` background) + Previous/Next buttons right
- **Page size selector:** `select` "25 / page" with options 10/25/50/100

---

## 7. Tags, Chips & Badges

### `chip-status` — Lifecycle status chip

- **Geometry:** `{rounded.pill}`, padding 4px 12px
- **Type:** `{typography.caption-strong}` (12/600 with 0.04em tracking, uppercase)
- **Variants:** Each lifecycle status has a paired soft + ink color
  - `chip-status-applied`: `{colors.surface-strong}` bg, `{colors.ink}` text
  - `chip-status-screening`: `{colors.primary-soft}` bg, `{colors.primary}` text
  - `chip-status-interview`: `{colors.score-mid-soft}` bg, `{colors.score-mid}` text
  - `chip-status-offered`: `{colors.score-high-soft}` bg, `{colors.score-high}` text
  - `chip-status-hired`: `{colors.score-high-soft}` bg, `{colors.status-success}` text + leading check icon
  - `chip-status-rejected`: `{colors.score-low-soft}` bg, `{colors.status-danger}` text

### `chip-match-band` — Score band label

The plain-language match label that accompanies every numeric score.

- **Strong Match (70–100):** `{colors.score-high-soft}` bg, `{colors.score-high}` text
- **Partial Match (40–69):** `{colors.score-mid-soft}` bg, `{colors.score-mid}` text
- **Limited Match (0–39):** `{colors.score-low-soft}` bg, `{colors.score-low}` text
- Geometry: `{rounded.pill}`, padding 4px 12px, `{typography.caption-strong}` uppercase

### `chip-bias-flag` — Bias warning chip (signature component)

Inline chip shown in job description editors and admin bias monitor when AI flags discriminatory language.

- **Geometry:** `{rounded.pill}`, padding 6px 12px
- **Background:** `{colors.score-mid-soft}` (amber soft)
- **Text:** `{colors.score-mid}` `{typography.caption-strong}` uppercase
- **Leading icon:** Lucide alert-triangle 14px
- **Behavior:** clicking the chip opens a popover explaining the flag (e.g., "'rockstar' is gendered language often associated with male candidates. Consider 'top performer' or 'highly skilled engineer' instead.")
- **Override:** popover includes "Override flag" button which logs the override + reason to audit log

### `badge-ai-suggested` — AI prefill indicator

Tiny badge next to fields prefilled by resume parsing.

- **Geometry:** `{rounded.pill}`, padding 2px 8px
- **Background:** `{colors.primary-soft}`
- **Text:** `{colors.primary}` `{typography.caption-strong}` (12/600)
- **Leading icon:** Lucide sparkles 12px
- **Label:** "AI SUGGESTED"
- **Dismiss:** when user edits the field, badge becomes "EDITED" in `{colors.muted}` until form re-saved

### `badge-pill` — Generic uppercase label

Used for category tags ("REMOTE", "FULL-TIME", "URGENT").

- **Geometry:** `{rounded.pill}`, padding 4px 12px
- **Background:** `{colors.surface-strong}`
- **Text:** `{colors.ink}` `{typography.caption-strong}` uppercase

---

## 8. Score Ring (signature component)

The center-of-gravity component for AuraHire's thesis. Renders a candidate's Profile Score or a candidate's Match Score against a job.

### `score-ring` — Default

- **Container:** square aspect, sizes `sm` 80px, `md` 120px, `lg` 200px
- **Track:** `{colors.primary-soft}` (light blue background ring), 8px stroke (sm), 12px (md), 16px (lg)
- **Fill:** color depends on score band — `{colors.score-low}` / `{colors.score-mid}` / `{colors.score-high}`
- **Stroke style:** rounded line cap, animated 800ms ease-out on initial render
- **Center:**
  - Score number `{typography.number-large}` (sm size: number-display 18px; lg size: number-large 36px)
  - Label `{typography.caption}` `{colors.muted}` "of 100" below number
- **Variants:**
  - `score-ring-profile` — for candidate profile score (overall resume strength)
  - `score-ring-match` — for application match score against a specific job

### Hover behavior

On md/lg sizes, hovering the ring reveals a tooltip with the band label ("Strong Match • 78/100") and a "View breakdown" CTA.

---

## 9. Score Breakdown Bar (signature component)

Horizontal stacked bar showing component-level contribution to the overall score.

### `score-breakdown-bar`

- **Container:** full width of parent card, height 24px (default), 32px (large)
- **Track:** `{colors.surface-strong}` background, `{rounded.pill}`
- **Segments:** four segments side-by-side proportional to weight (Skills 40%, Experience 35%, Education 15%, Cultural Fit 10% — default weights configurable by admin)
  - Each segment fills proportional to its component score (0–100 within its weight)
  - Filled portion uses score band color; unfilled uses `{colors.surface-strong}`
  - Segments separated by 2px gap
- **Labels above bar:**
  - Component name `{typography.caption-strong}` `{colors.muted}` uppercase
  - Component score in mono `{typography.number-small}` (e.g., "28 / 40")
- **Click any segment:** opens evidence panel showing the resume excerpts that drove that component score (see `evidence-callout`)

### `score-breakdown-bar-compact` — One-line variant

For dense table rows.

- Height 8px, no labels above, full bar width 200px
- Hover reveals popover with full breakdown

---

## 10. Evidence Callout (signature component)

Quoted excerpt from a resume highlighting what drove a specific score component. Critical for explainability.

### `evidence-callout`

- **Container:** `{colors.surface-soft}` background, `{rounded.lg}`, padding `{spacing.base}`, leading 4px solid border in score band color
- **Header:** "EVIDENCE FROM RESUME" `{typography.caption-strong}` `{colors.muted}` uppercase + section reference (e.g., "Experience › Senior Engineer at Acme")
- **Quote body:** italic `{typography.body-sm}` with relevant phrases highlighted in `{colors.primary-soft}` background
- **Footer:** "Contributes +6 to Skills score" `{typography.caption}` `{colors.muted}`

Multiple callouts stack vertically inside a Score Breakdown panel.

---

## 11. Application Pipeline (signature component)

Kanban-style horizontal flow showing all applications grouped by stage.

### `pipeline-board`

- **Layout:** horizontal scroll container with 5 columns (Applied, Screening, Interview, Offer, Hired/Rejected)
- **Column header:** stage name + count chip in `{colors.muted}` background
- **Card:** `card-list-row` variant, smaller, vertical
  - Avatar + name + role
  - Compact score breakdown bar
  - Match band chip
- **Drag-and-drop:** recruiter can drag cards between stages (logs to audit)
- **Add note:** each card has menu icon → "Add recruiter note", "Schedule interview", "Reject"

### `pipeline-card-compact`

Used in candidate's "My Applications" view, no drag.

- One row per application
- Application stage shown as `chip-status`
- Click → application detail with full timeline

---

## 12. AI Shimmer (signature pattern)

The visual signal that AI is processing.

### `ai-shimmer`

- **Treatment:** subtle gradient sweep animation across a skeleton placeholder
- **Gradient:** `{colors.surface-strong}` → `{colors.surface-soft}` → `{colors.surface-strong}`, sweeping 1.5s ease-in-out infinite
- **Shape:** matches the eventual content shape (skeleton field, skeleton card, skeleton ring)
- **Caption:** above or below shimmer in `{typography.caption}` `{colors.muted}`, prefixed with Lucide sparkles 14px in `{colors.primary}`. Examples:
  - "AI is parsing your resume..."
  - "Computing your Profile Score..."
  - "Checking job description for biased language..."
  - "Generating match score and explanation..."

The AI Shimmer is **always paired with a status caption** so the user knows what's happening, never silent.

---

## 13. Toasts & Inline Alerts

### `toast` — Ephemeral notification

- **Position:** bottom-right of viewport
- **Width:** 360px
- **Background:** `{colors.canvas}`
- **Border:** 1px `{colors.hairline}`, leading 4px solid in semantic color (success/warning/danger/info)
- **Radius:** `{rounded.lg}`
- **Shadow:** `soft drop`
- **Padding:** `{spacing.base}`
- **Layout:** semantic icon (Lucide 20px) + title `{typography.title-sm}` + body `{typography.body-sm}` + close icon
- **Auto-dismiss:** 4s default, 0 (sticky) for errors

### `alert-inline` — Persistent inline alert

For form-level errors, page-level info banners.

- Same anatomy as toast but full-width within parent container
- No close icon by default (only if dismissible)

---

## 14. Modals, Sheets, Drawers

### `modal-dialog`

- **Width:** 480px (sm), 640px (md), 800px (lg)
- **Background:** `{colors.canvas}`
- **Border:** none
- **Radius:** `{rounded.xl}` corners
- **Shadow:** `0 16px 48px rgba(0, 0, 0, 0.12)`
- **Backdrop:** `rgba(0, 0, 0, 0.4)` overlay
- **Padding:** `{spacing.xl}`
- **Header:** title `{typography.title-lg}` + close icon
- **Body:** content
- **Footer:** right-aligned action buttons (cancel ghost + primary)

### `sheet-side` — Side-sliding drawer

Used for candidate detail panels, application detail, AI breakdown drilldown.

- **Width:** 480px (sm), 640px (md), 800px (lg)
- **Position:** slides from right
- **Animation:** 200ms ease-out
- **Anatomy:** sticky header (title + close) + scrollable body + sticky footer (actions)

### `popover` — Lightweight floating panel

Used by `chip-bias-flag`, `badge-ai-suggested` info, score component tooltips.

- **Width:** auto, max 320px
- **Background:** `{colors.canvas}`
- **Border:** 1px `{colors.hairline}`
- **Radius:** `{rounded.md}`
- **Shadow:** `soft drop`
- **Padding:** `{spacing.base}`
- **Arrow:** subtle 6px caret pointing to trigger

### `tooltip` — Hover help

- **Background:** `{colors.ink}`
- **Text:** `{colors.on-dark}` `{typography.caption}`
- **Radius:** `{rounded.sm}`
- **Padding:** 6px 10px
- **Show delay:** 400ms; hide instant

---

## 15. Empty States

When a list, table, or dashboard widget has no data.

### `empty-state`

- **Layout:** centered vertical
- **Illustration:** Lucide icon 48px in `{colors.muted-soft}` (e.g., briefcase for empty jobs, file-search for empty applications)
- **Headline:** `{typography.title-md}` `{colors.ink}`
- **Body:** `{typography.body-md}` `{colors.body}` (1–2 sentences)
- **Action:** primary CTA below

Examples:

- Candidate dashboard, no applications: "No applications yet" + "Browse jobs that match your profile" + CTA "Browse Jobs"
- Recruiter dashboard, no jobs posted: "Post your first job" + CTA "Create a job"
- Admin bias monitor, no flags: "No bias flags detected this period" (success-flavored, with check icon, no CTA)

---

## 16. Loading Skeletons

For non-AI loading (initial page render, paginating).

### `skeleton`

- **Background:** `{colors.surface-strong}`
- **Animation:** 1.2s ease-in-out infinite pulse (opacity 0.6 ↔ 1.0)
- **Shapes:** match eventual content (skeleton-text, skeleton-avatar circle, skeleton-card)

Distinguish from `ai-shimmer`: skeletons are silent; AI shimmer always has a caption explaining what AI is doing.

---

## 17. Hero Bands

### `hero-band-light` — White canvas hero

- **Background:** `{colors.canvas}`
- **Padding:** `{spacing.section}` (96px) vertical
- **Layout:** 12-column grid
  - Left 6 cols: badge pill ("AI-POWERED RECRUITMENT") + display headline `{typography.display-mega}` + body subhead `{typography.body-md}` + two CTAs (primary + secondary)
  - Right 6 cols: layered `card-product-ui-light` mockup stack

### `hero-band-dark` — Signature dark editorial hero

The strongest brand pattern.

- **Background:** `{colors.surface-dark}`
- **Padding:** `{spacing.section}` (96px) vertical
- **Text:** `{colors.on-dark}`
- **Layout:** mirror of `hero-band-light` but right side carries 2–3 stacked `card-product-ui-dark` mockups at slight rotation, showing Score Ring + Score Breakdown Bar with sample data
- **CTAs:** `button-primary-large` (still blue) + `button-outline-on-dark`

### `cta-band-dark` — Pre-footer dark CTA strip

- **Background:** `{colors.surface-dark}`
- **Padding:** `{spacing.section}` (96px) vertical
- **Layout:** centered headline `{typography.display-md}` + 1-line subhead + two CTAs

---

## 18. Footers

### `footer-marketing`

- **Background:** `{colors.canvas}`
- **Padding:** `{spacing.section}` vertical, `{spacing.lg}` horizontal
- **Layout:** 6-column link list (Product / Solutions / Resources / Company / Legal / Contact) + bottom strip with wordmark + copyright + social icons

### `footer-portal`

Inside authenticated portals.

- **Height:** 56px
- **Background:** `{colors.surface-soft}`
- **Border top:** 1px `{colors.hairline}`
- **Layout:** "© 2026 AuraHire" left + version tag (e.g., "v1.0.0 • Build #4e8933e") right + small "Help" link
- **Type:** `{typography.caption}` `{colors.muted}`

### `footer-link`

- **Type:** `{typography.body-sm}` `{colors.body}`
- **Hover:** `{colors.ink}`

### `legal-band`

Bottom strip below marketing footer columns. All text `{colors.muted}` `{typography.caption}`.

---

## 19. Tabs & Segmented Controls

### `tabs-line` — Underlined tabs

For switching between views inside a page (e.g., candidate profile: Overview / Applications / Resume).

- **Container:** flex row, border-bottom 1px `{colors.hairline}`
- **Tab item:** padding 12px 16px, `{typography.body-md}` `{colors.body}` → active `{colors.ink}` with 2px `{colors.primary}` bottom border
- **Hover:** text → `{colors.ink}`

### `segmented-control` — Pill segmented selector

For filtering (e.g., "All / Applied / Screening / Hired").

- **Container:** `{colors.surface-strong}` background, `{rounded.pill}`, padding 4px
- **Segment:** `{rounded.pill}`, padding 6px 16px, `{typography.button-sm}`, default `{colors.body}`, active `{colors.canvas}` background + `{colors.ink}` text + soft drop shadow

---

## 20. Responsive Behavior

### Breakpoints

| Name    | Width       | Marketing                                                                           | Portal                                                           |
| ------- | ----------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Mobile  | < 640px     | Hero h1 80→40px; hero mockup → single card; feature grid 1-up; footer single column | Sidebar → drawer; topbar simplified; tables → vertical card list |
| Tablet  | 640–1024px  | Hero h1 64px; feature grid 2-up; mockup 2 stacked                                   | Sidebar drawer; topbar full; tables compress                     |
| Desktop | 1024–1280px | Full editorial hero 80px; feature grid 3-up                                         | Persistent sidebar 256px; full topbar                            |
| Wide    | > 1280px    | Content caps at 1200px; hero photography full-bleed                                 | Content max-width 1280px                                         |

### Touch Targets

- Primary CTA pill at 44px height — WCAG AAA
- Hero CTA pill at 56px — exceeds AAA
- Icon buttons at 36px (min hit area expanded to 44px via padding) — meets AA
- Search pill at 44px — at AAA
- Sidebar nav item at 44px — at AAA

### Collapsing Strategy

- Top nav switches to hamburger sheet below 768px. Sign Up CTA remains visible.
- Hero h1 steps: 80 → 64 → 52 → 44 → 36 on smallest screens.
- Layered product-UI mockup cards collapse from 2–3 stacked → single card on mobile.
- Pipeline board: horizontal scroll on mobile (each column min-width 280px).
- Score Ring: lg → md → sm at narrower viewports.
- Score Breakdown Bar: full layout → compact (no labels above) → tap to reveal popover.
- Tables: convert to vertically stacked cards (each row becomes a card with label-value pairs).

---

## 21. Iteration Guide

1. New CTAs default to `{rounded.pill}` (100px); new icon plates default to `{rounded.full}`. Cards use `{rounded.lg}` (portal) or `{rounded.xl}` (marketing).
2. All variants live as separate entries, not as multi-color toggles.
3. Use `{token.refs}` everywhere — never inline hex.
4. Hover state never documented exhaustively; rule is "background darkens 4–8% or moves up one elevation tier."
5. Inter at 400 for display, 400/500/600 for body; JetBrains Mono on every number.
6. AuraHire Blue stays scarce — one or two blue moments per band.
7. Score Ring + Score Breakdown Bar + Evidence Callout always travel together when explaining a score. Never show a number alone without click-through to breakdown.

---

## 22. Known Gaps

- Component dark-mode variants (beyond marketing dark hero) are out of sprint scope.
- Print stylesheet not specified.
- Advanced data visualizations (e.g., funnel charts on dashboards) use Recharts defaults adapted to AuraHire color tokens — no custom chart-component spec in this version.
- Animation timings beyond hover, AI shimmer, Score Ring fill, modal enter are intentionally unspecified.
