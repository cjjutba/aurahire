/**
 * Seed DB: truncate every public-schema table, delete every Supabase auth user,
 * then create demo accounts + a populated tech-jobs corpus for end-to-end testing.
 *
 * Resulting accounts:
 *   admin@admin.com / password123 (admin)
 *   recruiter@gmail.com / password123 (recruiter — owns TechCorp company + 18 jobs)
 *
 * Plus:
 *   - 1 active scoring_config row (canonical weights: skills 40 / experience 35 / education 15 / cultural_fit 10)
 *   - 1 company (TechCorp Inc.)
 *   - 18 published tech jobs spanning web / mobile / fullstack / backend / devops / cloud / data / security / ML
 *
 * Requires DATABASE_URL, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY in apps/api/.env.
 *
 * Run from repo root:
 *   pnpm --filter @aurahire/api seed-db -- --yes
 *
 * Without --yes the script refuses to run. This is destructive: every existing
 * candidate, recruiter, job, and audit row is wiped before the seed lands.
 */
import "reflect-metadata";
import postgres from "postgres";

// Order matters only for clarity — TRUNCATE ... CASCADE handles FK dependencies.
const PUBLIC_TABLES = [
  "auth_tokens",
  "audit_logs",
  "scoring_config",
  "bias_flags",
  "evidence_excerpts",
  "match_scores",
  "profile_scores",
  "offers",
  "interviews",
  "applications",
  "resumes",
  "jobs",
  "recruiter_profiles",
  "candidate_profiles",
  "companies",
  "profiles",
];

// ─── Accounts ──────────────────────────────────────────────────────────────

const ADMIN_EMAIL = "admin@admin.com";
const ADMIN_PASSWORD = "password123";
const ADMIN_FULL_NAME = "Sprint Admin";

const RECRUITER_EMAIL = "recruiter@gmail.com";
const RECRUITER_PASSWORD = "password123";
const RECRUITER_FULL_NAME = "Maya Patel";
const RECRUITER_JOB_TITLE = "Director of Talent Acquisition";
const RECRUITER_DEPARTMENT = "People & Culture";

// ─── Company ───────────────────────────────────────────────────────────────

const COMPANY = {
  name: "TechCorp Inc.",
  industry: "Software / SaaS",
  size: "201-500" as const,
  website: "https://techcorp.dev",
  headquartersLocation: "San Francisco, CA, USA",
  description:
    "TechCorp builds developer tooling for distributed systems. We're a remote-first team of 320 across 14 time zones, with hubs in San Francisco, Berlin, and Singapore. Our products power infrastructure observability for thousands of engineering teams.",
};

// ─── Active scoring config ─────────────────────────────────────────────────

const SCORING_CONFIG = {
  matchWeights: { skills: 40, experience: 35, education: 15, cultural_fit: 10 },
  profileWeights: {
    resume_quality: 25,
    skills_breadth: 30,
    experience_depth: 30,
    preferences_clarity: 15,
  },
  bandThresholds: { strong: 70, partial: 40 },
  biasCategoriesEnabled: ["gendered", "age-coded", "ableist", "exclusionary"],
  customFlaggedTerms: [],
  piiRedactionEnabled: true,
  piiFieldsRedacted: ["name", "email", "phone", "address", "date_of_birth", "age", "gender", "photo"],
};

// ─── 18 jobs ───────────────────────────────────────────────────────────────
// Each job's `description` is HTML (Tiptap-shaped) and `descriptionPlain` is the
// stripped plaintext used by AI scoring. Content is intentionally clean (no
// biased terms) so the seed corpus publishes without override flow. Demo bias
// detection by hand-crafting one biased job during the actual demo.

interface SeedJob {
  title: string;
  department: string;
  employmentType: "full-time" | "part-time" | "contract";
  workMode: "remote" | "hybrid" | "on-site";
  locationCity: string | null;
  locationCountry: string | null;
  salaryMin: number;
  salaryMax: number;
  experienceLevel:
    | "entry"
    | "junior"
    | "mid"
    | "senior"
    | "lead"
    | "principal"
    | "manager"
    | "director"
    | "vp+";
  educationRequirement:
    | "none"
    | "high-school"
    | "associate"
    | "bachelor"
    | "master"
    | "phd"
    | "other";
  requiredSkills: string[];
  description: string;
  descriptionPlain: string;
}

