import {
  Beaker,
  Briefcase,
  Database,
  FileSearch,
  FileText,
  Gauge,
  GitBranch,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkle,
  Sparkles,
  Wand2,
  Workflow,
} from "lucide-react";
import type { HowItWorksContent } from "../how-it-works-types";

export const adminHowItWorks: HowItWorksContent = {
  hero: {
    eyebrow: "How AuraHire works for admins",
    title: "Operate the system. Defend every decision.",
    lede: "Admins own the platform's policies and the audit trail. This walkthrough explains every control surface, scoring weights, prompt versions, bias monitoring, calibration, audit logs, and how the pieces fit together so the system is defensible end to end.",
  },
  journey: {
    title: "Your operating loop",
    steps: [
      {
        label: "Configure",
        description: "Set scoring weights, prompts, and bias rules.",
        icon: Sliders,
        targetId: "scoring-config",
      },
      {
        label: "Publish",
        description:
          "Roll out versioned changes; old scores stay attributable.",
        icon: GitBranch,
        targetId: "versioning",
      },
      {
        label: "Monitor",
        description: "Bias dashboard, calibration warnings, system health.",
        icon: Gauge,
        targetId: "monitoring",
      },
      {
        label: "Investigate",
        description: "Drill into flagged patterns or specific incidents.",
        icon: FileSearch,
        targetId: "investigations",
      },
      {
        label: "Audit",
        description: "Export logs for legal review or internal investigation.",
        icon: ScrollText,
        targetId: "audit-trail",
      },
      {
        label: "Iterate",
        description: "Adjust based on data; the cycle repeats.",
        icon: Beaker,
        targetId: "iterating",
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
          title: "The accountability thesis",
          lede: "Every score, every flag, every override has to be defendable to a court, an auditor, or a regulator. Admin tooling is the surface where that defensibility is configured and proved.",
          blocks: [
            {
              kind: "paragraph",
              text: "AuraHire's recruiter and candidate portals are built on top of the policies you configure as an admin. If the platform is ever questioned, by a regulator, a court, an internal audit, or a journalist, your control surfaces are how the system's behavior is reconstructed and explained. Every change you make is versioned; every decision the system makes references the version that produced it.",
            },
            {
              kind: "fields",
              entries: [
                {
                  label: "Versioned everything",
                  description:
                    "Scoring weights, AI prompts, bias dictionaries, decline-reason taxonomies, all versioned. A score generated under v3 stays attributable to v3 even after v4 is published.",
                },
                {
                  label: "Continuous fairness measurement",
                  description:
                    "The bias monitor runs always. It compares scoring distributions and stage outcomes across cohorts and across recruiters; drift triggers calibration warnings without requiring manual investigation.",
                },
                {
                  label: "Audit-export-ready",
                  description:
                    "The audit log is queryable per role, per recruiter, per candidate, and per system version. Exports are themselves logged so the chain of custody for any export is complete.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "What 'admin' actually means here",
              body: "Admin is the operational role, the person who keeps the platform's policies aligned with the organization's standards and the relevant law. Admins do not see candidate-level personal data by default; they see aggregated patterns and the audit log.",
            },
          ],
        },
      ],
    },
    {
      label: "Configuration",
      sections: [
        {
          id: "scoring-config",
          icon: Sliders,
          kicker: "Step 1",
          title: "Scoring configuration: weights and components",
          lede: "The /admin/scoring-config surface is where you define how match scores are built.",
          blocks: [
            {
              kind: "paragraph",
              text: "Scores are a weighted sum of components. You define which components are active, what their weights are, and what scoring engine handles each. Components can be deterministic (rule-based, e.g., skill matching, years of experience comparison) or generative (AI model, e.g., role-fit narrative). Strict-sum reconciliation guarantees that the visible breakdown adds up to the headline score, no opaque adjustments.",
            },
            {
              kind: "matrix",
              head: ["Component", "Engine", "Default weight", "Editable?"],
              rows: [
                [
                  "Must-have skills",
                  "Deterministic matcher",
                  "35%",
                  "Yes, per role and globally",
                ],
                ["Nice-to-have skills", "Deterministic matcher", "15%", "Yes"],
                [
                  "Years of experience",
                  "Deterministic comparator",
                  "15%",
                  "Yes",
                ],
                [
                  "Education / certifications",
                  "Deterministic comparator",
                  "10%",
                  "Yes",
                ],
                ["Role-fit narrative", "Generative (AI model)", "20%", "Yes"],
                [
                  "Calibration adjustment",
                  "Statistical, system-controlled",
                  "5%",
                  "Off by default",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Changing weights is a thesis-defensible event",
              body: "If you bump the AI narrative component's weight from 20% to 30%, the change is logged with your user, the timestamp, and a required reason. New scores use the new weights; old scores remain attributed to the old version. Re-scoring an entire pipeline against new weights is a deliberate, separately-logged action.",
            },
          ],
        },
        {
          id: "prompt-versions",
          icon: Wand2,
          kicker: "Step 2",
          title: "Prompt versioning: the AI's instructions",
          lede: "Every AI call uses a named, versioned prompt. You roll out new versions; the system records which version produced which score.",
          blocks: [
            {
              kind: "paragraph",
              text: "AI prompts in AuraHire are first-class artifacts. Each prompt has a name (e.g., 'role-fit-rationale'), a version (e.g., v7), a model assignment (e.g., gpt-4o-mini), and a structured output schema (so the AI's response is always parseable, never free-text). Bumping a prompt is an explicit, audited action.",
            },
            {
              kind: "fields",
              entries: [
                {
                  label: "Editing a prompt",
                  description:
                    "Open /admin/prompts → choose a prompt → edit the system+user template. Saving creates a new draft version. Drafts are not used in production; they're testable in the prompt sandbox.",
                },
                {
                  label: "Promoting a draft",
                  description:
                    "When a draft passes your eval set (or your judgment), you promote it to active. Active version is what production uses. Old versions remain queryable so historical scores stay reproducible.",
                },
                {
                  label: "Structured outputs only",
                  description:
                    "Every prompt is paired with a JSON schema (Zod-derived). The model's response is validated against the schema before storage. Free-text outputs are not allowed in production paths, that's a hard constraint, not a convention.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "ai",
              title: "Why structured outputs?",
              body: "Free-text outputs drift in shape over time and are hard to compare across runs. Structured outputs give us per-field reliability, and they make the audit log readable, because every field has a known meaning.",
            },
          ],
        },
        {
          id: "bias-rules",
          icon: ShieldAlert,
          kicker: "Step 3",
          title: "Bias rules and dictionaries",
          lede: "The bias detector is configurable. You curate the dictionaries; the system applies them at job-publish time.",
          blocks: [
            {
              kind: "paragraph",
              text: "When recruiters draft job descriptions, the bias detector scans for terms in your maintained dictionaries, gendered descriptors, age-coded language, exclusionary qualifications, regional/legal-sensitive phrasing. Each entry has a category, a severity (info / warning / danger), an explanation shown to recruiters, and one or more suggested replacements.",
            },
            {
              kind: "fields",
              entries: [
                {
                  label: "Dictionary entries",
                  description:
                    "Add, edit, or retire entries from /admin/bias-dictionary. Each entry's history is versioned. Changes apply to new flags only, historical flags reference the entry version that produced them.",
                },
                {
                  label: "Severity tuning",
                  description:
                    "Info = soft suggestion, no action required. Warning = inline chip with explanation, override needs a reason. Danger = inline chip + publication soft-block (recruiter can still publish but with a confirmation modal).",
                },
                {
                  label: "Override audit",
                  description:
                    "Every recruiter override of a flag is logged. The /admin/bias-monitor dashboard shows override patterns; clusters of overrides on a single entry might mean the entry needs tuning.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "We don't block, we flag",
              body: "Outright blocking would push recruiters to draft outside the platform and paste back. Flagging keeps the workflow on AuraHire and creates the audit trail. A recurring pattern of overrides on a specific entry is a signal to tune the dictionary, not to add hard blocks.",
            },
          ],
        },
      ],
    },
    {
      label: "Operating the system",
      sections: [
        {
          id: "versioning",
          icon: GitBranch,
          kicker: "Step 4",
          title: "Versioning rules across the platform",
          lede: "How AuraHire keeps decisions attributable when you change configuration.",
          blocks: [
            {
              kind: "paragraph",
              text: "Every artifact that affects scoring or fairness, weights, prompts, bias dictionaries, decline reason taxonomies, is versioned. Score records reference the artifact versions that produced them. This means: a score from three months ago can be exactly explained by reading the v7 weights, the v3 narrative prompt, and the v12 bias dictionary that were active at the time.",
            },
            {
              kind: "matrix",
              head: [
                "Artifact",
                "Versioned by",
                "Old versions kept?",
                "Re-score on update?",
              ],
              rows: [
                [
                  "Scoring weights",
                  "Admin save action",
                  "Yes, indefinitely",
                  "Optional, deliberate",
                ],
                [
                  "AI prompts",
                  "Promote-from-draft",
                  "Yes, indefinitely",
                  "Optional, deliberate",
                ],
                [
                  "Bias dictionaries",
                  "Per-entry version",
                  "Yes, indefinitely",
                  "No (flags reference entry version)",
                ],
                [
                  "Decline reasons",
                  "Taxonomy save action",
                  "Yes, indefinitely",
                  "No (decisions reference taxonomy version)",
                ],
                [
                  "Role criteria",
                  "Per-role save action",
                  "Yes, indefinitely",
                  "Optional, per-role",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Why re-scoring is opt-in",
              body: "Automatically re-scoring all historical applications when you update weights would silently invalidate prior decisions, that's the opposite of accountability. You can re-score deliberately (with a logged action) when you want consistency across a pipeline; otherwise old applications keep their original scores.",
            },
          ],
        },
        {
          id: "monitoring",
          icon: Gauge,
          kicker: "Step 5",
          title: "Continuous monitoring: bias, calibration, health",
          lede: "Three dashboards that should be open weekly: /admin/bias-monitor, /admin/scoring-quality, and /admin/system-health.",
          blocks: [
            {
              kind: "fields",
              entries: [
                {
                  label: "Bias monitor",
                  description:
                    "Compares scoring distributions and stage outcomes across cohorts and across recruiters. Surfaces drift via colored bands (info / warning / danger) and flags individual recruiters with anomalous override patterns.",
                },
                {
                  label: "Scoring quality",
                  description:
                    "Calibration warnings aggregated. Distribution of confidence intervals. Patterns of low-confidence scores by role type, by time-of-day, by AI model version. Where the model is least sure, you should focus.",
                },
                {
                  label: "System health",
                  description:
                    "API latency, AI call latency, queue depth (BullMQ), Redis connection state, Postgres pool, Mailpit/Resend delivery rate. The operational layer, separate from the fairness layer.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Calibration warnings vs. bias warnings",
              body: "Calibration is about how confident the score is (sparse input → wide confidence interval → calibration warning). Bias is about whether the score's distribution matches expectations across cohorts. Both can fire on the same role; they mean different things.",
            },
          ],
        },
        {
          id: "investigations",
          icon: FileSearch,
          kicker: "Step 6",
          title: "Investigating a flagged pattern",
          lede: "When the bias monitor or a calibration warning fires, here's the workflow.",
          blocks: [
            {
              kind: "steps",
              items: [
                {
                  title: "Open the flag",
                  description:
                    "From /admin/bias-monitor, click the flagged pattern. The detail page shows which roles, which recruiters, which time window, and the underlying numbers (z-score, sample size, comparison cohort).",
                },
                {
                  title: "Read the underlying decisions",
                  description:
                    "The detail links into the affected applications and the recruiter actions on them. You can see, without revealing identity, the scores, breakdowns, and stage moves that produced the pattern.",
                },
                {
                  title: "Decide on action",
                  description:
                    "Three outcomes: (1) The pattern reflects real signal, close with a documented note. (2) The pattern is configuration drift, adjust weights / prompt / dictionary. (3) The pattern is recruiter behavior, surface a calibration prompt to the recruiter via the platform.",
                },
                {
                  title: "Document the outcome",
                  description:
                    "Closing an investigation requires a short summary. The summary becomes part of the audit trail; future investigations on the same pattern reference it.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Statistical significance, not gut feel",
              body: "The bias monitor uses configurable significance thresholds (default: p<0.05 with minimum sample of 30). Lower thresholds catch more, with more false positives; higher ones catch less, with more risk. Tuning thresholds is itself an admin action, logged.",
            },
          ],
        },
      ],
    },
    {
      label: "Audit and accountability",
      sections: [
        {
          id: "audit-trail",
          icon: ShieldCheck,
          kicker: "Step 7",
          title: "The audit trail: what's logged and why",
          lede: "The audit log is the platform's memory. Every consequential action writes one entry.",
          blocks: [
            {
              kind: "paragraph",
              text: "AuraHire writes an audit_logs row for every action that affects fairness, transparency, or candidate outcomes. The log is append-only and queryable. Storage is managed; the log is retained per the configured retention policy and exported on demand for legal review.",
            },
            {
              kind: "matrix",
              head: ["Event", "Who", "What's captured"],
              rows: [
                [
                  "Score computed",
                  "System",
                  "Application id, prompt version, model, latency, redacted fields, weights version, final score + breakdown.",
                ],
                [
                  "Stage moved",
                  "Recruiter",
                  "Application id, from stage, to stage, recruiter, timestamp, optional note.",
                ],
                [
                  "Identity revealed",
                  "Recruiter",
                  "Application id, recruiter, timestamp.",
                ],
                [
                  "Override applied",
                  "Recruiter",
                  "Application id, recruiter, override type, optional reason.",
                ],
                [
                  "Outcome sent",
                  "Recruiter",
                  "Application id, outcome type, decline reason category (if any), recruiter, timestamp.",
                ],
                [
                  "Bias flag overridden",
                  "Recruiter",
                  "Job id, flagged term, recruiter, timestamp, reason category.",
                ],
                [
                  "Config changed",
                  "Admin",
                  "Artifact (weights / prompt / dictionary), version delta, admin, timestamp, reason.",
                ],
                [
                  "Audit exported",
                  "Admin",
                  "Query parameters, row count, admin, timestamp, destination (file id).",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Anonymization on candidate deletion",
              body: "If a candidate deletes their account, their personal data is removed from the candidate record, but audit log entries that reference the candidate are anonymized (candidate id replaced with a hash, names removed) and retained. We need the record to defend that processes were followed.",
            },
          ],
        },
        {
          id: "audit-export",
          icon: ScrollText,
          kicker: "Operations",
          title: "Exporting the audit log",
          lede: "Legal review, internal investigation, or regulator request, the export workflow is the same.",
          blocks: [
            {
              kind: "steps",
              items: [
                {
                  title: "Define the query",
                  description:
                    "Filter by date range, role, recruiter, candidate, event type, or version. The query preview shows the row count before you confirm.",
                },
                {
                  title: "Confirm and queue",
                  description:
                    "Confirming queues the export job (BullMQ). Large exports may take minutes to hours. You're notified when complete.",
                },
                {
                  title: "Download and chain-of-custody",
                  description:
                    "The export is a signed CSV (or JSON) with a manifest documenting the query parameters, the row count, the export timestamp, and the admin who ran it. Hand the manifest with the file to whoever is reviewing.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "success",
              title: "Exports are themselves audit events",
              body: "The act of exporting writes its own audit row. The chain of custody for any export is complete: who exported what, when, and how many rows.",
            },
          ],
        },
      ],
    },
    {
      label: "Improving the system",
      sections: [
        {
          id: "iterating",
          icon: Beaker,
          kicker: "Step 8",
          title: "How to iterate without breaking attribution",
          lede: "The safe pattern for evolving prompts, weights, and rules.",
          blocks: [
            {
              kind: "list",
              items: [
                "Always edit in draft. Promote to active only after you've sandboxed the change against a representative sample.",
                "Keep the rollback boring. Old versions are queryable; if a new version misbehaves, the rollback action is one click and writes its own audit row.",
                "Re-score deliberately, not silently. If you want a pipeline to use new weights, run the explicit re-score action on it. Don't expect the system to auto-adjust historical scores.",
                "Annotate version notes. Each promote-to-active has a notes field; future-you needs the context six months later.",
                "Compare before-and-after on the bias monitor. If a prompt change is supposed to reduce a flagged pattern, you should see the pattern shift in the dashboard within the next collection window.",
              ],
            },
            {
              kind: "callout",
              tone: "ai",
              title: "Eval sets are how you ship safely",
              body: "Maintain a fixed set of representative applications for sandboxing prompt changes. The sandbox runs the draft prompt against the eval set and shows you the deltas (per-field, per-score). Every prompt promotion should reference an eval-set run.",
            },
          ],
        },
        {
          id: "dependencies",
          icon: Database,
          kicker: "Architecture",
          title: "What sits between admin actions and production",
          lede: "A short tour of the systems your changes flow through.",
          blocks: [
            {
              kind: "matrix",
              head: ["Layer", "What it does", "How admins interact"],
              rows: [
                [
                  "Web (Next.js)",
                  "Recruiter & candidate UI; admin tools.",
                  "Direct: every admin action is a UI surface.",
                ],
                [
                  "API (NestJS)",
                  "All DB writes, AI calls, queue work, cron, secrets.",
                  "Indirect: admin UI calls the API; you observe via /admin/system-health.",
                ],
                [
                  "Database (Supabase Postgres)",
                  "Source of truth for everything: applications, scores, audit logs.",
                  "Indirect: queries through the API. RLS enforces tenant isolation.",
                ],
                [
                  "Redis + BullMQ",
                  "Job queue (scoring, exports, emails) and short-term cache.",
                  "Indirect: queue depth visible on /admin/system-health.",
                ],
                [
                  "OpenAI",
                  "All AI calls (parsing, scoring narrative, bias check), backend-only.",
                  "Indirect: prompt versions and model selection live in /admin/prompts.",
                ],
                [
                  "Email (Mailpit dev / Resend prod)",
                  "Transactional notifications.",
                  "Indirect: deliverability metrics on /admin/system-health.",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Frontend has no DB or AI access",
              body: "By architectural rule, the Next.js app makes no direct database queries and no direct OpenAI calls. Everything flows through the NestJS API. That's what makes audit logs trustworthy, there's only one path that produces them.",
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
          title: "Terms you'll see in admin tools",
          lede: "A short reference for the labels and metrics that appear throughout admin surfaces.",
          blocks: [
            {
              kind: "definitions",
              entries: [
                {
                  term: "Strict-sum reconciliation",
                  definition:
                    "The rule that the final score equals the sum of weighted criterion scores; no opaque adjustment. Quantization to 5-point bands is applied last.",
                },
                {
                  term: "Calibration warning",
                  definition:
                    "A chip beside a score indicating low confidence, usually because resume input was sparse or the AI rationale flagged uncertainty.",
                },
                {
                  term: "Drift",
                  definition:
                    "A statistically significant change in a measured pattern over time (e.g., score distribution by cohort drifting from baseline). The bias monitor surfaces drift.",
                },
                {
                  term: "Override",
                  definition:
                    "A recruiter action that contradicts the AI's score-based recommendation: advancing a low-scored candidate, declining a high-scored one, manually adjusting a score.",
                },
                {
                  term: "Eval set",
                  definition:
                    "A curated set of representative inputs used to sandbox prompt or weight changes before promotion to production.",
                },
                {
                  term: "Audit export",
                  definition:
                    "A queued job that produces a signed CSV / JSON of audit events matching a query, with a manifest documenting the query and the export action.",
                },
                {
                  term: "Anonymization",
                  definition:
                    "The post-deletion process that removes personal identifiers from audit log entries while preserving the structural record of what happened.",
                },
              ],
            },
          ],
        },
        {
          id: "human-vs-ai",
          icon: Workflow,
          kicker: "Boundaries",
          title: "Admin authority vs. system autonomy",
          lede: "What admins control vs. what the system handles automatically.",
          blocks: [
            {
              kind: "matrix",
              head: ["Concern", "System does", "Admin does"],
              rows: [
                [
                  "Run scoring",
                  "Yes (every application, automatic).",
                  "Configure weights and components.",
                ],
                [
                  "Apply PII redaction",
                  "Yes (always, before AI scoring).",
                  "Define what counts as PII (rare changes).",
                ],
                [
                  "Run bias check on jobs",
                  "Yes (at publish, on every edit).",
                  "Curate the bias dictionary, tune severity.",
                ],
                [
                  "Decide hiring outcomes",
                  "Never.",
                  "Not in admin scope, recruiters own decisions.",
                ],
                [
                  "Re-score historical applications",
                  "No.",
                  "Triggered explicitly per pipeline.",
                ],
                [
                  "Emit calibration warnings",
                  "Yes (real-time).",
                  "Tune thresholds and review patterns.",
                ],
                [
                  "Detect bias drift",
                  "Yes (per collection window).",
                  "Configure cohorts, set significance thresholds.",
                ],
                [
                  "Export audit log",
                  "Indexes data for query.",
                  "Issues the export with a query and reason.",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "ai",
              title: "The principle in one sentence",
              body: "The system runs the rules; admins choose the rules and watch how they perform.",
            },
          ],
        },
        {
          id: "best-practices",
          icon: Sparkle,
          kicker: "Practical",
          title: "Operational habits that compound",
          lede: "Small disciplines that make the system defensible six months from now.",
          blocks: [
            {
              kind: "list",
              items: [
                "Open the bias monitor weekly. Drift caught early is cheap to investigate; drift caught late is a story.",
                "Never edit a prompt in production without a sandbox run. Even a small wording change can shift score distributions.",
                "Document every config change in the version notes field. The reason matters more than the change.",
                "Treat calibration warnings as triage signals, not noise. They mark the cases where override is most likely correct.",
                "Audit the audit. Export a small sample monthly and verify the chain-of-custody manifest matches the query you ran.",
                "When recruiters push back on a flag or a score, listen, that's the cheapest source of dictionary and prompt improvements.",
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
              text: "If you've finished this walkthrough and still have a specific question, about a stuck job, an export error, or a configuration detail, the admin help center is the right next stop. It's organized as searchable Q&A, not a linear story.",
            },
          ],
        },
      ],
    },
  ],
  contact: {
    title: "Operating the system and need a second opinion?",
    body: "If a configuration question, an investigation, or an audit-export workflow isn't clear, write to us, a human reads and responds. Operational questions are the most valuable ones.",
    email: "cjjutbaofficial@gmail.com",
    secondaryLink: { label: "Open the admin help center", href: "/admin/help" },
  },
};
