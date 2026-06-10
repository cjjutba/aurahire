/**
 * Slice 2.3 smoke test.
 *
 * Verifies that OpenAIService.generateStructured() works end-to-end:
 *   1. Calls OpenAI with the parse-resume prompt against a tiny synthetic resume
 *   2. Calls OpenAI with the detect-bias prompt against a deliberately biased text
 * Both calls must return valid Zod-parsed JSON.
 *
 * Run: pnpm --filter @aurahire/api exec tsx scripts/smoke-test-openai.ts
 */
import "dotenv/config";
import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { parsedResumeSchema, biasFlagListSchema } from "@aurahire/shared";

import { OpenAIService } from "../src/ai/openai.service";
import {
  PARSE_RESUME_SYSTEM_PROMPT,
  PARSE_RESUME_VERSION,
  buildParseResumeUserPrompt,
} from "../src/ai/prompts/parse-resume";
import {
  DETECT_BIAS_SYSTEM_PROMPT,
  DETECT_BIAS_VERSION,
  buildDetectBiasUserPrompt,
} from "../src/ai/prompts/detect-bias";

const TINY_RESUME = `
Maria Reyes
maria@example.com | +63 917 555 0100 | Manila, PH

EXPERIENCE
Software Engineer at Acme Corp (2020 - Present)
- Built TypeScript microservices on AWS
- Led 3-engineer team

EDUCATION
BS Computer Science, University of the Philippines (2016 - 2020)

SKILLS
TypeScript, Node.js, AWS, Docker
`;

const BIASED_JOB_DESCRIPTION = `
We're looking for a young, energetic rockstar engineer to join our fast-paced startup.
Must be willing to work long hours and able to lift heavy boxes during office moves.
Recent graduates preferred. Strong TypeScript skills required.
`;

async function main() {
  // Build a minimal config service from process.env
  const config = {
    get: (k: string) => process.env[k],
    getOrThrow: (k: string) => {
      const v = process.env[k];
      if (!v) throw new Error(`Missing env: ${k}`);
      return v;
    },
  } as unknown as ConfigService;

  const openai = new OpenAIService(config);

  console.log("=== Slice 2.3 OpenAI smoke test ===\n");

  // Test 1: Resume parse
  console.log("[1/2] Parsing tiny resume...");
  const parseResult = await openai.generateStructured({
    schema: parsedResumeSchema,
    schemaName: "ParsedResume",
    systemPrompt: PARSE_RESUME_SYSTEM_PROMPT,
    userPrompt: buildParseResumeUserPrompt(TINY_RESUME),
    requestId: `smoke-parse-v${PARSE_RESUME_VERSION}`,
  });
  console.log(`  ✓ Parsed in ${parseResult.latencyMs}ms`);
  console.log(`    name: ${parseResult.data.contact.full_name}`);
  console.log(`    skills: ${parseResult.data.skills.join(", ")}`);
  console.log(`    education: ${parseResult.data.education.length} entries`);
  console.log(`    parse_confidence: ${parseResult.data.parse_confidence}`);
  console.log(
    `    tokens: ${parseResult.promptTokens} prompt + ${parseResult.completionTokens} completion`,
  );
  console.log();

  // Test 2: Bias detect
  console.log("[2/2] Checking biased job description...");
  const biasResult = await openai.generateStructured({
    schema: biasFlagListSchema,
    schemaName: "BiasFlagList",
    systemPrompt: DETECT_BIAS_SYSTEM_PROMPT,
    userPrompt: buildDetectBiasUserPrompt({
      descriptionPlain: BIASED_JOB_DESCRIPTION,
      customFlaggedTerms: [],
    }),
    requestId: `smoke-bias-v${DETECT_BIAS_VERSION}`,
  });
  console.log(`  ✓ Checked in ${biasResult.latencyMs}ms`);
  console.log(`    flags: ${biasResult.data.flags.length}`);
  for (const flag of biasResult.data.flags) {
    console.log(
      `      - "${flag.term}" (${flag.category}, ${flag.severity}): ${flag.suggestion}`,
    );
  }
  console.log(
    `    tokens: ${biasResult.promptTokens} prompt + ${biasResult.completionTokens} completion`,
  );
  console.log();

  // Sanity assertions
  if (parseResult.data.skills.length === 0) {
    throw new Error(
      "Parse result has zero skills - unexpected for the test resume",
    );
  }
  if (biasResult.data.flags.length < 2) {
    throw new Error(
      `Expected >=2 bias flags for the deliberately biased text; got ${biasResult.data.flags.length}`,
    );
  }

  console.log("=== Smoke test PASSED ===");
  console.log(
    `Total latency: ${parseResult.latencyMs + biasResult.latencyMs}ms`,
  );
  console.log(
    `Total tokens: ${parseResult.promptTokens + parseResult.completionTokens + biasResult.promptTokens + biasResult.completionTokens}`,
  );
  console.log(
    `Estimated cost (gpt-4o-mini): ~$${
      ((parseResult.promptTokens + biasResult.promptTokens) * 0.15 +
        (parseResult.completionTokens + biasResult.completionTokens) * 0.6) /
      1_000_000
    }`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("\n=== Smoke test FAILED ===");
  console.error(err);
  process.exit(1);
});
