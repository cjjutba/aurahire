import { Injectable, NotImplementedException } from "@nestjs/common";
import type { MatchScore } from "@aurahire/shared";

import { OpenAIService } from "./openai.service";
import { RedactPiiService } from "./redact-pii.service";

export interface ScoreMatchInput {
  applicationId: string;
  candidateId: string;
  jobId: string;
  resumeId: string;
  requestId?: string;
}

export interface ScoreMatchOutput {
  score: MatchScore;
  redactedFields: string[];
  latencyMs: number;
  model: string;
  promptVersion: string;
  weightsUsed: Record<string, number>;
}

/**
 * Match scoring service.
 *
 * Slice 2.3: SHELL ONLY.
 * Slice 2.6: Implements:
 *            1. Load resume parsed_data + job from DB
 *            2. RedactPiiService.redactResume()
 *            3. OpenAIService.generateStructured() with matchScoreSchema + SCORE_MATCH prompts
 *            4. Return score + audit metadata
 */
@Injectable()
export class ScoreMatchService {
  constructor(
    private readonly openai: OpenAIService,
    private readonly redact: RedactPiiService,
  ) {}

  async score(_input: ScoreMatchInput): Promise<ScoreMatchOutput> {
    throw new NotImplementedException({
      code: "NOT_IMPLEMENTED",
      message: "Match scoring is implemented in Slice 2.6",
    });
  }
}
