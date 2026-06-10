/**
 * Deterministic (regex-based) PII redaction for resume evidence excerpts.
 *
 * Runs server-side at WRITE time on every evidence excerpt before it is
 * returned to a recruiter. Strictly heuristic - over-redacts rather than
 * under-redacts. The full (unscrubbed) excerpt remains in
 * `evidence_excerpts.excerpt_text` for candidate and admin consumption;
 * this function populates `excerpt_redacted` for recruiter consumption.
 *
 * Scope:
 *   - emails:         `john@acme.io` → `[email]`
 *   - phones:         `+63 917 123 4567` → `[phone]`
 *   - URLs:           `linkedin.com/in/...` → `[link]`
 *   - company tokens: any `Word Inc|Corp|LLC|Ltd|GmbH|Co|Company` → `[company]`
 *   - personal names: 2-3 consecutive Capital-Cased tokens not on a safelist
 *                     → `[name]` (skips known job/tech terms)
 *
 * This is intentionally conservative - when in doubt, redact. Recruiters
 * still see the SKILL signal (technologies, job titles, durations) because
 * the safelist preserves the canonical skill vocabulary.
 *
 * NOTE: not a security boundary on its own. The real defense is that
 * the recruiter DTO transformer only returns `excerpt_redacted`. If this
 * heuristic misses something, the candidate's name (if mentioned in the
 * raw excerpt) might leak - which is precisely what we want to prevent.
 * Keep the safelist tight.
 */

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_RE =
  /(\+\d{1,3}[\s.-]?)?(\(?\d{1,4}\)?[\s.-]?)?\d{1,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}\b/g;
const URL_RE =
  /\b(?:https?:\/\/)?(?:www\.)?[A-Za-z0-9-]+\.[A-Za-z]{2,}(?:\/[^\s]*)?\b/g;
// "Acme Corp", "Globex Inc", "Wayne Enterprises LLC", "BCBSA Ltd", etc.
const COMPANY_SUFFIX_RE =
  /\b([A-Z][A-Za-z0-9&.]{1,30}(?:\s+[A-Z][A-Za-z0-9&.]{1,30}){0,3})\s+(Inc|Incorporated|Corp|Corporation|LLC|L\.L\.C\.|Ltd|Limited|GmbH|S\.A\.|S\.r\.l\.|Co|Company|PLC|N\.V\.|B\.V\.|Pte|Pty|AG|Holdings|Group|Enterprises|Industries|Solutions|Systems|Services|Technologies|Tech)\b/g;
// 2-3 Capital-Cased tokens in a row - heuristic for personal names
const NAME_RE = /\b([A-Z][a-z]{1,20})(\s+[A-Z][a-z]{1,20}){1,2}\b/g;

// Tokens we KEEP - skill / tech / role vocabulary that would otherwise be
// caught by the NAME_RE heuristic. Order matters only for grep clarity.
const SAFE_TOKENS = new Set<string>([
  // Languages
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "Kotlin",
  "Swift",
  "Ruby",
  "Rust",
  "Go",
  "Golang",
  "Scala",
  "Elixir",
  "Erlang",
  "Haskell",
  "Clojure",
  "Lua",
  "Perl",
  "PHP",
  "Dart",
  "Groovy",
  "Objective C",
  "Visual Basic",
  "Shell Script",
  // Frameworks / libraries
  "React",
  "React Native",
  "Vue",
  "Angular",
  "Svelte",
  "Next",
  "Next.js",
  "Nuxt",
  "Nuxt.js",
  "Solid",
  "Solid.js",
  "Remix",
  "Astro",
  "Gatsby",
  "Express",
  "Express.js",
  "Fastify",
  "Koa",
  "Nest",
  "NestJS",
  "Spring",
  "Spring Boot",
  "Django",
  "Flask",
  "FastAPI",
  "Rails",
  "Ruby on Rails",
  "Laravel",
  "Symfony",
  "ASP NET",
  "Dot NET",
  "Phoenix",
  // Data / cloud / infra
  "AWS",
  "GCP",
  "Azure",
  "Google Cloud",
  "Amazon Web Services",
  "Microsoft Azure",
  "Docker",
  "Kubernetes",
  "Terraform",
  "Ansible",
  "Jenkins",
  "GitHub Actions",
  "CircleCI",
  "Travis CI",
  "Bitbucket Pipelines",
  "GitLab CI",
  "Postgres",
  "PostgreSQL",
  "MySQL",
  "MariaDB",
  "SQLite",
  "Oracle DB",
  "Microsoft SQL Server",
  "Mongo",
  "MongoDB",
  "Cassandra",
  "DynamoDB",
  "Cosmos DB",
  "Redis",
  "Memcached",
  "Elasticsearch",
  "OpenSearch",
  "Solr",
  "Kafka",
  "RabbitMQ",
  "ActiveMQ",
  "Pulsar",
  "BigQuery",
  "Snowflake",
  "Redshift",
  "Databricks",
  "Spark",
  "Hadoop",
  "Hive",
  "Presto",
  "Trino",
  "Airflow",
  "Apache Beam",
  // ML
  "PyTorch",
  "TensorFlow",
  "Keras",
  "Scikit Learn",
  "Hugging Face",
  "LangChain",
  "OpenAI",
  "Anthropic",
  // Methodologies / roles (titles preserve skill signal)
  "Software Engineer",
  "Senior Engineer",
  "Staff Engineer",
  "Principal Engineer",
  "Engineering Manager",
  "Tech Lead",
  "Team Lead",
  "Solutions Architect",
  "DevOps Engineer",
  "Site Reliability Engineer",
  "Data Engineer",
  "Data Scientist",
  "Machine Learning Engineer",
  "Backend Engineer",
  "Frontend Engineer",
  "Full Stack Engineer",
  "Mobile Engineer",
  "Product Manager",
  "Project Manager",
  "Scrum Master",
  "QA Engineer",
  "Test Engineer",
  // Degrees
  "Bachelor",
  "Master",
  "Doctor",
  "Computer Science",
  "Information Technology",
  "Information Systems",
  "Software Engineering",
]);

function isSafeName(match: string): boolean {
  if (SAFE_TOKENS.has(match)) return true;
  // Multi-word forms too - case-insensitive lookup
  const tokens = match.split(/\s+/);
  for (let len = tokens.length; len > 0; len--) {
    for (let start = 0; start + len <= tokens.length; start++) {
      const candidate = tokens.slice(start, start + len).join(" ");
      if (SAFE_TOKENS.has(candidate)) return true;
    }
  }
  return false;
}

export function redactExcerptDeterministic(input: string): string {
  if (!input) return input;
  let out = input;
  out = out.replace(EMAIL_RE, "[email]");
  out = out.replace(URL_RE, "[link]");
  out = out.replace(PHONE_RE, (m) => {
    // Phones must contain at least 7 digits to avoid eating "2021"
    const digits = m.replace(/\D/g, "");
    return digits.length >= 7 ? "[phone]" : m;
  });
  out = out.replace(COMPANY_SUFFIX_RE, "[company]");
  out = out.replace(NAME_RE, (m) => (isSafeName(m) ? m : "[name]"));
  return out;
}

/**
 * Batch helper for use during evidence write paths and the backfill script.
 */
export function redactExcerptsBatch<T extends { excerptText: string }>(
  rows: readonly T[],
): Array<T & { excerptRedacted: string }> {
  return rows.map((row) => ({
    ...row,
    excerptRedacted: redactExcerptDeterministic(row.excerptText),
  }));
}
