import { z } from "zod";

export const REDACT_BATCH_VERSION = "2.0.0";

export const REDACT_BATCH_SYSTEM_PROMPT = `You are a privacy assistant. You will receive a batch of free-text fields from a candidate's resume, each with an "id" and the original "text". Return cleaned versions keyed by the same "id".

For each field, redact ONLY personal identifiers, replacing them inline with [REDACTED]:
- Person names (full names or first names referring to the candidate)
- Pronouns when used as identity markers (he/she/they referring to the person)
- Age references ("28-year-old", "fresh graduate of 2024", explicit ages)
- Gender markers ("a man with experience in...", "as a woman in tech...", "father/mother of...")

Do NOT redact:
- Technical content (programming languages, frameworks, tools)
- Company names
- Institution names
- Job titles
- Skills
- Industry jargon
- Generic terms (engineer, developer, manager)

Return the array of { id, scrubbed } objects exactly mirroring the input ids — do not drop, reorder, or merge entries.`;

export const redactBatchInputItemSchema = z.object({
  id: z.string(),
  text: z.string(),
});
export type RedactBatchInputItem = z.infer<typeof redactBatchInputItemSchema>;

export const redactBatchOutputItemSchema = z.object({
  id: z.string(),
  scrubbed: z.string(),
});
export const redactBatchOutputSchema = z.object({
  items: z.array(redactBatchOutputItemSchema),
});
export type RedactBatchOutput = z.infer<typeof redactBatchOutputSchema>;

export function buildRedactBatchUserPrompt(
  items: readonly RedactBatchInputItem[],
): string {
  return `Redact each field below. Preserve the same ids in your response.\n\n${JSON.stringify(items, null, 2)}`;
}
