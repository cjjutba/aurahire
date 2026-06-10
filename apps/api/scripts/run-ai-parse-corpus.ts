/**
 * Golden-corpus AI quality gate for the parse-resume v2 prompt.
 *
 * Reads every `.pdf` and `.docx` file in `apps/api/test/fixtures/resumes/`,
 * loads the adjacent `.expected.json`, runs the real ParseResumeService against
 * each one, computes per-fixture metrics, and asserts thresholds.
 *
 * HARD-FAIL conditions:
 *   - any fixture: contact precision < 0.95, recall < 0.95
 *   - any fixture: experience or education count mismatch
 *   - any fixture: skills Jaccard < 0.85
 *   - any fixture: source_field_coverage < 0.90
 *   - any fixture: source_string hallucinations > 0
 *   - corpus-wide: avg source_field_coverage < 0.90
 *   - corpus-wide: total hallucinations > 0
 *
 * IMPORTANT: this script makes BILLED OpenAI API calls and uses real Supabase
 * storage. It is meant to be invoked manually by a human, not by CI without
 * OPENAI_API_KEY + storage credentials wired up.
 *
 * Run: pnpm --filter @aurahire/api test:ai-parse
 */
import "reflect-metadata";
import { readFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../src/app.module";
import {
  ParseResumeService,
  type ParseResumeOutput,
} from "../src/ai/parse-resume.service";
import { StorageService } from "../src/storage/storage.service";

const FIXTURES_DIR = join(__dirname, "../test/fixtures/resumes");
const RESUMES_BUCKET = "resumes";
const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface ExpectedContact {
  full_name?: string;
  phone?: string;
  email?: string;
  location_city?: string;
  location_country?: string;
}

interface ExpectedFixture {
  contact: ExpectedContact;
  experienceCount: number;
  educationCount: number;
  skills: string[];
}

interface FixtureResult {
  fixture: string;
  contactPrecision: number;
  contactRecall: number;
  experienceMatch: boolean;
  educationMatch: boolean;
  skillsJaccard: number;
  sourceFieldCoverage: number;
  hallucinationCount: number;
  passed: boolean;
  failures: string[];
}

const logger = new Logger("ai-parse-corpus");

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

function caseInsensitiveSet(arr: string[]): Set<string> {
  return new Set(arr.map((s) => s.trim().toLowerCase()));
}

function mimeTypeFor(ext: string): string {
  if (ext === ".pdf") return PDF_MIME;
  if (ext === ".docx") return DOCX_MIME;
  throw new Error(`Unsupported fixture extension: ${ext}`);
}

async function evaluateFixture(
  parser: ParseResumeService,
  storage: StorageService,
  fixturePath: string,
  fixtureName: string,
  expected: ExpectedFixture,
): Promise<FixtureResult> {
  const failures: string[] = [];

  const buffer = await readFile(fixturePath);
  const ext = extname(fixturePath).toLowerCase();
  const mimeType = mimeTypeFor(ext);

  // Upload to a temporary storage path so the parser's normal download/extract
  // path runs end-to-end. We delete the temp object afterwards in a `finally`.
  const tempPath = `corpus-tests/${randomUUID()}${ext}`;
  let result: ParseResumeOutput;
  try {
    await storage.upload({
      bucket: RESUMES_BUCKET,
      path: tempPath,
      buffer,
      contentType: mimeType,
    });

    result = await parser.parse({
      storagePath: tempPath,
      mimeType,
      requestId: `corpus:${fixtureName}`,
    });
  } finally {
    await storage
      .delete({ bucket: RESUMES_BUCKET, path: tempPath })
      .catch((err: unknown) =>
        logger.warn(
          `failed to delete temp fixture ${tempPath}: ${(err as Error).message}`,
        ),
      );
  }

  const parsed = result.parsed;

  // ── Contact precision/recall ──────────────────────────────────────────────
  // Both numerator and denominator are over the keys present in the expected
  // contact block. For each expected key, we count it as matched when the
  // parser's value (case-insensitive, trimmed) contains the expected value.
  // Precision and recall share the same denominator since `expected` is the
  // sole source of truth.
  const expectedContactKeys = Object.keys(expected.contact) as Array<
    keyof ExpectedContact
  >;
  const matched = expectedContactKeys.filter((k) => {
    const e = expected.contact[k]?.toLowerCase().trim();
    const aRaw = (parsed.contact as Record<string, string | null>)[k];
    const a = aRaw?.toLowerCase().trim();
    return Boolean(e && a && a.includes(e));
  }).length;
  const denom = Math.max(expectedContactKeys.length, 1);
  const contactPrecision = matched / denom;
  const contactRecall = contactPrecision;

  // ── Experience / education count match ────────────────────────────────────
  const experienceMatch = parsed.experience.length === expected.experienceCount;
  const educationMatch = parsed.education.length === expected.educationCount;

  // ── Skills Jaccard ────────────────────────────────────────────────────────
  const skillsJaccard = jaccard(
    caseInsensitiveSet(parsed.skills.map((s) => s.name)),
    caseInsensitiveSet(expected.skills),
  );

  // ── Source-field coverage / hallucinations come from the parser itself ────
  const sourceFieldCoverage = result.sourceFieldCoverage;
  const hallucinationCount = result.sourceHallucinations.length;

  if (contactPrecision < 0.95) {
    failures.push(
      `contact precision ${(contactPrecision * 100).toFixed(0)}% < 95%`,
    );
  }
  if (contactRecall < 0.95) {
    failures.push(`contact recall ${(contactRecall * 100).toFixed(0)}% < 95%`);
  }
  if (!experienceMatch) {
    failures.push(
      `experience count ${parsed.experience.length}, expected ${expected.experienceCount}`,
    );
  }
  if (!educationMatch) {
    failures.push(
      `education count ${parsed.education.length}, expected ${expected.educationCount}`,
    );
  }
  if (skillsJaccard < 0.85) {
    failures.push(`skills jaccard ${skillsJaccard.toFixed(2)} < 0.85`);
  }
  if (sourceFieldCoverage < 0.9) {
    failures.push(`coverage ${(sourceFieldCoverage * 100).toFixed(0)}% < 90%`);
  }
  if (hallucinationCount > 0) {
    failures.push(`${hallucinationCount} hallucinations`);
  }

  const passed = failures.length === 0;

  return {
    fixture: fixtureName,
    contactPrecision,
    contactRecall,
    experienceMatch,
    educationMatch,
    skillsJaccard,
    sourceFieldCoverage,
    hallucinationCount,
    passed,
    failures,
  };
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.warn(
    "\n⚠️  This script makes BILLED OpenAI API calls and writes/deletes Supabase storage objects. Press Ctrl+C in 3s to abort.\n",
  );
  await new Promise((r) => setTimeout(r, 3000));

  let files: string[];
  try {
    files = (await readdir(FIXTURES_DIR)).filter(
      (f) => f.endsWith(".pdf") || f.endsWith(".docx"),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `Cannot read fixture directory at ${FIXTURES_DIR}: ${(err as Error).message}`,
    );
    process.exit(1);
  }

  if (files.length === 0) {
    // eslint-disable-next-line no-console
    console.log(
      `No fixtures found - drop .pdf/.docx files into ${FIXTURES_DIR}`,
    );
    return;
  }

  // Bootstrap a stand-alone Nest application context so we can resolve
  // ParseResumeService + StorageService through the real DI graph (with
  // OpenAIService, CacheService, ConfigService, etc. wired correctly).
  // Application context = no HTTP server, no port binding - exactly what we
  // want for a one-shot CLI script.
  const ctx = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
    abortOnError: false,
  });

  const parser = ctx.get(ParseResumeService);
  const storage = ctx.get(StorageService);

  const results: FixtureResult[] = [];

  try {
    for (const file of files) {
      const fixturePath = join(FIXTURES_DIR, file);
      const expectedPath = join(
        FIXTURES_DIR,
        file.replace(/\.(pdf|docx)$/, ".expected.json"),
      );
      let expected: ExpectedFixture;
      try {
        expected = JSON.parse(
          await readFile(expectedPath, "utf8"),
        ) as ExpectedFixture;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          `Missing or invalid expected.json for ${file} at ${expectedPath}: ${(err as Error).message}`,
        );
        process.exit(1);
        return;
      }

      const result = await evaluateFixture(
        parser,
        storage,
        fixturePath,
        file,
        expected,
      );
      results.push(result);
      // eslint-disable-next-line no-console
      console.log(
        `${result.passed ? "✓" : "✗"} ${file}  cov=${(result.sourceFieldCoverage * 100).toFixed(1)}%  hallucinations=${result.hallucinationCount}  jaccard=${result.skillsJaccard.toFixed(2)}`,
      );
      if (!result.passed) {
        // eslint-disable-next-line no-console
        result.failures.forEach((f) => console.log(`    ${f}`));
      }
    }
  } finally {
    await ctx.close();
  }

  // eslint-disable-next-line no-console
  console.log("\n=== AI PARSE CORPUS RESULTS ===");
  // eslint-disable-next-line no-console
  console.table(
    results.map((r) => ({
      fixture: r.fixture,
      contactPrecision: (r.contactPrecision * 100).toFixed(1) + "%",
      experienceMatch: r.experienceMatch,
      educationMatch: r.educationMatch,
      skillsJaccard: r.skillsJaccard.toFixed(2),
      sourceFieldCoverage: (r.sourceFieldCoverage * 100).toFixed(1) + "%",
      hallucinations: r.hallucinationCount,
      passed: r.passed,
    })),
  );

  const totalHallucinations = results.reduce(
    (s, r) => s + r.hallucinationCount,
    0,
  );
  const avgCoverage =
    results.reduce((s, r) => s + r.sourceFieldCoverage, 0) /
    Math.max(results.length, 1);
  const allPassed = results.every((r) => r.passed);

  // eslint-disable-next-line no-console
  console.log(
    `\nAvg source_field_coverage: ${(avgCoverage * 100).toFixed(1)}%`,
  );
  // eslint-disable-next-line no-console
  console.log(`Total hallucinations: ${totalHallucinations}`);

  if (totalHallucinations > 0) {
    // eslint-disable-next-line no-console
    console.error("\n❌ HARD FAIL: hallucination rate > 0%");
    process.exit(1);
  }
  if (avgCoverage < 0.9) {
    // eslint-disable-next-line no-console
    console.error("\n❌ HARD FAIL: avg source_field_coverage < 0.9");
    process.exit(1);
  }
  if (!allPassed) {
    // eslint-disable-next-line no-console
    console.error("\n❌ HARD FAIL: per-fixture thresholds not met");
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log("\n✅ ALL PASSED");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
