# AuraHire AI Design

**Version:** 1.0.0
**Last Updated:** May 1, 2026
**Status:** Locked for Sprint
**Audience:** developers + thesis examiner
**Depends on:** `prd.md`, `database-schema.md`, `architecture.md`

This document specifies every AI surface in AuraHire: resume parsing, profile scoring, match scoring, bias detection, and aggregate fairness monitoring. It is the **thesis-defensible artifact** of the system — the place where "Explainable and Fair AI-Powered Recruitment" stops being a slogan and starts being prompts, schemas, and evaluation rules.

---

## Design Principles

### 1. Structured outputs always

Every AI call uses OpenAI's structured-output JSON Schema mode. Free-text parsing is forbidden. The model produces JSON that conforms to a Zod-derived schema; we never write a regex against AI output.

**Why:** Reliability + auditability. A score must always have a parseable breakdown.

### 2. PII redaction before scoring

Resumes are passed through a redaction step that strips name, photo URL, age, gender markers, and address before any scoring AI sees them. Skills, experience, education, and city/country remain.

**Why:** Removes the most direct vectors for biased scoring. The fairness story starts here.

### 3. Evidence over assertion

Every component score includes excerpt-level evidence — the literal text from the resume that drove the score up or down. The candidate, recruiter, and admin can all click a score and see what made it.

**Why:** No black-box scores. This is the single most important explainability lever.

### 4. Transparent weights, configurable by admin

Scoring weights live in the `scoring_config` table. Admin can tune them; every change is audited; every score records the weights used at compute time.

**Why:** Demonstrates the system's openness — examiners can see exactly what the algorithm values.

### 5. Bias detection is upstream, not just downstream

We detect biased language in job descriptions before they're published, not just monitor scores after the fact. Detection at posting time prevents biased inputs to the rest of the system.

**Why:** Mitigation > monitoring. Active intervention is the academically interesting part.

### 6. Audit every AI event

Every parse, score, override, and config change writes to `audit_logs`. The log is queryable by admin and exportable for thesis appendix.

---

## AI Surface Inventory

| Surface                    | When                                             | Input                         | Output                                              | Model                       |
| -------------------------- | ------------------------------------------------ | ----------------------------- | --------------------------------------------------- | --------------------------- |
| Resume Parsing             | Onboarding step 1 + every new resume upload      | PDF/DOCX → plain text         | Structured resume JSON                              | gpt-4o-mini                 |
| PII Redaction              | Before any scoring call                          | Parsed resume JSON            | Redacted JSON + redacted_fields list                | (rule-based + LLM-assisted) |
| Profile Score              | End of onboarding + on resume/preferences change | Redacted resume + preferences | Profile Score JSON with breakdown + suggestions     | gpt-4o-mini                 |
| Match Score                | At application time + on demand                  | Redacted resume + job posting | Match Score JSON with breakdown + evidence          | gpt-4o-mini                 |
| Bias Detection             | On job description blur + on publish             | Job description plain text    | List of flagged terms with categories + suggestions | gpt-4o-mini                 |
| Aggregate Fairness Metrics | Computed on demand for admin                     | Database aggregations         | Pre-computed stats (no AI call)                     | (SQL only)                  |

---

## 1. Resume Parsing

### Goal

Extract a structured representation of a candidate's resume so subsequent steps don't re-read the file.

### Pipeline

```
Upload PDF/DOCX → Storage
    ↓
Server Action: parseResume(storagePath)
    ↓
Download file from Storage
    ↓
Extract plain text:
    - PDF → pdf-parse
    - DOCX → mammoth
    ↓
Send plain text to OpenAI with structured-output schema
    ↓
Validate output via Zod
    ↓
INSERT into resumes (raw_text, parsed_data, parse_status='parsed')
```

### Output Schema (Zod / JSON Schema)

