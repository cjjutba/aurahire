import { Injectable, NotImplementedException } from "@nestjs/common";
import type { BiasFlag } from "@aurahire/shared";

import { OpenAIService } from "./openai.service";

export interface DetectBiasInput {
  /** Plain text to scan (typically descriptionPlain from a job). */
  text: string;
  /** Custom flagged terms from scoring_config.custom_flagged_terms. */
  customFlaggedTerms?: string[];
  requestId?: string;
}

export interface DetectBiasOutput {
  flags: BiasFlag[];
  latencyMs: number;
  model: string;
  promptVersion: string;
}

/**
 * Bias detection service for job descriptions.
 *
 * Slice 2.3: SHELL ONLY.
 * Slice 2.7: Implements:
 *            1. Build prompt with system + custom_flagged_terms interpolated
 *            2. OpenAIService.generateStructured() with biasFlagListSchema
 *            3. Return flags + audit metadata
 */
@Injectable()
export class DetectBiasService {
  constructor(private readonly openai: OpenAIService) {}

  async check(_input: DetectBiasInput): Promise<DetectBiasOutput> {
    throw new NotImplementedException({
      code: "NOT_IMPLEMENTED",
      message: "Bias detection is implemented in Slice 2.7",
    });
  }
}
