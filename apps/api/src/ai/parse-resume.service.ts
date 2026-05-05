import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { type ParsedResume, parsedResumeSchema } from "@aurahire/shared";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

import { StorageService } from "../storage/storage.service";
import { OpenAIService } from "./openai.service";
import {
  PARSE_RESUME_VERSION,
  PARSE_RESUME_SYSTEM_PROMPT,
  buildParseResumeUserPrompt,
} from "./prompts/parse-resume";
import { CacheService, TTL_SECONDS, sha256OfStable } from "../cache";

const RESUMES_BUCKET = "resumes";
const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface ParseResumeInput {
  storagePath: string;
  mimeType: string;
  /** Optional: pre-extracted text bypasses download/extract (Phase 2 use). */
  rawText?: string;
  requestId?: string;
}

export interface ParseResumeOutput {
  parsed: ParsedResume;
  rawText: string;
  latencyMs: number;
  model: string;
  promptVersion: string;
}

@Injectable()
export class ParseResumeService {
  private readonly logger = new Logger(ParseResumeService.name);

  constructor(
    private readonly openai: OpenAIService,
    private readonly storage: StorageService,
    private readonly cacheService: CacheService,
  ) {}

  async parse(input: ParseResumeInput): Promise<ParseResumeOutput> {
    const reqId = input.requestId ?? "parse";

    const rawText =
      input.rawText ?? (await this.extractText(input.storagePath, input.mimeType, reqId));

    if (!rawText.trim()) {
      throw new ServiceUnavailableException({
        code: "RESUME_EMPTY_TEXT",
        message: "Could not extract any text from this file",
      });
    }

    const truncated = rawText.length > 30_000 ? rawText.slice(0, 30_000) : rawText;

    const inputHash = sha256OfStable({ truncatedText: truncated, promptVersion: PARSE_RESUME_VERSION });
    const aiResult = await this.cacheService.getOrSet<Omit<ParseResumeOutput, "rawText">>({
      key: `ai:parse-resume:${inputHash}`,
      ttlSeconds: TTL_SECONDS.ai,
      telemetryName: "ai:parse-resume",
      load: async () => {
        const result = await this.openai.generateStructured({
          schema: parsedResumeSchema,
          schemaName: "ParsedResume",
          systemPrompt: PARSE_RESUME_SYSTEM_PROMPT,
          userPrompt: buildParseResumeUserPrompt(truncated),
          requestId: `${reqId}:parse-v${PARSE_RESUME_VERSION}`,
        });
        return {
          parsed: result.data,
          latencyMs: result.latencyMs,
          model: result.model,
          promptVersion: PARSE_RESUME_VERSION,
        };
      },
    });

    return { ...aiResult, rawText };
  }

  private async extractText(
    storagePath: string,
    mimeType: string,
    reqId: string,
  ): Promise<string> {
    const buffer = await this.storage.download({
      bucket: RESUMES_BUCKET,
      path: storagePath,
    });

    if (mimeType === PDF_MIME) {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        this.logger.log(`[${reqId}] PDF extracted: ${result.text.length} chars`);
        return result.text;
      } finally {
        await parser.destroy();
      }
    }

    if (mimeType === DOCX_MIME) {
      const result = await mammoth.extractRawText({ buffer });
      this.logger.log(`[${reqId}] DOCX extracted: ${result.value.length} chars`);
      return result.value;
    }

    throw new ServiceUnavailableException({
      code: "RESUME_UNSUPPORTED_TYPE",
      message: `Unsupported file type: ${mimeType}`,
    });
  }
}
