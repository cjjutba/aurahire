import { Injectable, NotImplementedException } from "@nestjs/common";
import type { ProfileScore } from "@aurahire/shared";

import { OpenAIService } from "./openai.service";
import { RedactPiiService } from "./redact-pii.service";

export interface ScoreProfileInput {
  candidateId: string;
  resumeId: string;
  requestId?: string;
}

export interface ScoreProfileOutput {
  score: ProfileScore;
  redactedFields: string[];
  latencyMs: number;
  model: string;
  promptVersion: string;
  weightsUsed: Record<string, number>;
}

/**
 * Profile scoring service.
 *
 * Slice 2.3: SHELL ONLY.
 * Slice 2.5: Implements:
 *            1. Load resume + candidate prefs from DB
 *            2. RedactPiiService.redactResume()
 *            3. OpenAIService.generateStructured() with profileScoreSchema + SCORE_PROFILE prompts
 *            4. Return score + audit metadata
 */
@Injectable()
export class ScoreProfileService {
  constructor(
    private readonly openai: OpenAIService,
    private readonly redact: RedactPiiService,
  ) {}

  async score(_input: ScoreProfileInput): Promise<ScoreProfileOutput> {
    throw new NotImplementedException({
      code: "NOT_IMPLEMENTED",
      message: "Profile scoring is implemented in Slice 2.5",
    });
  }
}
