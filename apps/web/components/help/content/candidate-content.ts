import {
  Activity,
  Award,
  Bell,
  Briefcase,
  Calendar,
  CircleUser,
  Eye,
  FileCheck,
  FileText,
  Layers,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import type { HelpPageContent } from "../help-types";

export const candidateHelp: HelpPageContent = {
  hero: {
    eyebrow: "Candidate help center",
    title: "Apply with confidence. Know how you're scored.",
    lede: "AuraHire shows you the same scoring evidence the recruiter sees. No black boxes, no guessing, just clear answers about your applications, your match score, and your privacy.",
  },
  groups: [
    {
      label: "Getting started",
      sections: [
        {
          id: "welcome",
          icon: Sparkles,
          kicker: "Orientation",
          title: "How AuraHire works for candidates",
          lede: "A quick tour of what the platform does, and what it doesn't, so there are no surprises.",
          blocks: [
            {
              kind: "paragraph",
              text: "AuraHire connects you with companies that publish jobs on the platform. When you apply, the AI reads your resume, redacts personal details, and produces a match score against the role's criteria. You see the same score and the same evidence the recruiter sees, and you can always see why a number is what it is.",
            },
            {
              kind: "fields",
              entries: [
                {
                  label: "What we ask of you",
                  description:
                    "An accurate resume, a complete profile, and honest answers to any role-specific questions on the application form.",
                },
                {
                  label: "What we never ask for",
                  description:
                    "Government IDs, payment information, or anything outside the standard application surface. If you ever see one of those requests on AuraHire, please report it.",
                },
                {
                  label: "What humans decide",
                  description:
                    "Every hiring decision is made by a human recruiter. The AI assists with triage and surfaces evidence; it does not auto-reject or auto-advance you.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Your match score is not a value judgment",
              body: "A 'Limited Match' on one role doesn't mean you're a limited candidate. It means the resume evidence didn't strongly align with that specific role's stated criteria, which is different from your worth, your potential, or your fit elsewhere.",
            },
          ],
        },
        {
          id: "build-profile",
          icon: CircleUser,
          kicker: "Setup",
          title: "Build your profile",
          lede: "Your profile is what recruiters and the AI start from, keeping it complete pays compounding dividends.",
          blocks: [
            {
              kind: "steps",
              items: [
                {
                  title: "Personal basics",
                  description:
                    "Name, contact, location, work authorization. These are visible to recruiters when you apply but are redacted before the AI scores you.",
                },
                {
                  title: "Headline & summary",
                  description:
                    "A two-line summary of who you are. Recruiters skim this; the AI does not score on it.",
                },
                {
                  title: "Skills & technologies",
                  description:
                    "List the skills you actually use, with self-rated proficiency. The AI cross-references these with your resume evidence.",
                },
                {
                  title: "Work preferences",
                  description:
                    "Remote / hybrid / on-site, expected salary range, willingness to relocate. Used to filter which jobs we surface to you.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "ai",
              title: "What 'AI Suggested' means",
              body: "When you upload a resume, the parser pre-fills your skills, work history, and education. Each pre-filled field shows an 'AI Suggested' chip. Edit anything, the chip becomes 'Edited' once you've reviewed it. The data is yours; the AI is just typing for you.",
            },
          ],
        },
        {
          id: "upload-resume",
          icon: FileText,
          kicker: "Files",
          title: "Upload your resume",
          lede: "PDF or DOCX, up to 10 MB. Newest version wins.",
          blocks: [
            {
              kind: "fields",
              entries: [
                {
                  label: "Accepted formats",
                  description:
                    "PDF (preferred, preserves layout) or DOCX. Avoid scanned images; the parser cannot read text from a screenshot.",
                },
                {
                  label: "File size",
                  description:
                    "Up to 10 MB per file. If your resume is larger, it likely has embedded high-res images that aren't doing you favors anyway.",
                },
                {
                  label: "Versioning",
                  description:
                    "Uploading a new resume creates a new version. The previous version stays attached to applications you submitted before the change, recruiters see exactly the resume you sent, not a moving target.",
                },
                {
                  label: "Re-scoring",
                  description:
                    "Past applications are not automatically re-scored on a new resume version. If you want a fresh score, withdraw and re-apply (where the role still allows it).",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      label: "Applying for jobs",
      sections: [
        {
          id: "browsing",
          icon: Search,
          kicker: "Discovery",
          title: "Browsing & searching jobs",
          lede: "Filters, saved searches, and how the order is determined.",
          blocks: [
            {
              kind: "list",
              items: [
                "Filter by role type, work mode, salary range, location, and required skills.",
                "Save a search to receive a daily or weekly digest of new matches.",
                "Star a job to add it to your shortlist before deciding to apply.",
                "The default ordering is recency, not personalized 'fit', so you see new postings as they appear, not what an algorithm thinks you'll click.",
              ],
            },
          ],
        },
        {
          id: "applying",
          icon: Briefcase,
          kicker: "Submission",
          title: "Applying for a job",
          lede: "What happens between Submit and the recruiter seeing you.",
          blocks: [
            {
              kind: "steps",
              items: [
                {
                  title: "You click Apply",
                  description:
                    "We attach your latest resume version and your profile snapshot. You can answer any role-specific questions inline.",
                },
                {
                  title: "We confirm",
                  description:
                    "An Application Received email is sent within seconds. The application appears in your Applications page in 'Applied' state.",
                },
                {
                  title: "We score",
                  description:
                    "The AI redacts personal identifiers, scores your resume against the role's criteria, and writes the result to the application. You'll see your match score in the Applications page once scoring completes (usually under a minute).",
                },
                {
                  title: "The recruiter reviews",
                  description:
                    "The recruiter sees the application alongside your match score and breakdown. From there, every move is human-driven.",
                },
              ],
            },
          ],
        },
        {
          id: "tracking",
          icon: Activity,
          kicker: "Status",
          title: "Tracking your applications",
          lede: "Where you are in each company's pipeline, and what the labels mean.",
          blocks: [
            {
              kind: "matrix",
              head: ["Status", "What it means"],
              rows: [
                [
                  "Applied",
                  "You've submitted; the recruiter hasn't taken action yet.",
                ],
                [
                  "Screening",
                  "The recruiter is actively reviewing your application.",
                ],
                [
                  "Interview",
                  "An interview has been scheduled or is in progress.",
                ],
                [
                  "Offer",
                  "An offer has been extended, check your inbox and the application page.",
                ],
                ["Hired", "You accepted; congratulations!"],
                [
                  "Rejected",
                  "Not moving forward for this role. The recruiter may have shared a reason.",
                ],
                ["Withdrawn", "You chose to withdraw the application."],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "You'll be emailed at every status change",
              body: "Every time the recruiter advances or otherwise moves your application, you receive a templated email. You can adjust email preferences in Settings → Notifications.",
            },
          ],
        },
        {
          id: "withdrawing",
          icon: Trash2,
          kicker: "Decisions",
          title: "Withdrawing an application",
          lede: "If you change your mind, withdrawal is one click, and not a black mark.",
          blocks: [
            {
              kind: "list",
              items: [
                "Open the application from your Applications page.",
                "Click Withdraw, optionally leaving a one-line reason.",
                "The recruiter receives a notice; the status moves to Withdrawn.",
                "You can re-apply later if the job is still open and the company allows reapplications (most do).",
              ],
            },
          ],
        },
      ],
    },
    {
      label: "Your match score",
      sections: [
        {
          id: "what-it-measures",
          icon: Target,
          kicker: "The score",
          title: "What your match score actually measures",
          lede: "And, just as importantly, what it doesn't.",
          blocks: [
            {
              kind: "fields",
              entries: [
                {
                  label: "What it measures",
                  description:
                    "How strongly the evidence in your resume aligns with the specific criteria and weights the recruiter set on this specific job.",
                },
                {
                  label: "What it does not measure",
                  description:
                    "Your worth, your future potential, your soft skills, or your fit at this company in general. It's a per-role, evidence-based number, not a verdict on you.",
                },
                {
                  label: "Why it might be lower than expected",
                  description:
                    "The most common reason: the resume doesn't surface evidence the recruiter is looking for, even if you have the experience. The fix is usually to add a project or a bullet that names the technology or outcome explicitly.",
                },
              ],
            },
          ],
        },
        {
          id: "reading-the-score",
          icon: Eye,
          kicker: "UI primer",
          title: "Reading the Score Ring and Breakdown Bar",
          lede: "Two surfaces: the headline number and the parts that built it.",
          blocks: [
            {
              kind: "matrix",
              head: ["Score range", "Match band", "What it suggests"],
              rows: [
                [
                  "70, 100",
                  "Strong Match",
                  "Your resume strongly aligns with this role's criteria.",
                ],
                [
                  "40, 69",
                  "Partial Match",
                  "Solid alignment on some criteria, gaps on others.",
                ],
                [
                  "0, 39",
                  "Limited Match",
                  "The evidence in your resume didn't strongly align with this specific role's criteria.",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "ai",
              title: "Click any segment to see the evidence",
              body: "On the application detail page, the Breakdown Bar shows one segment per criterion. Click a segment to see the exact phrase from your resume that drove the score. If the AI missed an important phrase, that's useful information for refining your resume.",
            },
          ],
        },
        {
          id: "improve-score",
          icon: TrendingUp,
          kicker: "Practical",
          title: "How to improve your match score",
          lede: "Concrete things you can change about the evidence in your resume.",
          blocks: [
            {
              kind: "list",
              items: [
                "Name the technologies and tools explicitly (the parser scores 'PostgreSQL' higher than 'a relational database').",
                "Quantify outcomes, 'reduced p99 latency by 38%' beats 'improved performance'.",
                "Map your experience to the job's criteria language. If the job calls them 'distributed systems', use those words if they're accurate.",
                "Surface relevant projects from any section, Personal, Open Source, Side projects all count if they're real.",
                "Avoid skills lists with no supporting bullet, the AI looks for evidence, not just labels.",
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Don't game the score by lying",
              body: "Stuffing your resume with keywords you can't defend in an interview helps you fail later, not succeed earlier. Recruiters interview the human, not the keyword cloud.",
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
          icon: ShieldCheck,
          kicker: "Privacy",
          title: "What the AI sees, and what it doesn't",
          lede: "Personal identifiers are stripped before any scoring call. Recruiters see your full resume; the AI does not.",
          blocks: [
            {
              kind: "fields",
              entries: [
                {
                  label: "Stripped before AI scoring",
                  description:
                    "Your name, email, phone, profile photo, address, age / date of birth, gender markers, graduation year, and the names of schools (replaced with tier / region tokens).",
                },
                {
                  label: "Visible to the AI",
                  description:
                    "Skills, technologies, role titles, durations, project descriptions, certifications, languages, and explicit qualifications, the work, not the worker's identity.",
                },
                {
                  label: "Visible to recruiters",
                  description:
                    "Your full, unredacted resume and profile. The redaction protects against AI bias, not recruiter access, recruiters need to know who they're hiring.",
                },
              ],
            },
          ],
        },
        {
          id: "data-rights",
          icon: Lock,
          kicker: "Your data",
          title: "Your data rights",
          lede: "Export, delete, or correct any data we hold about you.",
          blocks: [
            {
              kind: "list",
              items: [
                "Export, download every application, score, and resume version we have for you, in JSON.",
                "Delete account, wipes your profile, resumes, applications, and scores. Companies you applied to retain a redacted record (audit requirement) but lose your name and contact details.",
                "Correct, edit your profile any time. Past applications keep the resume version they were sent with, by design.",
                "Withdraw consent, you can revoke optional consents (marketing, analytics) without affecting your active applications.",
              ],
            },
            {
              kind: "callout",
              tone: "danger",
              title: "Delete is permanent",
              body: "After confirmation, we have 30 days to fully purge backups. After that, the data is unrecoverable. Export first if you might want a copy.",
            },
          ],
        },
        {
          id: "report-bias",
          icon: ShieldCheck,
          kicker: "Fairness",
          title: "Report a bias concern",
          lede: "If you suspect a job description, scoring outcome, or recruiter behavior was biased, please tell us.",
          blocks: [
            {
              kind: "paragraph",
              text: "Concerns are reviewed by AuraHire's fairness team. Reports are tied to your account, but your identity is not shared with the recruiter being reviewed. If a pattern is identified, the company is notified at the workspace level, not the individual application level.",
            },
            {
              kind: "fields",
              entries: [
                {
                  label: "What to include",
                  description:
                    "The application or job URL, the specific phrase or score that concerned you, and what you'd like reviewed.",
                },
                {
                  label: "Where to send",
                  description:
                    "hello@aurahire.site, please use the subject line “Fairness review” so we route it to the right reviewer.",
                },
                {
                  label: "What we'll do",
                  description:
                    "Acknowledge within 48 hours, review the audit log, and respond within 10 business days with what we found and any action taken.",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      label: "Interviews & offers",
      sections: [
        {
          id: "interview-invites",
          icon: Calendar,
          kicker: "Schedule",
          title: "Interview invites",
          lede: "Receiving, scheduling, joining, and rescheduling.",
          blocks: [
            {
              kind: "steps",
              items: [
                {
                  title: "You receive an invite email",
                  description:
                    "It includes the date, time, mode (video / phone / on-site), interviewer name(s), and an optional agenda.",
                },
                {
                  title: "Add to your calendar",
                  description:
                    "Click the calendar attachment in the email, or use the Add to calendar button on your application page.",
                },
                {
                  title: "Need to reschedule?",
                  description:
                    "Reply to the email or use the Reschedule action on the application page. The recruiter is notified and the audit log captures the change.",
                },
                {
                  title: "Join the interview",
                  description:
                    "For video calls, the meeting link is in the invite. We send a 2-hour reminder, with the link surfaced.",
                },
              ],
            },
          ],
        },
        {
          id: "offers-decisions",
          icon: Award,
          kicker: "Closing",
          title: "Receiving and responding to an offer",
          lede: "What an offer looks like, what you can negotiate, and how to respond.",
          blocks: [
            {
              kind: "fields",
              entries: [
                {
                  label: "What's in an offer",
                  description:
                    "Compensation, start date, role title, and a free-text body from the recruiter. Some offers include benefits or equity; some defer those to a separate document.",
                },
                {
                  label: "Expiration",
                  description:
                    "Every offer has an explicit expiration date. If you don't respond by then, the offer auto-expires.",
                },
                {
                  label: "Accept",
                  description:
                    "Click Accept on the offer page. Your application moves to Hired and the recruiter is notified.",
                },
                {
                  label: "Decline",
                  description:
                    "Click Decline, optionally leaving a reason. The recruiter is notified and the application moves out of the offer state.",
                },
                {
                  label: "Negotiate",
                  description:
                    "Email the recruiter directly, AuraHire doesn't run the negotiation, but the recruiter's contact info is on the offer page.",
                },
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Don't let an offer expire by accident",
              body: "We send reminders 72 hours and 24 hours before expiration, but if you need more time, ask the recruiter for an extension. They can almost always grant it.",
            },
          ],
        },
        {
          id: "notifications",
          icon: Bell,
          kicker: "Alerts",
          title: "Notifications",
          lede: "Granular control over what we email you about.",
          blocks: [
            {
              kind: "matrix",
              head: ["Event", "In-app", "Email"],
              rows: [
                ["Application received confirmation", "Yes", "Immediate"],
                ["Status change on your application", "Yes", "Immediate"],
                ["Interview invite or reschedule", "Yes", "Immediate"],
                ["Interview reminder (2h before)", "Yes", "Yes"],
                ["Offer received", "Yes", "Immediate"],
                ["Offer expiration warning (72h, 24h)", "Yes", "Yes"],
                ["New job matching a saved search", "No", "Daily / weekly"],
              ],
            },
          ],
        },
        {
          id: "navigating-portal",
          icon: Layers,
          kicker: "Layout",
          title: "Find your way around",
          lede: "What lives where in the candidate portal.",
          blocks: [
            {
              kind: "fields",
              entries: [
                {
                  label: "Dashboard",
                  description:
                    "A personalized snapshot, recent applications, upcoming interviews, and saved-search matches.",
                },
                {
                  label: "Browse Jobs",
                  description:
                    "All open jobs across companies on AuraHire. Filter, save, and apply.",
                },
                {
                  label: "Applications",
                  description:
                    "Every application you've ever submitted, with status, score, and history.",
                },
                {
                  label: "Interviews",
                  description:
                    "Your interview calendar across all applications.",
                },
                {
                  label: "Profile / Resume",
                  description:
                    "Edit your profile or upload a new resume version.",
                },
                {
                  label: "Settings",
                  description:
                    "Notification preferences, password, and data rights.",
                },
              ],
            },
          ],
        },
        {
          id: "offer-letter",
          icon: FileCheck,
          kicker: "Documentation",
          title: "Offer letter records",
          lede: "Your offer is preserved permanently, you can always come back to it.",
          blocks: [
            {
              kind: "list",
              items: [
                "Sent offers are saved on the application detail page indefinitely.",
                "If the recruiter rescinds and re-sends, both versions are visible to you.",
                "You can download a PDF of any offer for your records.",
              ],
            },
          ],
        },
      ],
    },
  ],
  faq: [
    {
      q: "Why is my match score lower than I expected?",
      a: "Open the breakdown, the most common cause is that your resume doesn't name the specific technologies or outcomes the role calls for, even when you have the experience. Adding a clear bullet usually moves the score meaningfully.",
    },
    {
      q: "Does the AI see my name, age, or photo?",
      a: "No. Personal identifiers (name, email, phone, photo, address, age, gender markers, graduation year) are redacted before the resume is ever sent to the AI for scoring. Recruiters see the full resume; the AI does not.",
    },
    {
      q: "Can I see the same score and evidence the recruiter sees?",
      a: "Yes. Your match score and the evidence breakdown are visible to you on every application's detail page. There's no 'recruiter-only' version.",
    },
    {
      q: "How do I improve my match score for a specific role?",
      a: "Edit your resume to surface the evidence the role asks for. Naming the technology, quantifying outcomes, and using the role's vocabulary all help. Then withdraw and re-apply (if the role allows it) for a fresh score.",
    },
    {
      q: "What happens when I withdraw an application?",
      a: "The recruiter is notified and the status moves to Withdrawn. Your application stays in your history; the resume version you sent stays attached to it. You can re-apply later if the role is still open.",
    },
    {
      q: "Can I delete my account and all my data?",
      a: "Yes, Settings → Privacy → Delete account. Your profile, resumes, applications, and scores are wiped within 30 days (including backups). Companies you applied to keep a redacted audit record but lose your name and contact details.",
    },
    {
      q: "Why didn't I hear back from a company?",
      a: "Recruiters review on their own schedule. Most send a status update within two weeks; some take longer. The application page is the source of truth, if it still says 'Applied' or 'Screening', they're still considering it. If it's been more than 30 days, a polite follow-up is reasonable.",
    },
    {
      q: "Can I apply to multiple jobs at the same company?",
      a: "Yes, as long as the roles are open. Each application is scored against its own criteria, and the recruiter can see all your applications at the workspace.",
    },
  ],
  contact: {
    title: "Need a human?",
    body: "Email us, we typically reply within one business day. For fairness or bias concerns, use the subject line “Fairness review” so it routes correctly.",
    email: "hello@aurahire.site",
    secondaryLink: { label: "Browse open jobs", href: "/candidate/jobs" },
  },
};
