import { Injectable, Logger } from "@nestjs/common";
import {
  type ParsedResume,
  type MatchScore,
  type MatchComponent,
  matchScoreSchema,
} from "@aurahire/shared";

import { OpenAIService } from "./openai.service";
import { RedactPiiService } from "./redact-pii.service";
import {
  SCORE_MATCH_VERSION,
  SCORE_MATCH_SYSTEM_PROMPT,
  buildScoreMatchUserPrompt,
} from "./prompts/score-match";
import { CacheService, TTL_SECONDS, sha256OfStable } from "../cache";

/**
 * The four match-score components the platform contracts to display.
 * The prompt asks for all four, the schema enums all four names - but
 * `components` is `z.array(...)` with no length floor, so the AI is
 * occasionally returning fewer than four (production: ~80% of recent
 * rows had only `skills`). This list drives the defensive backfill in
 * `score()` below.
 */
const REQUIRED_COMPONENT_NAMES = [
  "skills",
  "experience",
  "education",
  "cultural_fit",
] as const satisfies ReadonlyArray<MatchComponent["name"]>;

export interface ScoreMatchInput {
  parsedResume: ParsedResume;
  job: {
    title: string;
    department: string | null;
    experienceLevel: string;
    educationRequirement: string | null;
    requiredSkills: string[];
    descriptionPlain: string;
  };
  weights: {
    skills: number;
    experience: number;
    education: number;
    cultural_fit: number;
  };
  requestId?: string;
}

export interface ScoreMatchOutput {
  score: MatchScore;
  redactedFields: string[];
  latencyMs: number;
  model: string;
  promptVersion: string;
}

@Injectable()
export class ScoreMatchService {
  private readonly logger = new Logger(ScoreMatchService.name);

  constructor(
    private readonly openai: OpenAIService,
    private readonly redact: RedactPiiService,
    private readonly cacheService: CacheService,
  ) {}

  async score(input: ScoreMatchInput): Promise<ScoreMatchOutput> {
    const reqId = input.requestId ?? "score-match";

    const { redacted, redactedFields } = await this.redact.redactResume(
      input.parsedResume,
      reqId,
    );
    this.logger.log(
      `[${reqId}] redacted ${redactedFields.length} fields before match scoring`,
    );

    const cacheInputHash = sha256OfStable({
      redacted,
      job: {
        title: input.job.title,
        department: input.job.department,
        experienceLevel: input.job.experienceLevel,
        educationRequirement: input.job.educationRequirement,
        requiredSkills: input.job.requiredSkills,
        descriptionPlain: input.job.descriptionPlain,
      },
      weights: input.weights,
      promptVersion: SCORE_MATCH_VERSION,
    });

    const aiResult = await this.cacheService.getOrSet<
      Omit<ScoreMatchOutput, "redactedFields">
    >({
      key: `ai:score-match:${cacheInputHash}`,
      ttlSeconds: TTL_SECONDS.ai,
      telemetryName: "ai:score-match",
      load: async () => {
        const userPrompt = buildScoreMatchUserPrompt({
          jobTitle: input.job.title,
          jobDepartment: input.job.department,
          jobExperienceLevel: input.job.experienceLevel,
          jobEducationRequirement: input.job.educationRequirement,
          jobRequiredSkills: input.job.requiredSkills,
          jobDescriptionPlain: input.job.descriptionPlain,
          redactedResumeJson: JSON.stringify(redacted, null, 2),
          weights: input.weights,
        });

        const result = await this.openai.generateStructured({
          schema: matchScoreSchema,
          schemaName: "MatchScore",
          systemPrompt: SCORE_MATCH_SYSTEM_PROMPT,
          userPrompt,
          requestId: `${reqId}:match-v${SCORE_MATCH_VERSION}`,
        });

        return {
          score: result.data,
          latencyMs: result.latencyMs,
          model: result.model,
          promptVersion: SCORE_MATCH_VERSION,
        };
      },
    });

    // Apply the 4-component contract guarantee OUTSIDE the cache
    // boundary. Stale cache entries written before this fix (and any
    // future cached results that happen to be incomplete) all flow
    // through the same backfill - the cache stores the raw AI output,
    // the service contract guarantees the four canonical components in
    // canonical order.
    return {
      ...aiResult,
      score: ensureAllComponents(aiResult.score, input.weights, this.logger, reqId),
      redactedFields,
    };
  }
}

/**
 * Defensive backfill: the prompt asks for all four components, but the
 * schema permits a shorter array, so the AI occasionally returns only a
 * subset (production sample showed ~80% rows with only `skills`).
 * Recruiters and candidates then see a broken breakdown - only one bar
 * out of four.
 *
 * This helper guarantees the returned `MatchScore` has exactly the four
 * canonical components in canonical order. Any component missing from
 * the AI response is inserted with:
 *
 *   - score: 0 (the candidate genuinely got 0 from this dimension
 *     because the AI didn't extract a signal - better than fabricating)
 *   - max / weight: pulled from the active scoring config so the UI
 *     bars are sized correctly
 *   - explanation: one calm sentence acknowledging the unknown - does
 *     not accuse the candidate of failing the dimension
 *   - evidence: one neutral 0-point row that surfaces the same
 *     explanation as an inline citation, so the EvidenceCallout still
 *     renders content rather than an empty list
 *
 * Re-orders the components into the canonical order
 * (skills → experience → education → cultural_fit) so the UI breakdown
 * bars are always in the same sequence regardless of AI output order.
 *
 * Does NOT touch `overall_score`. The strict-sum reconciliation
 * downstream of this call recomputes from contribution_points, so a
 * zeroed component contributes 0 - keeping the headline arithmetic
 * coherent.
 */
function ensureAllComponents(
  score: MatchScore,
  weights: ScoreMatchInput["weights"],
  logger: Logger,
  reqId: string,
): MatchScore {
  const byName = new Map(score.components.map((c) => [c.name, c]));
  const missing = REQUIRED_COMPONENT_NAMES.filter((n) => !byName.has(n));
  if (missing.length === 0) {
    // Even when nothing is missing we re-order so the UI sequence stays
    // canonical (skills, experience, education, cultural_fit).
    return {
      ...score,
      components: REQUIRED_COMPONENT_NAMES.map((n) => byName.get(n)!),
    };
  }

  logger.warn(
    `[${reqId}] AI omitted ${missing.length} component(s) from match score: ${missing.join(", ")} - backfilling with zero placeholders`,
  );

  const padded = REQUIRED_COMPONENT_NAMES.map<MatchComponent>((n) => {
    const present = byName.get(n);
    if (present) return present;
    const max = weights[n] ?? 0;
    return {
      name: n,
      score: 0,
      max,
      weight: max,
      explanation:
        "Could not be evaluated from the candidate's resume content - the AI did not extract a signal for this component on this run.",
      evidence: [
        {
          excerpt:
            "Insufficient signal in the redacted resume content to score this component.",
          source: "System note",
          relevance: "neutral",
          contribution_points: 0,
          reasoning:
            "Placeholder evidence inserted by the platform when the AI returned an incomplete component breakdown; surfaces the gap honestly instead of silently dropping the bar.",
        },
      ],
    };
  });

  return { ...score, components: padded };
}
