// AI/processing limits — sprint defaults.

export const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_RESUME_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const AI_TIMEOUT_MS = 30_000; // 30 s for parse / score
export const AI_RETRY_COUNT = 1;
export const SCORE_RECOMPUTE_COOLDOWN_MS = 60_000; // 1 min per user
export const RESUME_UPLOAD_RATE_LIMIT_PER_HOUR = 5;

export const DEFAULT_AI_MODEL = "gpt-4o-mini";
