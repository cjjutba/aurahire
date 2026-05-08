// Proactive-system runtime config defaults.
//
// These keys back the 2026-05-08 "proactive system" slice (Phase 1 of the
// onboarding-autoscore + buttonless-match design). They live alongside the
// other tunable defaults in `score-thresholds.ts` and `ai-limits.ts` rather
// than as columns on `scoring_config` because:
//
//   1. They control downstream behavior (cron lead-time, on-view daily caps,
//      onboarding wallclock budgets) — not the scoring math itself, which is
//      what the structured `scoring_config` table is for.
//   2. They're read at call-sites that don't otherwise need to hit the DB
//      (cron schedulers, on-view rate-limit checks). Keeping them as static
//      constants avoids a per-call round-trip.
//
// Admin tunability lands in a later slice; for now these are read-only
// defaults the engine consumes directly.

/**
 * Per-candidate per-day cap for on-view match-preview computes.
 *
 * Each time a candidate views a job detail page we may auto-compute a match
 * preview against their default resume. To keep AI spend bounded — and to
 * avoid a hostile candidate burning budget by hammering refresh — we cap
 * computes at 100 per UTC day per candidate. The 101st view in the same day
 * renders the existing preview if one exists, otherwise the no-preview
 * placeholder.
 */
export const ONVIEW_DAILY_CAP = 100;

/**
 * Maximum wallclock budget (ms) we let the onboarding "Analyzing your resume"
 * screen wait before falling through to the dashboard. The candidate sees a
 * shimmer while parse + Profile Score complete in the background; if either
 * takes longer than 10s we don't block onboarding completion.
 */
export const ANALYZING_SCREEN_WALLCLOCK_MS = 10_000;

/**
 * Lead time (hours) for the 24-hour interview reminder cron. The cron scans
 * for interviews scheduled within `now + this many hours` and dispatches a
 * single reminder email + in-app notification per interview.
 */
export const INTERVIEW_REMINDER_LEAD_HOURS = 24;

/**
 * Lead time (hours) for the offer-expiring-soon warning cron. When an offer
 * is within this window of its `expiresAt`, the cron fires a warning to the
 * candidate (and a heads-up to the recruiter) so neither side is blindsided
 * by an expiry.
 */
export const OFFER_EXPIRY_WARNING_LEAD_HOURS = 24;

/**
 * Lead time (hours) after an interview ends before we nudge the recruiter to
 * submit feedback. Distinct from the legacy "feedback due" notification —
 * this is the periodic nag the proactive-system slice introduces.
 */
export const FEEDBACK_REMINDER_LEAD_HOURS = 24;

/**
 * How many top-ranked recommended jobs to precompute match previews for
 * after a candidate's resume parses. Bounds AI spend at onboarding while
 * keeping the "Recommended for you" feed populated.
 */
export const PRECOMPUTE_TOP_N = 25;
