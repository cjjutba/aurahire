import type { ApplicationStatus } from "@aurahire/shared";

// Per thesis panel revision (May 2026), "screening" was removed from the
// application status funnel. The pipeline collapses to:
//   applied → interview → offer → offer_accepted → hired
// with branches to rejected / withdrawn at every actionable stage.
const VALID_TRANSITIONS: Record<
  ApplicationStatus,
  readonly ApplicationStatus[]
> = {
  applied: ["interview", "rejected", "withdrawn"],
  interview: ["offer", "rejected", "withdrawn"],
  // Recruiter waits for the candidate at "offer". The recruiter can still
  // reject or the candidate can withdraw. Direct offer → hired is removed
  // because the candidate decision must precede the recruiter decision.
  offer: ["offer_accepted", "offer_declined", "rejected", "withdrawn"],
  // Candidate accepted; recruiter now decides Hired vs Not Hired.
  offer_accepted: ["hired", "rejected", "withdrawn"],
  offer_declined: ["offer", "rejected", "withdrawn"],
  hired: [],
  rejected: [],
  withdrawn: [],
};

/**
 * Statuses that require a separate semantic check beyond the state machine —
 * specifically that the application has an accepted offer attached. Today only
 * `hired` qualifies. Used by ApplicationsService.hire() and updateStatus().
 */
export const STATUSES_REQUIRING_ACCEPTED_OFFER: readonly ApplicationStatus[] = [
  "hired",
];

export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextStatuses(
  from: ApplicationStatus,
): readonly ApplicationStatus[] {
  return VALID_TRANSITIONS[from] ?? [];
}
