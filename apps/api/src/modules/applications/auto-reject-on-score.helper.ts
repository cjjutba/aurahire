/**
 * Score-based auto-rejection helper.
 *
 * Thesis panel revision (May 2026): "Only applicants with a score of 75
 * and above should proceed to the interview, while those below 75 will
 * be automatically rejected." This helper centralizes that policy so the
 * SYNC scoring path (preview promotion at apply time) and the ASYNC
 * worker (BullMQ match-score processor) cannot drift.
 *
 * The threshold is admin-tunable via
 * `scoring_config.auto_reject_threshold` (default 75). The constant
 * `AUTO_REJECT_THRESHOLD` in `@aurahire/shared` is the boot-time fallback
 * if no active scoring config row exists yet.
 *
 * Idempotency: only transitions an application currently in `applied`.
 * If the recruiter has already moved it past `applied` (e.g., manually
 * to interview before the async worker landed the score), we leave it
 * alone — the recruiter's action wins.
 *
 * Defense in depth: the interview scheduling endpoint independently
 * re-checks the threshold (`apps/api/src/modules/interviews/interviews.service.ts`).
 * If both fire, this helper is the cleanup path; if only the gate fires,
 * the rejection still lands on the next scoring iteration.
 */
import type { Logger } from "@nestjs/common";

export interface AutoRejectDeps {
  /**
   * Used to fetch the current application status (idempotency check) and
   * to run the status transition through the same state machine the
   * recruiter uses. Caller injects a service handle to avoid a circular
   * dependency between the applications and scoring modules.
   */
  applicationsService: {
    findStatus: (
      applicationId: string,
    ) => Promise<{
      candidateId: string;
      jobId: string;
      status: string;
    } | null>;
    transitionFromSystem: (
      applicationId: string,
      toStatus: "rejected",
      args: {
        reason: "auto_rejected_low_score";
        details: { overallScore: number; threshold: number };
      },
    ) => Promise<void>;
  };
  logger: Logger;
}

export interface AutoRejectResult {
  rejected: boolean;
  reason?: "already_advanced" | "score_meets_threshold" | "no_application";
}

export async function maybeAutoRejectByScore(
  deps: AutoRejectDeps,
  args: {
    applicationId: string;
    overallScore: number;
    threshold: number;
  },
): Promise<AutoRejectResult> {
  const { applicationId, overallScore, threshold } = args;

  if (overallScore >= threshold) {
    return { rejected: false, reason: "score_meets_threshold" };
  }

  const app = await deps.applicationsService.findStatus(applicationId);
  if (!app) {
    deps.logger.warn(
      `[auto-reject-on-score] application ${applicationId} not found; skipping`,
    );
    return { rejected: false, reason: "no_application" };
  }
  if (app.status !== "applied") {
    deps.logger.log(
      `[auto-reject-on-score] application ${applicationId} is already at status='${app.status}'; skipping (recruiter action wins)`,
    );
    return { rejected: false, reason: "already_advanced" };
  }

  await deps.applicationsService.transitionFromSystem(applicationId, "rejected", {
    reason: "auto_rejected_low_score",
    details: { overallScore, threshold },
  });

  deps.logger.log(
    `[auto-reject-on-score] application ${applicationId} auto-rejected — score=${overallScore} < threshold=${threshold}`,
  );
  return { rejected: true };
}
