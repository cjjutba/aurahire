import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

export interface GenerateStructuredOptions<T> {
  /** Zod schema defining the expected structured output. */
  schema: z.ZodSchema<T>;
  /** Schema name for OpenAI's strict JSON Schema mode (alphanumeric + underscores; no spaces). */
  schemaName: string;
  systemPrompt: string;
  userPrompt: string;
  /** Defaults to OPENAI_MODEL env (which defaults to gpt-4o-mini). */
  model?: string;
  /** Default 0 (deterministic). */
  temperature?: number;
  /** For Pino log correlation. */
  requestId?: string;
}

export interface GenerateStructuredResult<T> {
  data: T;
  latencyMs: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface GenerateTextOptions {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  requestId?: string;
}

export interface GenerateTextResult {
  text: string;
  latencyMs: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly client: OpenAI;
  private readonly defaultModel: string;
  private readonly timeout: number;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.getOrThrow<string>("OPENAI_API_KEY");
    this.defaultModel = config.get<string>("OPENAI_MODEL") ?? "gpt-4o-mini";
    this.timeout = Number(config.get<string>("AI_TIMEOUT_MS") ?? 30_000);

    this.client = new OpenAI({
      apiKey,
      timeout: this.timeout,
      maxRetries: 1,
    });

    this.logger.log(
      `OpenAIService initialized (model=${this.defaultModel}, timeout=${this.timeout}ms)`,
    );
  }

  /**
   * Generate structured output using OpenAI's strict JSON Schema mode.
   * Validates the response against the provided Zod schema before returning.
   * Throws ServiceUnavailableException on transport / parse failures.
   */
  async generateStructured<T>(
    opts: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<T>> {
    const model = opts.model ?? this.defaultModel;
    const temperature = opts.temperature ?? 0;
    const startedAt = Date.now();
    const reqId = opts.requestId ?? "ai";

    try {
      // OpenAI SDK v6 + Zod helper trips TS2589 (excessively deep type
      // instantiation) due to recursive union type inference. We bypass type
      // checking on the helper invocation; runtime behavior is unaffected and
      // we still validate the parsed output below via opts.schema.parse().
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const responseFormat: any = (zodResponseFormat as any)(
        opts.schema,
        opts.schemaName,
      );
      const completion = await this.client.chat.completions.parse({
        model,
        temperature,
        messages: [
          { role: "system", content: opts.systemPrompt },
          { role: "user", content: opts.userPrompt },
        ],
        response_format: responseFormat,
      });

      const latencyMs = Date.now() - startedAt;
      const choice = completion.choices[0];
      const parsed = choice?.message.parsed as T | null | undefined;

      if (!parsed) {
        // OpenAI structured-output strict mode rarely fails parsing,
        // but a refusal can leave parsed=null. Surface clearly.
        const refusal = choice?.message.refusal;
        this.logger.error(
          `[${reqId}] OpenAI returned no parsed content (refusal=${refusal ?? "none"}, schema=${opts.schemaName})`,
        );
        throw new ServiceUnavailableException({
          code: "AI_NO_OUTPUT",
          message: "AI service returned no parsed output",
        });
      }

      // Defensive: validate parsed result against Zod
      const validated = opts.schema.parse(parsed);

      this.logger.log(
        `[${reqId}] OpenAI structured ok: schema=${opts.schemaName} model=${model} ms=${latencyMs}`,
      );

      return {
        data: validated,
        latencyMs,
        model,
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
      };
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      this.logger.error(
        `[${reqId}] OpenAI failed after ${latencyMs}ms: ${(err as Error).message}`,
      );

      if (err instanceof ServiceUnavailableException) throw err;

      // Wrap any other failure (network, timeout, validation) as 503
      throw new ServiceUnavailableException({
        code: "AI_SERVICE_FAILED",
        message: `AI service failure: ${(err as Error).message}`,
      });
    }
  }

  /**
   * Generate plain-text completion. Used by PII free-text scrubbing.
   */
  async generateText(opts: GenerateTextOptions): Promise<GenerateTextResult> {
    const model = opts.model ?? this.defaultModel;
    const temperature = opts.temperature ?? 0;
    const startedAt = Date.now();
    const reqId = opts.requestId ?? "ai";

    try {
      const completion = await this.client.chat.completions.create({
        model,
        temperature,
        messages: [
          { role: "system", content: opts.systemPrompt },
          { role: "user", content: opts.userPrompt },
        ],
      });

      const latencyMs = Date.now() - startedAt;
      const text = completion.choices[0]?.message.content ?? "";

      this.logger.log(
        `[${reqId}] OpenAI text ok: model=${model} ms=${latencyMs} chars=${text.length}`,
      );

      return {
        text,
        latencyMs,
        model,
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
      };
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      this.logger.error(
        `[${reqId}] OpenAI text failed after ${latencyMs}ms: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException({
        code: "AI_SERVICE_FAILED",
        message: `AI service failure: ${(err as Error).message}`,
      });
    }
  }
}
