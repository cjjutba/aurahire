import {
  Activity,
  BookOpen,
  Boxes,
  Crown,
  Database,
  EyeOff,
  FileChartColumn,
  FileSearch,
  Gauge,
  Mail,
  OctagonAlert,
  ScrollText,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  TimerReset,
  UserCog,
  Users,
} from "lucide-react";
import type { HelpPageContent } from "../help-types";

export const adminHelp: HelpPageContent = {
  hero: {
    eyebrow: "Admin help center",
    title: "Operate AuraHire safely, defensibly, and at speed.",
    lede: "Configure scoring, manage users, audit decisions, and monitor fairness across the platform — with the controls and accountability the thesis requires.",
  },
  groups: [
    {
      label: "Operations",
      sections: [
        {
          id: "users-roles",
          icon: Users,
          kicker: "Identity",
          title: "Users & roles",
          lede: "Three roles, three escalation paths, one source of truth in Supabase Auth.",
          blocks: [
            {
              kind: "definitions",
              entries: [
                {
                  term: "Candidate",
                  definition:
                    "Self-registers via the public signup flow. Can apply to jobs, view their own scores, manage their resume and profile, and manage their data (export / delete).",
                },
                {
                  term: "Recruiter",
                  definition:
                    "Invited by an admin or by another recruiter on the same workspace. Can publish jobs, review applications, override scores, send offers, and view their workspace's analytics.",
                },
                {
                  term: "Admin",
                  definition:
                    "Invited by an existing admin. Can do everything a recruiter can do, plus user management, AI configuration, audit log export, and bias monitoring across all workspaces.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Role changes are audited",
              body: "Promoting a recruiter to admin, suspending a user, or changing workspace membership all write to the audit log with the actor, timestamp, and before / after state.",
            },
          ],
        },
        {
          id: "invite-suspend",
          icon: UserCog,
          kicker: "Lifecycle",
          title: "Invite, suspend, and remove users",
          lede: "Day-to-day user lifecycle ops.",
          blocks: [
            {
              kind: "steps",
              items: [
                {
                  title: "Invite",
                  description:
                    "Users → Invite. Enter email and role; the system creates a pending account and sends a one-time signup link. Pending invites can be revoked from the same screen.",
                },
                {
                  title: "Suspend",
                  description:
                    "Suspending a user immediately invalidates their JWT and prevents future logins. Their data is retained; their applications and audit trail are unaffected.",
                },
                {
                  title: "Reinstate",
                  description:
                    "Suspended users can be reinstated from the same row. The audit log captures the suspension period.",
                },
                {
                  title: "Permanently remove",
                  description:
                    "Permanent removal is reserved for compliance scenarios (right-to-erasure, etc.) and is gated behind a typed confirmation. Data subject to legal retention is preserved in redacted form.",
                },
              ],
            },
          ],
        },
        {
          id: "workspaces",
          icon: Boxes,
          kicker: "Tenancy",
          title: "Workspaces & companies",
          lede: "How recruiters, jobs, and applications are partitioned.",
          blocks: [
            {
              kind: "fields",
              entries: [
                {
                  label: "Workspace = company / tenant",
                  description:
                    "Every recruiter belongs to exactly one workspace. Jobs, candidates' applications, analytics, and audit logs scope to that workspace.",
                },
                {
                  label: "Cross-workspace visibility",
                  description:
                    "Candidates see jobs from every workspace publicly; their applications are scoped to the workspace that owns the job. Recruiters never see another workspace's data.",
                },
                {
                  label: "Admin scope",
                  description:
                    "Admins can read across all workspaces (audit, fairness review). Cross-workspace mutations are gated behind an explicit reason and a dedicated audit category.",
                },
                {
                  label: "RLS as the third defense",
                  description:
                    "JWT validation in NestJS is the primary guard; role checks are the secondary; Postgres RLS is the third — even a misconfigured query can't leak data across workspaces.",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      label: "AI configuration",
      sections: [
        {
          id: "scoring-config",
          icon: SlidersHorizontal,
          kicker: "Defaults",
          title: "Scoring configuration",
          lede: "Default weights, allowed criteria types, and how recruiter customizations are bounded.",
          blocks: [
            {
              kind: "paragraph",
              text: "Each role's score is computed from a recruiter-defined criteria set with weights summing to 100. Admin sets the platform defaults and the rules for how recruiters can extend or alter them.",
            },
            {
              kind: "fields",
              entries: [
                {
                  label: "Default weights",
                  description:
                    "Skills 40 / Experience 30 / Education 15 / Domain 15 — applied to new jobs unless the recruiter adjusts. Changing defaults affects new jobs only; existing jobs keep their saved weights.",
                },
                {
                  label: "Criteria types",
                  description:
                    "skill, experience-years, education-level, domain-keyword, certification, language, and custom-prompt. Custom prompts are admin-approved per workspace.",
                },
                {
                  label: "Bounds",
                  description:
                    "No single criterion can exceed 60% weight. No more than 8 criteria per role. Both bounds prevent gaming the score on a single signal.",
                },
                {
                  label: "Default config is auditable",
                  description:
                    "Any change to default weights or bounds writes to the audit log with the previous value, the new value, and your reason.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "danger",
              title: "Don't tune defaults to chase a metric",
              body: "Optimizing default weights to make a hiring KPI move is exactly the kind of pressure that erodes fairness. Defaults exist to encode our best fairness-preserving guess; per-role customization is where individual context lives.",
            },
          ],
        },
        {
          id: "prompt-versions",
          icon: Sparkles,
          kicker: "AI",
          title: "Prompt versions — and why bumping one matters",
          lede: "Every AI call is keyed by a prompt version. Bumping a prompt is a thesis-defensible event, not a casual edit.",
          blocks: [
            {
              kind: "paragraph",
              text: "Every score and bias check stores the exact prompt_version it was computed with. This is what makes a score reproducible: given the same resume, the same job, and the same prompt version, the model produces the same evidence. When you bump a prompt, all new scoring uses the new version while existing scores keep their original version on record.",
            },
            {
              kind: "fields",
              entries: [
                {
                  label: "Versioning scheme",
                  description:
                    "Semantic: <kind>.<major>.<minor> — e.g. resume-score.2.4. Major bump for behavior change; minor bump for clarification or metadata.",
                },
                {
                  label: "Roll-forward only",
                  description:
                    "You cannot retroactively change an existing version's prompt. To revise, bump the version and roll forward. Old versions remain in the registry forever (for reproducibility).",
                },
                {
                  label: "Diff & approval",
                  description:
                    "Any prompt edit shows a diff. A bump requires a written reason and a second admin's approval before it takes effect.",
                },
                {
                  label: "Rollback",
                  description:
                    "If a new prompt regresses scoring, you can pin the active version back to the prior one. New scores will use the pinned version; the bumped version is preserved for forensic comparison.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "ai",
              title: "Why this is so cautious",
              body: "Score reproducibility is the thesis's central claim. If a prompt edit silently changes scores, scores stop being defensible — and the platform's fairness story collapses with them.",
            },
          ],
        },
        {
          id: "models-latency",
          icon: Gauge,
          kicker: "Performance",
          title: "Model selection & latency monitoring",
          lede: "Which model runs for each task, and how we keep the experience snappy.",
          blocks: [
            {
              kind: "fields",
              entries: [
                {
                  label: "Default model",
                  description:
                    "OpenAI gpt-4o-mini for resume scoring and bias detection — best ratio of structured-output reliability to cost at this volume.",
                },
                {
                  label: "Per-task overrides",
                  description:
                    "Admins can pin a different model per task (resume-score, bias-detection, jd-rewrite). Overrides are versioned alongside prompts.",
                },
                {
                  label: "Latency budget",
                  description:
                    "Hard 30-second budget per AI call. Anything over budget fails the queue job and retries with backoff; the user sees an AI Shimmer with the explanatory caption.",
                },
                {
                  label: "Cost cap",
                  description:
                    "Daily and monthly spend caps per workspace. Approaching the cap pauses non-essential AI work first; admins are alerted at 80% and 95%.",
                },
              ],
            },
          ],
        },
        {
          id: "pii-redaction-config",
          icon: EyeOff,
          kicker: "Privacy",
          title: "PII redaction configuration",
          lede: "What the redactor strips, how detections are tuned, and how to add patterns.",
          blocks: [
            {
              kind: "paragraph",
              text: "PII redaction runs before any scoring AI call. The redactor uses a combination of named-entity extraction and pattern matching — admin can add or refine patterns per workspace, but cannot remove the platform-default patterns (those are non-negotiable).",
            },
            {
              kind: "list",
              items: [
                "Built-in patterns (always on): name, email, phone, address, age, date-of-birth, gender markers, graduation year, photo references.",
                "Workspace-tunable patterns: custom keywords (e.g. internal university tier mappings), additional contact format detection.",
                "Override behavior: never. The redactor is fail-closed — if redaction fails, the scoring call is aborted and the application stays unscored.",
              ],
            },
            {
              kind: "callout",
              tone: "danger",
              title: "Fail-closed is intentional",
              body: "An unscored application is recoverable; a leaked PII signal in a score is not. If redaction is failing in production, the right move is to fix redaction, not to bypass it.",
            },
          ],
        },
      ],
    },
    {
      label: "Fairness monitoring",
      sections: [
        {
          id: "bias-dashboard",
          icon: ShieldAlert,
          kicker: "Visibility",
          title: "Bias dashboard",
          lede: "Read flag rates, override rates, and override patterns at the workspace and recruiter level.",
          blocks: [
            {
              kind: "definitions",
              entries: [
                {
                  term: "Flag rate",
                  definition:
                    "Percentage of jobs (or applications) that triggered at least one bias flag during pre-publish (or scoring). High flag rate = team is using language patterns that need attention. Trending down over time = the team is learning.",
                },
                {
                  term: "Override rate",
                  definition:
                    "Percentage of bias flags that were overridden rather than accepted. Persistently high override rates suggest either over-eager detectors (tune them) or systemic recruiter resistance (worth a conversation).",
                },
                {
                  term: "Score override rate",
                  definition:
                    "Percentage of AI-computed match scores adjusted by recruiters. High rates can indicate AI miscalibration for a class of roles, or recruiter habits worth examining.",
                },
                {
                  term: "Disparate-impact view",
                  definition:
                    "Funnel conversion broken down by inferred demographic clusters (computed at the workspace aggregate, never per individual). Ratios outside the 80% rule trigger a review queue.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "These views are aggregates only",
              body: "We never expose demographic inference for an individual application — that would defeat the redaction. Disparate-impact views are computed at the workspace level using anonymized cluster proxies and are surfaced as ratios, not as individual labels.",
            },
          ],
        },
        {
          id: "review-queue",
          icon: FileSearch,
          kicker: "Action",
          title: "Fairness review queue",
          lede: "What lands here, why, and how to triage.",
          blocks: [
            {
              kind: "list",
              items: [
                "Workspaces with disparate-impact ratios outside the 80% rule.",
                "Recruiters with score-override rates above the 75th percentile of the platform for their volume.",
                "Job descriptions overridden past three accumulated bias flags.",
                "Direct candidate fairness reports (from /candidate/help → Report bias).",
              ],
            },
            {
              kind: "fields",
              entries: [
                {
                  label: "Triage steps",
                  description:
                    "Read the audit log for the affected workspace / job / recruiter. Decide: nothing-to-do, suggestion to workspace admin, or escalation.",
                },
                {
                  label: "Closing a review",
                  description:
                    "Closing always requires a written reason. Closures are themselves audited.",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      label: "Audit & compliance",
      sections: [
        {
          id: "audit-structure",
          icon: ScrollText,
          kicker: "Records",
          title: "Audit log structure",
          lede: "What an entry looks like, what it captures, and how it's protected.",
          blocks: [
            {
              kind: "matrix",
              head: ["Field", "Description"],
              rows: [
                ["id", "ULID; lexicographically sortable by time."],
                ["actor_user_id", "Who performed the action; null for system events."],
                ["actor_role", "candidate / recruiter / admin / system."],
                ["workspace_id", "Tenant scope (nullable for cross-workspace events)."],
                ["category", "Lifecycle, scoring, bias, offer, communication, config, identity."],
                ["action", "Specific verb (e.g. score.override, offer.send, prompt.bump)."],
                ["target_kind", "Resource type (job, application, user, prompt-version)."],
                ["target_id", "Resource ID."],
                ["before / after", "JSON diff of the resource state."],
                ["reason", "Free-text reason (required for overrides and escalations)."],
                ["created_at", "Server timestamp; not client-supplied."],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Append-only by construction",
              body: "Audit rows are written through a service that has INSERT-only privileges. There is no UPDATE or DELETE pathway from application code; expirations only happen via a privileged purge job that runs against the retention policy.",
            },
          ],
        },
        {
          id: "audit-export",
          icon: FileChartColumn,
          kicker: "Export",
          title: "Audit log export",
          lede: "How to pull a slice of the audit log for legal review or compliance.",
          blocks: [
            {
              kind: "steps",
              items: [
                {
                  title: "Open the audit page",
                  description:
                    "Sidebar → Audit Log. Filter by workspace, actor, category, and time range.",
                },
                {
                  title: "Choose the format",
                  description:
                    "JSONL (line-delimited; canonical) or CSV (denormalized; for spreadsheet review). Both are signed with a SHA-256 manifest so you can prove the export wasn't tampered with.",
                },
                {
                  title: "Download",
                  description:
                    "Exports of 1M+ rows queue in BullMQ and email you a download link when ready. Smaller exports stream synchronously.",
                },
              ],
            },
          ],
        },
        {
          id: "data-subject-requests",
          icon: BookOpen,
          kicker: "GDPR / DPA",
          title: "Data subject requests",
          lede: "Access, correction, and erasure — the operational playbook.",
          blocks: [
            {
              kind: "fields",
              entries: [
                {
                  label: "Access",
                  description:
                    "Candidates self-serve via Settings → Privacy → Export. For recruiter-initiated requests on behalf of a candidate, use Admin → Users → Export user.",
                },
                {
                  label: "Correction",
                  description:
                    "Profile fields are user-editable. For audit-recorded fields, corrections are logged as new audit entries, never as overwrites.",
                },
                {
                  label: "Erasure",
                  description:
                    "Settings → Privacy → Delete (candidate self-serve) or Admin → Users → Permanently remove. Erasure runs through a 30-day backup purge window. Audit records are retained in redacted form to preserve the audit chain.",
                },
                {
                  label: "Retention defaults",
                  description:
                    "Application + score data: 7 years from last activity (regulatory baseline). Audit logs: indefinite, redacted-form for purged users. Resume blobs: deleted on candidate erasure.",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      label: "System health",
      sections: [
        {
          id: "system-overview",
          icon: Activity,
          kicker: "Architecture",
          title: "What runs where",
          lede: "A reminder of the moving parts so you know where to look when something breaks.",
          blocks: [
            {
              kind: "fields",
              entries: [
                {
                  label: "Frontend",
                  description:
                    "Next.js 16 on Vercel. No DB access; talks to the backend via REST.",
                },
                {
                  label: "Backend",
                  description:
                    "NestJS on Railway. Owns DB writes, AI calls, queue jobs, and cron.",
                },
                {
                  label: "Database",
                  description:
                    "Supabase Postgres with row-level security. Schema lives in packages/db.",
                },
                {
                  label: "Auth",
                  description:
                    "Supabase Auth on the frontend; JWT validation guard on the backend; RLS on the DB as defense-in-depth.",
                },
                {
                  label: "Queue",
                  description:
                    "BullMQ on Upstash / Railway Redis. Resume parsing, scoring, email sends, and exports run as jobs.",
                },
                {
                  label: "Cron",
                  description:
                    "@nestjs/schedule. Daily digests, offer-expiration sweeps, and audit retention purges.",
                },
                {
                  label: "Email",
                  description:
                    "Mailpit in development; Resend in production. All template payloads are recorded in audit.",
                },
              ],
            },
          ],
        },
        {
          id: "queue-cron",
          icon: TimerReset,
          kicker: "Background work",
          title: "Queue & cron monitoring",
          lede: "Where to look when a background job is stuck.",
          blocks: [
            {
              kind: "list",
              items: [
                "BullMQ admin view (Admin → System Health → Queues) shows active, waiting, delayed, and failed jobs per queue.",
                "Failed jobs include the full stack trace and the input payload (redacted of PII).",
                "Cron schedules are visible in Admin → System Health → Cron with last-run timestamps and outcomes.",
                "Manual replay is available for failed jobs after the underlying issue is fixed — replays are logged.",
              ],
            },
          ],
        },
        {
          id: "email-deliverability",
          icon: Mail,
          kicker: "Mail",
          title: "Email deliverability",
          lede: "When an email isn't arriving, this is the order of operations.",
          blocks: [
            {
              kind: "steps",
              items: [
                {
                  title: "Check the audit log",
                  description:
                    "Audit category = communication. Confirm the email was actually queued — sometimes the trigger is the bug, not delivery.",
                },
                {
                  title: "Check Resend",
                  description:
                    "Production: Admin → System Health → Email shows recent Resend events (queued, delivered, bounced, complained).",
                },
                {
                  title: "Check Mailpit (dev)",
                  description:
                    "Development: open the local Mailpit UI on port 8025. Mail never leaves the developer machine.",
                },
                {
                  title: "Check sender domain auth",
                  description:
                    "SPF / DKIM / DMARC must be aligned. Misalignment causes silent bounces in major mail providers — Resend's domain page surfaces alignment failures.",
                },
              ],
            },
          ],
        },
        {
          id: "rls-and-rate-limits",
          icon: Database,
          kicker: "Posture",
          title: "RLS, rate limits, and uptime",
          lede: "What we promise, where we draw the line, and how we know we're meeting it.",
          blocks: [
            {
              kind: "list",
              items: [
                "RLS policies are tested per release; the test suite blocks deploy on any policy regression.",
                "API rate limits are per workspace, per user, and per endpoint — enforced in NestJS guards before any DB touch.",
                "Uptime SLO: 99.9% monthly for the API; 99.95% for the candidate portal. Status page surfaces incidents in real time.",
                "On-call rotation lives in the on-call playbook (referenced below) — incident commander handoff is documented.",
              ],
            },
          ],
        },
        {
          id: "incident-playbook",
          icon: OctagonAlert,
          kicker: "When things break",
          title: "Incident response",
          lede: "Stay calm, contain, communicate, then fix.",
          blocks: [
            {
              kind: "steps",
              items: [
                {
                  title: "Triage",
                  description:
                    "Confirm scope (which surface, which role, which workspace). Open an incident channel and post a one-line summary.",
                },
                {
                  title: "Contain",
                  description:
                    "Pause AI calls or external sends if any chance of cascading damage. AI calls and outbound emails both have admin-controlled kill switches.",
                },
                {
                  title: "Communicate",
                  description:
                    "Update the public status page within 15 minutes of declaring an incident. Affected workspace admins get an in-app banner and an email.",
                },
                {
                  title: "Fix and verify",
                  description:
                    "Fix the cause, not just the symptom. After fix, replay any failed background jobs that were affected and verify against audit log entries.",
                },
                {
                  title: "Postmortem",
                  description:
                    "Within five business days. Public summary on the status page; full technical postmortem in the on-call doc, including any action items with owners.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "danger",
              title: "Never skip the audit",
              body: "Even during an incident, audit log writes must succeed. If audit is the bottleneck, scaling audit comes before unblocking everything else — losing audit history is worse than the visible incident itself.",
            },
          ],
        },
        {
          id: "platform-controls",
          icon: Crown,
          kicker: "Kill switches",
          title: "Platform-wide kill switches",
          lede: "Last-resort controls. Use only when other paths are exhausted.",
          blocks: [
            {
              kind: "fields",
              entries: [
                {
                  label: "Pause AI scoring",
                  description:
                    "Halts all new scoring jobs platform-wide. Existing applications keep their last computed score; new applications enter Applied and stay unscored until resumed.",
                },
                {
                  label: "Pause outbound email",
                  description:
                    "Halts all outbound email (templated and admin-triggered). Triggers continue to fire and audit; the actual send is held until resumed.",
                },
                {
                  label: "Pause publishing",
                  description:
                    "Halts new job publishes. Existing jobs remain visible; recruiters can save drafts but cannot push them live.",
                },
                {
                  label: "Maintenance banner",
                  description:
                    "Displays a global banner on every portal explaining the situation. Use during planned migrations or active incidents.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Kill switches are audited",
              body: "Each toggle writes an audit entry with the actor, reason, and timestamp. There is no off-the-record way to flip these.",
            },
          ],
        },
      ],
    },
  ],
  faq: [
    {
      q: "Can I roll back a prompt version after it goes live?",
      a: "Yes — pin the active version back to the prior version. New scoring uses the pinned version; the bumped version stays in the registry for forensic comparison. The roll-back itself is audited with your reason.",
    },
    {
      q: "What triggers an audit log entry?",
      a: "Any consequential action: lifecycle changes, score overrides, bias flag dispositions, offer events, prompt or config changes, role changes, exports, kill-switch toggles, and any cross-workspace mutation. The full list lives in the audit category enum.",
    },
    {
      q: "How do I export the full audit log?",
      a: "Audit Log → Export. Filter, choose JSONL or CSV, and download (small) or queue + email (large). Every export is signed with a SHA-256 manifest.",
    },
    {
      q: "What's the retention policy for redacted PII?",
      a: "Resumes and PII fields are deleted on candidate erasure within the 30-day backup purge window. Audit records referencing the user are retained in redacted form so the audit chain stays intact.",
    },
    {
      q: "Can I add custom scoring criteria per job?",
      a: "Recruiters can add criteria from the standard types up to the platform bounds (max 8 criteria; max 60% per weight). Custom-prompt criteria are admin-approved per workspace and follow the same prompt versioning discipline as the platform prompts.",
    },
    {
      q: "How are bias flag rates calculated?",
      a: "Flag rate = (jobs with ≥1 flag) / (total published jobs) over the selected period. Override rate = (flags overridden) / (total flags raised). Both are computed at the workspace level and at the recruiter level.",
    },
    {
      q: "What if a recruiter overrides every AI score?",
      a: "The override rate surfaces in the bias dashboard and lands them in the fairness review queue past a threshold. The AI may also be poorly calibrated for their roles — both are worth investigating before assuming bad faith.",
    },
    {
      q: "Where do model latency budgets and cost caps live?",
      a: "Admin → AI Config → Performance. Budgets and caps are per-task and per-workspace, with platform-wide ceilings as the upper bound. All changes are versioned alongside prompt versions.",
    },
  ],
  contact: {
    title: "Need to escalate?",
    body: "Email the on-call line for incidents (24/7) or the standard support inbox for questions. Include workspace IDs and audit IDs whenever possible.",
    email: "oncall@aurahire.app",
    secondaryLink: { label: "Open the admin command center", href: "/admin" },
  },
};
