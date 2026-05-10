# AI Parse Golden Corpus

Used by `pnpm --filter @aurahire/api test:ai-parse`. Each fixture is a pair:

- `<id>-<slug>.pdf` (or `.docx`) — the binary
- `<id>-<slug>.expected.json` — hand-annotated canonical extraction

## Per-fixture thresholds (assertions)

| Metric                       | Threshold     |
| ---------------------------- | ------------- |
| Contact precision            | >= 0.95       |
| Contact recall               | >= 0.95       |
| Experience count match       | exact         |
| Education count match        | exact         |
| Skills Jaccard               | >= 0.85       |
| Source-field coverage        | >= 0.90       |
| Source-string hallucinations | 0 (hard fail) |

## Corpus-wide thresholds

| Metric                    | Threshold           |
| ------------------------- | ------------------- |
| Avg source-field coverage | >= 0.90 (hard fail) |
| Total hallucinations      | 0 (hard fail)       |

## Running the corpus

```bash
# Required env: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# (plus anything else the AppModule expects to boot — DATABASE_URL, REDIS_URL, etc.)
# Note: this makes BILLED OpenAI calls — do not run in CI without budget.
pnpm --filter @aurahire/api test:ai-parse
```

The script:

1. Boots a stand-alone Nest application context (no HTTP server) so the real
   `ParseResumeService` resolves through DI with `OpenAIService`,
   `StorageService`, and `CacheService` wired correctly.
2. Uploads each fixture to a temporary `corpus-tests/<uuid>.<ext>` path in the
   `resumes` Supabase bucket.
3. Calls `parser.parse({ storagePath, mimeType })`.
4. Computes contact precision/recall, experience/education count match, skills
   Jaccard, and reads `sourceFieldCoverage` + `sourceHallucinations` from the
   parser's own coverage check.
5. Deletes the temp object.
6. Asserts thresholds; on any miss prints a CSV table and exits non-zero.

## Adding a new fixture

1. Drop the binary in this directory: `02-styled-docx.docx` (or whatever id-slug).
2. Author the matching `02-styled-docx.expected.json` by hand:
   - Walk through the resume manually.
   - Record `contact` fields exactly as the parser should extract them (after
     normalization). Only include the keys you want asserted — the script uses
     the keys present in `contact` as the precision/recall denominator.
   - Count experience/education entries.
   - List skills exactly as the canonical names (e.g. "TypeScript" not "ts").
3. Run `pnpm --filter @aurahire/api test:ai-parse` and iterate on the
   expected.json until the assertions pass.

The expected JSON shape:

```json
{
  "contact": {
    "full_name": "...",
    "phone": "...",
    "email": "...",
    "location_city": "...",
    "location_country": "..."
  },
  "experienceCount": 3,
  "educationCount": 1,
  "skills": ["TypeScript", "React", "..."]
}
```

## Contributing fixtures

Aim for 15+ fixtures across:

| Category       | Goal | Notes                                                                     |
| -------------- | ---- | ------------------------------------------------------------------------- |
| PDF clean      | 3    | Standard layouts, well-formatted                                          |
| PDF styled     | 3    | Multi-column, designed templates                                          |
| DOCX modern    | 2    | Recent Word exports                                                       |
| DOCX legacy    | 1    | Older `.doc`-style docx                                                   |
| Multilingual   | 1    | EN + Tagalog hybrid (representative of Philippine market)                 |
| Image-only PDF | 1    | Negative-path: should fall back gracefully (still pass with low coverage) |

The corpus is a thesis-defensible artifact — its size and diversity are a
quality signal in their own right.
