import * as React from "react";
import type { NotificationEventType } from "@aurahire/db";
import { BaseLayout, brandStyles } from "./base-layout";

type Metadata = Record<string, unknown>;
type Role = "candidate" | "recruiter" | "admin";

const m = <T,>(metadata: Metadata, key: string, fallback: T): T => {
  const v = metadata[key];
  return (v ?? fallback) as T;
};

interface TemplateDefinition {
  buildTitle(metadata: Metadata): string;
  buildBody(metadata: Metadata): string;
  buildLink(role: Role, metadata: Metadata): string | null;
  emailSubject(metadata: Metadata): string;
  EmailComponent: React.FC<{
    metadata: Metadata;
    appOrigin: string;
    role: Role;
  }>;
  iconName: string;
}

const buildPersonalEmail =
  (
    headline: (md: Metadata) => string,
    body: (md: Metadata) => string,
    ctaLabel: (md: Metadata) => string | null,
    linkBuilder: (role: Role, md: Metadata) => string | null,
  ): TemplateDefinition["EmailComponent"] =>
  ({ metadata, appOrigin, role }) => {
    const link = linkBuilder(role, metadata);
    const cta = ctaLabel(metadata);
    return (
      <BaseLayout
        preview={headline(metadata)}
        appOrigin={appOrigin}
        unsubscribePath={`/${role}/settings/notifications`}
      >
        <h2 style={{ fontSize: 24, fontWeight: 400, margin: "0 0 16px" }}>
          {headline(metadata)}
        </h2>
        <p style={brandStyles.body}>{body(metadata)}</p>
        {cta && link && (
          <p style={{ marginTop: 24 }}>
            <a href={`${appOrigin}${link}`} style={brandStyles.ctaPrimary}>
              {cta}
            </a>
          </p>
        )}
      </BaseLayout>
    );
  };

// ---------------------------------------------------------------------------
// Status-aware copy for application_status_changed.
// Each terminal status carries its own tone: hired celebrates, rejected
// stays empathetic and forward-looking, interview/offer signal momentum.
// ---------------------------------------------------------------------------
// Status strings may arrive lowercased (from the API) or title-cased (from
// older callers), so normalize before matching to keep the copy consistent.
function normStatus(status: string): string {
  return status.toLowerCase();
}

function statusInAppTitle(status: string, jobTitle: string): string {
  switch (normStatus(status)) {
    case "hired":
      return `Congratulations, you're hired for ${jobTitle}`;
    case "offer":
      return `Offer extended for ${jobTitle}`;
    case "interview":
      return `You advanced to the Interview stage for ${jobTitle}`;
    case "rejected":
      return `Update on your application for ${jobTitle}`;
    case "withdrawn":
      return `Application withdrawn for ${jobTitle}`;
    case "applied":
      return `Application received for ${jobTitle}`;
    default:
      return `Application update for ${jobTitle}`;
  }
}

function statusInAppBody(
  status: string,
  jobTitle: string,
  companyName: string,
): string {
  switch (normStatus(status)) {
    case "hired":
      return `Welcome to ${companyName}. The team is excited to have you on board for ${jobTitle}.`;
    case "offer":
      return `${companyName} extended you an offer for ${jobTitle}. Open it to review the details.`;
    case "interview":
      return `Your application for ${jobTitle} at ${companyName} advanced to the Interview stage.`;
    case "rejected":
      return `${companyName} has decided to move forward with other candidates for ${jobTitle}. Thank you for the effort you put in.`;
    case "withdrawn":
      return `Your application for ${jobTitle} at ${companyName} has been withdrawn.`;
    case "applied":
      return `Your application for ${jobTitle} at ${companyName} has been received.`;
    default:
      return `Your application for ${jobTitle} at ${companyName} has been updated.`;
  }
}

function statusEmailHeadline(status: string, jobTitle: string): string {
  switch (normStatus(status)) {
    case "hired":
      return `Congratulations! You're hired for ${jobTitle}`;
    case "offer":
      return `Great news, you have an offer for ${jobTitle}`;
    case "interview":
      return `You're moving to the Interview stage for ${jobTitle}`;
    case "rejected":
      return `Update on your ${jobTitle} application`;
    case "withdrawn":
      return `Application withdrawn for ${jobTitle}`;
    case "applied":
      return `Application received for ${jobTitle}`;
    default:
      return `Update on your ${jobTitle} application`;
  }
}