const JOBS: SeedJob[] = [
  // ─── Frontend / Web ─────────────────────────────────────────────
  {
    title: "Senior Frontend Engineer (React)",
    department: "Engineering",
    employmentType: "full-time",
    workMode: "remote",
    locationCity: null,
    locationCountry: "USA",
    salaryMin: 140000,
    salaryMax: 185000,
    experienceLevel: "senior",
    educationRequirement: "bachelor",
    requiredSkills: ["React", "TypeScript", "Next.js", "GraphQL", "Tailwind CSS", "Jest"],
    description:
      "<p>We're building the next generation of our developer dashboard. You'll own the React/Next.js codebase that thousands of engineers use daily to debug their distributed systems.</p><h3>What you'll do</h3><ul><li>Design and ship features end-to-end across our React + TypeScript codebase</li><li>Partner with design + product to define interactions, not just implement them</li><li>Mentor mid-level engineers through code review and pair programming</li><li>Drive frontend architecture decisions (state management, performance, accessibility)</li></ul><h3>What we're looking for</h3><ul><li>5+ years of professional React experience</li><li>Strong TypeScript fundamentals</li><li>Experience with Next.js (App Router preferred) and modern React patterns (Server Components, Suspense)</li><li>Comfortable with GraphQL clients (Apollo, urql, or similar)</li><li>Track record of shipping production UI at scale</li></ul>",
    descriptionPlain:
      "We're building the next generation of our developer dashboard. You'll own the React/Next.js codebase that thousands of engineers use daily to debug their distributed systems. What you'll do: Design and ship features end-to-end across our React + TypeScript codebase. Partner with design + product to define interactions, not just implement them. Mentor mid-level engineers through code review and pair programming. Drive frontend architecture decisions (state management, performance, accessibility). What we're looking for: 5+ years of professional React experience. Strong TypeScript fundamentals. Experience with Next.js (App Router preferred) and modern React patterns (Server Components, Suspense). Comfortable with GraphQL clients (Apollo, urql, or similar). Track record of shipping production UI at scale.",
  },
  {
    title: "Frontend Engineer — Design Systems",
    department: "Engineering",
    employmentType: "full-time",
    workMode: "remote",
    locationCity: null,
    locationCountry: "USA",
    salaryMin: 115000,
    salaryMax: 150000,
    experienceLevel: "mid",
    educationRequirement: "bachelor",
    requiredSkills: ["React", "TypeScript", "Storybook", "CSS-in-JS", "Figma", "Accessibility (WCAG)"],
    description:
      "<p>Join our Design Systems team to build the component library that powers every product surface at TechCorp. You'll be the primary engineer working alongside designers to ship reusable, accessible primitives.</p><h3>What you'll do</h3><ul><li>Build and maintain our React component library (used by 30+ engineers across 5 products)</li><li>Document components in Storybook with usage examples and a11y notes</li><li>Audit existing surfaces for design-system adoption gaps</li><li>Run office hours to support product engineering teams</li></ul><h3>What we're looking for</h3><ul><li>3+ years building React components for production</li><li>Strong eye for visual detail and consistency</li><li>WCAG 2.1 AA familiarity (you've shipped accessible components before)</li><li>Comfortable working closely with designers in Figma</li></ul>",
    descriptionPlain:
      "Join our Design Systems team to build the component library that powers every product surface at TechCorp. You'll be the primary engineer working alongside designers to ship reusable, accessible primitives. What you'll do: Build and maintain our React component library (used by 30+ engineers across 5 products). Document components in Storybook with usage examples and a11y notes. Audit existing surfaces for design-system adoption gaps. Run office hours to support product engineering teams. What we're looking for: 3+ years building React components for production. Strong eye for visual detail and consistency. WCAG 2.1 AA familiarity (you've shipped accessible components before). Comfortable working closely with designers in Figma.",
  },
  // ─── Mobile ─────────────────────────────────────────────────────
  {
    title: "Senior iOS Engineer (Swift)",
    department: "Mobile",
    employmentType: "full-time",
    workMode: "hybrid",
    locationCity: "San Francisco",
    locationCountry: "USA",
    salaryMin: 150000,
    salaryMax: 195000,
    experienceLevel: "senior",
    educationRequirement: "bachelor",
    requiredSkills: ["Swift", "SwiftUI", "Combine", "iOS SDK", "XCTest", "Core Data"],
    description:
      "<p>We're rebuilding our iOS companion app from the ground up in SwiftUI. You'll be the senior voice in a team of three iOS engineers shaping the architecture from day one.</p><h3>What you'll do</h3><ul><li>Lead the SwiftUI rewrite of the TechCorp mobile app</li><li>Define our state management approach (Combine, observable patterns)</li><li>Set up CI/CD for App Store deployment</li><li>Mentor a junior + mid iOS engineer</li></ul><h3>What we're looking for</h3><ul><li>5+ years of iOS development with Swift</li><li>Production SwiftUI experience (not just demos)</li><li>Comfort with Core Data + Combine</li><li>Track record of shipping apps to the App Store</li></ul>",
    descriptionPlain:
      "We're rebuilding our iOS companion app from the ground up in SwiftUI. You'll be the senior voice in a team of three iOS engineers shaping the architecture from day one. What you'll do: Lead the SwiftUI rewrite of the TechCorp mobile app. Define our state management approach (Combine, observable patterns). Set up CI/CD for App Store deployment. Mentor a junior + mid iOS engineer. What we're looking for: 5+ years of iOS development with Swift. Production SwiftUI experience (not just demos). Comfort with Core Data + Combine. Track record of shipping apps to the App Store.",
  },
  {
    title: "Android Engineer (Kotlin)",
    department: "Mobile",
    employmentType: "full-time",
    workMode: "remote",
    locationCity: null,
    locationCountry: "Canada",
    salaryMin: 110000,
    salaryMax: 145000,
    experienceLevel: "mid",
    educationRequirement: "bachelor",
    requiredSkills: ["Kotlin", "Jetpack Compose", "Coroutines", "Android SDK", "Room", "MVVM"],
    description:
      "<p>Help us build the Android version of our developer companion app. You'll join a small mobile team owning the Android codebase end-to-end.</p><h3>What you'll do</h3><ul><li>Build features in Kotlin + Jetpack Compose</li><li>Manage local persistence with Room</li><li>Wire async flows with Coroutines + Flow</li><li>Ship through Google Play with our existing CI</li></ul><h3>What we're looking for</h3><ul><li>3+ years of Android development with Kotlin</li><li>Jetpack Compose experience (production preferred)</li><li>Coroutines + Flow comfortable in your daily work</li><li>Familiarity with MVVM or MVI architecture</li></ul>",
    descriptionPlain:
      "Help us build the Android version of our developer companion app. You'll join a small mobile team owning the Android codebase end-to-end. What you'll do: Build features in Kotlin + Jetpack Compose. Manage local persistence with Room. Wire async flows with Coroutines + Flow. Ship through Google Play with our existing CI. What we're looking for: 3+ years of Android development with Kotlin. Jetpack Compose experience (production preferred). Coroutines + Flow comfortable in your daily work. Familiarity with MVVM or MVI architecture.",
  },
  {
    title: "React Native Engineer",
    department: "Mobile",
    employmentType: "full-time",
    workMode: "remote",
    locationCity: null,
    locationCountry: "USA",
    salaryMin: 120000,
    salaryMax: 160000,
    experienceLevel: "mid",
    educationRequirement: "none",
    requiredSkills: ["React Native", "TypeScript", "Expo", "Redux Toolkit", "Native modules", "Jest"],
    description:
      "<p>We use React Native for cross-platform features that need to ship to both iOS and Android simultaneously. You'll work with both our iOS and Android teams to deliver shared functionality.</p><h3>What you'll do</h3><ul><li>Build cross-platform features in React Native + TypeScript</li><li>Bridge to native modules when platform APIs are needed</li><li>Optimize performance (60fps lists, image loading, cold start)</li><li>Coordinate releases with our native iOS + Android teams</li></ul><h3>What we're looking for</h3><ul><li>3+ years building React Native apps in production</li><li>Comfortable writing Swift/Kotlin for native bridges</li><li>Solid TypeScript + state management experience</li><li>Familiarity with Expo and EAS Build</li></ul>",
    descriptionPlain:
      "We use React Native for cross-platform features that need to ship to both iOS and Android simultaneously. You'll work with both our iOS and Android teams to deliver shared functionality. What you'll do: Build cross-platform features in React Native + TypeScript. Bridge to native modules when platform APIs are needed. Optimize performance (60fps lists, image loading, cold start). Coordinate releases with our native iOS + Android teams. What we're looking for: 3+ years building React Native apps in production. Comfortable writing Swift/Kotlin for native bridges. Solid TypeScript + state management experience. Familiarity with Expo and EAS Build.",
  },
  // ─── Backend ─────────────────────────────────────────────────────
  {
    title: "Senior Backend Engineer (Node.js)",
    department: "Engineering",
    employmentType: "full-time",
    workMode: "remote",
    locationCity: null,
    locationCountry: "USA",
    salaryMin: 145000,
    salaryMax: 190000,
    experienceLevel: "senior",
    educationRequirement: "bachelor",
    requiredSkills: ["Node.js", "TypeScript", "NestJS", "PostgreSQL", "Redis", "REST APIs"],
    description:
      "<p>Own backend services that handle millions of requests per day. You'll work in our NestJS/Postgres stack designing APIs that scale.</p><h3>What you'll do</h3><ul><li>Design and ship REST endpoints in NestJS + TypeScript</li><li>Model data in PostgreSQL with Drizzle ORM</li><li>Tune query performance and add indexes when needed</li><li>Write integration tests against real Postgres + Redis</li></ul><h3>What we're looking for</h3><ul><li>5+ years of Node.js backend experience</li><li>Strong TypeScript and SQL skills</li><li>Production experience with NestJS or similar (Express, Fastify)</li><li>Comfortable with Redis for caching + queues</li></ul>",
    descriptionPlain:
      "Own backend services that handle millions of requests per day. You'll work in our NestJS/Postgres stack designing APIs that scale. What you'll do: Design and ship REST endpoints in NestJS + TypeScript. Model data in PostgreSQL with Drizzle ORM. Tune query performance and add indexes when needed. Write integration tests against real Postgres + Redis. What we're looking for: 5+ years of Node.js backend experience. Strong TypeScript and SQL skills. Production experience with NestJS or similar (Express, Fastify). Comfortable with Redis for caching + queues.",
  },
  {
    title: "Backend Engineer (Python / Django)",
    department: "Engineering",
    employmentType: "full-time",
    workMode: "hybrid",
    locationCity: "Berlin",
    locationCountry: "Germany",
    salaryMin: 75000,
    salaryMax: 100000,
    experienceLevel: "mid",
    educationRequirement: "bachelor",
    requiredSkills: ["Python", "Django", "Django REST Framework", "PostgreSQL", "Celery", "pytest"],
    description:
      "<p>Join our Berlin office working on the analytics backend. We process billions of events per day through a Python data pipeline.</p><h3>What you'll do</h3><ul><li>Build and maintain Django REST APIs</li><li>Write Celery tasks for async event processing</li><li>Optimize complex Postgres queries on time-series data</li><li>Pair with data engineers to define new metrics</li></ul><h3>What we're looking for</h3><ul><li>3+ years of Django + DRF experience</li><li>Comfortable with Celery + Redis-backed task queues</li><li>Strong PostgreSQL skills (window functions, indexing)</li><li>Test-driven mindset (pytest)</li></ul>",
    descriptionPlain:
      "Join our Berlin office working on the analytics backend. We process billions of events per day through a Python data pipeline. What you'll do: Build and maintain Django REST APIs. Write Celery tasks for async event processing. Optimize complex Postgres queries on time-series data. Pair with data engineers to define new metrics. What we're looking for: 3+ years of Django + DRF experience. Comfortable with Celery + Redis-backed task queues. Strong PostgreSQL skills (window functions, indexing). Test-driven mindset (pytest).",
  },
  {
    title: "Go Backend Engineer — Infrastructure",
    department: "Infrastructure",
    employmentType: "full-time",
    workMode: "remote",
    locationCity: null,
    locationCountry: "USA",
    salaryMin: 135000,
    salaryMax: 180000,
    experienceLevel: "senior",
    educationRequirement: "bachelor",
    requiredSkills: ["Go", "gRPC", "Kubernetes", "PostgreSQL", "Distributed systems", "Protocol Buffers"],
    description:
      "<p>Work on the Go services that form the backbone of our observability platform. These services ingest, route, and store telemetry from thousands of customer clusters.</p><h3>What you'll do</h3><ul><li>Design Go microservices that handle 100k+ req/sec sustained</li><li>Define gRPC contracts between internal services</li><li>Tune for latency (p99 budget is 50ms)</li><li>Operate services in production (you're on a small on-call rotation)</li></ul><h3>What we're looking for</h3><ul><li>4+ years of Go production experience</li><li>Distributed systems intuition (consensus, partitioning, failure modes)</li><li>Kubernetes operational experience (not just deploying — debugging)</li><li>Comfortable with gRPC and Protocol Buffers</li></ul>",
    descriptionPlain:
      "Work on the Go services that form the backbone of our observability platform. These services ingest, route, and store telemetry from thousands of customer clusters. What you'll do: Design Go microservices that handle 100k+ req/sec sustained. Define gRPC contracts between internal services. Tune for latency (p99 budget is 50ms). Operate services in production (you're on a small on-call rotation). What we're looking for: 4+ years of Go production experience. Distributed systems intuition (consensus, partitioning, failure modes). Kubernetes operational experience (not just deploying — debugging). Comfortable with gRPC and Protocol Buffers.",
  },
  // ─── Full-stack ─────────────────────────────────────────────────
  {
    title: "Full Stack Engineer",
    department: "Engineering",
    employmentType: "full-time",
    workMode: "remote",
    locationCity: null,
    locationCountry: "USA",
    salaryMin: 125000,
    salaryMax: 165000,
    experienceLevel: "mid",
    educationRequirement: "none",
    requiredSkills: ["TypeScript", "React", "Node.js", "PostgreSQL", "REST APIs", "Git"],
    description:
      "<p>Work across our entire TypeScript stack — React on the frontend, Node.js on the backend. Ideal for engineers who like ownership of features end-to-end.</p><h3>What you'll do</h3><ul><li>Build features that span database → API → UI</li><li>Pair with design + PM to scope work</li><li>Write tests at every layer (unit, integration, e2e)</li><li>Participate in product reviews; bring an engineering perspective</li></ul><h3>What we're looking for</h3><ul><li>3+ years building full-stack products in TypeScript</li><li>React + Node.js comfortable in production</li><li>SQL proficiency (you can write JOINs without consulting docs)</li><li>You enjoy ownership across the stack rather than specializing</li></ul>",
    descriptionPlain:
      "Work across our entire TypeScript stack — React on the frontend, Node.js on the backend. Ideal for engineers who like ownership of features end-to-end. What you'll do: Build features that span database → API → UI. Pair with design + PM to scope work. Write tests at every layer (unit, integration, e2e). Participate in product reviews; bring an engineering perspective. What we're looking for: 3+ years building full-stack products in TypeScript. React + Node.js comfortable in production. SQL proficiency (you can write JOINs without consulting docs). You enjoy ownership across the stack rather than specializing.",
  },
  {
    title: "Junior Full Stack Engineer",
    department: "Engineering",
    employmentType: "full-time",
    workMode: "hybrid",
    locationCity: "San Francisco",
    locationCountry: "USA",
    salaryMin: 95000,
    salaryMax: 120000,
    experienceLevel: "junior",
    educationRequirement: "bachelor",
    requiredSkills: ["TypeScript", "React", "Node.js", "Git", "REST APIs", "SQL basics"],
    description:
      "<p>Start your career on a tight team that mentors deliberately. You'll pair with senior engineers daily and own features within your first 30 days.</p><h3>What you'll do</h3><ul><li>Pair with senior engineers on real features (not just bug fixes)</li><li>Own one or two small features per quarter end-to-end</li><li>Learn our TypeScript + React + Node.js stack</li><li>Participate in code review (give and receive feedback)</li></ul><h3>What we're looking for</h3><ul><li>1-2 years of professional experience OR a strong CS degree + 1 internship</li><li>Comfortable with JavaScript/TypeScript</li><li>Curiosity about the full stack — frontend AND backend</li><li>Comfort asking questions and saying when you don't know something</li></ul>",
    descriptionPlain:
      "Start your career on a tight team that mentors deliberately. You'll pair with senior engineers daily and own features within your first 30 days. What you'll do: Pair with senior engineers on real features (not just bug fixes). Own one or two small features per quarter end-to-end. Learn our TypeScript + React + Node.js stack. Participate in code review (give and receive feedback). What we're looking for: 1-2 years of professional experience OR a strong CS degree + 1 internship. Comfortable with JavaScript/TypeScript. Curiosity about the full stack — frontend AND backend. Comfort asking questions and saying when you don't know something.",
  },
  // ─── DevOps / Cloud / SRE ───────────────────────────────────────
  {
    title: "Senior DevOps Engineer",
    department: "Infrastructure",
    employmentType: "full-time",
    workMode: "remote",
    locationCity: null,
    locationCountry: "USA",
    salaryMin: 150000,
    salaryMax: 195000,
    experienceLevel: "senior",
    educationRequirement: "bachelor",
    requiredSkills: ["Terraform", "AWS", "Kubernetes", "Docker", "CI/CD", "Bash", "Python"],
    description:
      "<p>Own the infrastructure that runs TechCorp's production systems. We're a multi-AZ AWS shop with 50+ Kubernetes clusters across regions.</p><h3>What you'll do</h3><ul><li>Maintain and evolve our Terraform-managed AWS infrastructure</li><li>Operate Kubernetes clusters (EKS) in production</li><li>Build and maintain CI/CD pipelines (GitHub Actions, ArgoCD)</li><li>Be on a small on-call rotation (1 week per ~6 weeks)</li></ul><h3>What we're looking for</h3><ul><li>5+ years of DevOps / SRE / platform engineering</li><li>Deep AWS familiarity (VPC, IAM, EKS, RDS, S3 at minimum)</li><li>Production Terraform + Kubernetes experience</li><li>Scripting comfort in Bash + Python</li></ul>",
    descriptionPlain:
      "Own the infrastructure that runs TechCorp's production systems. We're a multi-AZ AWS shop with 50+ Kubernetes clusters across regions. What you'll do: Maintain and evolve our Terraform-managed AWS infrastructure. Operate Kubernetes clusters (EKS) in production. Build and maintain CI/CD pipelines (GitHub Actions, ArgoCD). Be on a small on-call rotation (1 week per ~6 weeks). What we're looking for: 5+ years of DevOps / SRE / platform engineering. Deep AWS familiarity (VPC, IAM, EKS, RDS, S3 at minimum). Production Terraform + Kubernetes experience. Scripting comfort in Bash + Python.",
  },
  {
    title: "Site Reliability Engineer",
    department: "Infrastructure",
    employmentType: "full-time",
    workMode: "remote",
    locationCity: null,
    locationCountry: "USA",
    salaryMin: 145000,
    salaryMax: 195000,
    experienceLevel: "senior",
    educationRequirement: "bachelor",
    requiredSkills: ["Prometheus", "Grafana", "Kubernetes", "Go", "Linux", "Distributed tracing", "PagerDuty"],
    description:
      "<p>Be the reliability voice for the Go services that power our platform. You'll define SLOs, run game days, and tune for the long tail.</p><h3>What you'll do</h3><ul><li>Define and track SLOs for our top 5 customer-facing services</li><li>Run quarterly game days (chaos engineering exercises)</li><li>Improve observability — metrics, logs, traces — across the platform</li><li>Coach service owners on production-readiness reviews</li></ul><h3>What we're looking for</h3><ul><li>4+ years of SRE / production engineering experience</li><li>Strong Linux + Kubernetes operational skills</li><li>Comfortable with Go (you can read service code, write small tools)</li><li>Prometheus + Grafana fluency</li></ul>",
    descriptionPlain:
      "Be the reliability voice for the Go services that power our platform. You'll define SLOs, run game days, and tune for the long tail. What you'll do: Define and track SLOs for our top 5 customer-facing services. Run quarterly game days (chaos engineering exercises). Improve observability — metrics, logs, traces — across the platform. Coach service owners on production-readiness reviews. What we're looking for: 4+ years of SRE / production engineering experience. Strong Linux + Kubernetes operational skills. Comfortable with Go (you can read service code, write small tools). Prometheus + Grafana fluency.",
  },
  {
    title: "Cloud Engineer (GCP)",
    department: "Infrastructure",
    employmentType: "full-time",
    workMode: "hybrid",
    locationCity: "Singapore",
    locationCountry: "Singapore",
    salaryMin: 100000,
    salaryMax: 140000,
    experienceLevel: "mid",
    educationRequirement: "bachelor",
    requiredSkills: ["GCP", "BigQuery", "Cloud Run", "Pub/Sub", "Terraform", "Python"],
    description:
      "<p>Help us build out our Asia-Pacific GCP footprint. You'll work on data pipelines and serverless services in the Singapore office.</p><h3>What you'll do</h3><ul><li>Stand up new GCP services (Cloud Run, Pub/Sub, BigQuery) for product teams</li><li>Manage Terraform modules for our GCP resources</li><li>Build cost-tracking dashboards for engineering leadership</li><li>Partner with our AWS team on multi-cloud strategy</li></ul><h3>What we're looking for</h3><ul><li>3+ years of cloud infrastructure experience</li><li>GCP-first preferred; AWS-fluent transitioning to GCP also welcome</li><li>Terraform comfortable</li><li>Comfortable in BigQuery (you've written analytical SQL at scale)</li></ul>",
    descriptionPlain:
      "Help us build out our Asia-Pacific GCP footprint. You'll work on data pipelines and serverless services in the Singapore office. What you'll do: Stand up new GCP services (Cloud Run, Pub/Sub, BigQuery) for product teams. Manage Terraform modules for our GCP resources. Build cost-tracking dashboards for engineering leadership. Partner with our AWS team on multi-cloud strategy. What we're looking for: 3+ years of cloud infrastructure experience. GCP-first preferred; AWS-fluent transitioning to GCP also welcome. Terraform comfortable. Comfortable in BigQuery (you've written analytical SQL at scale).",
  },
  {
    title: "Platform Engineer — Developer Experience",
    department: "Infrastructure",
    employmentType: "full-time",
    workMode: "remote",
    locationCity: null,
    locationCountry: "USA",
    salaryMin: 130000,
    salaryMax: 175000,
    experienceLevel: "mid",
    educationRequirement: "none",
    requiredSkills: ["Go", "Kubernetes", "Backstage", "Bazel", "GitHub Actions", "TypeScript"],
    description:
      "<p>Build the internal platform that 200+ TechCorp engineers use to ship code. This is a high-leverage role: every productivity improvement multiplies across the org.</p><h3>What you'll do</h3><ul><li>Maintain our Backstage developer portal</li><li>Design templates for new service scaffolding</li><li>Improve build times in our Bazel monorepo</li><li>Listen to engineers' pain points and prioritize fixes</li></ul><h3>What we're looking for</h3><ul><li>3+ years of platform / DX work</li><li>Comfortable in Go and TypeScript</li><li>You enjoy tooling work and have shipped internal tools before</li><li>Strong communication — you'll write a lot of docs</li></ul>",
    descriptionPlain:
      "Build the internal platform that 200+ TechCorp engineers use to ship code. This is a high-leverage role: every productivity improvement multiplies across the org. What you'll do: Maintain our Backstage developer portal. Design templates for new service scaffolding. Improve build times in our Bazel monorepo. Listen to engineers' pain points and prioritize fixes. What we're looking for: 3+ years of platform / DX work. Comfortable in Go and TypeScript. You enjoy tooling work and have shipped internal tools before. Strong communication — you'll write a lot of docs.",
  },
  // ─── Data ───────────────────────────────────────────────────────
  {
    title: "Data Engineer",
    department: "Data",
    employmentType: "full-time",
    workMode: "remote",
    locationCity: null,
    locationCountry: "USA",
    salaryMin: 130000,
    salaryMax: 175000,
    experienceLevel: "mid",
    educationRequirement: "bachelor",
    requiredSkills: ["Python", "SQL", "Airflow", "dbt", "Snowflake", "Spark"],
    description:
      "<p>Own data pipelines that power our analytics + customer-facing reporting. You'll work in an Airflow + dbt + Snowflake stack.</p><h3>What you'll do</h3><ul><li>Build and maintain Airflow DAGs for batch + near-real-time pipelines</li><li>Model data in dbt with documentation + tests</li><li>Optimize Snowflake queries and warehouse cost</li><li>Partner with analysts to define new datasets</li></ul><h3>What we're looking for</h3><ul><li>3+ years of data engineering experience</li><li>Strong Python and SQL fundamentals</li><li>Production dbt experience</li><li>Familiarity with Spark for batch processing</li></ul>",
    descriptionPlain:
      "Own data pipelines that power our analytics + customer-facing reporting. You'll work in an Airflow + dbt + Snowflake stack. What you'll do: Build and maintain Airflow DAGs for batch + near-real-time pipelines. Model data in dbt with documentation + tests. Optimize Snowflake queries and warehouse cost. Partner with analysts to define new datasets. What we're looking for: 3+ years of data engineering experience. Strong Python and SQL fundamentals. Production dbt experience. Familiarity with Spark for batch processing.",
  },
  {
    title: "Machine Learning Engineer",
    department: "AI",
    employmentType: "full-time",
    workMode: "remote",
    locationCity: null,
    locationCountry: "USA",
    salaryMin: 160000,
    salaryMax: 215000,
    experienceLevel: "senior",
    educationRequirement: "master",
    requiredSkills: ["Python", "PyTorch", "MLflow", "Kubeflow", "AWS SageMaker", "Distributed training"],
    description:
      "<p>Build the ML systems that power anomaly detection in our observability product. You'll work on time-series models that flag issues before customers see them.</p><h3>What you'll do</h3><ul><li>Train + evaluate time-series anomaly detection models</li><li>Productionize models via SageMaker endpoints</li><li>Monitor model drift and retrain pipelines</li><li>Partner with product on model UX (false positive thresholds, etc.)</li></ul><h3>What we're looking for</h3><ul><li>4+ years of ML engineering (research-to-production)</li><li>PyTorch fluency</li><li>Production deployment experience (not just notebooks)</li><li>MS in CS, ML, Statistics, or equivalent practical experience</li></ul>",
    descriptionPlain:
      "Build the ML systems that power anomaly detection in our observability product. You'll work on time-series models that flag issues before customers see them. What you'll do: Train + evaluate time-series anomaly detection models. Productionize models via SageMaker endpoints. Monitor model drift and retrain pipelines. Partner with product on model UX (false positive thresholds, etc.). What we're looking for: 4+ years of ML engineering (research-to-production). PyTorch fluency. Production deployment experience (not just notebooks). MS in CS, ML, Statistics, or equivalent practical experience.",
  },
  // ─── Security ───────────────────────────────────────────────────
  {
    title: "Application Security Engineer",
    department: "Security",
    employmentType: "full-time",
    workMode: "remote",
    locationCity: null,
    locationCountry: "USA",
    salaryMin: 145000,
    salaryMax: 195000,
    experienceLevel: "senior",
    educationRequirement: "bachelor",
    requiredSkills: ["OWASP Top 10", "Threat modeling", "Burp Suite", "Python", "TypeScript", "SAST/DAST"],
    description:
      "<p>Be the security partner for product engineering. You'll review designs, threat-model features, and run security assessments on shipping code.</p><h3>What you'll do</h3><ul><li>Threat-model new features alongside product engineers</li><li>Run penetration tests against our production surfaces</li><li>Maintain our SAST + DAST tooling in CI</li><li>Triage security findings and partner on remediation</li></ul><h3>What we're looking for</h3><ul><li>4+ years of application security experience</li><li>Strong OWASP Top 10 knowledge with practical examples</li><li>Comfortable reading TypeScript and Python codebases</li><li>Experience with Burp Suite and similar tooling</li></ul>",
    descriptionPlain:
      "Be the security partner for product engineering. You'll review designs, threat-model features, and run security assessments on shipping code. What you'll do: Threat-model new features alongside product engineers. Run penetration tests against our production surfaces. Maintain our SAST + DAST tooling in CI. Triage security findings and partner on remediation. What we're looking for: 4+ years of application security experience. Strong OWASP Top 10 knowledge with practical examples. Comfortable reading TypeScript and Python codebases. Experience with Burp Suite and similar tooling.",
  },
  // ─── Lead / Staff ───────────────────────────────────────────────
  {
    title: "Engineering Manager — Frontend Platform",
    department: "Engineering",
    employmentType: "full-time",
    workMode: "remote",
    locationCity: null,
    locationCountry: "USA",
    salaryMin: 180000,
    salaryMax: 230000,
    experienceLevel: "manager",
    educationRequirement: "bachelor",
    requiredSkills: ["People management", "React", "TypeScript", "Frontend architecture", "Roadmap planning", "Hiring"],
    description:
      "<p>Lead a team of 6 frontend engineers building the design system + core shared components. This is a hands-off-keyboard role focused on people, planning, and stakeholder management.</p><h3>What you'll do</h3><ul><li>Manage 6 engineers (career growth, performance, team health)</li><li>Set quarterly goals with the team and partner orgs</li><li>Hire 2 more engineers in the next 6 months</li><li>Stay close enough to the codebase to make architectural calls</li></ul><h3>What we're looking for</h3><ul><li>3+ years of management experience leading frontend teams</li><li>Strong React + TypeScript background (you came up through the IC track)</li><li>Track record of hiring + retaining engineers</li><li>Comfort presenting roadmaps to executive leadership</li></ul>",
    descriptionPlain:
      "Lead a team of 6 frontend engineers building the design system + core shared components. This is a hands-off-keyboard role focused on people, planning, and stakeholder management. What you'll do: Manage 6 engineers (career growth, performance, team health). Set quarterly goals with the team and partner orgs. Hire 2 more engineers in the next 6 months. Stay close enough to the codebase to make architectural calls. What we're looking for: 3+ years of management experience leading frontend teams. Strong React + TypeScript background (you came up through the IC track). Track record of hiring + retaining engineers. Comfort presenting roadmaps to executive leadership.",
  },
  {
    title: "Staff Backend Engineer",
    department: "Engineering",
    employmentType: "full-time",
    workMode: "remote",
    locationCity: null,
    locationCountry: "USA",
    salaryMin: 200000,
    salaryMax: 260000,
    experienceLevel: "lead",
    educationRequirement: "bachelor",
    requiredSkills: ["Distributed systems", "Go", "TypeScript", "PostgreSQL", "System design", "Technical leadership"],
    description:
      "<p>Be the technical leader for our core platform team. You'll set the architectural direction for the services that handle our most critical workloads.</p><h3>What you'll do</h3><ul><li>Drive architectural decisions across the platform team (12 engineers)</li><li>Author RFCs for major changes; review RFCs from others</li><li>Pair with the team on the hardest technical problems</li><li>Mentor senior engineers heading toward staff</li></ul><h3>What we're looking for</h3><ul><li>8+ years of backend engineering experience</li><li>Track record of leading large technical initiatives end-to-end</li><li>Deep distributed systems knowledge</li><li>Strong written communication (RFC-grade writing)</li></ul>",
    descriptionPlain:
      "Be the technical leader for our core platform team. You'll set the architectural direction for the services that handle our most critical workloads. What you'll do: Drive architectural decisions across the platform team (12 engineers). Author RFCs for major changes; review RFCs from others. Pair with the team on the hardest technical problems. Mentor senior engineers heading toward staff. What we're looking for: 8+ years of backend engineering experience. Track record of leading large technical initiatives end-to-end. Deep distributed systems knowledge. Strong written communication (RFC-grade writing).",
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

interface AuthUser {
  id: string;
  email?: string;
}

interface CreatedAuthUser {
  user: { id: string; email: string };
}

async function deleteAllAuthUsers(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<number> {
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  let totalDeleted = 0;
  let totalFailed = 0;

  while (true) {
    const listRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`,
      { headers },
    );
    if (!listRes.ok) {
      const errBody = await listRes.text();
      throw new Error(
        `List users failed: ${listRes.status} ${listRes.statusText} — ${errBody}`,
      );
    }
    const body = (await listRes.json()) as { users: AuthUser[] };
    const users = body.users ?? [];
    if (users.length === 0) break;

    for (const user of users) {
      const delRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${user.id}`,
        { method: "DELETE", headers },
      );
      if (!delRes.ok) {
        process.stderr.write(
          `  ! Failed to delete ${user.email ?? user.id}: ${delRes.status}\n`,
        );
        totalFailed++;
        continue;
      }
      totalDeleted++;
    }

    if (users.length < 1000) break;
  }

  if (totalFailed > 0) {
    process.stderr.write(`  ${totalFailed} user(s) failed to delete\n`);
  }
  return totalDeleted;
}

async function createAuthUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  params: {
    email: string;
    password: string;
    role: "admin" | "candidate" | "recruiter";
    fullName: string;
  },
): Promise<{ id: string; email: string }> {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      email_confirm: true,
      user_metadata: { role: params.role, full_name: params.fullName },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(
      `Create auth user (${params.email}) failed: ${res.status} ${res.statusText} — ${errBody}`,
    );
  }

  const body = (await res.json()) as CreatedAuthUser | { id: string; email: string };
  if ("user" in body) {
    return { id: body.user.id, email: body.user.email };
  }
  return { id: body.id, email: body.email };
}

