import {
  AlertTriangle,
  Ban,
  BookOpen,
  Briefcase,
  ClipboardCheck,
  Copyright,
  FileSignature,
  Gavel,
  HandshakeIcon,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import type { LegalDocument } from "../legal-types";

export const termsOfService: LegalDocument = {
  hero: {
    eyebrow: "Legal · Terms of Service",
    title: "Terms of Service",
    lede: "These Terms govern your access to and use of AuraHire, an explainable, AI-assisted recruitment platform serving candidates, recruiters, and administrators. Please read them carefully.",
    effectiveDate: "May 1, 2026",
    lastUpdated: "May 1, 2026",
    version: "v1.0",
  },
  summary: [
    {
      label: "Plain-language summary",
      body: "By using AuraHire you agree to these Terms. They explain how the platform works, what is expected of you, and what you can expect from us.",
    },
    {
      label: "AI-assisted, human-decided",
      body: "AuraHire's AI surfaces structured evidence to recruiters. Every hiring decision is made by a human, not by an algorithm.",
    },
    {
      label: "Built for transparency",
      body: "Match scores are explainable, fields prefilled by AI are clearly labeled, and consequential actions are recorded in an audit log.",
    },
  ],
  sections: [
    {
      id: "agreement",
      number: "01",
      icon: FileSignature,
      title: "Agreement to these Terms",
      lede: "By creating an account, browsing public pages, applying to a role, or otherwise using AuraHire, you agree to these Terms of Service (the “Terms”) and our Privacy Policy.",
      blocks: [
        {
          kind: "paragraph",
          text: "These Terms form a binding agreement between you and AuraHire (“AuraHire,” “we,” “us,” or “our”). If you do not agree, you must not use the platform. If you are using AuraHire on behalf of an organization, you represent that you have authority to bind that organization to these Terms.",
        },
        {
          kind: "definitions",
          entries: [
            {
              term: "Platform",
              definition:
                "The AuraHire web application, marketing site, supporting APIs, emails, and any related services we operate.",
            },
            {
              term: "User",
              definition:
                "Any person who accesses the Platform, including candidates, recruiters, company administrators, and platform administrators.",
            },
            {
              term: "Content",
              definition:
                "Any information you submit to the Platform, including resumes, profile data, job descriptions, application notes, messages, and feedback.",
            },
            {
              term: "AI Features",
              definition:
                "Functionality that uses machine-learning models, including resume parsing, match scoring, bias detection, and content suggestions.",
            },
          ],
        },
      ],
    },
    {
      id: "eligibility",
      number: "02",
      icon: UserCheck,
      title: "Eligibility & accounts",
      lede: "AuraHire is intended for adults using the platform for lawful recruitment-related purposes.",
      blocks: [
        {
          kind: "list",
          items: [
            "You must be at least 16 years old, or the age of digital consent in your jurisdiction, whichever is higher.",
            "You must provide accurate, current, and complete information when creating an account, and keep that information up to date.",
            "You are responsible for safeguarding your password and for all activity that occurs under your account.",
            "You agree to notify us promptly of any unauthorized access to or use of your account.",
            "One person may only operate one candidate account. Recruiters and administrators may have role-specific accounts associated with their company.",
          ],
        },
        {
          kind: "callout",
          tone: "info",
          title: "Verification may be required",
          body: "We may verify a recruiter's identity or company affiliation before granting access to job-posting and applicant-review features. Until verified, posting privileges may be limited.",
        },
      ],
    },
    {
      id: "use-of-service",
      number: "03",
      icon: Briefcase,
      title: "Use of the service",
      lede: "AuraHire connects candidates with companies, scores applications against role criteria, and records decisions for auditability. Specific functionality varies by role.",
      blocks: [
        {
          kind: "fields",
          entries: [
            {
              label: "Candidates",
              description:
                "Build a profile, upload a resume, browse and apply to roles, view your match score and the evidence behind it, and manage interviews and offers.",
            },
            {
              label: "Recruiters",
              description:
                "Publish jobs, receive and review applications, view explainable AI scores, run bias checks on job descriptions, schedule interviews, extend offers, and manage company team members.",
            },
            {
              label: "Company admins",
              description:
                "Configure scoring weights and bias-mitigation policies for your company, manage team membership, and review your company's audit log.",
            },
            {
              label: "Platform admins",
              description:
                "Operate the Platform itself, including service configuration, abuse handling, content moderation, and platform-wide audit review.",
            },
          ],
        },
        {
          kind: "paragraph",
          text: "We may add, change, or remove features at any time. When a change materially reduces functionality you have come to rely on, we will provide reasonable advance notice.",
        },
      ],
    },
    {
      id: "candidate-responsibilities",
      number: "04",
      icon: Users,
      title: "Candidate responsibilities",
      lede: "Candidates power the supply side of the marketplace. Honest, accurate information protects you and the recruiters reviewing your application.",
      blocks: [
        {
          kind: "list",
          items: [
            "Submit only resumes, work history, and credentials that genuinely belong to you.",
            "Do not impersonate another person or misrepresent your identity, employment status, qualifications, or work authorization.",
            "Do not upload content containing malware, executable scripts, or material designed to disrupt the Platform or its users.",
            "Use the application form fields as intended; do not attempt to inject instructions, prompts, or hidden text designed to manipulate AI scoring.",
            "Withdraw from a role rather than misrepresenting interest if your situation changes.",
          ],
        },
        {
          kind: "callout",
          tone: "warning",
          title: "AI scoring is evidence-based",
          body: "Match scores are computed against the resume content you actually submit. Inflating skills, fabricating experience, or attempting to manipulate the model violates these Terms and may result in account suspension.",
        },
      ],
    },
    {
      id: "recruiter-responsibilities",
      number: "05",
      icon: HandshakeIcon,
      title: "Recruiter & company responsibilities",
      lede: "Recruiters and the companies they represent must use the Platform fairly, lawfully, and in line with applicable employment regulations.",
      blocks: [
        {
          kind: "list",
          items: [
            "Post only genuine, currently-open roles that you or your company are authorized to fill.",
            "Comply with all applicable equal-employment-opportunity, anti-discrimination, and labor laws in every jurisdiction in which you recruit.",
            "Do not republish, scrape, or resell candidate data obtained through AuraHire to any third party.",
            "Use candidate Content only to evaluate the role for which the candidate applied, except where the candidate has explicitly opted in to broader visibility.",
            "Take final hiring decisions yourself; the AI is a decision-support tool, not a decision-maker.",
            "Address bias flags raised by the Platform before publishing a job description, or document your reason for overriding the flag.",
          ],
        },
        {
          kind: "callout",
          tone: "info",
          title: "Audit trails are not optional",
          body: "Consequential actions, publishing a job, extending or rescinding an offer, advancing or rejecting an application, are recorded in the audit log. This is a feature, not a bug; it is what makes fair hiring defensible.",
        },
      ],
    },
    {
      id: "ai-scoring",
      number: "06",
      icon: Sparkles,
      title: "AI scoring & explainability",
      lede: "Every AI output on AuraHire is designed to be inspectable. Numbers without explanations are not allowed.",
      blocks: [
        {
          kind: "paragraph",
          text: "When you apply to a role, the Platform extracts structured evidence from your resume, redacts personal identifiers before sending content to the AI, and produces a match score against the role's stated criteria. The score is paired with a Score Ring, a Score Breakdown Bar, and Evidence Callouts that link each component back to the specific resume excerpts that justified the score.",
        },
        {
          kind: "fields",
          entries: [
            {
              label: "Computed against role criteria",
              description:
                "Scores reflect alignment between resume evidence and the criteria the role's recruiter actually documented. They are not a measure of a candidate's worth, potential, or general employability.",
            },
            {
              label: "Match labels, not value labels",
              description:
                "Plain-language labels are limited to “Strong Match,” “Partial Match,” and “Limited Match.” We do not use words like “excellent” or “mediocre” to describe candidates.",
            },
            {
              label: "Recorded for audit",
              description:
                "Each score records its prompt version, model used, latency, and any redacted fields, so the same score can be reproduced and reviewed.",
            },
          ],
        },
        {
          kind: "callout",
          tone: "ai",
          title: "Right to a human review",
          body: "Candidates may request a human review of any AI score. Recruiters are required to consider that request in good faith and to document the outcome in the audit log.",
        },
      ],
    },
    {
      id: "bias-mitigation",
      number: "07",
      icon: ShieldCheck,
      title: "Bias mitigation disclosure",
      lede: "Fairness on AuraHire is a system property, not a marketing claim. We document it so it can be challenged and improved.",
      blocks: [
        {
          kind: "list",
          items: [
            "Resumes are passed through automated PII redaction before reaching any scoring AI call. Names, contact details, and certain demographic-correlated fields are removed from the model's view.",
            "Job descriptions are checked for biased language before publication. The author may edit, override with a documented justification, or proceed.",
            "Scoring weights are configurable by company admins and are recorded in version history; thesis-defensible defaults ship with the product.",
            "Aggregate bias metrics are exposed to platform admins through the bias-monitor surface so disparities can be identified and addressed.",
          ],
        },
        {
          kind: "callout",
          tone: "warning",
          title: "No system is perfect",
          body: "We disclose limitations openly. If you believe a score, a flag, or a model output reflects unfair behavior, contact us using the address at the bottom of this page so we can investigate and update the system if warranted.",
        },
      ],
    },
    {
      id: "ip",
      number: "08",
      icon: Copyright,
      title: "Content & intellectual property",
      lede: "You retain ownership of what you submit. We retain ownership of the Platform itself.",
      blocks: [
        {
          kind: "paragraph",
          text: "You keep all rights, title, and interest in the Content you submit. By submitting Content, you grant AuraHire a worldwide, non-exclusive, royalty-free license to host, reproduce, transmit, display, and process that Content solely to operate, improve, and secure the Platform and to deliver the services you have requested.",
        },
        {
          kind: "list",
          items: [
            "Recruiters receive a sub-license to the Content you submit to a specific application, limited to evaluating you for that role.",
            "AuraHire's name, logo, the Score Ring and Breakdown Bar visualizations, and the AuraHire user interface are proprietary to AuraHire.",
            "We do not claim ownership of resumes, profile data, or company-supplied job descriptions; we license them strictly for the purposes described.",
            "Feedback, suggestions, and bug reports you send us are non-confidential and may be used to improve the Platform without attribution.",
          ],
        },
      ],
    },
    {
      id: "privacy",
      number: "09",
      icon: BookOpen,
      title: "Privacy & data",
      lede: "How we collect, use, and protect personal data is described in our Privacy Policy, which is incorporated into these Terms by reference.",
      blocks: [
        {
          kind: "paragraph",
          text: "AuraHire applies role-based access controls, row-level security in the database, JWT-based authentication, and PII redaction before AI processing. Where you have rights under data-protection law, to access, correct, port, or delete your personal data, those rights are described in the Privacy Policy along with how to exercise them.",
        },
        {
          kind: "callout",
          tone: "info",
          title: "Privacy Policy",
          body: "See the Privacy Policy linked at the bottom of this page for full details on data handling, retention, and your rights.",
        },
      ],
    },
    {
      id: "acceptable-use",
      number: "10",
      icon: Ban,
      title: "Acceptable use",
      lede: "A short list of behaviors that are not permitted on AuraHire.",
      blocks: [
        {
          kind: "list",
          items: [
            "Do not interfere with, disrupt, or attempt to gain unauthorized access to the Platform, its infrastructure, or any other user's account.",
            "Do not scrape, harvest, or otherwise systematically collect data from the Platform except through documented APIs and within their stated limits.",
            "Do not reverse engineer, decompile, or disassemble the Platform except as expressly permitted by law.",
            "Do not use AuraHire to discriminate against candidates on the basis of any protected class, or to evaluate candidates outside of an active recruitment process.",
            "Do not use AuraHire to send unsolicited commercial communications, run political campaigns, or solicit money from candidates.",
            "Do not upload content that is unlawful, defamatory, infringing, or harmful to others.",
          ],
        },
      ],
    },
    {
      id: "termination",
      number: "11",
      icon: XCircle,
      title: "Suspension & termination",
      lede: "Either side can end the relationship; we describe how, and what happens to your data when it ends.",
      blocks: [
        {
          kind: "paragraph",
          text: "You may close your account at any time from your settings. We may suspend or terminate your access if you breach these Terms, if your continued use poses a risk to other users or to the Platform, or if we are required to do so by law.",
        },
        {
          kind: "list",
          items: [
            "We will give reasonable notice before terminating an account except where immediate action is required to protect the Platform or its users.",
            "Upon termination, your access ceases and your account is closed. Content is handled according to the retention rules in the Privacy Policy.",
            "Sections of these Terms that by their nature should survive termination, including intellectual-property, disclaimers, limitation of liability, indemnity, and governing-law provisions, survive.",
          ],
        },
      ],
    },
    {
      id: "disclaimers",
      number: "12",
      icon: AlertTriangle,
      title: "Disclaimers",
      lede: "Read this section carefully, it limits what AuraHire promises about the service.",
      blocks: [
        {
          kind: "paragraph",
          text: "The Platform is provided “as is” and “as available.” To the maximum extent permitted by law, AuraHire disclaims all warranties, express, implied, or statutory, including warranties of merchantability, fitness for a particular purpose, non-infringement, accuracy, and uninterrupted operation.",
        },
        {
          kind: "list",
          items: [
            "We do not guarantee that any candidate will be hired, that any role will be filled, or that any specific match score will result in a particular outcome.",
            "We do not guarantee that AI outputs will be free of errors. We disclose how scoring works precisely so that humans can review and correct it.",
            "We do not control the conduct of recruiters, candidates, or other users, and we are not responsible for their actions outside of the Platform's operation.",
          ],
        },
      ],
    },
    {
      id: "liability",
      number: "13",
      icon: Scale,
      title: "Limitation of liability",
      lede: "What we are responsible for, and what we are not.",
      blocks: [
        {
          kind: "paragraph",
          text: "To the maximum extent permitted by law, AuraHire and its affiliates, officers, employees, and agents will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, revenue, data, or goodwill, arising out of or in connection with these Terms or the Platform, even if advised of the possibility of such damages.",
        },
        {
          kind: "paragraph",
          text: "Our total aggregate liability for any claim arising out of or in connection with these Terms or the Platform will not exceed the greater of (a) the amount you paid us, if any, in the twelve months preceding the event giving rise to the claim, or (b) one hundred US dollars (US$100). Some jurisdictions do not allow the exclusion or limitation of certain damages; in those jurisdictions our liability is limited to the maximum extent permitted.",
        },
      ],
    },
    {
      id: "indemnity",
      number: "14",
      icon: ClipboardCheck,
      title: "Indemnification",
      blocks: [
        {
          kind: "paragraph",
          text: "You agree to defend, indemnify, and hold harmless AuraHire and its affiliates from and against any claims, liabilities, damages, losses, and expenses, including reasonable legal fees, arising out of or in any way connected with: (a) your access to or use of the Platform; (b) Content you submit; (c) your violation of these Terms; or (d) your violation of any rights of another person or entity.",
        },
      ],
    },
    {
      id: "governing-law",
      number: "15",
      icon: Gavel,
      title: "Governing law & disputes",
      blocks: [
        {
          kind: "paragraph",
          text: "These Terms are governed by the laws of the jurisdiction in which AuraHire is established, without regard to its conflict-of-law principles. You and AuraHire agree to first attempt to resolve any dispute informally by contacting us at the email address in this document. If we cannot resolve the dispute within sixty (60) days, the dispute will be submitted to the exclusive jurisdiction of the courts of that jurisdiction, except where mandatory consumer-protection law in your country of residence provides otherwise.",
        },
      ],
    },
    {
      id: "changes",
      number: "16",
      icon: RefreshCw,
      title: "Changes to these Terms",
      blocks: [
        {
          kind: "paragraph",
          text: "We may revise these Terms from time to time. When we do, we will update the “Last updated” date at the top of this page and, for material changes, provide reasonable advance notice, typically by email or an in-product banner. Continued use of the Platform after the effective date of an update constitutes acceptance of the revised Terms. Prior versions are kept on file and are available on request.",
        },
      ],
    },
  ],
  crossLink: {
    label: "Privacy Policy",
    description:
      "Read how AuraHire collects, redacts, processes, and retains personal data, including how PII is removed before AI scoring.",
    href: "/legal/privacy",
  },
  contact: {
    title: "Questions about these Terms?",
    body: "Reach our legal team for clarification, contract requests, or to report a concern about how the Platform is being used.",
    email: "hello@aurahire.site",
    addressLines: [
      "AuraHire, Legal",
      "Attn: General Counsel",
      "aurahire.site · responses in English",
    ],
  },
};
