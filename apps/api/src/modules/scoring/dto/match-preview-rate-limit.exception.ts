import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Thrown by `ScoringService.computeMatchPreviewOnView` when a candidate has
 * exhausted their per-UTC-day allowance of on-view auto-computes.
 *
 * Body shape (`{ code: "DAILY_AI_LIMIT", cap }`) is consumed by the candidate
 * job-detail page so the UI can render "you've checked a lot of jobs today —
 * existing matches still load instantly" without leaking implementation
 * details. The 429 status lets ordinary HTTP retry layers back off on their
 * own.
 *
 * Distinct from `RATE_LIMITED` (per-minute throttle on manual recompute) —
 * this gate exists strictly to bound AI spend on the buttonless on-view path.
 */
export class MatchPreviewRateLimitException extends HttpException {
  constructor(cap: number) {
    super({ code: "DAILY_AI_LIMIT", cap }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
