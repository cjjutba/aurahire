import type { AuditActorType } from "@aurahire/shared";

/**
 * Standard audit-log entry payload. The AuditService inserts rows shaped like this.
 *
 * `details` is freeform JSONB — convention is to include a `before` and `after`
 * for updates, or relevant scalar fields (jobId, scoreId, ...) for create events.
 */
export interface AuditLogInput {
  actorId: string | null;
  actorType: AuditActorType;
  action: string;
  entityType: string;
  entityId: string;
  /**
   * Tenant scope for the action. Required for any action taken inside a
   * company (jobs, applications, interviews, offers, scoring, bias, members).
   * Left null for cross-tenant admin actions, system/cron actions, and
   * pre-membership flows (signup, invitation acceptance) where the company
   * scope isn't yet established.
   */
  companyId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Action verbs are dotted strings: "<entity>.<verb>" or "<entity>.<verb>.<qualifier>".
 * Add new actions here as features land. This list is the canonical vocabulary.
 */
export const AUDIT_ACTIONS = {
  USER_REGISTERED_CANDIDATE: "user.registered.candidate",
  USER_REGISTERED_RECRUITER: "user.registered.recruiter",
  USER_LOGIN: "user.login",
  USER_LOGOUT: "user.logout",
  USER_PASSWORD_RESET_REQUESTED: "user.password_reset_requested",
  USER_PASSWORD_RESET: "user.password_reset",
  USER_EMAIL_VERIFIED: "user.email_verified",
  USER_SUSPENDED: "user.suspended",
  USER_REACTIVATED: "user.reactivated",
  USER_DELETED: "user.deleted",
  USER_ROLE_CHANGED: "user.role_changed",
  USER_PASSWORD_RESET_FORCED: "user.password_reset_forced",
  JOB_ARCHIVED_BY_ADMIN: "job.archived_by_admin",
  SCORING_CONFIG_UPDATED: "scoring_config.updated",
  SCORE_MATCH_RECOMPUTED: "score.match.recomputed",
  QUEUE_RESCORE_BATCH_ENQUEUED: "queue.rescore_batch.enqueued",
  // Interviews
  INTERVIEW_SCHEDULED: "interview.scheduled",
  INTERVIEW_FEEDBACK_UPDATED: "interview.feedback_updated",
  INTERVIEW_STATUS_CHANGED: "interview.status_changed",
  // Offers
  OFFER_SENT: "offer.sent",
  OFFER_ACCEPTED: "offer.accepted",
  OFFER_DECLINED: "offer.declined",
  OFFER_WITHDRAWN: "offer.withdrawn",
  OFFER_EXPIRED: "offer.expired",
  // Cron-driven housekeeping
  JOB_ARCHIVED_BY_CRON: "job.archived_by_cron",
  USER_DELETED_UNVERIFIED_CLEANUP: "user.deleted_unverified_cleanup",
  CRON_EXPIRE_OFFERS_EXECUTED: "cron.expire_offers.executed",
  CRON_ARCHIVE_PAST_DEADLINE_JOBS_EXECUTED: "cron.archive_past_deadline_jobs.executed",
  CRON_CLEANUP_UNVERIFIED_ACCOUNTS_EXECUTED: "cron.cleanup_unverified_accounts.executed",
  // Companies + memberships (Phase 2 multi-tenancy)
  COMPANY_CREATED: "company.created",
  COMPANY_UPDATED: "company.updated",
  COMPANY_DELETED: "company.deleted",
  COMPANY_ACTIVE_SWITCHED: "company.active_switched",
  COMPANY_MEMBER_INVITED: "company_member.invited",
  COMPANY_MEMBER_INVITATION_RESENT: "company_member.invitation_resent",
  COMPANY_MEMBER_INVITATION_REVOKED: "company_member.invitation_revoked",
  COMPANY_MEMBER_INVITATION_ACCEPTED: "company_member.invitation_accepted",
  COMPANY_MEMBER_INVITATION_DECLINED: "company_member.invitation_declined",
  COMPANY_MEMBER_ROLE_CHANGED: "company_member.role_changed",
  COMPANY_MEMBER_REMOVED: "company_member.removed",
  COMPANY_MEMBER_LEFT: "company_member.left",
  COMPANY_MEMBER_OWNERSHIP_TRANSFERRED: "company_member.ownership_transferred",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS] | string;
