import type { ApplicationStatus } from "@aurahire/shared";

const VALID_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  applied:        ["screening", "interview", "rejected", "withdrawn"],
  screening:      ["interview",              "rejected", "withdrawn"],
  interview:      ["offer",                  "rejected", "withdrawn"],
  offer:          ["hired", "offer_declined", "rejected", "withdrawn"],
  offer_declined: ["offer",                   "rejected", "withdrawn"],
  hired:          [],
  rejected:       [],
  withdrawn:      [],
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