```ts
// lib/ai/schemas/parsed-resume.ts
import { z } from "zod";

export const educationEntrySchema = z.object({
  institution: z.string(),
  degree: z.string().nullable(),
  field_of_study: z.string().nullable(),
  start_year: z.number().int().nullable(),
  end_year: z.number().int().nullable(),
  gpa: z.string().nullable(),
});

export const experienceEntrySchema = z.object({
  company: z.string(),
  title: z.string(),
  start_date: z.string().nullable(), // ISO YYYY-MM
  end_date: z.string().nullable(), // ISO YYYY-MM, or null for "Present"
  is_current: z.boolean().default(false),
  responsibilities: z.array(z.string()),
  technologies_used: z.array(z.string()),
});

export const certificationSchema = z.object({
  name: z.string(),
  issuing_organization: z.string().nullable(),
  issue_date: z.string().nullable(),
  expires: z.string().nullable(),
});

export const parsedResumeSchema = z.object({
  contact: z.object({
    full_name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    location_city: z.string().nullable(),
    location_country: z.string().nullable(),
    linkedin_url: z.string().nullable(),
    portfolio_url: z.string().nullable(),
  }),
  summary: z.string().nullable(),
  education: z.array(educationEntrySchema),
  experience: z.array(experienceEntrySchema),
  skills: z.array(z.string()),
  certifications: z.array(certificationSchema),
  languages: z.array(z.string()),
  parse_confidence: z.enum(["high", "medium", "low"]),
});

export type ParsedResume = z.infer<typeof parsedResumeSchema>;
```

### Prompt

```
You are a resume-parsing assistant. Extract the candidate's information from
the resume text below and return it as structured JSON conforming to the
provided schema.

Rules:
- Extract literal information; do not invent details not present in the text
- For dates, use ISO format (YYYY-MM-DD or YYYY-MM); use null if unknown
- For "Present" or "Current" end dates, set is_current=true and end_date=null
- Skills: extract programming languages, frameworks, tools, methodologies as a flat array
- Skills should be canonical names (e.g., "JavaScript" not "Javascripts" or "JS")
- Set parse_confidence based on how clearly structured the resume is:
  - "high": clear sections, dates, well-formatted
  - "medium": readable but ambiguous in places
  - "low": OCR garble, missing sections, or unclear formatting

Resume text:
"""
{resume_text}
"""
```

### Failure modes & fallback

| Mode                | Handling                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Empty / corrupt PDF | Return `parse_status='failed'`, show "We couldn't parse your resume. Please fill out manually." Allow user to proceed with empty fields. |
| OCR garble          | Model returns parse_confidence='low'; UI shows soft warning ("We extracted limited information; please review carefully")                |
| OpenAI 5xx          | Retry once with same input; if still fails, save with `parse_status='failed'`                                                            |
| Invalid JSON output | Should never happen with structured outputs; if it does, log raw response, mark `parse_status='failed'`                                  |
| Timeout (>30s)      | Abort with `parse_status='failed'` + "Parsing timed out. Try a simpler PDF."                                                             |

### Caching

Parsed data is stored in `resumes.parsed_data`. Re-parsing only happens when the file changes. Scoring engines reuse cached parsed_data — never re-parse for scoring.

---

## 2. PII Redaction

### Goal

Strip identity-revealing fields from parsed resume JSON before any scoring AI receives it.

### Strategy

**Hybrid: rule-based primary + LLM-assisted secondary.**

The rule-based pass handles known fields directly. The LLM-assisted pass scans free-text fields (summary, responsibilities) for residual identity markers.

### Fields removed (rule-based)

```ts
// lib/ai/redact-pii.ts
const ALWAYS_REDACTED_PATHS = [
  "contact.full_name",
  "contact.email",
  "contact.phone",
  "contact.linkedin_url",
  "contact.portfolio_url",
  // location_country kept for relocation match
];
```

These are simply set to `null` in the redacted copy.

### Free-text scrubbing (LLM-assisted)

A second prompt scans `summary` and `experience[].responsibilities[]` for identity references:

```
Review the following text and redact any personal identifiers:
- Person names (full names or first names referring to the candidate)
- Pronouns (he/she/they when used as identity markers)
- Age references ("28-year-old", "fresh graduate of 2024")
- Gender markers ("a man with experience in...", "as a woman in tech...")

Return the cleaned text. Do NOT remove:
- Technical content
- Company names
- Institution names
- Job titles
- Skills

Text:
"""
{text}
"""
```

Output is the cleaned text. Implementation calls this for each free-text field that's non-trivially long (>50 chars).

### What's kept

- Skills (technical + soft)
- Experience (titles, companies, durations, responsibilities sans identifiers)
- Education (institutions, degrees, fields, dates)
- Certifications
- Languages
- Location country (kept for "are you in the same country as the job?" match — never used for ethnicity inference)

