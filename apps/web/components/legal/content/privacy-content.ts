import {
  Archive,
  BookMarked,
  Building2,
  Cookie,
  Database,
  EyeOff,
  Globe2,
  KeyRound,
  Lock,
  RefreshCw,
  ScanFace,
  ScrollText,
  Sparkles,
  UserCog,
  Users,
} from "lucide-react";
import type { LegalDocument } from "../legal-types";

export const privacyPolicy: LegalDocument = {
  hero: {
    eyebrow: "Legal · Privacy Policy",
    title: "Privacy Policy",
    lede: "How AuraHire collects, redacts, processes, and retains personal data across candidates, recruiters, and administrators — and the rights you have over that data.",
    effectiveDate: "May 1, 2026",
    lastUpdated: "May 1, 2026",
    version: "v1.0",
  },
  summary: [
    {
      label: "Privacy by construction",
      body: "Personally-identifying information is redacted from resumes before reaching any AI scoring call. Redaction is logged on every score.",
    },
    {
      label: "You stay in control",
      body: "You can access, correct, export, or delete your personal data from your account settings — and ask us if you cannot find what you need.",
    },
    {
      label: "No hidden third parties",
      body: "We list every category of processor that touches your data and limit recruiters to candidates who have applied to their roles.",
    },
  ],
  sections: [
    {
      id: "overview",
      number: "01",
      icon: ScrollText,
      title: "Overview",
      lede: "AuraHire is an explainable, AI-assisted recruitment platform. This Privacy Policy describes the personal data we handle and why.",
      blocks: [
        {
          kind: "paragraph",
          text: "This Policy applies to the AuraHire web application, marketing pages, supporting APIs, transactional emails, and any related services we operate (collectively, the “Platform”). It is incorporated into our Terms of Service and applies to candidates, recruiters, company administrators, and platform administrators.",
        },
        {
          kind: "definitions",
          entries: [
            {
              term: "Personal data",
              definition:
                "Information that identifies — or could reasonably be linked to — a natural person, such as name, email, phone, location, or resume content.",
            },
            {
              term: "Processing",
              definition:
                "Any operation performed on personal data, including collection, storage, use, transmission, redaction, scoring, anonymization, and deletion.",
            },
            {
              term: "Controller / processor",
              definition:
                "AuraHire is the controller of candidate-account data. For application data inside a hiring company, AuraHire acts as a processor on behalf of that company.",
            },
          ],
        },
      ],
    },
    {
      id: "data-we-collect",
      number: "02",
      icon: Database,
      title: "Information we collect",
      lede: "We collect only what is needed to operate AuraHire. Each category is tied to a specific purpose, listed in the next section.",
      blocks: [
        {
          kind: "fields",
          entries: [
            {
              label: "Account data",
              description:
                "Name, email address, role (candidate / recruiter / admin), authentication identifiers, and timestamps for sign-up and last sign-in.",
            },
            {
              label: "Candidate profile",
              description:
                "Resume file and parsed structured fields, headline and summary, skills, work history, education, location, work authorization, salary expectations, and work preferences.",
            },
            {
              label: "Application data",
              description:
                "The roles you apply to, role-specific answers, your match score and its component breakdown, evidence excerpts, recruiter notes you can see, and lifecycle status.",
            },
            {
              label: "Recruiter & company data",
              description:
                "Company name and details, job descriptions you author, scoring weights you configure, bias-flag overrides, and team-member roster.",
            },
            {
              label: "Communications",
              description:
                "Transactional emails we send you, support requests you raise, and messages exchanged through interview-flow surfaces.",
            },
            {
              label: "Device & log data",
              description:
                "IP address, user-agent string, timestamps, request paths, error logs, and limited security telemetry — used to operate and protect the Platform.",
            },
            {
              label: "Audit log entries",
              description:
                "Records of consequential actions — publishing a job, advancing or rejecting an application, extending or rescinding an offer, configuration changes — kept for transparency and compliance.",
            },
          ],
        },
      ],
    },
    {
      id: "how-we-use",
      number: "03",
      icon: BookMarked,
      title: "How we use your information",
      lede: "Each category we collect maps to a purpose. We do not sell personal data, and we do not use it for purposes incompatible with the ones disclosed here.",
      blocks: [
        {
          kind: "list",
          items: [
            "Operating the Platform — authenticating users, presenting your dashboard, delivering applications to recruiters, and routing notifications.",
            "Computing match scores — extracting structured evidence, redacting personal identifiers, and producing explainable scores against role criteria.",
            "Mitigating bias — checking job descriptions for biased language and exposing aggregate fairness metrics to platform admins.",
            "Securing the Platform — detecting abuse, throttling unusual traffic, and investigating incidents.",
            "Communicating — sending transactional emails (verification, status updates, interview invitations) and responding to support requests.",
            "Maintaining audit trails — recording consequential actions for transparency, dispute resolution, and regulatory compliance.",
            "Improving the product — analyzing aggregate, de-identified usage patterns. We do not train AI models on your personal data without an explicit, opt-in basis.",
          ],
        },
        {
          kind: "callout",
          tone: "ai",
          title: "We do not train models on your data",
          body: "AI scoring uses third-party foundation models in inference mode only. We do not send personal data to model providers for training, fine-tuning, or evaluation without an explicit opt-in.",
        },
      ],
    },
    {
      id: "pii-redaction",
      number: "04",
      icon: EyeOff,
      title: "PII redaction before AI scoring",
      lede: "Reducing the surface where personal identifiers reach the AI is the most important fairness lever in the Platform.",
      blocks: [
        {
          kind: "paragraph",
          text: "Before any resume content is sent to an AI scoring or parsing model, it passes through an automated PII redaction step. The redaction targets categories of data that should not influence a score.",
        },
        {
          kind: "list",
          items: [
            "Names and contact details — first/last name, email, phone, postal address, social-network handles.",
            "Demographic-correlated identifiers — date of birth, photographs, gender pronouns, marital status, nationality.",
            "Locations beyond the granularity needed for a role match — full street addresses are reduced to city / region.",
            "Other identifiers a recruiter does not need to score against role criteria — passport numbers, government IDs, references' personal details.",
          ],
        },
        {
          kind: "callout",
          tone: "info",
          title: "Redaction is recorded",
          body: "Each scoring call records which fields were redacted, the prompt version, the model used, and the latency — so the same score can be reproduced and reviewed.",
        },
      ],
    },
    {
      id: "ai-processing",
      number: "05",
      icon: Sparkles,
      title: "AI processing disclosure",
      lede: "Where AI is involved, we tell you what it does, what it sees, and what it cannot do.",
      blocks: [
        {
          kind: "fields",
          entries: [
            {
              label: "What the AI sees",
              description:
                "Redacted resume content, the role's stated criteria, and (for bias detection) the job-description text. The AI does not see your name, contact details, or photograph.",
            },
            {
              label: "What the AI does",
              description:
                "Produces a structured match score with component breakdowns and evidence excerpts; flags potentially-biased language in job descriptions; suggests profile completeness improvements.",
            },
            {
              label: "What the AI never decides",
              description:
                "Hiring decisions. Advancing, rejecting, interviewing, or offering — every consequential step is taken by a human and recorded in the audit log.",
            },
            {
              label: "Right to a human review",
              description:
                "Candidates may request a human review of any AI score. Recruiters are required to consider the request in good faith and to record the outcome.",
            },
          ],
        },
      ],
    },
    {
      id: "cookies",
      number: "06",
      icon: Cookie,
      title: "Cookies & tracking",
      lede: "We use cookies and similar technologies sparingly — only what is needed for sign-in, security, and essential functionality.",
      blocks: [
        {
          kind: "list",
          items: [
            "Authentication cookies — set by our identity provider so you stay signed in. These are strictly necessary.",
            "Session cookies — used to keep your in-product state (filters, drawer open/closed) consistent during a visit.",
            "Security cookies — used for CSRF protection and to detect anomalous activity.",
          ],
        },
        {
          kind: "paragraph",
          text: "We do not deploy advertising cookies, cross-site trackers, or third-party analytics that profile users for marketing. If we ever introduce optional analytics, we will obtain your consent first where required by law.",
        },
      ],
    },
    {
      id: "data-sharing",
      number: "07",
      icon: Users,
      title: "How we share data",
      lede: "Data is shared only with the parties needed to deliver AuraHire and only to the extent each party needs.",
      blocks: [
        {
          kind: "fields",
          entries: [
            {
              label: "With recruiters",
              description:
                "Your application Content is shared with the company that posted the role you applied to. They see your resume, profile, score, and evidence breakdown for the purpose of evaluating you for that role only.",
            },
            {
              label: "With other candidates",
              description:
                "Never. Candidates do not see other candidates' applications, scores, or profiles.",
            },
            {
              label: "With service providers",
              description:
                "A small number of vetted processors — hosting, database, transactional email, AI inference, error monitoring, and authentication. Each is bound by a data-processing agreement aligned with this Policy.",
            },
            {
              label: "For legal reasons",
              description:
                "If required by valid legal process, or if necessary to protect the rights, property, or safety of AuraHire, our users, or the public — we may disclose limited personal data and we will narrow the disclosure where lawful.",
            },
            {
              label: "Business transfers",
              description:
                "If AuraHire is involved in a merger, acquisition, or asset sale, your data may transfer to the successor entity, which will continue to honor commitments materially equivalent to this Policy.",
            },
          ],
        },
      ],
    },
    {
      id: "retention",
      number: "08",
      icon: Archive,
      title: "Data retention",
      lede: "We keep data only as long as needed for the purpose it was collected and for legitimate audit, dispute-resolution, and legal-compliance reasons.",
      blocks: [
        {
          kind: "fields",
          entries: [
            {
              label: "Active accounts",
              description:
                "Account, profile, resume, and application data are retained for as long as your account is active.",
            },
            {
              label: "Closed candidate accounts",
              description:
                "When you close your account, profile and resume data are deleted within thirty (30) days. Application records that affect a recruiter's hiring history are anonymized rather than deleted.",
            },
            {
              label: "Closed company accounts",
              description:
                "Company data is deleted within ninety (90) days, except for audit-log entries linked to candidate-facing decisions, which are retained for the period required by applicable employment law.",
            },
            {
              label: "Audit logs",
              description:
                "Audit-log entries about consequential actions are retained for at least seven (7) years to support fairness audits, dispute resolution, and regulatory inquiries.",
            },
            {
              label: "Backups",
              description:
                "Encrypted backups roll off automatically within thirty (30) days. Deletion requests propagate to backups within that window.",
            },
          ],
        },
      ],
    },
    {
      id: "security",
      number: "09",
      icon: Lock,
      title: "Security",
      lede: "Security is layered — at the network edge, the application tier, the database, and the AI boundary.",
      blocks: [
        {
          kind: "list",
          items: [
            "Transport security — all traffic is served over HTTPS with modern TLS configurations.",
            "Authentication — JWT-based session tokens validated on every request, with role-based access control on protected endpoints.",
            "Database — Postgres with row-level security policies that scope every read/write to the rows the user is allowed to see.",
            "Backend isolation — AI keys and database credentials live only on the backend. The frontend never sees them.",
            "Auditability — consequential mutations write to an immutable audit log.",
            "Operational hygiene — least-privilege access for engineers, encrypted backups, and incident-response runbooks.",
          ],
        },
        {
          kind: "callout",
          tone: "warning",
          title: "No system is invulnerable",
          body: "If we discover a security incident affecting your personal data, we will notify you within the timelines required by applicable law and explain what happened, what was affected, and what we are doing about it.",
        },
      ],
    },
    {
      id: "your-rights",
      number: "10",
      icon: UserCog,
      title: "Your rights & choices",
      lede: "Where data-protection law applies, you have rights over the personal data we hold about you. We honor these rights regardless of where you live, subject to verification.",
      blocks: [
        {
          kind: "fields",
          entries: [
            {
              label: "Access",
              description:
                "Request a copy of the personal data we hold about you, including resume parses, scores, and evidence excerpts.",
            },
            {
              label: "Correction",
              description:
                "Update inaccurate or incomplete personal data directly from your settings, or by contacting us if a field is not editable.",
            },
            {
              label: "Deletion",
              description:
                "Close your account or request erasure. We will comply unless we have a legal basis to retain specific records (such as audit-log entries).",
            },
            {
              label: "Portability",
              description:
                "Export your profile data in a machine-readable format from settings, or by request.",
            },
            {
              label: "Objection",
              description:
                "Object to specific processing — including AI scoring — by contacting our privacy team. Where objection is feasible, we will accommodate it; where the processing is essential to the service, we will explain why.",
            },
            {
              label: "Withdraw consent",
              description:
                "Where processing is based on consent (such as optional analytics), withdraw that consent at any time without affecting the lawfulness of past processing.",
            },
            {
              label: "Complain",
              description:
                "Lodge a complaint with your local data-protection authority. We would prefer the chance to address your concern first — please contact us.",
            },
          ],
        },
      ],
    },
    {
      id: "sub-processors",
      number: "11",
      icon: Building2,
      title: "Sub-processors",
      lede: "We name the categories of vetted third parties that help us run the Platform.",
      blocks: [
        {
          kind: "list",
          items: [
            "Cloud hosting — for compute and storage of application infrastructure.",
            "Managed Postgres — for relational data, with row-level security and encryption at rest.",
            "Authentication — for sign-in, JWT issuance, and password recovery.",
            "AI inference — for resume parsing, match scoring, and bias detection. Used in inference mode only; data is not used for training.",
            "Transactional email — for verification emails, status updates, and interview notifications.",
            "Error monitoring — for application-error reporting; configured to scrub personal data from payloads.",
          ],
        },
        {
          kind: "paragraph",
          text: "An up-to-date list of named sub-processors is available on request. We give reasonable advance notice before adding a new sub-processor that materially expands the categories of personal data processed.",
        },
      ],
    },
    {
      id: "international-transfers",
      number: "12",
      icon: Globe2,
      title: "International transfers",
      blocks: [
        {
          kind: "paragraph",
          text: "AuraHire and its sub-processors may process personal data in countries other than the one in which it was collected. Where required, we use standard contractual clauses or other lawful transfer mechanisms to protect personal data in transit and at rest. The protections in this Policy follow your data wherever it is processed.",
        },
      ],
    },
    {
      id: "children",
      number: "13",
      icon: ScanFace,
      title: "Children's privacy",
      blocks: [
        {
          kind: "paragraph",
          text: "AuraHire is not directed to children under 16, or under the age of digital consent in your jurisdiction (whichever is higher). We do not knowingly collect personal data from children below that threshold. If we learn we have collected such data, we will delete it promptly. Contact us using the address below if you believe a child has supplied data through the Platform.",
        },
      ],
    },
    {
      id: "changes",
      number: "14",
      icon: RefreshCw,
      title: "Changes to this Policy",
      blocks: [
        {
          kind: "paragraph",
          text: "We may update this Policy from time to time. When we do, we will update the “Last updated” date at the top of this page and, for material changes, provide reasonable advance notice — typically by email or an in-product banner. Continued use of the Platform after the effective date of an update constitutes acceptance of the revised Policy. Prior versions are available on request.",
        },
      ],
    },
    {
      id: "contact",
      number: "15",
      icon: KeyRound,
      title: "How to contact us",
      blocks: [
        {
          kind: "paragraph",
          text: "Reach out using the contact card below for any privacy question, request to exercise your rights, or report of a suspected privacy issue. Where required, we will verify your identity before disclosing personal data, to protect you from impersonation.",
        },
      ],
    },
  ],
  crossLink: {
    label: "Terms of Service",
    description:
      "Read the agreement that governs your use of AuraHire — covering accounts, AI scoring, bias mitigation, intellectual property, and liability.",
    href: "/legal/terms",
  },
  contact: {
    title: "Privacy & data-protection inquiries",
    body: "Email our privacy team to exercise your rights, ask a question, or report a concern. We respond to verified requests within thirty (30) days.",
    email: "hello@aurahire.site",
    addressLines: [
      "AuraHire — Privacy",
      "Attn: Data Protection Officer",
      "aurahire.site · responses in English",
    ],
  },
};
