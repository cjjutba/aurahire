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
import { CacheService, TTL_SECONDS, sha256OfStable } from "../cache";

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

  constructor(
    private readonly openai: OpenAIService,
    private readonly cacheService: CacheService,
  ) {}

  async check(input: DetectBiasInput): Promise<DetectBiasOutput> {
    const reqId = input.requestId ?? "detect-bias";

    const cacheInputHash = sha256OfStable({
      text: input.text,
      customFlaggedTerms: input.customFlaggedTerms ?? [],
      promptVersion: DETECT_BIAS_VERSION,
    });

    const result = await this.cacheService.getOrSet<DetectBiasOutput>({
      key: `ai:detect-bias:${cacheInputHash}`,
      ttlSeconds: TTL_SECONDS.ai,
      telemetryName: "ai:detect-bias",
      load: async () => {
        const userPrompt = buildDetectBiasUserPrompt({
          descriptionPlain: input.text,
          customFlaggedTerms: input.customFlaggedTerms ?? [],
        });

        const aiResult = await this.openai.generateStructured({
          schema: biasFlagListSchema,
          schemaName: "BiasFlagList",
          systemPrompt: DETECT_BIAS_SYSTEM_PROMPT,
          userPrompt,
          requestId: `${reqId}:bias-v${DETECT_BIAS_VERSION}`,
        });

        this.logger.log(
          `[${reqId}] bias check completed: ${aiResult.data.flags.length} flag(s) in ${aiResult.latencyMs}ms`,
        );

        return {
          flags: aiResult.data.flags,
          latencyMs: aiResult.latencyMs,
          model: aiResult.model,
          promptVersion: DETECT_BIAS_VERSION,
        };
      },
    });

    return result;
  }
}
