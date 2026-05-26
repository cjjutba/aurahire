/**
 * Identity-reveal policy for recruiter-side views.
 *
 * Thesis panel revision (May 2026): candidate PII (name, email, phone,
 * raw evidence excerpts) is HIDDEN from the recruiter until an interview
 * has been completed. After completion the recruiter sees the full
 * profile; this matches the same trigger that unlocks the resume download.
 *
 * This module is the SINGLE source of truth for that policy. Both the
 * applications-list redactor and the resume-download guard call into it.
 *
 * Reveal is one-way: once the predicate flips to true (a completed
 * interview exists), it stays true even if the recruiter later marks the
 * application back to "applied". Reasoning: the recruiter has already met
 * the candidate; un-hiding is not meaningful from an information-theory
 * standpoint.
 *
 * Candidates always see their own data (full); admins always see full PII
 * regardless of interview state (auditing requires it).
 */
import type { ApplicationStatus } from "@aurahire/shared";

/**
 * Statuses where the recruiter has clearly progressed past the
 * "anonymous screen" stage and needs candidate identity to fulfil
 * subsequent steps (offer letter, hire processing, decision letter).
 */
const FULL_REVEAL_STATUSES = new Set<ApplicationStatus>([
  "offer",
  "offer_accepted",
  "offer_declined",
  "hired",
]);

/**
 * Compute whether a recruiter is authorized to see the candidate's
 * identity for a given application.
 *
 * @param applicationStatus current value of `applications.status`
 * @param interviewStatuses the `status` value of every interview on this
 *   application (typically read from `interviews.status` joined or
 *   pre-loaded by the caller)
 */
export function isIdentityRevealedForRecruiter(
  applicationStatus: ApplicationStatus,
  interviewStatuses: ReadonlyArray<string>,
): boolean {
  if (FULL_REVEAL_STATUSES.has(applicationStatus)) return true;
  return interviewStatuses.some((s) => s === "completed");
}

/**
 * Generates a stable anonymized handle for a candidate based on their
 * application id. Same input always returns the same string so the UI
 * can render lists deterministically. Format: "Candidate #ab12cd34" (8
 * hex chars from the application UUID).
 */
export function anonymizedCandidateHandle(applicationId: string): string {
  // Take the first 8 hex chars of the UUID (skipping the "-" separator);
  // 32^8 is plenty for visual distinctness within a recruiter pipeline.
  const hex = applicationId.replace(/-/g, "").slice(0, 8);
  return `Candidate #${hex}`;
}
