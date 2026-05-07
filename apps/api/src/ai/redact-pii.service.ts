import { Injectable, Logger } from "@nestjs/common";
import type { ParsedResume } from "@aurahire/shared";

import { OpenAIService } from "./openai.service";
import {
  REDACT_TEXT_SYSTEM_PROMPT,
  REDACT_TEXT_VERSION,
  buildRedactTextUserPrompt,
} from "./prompts/redact-text";

/**
 * Fields that are ALWAYS redacted from a parsed resume before AI scoring.
 * Stored on every score row's `redacted_fields` so admins can audit transparency.
 */
const ALWAYS_REDACTED_PATHS = [
  "contact.full_name",
  "contact.email",
  "contact.phone",
  "contact.linkedin_url",
  "contact.portfolio_url",
] as const;

/** Free-text fields long enough to warrant LLM-assisted scrubbing. */
const FREE_TEXT_MIN_LENGTH = 50;

export interface RedactionResult {
  redacted: ParsedResume;
  redactedFields: string[];
}

@Injectable()
export class RedactPiiService {
  private readonly logger = new Logger(RedactPiiService.name);

  constructor(private readonly openai: OpenAIService) {}

  /**
   * Rule-based redaction: strip known structured PII fields.
   * Sync; doesn't call OpenAI. Always run as the first redaction layer.
   */
  redactStructured(parsed: ParsedResume): RedactionResult {
    const redactedFields: string[] = [];
    const cleaned: ParsedResume = {
      ...parsed,
      contact: { ...parsed.contact },
    };

    for (const path of ALWAYS_REDACTED_PATHS) {
      // path is "contact.<key>"
      const [, key] = path.split(".");
      if (!key) continue;
      const k = key as keyof typeof cleaned.contact;
      if (cleaned.contact[k] != null) {
        cleaned.contact[k] = null as never;
        redactedFields.push(path);
      }
    }

    return { redacted: cleaned, redactedFields };
  }

  /**
   * Full redaction pipeline: structured scrub + LLM-assisted free-text scrub.
   * Call this before any scoring AI call.
   *
   * Free-text scrub calls are dispatched in PARALLEL via Promise.allSettled.
   * Application of results is then walked in deterministic declaration order
   * (summary first, then experience row-major) so `redactedFields` ordering
   * is stable regardless of which OpenAI call resolves first.
   */
  async redactResume(
    parsed: ParsedResume,
    requestId?: string,
  ): Promise<RedactionResult> {
    const { redacted, redactedFields } = this.redactStructured(parsed);

    type ScrubTask = {
      path: string;
      original: string;
      apply: (scrubbed: string) => void;
    };
    const tasks: ScrubTask[] = [];

    if (
      redacted.summary &&
      redacted.summary.text.length >= FREE_TEXT_MIN_LENGTH
    ) {
      const summary = redacted.summary;
      tasks.push({
        path: "summary",
        original: summary.text,
        apply: (scrubbed) => {
          redacted.summary = { ...summary, text: scrubbed };
        },
      });
    }

    for (let i = 0; i < redacted.experience.length; i++) {
      const exp = redacted.experience[i]!;
      for (let j = 0; j < exp.responsibilities.length; j++) {
        const r = exp.responsibilities[j]!;
        if (r.length >= FREE_TEXT_MIN_LENGTH) {
          const idxI = i;
          const idxJ = j;
          tasks.push({
            path: `experience.${idxI}.responsibilities.${idxJ}`,
            original: r,
            apply: (scrubbed) => {
              redacted.experience[idxI]!.responsibilities[idxJ] = scrubbed;
            },
          });
        }
      }
    }

    if (tasks.length === 0) {
      return { redacted, redactedFields };
    }

    const settled = await Promise.allSettled(
      tasks.map((t) => this.scrubText(t.original, requestId)),
    );

    settled.forEach((result, idx) => {
      const task = tasks[idx]!;
      if (result.status === "rejected") {
        this.logger.warn(
          `Scrub failed for ${task.path}: ${(result.reason as Error).message}`,
        );
        return;
      }
      const scrubbed = result.value;
      if (scrubbed !== task.original) {
        task.apply(scrubbed);
        redactedFields.push(task.path);
      }
    });

    return { redacted, redactedFields };
  }

  private async scrubText(text: string, requestId?: string): Promise<string> {
    const result = await this.openai.generateText({
      systemPrompt: REDACT_TEXT_SYSTEM_PROMPT,
      userPrompt: buildRedactTextUserPrompt(text),
      requestId: requestId
        ? `${requestId}:redact-v${REDACT_TEXT_VERSION}`
        : undefined,
    });
    return result.text.trim();
  }
}
