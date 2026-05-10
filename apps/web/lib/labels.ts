import type { ApplicationStatus, UserRole } from "@aurahire/shared";

/**
 * Display strings for application statuses. Use when surfacing a status value
 * to end users (e.g. toast descriptions, button labels). Keys mirror the
 * API enum; values are sentence-case nouns suitable for inline use.
 */
export const APPLICATION_STATUS_DISPLAY: Record<ApplicationStatus, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  offer_declined: "Offer Declined",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

/**
 * Display strings for user roles. Use when surfacing a role value to end
 * users (e.g. toast descriptions, role-change confirmations).
 */
export const USER_ROLE_DISPLAY: Record<UserRole, string> = {
  candidate: "Candidate",
  recruiter: "Recruiter",
  admin: "Admin",
};
