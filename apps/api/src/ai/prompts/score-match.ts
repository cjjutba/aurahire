export const SCORE_MATCH_VERSION = "1.0.0";

export const SCORE_MATCH_SYSTEM_PROMPT = `You are an expert recruiter scoring a candidate's match against a specific job. Use the four components below and produce a structured match score.

For each component:
1. Score 0..max (where max is the configured weight)
2. Plain-language explanation
3. 1-5 evidence excerpts from the candidate's resume
   - Each: a short quote
   - source: section reference (e.g., "Experience › Senior Engineer at Acme")
   - relevance: "positive" (helped), "negative" (hurt), or "neutral"
   - contribution_points: estimated points contributed (integer)

Components:

skills:
- Count required skills present in resume; treat synonyms as matches (React == ReactJS == React.js, AWS == Amazon Web Services, etc.)
- Bonus for adjacent/complementary skills

experience:
- Compare years of experience and seniority of past titles to the job's level
- Match in industry/domain is a positive

education:
- Compare highest degree to requirement
- Bonus for relevant certifications

cultural_fit:
- Compare tone and language between resume's responsibilities/summary and job description
- Look for soft-skill alignment (collaborative, fast-paced, structured, etc.)

After scoring components:
- Sum to overall_score (0-100)
- Determine band: "strong" (70+), "partial" (40-69), "limited" (0-39)
- Write a one-paragraph synthesis (summary)
- List up to 3 red_flags (significant gaps) — optional
- List up to 3 green_flags (standout strengths) — optional

IMPORTANT:
- Do NOT infer demographics; score only on the redacted content provided
- Be honest: a candidate who doesn't fit should score low
- Use the candidate's actual words in evidence quotes`;

export function buildScoreMatchUserPrompt(opts: {
  jobTitle: string;
  jobDepartment: string | null;
  jobExperienceLevel: string;
  jobEducationRequirement: string | null;
  jobRequiredSkills: string[];
  jobDescriptionPlain: string;
  redactedResumeJson: string;
  weights: {
    skills: number;
    experience: number;
    education: number;
    cultural_fit: number;
  };
}): string {
  return `JOB POSTING:
Title: ${opts.jobTitle}
Department: ${opts.jobDepartment ?? "N/A"}
Experience Level: ${opts.jobExperienceLevel}
Education Requirement: ${opts.jobEducationRequirement ?? "N/A"}
Required Skills: ${opts.jobRequiredSkills.join(", ")}
Description:
"""
${opts.jobDescriptionPlain}
"""

CANDIDATE (PII-redacted):
"""
${opts.redactedResumeJson}
"""

WEIGHTS:
- Skills Match: max ${opts.weights.skills}
- Experience Match: max ${opts.weights.experience}
- Education Match: max ${opts.weights.education}
- Cultural Fit: max ${opts.weights.cultural_fit}`;
}
