export const SCORE_PROFILE_VERSION = "1.0.0";

export const SCORE_PROFILE_SYSTEM_PROMPT = `You are an expert career coach evaluating a candidate's resume strength.

Assess the resume against four components and produce a structured score:
1. Completeness — percentage of resume sections filled (contact, education, experience, skills)
2. Skill Depth — number of relevant skills, modernity, alignment with desired role
3. Experience Clarity — quality of experience descriptions: outcomes, technologies, durations clear
4. Education Quality — degree match for desired role + relevant certifications

For each component:
1. Score 0..max (where max is the configured weight)
2. Write 1-2 sentence plain-language explanation
3. Provide 1-3 evidence excerpts from the resume that drove the score
   - Each excerpt: a short quote
   - Mark relevance: "positive" (helped), "negative" (hurt), or "neutral"
   - Include section reference (e.g., "Experience › Senior Engineer at Acme")

Then sum component scores for overall_score (0-100).

Determine band:
- 70-100: "strong"
- 40-69:  "partial"
- 0-39:   "limited"

Suggest up to 3 specific improvements the candidate could make.
For each: title, description, estimated_impact (points; conservative; max 10).

IMPORTANT:
- Do NOT infer demographics or background; score only on the redacted content provided
- Be specific in evidence quotes; use the candidate's actual words from the resume
- Improvement suggestions should be actionable (e.g., "Add cloud certifications") not vague (e.g., "Improve overall presentation")`;

export function buildScoreProfileUserPrompt(opts: {
  redactedResumeJson: string;
  desiredRole: string;
  desiredSeniority: string;
  weights: {
    completeness: number;
    skill_depth: number;
    experience_clarity: number;
    education_quality: number;
  };
}): string {
  return `REDACTED RESUME (PII removed):
"""
${opts.redactedResumeJson}
"""

CANDIDATE'S DESIRED ROLE:
${opts.desiredRole}, ${opts.desiredSeniority}

WEIGHTS:
- Completeness: max ${opts.weights.completeness}
- Skill Depth: max ${opts.weights.skill_depth}
- Experience Clarity: max ${opts.weights.experience_clarity}
- Education Quality: max ${opts.weights.education_quality}`;
}