function statusEmailBody(
  status: string,
  jobTitle: string,
  companyName: string,
): string {
  switch (normStatus(status)) {
    case "hired":
      return `Welcome to ${companyName}. You have been hired for ${jobTitle}. Your recruiter will reach out shortly with onboarding details. The team is thrilled to have you join.`;
    case "offer":
      return `${companyName} has extended you an offer for ${jobTitle}. Take a moment to review the full details and respond when you are ready.`;
    case "interview":
      return `Exciting update. Your application for ${jobTitle} at ${companyName} has advanced to the Interview stage. Watch for scheduling details to arrive soon.`;
    case "rejected":
      return `Thank you for your interest in ${jobTitle} at ${companyName}. The team has decided to move forward with other candidates this time. We genuinely appreciate the time you invested and wish you the very best in your search.`;
    case "withdrawn":
      return `Your application for ${jobTitle} at ${companyName} has been withdrawn. If this was not intentional, you are welcome to apply again.`;
    case "applied":
      return `Your application for ${jobTitle} at ${companyName} has been received. Sit tight while the hiring team reviews it.`;
    default:
      return `Your application for ${jobTitle} at ${companyName} has been updated.`;
  }
}

function statusEmailCta(status: string): string | null {
  switch (normStatus(status)) {
    case "hired":
      return "View your offer details";
    case "offer":
      return "Review your offer";
    case "interview":
      return "View application";
    case "rejected":
      return "View application";
    default:
      return "View application";
  }
}

function statusEmailSubject(status: string, jobTitle: string): string {
  switch (normStatus(status)) {
    case "hired":
      return `Congratulations, you're hired! ${jobTitle}`;
    case "offer":
      return `You received an offer for ${jobTitle}`;
    case "interview":
      return `Good news about your ${jobTitle} application`;
    case "rejected":
      return `Update on your ${jobTitle} application`;
    case "withdrawn":
      return `Application withdrawn: ${jobTitle}`;
    case "applied":
      return `We received your application for ${jobTitle}`;
    default:
      return `Application update: ${jobTitle}`;
  }
}

