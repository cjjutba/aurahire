export const RESCORE_BATCH_QUEUE = "rescore-batch";

/**
 * Queue for auto-computing match-score previews after a candidate's resume
 * is parsed. One job per resume parse; the worker fans out to N jobs
 * sequentially (rate-limited to keep OpenAI costs predictable).
 */
export const MATCH_PREVIEW_PRECOMPUTE_QUEUE = "match-preview-precompute";

/** How many top jobs to auto-score per resume parse. */
export const MATCH_PREVIEW_TOP_N = 5;

/**
 * Queue for the per-application match-score job kicked off by
 * ApplicationsService.apply(). One job per application; the worker computes
 * redaction + match scoring + persistence + emits application.scored over
 * the existing realtime gateway when complete.
 */
export const MATCH_SCORE_QUEUE = "match-score";

/**
 * Queue for recomputing a candidate's Profile Score after the inputs that
 * feed it change (default resume swap, profile edit, preferences edit).
 * One job per recompute; the worker writes a fresh profile_scores row and
 * the previous row is left as-is with stale_at set by the caller. Task 9
 * registers the processor against this same constant.
 */
export const PROFILE_SCORE_RECOMPUTE_QUEUE = "profile-score-recompute";
