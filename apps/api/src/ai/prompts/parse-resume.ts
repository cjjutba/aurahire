// Re-exports the active prompt version. Bump this file to point at a new prompt
// when bumping versions (current: v2 — adds *_source fields).
export {
  PARSE_RESUME_V2_VERSION as PARSE_RESUME_VERSION,
  PARSE_RESUME_V2_SYSTEM_PROMPT as PARSE_RESUME_SYSTEM_PROMPT,
  buildParseResumeV2UserPrompt as buildParseResumeUserPrompt,
} from "./parse-resume-v2";
