import {
  Activity,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  ChartLine,
  EyeOff,
  FileSearch,
  Layers,
  MessagesSquare,
  PanelsTopLeft,
  ScrollText,
  ShieldCheck,
  Signature,
  Star,
  Target,
  Workflow,
} from "lucide-react";
import type { HelpPageContent } from "../help-types";

export const recruiterHelp: HelpPageContent = {
  hero: {
    eyebrow: "Recruiter help center",
    title: "Hire fairly. Hire transparently. Hire faster.",
    lede: "Everything you need to publish jobs, review the pipeline, and act on AI-assisted scoring with confidence — every recommendation shows its work, and every override is auditable.",
  },
  groups: [
    {
      label: "Getting started",
      sections: [
        {
          id: "welcome",
          icon: PanelsTopLeft,
          kicker: "Orientation",
          title: "How AuraHire works for recruiters",
          lede: "A fast tour of the platform, the moving parts, and what the AI does — and doesn't — do.",
          blocks: [
            {
              kind: "paragraph",
              text: "AuraHire is an AI-assisted recruiting platform built around two non-negotiables: every score shows its evidence, and every job description is checked for biased language before it goes live. You stay in control of every decision; the AI accelerates triage and surfaces evidence you can act on.",
            },
            {
              kind: "fields",
              entries: [
                {
                  label: "What the AI does",
                  description:
                    "Parses resumes, redacts personal identifiers, scores each application against your job's weighted criteria, and produces an explainable breakdown with quoted evidence.",
                },
                {
                  label: "What the AI does not do",
                  description:
                    "It does not auto-reject candidates, hide applications from you, or change a candidate's lifecycle status. Every move from Applied → Hired is yours.",
                },
                {
                  label: "What you do",
                  description:
                    "Publish jobs, review the pipeline, schedule interviews, send offers, and override scores when your judgment differs. Overrides are recorded with your reason in the audit log.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Three layers of fairness, on by default",
              body: "Bias detection on every job description before publish · PII redaction before any AI scoring call · An immutable audit log for every consequential action and override.",
            },
          ],
        },
        {
          id: "publishing-jobs",
          icon: Briefcase,
          kicker: "Workflow",
          title: "Publish your first job",
          lede: "Drafting a role, running the bias check, and going live.",
          blocks: [
            {
              kind: "steps",
              items: [
                {
                  title: "Open Jobs → New job",
                  description:
                    "From the sidebar, choose Jobs, then click New job. You'll start in Draft mode — nothing is visible to candidates yet.",
                },
                {
                  title: "Fill in the role basics",
                  description:
                    "Title, employment type, location, work mode (remote / hybrid / onsite), salary range, and key responsibilities. Salary fields render in JetBrains Mono so numbers stay scannable.",
                },
                {
                  title: "Define your scoring criteria",
                  description:
                    "Add the skills, qualifications, and experience that matter, with relative weights. The AI uses these — not a generic template — to score every applicant.",
                },
                {
                  title: "Run the bias check",
                  description:
                    "Before you can publish, AuraHire scans your description for gendered, ageist, or otherwise discriminatory phrasing and surfaces inline suggestions. You can accept the rewrite, reject it, or override with a reason.",
                },
                {
                  title: "Publish",
                  description:
                    "Once flags are addressed (or overridden with a reason), publish the job. It appears on your public board and is open for applications immediately.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Overriding a bias flag",
              body: "If the AI flags 'rockstar developer' but the term is intentional, you can override — but the override is logged with your reason and surfaces in your bias dashboard so the team can pattern-match over time.",
            },
          ],
        },
        {
          id: "navigating-portal",
          icon: Layers,
          kicker: "Layout",
          title: "Find your way around",
          lede: "What lives where in the recruiter portal.",
          blocks: [
            {
              kind: "fields",
              entries: [
                {
                  label: "Dashboard",
                  description:
                    "Pipeline at a glance: KPIs, applications by status, top jobs by volume, and recent applications.",
                },
                {
                  label: "Jobs",
                  description:
                    "All jobs you've created — drafts, published, paused, closed. Click into any job to see its applicant list.",
                },
                {
                  label: "Shortlist",
                  description:
                    "Candidates you've starred across all jobs. A working set for follow-ups and team review.",
                },
                {
                  label: "Interviews",
                  description:
                    "Upcoming and past interviews across your pipeline, with calendar links and feedback forms.",
                },
                {
                  label: "Analytics",
                  description:
                    "Funnel conversion, time-to-hire, source effectiveness, and bias-flag/override rates for your team.",
                },
                {
                  label: "Settings",
                  description:
                    "Your contact info, role at the company, and notification preferences.",
                },
              ],
            },
            {
              kind: "kbd",
              entries: [
                { keys: ["⌘", "K"], description: "Search this help center" },
                { keys: ["G", "D"], description: "Go to Dashboard" },
                { keys: ["G", "J"], description: "Go to Jobs" },
                { keys: ["G", "I"], description: "Go to Interviews" },
                { keys: ["?"], description: "Show keyboard shortcuts" },
              ],
            },
          ],
        },
      ],
    },
    {
      label: "Scoring & explainability",
      sections: [
        {
          id: "how-scoring-works",
          icon: Target,
          kicker: "The thesis",
          title: "How match scoring works",
          lede: "From application submitted to a number on the screen — the full path, in plain language.",
          blocks: [
            {
              kind: "paragraph",
              text: "When a candidate applies, AuraHire runs a deterministic pipeline before the AI ever sees the resume. The result is a 0–100 match score for the role's specific weighted criteria, paired with a Score Ring, a Breakdown Bar, and quoted evidence from the resume itself.",
            },
            {
              kind: "steps",
              items: [
                {
                  title: "Resume parsing",
                  description:
                    "The PDF or DOCX is converted to structured text. Sections (experience, education, skills, projects) are tagged.",
                },
                {
                  title: "PII redaction",
                  description:
                    "Name, email, phone, photo, address, age, gender markers, and graduation years are masked. The AI never sees these fields.",
                },
                {
                  title: "Criterion-by-criterion scoring",
                  description:
                    "For each criterion you defined on the job, the AI extracts evidence from the redacted resume and assigns a sub-score, with quoted excerpts.",
                },
                {
                  title: "Weighted aggregation",
                  description:
                    "Sub-scores are combined using your weights to produce the overall 0–100 match score and a Strong / Partial / Limited Match label.",
                },
                {
                  title: "Audit recording",
                  description:
                    "The model used, prompt version, latency, redacted fields, and final score are written to the audit log — the score is reproducible.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "ai",
              title: "Why structured outputs matter",
              body: "Every AI call uses an OpenAI structured output schema. The model must return a Zod-validated JSON shape — never free text. That's how we can show you evidence chunks with confidence rather than scraping prose.",
            },
          ],
        },
        {
          id: "reading-score-ring",
          icon: Activity,
          kicker: "UI primer",
          title: "Reading the Score Ring and Breakdown Bar",
          lede: "Two surfaces, one story: the headline number and the contributing parts.",
          blocks: [
            {
              kind: "definitions",
              entries: [
                {
                  term: "Score Ring",
                  definition:
                    "The circular gauge with a JetBrains Mono number at its center. Color (red / amber / green) maps to the match band, not to candidate worth.",
                },
                {
                  term: "Score Breakdown Bar",
                  definition:
                    "A horizontal stacked bar where each segment represents one criterion, sized by its weight and colored by its sub-score. Click any segment to open evidence.",
                },
                {
                  term: "Evidence callout",
                  definition:
                    "A quoted excerpt from the resume that drove a sub-score, with a left border in the band color and the exact contribution in points.",
                },
                {
                  term: "Match band chip",
                  definition:
                    "The plain-language label paired with every numeric score: Strong Match (70–100), Partial Match (40–69), Limited Match (0–39).",
                },
              ],
            },
            {
              kind: "matrix",
              head: ["Score range", "Match band", "Recommended action"],
              rows: [
                [
                  "70 – 100",
                  "Strong Match",
                  "Prioritize for screening; evidence aligns with most criteria.",
                ],
                [
                  "40 – 69",
                  "Partial Match",
                  "Worth reviewing; gaps may be coachable or context-dependent.",
                ],
                [
                  "0 – 39",
                  "Limited Match",
                  "Likely not aligned, but always read the evidence before rejecting.",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Numbers without evidence are not allowed",
              body: "Anywhere you see a score, you can click into the breakdown and the underlying evidence. If you ever see a score without a click-through, that's a bug — please tell us.",
            },
          ],
        },
        {
          id: "evidence-and-overrides",
          icon: FileSearch,
          kicker: "Decisions",
          title: "Acting on evidence — and overriding when you disagree",
          lede: "The AI is wrong sometimes. Your override is welcome, and tracked.",
          blocks: [
            {
              kind: "paragraph",
              text: "On every application detail page, the breakdown reveals the quoted excerpts that drove each sub-score. If you disagree with how the AI interpreted a phrase, you can adjust the criterion's sub-score with a one-line reason. Your override becomes part of the application's history.",
            },
            {
              kind: "fields",
              entries: [
                {
                  label: "Bump up",
                  description:
                    "Use when the resume evidence is stronger than the AI inferred — e.g. a relevant project hidden in the 'Personal' section.",
                },
                {
                  label: "Bump down",
                  description:
                    "Use when the AI weighted a buzzword too heavily and the actual experience is shallow.",
                },
                {
                  label: "Reset to AI",
                  description:
                    "Removes your manual override and restores the original AI-computed sub-score.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Override patterns are observed",
              body: "Persistent override patterns (e.g. always bumping down a specific criterion) get surfaced in the analytics view — useful both for catching AI miscalibration and for keeping individual recruiters honest with themselves.",
            },
          ],
        },
      ],
    },
    {
      label: "Fair hiring",
      sections: [
        {
          id: "bias-mitigation",
          icon: ShieldCheck,
          kicker: "Pre-publish",
          title: "Bias mitigation in job descriptions",
          lede: "Catch discriminatory or exclusionary language before it ever reaches a candidate.",
          blocks: [
            {
              kind: "paragraph",
              text: "Every job description goes through a bias check on save. The check looks for gendered language, age-coded phrases, ableist terms, culturally exclusive idioms, and overly aggressive 'culture fit' language. Flags surface inline as amber chips — click to read the explanation, accept a rewrite, or override with a reason.",
            },
            {
              kind: "definitions",
              entries: [
                {
                  term: "Gendered language",
                  definition:
                    "Phrases that statistically correlate with one gender — 'rockstar', 'ninja', 'aggressive', 'nurturing'. The check suggests neutral alternatives.",
                },
                {
                  term: "Age coding",
                  definition:
                    "Implicit age signals like 'digital native', 'recent graduate', 'energetic team' that filter older applicants without stating an age requirement.",
                },
                {
                  term: "Ableist language",
                  definition:
                    "Phrases that exclude candidates with disabilities — 'must be able to walk the floor', 'high-energy environment' — when the underlying requirement is something else.",
                },
                {
                  term: "Culture fit traps",
                  definition:
                    "Vague phrases like 'culture fit' or 'work hard, play hard' that filter on similarity rather than skill.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Overrides are not punishments",
              body: "Sometimes the flag is wrong for your context. Overriding a flag is fine and expected — but the override and your reason are saved, and the team can review override patterns in the bias dashboard.",
            },
          ],
        },
        {
          id: "pii-redaction",
          icon: EyeOff,
          kicker: "Privacy",
          title: "What the AI sees (and what it doesn't)",
          lede: "PII redaction happens before any scoring call. You see the full resume; the AI does not.",
          blocks: [
            {
              kind: "fields",
              entries: [
                {
                  label: "Redacted before scoring",
                  description:
                    "Full name, email, phone, profile photo, street address, date of birth / age, gender markers, graduation year, names of schools (replaced with tier/region tokens), and any free-text mention of the above patterns.",
                },
                {
                  label: "Visible to the AI",
                  description:
                    "Skills, technologies, work history dates and durations, role titles, project descriptions, certifications, languages, and explicit qualifications.",
                },
                {
                  label: "Visible to you",
                  description:
                    "The full, unredacted resume — the redaction only applies to the AI's input. You see the complete document the candidate uploaded.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "ai",
              title: "Why we redact",
              body: "Stripping PII before scoring is the cheapest, highest-leverage fairness intervention available. A model that never sees a name can't pattern-match on names. A model that never sees a graduation year can't pattern-match on age. The audit log records exactly which fields were redacted on every scoring call.",
            },
          ],
        },
        {
          id: "audit-logs",
          icon: ScrollText,
          kicker: "Accountability",
          title: "Every consequential action is recorded",
          lede: "Audit logs are non-optional. They exist so that any decision can be reproduced, defended, or revisited.",
          blocks: [
            {
              kind: "paragraph",
              text: "AuraHire writes an audit log entry every time someone publishes a job, scores an application, overrides a score, changes a candidate's lifecycle status, sends an offer, or rejects an application. Logs are immutable from the recruiter portal — only admins can export them, and even admins cannot edit history.",
            },
            {
              kind: "list",
              items: [
                "Job published, paused, edited, or closed (with diff)",
                "Bias flag raised, accepted, or overridden (with reason)",
                "Application scored (model, prompt version, latency, redacted fields, final score)",
                "Score override (criterion, before / after, reason)",
                "Lifecycle status change (Applied → Screening → Interview → Offer → Hired / Rejected)",
                "Offer sent, accepted, declined, or expired",
                "Communication sent (template id, recipient)",
              ],
            },
          ],
        },
      ],
    },
    {
      label: "Pipeline & workflow",
      sections: [
        {
          id: "lifecycle",
          icon: Workflow,
          kicker: "States",
          title: "Application lifecycle",
          lede: "How a candidate moves from Applied to Hired — and what happens at each stage.",
          blocks: [
            {
              kind: "matrix",
              head: ["State", "What it means", "Who triggered it"],
              rows: [
                [
                  "Applied",
                  "Application submitted; AI scoring in progress or complete.",
                  "Candidate",
                ],
                [
                  "Screening",
                  "You're actively reviewing — sometimes with a phone call or skills test.",
                  "Recruiter",
                ],
                [
                  "Interview",
                  "Interview scheduled or in progress; feedback being collected.",
                  "Recruiter",
                ],
                [
                  "Offer",
                  "Offer extended; awaiting candidate response.",
                  "Recruiter",
                ],
                [
                  "Hired",
                  "Candidate accepted; the role is filled.",
                  "Recruiter",
                ],
                [
                  "Rejected",
                  "Not moving forward (you may set a stage and a reason).",
                  "Recruiter",
                ],
                [
                  "Withdrawn",
                  "Candidate withdrew their own application.",
                  "Candidate",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Status changes trigger emails",
              body: "Moving a candidate to Interview, Offer, or Rejected sends a templated email automatically. You can preview and customize the template per job in the job's communication settings.",
            },
          ],
        },
        {
          id: "shortlist",
          icon: Star,
          kicker: "Curation",
          title: "Shortlist — your working set",
          lede: "Star candidates across jobs and pull them up in one place.",
          blocks: [
            {
              kind: "list",
              items: [
                "Star a candidate from any application detail page.",
                "Stars are private to you, not visible to candidates or other recruiters.",
                "The Shortlist view aggregates stars across every job in your workspace, so you can hand-pick a session of follow-ups.",
                "Removing a star never deletes the application — it just removes it from your shortlist.",
              ],
            },
          ],
        },
        {
          id: "interviews",
          icon: Calendar,
          kicker: "Scheduling",
          title: "Interviews",
          lede: "Schedule, reschedule, send invites, and capture feedback.",
          blocks: [
            {
              kind: "steps",
              items: [
                {
                  title: "Schedule from the application detail page",
                  description:
                    "Choose date, time, mode (video, phone, on-site), interviewer(s), and an optional agenda.",
                },
                {
                  title: "Auto-generated invite",
                  description:
                    "Candidate receives an email with a calendar attachment and meeting link. You receive a parallel email for your calendar.",
                },
                {
                  title: "Reschedule or cancel",
                  description:
                    "From the Interviews page, click the interview row. Both reschedule and cancel send a notice email and write to the audit log.",
                },
                {
                  title: "Capture feedback",
                  description:
                    "After the interview, structured feedback (strengths, concerns, recommendation) is captured per interviewer and surfaces on the application detail page.",
                },
              ],
            },
          ],
        },
        {
          id: "offers",
          icon: Signature,
          kicker: "Closing",
          title: "Offers",
          lede: "Send an offer, set an expiration, and handle accept / decline / expire.",
          blocks: [
            {
              kind: "fields",
              entries: [
                {
                  label: "Sending an offer",
                  description:
                    "From an application in Interview state, click Send offer. Include compensation, start date, and a free-text body. The candidate receives an email with an Accept / Decline action.",
                },
                {
                  label: "Expiration",
                  description:
                    "Every offer has an explicit expiration. If the candidate does not respond by then, the offer auto-expires and an audit entry is written.",
                },
                {
                  label: "Acceptance",
                  description:
                    "On accept, the application moves to Hired and the role's open count decrements. You receive a notification.",
                },
                {
                  label: "Decline",
                  description:
                    "On decline, the application moves back to a state of your choosing (typically Interview or Rejected).",
                },
              ],
            },
            {
              kind: "callout",
              tone: "danger",
              title: "Offers are legally consequential",
              body: "Once sent, an offer becomes part of your record. Edits after sending are blocked — you must rescind and re-send, both of which are logged.",
            },
          ],
        },
        {
          id: "communication",
          icon: MessagesSquare,
          kicker: "Email",
          title: "Communication & templates",
          lede: "Lifecycle changes trigger templated emails. You control the wording.",
          blocks: [
            {
              kind: "list",
              items: [
                "Application received — sent on submission.",
                "Status changed — sent when you move the candidate to a new stage.",
                "Interview scheduled / rescheduled / cancelled — sent on the corresponding action.",
                "Offer sent / expired — sent on offer events.",
                "Decision (acceptance / rejection) — sent when you finalize.",
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Sandbox vs. production",
              body: "In development, all emails route to Mailpit on localhost so you can test freely. In production, emails go through Resend and respect your sender domain authentication.",
            },
          ],
        },
      ],
    },
    {
      label: "Insights & settings",
      sections: [
        {
          id: "analytics",
          icon: ChartLine,
          kicker: "Measurement",
          title: "Analytics — what to look at and why",
          lede: "Funnel health, time-to-hire, and fairness signals.",
          blocks: [
            {
              kind: "definitions",
              entries: [
                {
                  term: "Funnel conversion",
                  definition:
                    "Percentage of applicants who advance to each next stage. Sudden drops between stages are usually a process problem, not a candidate-quality problem.",
                },
                {
                  term: "Time-to-hire",
                  definition:
                    "Median days from Applied to Hired. Tracked per job and per recruiter.",
                },
                {
                  term: "Bias flag rate",
                  definition:
                    "Percentage of your job descriptions that triggered at least one bias flag. Trending up suggests team-wide language drift; trending down suggests learning.",
                },
                {
                  term: "Override rate",
                  definition:
                    "Percentage of AI scores or bias flags you've overridden. Very high overrides can mean the AI is poorly calibrated for your roles — worth a conversation with admin to revisit weights or prompts.",
                },
              ],
            },
          ],
        },
        {
          id: "team-and-workspace",
          icon: Building2,
          kicker: "Workspace",
          title: "Workspace, team, and roles",
          lede: "Who's on your team, what they can do, and how to invite more recruiters.",
          blocks: [
            {
              kind: "fields",
              entries: [
                {
                  label: "Workspace",
                  description:
                    "A company / tenant. All recruiters in your workspace share jobs, candidates, and analytics.",
                },
                {
                  label: "Recruiter role",
                  description:
                    "Can publish jobs, review applications, send offers, and override scores. Cannot edit prompt versions or scoring config.",
                },
                {
                  label: "Admin role",
                  description:
                    "Everything a recruiter can do, plus user management, AI configuration, audit log export, and bias monitoring.",
                },
                {
                  label: "Inviting teammates",
                  description:
                    "Settings → Team → Invite. The invitee receives an email with a one-time link to join your workspace as a recruiter (admin invites require an existing admin).",
                },
              ],
            },
          ],
        },
        {
          id: "notifications",
          icon: Bell,
          kicker: "Alerts",
          title: "Notifications",
          lede: "What you'll be told about, by which channel.",
          blocks: [
            {
              kind: "matrix",
              head: ["Event", "In-app", "Email"],
              rows: [
                ["New application on a job you own", "Yes", "Daily digest"],
                ["Candidate accepted or declined an offer", "Yes", "Immediate"],
                ["Interview reminder (2h before)", "Yes", "Yes"],
                ["Bias flag rate threshold crossed", "Yes", "Weekly summary"],
                ["Offer auto-expired without response", "Yes", "Immediate"],
              ],
            },
          ],
        },
      ],
    },
  ],
  faq: [
    {
      q: "Why does this candidate have a low score even though they look qualified?",
      a: "The score reflects how the resume's evidence matches the criteria and weights you set on the job. Open the breakdown — if a criterion has thin evidence in the resume, the AI scored conservatively. You can override with a reason if you have context the resume doesn't show.",
    },
    {
      q: "Can I override an AI decision?",
      a: "Yes. You can adjust any criterion's sub-score, accept or override any bias flag, and move candidates through the lifecycle freely. Every override is logged with your reason.",
    },
    {
      q: "What happens when I flag a job description as biased — or override a flag?",
      a: "Accepted suggestions are applied to the description before publish. Overrides are recorded with your reason and surface in the bias dashboard so the team can spot patterns over time.",
    },
    {
      q: "How do candidates know they applied and what their status is?",
      a: "They receive an Application Received email immediately, and a Status Changed email whenever you advance, reject, or otherwise move them. Templates are customizable per job.",
    },
    {
      q: "Can I export application data?",
      a: "Recruiters can export per-job CSVs of candidate names, statuses, and scores. Full audit log export is admin-only.",
    },
    {
      q: "How long are scores cached?",
      a: "Scores are computed once per (resume version, job version) pair. If the candidate uploads a new resume version, or you edit the job's scoring criteria, the score is recomputed and the new score is logged alongside the old one.",
    },
    {
      q: "What if a candidate updates their resume after I scored them?",
      a: "You'll see a notice on the application detail page. The new score is computed; the previous score is preserved in the application's history so the trajectory is clear.",
    },
    {
      q: "Can I disable AI scoring entirely for a job?",
      a: "No — the score is part of the audit trail. You can ignore the score and review applications manually, but you cannot prevent the score from being computed and logged.",
    },
  ],
  contact: {
    title: "Still stuck? We read every message.",
    body: "Email support — you'll typically hear back within one business day. Include your workspace name and the URL of the screen you're on for the fastest reply.",
    email: "hello@aurahire.site",
    secondaryLink: {
      label: "Back to the recruiter dashboard",
      href: "/recruiter",
    },
  },
};