### Audit

Every score row records `redacted_fields` (the list of keys that were stripped). Admin can see this in the score audit drilldown — proves to thesis examiner that redaction happened.

```sql
-- Example admin query: show all profile scores with what was redacted
SELECT id, candidate_id, overall_score, redacted_fields, created_at
FROM profile_scores
ORDER BY created_at DESC LIMIT 50;
```

---

## 3. Profile Scoring Engine

### Goal

Compute a candidate's overall resume strength score (0–100), independent of any specific job. Used as the candidate's "self-evaluation" surface.

### Inputs

- Redacted parsed resume
- Candidate preferences (desired role, seniority, salary, work modes)

### Components & default weights

| Component          | Default Weight | What it measures                                                              |
| ------------------ | -------------- | ----------------------------------------------------------------------------- |
| Completeness       | 25             | Percentage of resume sections filled (contact, education, experience, skills) |
| Skill Depth        | 30             | Number of relevant skills, modernity, alignment with desired role             |
| Experience Clarity | 30             | Quality of experience descriptions: outcomes, technologies, durations clear   |
| Education Quality  | 15             | Degree match for desired role + relevant certifications                       |

Total = 100. Weights configurable in `scoring_config.profile_weights`.

### Output Schema

```ts
// lib/ai/schemas/profile-score.ts
import { z } from "zod";

export const componentSchema = z.object({
  name: z.enum([
    "completeness",
    "skill_depth",
    "experience_clarity",
    "education_quality",
  ]),
  score: z.number().int().min(0), // 0-max
  max: z.number().int(), // weight value (e.g. 25)
  weight: z.number().int(), // weight (same as max for now)
  explanation: z.string(), // plain-language WHY
  evidence: z.array(
    z.object({
      excerpt: z.string(),
      source: z.string(), // section ref
      relevance: z.enum(["positive", "negative", "neutral"]),
    }),
  ),
});

export const profileScoreSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  band: z.enum(["strong", "partial", "limited"]),
  components: z.array(componentSchema),
  improvement_suggestions: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        estimated_impact: z.number().int(), // points the candidate could gain
      }),
    )
    .max(3),
});
```

### Prompt

```
You are an expert career coach evaluating a candidate's resume strength.
Assess the resume against four components and produce a structured score.

REDACTED RESUME (PII removed):
"""
{redacted_resume_json}
"""

CANDIDATE'S DESIRED ROLE:
{desired_role}, {desired_seniority}

WEIGHTS:
- Completeness: max {completeness_weight}
- Skill Depth: max {skill_depth_weight}
- Experience Clarity: max {experience_clarity_weight}
- Education Quality: max {education_quality_weight}

For each component:
1. Score it from 0 to its max weight
2. Write a 1-2 sentence explanation in plain language
3. Provide 1-3 evidence excerpts from the resume that drove the score
   - Each excerpt should be a short quote
   - Mark each as "positive" (helped score), "negative" (hurt score), or "neutral"
   - Include the section reference (e.g., "Experience › Senior Engineer at Acme")

Then sum component scores for `overall_score`.

Then determine `band`:
- 70-100: "strong"
- 40-69: "partial"
- 0-39: "limited"

Finally, suggest up to 3 specific improvements the candidate could make.
For each, estimate the points they could gain (be conservative; max 10 per suggestion).

IMPORTANT:
- Do not infer demographics or background; score only on the redacted content
- Be specific in evidence quotes; use the candidate's actual words
- Improvement suggestions should be actionable, not vague ("Add a portfolio URL", not "Improve professional presence")
```

### Recompute triggers

- New default resume uploaded → recompute
- Preferences updated → recompute (debounced 5s)
- Admin saves new `scoring_config` → admin can trigger batch recompute (not user-driven)
- User-triggered recompute on Profile page → rate-limited 1/60s

### Caching

