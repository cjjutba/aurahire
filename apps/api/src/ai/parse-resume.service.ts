import { Injectable, NotImplementedException } from "@nestjs/common";
import type { ParsedResume } from "@aurahire/shared";

import { OpenAIService } from "./openai.service";

export interface ParseResumeInput {
  /** Path in Supabase Storage to the uploaded PDF/DOCX. */
  storagePath: string;
  /** Optional: pre-extracted plain text (skips download/parse if provided). */
  plainText?: string;
  /** For audit-log correlation. */
  requestId?: string;
}

export interface ParseResumeOutput {
  parsed: ParsedResume;
  rawText: string;
  latencyMs: number;
  model: string;
  promptVersion: string;
}

/**
 * Resume parsing service.
 *
 * Slice 2.3 (current): SHELL ONLY. Throws NotImplementedException.
 * Slice 2.4 (next):    Implements the full pipeline:
 *                      1. Download file from Supabase Storage
 *                      2. Extract plain text (pdf-parse / mammoth)
 *                      3. Call OpenAI with PARSE_RESUME prompts + parsedResumeSchema
 *                      4. Return parsed + raw + metadata
 */
@Injectable()
export class ParseResumeService {
  constructor(private readonly openai: OpenAIService) {}

  async parse(_input: ParseResumeInput): Promise<ParseResumeOutput> {
    throw new NotImplementedException({
      code: "NOT_IMPLEMENTED",
      message: "Resume parsing is implemented in Slice 2.4",
    });
  }
}
