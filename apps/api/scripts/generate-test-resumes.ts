/**
 * Generate three realistic test resume PDFs for AI smoke-test fixtures.
 *
 * Output: apps/api/test/fixtures/resumes/
 *   01-strong-senior-engineer.pdf - Maria Reyes (polished senior)
 *   02-recent-graduate-sparse.pdf - Jordan Cruz (entry-level, sparse)
 *   03-career-changer-mixed.pdf  - Sam Chen (PM transitioning to eng)
 *
 * Run: pnpm --filter @aurahire/api tsx scripts/generate-test-resumes.ts
 */
import { createWriteStream, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import PDFDocument from "pdfkit";

type Contact = {
  email: string;
  phone: string;
  location: string;
};

type ExperienceEntry = {
  title: string;
  company: string;
  dates: string;
  bullets: string[];
};

type EducationEntry = {
  degree: string;
  school: string;
  dates: string;
  gpa?: string;
};

type ProjectEntry = {
  name: string;
  description: string;
};

type Resume = {
  filename: string;
  name: string;
  headline: string;
  contact: Contact;
  summary: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  projects?: ProjectEntry[];
  skills: string[];
  certifications: string[];
  /** "polished" applies tighter spacing + colored headline; "plain" uses simpler layout */
  style: "polished" | "plain";
};

const OUTPUT_DIR = resolve(__dirname, "..", "test", "fixtures", "resumes");

const resumes: Resume[] = [
  {
    filename: "01-strong-senior-engineer.pdf",
    name: "Maria Reyes",
    headline: "Senior Software Engineer",
    contact: {
      email: "maria.reyes@example.com",
      phone: "+63 917 555 0101",
      location: "Manila, Philippines",
    },
    summary:
      "6+ years building production TypeScript / Node.js platforms; led migrations from monoliths to NestJS-based services. Strong focus on developer experience, observability, and team mentorship.",
    experience: [
      {
        title: "Senior Software Engineer",
        company: "Acme Corp",
        dates: "2022 - Present",
        bullets: [
          "Led 4-engineer team migrating a legacy Express monolith to a NestJS-based service mesh, reducing p95 latency by 38%.",
          "Designed multi-tenant PostgreSQL schema with row-level security, supporting 12k+ active organizations.",
          "Owned CI/CD pipeline on AWS (ECS, RDS, S3) with full infra-as-code via Terraform.",
          "Mentored two mid-level engineers; drove quarterly architecture reviews.",
        ],
      },
      {
        title: "Software Engineer",
        company: "TechCo",
        dates: "2019 - 2022",
        bullets: [
          "Built customer-facing React/Redux dashboard consumed by 8k DAU.",
          "Containerized 14 microservices with Docker; reduced cold-start time by 60%.",
          "Wrote integration test harness covering 78% of critical Node.js API paths.",
        ],
      },
      {
        title: "Junior Engineer",
        company: "StartupX",
        dates: "2018 - 2019",
        bullets: [
          "Shipped Django-based admin tooling for internal ops team.",
          "Migrated legacy MySQL data into a normalized analytics schema.",
        ],
      },
    ],
    education: [
      {
        degree: "BS Computer Science",
        school: "University of the Philippines",
        dates: "2014 - 2018",
        gpa: "3.7",
      },
    ],
    skills: [
      "TypeScript",
      "JavaScript",
      "React",
      "Node.js",
      "NestJS",
      "PostgreSQL",
      "AWS",
      "Docker",
      "Kubernetes",
      "Git",
      "REST APIs",
      "GraphQL",
    ],
    certifications: ["AWS Solutions Architect Associate (2023)"],
    style: "polished",
  },
  {
    filename: "02-recent-graduate-sparse.pdf",
    name: "Jordan Cruz",
    headline: "Computer Science Graduate",
    contact: {
      email: "jordan.cruz@example.com",
      phone: "+63 917 555 0202",
      location: "Quezon City, Philippines",
    },
    summary:
      "Recent CS graduate seeking entry-level software engineering opportunities.",
    experience: [
      {
        title: "Web Developer Intern",
        company: "Local Web Studio",
        dates: "2024 (3 months)",
        bullets: [
          "Built static landing pages using HTML, CSS, and vanilla JavaScript.",
          "Assisted senior developer with bug fixes on small client websites.",
        ],
      },
    ],
    education: [
      {
        degree: "BS Information Technology",
        school: "Mapua University",
        dates: "2020 - 2024",
        gpa: "3.2",
      },
    ],
    projects: [
      {
        name: "TaskMaster",
        description:
          "TODO web app built with HTML/CSS/JavaScript. Stores tasks in localStorage; supports add, edit, delete, and complete actions.",
      },
    ],
    skills: ["Python", "JavaScript", "HTML", "CSS", "Git basics"],
    certifications: [],
    style: "plain",
  },
  {
    filename: "03-career-changer-mixed.pdf",
    name: "Sam Chen",
    headline: "Product Manager transitioning to Software Engineering",
    contact: {
      email: "sam.chen@example.com",
      phone: "+63 917 555 0303",
      location: "Cebu City, Philippines",
    },
    summary:
      "Seven-year product career; recently completed full-stack engineering bootcamp; seeking junior/mid engineering roles. Comfortable bridging PM and engineering conversations.",
    experience: [
      {
        title: "Senior Product Manager",
        company: "FinTechCo",
        dates: "2020 - 2024",
        bullets: [
          "Led 3 product launches across web and mobile, owning roadmap and KPIs.",
          "Wrote SQL queries against the data warehouse for weekly product reviews.",
          "Used basic Python (pandas) to prototype reporting dashboards.",
          "Coordinated 6-engineer pod via Jira; ran biweekly stakeholder sync.",
        ],
      },
      {
        title: "Product Manager",
        company: "MarketingCo",
        dates: "2017 - 2020",
        bullets: [
          "Owned A/B testing program across the marketing site (150+ experiments).",
          "Managed stakeholder alignment across marketing, design, and engineering.",
        ],
      },
      {
        title: "Associate Product Manager",
        company: "ConsumerCo",
        dates: "2015 - 2017",
        bullets: [
          "Conducted 40+ user research interviews; synthesized into product briefs.",
          "Built clickable prototypes in Figma for early concept validation.",
        ],
      },
    ],
    education: [
      {
        degree: "MBA",
        school: "De La Salle University",
        dates: "2013 - 2015",
      },
      {
        degree: "Full-Stack Engineering Bootcamp Cert",
        school: "Coding Dojo Manila",
        dates: "2024",
      },
    ],
    skills: [
      "JavaScript",
      "React (basic)",
      "Node.js (basic)",
      "SQL",
      "Jira",
      "Asana",
      "Stakeholder Management",
      "Product Strategy",
      "A/B Testing",
    ],
    certifications: ["Certified Scrum Product Owner (2018)"],
    style: "plain",
  },
];

const INK = "#0a0b0d";
const BODY = "#5b616e";
const MUTED = "#7c828a";
const ACCENT = "#2563eb";
const HAIRLINE = "#dee1e6";

function drawHeader(doc: PDFKit.PDFDocument, resume: Resume) {
  const accent = resume.style === "polished" ? ACCENT : INK;
  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(22)
    .text(resume.name, { continued: false });
  doc.moveDown(0.15);
  doc.fillColor(accent).font("Helvetica").fontSize(13).text(resume.headline);
  doc.moveDown(0.3);

  const { email, phone, location } = resume.contact;
  doc
    .fillColor(BODY)
    .font("Helvetica")
    .fontSize(10)
    .text(`${email}  ·  ${phone}  ·  ${location}`);

  doc.moveDown(0.5);
  const y = doc.y;
  doc
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .lineWidth(0.75)
    .strokeColor(HAIRLINE)
    .stroke();
  doc.moveDown(0.4);
}

function drawSectionHeader(doc: PDFKit.PDFDocument, label: string) {
  doc.moveDown(0.4);
  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(label.toUpperCase(), { characterSpacing: 0.6 });
  doc.moveDown(0.2);
}

function drawSummary(doc: PDFKit.PDFDocument, summary: string) {
  drawSectionHeader(doc, "Summary");
  doc.fillColor(BODY).font("Helvetica").fontSize(10.5).text(summary, {
    align: "left",
    lineGap: 2,
  });
}

function drawExperience(doc: PDFKit.PDFDocument, items: ExperienceEntry[]) {
  drawSectionHeader(doc, "Experience");
  items.forEach((item, idx) => {
    if (idx > 0) doc.moveDown(0.4);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(item.title, {
      continued: true,
    });
    doc
      .fillColor(BODY)
      .font("Helvetica")
      .fontSize(11)
      .text(`  -  ${item.company}`);
    doc
      .fillColor(MUTED)
      .font("Helvetica-Oblique")
      .fontSize(9.5)
      .text(item.dates);
    doc.moveDown(0.15);
    doc.fillColor(BODY).font("Helvetica").fontSize(10);
    item.bullets.forEach((bullet) => {
      doc.text(`•  ${bullet}`, {
        indent: 8,
        lineGap: 1.5,
      });
    });
  });
}

function drawEducation(doc: PDFKit.PDFDocument, items: EducationEntry[]) {
  drawSectionHeader(doc, "Education");
  items.forEach((item, idx) => {
    if (idx > 0) doc.moveDown(0.25);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(item.degree, {
      continued: true,
    });
    doc
      .fillColor(BODY)
      .font("Helvetica")
      .fontSize(11)
      .text(`  -  ${item.school}`);
    const trailing = item.gpa
      ? `${item.dates}  ·  GPA ${item.gpa}`
      : item.dates;
    doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(9.5).text(trailing);
  });
}

function drawProjects(doc: PDFKit.PDFDocument, items: ProjectEntry[]) {
  drawSectionHeader(doc, "Projects");
  items.forEach((item, idx) => {
    if (idx > 0) doc.moveDown(0.3);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(item.name);
    doc
      .fillColor(BODY)
      .font("Helvetica")
      .fontSize(10)
      .text(item.description, { lineGap: 1.5 });
  });
}

function drawSkills(doc: PDFKit.PDFDocument, skills: string[]) {
  drawSectionHeader(doc, "Skills");
  doc
    .fillColor(BODY)
    .font("Helvetica")
    .fontSize(10.5)
    .text(skills.join("  ·  "), { lineGap: 2 });
}

function drawCertifications(doc: PDFKit.PDFDocument, certs: string[]) {
  if (certs.length === 0) return;
  drawSectionHeader(doc, "Certifications");
  doc.fillColor(BODY).font("Helvetica").fontSize(10.5);
  certs.forEach((cert) => {
    doc.text(`•  ${cert}`, { indent: 8, lineGap: 1.5 });
  });
}

async function generate(
  resume: Resume,
): Promise<{ path: string; bytes: number }> {
  const outPath = resolve(OUTPUT_DIR, resume.filename);
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    compress: false,
    info: {
      Title: `${resume.name} - Resume`,
      Author: resume.name,
    },
  });

  const stream = createWriteStream(outPath);
  doc.pipe(stream);

  drawHeader(doc, resume);
  drawSummary(doc, resume.summary);
  drawExperience(doc, resume.experience);
  drawEducation(doc, resume.education);
  if (resume.projects && resume.projects.length > 0) {
    drawProjects(doc, resume.projects);
  }
  drawSkills(doc, resume.skills);
  drawCertifications(doc, resume.certifications);

  doc.end();

  await new Promise<void>((resolvePromise, rejectPromise) => {
    stream.on("finish", () => resolvePromise());
    stream.on("error", rejectPromise);
  });

  const { statSync } = await import("node:fs");
  const bytes = statSync(outPath).size;
  return { path: outPath, bytes };
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Writing test resume PDFs to ${OUTPUT_DIR}\n`);
  for (const resume of resumes) {
    const { path, bytes } = await generate(resume);
    const kb = (bytes / 1024).toFixed(1);
    console.log(`  ✓ ${resume.filename}  (${kb} KB)  - ${path}`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Failed to generate test resumes:", err);
  process.exit(1);
});
