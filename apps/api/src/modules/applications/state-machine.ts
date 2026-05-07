import type { ApplicationStatus } from "@aurahire/shared";

const VALID_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  applied:   ["screening", "interview", "rejected", "withdrawn"],
  screening: ["interview",              "rejected", "withdrawn"],
  interview: ["offer",                  "rejected", "withdrawn"],
  offer:     ["hired",                  "rejected", "withdrawn"],
  hired:     [],
  rejected:  [],
  withdrawn: [],
};

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
