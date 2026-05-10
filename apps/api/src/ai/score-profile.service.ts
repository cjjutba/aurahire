import { Injectable, Logger } from "@nestjs/common";
import {
  type ParsedResume,
  type ProfileScore,
  profileScoreSchema,
} from "@aurahire/shared";

import { OpenAIService } from "./openai.service";
import { RedactPiiService } from "./redact-pii.service";
import {
  SCORE_PROFILE_VERSION,
  SCORE_PROFILE_SYSTEM_PROMPT,
  buildScoreProfileUserPrompt,
} from "./prompts/score-profile";
import { CacheService, TTL_SECONDS, sha256OfStable } from "../cache";

export interface ScoreProfileInput {
  parsedResume: ParsedResume;
  desiredRole: string;
  desiredSeniority: string;
  weights: {
    completeness: number;
    skill_depth: number;
    experience_clarity: number;
    education_quality: number;
  };
  requestId?: string;
}

export interface ScoreProfileOutput {
  score: ProfileScore;
  redactedFields: string[];
  latencyMs: number;
  model: string;
  promptVersion: string;
}

@Injectable()
export class ScoreProfileService {
  private readonly logger = new Logger(ScoreProfileService.name);

  constructor(
    private readonly openai: OpenAIService,
    private readonly redact: RedactPiiService,
    private readonly cacheService: CacheService,
  ) {}

  async score(input: ScoreProfileInput): Promise<ScoreProfileOutput> {
    const reqId = input.requestId ?? "score-profile";

    const { redacted, redactedFields } = await this.redact.redactResume(
      input.parsedResume,
      reqId,
    );

    this.logger.log(
      `[${reqId}] redacted ${redactedFields.length} fields before scoring`,
    );

    const cacheInputHash = sha256OfStable({
      redacted,
      weights: input.weights,
      desiredRole: input.desiredRole,
      desiredSeniority: input.desiredSeniority,
      promptVersion: SCORE_PROFILE_VERSION,
    });

    const aiResult = await this.cacheService.getOrSet<
      Omit<ScoreProfileOutput, "redactedFields">
    >({
      key: `ai:score-profile:${cacheInputHash}`,
      ttlSeconds: TTL_SECONDS.ai,
      telemetryName: "ai:score-profile",
      load: async () => {
        const userPrompt = buildScoreProfileUserPrompt({
          redactedResumeJson: JSON.stringify(redacted, null, 2),
          desiredRole: input.desiredRole,
          desiredSeniority: input.desiredSeniority,
          weights: input.weights,
        });

        const result = await this.openai.generateStructured({
          schema: profileScoreSchema,
          schemaName: "ProfileScore",
          systemPrompt: SCORE_PROFILE_SYSTEM_PROMPT,
          userPrompt,
          requestId: `${reqId}:profile-v${SCORE_PROFILE_VERSION}`,
        });

        return {
          score: result.data,
          latencyMs: result.latencyMs,
          model: result.model,
          promptVersion: SCORE_PROFILE_VERSION,
        };
      },
    });

    return { ...aiResult, redactedFields };
  }
}
