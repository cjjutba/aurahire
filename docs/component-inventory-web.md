# Component Inventory — Web (`apps/web`)

> Part: **web** · Brownfield deep-scan by `[DP] Document Project` · 2026-06-10 · Index: [index.md](./index.md) · See [Architecture — Web](./architecture-web.md)

Reusable components live under `apps/web/components/`; per-route interactivity lives in co-located `_*-client.tsx` islands inside `app/` (~111 of them).

## UI primitives — `components/ui/` (Base UI + CVA + `cn`)
`button.tsx`, `button-spinner.tsx`, `card.tsx`, `badge.tsx`, `avatar.tsx`, `separator.tsx`, `skeleton.tsx`, `dialog.tsx`, `sheet.tsx`, `popover.tsx`, `tooltip.tsx`, `dropdown-menu.tsx`, `confirm-dialog.tsx`, `input.tsx`, `textarea.tsx`, `checkbox.tsx`, `select.tsx`, `label.tsx`, `form.tsx` (RHF bridge), `table.tsx`, `pagination.tsx`, `clickable-row.tsx`, `sonner.tsx` (Toaster; only `next-themes` consumer).

## Layout / Shell — `components/layout/`
`portal-shell.tsx` (sidebar + mobile drawer frame for all three portals), `portal-sidebar.tsx` (256px sidebar; drawer < 1024px), `marketing-nav.tsx`, `marketing-footer.tsx`, `company-switcher.tsx`, `company-switch-overlay.tsx`, `company-create-dialog.tsx`, `accept-invitation-dialog.tsx`.

## Navigation / Portal — `components/portal/`
`sidebar-bottom-rail.tsx`, `sidebar-profile-popover.tsx`, `sidebar-notifications-popover.tsx` (realtime notifications), `anon-avatar.tsx` (anonymized candidate avatar — bias mitigation), `recruiter-fairness-banner.tsx`, `below-threshold-notice.tsx`, `feedback-modal-client.tsx`. Plus `components/brand/brand-wordmark.tsx`, top-level `components/empty-state.tsx`.

## Forms
- **Auth** (`components/auth/`): `login-form`, `register-candidate-form`, `register-recruiter-form`, `forgot-password-form`, `reset-password-form`, `resend-verification-button` + scaffolding (`auth-shell`, `auth-input`, `auth-footer`, `auth-role-card`, `auth-role-tag`).
- **Settings** (`components/settings/`): `candidate-profile-form`, `recruiter-profile-form`, `company-form`, `notifications-form`, `security-form`, `privacy-section`, `danger-zone`, `members-table`, `members-invite-dialog`, `members-row-actions` + rails/cards.
- **Jobs** (`components/jobs/`): `job-form.tsx` (drives Tiptap editor + bias check).
- **Onboarding** (`components/onboarding/`): candidate `personal-info-form`, `preferences-form`; recruiter `about-form`, `company-form`, `company-create-form`, `focus-form`; autosave/protection hooks `use-autosave`, `use-tab-close-protection`, `save-status-indicator`.

## Score / AI surfaces
- **Score** (`components/score/`): `score-ring.tsx`, `score-breakdown-bar.tsx`, `evidence-callout.tsx`, `match-band-chip.tsx`, `score-dashboard.tsx`, `apply-match-summary.tsx`.
- **AI affordances** (`components/ai/`): `ai-shimmer.tsx`, `ai-suggested-badge.tsx` ("AI SUGGESTED"/"EDITED"), `ai-progress-indicator.tsx`.

## Domain / feature components
- **Jobs**: `job-card.tsx`, `job-list-row.tsx`, `job-detail.tsx`, `job-filters.tsx`, `job-status-chip.tsx`, `rich-text-content.tsx`, `tiptap-editor.tsx`, `_bias-highlight-extension.ts`, `_use-debounced-bias-check.ts`.
- **Bias** (`components/bias/`): `bias-flag-chip.tsx`, `bias-flags-list.tsx`, `bias-override-modal.tsx`. Admin oversight (`components/admin/`): `audit-trail-timeline.tsx`, `raw-output-json-viewer.tsx`, `redacted-resume-preview.tsx`.
- **Interviews** (`components/interview/`): `add-to-calendar-button.tsx`, `reschedule-modal-client.tsx`, `share-feedback-modal-client.tsx`, `withdraw-application-modal.tsx`.
- **Invite** (`components/invite/`): `invite-preview-card.tsx`, `invite-error-card.tsx`.
- **Onboarding resume-preview** (`components/onboarding/`): `resume-upload-card`, `resume-stale-recovery-card`, `parsing-progress-card`, `low-confidence-banner`, `profile-preview-pane`, `onboarding-shell`, `onboarding-progress`, `mobile/resume-sheet`; review cards `review/{experience-card,experience-list,education-card,education-list,skills-cloud,review-step}`; PDF-highlight subsystem `resume-preview/` (`pdf-renderer` [pdfjs], `linearized-resume-view`, `highlight-overlay`, `highlight-context`, `resume-preview-pane` + pure helpers `derive-highlights`, `find-text-spans`).
- **Applications / pipeline:** no kanban — application UI is per-route co-located islands under `app/.../applications/` (~29 `_*-client.tsx`, e.g. recruiter `_decision-panel-client`, `_schedule-interview-sheet-client`, `_offer-confirm-modal-client`, `_shortlist-button-client`, `_notes-section-client`). Reusable score/chip pieces come from `components/score` + `components/jobs`.

## Charts — Recharts (co-located admin islands)
`app/(admin)/admin/analytics/_charts-client.tsx`, `app/(admin)/admin/bias-monitor/_flag-breakdown-chart-client.tsx`, `_score-distribution-audit-client.tsx`.

## Content-only modules (typed content + renderer)
`components/help/` (`help-view`, `help-block`, `help-types` + `content/{candidate,recruiter,admin}-content`), `components/how-it-works/` (same shape), `components/legal/` (`legal-view`, `legal-block`, `legal-types` + `content/{privacy,terms}-content`).
