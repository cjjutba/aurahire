import {
  Briefcase,
  Calendar,
  ClipboardList,
  Edit3,
  FileText,
  Handshake,
  KanbanSquare,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkle,
  Sparkles,
  Target,
  UserCheck,
  Workflow,
} from "lucide-react";
import type { HowItWorksContent } from "../how-it-works-types";

export const recruiterHowItWorks: HowItWorksContent = {
  hero: {
    eyebrow: "How AuraHire works for recruiters",
    title: "Hire fairly. Hire transparently. Hire faster.",
    lede: "AuraHire is built so you can defend every score and every stage decision. The AI does the reading, the sorting, and the surfacing — you do the deciding. This walkthrough explains the entire workflow, from drafting a job to extending an offer.",
  },
  journey: {
    title: "Your end-to-end workflow",
    steps: [
      {
        label: "Draft",
        description: "Write the role; the AI checks for biased language as you type.",
        icon: Edit3,
        targetId: "draft-and-bias-check",
      },
      {
        label: "Publish",
        description: "Push live across the candidate-facing job board.",
        icon: ScrollText,
        targetId: "publish",
      },
      {
        label: "Receive",
        description: "Applications arrive scored, redacted, and ready to triage.",
        icon: ClipboardList,
        targetId: "receiving-applications",
      },
      {
        label: "Triage",
        description: "Pipeline view with scores, breakdowns, and evidence per row.",
        icon: KanbanSquare,
        targetId: "pipeline-and-triage",
      },
      {
        label: "Interview",
        description: "Schedule, take notes, and assess on the platform.",
        icon: Calendar,
        targetId: "interviews",
      },
      {
        label: "Decide",
        description: "Offer or decline with a reason — every action audited.",
        icon: Handshake,
        targetId: "outcomes",
      },
    ],
  },
  groups: [
    {
      label: "Foundations",
      sections: [
        {
          id: "the-thesis",
          icon: Sparkles,
          kicker: "Why we built this",
          title: "The defensibility thesis",
          lede: "Every score and every stage decision needs to be explainable to a candidate, an internal stakeholder, or an auditor. AuraHire is the platform that makes that easy.",
          blocks: [
            {
              kind: "paragraph",
              text: "Most recruiting platforms make scoring opaque to candidates while making it equally opaque to you, the recruiter — you see numbers without rationale. AuraHire flips that: the same evidence trail shown to candidates is shown to you, plus the controls to override, re-score, and document any decision.",
            },
            {
              kind: "fields",
              entries: [
                {
                  label: "Defensible scores",
                  description:
                    "Every match score is broken down per criterion with the exact resume evidence that earned (or failed to earn) the points. If a score is questioned, you can answer with specifics, not 'the algorithm decided.'",
                },
                {
                  label: "Bias mitigation upstream",
                  description:
                    "Job descriptions are checked before publication for language that disadvantages protected groups. Applicant resumes are PII-redacted before scoring so the AI reasons about evidence, not identifiers.",
                },
                {
                  label: "Human authority preserved",
                  description:
                    "You can override the score band, advance a candidate the AI ranked low, or decline one it ranked high. Every override is logged with a reason and visible on the audit trail.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "What 'AI assists, humans decide' means in practice",
              body: "The AI never auto-rejects a candidate, never auto-advances one, and never sends an outcome notification on its own. It produces a score, a breakdown, and a rationale — you do everything else.",
            },
          ],
        },
      ],
    },
    {
      label: "Posting a role",
      sections: [
        {
          id: "draft-and-bias-check",
          icon: Edit3,
          kicker: "Step 1",
          title: "Draft the role with live bias checking",
          lede: "Write the job description; the AI flags potentially biased language as you type and offers neutral alternatives.",
          blocks: [
            {
              kind: "paragraph",
              text: "When you create or edit a job, our bias detector scans the description for terms historically associated with adverse impact (age-coded language, gendered descriptors, exclusionary qualifications). Each flag appears as an inline chip on the offending phrase with an explanation and one or more suggested replacements.",
            },
            {
              kind: "steps",
              items: [
                {
                  title: "Title and core fields",
                  description:
                    "Title, location, work model (remote / hybrid / on-site), employment type, and salary range. Salary range is mandatory — disclosure is increasingly required by law and increases candidate quality.",
                },
                {
                  title: "Criteria the AI scores against",
                  description:
                    "Must-have skills, nice-to-have skills, experience range, required and preferred education or certifications. These are the only fields used by the scoring engine. Anything outside this list is for candidate context, not scoring.",
                },
                {
                  title: "Description and responsibilities",
                  description:
                    "The narrative section. The bias checker runs here — flags appear inline as you type or paste. You can accept the suggestion, edit your phrasing, or override the flag with a documented reason.",
                },
                {
                  title: "Application form",
                  description:
                    "Optional role-specific questions presented to candidates at submission. Use sparingly — every question adds friction and lowers application volume.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Overriding a bias flag is logged",
              body: "If you choose to override a flag and keep the original phrasing, the override is recorded with your user, the timestamp, and an optional reason. This protects you in audit and forces the decision to be conscious, not casual.",
            },
            {
              kind: "callout",
              tone: "ai",
              title: "Why we flag, not block",
              body: "Bias detection is heuristic — it has false positives. We surface the flag and let you decide, rather than block publication. Outright blocking would push you to draft the description outside the platform and paste it back, defeating the purpose.",
            },
          ],
        },
        {
          id: "publish",
          icon: ScrollText,
          kicker: "Step 2",
          title: "Publish to the candidate-facing job board",
          lede: "Once you publish, the role appears on the AuraHire job board. You control visibility, status, and snapshots.",
          blocks: [
            {
              kind: "fields",
              entries: [
                {
                  label: "Visibility",
                  description:
                    "Public on the job board immediately. You can also unpublish at any time — existing applications stay in the pipeline, but no new ones come in.",
                },
                {
                  label: "Editing after publish",
                  description:
                    "Edits are versioned. The criteria a candidate was scored against are pinned to their application — so if you change the criteria mid-flight, existing scores don't silently shift.",
                },
                {
                  label: "Pause vs. close",
                  description:
                    "Pause keeps the pipeline open but stops new applications. Close archives the role and freezes the pipeline. Both actions notify candidates currently in stages.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Versioned criteria",
              body: "If you publish a role at v1, then edit the must-have skills to v2, candidates who applied under v1 keep their v1 scores until you explicitly re-score them. Score history is visible per-candidate.",
            },
          ],
        },
      ],
    },
    {
      label: "When applications arrive",
      sections: [
        {
          id: "receiving-applications",
          icon: ClipboardList,
          kicker: "Step 3",
          title: "Applications arrive scored and redacted",
          lede: "Every new application is scored against your role criteria automatically. You see the score, the breakdown, and the redacted evidence first — names come later, by your choice.",
          blocks: [
            {
              kind: "paragraph",
              text: "When a candidate submits, our scoring engine runs against the application within seconds. The result is a 0–100 match score (quantized to 5-point bands), a breakdown bar showing each criterion's contribution, and an evidence panel with the exact resume excerpts cited. Applications appear in your pipeline as 'New' with the score visible from the row.",
            },
            {
              kind: "matrix",
              head: ["Surface", "What you see", "What's redacted"],
              rows: [
                ["Pipeline row (collapsed)", "Score, match band, role-fit summary, applied date.", "Name, photo, contact info."],
                ["Pipeline row (expanded)", "All of the above + breakdown bar + skills matched.", "Same — name still hidden until you click 'Reveal.'"],
                ["Candidate detail page", "Full profile, contact info, evidence panel, history.", "Nothing — but the page records that you opened it."],
                ["Bulk actions", "Operate on filtered sets without revealing identities.", "Names redacted in the action confirmation modal."],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Reveal-on-demand identity",
              body: "Identity reveal is a deliberate action, not the default. The intent is to keep first-pass triage focused on evidence, not on names you might recognize. Reveals are logged with timestamp and user.",
            },
          ],
        },
        {
          id: "score-anatomy",
          icon: Target,
          kicker: "Step 4",
          title: "Anatomy of a match score",
          lede: "How the 0–100 number is built — and where to look when it surprises you.",
          blocks: [
            {
              kind: "paragraph",
              text: "The match score is a weighted sum of per-criterion sub-scores. The deterministic component (skills, years, education) is computed by rule; the AI component (role-fit narrative) is generated by a model from the redacted resume. Both are summed by the strict-sum reconciliation rule — the parts add up to the whole, with no opaque adjustment.",
            },
            {
              kind: "definitions",
              entries: [
                {
                  term: "Score Ring",
                  definition:
                    "Headline number 0–100. Quantized to nearest 5. Color-banded: red for 0–39, amber for 40–69, green for 70–100. The number is in JetBrains Mono for tabular legibility.",
                },
                {
                  term: "Breakdown Bar",
                  definition:
                    "Horizontal stacked bar where each segment's width = the criterion's weight, color = the candidate's score in that criterion. Click any segment for the evidence behind it.",
                },
                {
                  term: "Evidence Callout",
                  definition:
                    "Quoted excerpt from the candidate's resume that earned (or failed to earn) the points for a given criterion. Includes a contribution counter showing exact point delta.",
                },
                {
                  term: "Strict-sum reconciliation",
                  definition:
                    "The rule that the final score equals the sum of weighted criterion scores — nothing else. Quantization is applied last. There is no implicit bonus or hidden adjustment.",
                },
                {
                  term: "Calibration warning",
                  definition:
                    "If a score's confidence interval is unusually wide (e.g., resume was sparse, or AI rationale flagged uncertainty), a calibration warning chip appears alongside the score.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "ai",
              title: "Why scores quantize to 5-point bands",
              body: "A 73 vs. 75 isn't a meaningful gap, but it would feel like one. We quantize so cosmetic precision doesn't drive triage decisions. The breakdown is the real signal — the headline number is honest about its precision.",
            },
          ],
        },
        {
          id: "pipeline-and-triage",
          icon: KanbanSquare,
          kicker: "Step 5",
          title: "Pipeline triage: how to use the board",
          lede: "Stages, filters, sorting, and the evidence-first review workflow.",
          blocks: [
            {
              kind: "steps",
              items: [
                {
                  title: "Sort and filter",
                  description:
                    "Default sort is by match score descending. You can filter by stage, score band, missing must-haves, applied date, or location. All filters operate on the redacted view.",
                },
                {
                  title: "Open the breakdown before the name",
                  description:
                    "Click a row to expand the breakdown and evidence. Decide whether to advance based on what's there. Reveal the candidate's identity only when you're ready to make a stage move.",
                },
                {
                  title: "Move stages",
                  description:
                    "Drag-and-drop or use the per-row stage selector. Stages: New → Screening → Interview → Offer → Hired (terminal) and Rejected (terminal). Custom stages can be added per role.",
                },
                {
                  title: "Decline with a reason",
                  description:
                    "Declining a candidate requires picking a reason from a fixed list (so reasons are consistent and reportable). Free-text justifications are not stored — the category is what's auditable.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Bulk stage moves are scoped",
              body: "You can move multiple candidates at once — but only within the same stage and only with one declining reason. This prevents accidental mass-rejects and keeps the audit trail clean.",
            },
          ],
        },
        {
          id: "overrides",
          icon: UserCheck,
          kicker: "Step 6",
          title: "Overriding the AI's recommendation",
          lede: "Whenever the score doesn't match the candidate, you have full authority to override.",
          blocks: [
            {
              kind: "paragraph",
              text: "The AI is an assistant, not a gatekeeper. If a candidate scored low but the breakdown shows a single missing must-have that's actually negotiable for this role, advance them. If a candidate scored high but their evidence doesn't pass smell-test, decline them. Every override is logged.",
            },
            {
              kind: "fields",
              entries: [
                {
                  label: "Stage override",
                  description:
                    "Move a low-scored candidate forward, or skip a high-scored candidate. The override is recorded with your user and timestamp. No reason is required, but you can attach a note.",
                },
                {
                  label: "Re-score after edits",
                  description:
                    "If you edit the role criteria after a candidate has applied, you can manually re-score them against the new criteria. The old and new scores are kept on the audit trail.",
                },
                {
                  label: "Manual score adjustment",
                  description:
                    "Disabled by default. Admins can enable per-role manual score editing — but every adjustment requires a reason and is flagged on the bias monitoring dashboard.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Patterns of overrides are watched",
              body: "Repeated overrides in one direction (always advancing low scores from one demographic, always declining high scores from another) trigger a calibration alert to admins. Individual overrides are normal and expected; patterns are what we flag.",
            },
          ],
        },
      ],
    },
    {
      label: "Interviews and decisions",
      sections: [
        {
          id: "interviews",
          icon: Calendar,
          kicker: "Step 7",
          title: "Scheduling and conducting interviews",
          lede: "Propose times, capture notes, and aggregate panel feedback in one place.",
          blocks: [
            {
              kind: "steps",
              items: [
                {
                  title: "Propose interview slots",
                  description:
                    "Open the candidate's detail page, choose 'Schedule Interview,' and propose 2–4 time slots. The candidate picks one. Both parties get calendar invites with timezone-correct details.",
                },
                {
                  title: "Capture interviewer notes",
                  description:
                    "Each interviewer fills in a structured rubric on the platform. Free-form impressions are optional; rubric scores are mandatory and become part of the candidate record.",
                },
                {
                  title: "Aggregate panel feedback",
                  description:
                    "After all interviewers have submitted, the candidate detail shows an aggregated rubric score alongside individual responses. Disagreement on the panel is shown — not averaged away.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Interview rubrics are role-versioned",
              body: "Each role has a rubric definition pinned to its version. If you change the rubric mid-pipeline, candidates already interviewed keep their original rubric scores. New interviews use the new rubric.",
            },
          ],
        },
        {
          id: "outcomes",
          icon: Handshake,
          kicker: "Step 8",
          title: "Outcomes: offer, decline, or hold",
          lede: "Every outcome is communicated to the candidate. Every outcome is logged.",
          blocks: [
            {
              kind: "matrix",
              head: ["Outcome", "What you do", "What the candidate sees"],
              rows: [
                [
                  "Send offer",
                  "Compose offer with role, comp, start date, and conditions.",
                  "Offer detail in their dashboard with Accept / Decline / Negotiate actions.",
                ],
                [
                  "Decline",
                  "Pick a reason category from the fixed list. Optional note for the audit trail (not shown to candidate).",
                  "Notification with the reason category. They can ask for more detail; you're encouraged to respond.",
                ],
                [
                  "Hold",
                  "Move the role to 'On hold' (often for budget). Pipeline is preserved.",
                  "Status change with optional message you compose.",
                ],
                [
                  "Hire (after acceptance)",
                  "Mark the candidate as 'Hired.' Role auto-closes if it was a single-headcount opening.",
                  "Confirmation of acceptance and any onboarding info you attached.",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "success",
              title: "Why decline reasons are categorical, not free-text",
              body: "Categorical reasons are reportable, comparable across roles, and auditable. Free-text reasons drift over time — 'not a culture fit' means different things to different recruiters. The category list is editable by admins, but every decline picks from it.",
            },
          ],
        },
      ],
    },
    {
      label: "Audit, fairness, and accountability",
      sections: [
        {
          id: "audit-trail",
          icon: ShieldCheck,
          kicker: "Defensibility",
          title: "Every action is on the record",
          lede: "Score computations, stage moves, identity reveals, overrides, and outcomes are all logged.",
          blocks: [
            {
              kind: "paragraph",
              text: "AuraHire writes an audit log entry for every consequential action: when a score was computed (with prompt version, model used, latency, and redacted fields), when a stage changed, when an identity was revealed, when an override was made, and when an outcome was sent. The log is immutable and queryable per role, per candidate, and per recruiter.",
            },
            {
              kind: "fields",
              entries: [
                {
                  label: "Per-role audit",
                  description:
                    "Open any role to see its audit timeline: who created it, who edited what fields, who declined which candidates and with what reasons, who advanced whom.",
                },
                {
                  label: "Per-candidate audit",
                  description:
                    "Each candidate detail has an 'Activity' tab showing every action ever taken on their application — by you, by other recruiters, and by the AI.",
                },
                {
                  label: "Audit export",
                  description:
                    "Admins can export the audit log per role for legal review or internal investigation. Exports are themselves logged.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Audit logs survive deletes",
              body: "If a candidate deletes their account, their personal data is removed — but the audit record of actions taken on their application is anonymized and retained. We need that record to defend any claim that a process was followed.",
            },
          ],
        },
        {
          id: "bias-monitoring",
          icon: ShieldAlert,
          kicker: "Fairness loop",
          title: "How bias is monitored, not just claimed",
          lede: "The platform measures fairness continuously and surfaces drift to admins. You'll occasionally see calibration prompts.",
          blocks: [
            {
              kind: "paragraph",
              text: "Bias mitigation isn't a one-time configuration — it's an ongoing measurement. We compare scoring patterns and stage outcomes across demographic categories (where we can infer them from publicly available signals) and across recruiters. Drift triggers calibration warnings on the admin dashboard. As a recruiter, you might be prompted occasionally to review a flagged pattern in your decisions.",
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Calibration prompts are not accusations",
              body: "If you receive a calibration prompt, it means a pattern crossed a statistical threshold — not that you've done anything wrong. Reviewing the pattern is a chance to confirm the decisions were sound, or to recognize a habit you'd want to change.",
            },
          ],
        },
      ],
    },
    {
      label: "Reference",
      sections: [
        {
          id: "scoring-glossary",
          icon: Briefcase,
          kicker: "Glossary",
          title: "Terms you'll see in your portal",
          lede: "A short reference for the labels and badges that appear throughout the recruiter workspace.",
          blocks: [
            {
              kind: "definitions",
              entries: [
                {
                  term: "Match score",
                  definition: "0–100 number representing alignment between an application and the role's criteria. Quantized to the nearest 5.",
                },
                {
                  term: "Match band",
                  definition: "Plain-language label for a score: Limited Match (0–39), Partial Match (40–69), Strong Match (70–100).",
                },
                {
                  term: "Bias flag",
                  definition: "Inline chip in the job description editor warning about potentially biased language. Includes explanation and suggested replacement.",
                },
                {
                  term: "Calibration warning",
                  definition: "A chip beside a score indicating the underlying inputs were unusually sparse or uncertain; the score should be weighted accordingly.",
                },
                {
                  term: "Override log",
                  definition: "The audit record of every time you advanced a low-scored candidate or declined a high-scored one. Visible per recruiter and per role.",
                },
                {
                  term: "Identity reveal",
                  definition: "The deliberate action of unredacting a candidate's name and contact info on their application. Reveals are logged.",
                },
              ],
            },
          ],
        },
        {
          id: "human-vs-ai",
          icon: Workflow,
          kicker: "Boundaries",
          title: "Human authority vs. AI assistance",
          lede: "A clear map of what's automated and what's yours.",
          blocks: [
            {
              kind: "matrix",
              head: ["Step", "AI does", "You do"],
              rows: [
                ["Bias check on jobs", "Flag suspect language with explanation and suggestion.", "Accept, edit, or override the flag — with logged reason."],
                ["Resume parsing", "Extract structured fields from candidate resumes.", "Trust the parse for triage; edit-by-recruiter is disabled (candidates own their data)."],
                ["PII redaction", "Strip names and contact info before scoring.", "Choose when to reveal identity on a candidate detail."],
                ["Score computation", "Run rule + AI components; sum to a final score with breakdown.", "Configure weights at role-level; override scores or stages with logged action."],
                ["Pipeline sorting", "Default sort by score descending.", "Pick any sort or filter; your view is yours."],
                ["Hiring decision", "Nothing.", "Owns offer, decline, hold — every outcome notification is yours to send."],
              ],
            },
            {
              kind: "callout",
              tone: "ai",
              title: "The principle in one sentence",
              body: "AI surfaces evidence; recruiters decide what to do about it.",
            },
          ],
        },
        {
          id: "best-practices",
          icon: Sparkle,
          kicker: "Practical",
          title: "What good recruiting on AuraHire looks like",
          lede: "Habits that compound over time and make every audit easy to defend.",
          blocks: [
            {
              kind: "list",
              items: [
                "Review the breakdown before revealing the name. The product is designed around this — the workflow rewards it.",
                "When you override, attach a one-line note. You'll thank yourself in three months when someone asks why.",
                "Decline with the most specific reason category that fits — not the generic catch-all. Aggregate decline reasons are how the platform learns.",
                "Edit role criteria sparingly after publish. Versioning protects scores, but candidates appreciate stable expectations.",
                "Pay attention to calibration warnings. Sparse-input scores are exactly where overrides are most likely to be appropriate.",
                "Read the bias check suggestions even if you override. The model has seen more job postings than any of us; the suggestions are usually worth a look.",
              ],
            },
          ],
        },
        {
          id: "more-help",
          icon: FileText,
          kicker: "Related",
          title: "Where to go from here",
          lede: "How-it-works is the mechanics; the help center has the troubleshooting and FAQ.",
          blocks: [
            {
              kind: "paragraph",
              text: "If you've finished this walkthrough and still have a specific question — about a stuck pipeline action, a settings detail, or an integration — the recruiter help center is the right next stop. It's organized as searchable Q&A, not a linear story.",
            },
          ],
        },
      ],
    },
  ],
  contact: {
    title: "Have a workflow question we didn't cover?",
    body: "If something about the recruiter workflow isn't clear, write to us — a human reads and responds. Feedback informs the next iteration.",
    email: "cjjutbaofficial@gmail.com",
    secondaryLink: { label: "Open the recruiter help center", href: "/recruiter/help" },
  },
};
