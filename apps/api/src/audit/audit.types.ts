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
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS] | string;
