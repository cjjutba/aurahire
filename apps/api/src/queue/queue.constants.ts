export const RESCORE_BATCH_QUEUE = "rescore-batch";

/**
 * Queue for auto-computing match-score previews after a candidate's resume
 * is parsed. One job per resume parse; the worker fans out to N jobs
 * sequentially (rate-limited to keep OpenAI costs predictable).
 */
export const MATCH_PREVIEW_PRECOMPUTE_QUEUE = "match-preview-precompute";

/** How many top jobs to auto-score per resume parse. */
export const MATCH_PREVIEW_TOP_N = 5;
