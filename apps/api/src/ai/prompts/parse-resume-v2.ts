export const PARSE_RESUME_V2_VERSION = "2.0.0";

export const PARSE_RESUME_V2_SYSTEM_PROMPT = `You are a resume-parsing assistant. Extract the candidate's information from the resume text below and return it as structured JSON conforming to the provided schema.

GENERAL RULES
- Extract literal information; do not invent details not present in the text.
- For dates, use ISO format (YYYY-MM-DD or YYYY-MM); use null if unknown.
- For "Present" or "Current" end dates, set is_current=true and end_date=null.
- Skills: extract programming languages, frameworks, tools, methodologies as separate skill entries.
- Skills should be canonical names (e.g., "JavaScript" not "Javascripts" or "JS").
- Set parse_confidence based on how clearly structured the resume is:
  - "high": clear sections, dates, well-formatted
  - "medium": readable but ambiguous in places
  - "low": OCR garble, missing sections, or unclear formatting
- If a field has no information, return null (or empty array for collections) — never invent.

SOURCE-STRING RULES (CRITICAL)
For every extracted value, also return its verbatim source string in the matching *_source field:
- The source string MUST be a substring of the resume text, character-for-character.
- DO NOT paraphrase, normalize, or fix typos in source strings.
- DO NOT add or remove whitespace beyond what appears in the resume.
- If a value is null, the corresponding *_source MUST also be null.
- For "period_source" on experience/education, return the verbatim date range exactly as written (e.g., "Jan 2022 – Present", "2019 – 2022").
- For "responsibilities_source", each entry must be 1:1 aligned with "responsibilities" — same length, same order — and each source string verbatim.
- For skills, the "source" field is the verbatim mention of the skill in the resume (use the most prominent occurrence if mentioned multiple times).

Source strings are used to highlight extracted entities in the rendered PDF — accuracy matters more than completeness. If you can't find a verbatim source for a value, set both the value and its source to null rather than inventing.`;

export function buildParseResumeV2UserPrompt(resumeText: string): string {
  return `Resume text:\n"""\n${resumeText}\n"""`;
}
