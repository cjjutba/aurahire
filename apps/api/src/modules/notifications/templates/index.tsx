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
  EmailComponent: React.FC<{ metadata: Metadata; appOrigin: string; role: Role }>;
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

export const TEMPLATES: Record<NotificationEventType, TemplateDefinition> = {
  application_status_changed: {
    buildTitle: (md) => `Application moved to ${m(md, "newStatus", "next stage")}`,
    buildBody: (md) =>
      `${m(md, "jobTitle", "your role")} at ${m(md, "companyName", "the company")} — your application is now in ${m(md, "newStatus", "the next stage")}.`,
    buildLink: (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    emailSubject: (md) => `Application update: ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      (md) => `Application moved to ${m(md, "newStatus", "next stage")}`,
      (md) =>
        `Your application for ${m(md, "jobTitle", "this role")} at ${m(md, "companyName", "the company")} is now in ${m(md, "newStatus", "a new stage")}.`,
      () => "View application",
      (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "Briefcase",
  },
  interview_scheduled: {
    buildTitle: (md) => `Interview scheduled — ${m(md, "jobTitle", "your role")}`,
    buildBody: (md) =>
      `Scheduled for ${m(md, "startTime", "TBD")} (${m(md, "format", "video")}).`,
    buildLink: (role, md) =>
      role === "recruiter"
        ? `/recruiter/interviews/${m(md, "interviewId", "")}`
        : `/candidate/interviews/${m(md, "interviewId", "")}`,
    emailSubject: (md) => `Interview scheduled: ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      (md) => `Interview scheduled`,
      (md) =>
        `${m(md, "jobTitle", "your role")} interview on ${m(md, "startTime", "TBD")} (${m(md, "format", "video")}).`,
      () => "View interview",
      (role, md) =>
        role === "recruiter"
          ? `/recruiter/interviews/${m(md, "interviewId", "")}`
          : `/candidate/interviews/${m(md, "interviewId", "")}`,
    ),
    iconName: "Calendar",
  },
  interview_reminder_24h: {
    buildTitle: () => `Interview tomorrow`,
    buildBody: (md) =>
      `${m(md, "jobTitle", "your role")} at ${m(md, "startTime", "tomorrow")}.`,
    buildLink: (_role, md) => `/candidate/interviews/${m(md, "interviewId", "")}`,
    emailSubject: () => `Reminder: your interview is tomorrow`,
    EmailComponent: buildPersonalEmail(
      () => `Your interview is tomorrow`,
      (md) => `${m(md, "jobTitle", "your role")} on ${m(md, "startTime", "tomorrow")}.`,
      () => "View details",
      (_role, md) => `/candidate/interviews/${m(md, "interviewId", "")}`,
    ),
    iconName: "Clock",
  },
  interview_cancelled: {
    buildTitle: () => `Interview cancelled`,
    buildBody: (md) => `Your interview for ${m(md, "jobTitle", "this role")} was cancelled.`,
    buildLink: (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    emailSubject: (md) => `Interview cancelled: ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      () => `Interview cancelled`,
      (md) =>
        `Your interview for ${m(md, "jobTitle", "this role")} at ${m(md, "companyName", "the company")} was cancelled.`,
      () => "View application",
      (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "X",
  },
  offer_received: {
    buildTitle: () => `Offer received`,
    buildBody: (md) =>
      `${m(md, "jobTitle", "your role")} at ${m(md, "companyName", "the company")} — review and respond by ${m(md, "expiresAt", "the deadline")}.`,
    buildLink: (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    emailSubject: () => `You received an offer`,
    EmailComponent: buildPersonalEmail(
      (md) => `Offer received: ${m(md, "jobTitle", "your role")}`,
      (md) =>
        `${m(md, "companyName", "The company")} sent you an offer. Respond by ${m(md, "expiresAt", "the deadline")}.`,
      () => "Review offer",
      (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "Check",
  },
  offer_expiring_soon: {
    buildTitle: () => `Offer expires within 24 hours`,
    buildBody: (md) =>
      `${m(md, "jobTitle", "your role")} at ${m(md, "companyName", "the company")} expires ${m(md, "expiresAt", "soon")}.`,
    buildLink: (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    emailSubject: () => `Your offer expires within 24 hours`,
    EmailComponent: buildPersonalEmail(
      () => `Your offer expires within 24 hours`,
      (md) =>
        `${m(md, "jobTitle", "your role")} at ${m(md, "companyName", "the company")}.`,
      () => "Review offer",
      (_role, md) => `/candidate/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "Clock",
  },
  new_application_received: {
    buildTitle: (md) => `New application: ${m(md, "candidateName", "a candidate")}`,
    buildBody: (md) =>
      `Applied to ${m(md, "jobTitle", "your role")} — match score ${m(md, "scoreValue", "—")} (${m(md, "matchBand", "—")}).`,
    buildLink: (_role, md) =>
      `/recruiter/jobs/${m(md, "jobId", "")}/applications/${m(md, "applicationId", "")}`,
    emailSubject: (md) => `New application — ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      (md) => `New application from ${m(md, "candidateName", "a candidate")}`,
      (md) =>
        `Applied to ${m(md, "jobTitle", "your role")}. Match score ${m(md, "scoreValue", "—")}.`,
      () => "Review application",
      (_role, md) =>
        `/recruiter/jobs/${m(md, "jobId", "")}/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "UserPlus",
  },
  candidate_withdrew: {
    buildTitle: (md) => `${m(md, "candidateName", "A candidate")} withdrew`,
    buildBody: (md) => `Withdrew from ${m(md, "jobTitle", "your role")}.`,
    buildLink: (_role, md) =>
      `/recruiter/jobs/${m(md, "jobId", "")}/applications/${m(md, "applicationId", "")}`,
    emailSubject: (md) => `Candidate withdrew — ${m(md, "jobTitle", "your role")}`,
    EmailComponent: buildPersonalEmail(
      (md) => `${m(md, "candidateName", "A candidate")} withdrew`,
      (md) => `Withdrew their application for ${m(md, "jobTitle", "your role")}.`,
      () => "View application",
      (_role, md) =>
        `/recruiter/jobs/${m(md, "jobId", "")}/applications/${m(md, "applicationId", "")}`,
    ),
    iconName: "UserMinus",
  },
  interview_feedback_shared: {
    buildTitle: () => `Interview feedback available`,
    buildBody: (md) =>
      `Your recruiter shared their feedback summary for the ${m(md, "jobTitle", "interview")} interview.`,
    buildLink: (_role, md) => `/candidate/interviews/${m(md, "interviewId", "")}`,
    emailSubject: () => `Interview feedback shared with you`,
    EmailComponent: buildPersonalEmail(
      () => `Interview feedback available`,
      (md) =>
        `Your recruiter shared feedback from your ${m(md, "jobTitle", "recent")} interview. View it in your candidate portal.`,
      () => "View feedback",
      (_role, md) => `/candidate/interviews/${m(md, "interviewId", "")}`,
    ),
    iconName: "MessageSquare",
  },
  interview_feedback_due: {
    buildTitle: () => `Interview feedback due`,
    buildBody: (md) =>
      `${m(md, "candidateName", "the candidate")} for ${m(md, "jobTitle", "this role")}.`,
    buildLink: (_role, md) => `/recruiter/interviews/${m(md, "interviewId", "")}`,
    emailSubject: () => `Interview feedback overdue`,
    EmailComponent: buildPersonalEmail(
      () => `Interview feedback overdue`,
      (md) =>
        `Please file feedback for ${m(md, "candidateName", "the candidate")} (${m(md, "jobTitle", "this role")}).`,
      () => "Submit feedback",
      (_role, md) => `/recruiter/interviews/${m(md, "interviewId", "")}`,
    ),
    iconName: "AlertCircle",
  },
  offer_accepted: {
    buildTitle: (md) => `${m(md, "candidateName", "Candidate")} accepted your offer`,
    buildBody: (md) => `${m(md, "jobTitle", "your role")}.`,
    buildLink: (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}`,
    emailSubject: (md) => `${m(md, "candidateName", "Candidate")} accepted your offer`,
    EmailComponent: buildPersonalEmail(
      (md) => `${m(md, "candidateName", "Candidate")} accepted your offer`,
      (md) => `Offer for ${m(md, "jobTitle", "your role")} accepted.`,
      () => "View job",
      (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}`,
    ),
    iconName: "Check",
  },
  offer_declined: {
    buildTitle: (md) => `${m(md, "candidateName", "Candidate")} declined your offer`,
    buildBody: (md) => `${m(md, "jobTitle", "your role")}.`,
    buildLink: (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}`,
    emailSubject: (md) => `${m(md, "candidateName", "Candidate")} declined your offer`,
    EmailComponent: buildPersonalEmail(
      (md) => `${m(md, "candidateName", "Candidate")} declined your offer`,
      (md) => `Offer for ${m(md, "jobTitle", "your role")} declined.`,
      () => "View job",
      (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}`,
    ),
    iconName: "X",
  },
  bias_flag_raised: {
    buildTitle: () => `Bias flag on your job description`,
    buildBody: (md) =>
      `${m(md, "jobTitle", "your JD")} — ${m(md, "flagSummary", "review flagged language")}.`,
    buildLink: (_role, md) => `/recruiter/jobs/${m(md, "jobId", "")}/bias`,
    emailSubject: (md) => `Bias flag — ${m(md, "jobTitle", "your JD")}`,
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
    buildTitle: (md) => `${m(md, "memberName", "A team member")} accepted your invite`,
    buildBody: (md) => `${m(md, "companyName", "your company")}.`,
    buildLink: () => `/recruiter/settings/members`,
    emailSubject: () => `Team invite accepted`,
    EmailComponent: buildPersonalEmail(
      (md) => `${m(md, "memberName", "A team member")} accepted your invite`,
      (md) => `Joined ${m(md, "companyName", "your company")}.`,
      () => "View team",
      () => `/recruiter/settings/members`,
    ),
    iconName: "UserCheck",
  },
  team_invite_declined: {
    buildTitle: (md) => `${m(md, "memberName", "A team member")} declined your invite`,
    buildBody: (md) => `${m(md, "companyName", "your company")}.`,
    buildLink: () => `/recruiter/settings/members`,
    emailSubject: () => `Team invite declined`,
    EmailComponent: buildPersonalEmail(
      (md) => `${m(md, "memberName", "A team member")} declined your invite`,
      (md) => `${m(md, "companyName", "your company")}.`,
      () => "View team",
      () => `/recruiter/settings/members`,
    ),
    iconName: "UserMinus",
  },
  system_bias_flag_raised: {
    buildTitle: () => `Bias flag system-wide`,
    buildBody: (md) =>
      `${m(md, "companyName", "A company")} — ${m(md, "jobTitle", "JD")} — ${m(md, "flagSummary", "language review")}.`,
    buildLink: (_role, md) => `/admin/bias-flags/${m(md, "flagId", "")}`,
    emailSubject: () => `System bias flag`,
    EmailComponent: buildPersonalEmail(
      () => `System bias flag`,
      (md) =>
        `${m(md, "companyName", "A company")} — ${m(md, "jobTitle", "JD")}: ${m(md, "flagSummary", "language review")}.`,
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
    buildBody: (md) => `${m(md, "summary", "A new item entered the moderation queue.")}`,
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
      `Your password was changed. If this wasn't you, contact support immediately.`,
    buildLink: (role) => `/${role}/settings/security`,
    emailSubject: () => `Password reset confirmation`,
    EmailComponent: buildPersonalEmail(
      () => `Password reset confirmed`,
      () =>
        `Your AuraHire password was changed. If this wasn't you, contact support immediately.`,
      () => "Review security settings",
      (role) => `/${role}/settings/security`,
    ),
    iconName: "ShieldCheck",
  },
  account_email_verified: {
    buildTitle: () => `Email verified`,
    buildBody: () => `Your email address was successfully verified.`,
    buildLink: (role) => `/${role}/settings/security`,
    emailSubject: () => `Email verified`,
    EmailComponent: buildPersonalEmail(
      () => `Email verified`,
      () => `Your AuraHire email address was verified.`,
      () => "View account",
      (role) => `/${role}/settings/security`,
    ),
    iconName: "ShieldCheck",
  },
  account_login_new_device: {
    buildTitle: () => `New device login`,
    buildBody: (md) =>
      `Login from ${m(md, "browser", "an unknown browser")} (${m(md, "location", "unknown location")}). If this wasn't you, reset your password immediately.`,
    buildLink: (role) => `/${role}/settings/security`,
    emailSubject: () => `New login from an unrecognized device`,
    EmailComponent: buildPersonalEmail(
      () => `New device login`,
      (md) =>
        `Login from ${m(md, "browser", "an unknown browser")} (${m(md, "location", "unknown location")}). If this wasn't you, reset your password immediately.`,
      () => "Reset password",
      (role) => `/${role}/settings/security`,
    ),
    iconName: "ShieldAlert",
  },
};

export function buildTitle(eventType: NotificationEventType, metadata: Metadata): string {
  return TEMPLATES[eventType].buildTitle(metadata);
}

export function buildBody(eventType: NotificationEventType, metadata: Metadata): string {
  return TEMPLATES[eventType].buildBody(metadata);
}

export function buildLink(
  eventType: NotificationEventType,
  role: Role,
  metadata: Metadata,
): string | null {
  return TEMPLATES[eventType].buildLink(role, metadata);
}

export function emailSubject(eventType: NotificationEventType, metadata: Metadata): string {
  return TEMPLATES[eventType].emailSubject(metadata);
}

export function getEmailComponent(eventType: NotificationEventType) {
  return TEMPLATES[eventType].EmailComponent;
}

export function getIconName(eventType: NotificationEventType): string {
  return TEMPLATES[eventType].iconName;
}
