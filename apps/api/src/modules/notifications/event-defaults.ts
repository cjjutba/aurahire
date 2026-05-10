import type { NotificationEventType, NotificationMode } from "@aurahire/db";

export const DEFAULT_MODES: Record<NotificationEventType, NotificationMode> = {
  application_status_changed: "instant",
  interview_scheduled: "instant",
  interview_reminder_24h: "instant",
  interview_cancelled: "instant",
  offer_received: "instant",
  offer_expiring_soon: "instant",
  new_application_received: "digest",
  candidate_withdrew: "instant",
  interview_feedback_due: "instant",
  interview_feedback_shared: "instant",
  interview_rescheduled: "instant",
  interview_completed: "instant",
  interview_record_feedback: "instant",
  application_withdrawn: "instant",
  offer_accepted: "instant",
  offer_declined: "instant",
  offer_expired: "instant",
  job_archived_by_deadline: "digest",
  bias_flag_raised: "instant",
  team_invite_accepted: "digest",
  team_invite_declined: "digest",
  system_bias_flag_raised: "instant",
  system_ai_scoring_failure: "instant",
  system_moderation_queue_item: "digest",
  account_password_reset: "instant",
  account_email_verified: "instant",
  account_login_new_device: "instant",
};

export const SECURITY_EVENTS: ReadonlySet<NotificationEventType> = new Set([
  "account_password_reset",
  "account_email_verified",
  "account_login_new_device",
  "offer_expiring_soon",
]);

export type EventCategory =
  | "account"
  | "applications"
  | "interviews"
  | "offers"
  | "jobs"
  | "bias"
  | "team"
  | "system";

export const EVENT_CATEGORIES: Record<NotificationEventType, EventCategory> = {
  application_status_changed: "applications",
  new_application_received: "applications",
  candidate_withdrew: "applications",
  interview_scheduled: "interviews",
  interview_reminder_24h: "interviews",
  interview_cancelled: "interviews",
  interview_feedback_due: "interviews",
  interview_feedback_shared: "interviews",
  interview_rescheduled: "interviews",
  interview_completed: "interviews",
  interview_record_feedback: "interviews",
  application_withdrawn: "applications",
  offer_received: "offers",
  offer_expiring_soon: "offers",
  offer_accepted: "offers",
  offer_declined: "offers",
  offer_expired: "offers",
  job_archived_by_deadline: "jobs",
  bias_flag_raised: "bias",
  team_invite_accepted: "team",
  team_invite_declined: "team",
  system_bias_flag_raised: "system",
  system_ai_scoring_failure: "system",
  system_moderation_queue_item: "system",
  account_password_reset: "account",
  account_email_verified: "account",
  account_login_new_device: "account",
};

export const ROLE_VISIBLE_EVENTS: Record<
  "candidate" | "recruiter" | "admin",
  ReadonlyArray<NotificationEventType>
> = {
  candidate: [
    "application_status_changed",
    "interview_scheduled",
    "interview_rescheduled",
    "interview_reminder_24h",
    "interview_cancelled",
    "interview_completed",
    "interview_feedback_shared",
    "offer_received",
    "offer_expiring_soon",
    "offer_expired",
    "account_password_reset",
    "account_email_verified",
    "account_login_new_device",
  ],
  recruiter: [
    "new_application_received",
    "candidate_withdrew",
    "application_withdrawn",
    "interview_feedback_due",
    "interview_record_feedback",
    "offer_accepted",
    "offer_declined",
    "offer_expired",
    "bias_flag_raised",
    "job_archived_by_deadline",
    "team_invite_accepted",
    "team_invite_declined",
    "account_password_reset",
    "account_email_verified",
    "account_login_new_device",
  ],
  admin: [
    "system_bias_flag_raised",
    "system_ai_scoring_failure",
    "system_moderation_queue_item",
    "team_invite_accepted",
    "team_invite_declined",
    "account_password_reset",
    "account_email_verified",
    "account_login_new_device",
  ],
};

export const EVENT_LABELS: Record<NotificationEventType, string> = {
  application_status_changed: "Application status changed",
  interview_scheduled: "Interview scheduled",
  interview_reminder_24h: "Interview tomorrow reminder",
  interview_cancelled: "Interview cancelled",
  offer_received: "Offer received",
  offer_expiring_soon: "Offer expiring within 24 hours",
  new_application_received: "New application received",
  candidate_withdrew: "Candidate withdrew",
  interview_feedback_due: "Interview feedback due",
  interview_feedback_shared: "Interview feedback shared with you",
  interview_rescheduled: "Interview rescheduled",
  interview_completed: "Interview completed",
  interview_record_feedback: "Interview feedback required",
  application_withdrawn: "Candidate withdrew application",
  offer_accepted: "Offer accepted by candidate",
  offer_declined: "Offer declined by candidate",
  offer_expired: "Offer expired",
  job_archived_by_deadline: "Job auto-archived past deadline",
  bias_flag_raised: "Bias flag on your job description",
  team_invite_accepted: "Team invite accepted",
  team_invite_declined: "Team invite declined",
  system_bias_flag_raised: "Bias flag raised system-wide",
  system_ai_scoring_failure: "AI scoring failure",
  system_moderation_queue_item: "Moderation queue item",
  account_password_reset: "Password reset confirmation",
  account_email_verified: "Email verification confirmation",
  account_login_new_device: "Login from a new device",
};

export const EVENT_DESCRIPTIONS: Record<NotificationEventType, string> = {
  application_status_changed:
    "Your application moves to Screening, Interview, Offer, Hired, or Rejected.",
  interview_scheduled: "A recruiter scheduled an interview with you.",
  interview_reminder_24h: "An interview starts within 24 hours.",
  interview_cancelled: "A scheduled interview was cancelled.",
  offer_received: "A recruiter sent you a job offer.",
  offer_expiring_soon:
    "An offer expires within 24 hours. Required for security — cannot be disabled.",
  new_application_received: "A candidate applied to a job you own.",
  candidate_withdrew:
    "A candidate withdrew their application from a job you own.",
  interview_feedback_due: "Feedback for an interview you ran is overdue.",
  interview_feedback_shared:
    "A recruiter shared their interview feedback summary with you.",
  interview_rescheduled:
    "A recruiter rescheduled your interview to a new time.",
  interview_completed:
    "An interview you participated in has been marked as completed.",
  interview_record_feedback:
    "An interview you conducted is awaiting your feedback submission.",
  application_withdrawn:
    "A candidate withdrew their application from a job you own.",
  offer_accepted: "A candidate accepted your offer.",
  offer_declined: "A candidate declined your offer.",
  offer_expired: "A pending offer expired before it was responded to.",
  job_archived_by_deadline:
    "A published job was auto-archived because its application deadline passed.",
  bias_flag_raised:
    "Bias detection flagged language on a job description you published.",
  team_invite_accepted: "A team member you invited accepted.",
  team_invite_declined: "A team member you invited declined.",
  system_bias_flag_raised:
    "Bias detection flagged a job description anywhere on the platform.",
  system_ai_scoring_failure:
    "An AI scoring job failed and needs investigation.",
  system_moderation_queue_item: "A new item entered the moderation queue.",
  account_password_reset:
    "Your password was changed. Required for security — cannot be disabled.",
  account_email_verified:
    "Your email address was verified. Required for security — cannot be disabled.",
  account_login_new_device:
    "A login was detected from a device fingerprint we haven't seen. Required for security — cannot be disabled.",
};
