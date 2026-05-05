import { Injectable, Logger } from "@nestjs/common";
import {
  type ParsedResume,
  type MatchScore,
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

    return { ...aiResult, redactedFields };
  }
}
