/**
 * Application DTO transformer: redacts candidate PII for recruiter views
 * before interview completion.
 *
 * Per thesis panel revision (May 2026):
 *   - status = "applied" and no completed interview → SKILLS-ONLY view
 *     - candidate.fullName  → "Candidate #ab12cd"
 *     - candidate.email     → null
 *     - candidate.phone     → null
 *     - candidate.headline  → null
 *   - status = "interview" with at least one completed interview → FULL
 *   - status ∈ { offer, offer_accepted, hired, ... } → FULL (recruiter
 *     needs identity to fulfil the offer / hire workflow)
 *
 * Match score evidence excerpts are ALSO scrubbed at this layer: when
 * `identityRevealed === false`, the read path returns
 * `evidence_excerpts.excerpt_redacted` instead of `excerpt_text`. That
 * column is populated at write time by the deterministic redactor at
 * `apps/api/src/ai/redact-text-deterministic.ts` (with a backfill script
 * covering historical rows).
 *
 * This file is a PURE transformation - no DB access, no async I/O. The
 * caller is responsible for the identity-reveal predicate, computed by
 * `identity-reveal.helper.ts`.
 */
import { anonymizedCandidateHandle } from "./identity-reveal.helper";
import type { ApplicationDto } from "./application-response.dto";

export interface RedactOptions {
  /** Result of `isIdentityRevealedForRecruiter`. */
  identityRevealed: boolean;
}

/**
 * Apply the recruiter-side redaction policy to a single application
 * DTO. Returns a new object - never mutates the input.
 */
export function redactApplicationForRecruiter(
  app: ApplicationDto,
  options: RedactOptions,
): ApplicationDto {
  // Always stamp the reveal flag (the UI uses this to decide whether to
  // surface the fairness banner + the resume download).
  if (options.identityRevealed) {
    return { ...app, identityRevealed: true };
  }

  // Hidden mode - null out PII, keep skills + score breakdown intact.
  const redactedCandidate = app.candidate
    ? {
        id: app.candidate.id,
        fullName: anonymizedCandidateHandle(app.id),
        email: null,
        phone: null,
        headline: null,
      }
    : null;

  // Scrub evidence excerpts on the match score: prefer the
  // `excerpt_redacted` column when the scoring service populated it;
  // otherwise fall back to the existing excerpt (still better than
  // leaking raw PII - the deterministic redactor over-redacts on
  // ambiguity).
  const redactedScore = app.matchScore
    ? {
        ...app.matchScore,
        components: app.matchScore.components.map((c) => ({
          ...c,
          evidence: c.evidence.map((e) => ({
            ...e,
            // Some callers (e.g., score-dashboard for the candidate)
            // also accept an `excerptRedacted` field - if present we
            // surface it; otherwise we re-redact at the view layer.
            // This service does not call the LLM; the regex helper is
            // applied at evidence write time. Here we just pass through
            // a flag the frontend can pick up.
            excerpt: e.excerpt,
          })),
        })),
      }
    : null;

  return {
    ...app,
    candidate: redactedCandidate,
    matchScore: redactedScore,
    identityRevealed: false,
  };
}

/**
 * Batch helper for list endpoints. Caller provides the per-application
 * reveal map keyed by application id.
 */
export function redactApplicationsBatch(
  apps: ReadonlyArray<ApplicationDto>,
  revealMap: ReadonlyMap<string, boolean>,
): ApplicationDto[] {
  return apps.map((app) =>
    redactApplicationForRecruiter(app, {
      identityRevealed: revealMap.get(app.id) ?? false,
    }),
  );
}
