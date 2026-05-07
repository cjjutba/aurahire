import { Injectable, Logger } from "@nestjs/common";
import type { ParsedResume } from "@aurahire/shared";

import { OpenAIService } from "./openai.service";
import {
  REDACT_BATCH_SYSTEM_PROMPT,
  REDACT_BATCH_VERSION,
  buildRedactBatchUserPrompt,
  redactBatchOutputSchema,
  type RedactBatchInputItem,
} from "./prompts/redact-batch";

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
   * Full redaction pipeline: structured scrub + LLM-assisted batched scrub.
   *
   * Every free-text field (summary + each long responsibility) is sent in
   * ONE structured OpenAI call (prompt v2.0.0). The AI returns the cleaned
   * text per id; we apply results in declaration order so `redactedFields`
   * ordering is stable.
   *
   * Best-effort: if the batch call fails or returns missing ids, the
   * affected fields keep their originals — contact-field redactions still
   * apply, and the worker continues with whatever cleaning landed.
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

    const items: RedactBatchInputItem[] = tasks.map((t) => ({
      id: t.path,
      text: t.original,
    }));

    try {
      const result = await this.openai.generateStructured({
        schema: redactBatchOutputSchema,
        schemaName: "RedactBatchOutput",
        systemPrompt: REDACT_BATCH_SYSTEM_PROMPT,
        userPrompt: buildRedactBatchUserPrompt(items),
        requestId: requestId
          ? `${requestId}:redact-v${REDACT_BATCH_VERSION}`
          : undefined,
      });

      const byId = new Map(
        result.data.items.map((it) => [it.id, it.scrubbed]),
      );

      for (const task of tasks) {
        const scrubbed = byId.get(task.path);
        if (scrubbed === undefined) {
          this.logger.warn(
            `Redact batch dropped id ${task.path}; keeping original`,
          );
          continue;
        }
        if (scrubbed !== task.original) {
          task.apply(scrubbed);
          redactedFields.push(task.path);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Batched redaction failed; keeping originals: ${(err as Error).message}`,
      );
    }

    return { redacted, redactedFields };
  }
}