`profile_scores` rows accumulate (we don't UPDATE; we INSERT a new row each compute). Most-recent row is the "current" score. Historical rows are kept for trends (Phase 2 admin chart).

---

## 4. Match Scoring Engine

### Goal

Compute how well a candidate fits a specific job. Computed at application time and on demand from candidate's job-detail view.

### Inputs

- Redacted parsed resume of the applying candidate
- Full job posting (title, description, required_skills, experience_level, education_requirement, location)

### Components & default weights

| Component               | Default Weight | What it measures                                                         |
| ----------------------- | -------------- | ------------------------------------------------------------------------ |
| Skills Match            | 40             | Coverage of required_skills + relevant adjacent skills                   |
| Experience Match        | 35             | Years of experience vs. required level + role/title alignment            |
| Education Match         | 15             | Degree level vs. requirement + field alignment                           |
| Cultural / Language Fit | 10             | Tone, terminology, soft-skill alignment between resume + job description |

Total = 100. Weights configurable in `scoring_config.match_weights`.

### Output Schema

```ts
// lib/ai/schemas/match-score.ts
export const matchComponentSchema = z.object({
  name: z.enum(["skills", "experience", "education", "cultural_fit"]),
  score: z.number().int().min(0),
  max: z.number().int(),
  weight: z.number().int(),
  explanation: z.string(),
  evidence: z
    .array(
      z.object({
        excerpt: z.string(),
        source: z.string(),
        relevance: z.enum(["positive", "negative", "neutral"]),
        contribution_points: z.number().int(),
      }),
    )
    .max(5),
});

export const matchScoreSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  band: z.enum(["strong", "partial", "limited"]),
  components: z.array(matchComponentSchema),
  summary: z.string(), // one-paragraph plain-language synthesis
  red_flags: z.array(z.string()).optional(), // significant gaps
  green_flags: z.array(z.string()).optional(), // standout strengths
});
```

### Prompt

```
You are an expert recruiter scoring a candidate's match against a specific job.
Use the four components below and produce a structured match score.

JOB POSTING:
Title: {job_title}
Department: {department}
Experience Level: {experience_level}
Education Requirement: {education_requirement}
Required Skills: {required_skills_list}
Description:
"""
{job_description_plain}
"""

CANDIDATE (PII-redacted):
"""
{redacted_resume_json}
"""

WEIGHTS:
- Skills Match: max {skills_weight}
- Experience Match: max {experience_weight}
- Education Match: max {education_weight}
- Cultural Fit: max {cultural_fit_weight}

For each component:
1. Score 0 to max weight
2. Plain-language explanation
3. 1-5 evidence excerpts from the candidate's resume
   - Each: short quote + section reference + relevance + estimated points contributed

For `skills`:
- Count required skills present in resume (treat React == ReactJS, AWS == Amazon Web Services, etc.)
- Bonus for adjacent/complementary skills

For `experience`:
- Compare years of experience and seniority of past titles to the job's level
- Match in industry/domain is a positive

For `education`:
- Compare highest degree to requirement
- Bonus for relevant certifications

For `cultural_fit`:
- Compare tone and language between resume's responsibilities/summary and job description
- Look for soft-skill alignment (collaborative, fast-paced, structured, etc.)

Finally:
- Sum component scores for overall_score (0-100)
- Determine band: strong (70+), partial (40-69), limited (0-39)
- Write one-paragraph synthesis (`summary`)
- List up to 3 `red_flags` (significant misalignments) — optional
- List up to 3 `green_flags` (standout strengths) — optional

IMPORTANT:
- Do not infer demographics; score only on the redacted content
- Be honest: a candidate who doesn't fit should score low
- Use the candidate's actual words in evidence quotes
```

### Per-application uniqueness

Each application has exactly one match_score row (UNIQUE on `application_id`). Re-scoring an application replaces the row only when explicitly triggered (e.g., admin reapplies new weights via batch recompute).

### Weights snapshot

Every match_score record stores `weights_used` — a snapshot of `scoring_config.match_weights` at compute time. This way, even if admin changes weights later, historical scores remain interpretable.

---

## 5. Bias Detection (Job Descriptions)

### Goal

Flag biased language in job descriptions before publishing. Empower the recruiter to fix or override with reason.

### Categories

| Category         | Examples                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------- |
| **Gendered**     | "rockstar", "ninja", "guys", "manpower", "salesman", "girl Friday"                        |
| **Age-coded**    | "young", "energetic", "digital native", "fresh", "recent graduate", "mature"              |
| **Ableist**      | "able-bodied", "stand for long periods" (without context), "lift heavy" (without context) |
| **Exclusionary** | "must be willing to work long hours", "no remote", culture-fit language without specifics |

### Output Schema

```ts
// lib/ai/schemas/bias-flags.ts
export const biasFlagSchema = z.object({
  term: z.string(), // exact text flagged
  category: z.enum([
    "gendered",
    "age-coded",
    "ableist",
    "exclusionary",
    "other",
  ]),
  severity: z.enum(["high", "medium", "low"]),
  explanation: z.string(), // why it's flagged
  suggestion: z.string(), // recommended replacement
  position_start: z.number().int().optional(),
  position_end: z.number().int().optional(),
});

export const biasFlagListSchema = z.object({
  flags: z.array(biasFlagSchema),
});
```

### Prompt

```
You are a hiring fairness assistant. Scan the following job description for
language that could deter or exclude qualified candidates from underrepresented
groups. Identify only language that is reasonably likely to cause bias.

Categories to flag:
- gendered: terms historically associated with one gender (rockstar, ninja, guys, salesman, etc.)
- age-coded: language signaling age preference (young, energetic, digital native, fresh, mature)
- ableist: requirements that assume physical/cognitive ability without role justification
- exclusionary: requirements that gate access without business justification (long hours, no remote, vague "culture fit")

For each flagged term:
- Exact text from the description
- Category
- Severity (high/medium/low) — how exclusionary
- 1-sentence explanation
- Concrete suggestion for replacement language

If no concerning language exists, return `{ "flags": [] }`.

Do not flag:
- Technical skill requirements
- Years of experience requirements
- Location requirements
- Industry-specific jargon

JOB DESCRIPTION:
"""
{description_plain}
"""

CUSTOM TERMS TO ALSO FLAG (admin-added):
{custom_flagged_terms}
```

### Trigger points

1. **On description blur** in the recruiter's job editor (debounced 1s)
2. **On Save Draft** (background, results shown when ready)
3. **On Publish click** — blocks publish if any flags unresolved (override required)

### Recruiter override flow

When publishing with unresolved flags:

1. Modal shows the flagged terms + suggestions
2. Recruiter must either:
   - **Edit** the description to resolve flags (preferred)
   - **Override** with a reason (free-text required, e.g., "Internal team uses 'rockstar' as a band name reference")
3. Override creates `bias_flags` row with `status='overridden'` + `override_reason` + `overridden_by` + `overridden_at`
4. Audit log entry written

### Storage

- Flagged terms stored as `bias_flags` rows linked to the job
- A flag's `status` evolves: `flagged` → `resolved` (recruiter edited) or `flagged` → `overridden` (recruiter justified)
- Admin sees aggregate via `/admin/bias-monitor`

---

## 6. Aggregate Fairness Monitoring

### Goal

Surface system-level fairness metrics to admin. Spot trends. Demonstrate ongoing oversight to thesis examiner.

### Metrics surfaced

| Metric                     | SQL Source                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| Total flags this period    | `COUNT(*) FROM bias_flags WHERE created_at >= ?`                                           |
| Flags per job              | `COUNT(*) / COUNT(DISTINCT job_id)`                                                        |
| Flags resolved %           | `COUNT(*) WHERE status='resolved' / COUNT(*)`                                              |
| Override rate              | `COUNT(*) WHERE status='overridden' / COUNT(*) WHERE status IN ('overridden', 'resolved')` |
| Top flagged terms          | `SELECT term, COUNT(*) FROM bias_flags GROUP BY term ORDER BY count DESC LIMIT 10`         |
| Flag breakdown by category | `SELECT category, COUNT(*) FROM bias_flags GROUP BY category`                              |
| Score distribution         | Histogram of `match_scores.overall_score`                                                  |
| Score distribution by job  | Per-job aggregation                                                                        |
| Recent override decisions  | List of `bias_flags WHERE status='overridden'` with reason and recruiter                   |

### What we don't claim (yet)

- **Disparate impact statistical tests** (e.g., 4/5 rule against demographic groups) require demographic data we deliberately don't collect (PII redaction). For thesis purposes:
  - We document this as a tradeoff in the thesis: "We chose redaction over collection. Disparate impact requires collected demographic labels, which contradicts our redaction philosophy. Future work could collect _self-reported_ optional demographics for fairness audits."
- **Causal fairness analysis** is out of scope; we surface aggregate distributions and flag rates.

### Computation

All metrics are SQL aggregations — no AI calls. Computed on demand when admin opens `/admin/bias-monitor`. Cached for 5 minutes via Next.js Data Cache.

---

## 7. Model Selection

### Default: gpt-4o-mini

| Aspect             | gpt-4o-mini                                     |
| ------------------ | ----------------------------------------------- |
| Input cost         | $0.15 / 1M tokens                               |
| Output cost        | $0.60 / 1M tokens                               |
| Latency            | typically 3-8s for our prompt sizes             |
| Structured outputs | Supported                                       |
| Quality            | Sufficient for parsing, scoring, bias detection |

### Per-call cost estimate

| Operation     | Input tokens (typical) | Output tokens | Cost per call |
| ------------- | ---------------------- | ------------- | ------------- |
| Resume parse  | ~3000                  | ~1500         | ~$0.0015      |
| Profile score | ~2000                  | ~1000         | ~$0.0009      |
| Match score   | ~3000                  | ~1500         | ~$0.0015      |
| Bias check    | ~1000                  | ~500          | ~$0.0005      |

Sprint demo (~50 candidates × 10 jobs × scoring): ~$5 total.
Thesis defense buffer: $20 OpenAI credit covers everything plus retries.

### When to upgrade to gpt-4o

Consider for:

- Edge-case resumes that gpt-4o-mini misparses
- Bias detection in subtle/contextual language
- Cultural fit scoring on long, narrative job descriptions

For sprint: gpt-4o-mini default. Document upgrade path in thesis appendix.

### Timeout & retry

```ts
const AI_TIMEOUT_MS = 30_000; // 30s for parsing, scoring
const AI_RETRY_COUNT = 1; // one retry on transient errors
```

If primary call times out:

1. Retry once with same input
2. If retry fails: mark score row `status='failed'`, surface friendly message ("Score temporarily unavailable; retry?")

---

## 8. Prompt Versioning

Every AI call records the `prompt_version` used. Prompts live in `lib/ai/prompts/*.ts` as exported strings with version in their export name:

```ts
export const PARSE_RESUME_PROMPT_V1 = `You are a resume-parsing assistant. ...`;
export const PARSE_RESUME_VERSION = "1.0.0";
```

When a prompt changes:

1. Bump version (`1.0.0` → `1.1.0` for prompt edits, `2.0.0` for breaking schema changes)
2. Old prompt remains in code as commented or archived
3. Audit log + score rows record version used at compute time
4. For thesis appendix: "We iterated through prompt versions 1.0.0 → 1.2.0 to refine the experience scoring component..."

---

## 9. Evaluation & Validation

### Sprint validation

Before sprint ends, run a **smoke test**:

1. **10 known-good resumes** (curated by you):
   - Software engineer with 5 years
   - Software engineer with 0 experience (recent grad)
   - Career-changer (PM → engineer)
   - Designer with no engineering skills
   - Data scientist with PhD
   - Sales manager
   - 3 deliberately weak/sparse resumes
   - 1 resume with mostly OCR-garbled text
   - 1 resume with intentional bias-trigger words in summary

2. **5 known-good jobs**:
   - Senior engineer (clear, well-written)
   - Entry-level engineer
   - Data scientist
   - Sales manager
   - 1 job with deliberate biased language ("rockstar", "young energetic")

3. Score each resume against each job. Verify:
   - Strong matches receive 70+
   - Mismatches receive < 50
   - Bias job description gets ALL deliberate flags caught
   - Evidence excerpts make sense
   - Improvement suggestions are coherent

Document results in thesis appendix. **Curate; don't claim "tested at scale."**

### Phase 2 evaluation

- Larger curated dataset
- Inter-rater reliability between AI and human recruiter scores
- Adversarial bias tests (resumes with demographic markers swapped)
- Latency / cost benchmarking

---

## 10. Thesis Alignment

How each AI design choice maps to the thesis claim **"Explainable and Fair AI-Powered Recruitment with Bias Mitigation"**:

| Thesis claim             | Implementation                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| **Explainable**          | Structured outputs + evidence excerpts + plain-language explanations + admin score audit view  |
| **Fair**                 | PII redaction before scoring + bias detection on job descriptions + aggregate fairness monitor |
| **AI-powered**           | gpt-4o-mini at parsing, scoring, and bias detection points                                     |
| **Recruitment**          | End-to-end: register → apply → screen → interview → offer                                      |
| **with Bias Mitigation** | Active intervention at job posting time + monitoring at admin level                            |

### Thesis appendix items to extract from this system

1. Full prompt templates (versioned)
2. Sample structured outputs (JSON dumps from real scores)
3. Audit log export filtered to AI events
4. Bias monitor screenshot with real flagged terms
5. Score breakdown screenshots showing evidence excerpts
6. Configuration delta showing weights tuning
7. Cost analysis (OpenAI usage logs)
8. PII redaction example (before/after of a sample resume)

---

## 11. Implementation Pointers

All AI code lives in the backend (`apps/api`). The frontend never directly calls OpenAI.

Code locations (per `project-structure.md`):

```
apps/api/src/ai/
├── ai.module.ts              # NestJS module
├── openai.service.ts         # OpenAI client singleton with timeouts
├── parse-resume.service.ts   # Resume parsing pipeline
├── redact-pii.service.ts     # PII redaction
├── score-profile.service.ts  # Profile Score engine
├── score-match.service.ts    # Match Score engine
├── detect-bias.service.ts    # Job description bias check
├── prompts/
│   ├── parse-resume.ts       # Versioned prompt strings
│   ├── score-profile.ts
│   ├── score-match.ts
│   ├── detect-bias.ts
│   └── redact-text.ts        # for free-text PII scrub
└── schemas/
    └── (mirrored from packages/shared/src/schemas/)

packages/shared/src/schemas/
├── score.ts                  # Zod: profileScoreSchema, matchScoreSchema
└── bias.ts                   # Zod: biasFlagSchema, biasFlagListSchema
```

### REST endpoints calling AI services

| Endpoint                               | Service                                    | Module               |
| -------------------------------------- | ------------------------------------------ | -------------------- |
| `POST /api/v1/resumes/upload`          | `ParseResumeService.parse()`               | `ResumesModule`      |
| `POST /api/v1/scoring/profile/compute` | `RedactPiiService` → `ScoreProfileService` | `ScoringModule`      |
| `POST /api/v1/applications`            | `RedactPiiService` → `ScoreMatchService`   | `ApplicationsModule` |
| `POST /api/v1/bias/check`              | `DetectBiasService`                        | `BiasModule`         |
| `POST /api/v1/jobs/:id/publish`        | `DetectBiasService` (defensive re-run)     | `JobsModule`         |

Each NestJS controller method:

1. Validates request via Zod DTO (nestjs-zod)
2. Auth check via `SupabaseAuthGuard` + `RolesGuard`
3. Calls AI service
4. AI service validates structured output against Zod schema
5. Persists to DB via repository (score row + evidence rows)
6. Writes audit log via `AuditService`
7. Returns typed DTO to client

### Background batch jobs

`POST /api/v1/admin/scoring/rescore-batch` enqueues a BullMQ job (`RescoreBatchProcessor`) that re-scores last N applications with current weights. Worker runs in-process inside `apps/api` for sprint scale.

---

## 12. Known Limitations (Honest)

1. **gpt-4o-mini is not state-of-the-art.** A larger model would catch subtler biases and produce better evidence quotes. Sprint trade-off for cost + speed.
2. **Bias detection is template-driven.** It reflects what's known to be biased; novel patterns may slip through.
3. **PII redaction is rule-based + LLM-assisted.** Not deterministic; an adversarial input could leak PII. Acceptable for demo; stronger for production.
4. **No demographic data collected.** This is principled (privacy-first) but means we can't run statistical disparate-impact tests. Documented tradeoff.
5. **No active learning loop.** The model doesn't improve based on recruiter feedback. Phase 2 deliverable.
6. **Score reliability depends on resume quality.** A sparse resume scores low everywhere — but that may reflect underlying signal, not algorithmic bias.

---

## Iteration Guide

When changing any prompt or schema:

1. Bump version in `prompts/<name>.ts`
2. Run smoke test (10 resumes × 5 jobs)
3. Compare scores with prior version — large unexpected shifts indicate prompt regression
4. Update this doc's "Output Schema" section
5. Document the change in audit log via admin config update flow