export const TEMPLATES: Record<NotificationEventType, TemplateDefinition> = {
  application_status_changed: {
    buildTitle: (md) =>
      statusInAppTitle(
        m(md, "newStatus", "next stage"),
        m(md, "jobTitle", "your role"),
      ),
    buildBody: (md) =>
      statusInAppBody(
        m(md, "newStatus", "next stage"),
        m(md, "jobTitle", "your role"),
        m(md, "companyName", "the company"),
      ),
    buildLink: (_role, md) =>
      `/candidate/applications/${m(md, "applicationId", "")}`,
    emailSubject: (md) =>
      statusEmailSubject(
        m(md, "newStatus", "next stage"),
        m(md, "jobTitle", "your role"),
      ),
    EmailComponent: buildPersonalEmail(
      (md) =>
        statusEmailHeadline(
          m(md, "newStatus", "next stage"),
          m(md, "jobTitle", "your role"),
        ),
      (md) =>
        statusEmailBody(
          m(md, "newStatus", "next stage"),
          m(md, "jobTitle", "your role"),
          m(md, "companyName", "the company"),
        ),
      (md) => statusEmailCta(m(md, "newStatus", "next stage")),
      (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "Briefcase",
  },
  interview_scheduled: {
    buildTitle: (md) =>
      `Interview scheduled for ${m(md, "jobTitle", "your role")}`,
    buildBody: (md) =>
      `Set for ${m(md, "startTime", "TBD")} (${m(md, "format", "video")}). Block off the time and prepare to bring your best.`,
    buildLink: (role, md) =>
      role === "recruiter"
        ? `/recruiter/interviews/${m(md, "interviewId", "")}`
        : `/candidate/interviews/${m(md, "interviewId", "")}`,
    emailSubject: (md) =>
      `Your interview is scheduled: ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      (md) => `Your interview is scheduled for ${m(md, "jobTitle", "your role")}`,
      (md) =>
        `You are set to meet on ${m(md, "startTime", "TBD")} (${m(md, "format", "video")}). Take a moment to prepare and arrive a few minutes early.`,
      () => "View interview details",
      (role, md) =>
        role === "recruiter"
          ? `/recruiter/interviews/${m(md, "interviewId", "")}`
          : `/candidate/interviews/${m(md, "interviewId", "")}`,
    ),
    iconName: "Calendar",
  },
  interview_reminder_24h: {
    buildTitle: () => `Your interview is tomorrow`,
    buildBody: (md) =>
      `${m(md, "jobTitle", "your role")} at ${m(md, "startTime", "tomorrow")}. You've got this.`,
    buildLink: (_role, md) =>
      `/candidate/interviews/${m(md, "interviewId", "")}`,
    emailSubject: () => `Reminder: your interview is tomorrow`,
    EmailComponent: buildPersonalEmail(
      () => `Your interview is tomorrow`,
      (md) =>
        `${m(md, "jobTitle", "your role")} on ${m(md, "startTime", "tomorrow")}. Take a deep breath and review your notes. You've got this.`,
      () => "View interview details",
      (_role, md) => `/candidate/interviews/${m(md, "interviewId", "")}`,
    ),
    iconName: "Clock",
  },
  interview_cancelled: {
    buildTitle: () => `Interview cancelled`,
    buildBody: (md) =>
      `Your interview for ${m(md, "jobTitle", "this role")} was cancelled. The hiring team will reach out with next steps.`,
    buildLink: (_role, md) =>
      `/candidate/applications/${m(md, "applicationId", "")}`,
    emailSubject: (md) =>
      `Interview cancelled: ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      () => `Your interview was cancelled`,
      (md) =>
        `Your interview for ${m(md, "jobTitle", "this role")} at ${m(md, "companyName", "the company")} has been cancelled. Hang tight, the hiring team will reach out with next steps soon.`,
      () => "View application",
      (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "X",
  },
  offer_received: {
    buildTitle: () => `You received an offer`,
    buildBody: (md) =>
      `${m(md, "jobTitle", "your role")} at ${m(md, "companyName", "the company")}. Review and respond by ${m(md, "expiresAt", "the deadline")}.`,
    buildLink: (_role, md) =>
      `/candidate/applications/${m(md, "applicationId", "")}`,
    emailSubject: () => `Great news, you have an offer`,
    EmailComponent: buildPersonalEmail(
      (md) =>
        `You have an offer for ${m(md, "jobTitle", "your role")}`,
      (md) =>
        `${m(md, "companyName", "The company")} extended you an offer. Take your time to review the details and respond by ${m(md, "expiresAt", "the deadline")}.`,
      () => "Review your offer",
      (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "Check",
  },
  offer_expiring_soon: {
    buildTitle: () => `Your offer expires within 24 hours`,
    buildBody: (md) =>
      `${m(md, "jobTitle", "your role")} at ${m(md, "companyName", "the company")} expires ${m(md, "expiresAt", "soon")}. Take a moment to respond.`,
    buildLink: (_role, md) =>
      `/candidate/applications/${m(md, "applicationId", "")}`,
    emailSubject: () => `Reminder: your offer expires within 24 hours`,
    EmailComponent: buildPersonalEmail(
      () => `Your offer expires within 24 hours`,
      (md) =>
        `Your offer for ${m(md, "jobTitle", "your role")} at ${m(md, "companyName", "the company")} expires soon. Take a moment to respond before time runs out.`,
      () => "Review your offer",
      (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "Clock",
  },
  new_application_received: {
    buildTitle: (md) =>
      `New application from ${m(md, "candidateName", "a candidate")}`,
    buildBody: (md) => {
      const score = md.scoreValue;
      const band = md.matchBand;
      const role = m(md, "jobTitle", "your role");
      if (score == null || band == null) {
        return `Applied to ${role}. Match score is being computed.`;
      }
      return `Applied to ${role}. Match score ${score} (${band}).`;
    },
    buildLink: (_role, md) =>
      `/recruiter/jobs/${m(md, "jobId", "")}/applications/${m(md, "applicationId", "")}`,
    emailSubject: (md) =>
      `New application for ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      (md) => `New application from ${m(md, "candidateName", "a candidate")}`,
      (md) => {
        const score = md.scoreValue;
        const role = m(md, "jobTitle", "your role");
        if (score == null) {
          return `A candidate just applied to ${role}. Their match score is being computed.`;
        }
        return `A candidate just applied to ${role} with a match score of ${score}. Take a look when you have a moment.`;
      },
      () => "Review application",
      (_role, md) =>
        `/recruiter/jobs/${m(md, "jobId", "")}/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "UserPlus",
  },
  candidate_withdrew: {
    buildTitle: (md) => `${m(md, "candidateName", "A candidate")} withdrew`,
    buildBody: (md) =>
      `Withdrew from ${m(md, "jobTitle", "your role")}. The pipeline is up to date.`,
    buildLink: (_role, md) =>
      `/recruiter/jobs/${m(md, "jobId", "")}/applications/${m(md, "applicationId", "")}`,
    emailSubject: (md) =>
      `Candidate withdrew from ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      (md) =>
        `${m(md, "candidateName", "A candidate")} withdrew their application`,
      (md) =>
        `${m(md, "candidateName", "A candidate")} has withdrawn from ${m(md, "jobTitle", "your role")}. Your pipeline has been updated.`,
      () => "View application",
      (_role, md) =>
        `/recruiter/jobs/${m(md, "jobId", "")}/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "UserMinus",
  },
  interview_feedback_shared: {
    buildTitle: () => `Interview feedback is available`,
    buildBody: (md) =>
      `Your recruiter shared a feedback summary from your ${m(md, "jobTitle", "recent")} interview.`,
    buildLink: (_role, md) =>
      `/candidate/interviews/${m(md, "interviewId", "")}`,
    emailSubject: () => `Your interview feedback is ready`,
    EmailComponent: buildPersonalEmail(
      () => `Your interview feedback is ready`,
      (md) =>
        `Your recruiter shared feedback from your ${m(md, "jobTitle", "recent")} interview. Open it in the candidate portal whenever you are ready.`,
      () => "View feedback",
      (_role, md) => `/candidate/interviews/${m(md, "interviewId", "")}`,
    ),
    iconName: "MessageSquare",
  },
  interview_rescheduled: {
    buildTitle: (md) =>
      `Interview rescheduled for ${m(md, "jobTitle", "your role")}`,
    buildBody: (md) =>
      `Your interview has been moved to ${m(md, "newStartTime", "a new time")}.`,
    buildLink: (_role, md) =>
      `/candidate/interviews/${m(md, "interviewId", "")}`,
    emailSubject: (md) =>
      `Interview rescheduled: ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      () => `Your interview was rescheduled`,
      (md) =>
        `Your ${m(md, "jobTitle", "upcoming")} interview has been moved to ${m(md, "newStartTime", "a new time")}. Update your calendar and we will see you then.`,
      () => "View interview details",
      (_role, md) => `/candidate/interviews/${m(md, "interviewId", "")}`,
    ),
    iconName: "CalendarClock",
  },
  interview_completed: {
    buildTitle: (md) =>
      `Interview completed for ${m(md, "jobTitle", "your role")}`,
    buildBody: (md) =>
      `Your interview for ${m(md, "jobTitle", "this role")} at ${m(md, "companyName", "the company")} is in the books. The hiring team will follow up soon.`,
    buildLink: (_role, md) =>
      `/candidate/interviews/${m(md, "interviewId", "")}`,
    emailSubject: (md) =>
      `Interview completed: ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      () => `Your interview is in the books`,
      (md) =>
        `Your interview for ${m(md, "jobTitle", "this role")} has been marked complete. Nice work showing up. The hiring team will follow up with next steps.`,
      () => "View interview",
      (_role, md) => `/candidate/interviews/${m(md, "interviewId", "")}`,
    ),
    iconName: "CheckCircle",
  },
  interview_record_feedback: {
    buildTitle: (md) =>
      `Record feedback for ${m(md, "candidateName", "candidate")}`,
    buildBody: (md) =>
      `Submit your feedback for ${m(md, "candidateName", "the candidate")} on ${m(md, "jobTitle", "this role")}.`,
    buildLink: (_role, md) =>
      `/recruiter/interviews/${m(md, "interviewId", "")}`,
    emailSubject: (md) =>
      `Feedback required for ${m(md, "candidateName", "candidate")} on ${m(md, "jobTitle", "this role")}`,
    EmailComponent: buildPersonalEmail(
      () => `Record interview feedback`,
      (md) =>
        `Please submit feedback for ${m(md, "candidateName", "the candidate")} on ${m(md, "jobTitle", "this role")} so the team can move quickly.`,
      () => "Submit feedback",
      (_role, md) => `/recruiter/interviews/${m(md, "interviewId", "")}`,
    ),
    iconName: "ClipboardEdit",
  },
  application_withdrawn: {
    buildTitle: (md) => `${m(md, "candidateName", "A candidate")} withdrew`,
    buildBody: (md) =>
      `Withdrew from ${m(md, "jobTitle", "your role")}. The pipeline is up to date.`,
    buildLink: (_role, md) =>
      `/recruiter/applications/${m(md, "applicationId", "")}`,
    emailSubject: (md) =>
      `${m(md, "candidateName", "A candidate")} withdrew from ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      (md) =>
        `${m(md, "candidateName", "A candidate")} withdrew their application`,
      (md) =>
        `${m(md, "candidateName", "A candidate")} withdrew their application for ${m(md, "jobTitle", "your role")}.`,
      () => "View application",
      (_role, md) => `/recruiter/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "UserMinus",
  },
  interview_feedback_due: {
    buildTitle: () => `Interview feedback is due`,
    buildBody: (md) =>
      `${m(md, "candidateName", "the candidate")} for ${m(md, "jobTitle", "this role")}.`,
    buildLink: (_role, md) =>
      `/recruiter/interviews/${m(md, "interviewId", "")}`,
    emailSubject: () => `Interview feedback overdue`,
    EmailComponent: buildPersonalEmail(
      () => `Interview feedback is overdue`,
      (md) =>
        `Please file feedback for ${m(md, "candidateName", "the candidate")} on ${m(md, "jobTitle", "this role")}. The candidate is waiting on a decision.`,
      () => "Submit feedback",
      (_role, md) => `/recruiter/interviews/${m(md, "interviewId", "")}`,
    ),
    iconName: "AlertCircle",
  },
  offer_accepted: {
    buildTitle: (md) =>
      `${m(md, "candidateName", "Candidate")} accepted your offer`,
    buildBody: (md) =>
      `${m(md, "jobTitle", "your role")} is filled. Congratulations on the hire.`,
    buildLink: (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}`,
    emailSubject: (md) =>
      `${m(md, "candidateName", "Candidate")} accepted your offer`,
    EmailComponent: buildPersonalEmail(
      (md) =>
        `${m(md, "candidateName", "Candidate")} accepted your offer`,
      (md) =>
        `Your offer for ${m(md, "jobTitle", "your role")} was accepted. Congratulations on closing the role.`,
      () => "View job",
      (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}`,
    ),
    iconName: "Check",
  },
  offer_declined: {
    buildTitle: (md) =>
      `${m(md, "candidateName", "Candidate")} declined your offer`,
    buildBody: (md) =>
      `${m(md, "jobTitle", "your role")}. Time to reach out to your next-best candidate.`,
    buildLink: (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}`,
    emailSubject: (md) =>
      `${m(md, "candidateName", "Candidate")} declined your offer`,
    EmailComponent: buildPersonalEmail(
      (md) =>
        `${m(md, "candidateName", "Candidate")} declined your offer`,
      (md) =>
        `Your offer for ${m(md, "jobTitle", "your role")} was declined. Consider reaching out to your next strongest candidate.`,
      () => "View job",
      (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}`,
    ),
    iconName: "X",
  },
  offer_expired: {
    buildTitle: () => `Offer expired`,
    buildBody: (md) =>
      `The pending offer for ${m(md, "jobTitle", "this role")} expired without a response.`,
    buildLink: (role, md) =>
      role === "recruiter"
        ? `/recruiter/jobs/${m(md, "jobId", "")}`
        : `/candidate/applications/${m(md, "applicationId", "")}`,
    emailSubject: (md) =>
      `Offer expired for ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      () => `An offer expired`,
      (md) =>
        `The pending offer for ${m(md, "jobTitle", "this role")} expired without a response. Take a moment to plan the next step.`,
      () => "View details",
      (role, md) =>
        role === "recruiter"
          ? `/recruiter/jobs/${m(md, "jobId", "")}`
          : `/candidate/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "Clock",
  },
  job_archived_by_deadline: {
    buildTitle: (md) => `Job auto-archived: ${m(md, "title", "your job")}`,
    buildBody: (md) =>
      `Your published job "${m(md, "title", "this role")}" was archived because its application deadline passed.`,
    buildLink: (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}`,
    emailSubject: (md) =>
      `Job archived for ${m(md, "title", "your role")}`,
    EmailComponent: buildPersonalEmail(
      (md) => `Job archived: ${m(md, "title", "your job")}`,
      (md) =>
        `Your job "${m(md, "title", "this role")}" was auto-archived because its application deadline passed. You can republish or extend the deadline from the recruiter portal.`,
      () => "View job",
      (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}`,
    ),
    iconName: "Archive",
  },
  bias_flag_raised: {
    buildTitle: () => `Bias flag on your job description`,
    buildBody: (md) =>
      `${m(md, "jobTitle", "your JD")}: ${m(md, "flagSummary", "review flagged language")}.`,
    buildLink: (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}/bias`,
    emailSubject: (md) =>
      `Bias flag on ${m(md, "jobTitle", "your JD")}`,
    EmailComponent: buildPersonalEmail(
      () => `Bias flag on your job description`,
      (md) =>
        `${m(md, "jobTitle", "your JD")}: ${m(md, "flagSummary", "review flagged language")}.`,
      () => "Review flag",
      (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}/bias`,
    ),
    iconName: "ShieldAlert",
  },
  team_invite_accepted: {
    buildTitle: (md) =>
      `${m(md, "memberName", "A team member")} accepted your invite`,
    buildBody: (md) => `Welcome them to ${m(md, "companyName", "your company")}.`,
    buildLink: () => `/recruiter/settings/members`,
    emailSubject: () => `Team invite accepted`,
    EmailComponent: buildPersonalEmail(
      (md) =>
        `${m(md, "memberName", "A team member")} accepted your invite`,
      (md) =>
        `${m(md, "memberName", "A new team member")} just joined ${m(md, "companyName", "your company")}. Drop by the team page to say hello.`,
      () => "View team",
      () => `/recruiter/settings/members`,
    ),
    iconName: "UserCheck",
  },
  team_invite_declined: {
    buildTitle: (md) =>
      `${m(md, "memberName", "A team member")} declined your invite`,
    buildBody: (md) => `For ${m(md, "companyName", "your company")}.`,
    buildLink: () => `/recruiter/settings/members`,
    emailSubject: () => `Team invite declined`,
    EmailComponent: buildPersonalEmail(
      (md) =>
        `${m(md, "memberName", "A team member")} declined your invite`,
      (md) =>
        `${m(md, "memberName", "Someone")} declined the invite to ${m(md, "companyName", "your company")}. You can resend an invite anytime.`,
      () => "View team",
      () => `/recruiter/settings/members`,
    ),
    iconName: "UserMinus",
  },
  system_bias_flag_raised: {
    buildTitle: () => `System-wide bias flag raised`,
    buildBody: (md) =>
      `${m(md, "companyName", "A company")}, ${m(md, "jobTitle", "JD")}: ${m(md, "flagSummary", "language review")}.`,
    buildLink: (_role, md) => `/admin/bias-flags/${m(md, "flagId", "")}`,
    emailSubject: () => `System bias flag`,
    EmailComponent: buildPersonalEmail(
      () => `System bias flag`,
      (md) =>
        `${m(md, "companyName", "A company")}, ${m(md, "jobTitle", "JD")}: ${m(md, "flagSummary", "language review")}.`,
      () => "Review",
      (_role, md) => `/admin/bias-flags/${m(md, "flagId", "")}`,
    ),
    iconName: "ShieldAlert",
  },
  system_ai_scoring_failure: {
    buildTitle: () => `AI scoring failure`,
    buildBody: (md) => `${m(md, "summary", "An AI scoring job failed")}.`,
    buildLink: (_role, md) => `/admin/ai-failures/${m(md, "failureId", "")}`,
    emailSubject: () => `AI scoring failure`,
    EmailComponent: buildPersonalEmail(
      () => `AI scoring failure`,
      (md) => `${m(md, "summary", "An AI scoring job failed")}.`,
      () => "Investigate",
      (_role, md) => `/admin/ai-failures/${m(md, "failureId", "")}`,
    ),
    iconName: "AlertCircle",
  },
  system_moderation_queue_item: {
    buildTitle: (md) => `Moderation queue: ${m(md, "kind", "item")}`,
    buildBody: (md) =>
      `${m(md, "summary", "A new item entered the moderation queue.")}`,
    buildLink: () => `/admin/moderation`,
    emailSubject: () => `Moderation queue update`,
    EmailComponent: buildPersonalEmail(
      (md) => `Moderation queue: ${m(md, "kind", "item")}`,
      (md) => `${m(md, "summary", "A new item entered the moderation queue.")}`,
      () => "Open queue",
      () => `/admin/moderation`,
    ),
    iconName: "Settings",
  },
  account_password_reset: {
    buildTitle: () => `Password reset confirmed`,
    buildBody: () =>
      `Your password was changed. If this was not you, contact support immediately.`,
    buildLink: (role) => `/${role}/settings/security`,
    emailSubject: () => `Password reset confirmation`,
    EmailComponent: buildPersonalEmail(
      () => `Your password was reset`,
      () =>
        `Your AuraHire password was just changed. If this was not you, contact support immediately to secure your account.`,
      () => "Review security settings",
      (role) => `/${role}/settings/security`,
    ),
    iconName: "ShieldCheck",
  },
  account_email_verified: {
    buildTitle: () => `Email verified`,
    buildBody: () => `Your email address was successfully verified.`,
    buildLink: (role) => `/${role}/settings/security`,
    emailSubject: () => `Welcome to AuraHire, your email is verified`,
    EmailComponent: buildPersonalEmail(
      () => `You're all set, welcome to AuraHire`,
      () =>
        `Your email address was successfully verified. Your account is ready to go.`,
      () => "Go to your dashboard",
      (role) => `/${role}/settings/security`,
    ),
    iconName: "ShieldCheck",
  },
  account_login_new_device: {
    buildTitle: () => `New device login`,
    buildBody: (md) =>
      `Login from ${m(md, "browser", "an unknown browser")} (${m(md, "location", "unknown location")}). If this was not you, reset your password immediately.`,
    buildLink: (role) => `/${role}/settings/security`,
    emailSubject: () => `New login from an unrecognized device`,
    EmailComponent: buildPersonalEmail(
      () => `New device login detected`,
      (md) =>
        `Login from ${m(md, "browser", "an unknown browser")} in ${m(md, "location", "an unknown location")}. If this was not you, reset your password right away.`,
      () => "Reset password",
      (role) => `/${role}/settings/security`,
    ),
    iconName: "ShieldAlert",
  },
};

export function buildTitle(
  eventType: NotificationEventType,
  metadata: Metadata,
): string {
  return TEMPLATES[eventType].buildTitle(metadata);
}

export function buildBody(
  eventType: NotificationEventType,
  metadata: Metadata,
): string {
  return TEMPLATES[eventType].buildBody(metadata);
}

export function buildLink(
  eventType: NotificationEventType,
  role: Role,
  metadata: Metadata,
): string | null {
  return TEMPLATES[eventType].buildLink(role, metadata);
}

export function emailSubject(
  eventType: NotificationEventType,
  metadata: Metadata,
): string {
  return TEMPLATES[eventType].emailSubject(metadata);
}

export function getEmailComponent(eventType: NotificationEventType) {
  return TEMPLATES[eventType].EmailComponent;
}

export function getIconName(eventType: NotificationEventType): string {
  return TEMPLATES[eventType].iconName;
}
