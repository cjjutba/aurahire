import {
  Award,
  Briefcase,
  Calendar,
  CircleUser,
  Eye,
  FileSearch,
  FileText,
  Gavel,
  Layers,
  Lock,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Workflow,
} from "lucide-react";
import type { HowItWorksContent } from "../how-it-works-types";

export const candidateHowItWorks: HowItWorksContent = {
  hero: {
    eyebrow: "How AuraHire works for candidates",
    title: "From resume to offer — every step, explained.",
    lede: "AuraHire is built around a single promise: you should never wonder how a hiring decision was made. This walkthrough shows what happens behind the scenes — what the AI does, what humans decide, and what data we never touch — at every stage of your application.",
  },
  journey: {
    title: "Your end-to-end journey",
    steps: [
      {
        label: "Sign up",
        description: "Create your account and verify your email.",
        icon: UserPlus,
        targetId: "sign-up",
      },
      {
        label: "Build profile",
        description: "Resume parsed, fields pre-filled — you stay in control.",
        icon: CircleUser,
        targetId: "build-profile",
      },
      {
        label: "Find a job",
        description: "Browse openings or get matched by relevance.",
        icon: FileSearch,
        targetId: "browse-and-apply",
      },
      {
        label: "Apply",
        description: "Submit once; the AI scores against the role criteria.",
        icon: Send,
        targetId: "scoring-engine",
      },
      {
        label: "Review",
        description: "A human recruiter reviews you with the same evidence you see.",
        icon: Eye,
        targetId: "recruiter-review",
      },
      {
        label: "Outcome",
        description: "Interview, offer, or polite decline — always with a reason.",
        icon: Award,
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
          title: "The transparency thesis",
          lede: "Most ATS platforms are black boxes. AuraHire is the opposite — every score, every flag, every recommendation comes with its evidence attached.",
          blocks: [
            {
              kind: "paragraph",
              text: "AuraHire was built around a single guarantee: the candidate sees the same scoring evidence the recruiter sees. There is no hidden second opinion, no secret ranking, no opaque AI judgment that affects you behind the scenes. If a number changes, you can find out why.",
            },
            {
              kind: "fields",
              entries: [
                {
                  label: "Explainability",
                  description:
                    "Every match score is paired with a breakdown bar showing how each criterion contributed. Click any segment to see the exact resume excerpt that earned (or didn't earn) those points.",
                },
                {
                  label: "Fairness by design",
                  description:
                    "Personal identifiers are stripped from your resume before the AI scores it. Job descriptions are checked for biased language before they're published. Both protections run automatically — they aren't optional add-ons.",
                },
                {
                  label: "Human in the loop",
                  description:
                    "The AI never auto-rejects, never auto-advances, and never makes a final hiring decision. It triages and surfaces; humans decide.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Score color is not a value judgment",
              body: "A 'Limited Match' on one role does not mean you're a limited candidate. It means the resume evidence didn't strongly align with that specific role's stated criteria — which is different from your worth, your potential, or your fit elsewhere.",
            },
          ],
        },
      ],
    },
    {
      label: "Getting started",
      sections: [
        {
          id: "sign-up",
          icon: UserPlus,
          kicker: "Step 1",
          title: "Sign up and verify",
          lede: "A short, intentional onboarding so we collect only what we need to match you.",
          blocks: [
            {
              kind: "steps",
              items: [
                {
                  title: "Create your account",
                  description:
                    "Email and password. We send a verification link to confirm you own the address — clicking it activates your account.",
                },
                {
                  title: "Choose your role",
                  description:
                    "AuraHire serves three audiences (candidate, recruiter, admin). The role you pick at sign-up determines the portal you land in and the permissions you get.",
                },
                {
                  title: "Complete your profile",
                  description:
                    "We unlock applications once you have the basics: name, contact, location, work authorization. The rest of your profile is built from your resume in the next step.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "ai",
              title: "What we never ask for at sign-up",
              body: "We do not collect government IDs, social security numbers, payment information, or biometric data. If you ever see a request for any of those, please report it — that's not us.",
            },
          ],
        },
        {
          id: "build-profile",
          icon: CircleUser,
          kicker: "Step 2",
          title: "Build your profile from your resume",
          lede: "You upload one PDF or DOCX; the AI parser fills in the rest, you review.",
          blocks: [
            {
              kind: "paragraph",
              text: "When you upload a resume, our parser extracts your work history, education, skills, certifications, and contact details. Each extracted field appears in your profile pre-filled with an 'AI Suggested' chip beside it. The chip becomes 'Edited' the moment you change it — so you always know which values came from the parser and which you authored yourself.",
            },
            {
              kind: "fields",
              entries: [
                {
                  label: "What the parser extracts",
                  description:
                    "Job titles, employers, dates, locations, summary bullets, skills, education degrees and institutions, certifications, and projects. Anything tabular or in standard resume format.",
                },
                {
                  label: "What stays manual",
                  description:
                    "Work preferences (remote/hybrid/on-site, salary expectations, willingness to relocate), self-rated skill proficiency, and your personal headline. Those are signals only you can give.",
                },
                {
                  label: "Editing freely",
                  description:
                    "You can override any AI-suggested field at any time. Edits don't delete the underlying parse — they layer on top. You can re-run the parser if you upload a newer resume.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "ai",
              title: "PII redaction happens before scoring, not after",
              body: "Your name, email, phone, address, and any photo are stored on your profile so recruiters can contact you — but they are stripped from the document the AI sees when it scores you against a job. The model never reads your name when assigning a number.",
            },
          ],
        },
      ],
    },
    {
      label: "The application flow",
      sections: [
        {
          id: "browse-and-apply",
          icon: FileSearch,
          kicker: "Step 3",
          title: "Browse jobs and submit applications",
          lede: "Filter by role, location, and remote policy. When you click Apply, we explain exactly what happens next.",
          blocks: [
            {
              kind: "steps",
              items: [
                {
                  title: "Browse openings",
                  description:
                    "The job board lists every published role across companies on the platform. Filter by keyword, location, salary range, or work model.",
                },
                {
                  title: "Read the role criteria",
                  description:
                    "Each posting shows the must-have skills, nice-to-haves, experience range, and required qualifications — the same fields the AI scores against. No hidden criteria.",
                },
                {
                  title: "Submit your application",
                  description:
                    "One click attaches your active profile and resume to the role. Optional cover note and any role-specific questions are presented before submission. Once you confirm, we start scoring.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "You can withdraw any time",
              body: "Until a recruiter has moved you into an interview stage, you can withdraw an application from your dashboard. Once withdrawn, your data is removed from that job's pipeline.",
            },
          ],
        },
        {
          id: "scoring-engine",
          icon: Target,
          kicker: "Step 4",
          title: "How your match score is computed",
          lede: "A hybrid scoring engine: deterministic rules where the answer is checkable, an AI model where judgment is needed. Both contribute, both are visible.",
          blocks: [
            {
              kind: "paragraph",
              text: "Your profile and the redacted version of your resume are scored against the role's stated criteria. The result is a single 0–100 number on a 5-point quantization (so scores like 73 become 75 — small differences don't masquerade as meaningful ones), paired with a breakdown bar showing each criterion's contribution.",
            },
            {
              kind: "matrix",
              head: ["Criterion", "How it's scored", "What you see"],
              rows: [
                [
                  "Must-have skills",
                  "Deterministic match against your skills list and resume evidence.",
                  "Per-skill chip: matched, partial, or missing.",
                ],
                [
                  "Nice-to-have skills",
                  "Same matcher, lower weight in the final score.",
                  "Same chip pattern, weighted differently in the bar.",
                ],
                [
                  "Years of experience",
                  "Computed from your resume's work history dates against the role's range.",
                  "Numeric range comparison with the band you fall in.",
                ],
                [
                  "Education / certifications",
                  "Direct comparison against the role's required and preferred qualifications.",
                  "Each requirement marked met or unmet.",
                ],
                [
                  "Role-fit narrative",
                  "AI model reads your redacted resume and generates a short rationale.",
                  "The full rationale is shown — not summarized, not hidden.",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Strict-sum reconciliation",
              body: "The final score is the sum of weighted component scores — nothing else. If the parts add up to 71, the whole is 71 (then quantized to the nearest 5). There's no secret bonus, no opaque adjustment, no algorithm 'gut feel' on top.",
            },
          ],
        },
        {
          id: "reading-your-score",
          icon: Layers,
          kicker: "Step 5",
          title: "Reading your match score",
          lede: "Three components travel together: the Score Ring, the Breakdown Bar, and the Evidence panel.",
          blocks: [
            {
              kind: "definitions",
              entries: [
                {
                  term: "Score Ring",
                  definition:
                    "The headline number (0–100) shown in a circular progress ring. The ring fill is colored by band: red for Limited Match (0–39), amber for Partial Match (40–69), green for Strong Match (70–100). The number itself is in JetBrains Mono — readable, tabular, unambiguous.",
                },
                {
                  term: "Breakdown Bar",
                  definition:
                    "A horizontal stacked bar where each segment represents one scoring criterion. Segment width = the criterion's weight in the role; segment color = your score in that criterion. Click any segment to open the evidence panel.",
                },
                {
                  term: "Evidence panel",
                  definition:
                    "A side panel showing the exact text excerpt from your resume that earned (or failed to earn) the points. Quoted, highlighted, with a reference to the page or section it came from. No paraphrasing, no AI rewording.",
                },
                {
                  term: "Match-band chip",
                  definition:
                    "A plain-language label always paired with the number — 'Strong Match,' 'Partial Match,' or 'Limited Match.' Never 'Excellent Candidate' or 'Mediocre Candidate.' The label describes alignment with the role, not your worth.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "ai",
              title: "Why scores quantize to 5-point bands",
              body: "A score of 72 vs. 74 isn't a meaningful difference — but it would feel like one. We quantize to the nearest 5 so cosmetic precision doesn't drive decisions. The breakdown shows the full picture; the headline number is honest about what it can claim.",
            },
          ],
        },
      ],
    },
    {
      label: "Privacy & fairness",
      sections: [
        {
          id: "what-ai-sees",
          icon: Eye,
          kicker: "Transparency",
          title: "What the AI sees vs. what humans see",
          lede: "Two different audiences get two different views of you, on purpose.",
          blocks: [
            {
              kind: "matrix",
              head: ["Field", "Recruiter sees", "AI sees"],
              rows: [
                ["Your name", "Yes", "No (redacted)"],
                ["Email & phone", "Yes (after you advance)", "No (redacted)"],
                ["Photo / avatar", "Optional, your choice", "No (never)"],
                ["Work history (employers, dates, titles)", "Yes", "Yes"],
                ["Skills, education, certifications", "Yes", "Yes"],
                ["Resume bullets & narrative", "Yes", "Yes (redacted of identifiers)"],
                ["Demographic data", "Never collected", "Never collected"],
                ["Salary expectations", "Yes", "No (filter only, not scored)"],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Why redaction matters",
              body: "When the AI scores a resume, it should be reasoning about evidence — not pattern-matching against a name or a school's prestige. Stripping identifying details before scoring is the simplest, strongest fairness intervention available.",
            },
          ],
        },
        {
          id: "audit-trail",
          icon: ShieldCheck,
          kicker: "Accountability",
          title: "The audit trail behind every score",
          lede: "Every score we compute is logged with the prompt version, the model used, the latency, and which fields were redacted. So if a score is ever questioned, there's a record.",
          blocks: [
            {
              kind: "paragraph",
              text: "When the AI scores you, we record the prompt version (so we can replay against the exact instructions used), the model identifier and version, the time the call took, and which fields the redactor stripped. If an admin later changes a scoring weight or a prompt, scores generated under the old version remain attributable to that version — not silently re-scored.",
            },
            {
              kind: "callout",
              tone: "success",
              title: "Why this matters to you",
              body: "If you ever feel a score doesn't reflect your application, you can ask the recruiter to review the underlying evidence. Because the breakdown and audit trail exist, the conversation can be specific — not 'the algorithm said so.'",
            },
          ],
        },
        {
          id: "data-control",
          icon: Lock,
          kicker: "Your data",
          title: "What you control, anytime",
          lede: "You can always see, edit, withdraw, or delete the data you've shared.",
          blocks: [
            {
              kind: "fields",
              entries: [
                {
                  label: "Edit your profile",
                  description:
                    "Settings → Profile lets you update any field, re-upload a resume, or remove an old one. Old resumes are not retained beyond your active version.",
                },
                {
                  label: "Withdraw an application",
                  description:
                    "From your Applications dashboard you can withdraw any application before it reaches an interview stage. Withdrawn applications are removed from the recruiter's pipeline.",
                },
                {
                  label: "Delete your account",
                  description:
                    "Settings → Account → Delete removes your profile, resume, and all linked applications. Audit logs we're legally required to retain are anonymized — your name is removed.",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      label: "After you apply",
      sections: [
        {
          id: "recruiter-review",
          icon: Eye,
          kicker: "Step 6",
          title: "How the recruiter reviews you",
          lede: "Recruiters see your score, your breakdown, and your evidence — the same things you see — and decide what happens next.",
          blocks: [
            {
              kind: "steps",
              items: [
                {
                  title: "Triage",
                  description:
                    "Your application enters the recruiter's pipeline as 'New.' The recruiter sees your score, breakdown, and evidence first — your name is shown only after they choose to expand the row.",
                },
                {
                  title: "Stage advancement",
                  description:
                    "If the recruiter wants to advance you, they move your card to the next stage (Screening → Interview → Offer). Each move is timestamped and visible to you.",
                },
                {
                  title: "Decline (with reason)",
                  description:
                    "If the recruiter declines, they choose a reason from a fixed list (so reasons are consistent and reportable). You see the reason category — never a free-text justification we can't audit.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "What 'New' means",
              body: "A 'New' status doesn't mean unread — it means the recruiter hasn't decided yet. We don't tell you when a recruiter has opened your application; that's their workspace. We do tell you the moment they take a stage action.",
            },
          ],
        },
        {
          id: "interviews",
          icon: Calendar,
          kicker: "Step 7",
          title: "When you're invited to interview",
          lede: "Scheduling is on the platform, with timezone awareness and asynchronous coordination.",
          blocks: [
            {
              kind: "paragraph",
              text: "If a recruiter advances you to the interview stage, you'll receive an email and an in-app notification. The Interviews tab in your portal shows scheduled, requested, and completed interviews with details: who you're meeting, the format, and any prep materials the recruiter shared.",
            },
            {
              kind: "fields",
              entries: [
                {
                  label: "Scheduling",
                  description:
                    "The recruiter proposes time slots; you accept one. Both parties get calendar invites. Timezones are detected from your profile location.",
                },
                {
                  label: "Format",
                  description:
                    "Phone, video, or on-site. The format and any meeting link or address are shown on the interview detail.",
                },
                {
                  label: "Prep materials",
                  description:
                    "Optional. Some recruiters share documents or topic outlines ahead of time; you'll see them attached to the interview.",
                },
              ],
            },
          ],
        },
        {
          id: "outcomes",
          icon: Award,
          kicker: "Step 8",
          title: "Offer, decline, or pause — always with a reason",
          lede: "Every outcome is communicated. We don't ghost.",
          blocks: [
            {
              kind: "matrix",
              head: ["Outcome", "What happens", "What you see"],
              rows: [
                [
                  "Offer",
                  "The recruiter sends an offer through the platform with role, comp, start date, and any conditions.",
                  "Offer detail in your dashboard with Accept / Decline / Negotiate actions.",
                ],
                [
                  "Decline",
                  "The recruiter chooses a category (e.g., 'role filled,' 'requirements not met,' 'better fit elsewhere').",
                  "Notification with the category. You can ask for more detail; recruiters are encouraged to respond.",
                ],
                [
                  "Pause / Hold",
                  "The role is paused (often for budget or restructuring). You stay in the pipeline.",
                  "Status changes to 'On hold' with an optional message.",
                ],
                [
                  "Withdrawal (your choice)",
                  "You opt out from the dashboard. The recruiter is notified.",
                  "Application archived. You can re-apply if the role re-opens.",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "success",
              title: "Why we collect outcomes",
              body: "Every outcome — including declines — improves the platform's calibration metrics. We use aggregated outcome data to detect bias drift over time. No individual outcome ever identifies you in those metrics.",
            },
          ],
        },
      ],
    },
    {
      label: "Improving over time",
      sections: [
        {
          id: "improving-score",
          icon: TrendingUp,
          kicker: "Practical",
          title: "How to improve your score (legitimately)",
          lede: "There's no gaming the system — but there are real ways to make your match more accurate.",
          blocks: [
            {
              kind: "list",
              items: [
                "Keep your resume current. Add new roles, projects, and certifications as they happen — not in a burst when you start job-hunting.",
                "Be specific about skills. 'TypeScript' beats 'modern JavaScript frameworks.' The matcher rewards exact terms used in role criteria.",
                "Quantify outcomes. 'Reduced p99 latency by 40%' is evidence the AI can cite; 'helped improve performance' isn't.",
                "Match roles to your actual range. Applying to roles 3 levels above (or below) you produces low scores not because the AI is wrong, but because the criteria genuinely don't fit.",
                "Read the breakdown. If a criterion shows a gap, ask whether your resume actually demonstrates it — sometimes you have the experience but didn't write it down.",
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "What does not help",
              body: "Keyword stuffing, hidden white-text keywords, or padding work history dates. The model and the recruiter both notice. The only sustainable path is honest, complete evidence.",
            },
          ],
        },
        {
          id: "talking-to-people",
          icon: MessageSquare,
          kicker: "When in doubt",
          title: "Disagree with a score? Talk to a human.",
          lede: "The platform is built so humans can override anything the AI suggested. Use that.",
          blocks: [
            {
              kind: "paragraph",
              text: "If you believe a score doesn't reflect your application, the right move is to message the recruiter from your application detail. Because the breakdown and evidence are available to both of you, the conversation can be specific: 'The breakdown shows I scored low on Kubernetes — but my work at Acme included production K8s ops; here's a link to the case study.'",
            },
            {
              kind: "callout",
              tone: "info",
              title: "Recruiters can override anything",
              body: "Recruiters have the authority to advance a candidate regardless of score. The AI is an assistant, not a gatekeeper. If your evidence is stronger than the score reflects, the recruiter can — and often does — move you forward anyway.",
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
          title: "Terms you'll see in the platform",
          lede: "A short reference for the labels and badges that appear throughout AuraHire.",
          blocks: [
            {
              kind: "definitions",
              entries: [
                {
                  term: "Match score",
                  definition:
                    "0–100 number representing alignment between your application and the role's stated criteria. Quantized to the nearest 5.",
                },
                {
                  term: "Match band",
                  definition:
                    "Plain-language label for the score: Limited Match (0–39), Partial Match (40–69), Strong Match (70–100).",
                },
                {
                  term: "AI Suggested",
                  definition:
                    "Indicator on profile fields pre-filled by the resume parser. Becomes 'Edited' once you change the value.",
                },
                {
                  term: "Bias flag",
                  definition:
                    "A warning shown to recruiters when the job description contains potentially biased language. (You won't see these in your portal — they appear on the recruiter's editor.)",
                },
                {
                  term: "Calibration",
                  definition:
                    "The platform's ongoing measurement of whether scores predict outcomes accurately. Visible to admins; used to detect drift in fairness metrics.",
                },
                {
                  term: "Audit log",
                  definition:
                    "Permanent record of consequential actions (applications, score computations, stage changes). You can request your audit log via Settings → Account.",
                },
              ],
            },
          ],
        },
        {
          id: "human-vs-ai",
          icon: Workflow,
          kicker: "Boundaries",
          title: "Human decisions vs. AI assistance",
          lede: "A clear map of who does what at every step.",
          blocks: [
            {
              kind: "matrix",
              head: ["Step", "AI does", "Human does"],
              rows: [
                ["Profile parsing", "Extract structured fields from your resume.", "Review and edit any value before applying."],
                ["PII redaction", "Strip identifiers before scoring.", "Set what counts as PII (admin policy)."],
                ["Score computation", "Run the rule and AI components, sum to a final score.", "Configure weights; review and override scores."],
                ["Triage", "Sort applications by score.", "Decide who advances, declines, or pauses."],
                ["Bias check on jobs", "Flag potentially biased language in postings.", "Approve, edit, or override the flag."],
                ["Hiring decision", "Nothing.", "Owns the decision end-to-end."],
              ],
            },
            {
              kind: "callout",
              tone: "ai",
              title: "The principle in one sentence",
              body: "AI assists with reading, sorting, and surfacing evidence. Humans choose what to do about it.",
            },
          ],
        },
        {
          id: "fair-process",
          icon: Gavel,
          kicker: "Recourse",
          title: "If something feels off",
          lede: "There are real channels for raising concerns. Use them.",
          blocks: [
            {
              kind: "list",
              items: [
                "If your match score doesn't match the breakdown — message the recruiter from the application detail.",
                "If you believe a job description contains biased language a recruiter missed — use 'Report this job' on the posting page.",
                "If you suspect an account or recruiter is misusing the platform — email the contact below; reports are read by a human.",
                "If you want a copy of every action taken on your data — request your audit log from Settings → Account.",
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
              text: "If you've finished this walkthrough and still have a specific question — about an error message, a stuck application, or a settings detail — the candidate help center is the right next stop. It's organized as searchable Q&A, not a linear story.",
            },
          ],
        },
      ],
    },
  ],
  contact: {
    title: "Still wondering how something works?",
    body: "We'd rather over-explain than leave you guessing. If a specific part of the platform isn't clear, write to us — a human reads and responds.",
    email: "cjjutbaofficial@gmail.com",
    secondaryLink: { label: "Open the candidate help center", href: "/candidate/help" },
  },
};