async function main(): Promise<void> {
  if (!process.argv.includes("--yes")) {
    process.stderr.write(
      [
        "",
        "  Refusing to run without --yes flag.",
        "  This will DELETE ALL DATA from public tables AND all Supabase auth users,",
        "  then seed admin + recruiter accounts + 18 published tech jobs.",
        "  Re-run with --yes to confirm:",
        "",
        "    pnpm --filter @aurahire/api seed-db -- --yes",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!dbUrl) throw new Error("DATABASE_URL is not set");
  if (!supabaseUrl) throw new Error("SUPABASE_URL is not set");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  const redactedDb = dbUrl.replace(/:[^:@/]+@/, ":****@");
  process.stdout.write(`Target DB:       ${redactedDb}\n`);
  process.stdout.write(`Target Supabase: ${supabaseUrl}\n`);
  process.stdout.write("\nStarting seed in 3 seconds — Ctrl+C to abort.\n");
  await new Promise((r) => setTimeout(r, 3000));

  // ─── 1. Truncate ────────────────────────────────────────────
  process.stdout.write("\n→ Truncating public tables\n");
  let sql = postgres(dbUrl, { prepare: false, max: 1 });
  try {
    const tableList = PUBLIC_TABLES.join(", ");
    await sql.unsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
    process.stdout.write(`  ✓ Truncated ${PUBLIC_TABLES.length} tables\n`);
  } finally {
    await sql.end({ timeout: 5 });
  }

  // ─── 2. Delete auth users ───────────────────────────────────
  process.stdout.write("\n→ Deleting Supabase auth users\n");
  const deleted = await deleteAllAuthUsers(supabaseUrl, serviceRoleKey);
  process.stdout.write(`  ✓ Deleted ${deleted} auth user(s)\n`);

  // ─── 3. Create auth accounts ────────────────────────────────
  process.stdout.write("\n→ Creating admin auth user\n");
  const adminUser = await createAuthUser(supabaseUrl, serviceRoleKey, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: "admin",
    fullName: ADMIN_FULL_NAME,
  });
  process.stdout.write(`  ✓ Created auth.users ${adminUser.id} (${adminUser.email})\n`);

  process.stdout.write("\n→ Creating recruiter auth user\n");
  const recruiterUser = await createAuthUser(supabaseUrl, serviceRoleKey, {
    email: RECRUITER_EMAIL,
    password: RECRUITER_PASSWORD,
    role: "recruiter",
    fullName: RECRUITER_FULL_NAME,
  });
  process.stdout.write(`  ✓ Created auth.users ${recruiterUser.id} (${recruiterUser.email})\n`);

  // ─── 4. Insert profiles + company + recruiter_profile + scoring_config + jobs ────
  process.stdout.write("\n→ Inserting application-layer rows\n");
  sql = postgres(dbUrl, { prepare: false, max: 1 });
  try {
    // Admin profile
    await sql`
      INSERT INTO profiles (id, role, full_name, email, status)
      VALUES (${adminUser.id}, ${"admin"}, ${ADMIN_FULL_NAME}, ${adminUser.email}, ${"active"})
    `;
    process.stdout.write(`  ✓ profiles row for admin\n`);

    // Recruiter profile
    await sql`
      INSERT INTO profiles (id, role, full_name, email, status)
      VALUES (${recruiterUser.id}, ${"recruiter"}, ${RECRUITER_FULL_NAME}, ${recruiterUser.email}, ${"active"})
    `;
    process.stdout.write(`  ✓ profiles row for recruiter\n`);

    // Company (createdBy = recruiter)
    const [companyRow] = await sql<{ id: string }[]>`
      INSERT INTO companies (name, industry, size, website, headquarters_location, description, created_by)
      VALUES (
        ${COMPANY.name},
        ${COMPANY.industry},
        ${COMPANY.size},
        ${COMPANY.website},
        ${COMPANY.headquartersLocation},
        ${COMPANY.description},
        ${recruiterUser.id}
      )
      RETURNING id
    `;
    if (!companyRow) throw new Error("Company insert returned no row");
    process.stdout.write(`  ✓ company row ${companyRow.id} (${COMPANY.name})\n`);

    // Recruiter profile (FK to profiles). Company link now lives in company_members.
    await sql`
      INSERT INTO recruiter_profiles (
        id, job_title, department, roles_hiring_for,
        hiring_volume_per_quarter, profile_completed
      )
      VALUES (
        ${recruiterUser.id},
        ${RECRUITER_JOB_TITLE},
        ${RECRUITER_DEPARTMENT},
        ${sql.array([
          "Frontend Engineer",
          "Backend Engineer",
          "Full Stack Engineer",
          "DevOps Engineer",
          "Mobile Engineer",
          "Data Engineer",
          "ML Engineer",
        ])},
        ${"15-30"},
        ${true}
      )
    `;
    process.stdout.write(`  ✓ recruiter_profiles row\n`);

    // Company membership (recruiter is the owner of TechCorp)
    await sql`
      INSERT INTO company_members (
        company_id, user_id, email, role, status, invited_by, joined_at
      )
      VALUES (
        ${companyRow.id},
        ${recruiterUser.id},
        ${RECRUITER_EMAIL},
        ${"owner"},
        ${"active"},
        ${recruiterUser.id},
        ${new Date()}
      )
    `;
    process.stdout.write(`  ✓ company_members row (recruiter = owner)\n`);

    // Active scoring_config
    await sql`
      INSERT INTO scoring_config (
        is_active, match_weights, profile_weights, band_thresholds,
        bias_categories_enabled, custom_flagged_terms,
        pii_redaction_enabled, pii_fields_redacted, updated_by
      )
      VALUES (
        ${true},
        ${sql.json(SCORING_CONFIG.matchWeights)},
        ${sql.json(SCORING_CONFIG.profileWeights)},
        ${sql.json(SCORING_CONFIG.bandThresholds)},
        ${sql.array(SCORING_CONFIG.biasCategoriesEnabled)},
        ${sql.array(SCORING_CONFIG.customFlaggedTerms)},
        ${SCORING_CONFIG.piiRedactionEnabled},
        ${sql.array(SCORING_CONFIG.piiFieldsRedacted)},
        ${adminUser.id}
      )
    `;
    process.stdout.write(`  ✓ scoring_config (active)\n`);

    // 18 jobs
    process.stdout.write(`\n→ Inserting ${JOBS.length} jobs\n`);
    let inserted = 0;
    for (const job of JOBS) {
      await sql`
        INSERT INTO jobs (
          recruiter_id, company_id, title, department, employment_type, work_mode,
          location_city, location_country, salary_min, salary_max, salary_currency,
          description, description_plain, required_skills, experience_level,
          education_requirement, status, published_at
        )
        VALUES (
          ${recruiterUser.id},
          ${companyRow.id},
          ${job.title},
          ${job.department},
          ${job.employmentType},
          ${job.workMode},
          ${job.locationCity},
          ${job.locationCountry},
          ${String(job.salaryMin)},
          ${String(job.salaryMax)},
          ${"USD"},
          ${job.description},
          ${job.descriptionPlain},
          ${sql.array(job.requiredSkills)},
          ${job.experienceLevel},
          ${job.educationRequirement},
          ${"published"},
          ${new Date()}
        )
      `;
      inserted++;
      process.stdout.write(`  ✓ ${inserted}/${JOBS.length}: ${job.title}\n`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  // ─── Done ────────────────────────────────────────────────────
  process.stdout.write("\n✓ Seed complete.\n\n");
  process.stdout.write("Accounts:\n");
  process.stdout.write(`  admin:     ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}\n`);
  process.stdout.write(`  recruiter: ${RECRUITER_EMAIL} / ${RECRUITER_PASSWORD}\n`);
  process.stdout.write("\n");
  process.stdout.write(`Company:   ${COMPANY.name} (${JOBS.length} published jobs)\n`);
  process.stdout.write(`Scoring config: active (skills 40 / experience 35 / education 15 / cultural_fit 10)\n`);
  process.stdout.write("\nNow register a candidate via the UI to test the full demo path.\n");
  process.exit(0);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `seed-db failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
