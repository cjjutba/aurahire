import { Injectable, Logger } from "@nestjs/common";
import {
  type BiasFlag,
  biasFlagListSchema,
} from "@aurahire/shared";

import { OpenAIService } from "./openai.service";
import {
  DETECT_BIAS_VERSION,
  DETECT_BIAS_SYSTEM_PROMPT,
  buildDetectBiasUserPrompt,
} from "./prompts/detect-bias";

export interface DetectBiasInput {
  text: string;
  customFlaggedTerms?: string[];
  requestId?: string;
}

export interface DetectBiasOutput {
  flags: BiasFlag[];
  latencyMs: number;
  model: string;
  promptVersion: string;
}

@Injectable()
export class DetectBiasService {
  private readonly logger = new Logger(DetectBiasService.name);

  constructor(private readonly openai: OpenAIService) {}

  async check(input: DetectBiasInput): Promise<DetectBiasOutput> {
    const reqId = input.requestId ?? "detect-bias";

    const userPrompt = buildDetectBiasUserPrompt({
      descriptionPlain: input.text,
      customFlaggedTerms: input.customFlaggedTerms ?? [],
    });

    const result = await this.openai.generateStructured({
      schema: biasFlagListSchema,
      schemaName: "BiasFlagList",
      systemPrompt: DETECT_BIAS_SYSTEM_PROMPT,
      userPrompt,
      requestId: `${reqId}:bias-v${DETECT_BIAS_VERSION}`,
    });

    this.logger.log(
      `[${reqId}] bias check completed: ${result.data.flags.length} flag(s) in ${result.latencyMs}ms`,
    );

    return {
      flags: result.data.flags,
      latencyMs: result.latencyMs,
      model: result.model,
      promptVersion: DETECT_BIAS_VERSION,
    };
  }
}
