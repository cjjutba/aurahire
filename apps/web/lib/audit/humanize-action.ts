/**
 * Plain-English labels for known audit action codes. The backend writes
 * canonical dotted strings (see apps/api/src/audit/audit.types.ts); this
 * map renders them for human consumption in the admin portal.
 *
 * Keep this map in sync with AUDIT_ACTIONS in the API. If a backend code
 * appears that isn't in this map, the fallback formatter still renders
 * it cleanly (Title Cased Words) — losing nuance but never readability.
 */
const KNOWN_LABELS: Record<string, string> = {
  // Identity & accounts
  "user.registered.candidate": "Candidate joined",
  "user.registered.recruiter": "Recruiter joined",
  "user.login": "User signed in",
  "user.logout": "User signed out",
  "user.password_reset_requested": "Password reset requested",
  "user.password_reset": "Password reset",
  "user.password_reset_forced": "Password reset (forced by admin)",
  "user.email_verified": "Email verified",
  "user.suspended": "User suspended",
  "user.reactivated": "User reactivated",
  "user.deleted": "User deleted",
  "user.deleted_unverified_cleanup": "Unverified account cleaned up",
  "user.role_changed": "User role changed",

  // Onboarding
  "user.onboarding.personal_updated": "Personal info updated",
  "user.onboarding.preferences_updated": "Preferences updated",
  "user.onboarding.about_updated": "About updated",
  "user.onboarding.company_updated": "Company info updated",
  "user.onboarding.completed": "Onboarding completed",

  // Resumes
  "resume.uploaded": "Resume uploaded",
  "resume.parsed": "Resume parsed",
  "resume.parse_failed": "Resume parsing failed",
  "resume.reparsed": "Resume re-parsed",
  "resume.reparse_failed": "Resume re-parsing failed",
  "resume.set_default": "Default resume changed",
  "resume.deleted": "Resume deleted",

  // Jobs
  "job.created": "Job created",
  "job.updated": "Job updated",
  "job.published": "Job published",
  "job.archived": "Job archived",
  "job.archived_by_admin": "Job archived by admin",
  "job.archived_by_cron": "Job archived (deadline passed)",
  "job.bias_check_run": "Bias check run on job",

  // Applications
  "application.created": "Application submitted",
  "application.shortlisted": "Candidate shortlisted",
  "application.unshortlisted": "Candidate removed from shortlist",
  "application.status_changed": "Application status changed",
  "application.notes_updated": "Application notes updated",
  "application.withdrawn": "Application withdrawn",
  "application.withdrawn_by_candidate": "Application withdrawn by candidate",
  "application.email_sent": "Candidate emailed",

  // Interviews
  "interview.scheduled": "Interview scheduled",
  "interview.feedback_updated": "Interview feedback updated",
  "interview.feedback_submitted": "Interview feedback submitted",
  "interview.feedback_shared": "Interview feedback shared with candidate",
  "interview.recommendation_set": "Interview recommendation set",
  "interview.auto_completed": "Interview auto-completed",
  "interview.no_show_marked": "Interview marked as no-show",
  "interview.rescheduled": "Interview rescheduled",
  "interview.status_changed": "Interview status changed",
  "interview_venue.created": "Interview venue created",
  "interview_venue.updated": "Interview venue updated",
  "interview_venue.deleted": "Interview venue deleted",

  // Offers
  "offer.sent": "Offer sent",
  "offer.accepted": "Offer accepted",
  "offer.declined": "Offer declined",
  "offer.withdrawn": "Offer withdrawn",
  "offer.expired": "Offer expired",

  // Scoring & AI
  "scoring_config.updated": "Scoring weights updated",
  "score.profile.computed": "Profile score computed",
  "score.match.computed": "Match score computed",
  "score.match.recomputed": "Match score recomputed",
  "score.match.preview.computed": "Job match preview computed",
  "queue.rescore_batch.enqueued": "Rescore batch enqueued",
  "bias_flag.overridden": "Bias flag overridden",

  // Companies & members
  "company.created": "Company created",
  "company.updated": "Company updated",
  "company.deleted": "Company deleted",
  "company.active_switched": "Active company switched",
  "company_member.invited": "Member invited",
  "company_member.invitation_resent": "Member invitation resent",
  "company_member.invitation_revoked": "Member invitation revoked",
  "company_member.invitation_accepted": "Member invitation accepted",
  "company_member.invitation_declined": "Member invitation declined",
  "company_member.role_changed": "Member role changed",
  "company_member.removed": "Member removed",
  "company_member.left": "Member left",
  "company_member.ownership_transferred": "Ownership transferred",

  // Notifications
  "notifications.marked_all_read": "Notifications marked as read",
  "notification_preference.updated": "Notification preference updated",
  "notification_preferences.reset": "Notification preferences reset",
  "notifications.digest_email_batch_run": "Notification digest sent",
  "notifications.retention_run": "Notification cleanup ran",

  // Cron / system
  "cron.expire_offers.executed": "Offer expiry cron ran",
  "cron.archive_past_deadline_jobs.executed": "Job archive cron ran",
  "cron.cleanup_unverified_accounts.executed": "Unverified account cleanup ran",
  "cron.interview_reminder.executed": "Interview reminder cron ran",
  "cron.offer_expiry_reminder.executed": "Offer expiry reminder cron ran",
  "cron.interview_feedback_due.executed": "Interview feedback reminder cron ran",
  "cron.interview_autocomplete.executed": "Interview auto-complete cron ran",
  "system.ai_scoring_failure_notified": "AI scoring failure notified",
};

function titleCaseFallback(action: string): string {
  return action
    .split(".")
    .flatMap((segment) => segment.split("_"))
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Returns a plain-English label for a known audit action code.
 * Falls back to Title Cased Words for unknown codes (forward compatibility).
 * Returns "—" for empty input.
 */
export function humanizeAuditAction(action: string): string {
  const trimmed = action.trim();
  if (trimmed.length === 0) return "—";
  const known = KNOWN_LABELS[trimmed];
  if (known) return known;
  return titleCaseFallback(trimmed);
}
