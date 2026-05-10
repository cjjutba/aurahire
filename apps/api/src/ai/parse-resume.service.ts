import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
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
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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
  /** 0..1 — fraction of populated *_source strings that substring-match rawText. */
  sourceFieldCoverage: number;
  /** "field: source" entries that did not substring-match rawText. */
  sourceHallucinations: string[];
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
      input.rawText ??
      (await this.extractText(input.storagePath, input.mimeType, reqId));

    if (!rawText.trim()) {
      throw new ServiceUnavailableException({
        code: "RESUME_EMPTY_TEXT",
        message: "Could not extract any text from this file",
      });
    }

    const truncated =
      rawText.length > 30_000 ? rawText.slice(0, 30_000) : rawText;

    const inputHash = sha256OfStable({
      truncatedText: truncated,
      promptVersion: PARSE_RESUME_VERSION,
    });
    const aiResult = await this.cacheService.getOrSet<
      Omit<
        ParseResumeOutput,
        "rawText" | "sourceFieldCoverage" | "sourceHallucinations"
      >
    >({
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

    const coverage = this.computeSourceCoverage(aiResult.parsed, rawText);
    if (coverage.hallucinations.length > 0) {
      this.logger.warn(
        `[${reqId}] ${coverage.hallucinations.length} source-string hallucinations: ${coverage.hallucinations.slice(0, 3).join("; ")}${coverage.hallucinations.length > 3 ? "…" : ""}`,
      );
    }

    return {
      ...aiResult,
      rawText,
      sourceFieldCoverage: coverage.coverage,
      sourceHallucinations: coverage.hallucinations,
    };
  }

  private computeSourceCoverage(
    parsed: ParsedResume,
    rawText: string,
  ): { coverage: number; hallucinations: string[] } {
    const sources: Array<{ field: string; value: string | null }> = [];
    const c = parsed.contact;
    sources.push({ field: "contact.full_name", value: c.full_name_source });
    sources.push({ field: "contact.email", value: c.email_source });
    sources.push({ field: "contact.phone", value: c.phone_source });
    sources.push({
      field: "contact.location_city",
      value: c.location_city_source,
    });
    sources.push({
      field: "contact.location_country",
      value: c.location_country_source,
    });
    sources.push({
      field: "contact.linkedin_url",
      value: c.linkedin_url_source,
    });
    sources.push({
      field: "contact.portfolio_url",
      value: c.portfolio_url_source,
    });
    if (parsed.summary)
      sources.push({ field: "summary", value: parsed.summary.text_source });
    parsed.experience.forEach((e, i) => {
      sources.push({ field: `experience.${i}.title`, value: e.title_source });
      sources.push({
        field: `experience.${i}.company`,
        value: e.company_source,
      });
      sources.push({ field: `experience.${i}.period`, value: e.period_source });
      e.responsibilities_source.forEach((s, j) => {
        sources.push({
          field: `experience.${i}.responsibilities.${j}`,
          value: s,
        });
      });
    });
    parsed.education.forEach((e, i) => {
      sources.push({
        field: `education.${i}.institution`,
        value: e.institution_source,
      });
      sources.push({ field: `education.${i}.degree`, value: e.degree_source });
      sources.push({
        field: `education.${i}.field_of_study`,
        value: e.field_of_study_source,
      });
      sources.push({ field: `education.${i}.period`, value: e.period_source });
      sources.push({ field: `education.${i}.gpa`, value: e.gpa_source });
    });
    parsed.skills.forEach((s, i) => {
      sources.push({ field: `skills.${i}`, value: s.source });
    });
    parsed.certifications.forEach((cert, i) => {
      sources.push({
        field: `certifications.${i}.name`,
        value: cert.name_source,
      });
    });

    const populated = sources.filter((s) => s.value !== null && s.value !== "");
    if (populated.length === 0) return { coverage: 0, hallucinations: [] };

    const normalize = (s: string) =>
      s.replace(/\s+/g, " ").trim().toLowerCase();
    const haystack = normalize(rawText);

    const hallucinations: string[] = [];
    let found = 0;
    for (const s of populated) {
      if (haystack.includes(normalize(s.value!))) {
        found++;
      } else {
        hallucinations.push(`${s.field}: ${s.value!.slice(0, 80)}`);
      }
    }

    return { coverage: found / populated.length, hallucinations };
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
        this.logger.log(
          `[${reqId}] PDF extracted: ${result.text.length} chars`,
        );
        return result.text;
      } finally {
        await parser.destroy();
      }
    }

    if (mimeType === DOCX_MIME) {
      const result = await mammoth.extractRawText({ buffer });
      this.logger.log(
        `[${reqId}] DOCX extracted: ${result.value.length} chars`,
      );
      return result.value;
    }

    throw new ServiceUnavailableException({
      code: "RESUME_UNSUPPORTED_TYPE",
      message: `Unsupported file type: ${mimeType}`,
    });
  }
}
