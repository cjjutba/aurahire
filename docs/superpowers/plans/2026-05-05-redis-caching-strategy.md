# Redis Caching Strategy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade two-layer caching system — a tagged Redis cache-aside layer in the NestJS backend (cuts OpenAI costs, DB load, and aggregate latency) and a TanStack-Query SSR-prefetch + hydration layer in the Next.js 16 frontend (eliminates the skeleton-on-refresh flash) — applied across the recruiter, candidate, and admin portals.

**Architecture:**
- **Backend (NestJS):** A new project-local `CacheModule` exports a typed `CacheService` with a `getOrSet<T>()` cache-aside primitive, tag-based invalidation (Redis SETs index keys per tag), in-process single-flight to prevent stampedes, fail-open behavior on Redis outage, and pino-logged hit/miss telemetry. The existing `@nestjs/cache-manager` + `@keyv/redis` global stays untouched (used elsewhere); `CacheService` owns its own `ioredis` client so it has the raw primitives needed for tag indexing and atomic operations.
- **Backend cache targets:** AI services (resume parse, profile score, match score, bias detect) keyed by `sha256(input)` with 24h TTL — biggest cost win. `scoring_config` cached 1h with bust-on-update. Recruiter dashboard aggregates (`recruiter-stats`, `recruiter-analytics`, `recent`) cached 60s with tag `dashboard:recruiter:{userId}` busted on application/job mutations. Jobs `listMine`/`getForRecruiter`/`listPublic`/`getPublic` cached 60s with tags `jobs:recruiter:{userId}` and `jobs:public` busted on create/update/publish/archive.
- **Frontend (Next.js):** Server Components prefetch via `prefetchQuery` against a typed `QueryClient`, dehydrate, and pass dehydrated state into a `<HydrationBoundary>` that wraps the page. Client components reading the same query key see filled cache on first render — no skeleton flash on refresh. A new `lib/query/` package centralizes query keys, query functions, and the server-side fetch helper. Mutations declare `invalidateKeys` so the client cache stays consistent.

**Tech Stack:**
- **Backend:** NestJS 10, ioredis 5 (already a dependency for throttle), pino logger, Drizzle ORM, `@aurahire/shared` Zod schemas. Cache TTLs declared as constants per domain.
- **Frontend:** Next.js 16 App Router (Server Components default), `@tanstack/react-query` v5 (`HydrationBoundary`, `dehydrate`, `prefetchQuery`), Supabase SSR for cookie-based auth, the auto-generated Orval API client at `packages/shared/src/api-client/generated.ts`.
- **Verification:** No automated test harness exists in this repo (no `*.spec.ts`, no `test` script per the prior plan). Verification per task = `pnpm tsc --noEmit` passes + `pnpm lint` passes + a manual smoke checklist the human runs after each phase.

**Hard rules from CLAUDE.md that govern this plan:**
- Claude does NOT run dev servers, Docker commands, DB mutations, or deploys. The human runs `pnpm dev` and verifies.
- Claude does NOT make billed external calls (OpenAI, Resend) for testing — leave AI cache warming to the human's manual smoke.
- `pnpm tsc --noEmit` and `pnpm lint` are the automated gates Claude runs.

---

## Spec Reference

Conversation context with the user (May 5, 2026):
1. User screenshot: navigating to `/recruiter/jobs` after refresh shows a long skeleton flash before data renders.
2. User noted Redis is already running in `docker-compose.dev.yml` and asked for a system-wide caching strategy.
3. Claude separated the two layers: skeleton-on-refresh is a frontend cache problem (React Query in-memory cache wipes on refresh); Redis is for backend latency/cost. Both worth doing.
4. Recommendation accepted: SSR-prefetch on the frontend + Redis cache-aside on the backend with content-hash AI caching as the biggest win.
5. User authorized full enterprise/production-ready implementation.

---

## File Structure

| Path | Role | Touch |
|---|---|---|
| `apps/api/src/cache/cache.module.ts` | New project-local cache module (registered global) | Create |
| `apps/api/src/cache/cache.service.ts` | `getOrSet`, `bustTag`, `bustKey`, single-flight, fail-open, telemetry | Create |
| `apps/api/src/cache/cache.constants.ts` | Cache namespace, TTL bands, tag templates | Create |
| `apps/api/src/cache/redis.provider.ts` | `IORedisProvider` factory; injectable `Redis` client | Create |
| `apps/api/src/cache/hash.util.ts` | `sha256OfStable(input)` for content-hash keys | Create |
| `apps/api/src/cache/index.ts` | Barrel export | Create |
| `apps/api/src/app.module.ts` | Import the new `CacheModule` (project-local; the keyv one stays) | Modify |
| `apps/api/src/ai/parse-resume.service.ts` | Wrap parse in `getOrSet` keyed by `sha256(rawText)` | Modify |
| `apps/api/src/ai/score-profile.service.ts` | Wrap score in `getOrSet` keyed by `sha256(redacted+weights+role+seniority)` | Modify |
| `apps/api/src/ai/score-match.service.ts` | Wrap score in `getOrSet` keyed by `sha256(redacted+job+weights)` | Modify |
| `apps/api/src/ai/detect-bias.service.ts` | Wrap detect in `getOrSet` keyed by `sha256(jdPlain)` | Modify |
| `apps/api/src/ai/ai.module.ts` | Re-export with `CacheModule` made available (it's global so no import needed) | No change expected |
| `apps/api/src/modules/admin/services/admin-config.service.ts` | Cache `getActive()` 1h with tag `scoring-config:active`; bust on update | Modify |
| `apps/api/src/modules/jobs/jobs.service.ts` | Replace ad-hoc `cache.get/set` with `cacheService.getOrSet` + tag bust on writes | Modify |
| `apps/api/src/modules/applications/applications.service.ts` | Cache recruiter-stats / recruiter-analytics / recent + tag bust on apply/status | Modify |
| `apps/web/lib/query/query-client.ts` | `makeQueryClient()` shared between server prefetch + client provider | Create |
| `apps/web/lib/query/keys.ts` | Centralized typed query-key factories (jobs, applications, dashboard, etc.) | Create |
| `apps/web/lib/query/server-fetch.ts` | `serverApiFetch<T>(path, init)` — Bearer-attaches Supabase session, used in Server Components | Create |
| `apps/web/lib/query/queries.ts` | Per-domain query functions (typed, used by both `prefetchQuery` and `useQuery`) | Create |
| `apps/web/lib/query/hydration.tsx` | `<PrefetchedHydration>` wrapper helper + `dehydratePrefetched` | Create |
| `apps/web/lib/query/index.ts` | Barrel export | Create |
| `apps/web/components/providers/query-provider.tsx` | Use shared `makeQueryClient()` from `lib/query` | Modify |
| `apps/web/app/(recruiter)/recruiter/page.tsx` | Switch from raw fetch to `prefetchQuery` + `<PrefetchedHydration>` | Modify |
| `apps/web/app/(recruiter)/recruiter/_dashboard-client.tsx` | Replace local fetch with `useQuery` reading prefetched key | Modify |
| `apps/web/app/(recruiter)/recruiter/jobs/page.tsx` | Switch to prefetch + hydrate; client list component reads via `useQuery` | Modify |
| `apps/web/app/(recruiter)/recruiter/jobs/_jobs-list-client.tsx` | New client component holding `useRecruiterJobsQuery` | Create |
| `apps/web/app/(recruiter)/recruiter/jobs/[id]/page.tsx` | Prefetch single job + applications | Modify |
| `apps/web/app/(recruiter)/recruiter/shortlist/page.tsx` | Prefetch shortlist | Modify |
| `apps/web/app/(recruiter)/recruiter/interviews/page.tsx` | Prefetch interviews | Modify |
| `apps/web/app/(candidate)/candidate/page.tsx` | Prefetch profile score + applications | Modify |
| `apps/web/app/(candidate)/candidate/jobs/page.tsx` | Prefetch candidate jobs list | Modify |
| `apps/web/app/(candidate)/candidate/jobs/[id]/page.tsx` | Prefetch single job | Modify |
| `apps/web/app/(candidate)/candidate/applications/page.tsx` | Prefetch applications | Modify |
| `apps/web/app/(candidate)/candidate/interviews/page.tsx` | Prefetch interviews | Modify |
| `apps/web/hooks/use-recruiter-jobs.ts` | `useRecruiterJobsQuery(params)` — used by client list + filter | Create |
| `apps/web/hooks/use-candidate-jobs.ts` | `useCandidateJobsQuery(params)` | Create |
| `apps/web/hooks/use-applications.ts` | `useMyApplicationsQuery`, `useRecruiterRecentApplicationsQuery` | Create |
| `apps/web/hooks/use-dashboard.ts` | `useRecruiterStatsQuery`, `useRecruiterAnalyticsQuery` | Create |
| `apps/web/hooks/use-interviews.ts` | `useMyInterviewsQuery`, `useRecruiterInterviewsQuery` | Create |
| `apps/web/hooks/use-shortlist.ts` | `useShortlistQuery` | Create |
| `apps/web/hooks/use-profile-score.ts` | `useProfileScoreQuery` | Create |
| `docs/main/caching-strategy.md` | Long-term reference doc (TTL bands, tag conventions, invalidation matrix) | Create |

---

## Phase A — Backend Cache Foundation

Builds the `CacheService` and its Redis provider. Phase A delivers a usable caching primitive but doesn't change any feature behavior yet.

---

## Task 1: Hash utility for content-hash cache keys

Stable JSON serialization + sha256 → used by every AI cache key. Stable means object key order doesn't change the hash.

**Files:**
- Create: `apps/api/src/cache/hash.util.ts`

### Steps

- [ ] **Step 1: Create the hash utility**

Create `apps/api/src/cache/hash.util.ts`:

```ts
import { createHash } from "node:crypto";

/**
 * Stable JSON stringify — sorts object keys recursively so two structurally-
 * equal objects with different insertion order produce identical strings.
 *
 * Preserves array order (arrays are positional). Treats `undefined` properties
 * as absent (matches JSON.stringify semantics).
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** Returns the lowercase hex sha256 of a stable JSON serialization of `input`. */
export function sha256OfStable(input: unknown): string {
  return createHash("sha256").update(stableStringify(input)).digest("hex");
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: passes (no new errors).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/cache/hash.util.ts
git commit -m "feat(api/cache): add sha256OfStable hash utility for content-hash cache keys"
```

---

## Task 2: Cache constants and ioredis provider

The constants file declares TTL bands, the namespace prefix, and tag templates so every caller uses the same conventions. The provider wraps ioredis as an injectable.

**Files:**
- Create: `apps/api/src/cache/cache.constants.ts`
- Create: `apps/api/src/cache/redis.provider.ts`

### Steps

- [ ] **Step 1: Create the constants file**

Create `apps/api/src/cache/cache.constants.ts`:

```ts
/**
 * Cache namespace prefix — every key written by CacheService starts with this.
 * Bumping the version invalidates the entire cache namespace at once
 * (useful when serialized DTO shapes change in a way that would break
 * deserialization of stale entries).
 */
export const CACHE_NAMESPACE = "ah:v1" as const;

/** TTL bands. Use seconds — ioredis SET EX takes seconds. */
export const TTL_SECONDS = {
  /** Hot aggregates that change with every write — recruiter stats, recent apps. */
  hot: 60,
  /** Warm reads — list pages, single-entity reads. */
  warm: 5 * 60,
  /** Slow-changing config — scoring_config, system flags. */
  cool: 60 * 60,
  /** AI outputs keyed by content hash — same input → same output, very long TTL. */
  ai: 24 * 60 * 60,
} as const;

/**
 * Tag templates — call with the dynamic id to materialize the tag string.
 * One key may be tagged with multiple tags; bustTag removes every key that
 * carries that tag.
 */
export const TAGS = {
  scoringConfigActive: () => "scoring-config:active",
  jobsPublic: () => "jobs:public",
  jobsRecruiter: (recruiterId: string) => `jobs:recruiter:${recruiterId}`,
  jobDetail: (jobId: string) => `job:${jobId}`,
  dashboardRecruiter: (recruiterId: string) => `dashboard:recruiter:${recruiterId}`,
  applicationsRecruiter: (recruiterId: string) =>
    `applications:recruiter:${recruiterId}`,
  applicationsCandidate: (candidateId: string) =>
    `applications:candidate:${candidateId}`,
  interviewsRecruiter: (recruiterId: string) =>
    `interviews:recruiter:${recruiterId}`,
  interviewsCandidate: (candidateId: string) =>
    `interviews:candidate:${candidateId}`,
  shortlistRecruiter: (recruiterId: string) => `shortlist:recruiter:${recruiterId}`,
  profileScore: (userId: string) => `profile-score:${userId}`,
} as const;

/** Injection token for the ioredis client owned by CacheModule. */
export const CACHE_REDIS = Symbol("CACHE_REDIS");
```

- [ ] **Step 2: Create the Redis provider**

Create `apps/api/src/cache/redis.provider.ts`:

```ts
import type { FactoryProvider } from "@nestjs/common";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

import { CACHE_REDIS } from "./cache.constants";

/**
 * Factory provider for the ioredis client that backs CacheService.
 *
 * Connection strategy:
 * - Lazy connect: ioredis connects on first command, so an outage at boot
 *   doesn't crash the API.
 * - retryStrategy: exponential backoff capped at 2s; never gives up — the
 *   client keeps reconnecting in the background.
 * - maxRetriesPerRequest: 1 — fail fast on individual commands so a
 *   wedged Redis doesn't pile up unbounded promises (CacheService catches
 *   the error and falls back to the data source).
 */
export const IORedisProvider: FactoryProvider<Redis> = {
  provide: CACHE_REDIS,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Redis => {
    const url = config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
    const logger = new Logger("CacheRedis");
    const client = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(50 * 2 ** Math.min(times, 6), 2000),
    });
    client.on("connect", () => logger.log(`Connected to Redis at ${url}`));
    client.on("error", (err) =>
      // Logged at warn level: CacheService handles errors per-call; this only
      // surfaces unexpected issues for ops visibility.
      logger.warn(`Redis error: ${err.message}`),
    );
    return client;
  },
};
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/cache/cache.constants.ts apps/api/src/cache/redis.provider.ts
git commit -m "feat(api/cache): add cache constants (TTL bands, tag templates) and ioredis provider"
```

---

## Task 3: CacheService — getOrSet, tag invalidation, single-flight, fail-open

The core. Cache-aside pattern with stampede protection and graceful Redis-down behavior.

**Files:**
- Create: `apps/api/src/cache/cache.service.ts`

### Steps

- [ ] **Step 1: Implement CacheService**

Create `apps/api/src/cache/cache.service.ts`:

```ts
import { Inject, Injectable, Logger } from "@nestjs/common";
import type Redis from "ioredis";

import { CACHE_NAMESPACE, CACHE_REDIS } from "./cache.constants";

export interface CacheGetOrSetOptions {
  /** Cache key (without namespace prefix). */
  key: string;
  /** TTL in seconds. */
  ttlSeconds: number;
  /** Tags this entry belongs to. Bust by tag invalidates every entry that carries it. */
  tags?: string[];
  /** Loader called on miss. Result is stored as-is (must be JSON-serializable). */
  load: () => Promise<unknown>;
  /**
   * Optional: skip cache (read-through but never store). Useful for inspection
   * routes that want fresh data but don't want to pollute or evict the cache.
   */
  bypass?: boolean;
  /** Tag for telemetry log lines — defaults to the first tag or "untagged". */
  telemetryName?: string;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  /** In-process single-flight map: dedupes concurrent loads for the same key. */
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(@Inject(CACHE_REDIS) private readonly redis: Redis) {}

  // -------------------------------------------------------- public API

  /**
   * Cache-aside read with single-flight protection and fail-open behavior.
   *
   * Flow:
   *   1. If `bypass`, call loader and return without touching cache.
   *   2. Try GET from Redis. On hit, return parsed value.
   *   3. On miss, dedupe via in-process inflight map (so 100 concurrent
   *      requests don't all stampede the loader).
   *   4. Run loader; SET with TTL; index every tag → key in tag SETs.
   *   5. On any Redis error, log at warn and fall through to the loader.
   */
  async getOrSet<T>(opts: CacheGetOrSetOptions): Promise<T> {
    const fullKey = this.namespaced(opts.key);
    const tName = opts.telemetryName ?? opts.tags?.[0] ?? "untagged";

    if (opts.bypass) {
      this.logger.debug(`[${tName}] bypass key=${opts.key}`);
      return (await opts.load()) as T;
    }

    // 1. Try cache
    const cached = await this.safeGet(fullKey);
    if (cached !== null) {
      this.logger.debug(`[${tName}] HIT key=${opts.key}`);
      return cached as T;
    }
    this.logger.debug(`[${tName}] MISS key=${opts.key}`);

    // 2. Single-flight: if another request is already loading this key, await it.
    const existing = this.inflight.get(fullKey);
    if (existing) {
      this.logger.debug(`[${tName}] COALESCE key=${opts.key}`);
      return (await existing) as T;
    }

    const loadPromise = (async () => {
      const value = await opts.load();
      // 3. Store + index tags. Failures here MUST NOT propagate — we have the
      // value, the cache write is a side benefit.
      await this.safeSet(fullKey, value, opts.ttlSeconds, opts.tags ?? []);
      return value;
    })();
    this.inflight.set(fullKey, loadPromise);
    try {
      return (await loadPromise) as T;
    } finally {
      this.inflight.delete(fullKey);
    }
  }

  /**
   * Invalidate every key that carries the given tag.
   *
   * Tag → keys is stored as a Redis SET at key `{ns}:tag:{tag}`. We SMEMBERS
   * to enumerate, DEL each value key, then DEL the tag set itself.
   */
  async bustTag(tag: string): Promise<number> {
    const tagKey = this.tagKey(tag);
    try {
      const members = await this.redis.smembers(tagKey);
      if (members.length === 0) {
        await this.redis.del(tagKey);
        return 0;
      }
      // Pipeline: DEL all member keys + DEL the tag set itself in one round trip.
      const pipe = this.redis.pipeline();
      for (const member of members) pipe.del(member);
      pipe.del(tagKey);
      await pipe.exec();
      this.logger.debug(`bustTag tag=${tag} count=${members.length}`);
      return members.length;
    } catch (err) {
      this.logger.warn(
        `bustTag tag=${tag} failed: ${(err as Error).message} (cache continues serving stale until TTL)`,
      );
      return 0;
    }
  }

  /** Bust multiple tags. Returns total keys evicted. */
  async bustTags(tags: string[]): Promise<number> {
    let total = 0;
    for (const tag of tags) total += await this.bustTag(tag);
    return total;
  }

  /** Bust a specific key (no tag bookkeeping cleanup beyond the key itself). */
  async bustKey(key: string): Promise<void> {
    try {
      await this.redis.del(this.namespaced(key));
    } catch (err) {
      this.logger.warn(`bustKey key=${key} failed: ${(err as Error).message}`);
    }
  }

  // -------------------------------------------------------- internals

  private namespaced(key: string): string {
    return `${CACHE_NAMESPACE}:${key}`;
  }

  private tagKey(tag: string): string {
    return `${CACHE_NAMESPACE}:tag:${tag}`;
  }

  private async safeGet(fullKey: string): Promise<unknown> {
    try {
      const raw = await this.redis.get(fullKey);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (err) {
      // Treat any failure as a miss. The caller will run the loader.
      this.logger.warn(
        `cache GET failed key=${fullKey} (${(err as Error).message}); treating as miss`,
      );
      return null;
    }
  }

  private async safeSet(
    fullKey: string,
    value: unknown,
    ttlSeconds: number,
    tags: string[],
  ): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const pipe = this.redis.pipeline();
      pipe.set(fullKey, serialized, "EX", ttlSeconds);
      for (const tag of tags) {
        const tagKey = this.tagKey(tag);
        pipe.sadd(tagKey, fullKey);
        // Tag sets get a slightly longer TTL than the entries they index, so
        // a stale tag set still resolves to a no-op DEL after entries expire.
        pipe.expire(tagKey, ttlSeconds + 60);
      }
      await pipe.exec();
    } catch (err) {
      this.logger.warn(
        `cache SET failed key=${fullKey} (${(err as Error).message}); value returned without caching`,
      );
    }
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/cache/cache.service.ts
git commit -m "feat(api/cache): add CacheService with cache-aside, tags, single-flight, fail-open"
```

---

## Task 4: CacheModule and global registration

**Files:**
- Create: `apps/api/src/cache/cache.module.ts`
- Create: `apps/api/src/cache/index.ts`
- Modify: `apps/api/src/app.module.ts`

### Steps

- [ ] **Step 1: Create the module**

Create `apps/api/src/cache/cache.module.ts`:

```ts
import { Global, Module } from "@nestjs/common";

import { CacheService } from "./cache.service";
import { IORedisProvider } from "./redis.provider";

/**
 * Project-local cache module. Distinct from `@nestjs/cache-manager` (which is
 * also registered globally and used elsewhere) — this one owns its own
 * ioredis client so it can do tag indexing and atomic operations the
 * cache-manager abstraction doesn't expose.
 *
 * Marked @Global so feature modules don't need to import it.
 */
@Global()
@Module({
  providers: [IORedisProvider, CacheService],
  exports: [CacheService],
})
export class CacheModule {}
```

- [ ] **Step 2: Barrel export**

Create `apps/api/src/cache/index.ts`:

```ts
export { CacheModule } from "./cache.module";
export { CacheService } from "./cache.service";
export { CACHE_NAMESPACE, TTL_SECONDS, TAGS } from "./cache.constants";
export { sha256OfStable } from "./hash.util";
```

- [ ] **Step 3: Register CacheModule in AppModule**

Open `apps/api/src/app.module.ts`. Add an import at the top alongside the other module imports:

```ts
import { CacheModule as AppCacheModule } from "./cache";
```

Then in the `imports: [...]` array of the `@Module({...})`, add `AppCacheModule` immediately after the `CacheModule.registerAsync(...)` block (so it sits next to the other cache wiring):

```ts
    CacheModule.registerAsync({
      // ... existing keyv/redis cache-manager registration stays unchanged ...
    }),
    AppCacheModule, // <-- ADD THIS LINE (project-local CacheService)
    ThrottlerModule.forRootAsync({
```

The local `CacheModule` is renamed `AppCacheModule` on import to avoid shadowing the `@nestjs/cache-manager` `CacheModule` already imported at the top of the file.

- [ ] **Step 4: Verify it compiles**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/cache/cache.module.ts apps/api/src/cache/index.ts apps/api/src/app.module.ts
git commit -m "feat(api/cache): register CacheModule globally"
```

---

## Phase B — Apply Backend Caching

Apply `CacheService` to the highest-leverage targets. Order: scoring_config (cheap and clear), AI services (biggest cost win), jobs (highest-frequency reads), dashboard aggregates.

---

## Task 5: Cache scoring_config (admin)

`scoring_config.getActive()` is read by every scoring call. Changes are admin-only and rare → 1h TTL with tag bust on update.

**Files:**
- Modify: `apps/api/src/modules/admin/services/admin-config.service.ts`

### Steps

- [ ] **Step 1: Read the current service**

Run: `cat apps/api/src/modules/admin/services/admin-config.service.ts`

Expect it to expose `getActive()` and `update(...)` methods. The exact field names and DTO shape come from the file — do not invent. If `getActive` is named `getActiveConfig` or similar, use whatever name exists.

- [ ] **Step 2: Wrap `getActive` with cache + add tag bust on `update`**

Open `apps/api/src/modules/admin/services/admin-config.service.ts`. Add the imports at the top alongside existing imports:

```ts
import { CacheService, TTL_SECONDS, TAGS } from "../../../cache";
```

Inject `CacheService` in the constructor (add to the existing parameter list — preserve all existing dependencies):

```ts
constructor(
  // ... existing dependencies (likely AdminConfigRepository, AuditService) ...
  private readonly cacheService: CacheService,
) {}
```

Wrap the read method. The exact method body depends on what's there — find the method that returns the active config (call it `getActive` here; rename if the codebase uses a different name) and replace its body:

```ts
async getActive(): Promise<ScoringConfigDto> {
  return this.cacheService.getOrSet<ScoringConfigDto>({
    key: "scoring-config:active",
    ttlSeconds: TTL_SECONDS.cool, // 1 hour
    tags: [TAGS.scoringConfigActive()],
    telemetryName: "scoring-config",
    load: async () => {
      // <-- the original body of getActive() goes here, unchanged -->
    },
  });
}
```

Then in the `update` method (or whatever method writes the config), append a tag bust after the DB write succeeds and before/after the audit log call:

```ts
await this.cacheService.bustTag(TAGS.scoringConfigActive());
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/admin/services/admin-config.service.ts
git commit -m "feat(api/admin): cache scoring_config.getActive (1h TTL, bust on update)"
```

---

## Task 6: Cache AI resume parsing

Resume parsing by raw text → same input always produces same parsed output. 24h TTL, content-hash key. No tags — content-keyed entries naturally invalidate when the input changes.

**Files:**
- Modify: `apps/api/src/ai/parse-resume.service.ts`

### Steps

- [ ] **Step 1: Read the current service**

Run: `cat apps/api/src/ai/parse-resume.service.ts`

Identify the public method that takes raw resume text and returns a `ParsedResume`. (Likely named `parse` or `parseResume`.) Note its exact signature.

- [ ] **Step 2: Wrap with cache**

Open `apps/api/src/ai/parse-resume.service.ts`. Add these imports alongside existing imports:

```ts
import { CacheService, TTL_SECONDS, sha256OfStable } from "../cache";
```

Add `CacheService` to the constructor parameter list (preserve all existing dependencies):

```ts
constructor(
  private readonly openai: OpenAIService,
  private readonly cacheService: CacheService,
) {}
```

Wrap the public parse method. Assuming the method is `async parse(input: ParseResumeInput): Promise<ParseResumeOutput>`, transform its body so the AI call only runs on cache miss:

```ts
async parse(input: ParseResumeInput): Promise<ParseResumeOutput> {
  const inputHash = sha256OfStable({
    rawText: input.rawText, // adjust to the actual input field name
    promptVersion: PARSE_RESUME_VERSION, // pull from the prompts file already imported
  });
  return this.cacheService.getOrSet<ParseResumeOutput>({
    key: `ai:parse-resume:${inputHash}`,
    ttlSeconds: TTL_SECONDS.ai, // 24h
    telemetryName: "ai:parse-resume",
    load: async () => {
      // <-- the original body of parse(input) goes here, unchanged -->
    },
  });
}
```

Replace the field names (`input.rawText`, `PARSE_RESUME_VERSION`) with whatever the file actually uses. The hash inputs MUST include every variable that affects the AI call's output: the input text, the prompt version, and the model if it varies.

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ai/parse-resume.service.ts
git commit -m "feat(api/ai): cache parse-resume by content hash (24h TTL)"
```

---

## Task 7: Cache AI profile scoring

Profile score depends on redacted resume content + active scoring weights + role/seniority. Hash all of those.

**Files:**
- Modify: `apps/api/src/ai/score-profile.service.ts`

### Steps

- [ ] **Step 1: Read the current service**

Run: `cat apps/api/src/ai/score-profile.service.ts`

Identify the public score method, its input shape, and the prompt-version constant.

- [ ] **Step 2: Wrap with cache**

Open `apps/api/src/ai/score-profile.service.ts`. Add imports:

```ts
import { CacheService, TTL_SECONDS, sha256OfStable } from "../cache";
```

Add `CacheService` to the constructor parameter list (preserve existing deps like `OpenAIService` and `RedactPiiService`).

Wrap the public score method. The redacted resume goes into the hash, not the original — so we redact first, then hash, then check cache:

```ts
async score(input: ScoreProfileInput): Promise<ScoreProfileOutput> {
  const reqId = input.requestId ?? "score-profile";
  const { redacted, redactedFields } = await this.redact.redactResume(
    input.parsedResume,
    reqId,
  );

  const cacheInputHash = sha256OfStable({
    redacted,
    weights: input.weights,
    role: input.role ?? null,
    seniority: input.seniority ?? null,
    promptVersion: SCORE_PROFILE_VERSION,
  });

  return this.cacheService.getOrSet<ScoreProfileOutput>({
    key: `ai:score-profile:${cacheInputHash}`,
    ttlSeconds: TTL_SECONDS.ai,
    telemetryName: "ai:score-profile",
    load: async () => {
      // <-- everything from `const userPrompt = ...` through the existing
      //     `return { score, redactedFields, latencyMs, model, promptVersion }` -->
      //
      // BUT: pass `redactedFields` from the outer scope into the loader (it's
      // already in scope since the redact call was hoisted). The loader's
      // `return` continues to include redactedFields just as before.
    },
  });
}
```

Move the redact call ABOVE the cache check so the redacted content is what gets hashed (deterministic; PII redaction is itself deterministic). Update the field names (`input.role`, `input.seniority`) to match the actual input shape.

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ai/score-profile.service.ts
git commit -m "feat(api/ai): cache score-profile by content hash (24h TTL)"
```

---

## Task 8: Cache AI match scoring

Same pattern as profile scoring. Hash includes redacted resume + job fields + weights + prompt version.

**Files:**
- Modify: `apps/api/src/ai/score-match.service.ts`

### Steps

- [ ] **Step 1: Modify score-match.service.ts**

Open `apps/api/src/ai/score-match.service.ts`. Add imports:

```ts
import { CacheService, TTL_SECONDS, sha256OfStable } from "../cache";
```

Add `CacheService` to the constructor:

```ts
constructor(
  private readonly openai: OpenAIService,
  private readonly redact: RedactPiiService,
  private readonly cacheService: CacheService,
) {}
```

Replace the existing `score(input)` body. The current implementation (read at plan-time) redacts, builds prompt, calls `openai.generateStructured`, returns the result. Wrap the part after redaction in `getOrSet`:

```ts
async score(input: ScoreMatchInput): Promise<ScoreMatchOutput> {
  const reqId = input.requestId ?? "score-match";

  const { redacted, redactedFields } = await this.redact.redactResume(
    input.parsedResume,
    reqId,
  );
  this.logger.log(
    `[${reqId}] redacted ${redactedFields.length} fields before match scoring`,
  );

  const cacheInputHash = sha256OfStable({
    redacted,
    job: {
      title: input.job.title,
      department: input.job.department,
      experienceLevel: input.job.experienceLevel,
      educationRequirement: input.job.educationRequirement,
      requiredSkills: input.job.requiredSkills,
      descriptionPlain: input.job.descriptionPlain,
    },
    weights: input.weights,
    promptVersion: SCORE_MATCH_VERSION,
  });

  return this.cacheService.getOrSet<ScoreMatchOutput>({
    key: `ai:score-match:${cacheInputHash}`,
    ttlSeconds: TTL_SECONDS.ai,
    telemetryName: "ai:score-match",
    load: async () => {
      const userPrompt = buildScoreMatchUserPrompt({
        jobTitle: input.job.title,
        jobDepartment: input.job.department,
        jobExperienceLevel: input.job.experienceLevel,
        jobEducationRequirement: input.job.educationRequirement,
        jobRequiredSkills: input.job.requiredSkills,
        jobDescriptionPlain: input.job.descriptionPlain,
        redactedResumeJson: JSON.stringify(redacted, null, 2),
        weights: input.weights,
      });

      const result = await this.openai.generateStructured({
        schema: matchScoreSchema,
        schemaName: "MatchScore",
        systemPrompt: SCORE_MATCH_SYSTEM_PROMPT,
        userPrompt,
        requestId: `${reqId}:match-v${SCORE_MATCH_VERSION}`,
      });

      return {
        score: result.data,
        redactedFields,
        latencyMs: result.latencyMs,
        model: result.model,
        promptVersion: SCORE_MATCH_VERSION,
      };
    },
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/ai/score-match.service.ts
git commit -m "feat(api/ai): cache score-match by content hash (24h TTL)"
```

---

## Task 9: Cache AI bias detection

Bias detection on a job description: `sha256(jdPlain + promptVersion)`.

**Files:**
- Modify: `apps/api/src/ai/detect-bias.service.ts`

### Steps

- [ ] **Step 1: Read the current service**

Run: `cat apps/api/src/ai/detect-bias.service.ts`

Note the public detect method's name and signature, and the version constant.

- [ ] **Step 2: Wrap with cache**

Open the file. Add imports:

```ts
import { CacheService, TTL_SECONDS, sha256OfStable } from "../cache";
```

Add `CacheService` to constructor. Wrap the public method (assume it's `detect(input)` — adjust to actual name):

```ts
async detect(input: DetectBiasInput): Promise<DetectBiasOutput> {
  const cacheInputHash = sha256OfStable({
    jdPlain: input.jobDescriptionPlain, // or whatever field carries the JD plain text
    customFlaggedTerms: input.customFlaggedTerms ?? [],
    promptVersion: DETECT_BIAS_VERSION,
  });

  return this.cacheService.getOrSet<DetectBiasOutput>({
    key: `ai:detect-bias:${cacheInputHash}`,
    ttlSeconds: TTL_SECONDS.ai,
    telemetryName: "ai:detect-bias",
    load: async () => {
      // <-- existing detect body unchanged -->
    },
  });
}
```

Replace `input.jobDescriptionPlain` and the optional flagged-terms field with the actual input shape from the read.

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ai/detect-bias.service.ts
git commit -m "feat(api/ai): cache detect-bias by content hash (24h TTL)"
```

---

## Task 10: Migrate jobs.service to tagged cache + bust on writes

The current jobs service uses `@nestjs/cache-manager`'s `Cache` with TTL-only eviction (the `invalidatePublicCache()` method is a no-op TODO). Switch to `CacheService` so writes can do exact tag-based invalidation, eliminating the 60s staleness window after publish/update.

**Files:**
- Modify: `apps/api/src/modules/jobs/jobs.service.ts`

### Steps

- [ ] **Step 1: Replace cache-manager with CacheService**

Open `apps/api/src/modules/jobs/jobs.service.ts`. Remove these imports:

```ts
// REMOVE:
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
```

Add:

```ts
import { CacheService, TTL_SECONDS, TAGS } from "../../cache";
```

Update the constructor parameter list — replace the `@Inject(CACHE_MANAGER) cache: Cache` parameter with:

```ts
private readonly cacheService: CacheService,
```

Remove the `PUBLIC_CACHE_TTL_MS = 60_000;` constant at the top of the file.

- [ ] **Step 2: Rewrite `listPublic`**

Replace the body of `listPublic`:

```ts
async listPublic(query: ListJobsQueryDto): Promise<{
  data: JobResponseDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const cacheKey = `jobs:public:list:${this.serializeQuery(query)}`;
  return this.cacheService.getOrSet({
    key: cacheKey,
    ttlSeconds: TTL_SECONDS.hot,
    tags: [TAGS.jobsPublic()],
    telemetryName: "jobs:public:list",
    load: async () => {
      const filters: ListJobsFilters = {
        q: query.q,
        mode: query.mode,
        experienceLevel: query.experienceLevel,
        locationCountry: query.locationCountry,
        status: "published",
        sort: query.sort === "recent-activity" ? "recent" : query.sort,
        page: query.page,
        limit: query.limit,
      };
      const { rows, total } = await this.repo.list(filters);
      return {
        data: rows.map((r) => this.toResponse(r)),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
      };
    },
  });
}
```

- [ ] **Step 3: Rewrite `getPublic`**

```ts
async getPublic(id: string): Promise<JobResponseDto> {
  return this.cacheService.getOrSet<JobResponseDto>({
    key: `jobs:public:detail:${id}`,
    ttlSeconds: TTL_SECONDS.hot,
    tags: [TAGS.jobsPublic(), TAGS.jobDetail(id)],
    telemetryName: "jobs:public:detail",
    load: async () => {
      const row = await this.repo.findByIdWithCompany(id);
      if (!row || row.status !== "published") {
        throw new NotFoundException({ code: "NOT_FOUND", message: "Job not found" });
      }
      return this.toResponse(row);
    },
  });
}
```

- [ ] **Step 4: Add `listMine` caching**

The current `listMine` has no caching. Wrap both branches (with-stats and without-stats) under one cache key. Replace the existing `listMine` body:

```ts
async listMine(user: AuthUser, query: ListJobsQueryDto): Promise<{
  data: JobResponseDto[] | (JobResponseDto & { stats: JobStats })[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  if (user.role !== "recruiter") {
    throw new ForbiddenException({ code: "FORBIDDEN", message: "Recruiter role required" });
  }

  const cacheKey = `jobs:recruiter:${user.id}:list:${this.serializeQuery(query)}:inc=${query.include ?? "none"}`;

  return this.cacheService.getOrSet({
    key: cacheKey,
    ttlSeconds: TTL_SECONDS.hot,
    tags: [TAGS.jobsRecruiter(user.id)],
    telemetryName: "jobs:recruiter:list",
    load: async () => {
      if (query.include === "stats") {
        const sort: "recent" | "recent-activity" =
          query.sort === "recent-activity" ? "recent-activity" : "recent";
        const { rows, total } = await this.repo.listMineWithStats(user.id, {
          page: query.page,
          limit: query.limit,
          status: query.status,
          sort,
        });
        return {
          data: rows.map((r) => ({ ...this.toResponse(r), stats: r.stats })),
          meta: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
          },
        };
      }
      const filters: ListJobsFilters = {
        q: query.q,
        mode: query.mode,
        experienceLevel: query.experienceLevel,
        locationCountry: query.locationCountry,
        sort: query.sort === "recent-activity" ? "recent" : query.sort,
        page: query.page,
        limit: query.limit,
        recruiterId: user.id,
        status: query.status,
      };
      const { rows, total } = await this.repo.list(filters);
      return {
        data: rows.map((r) => this.toResponse(r)),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
      };
    },
  });
}
```

- [ ] **Step 5: Replace `invalidatePublicCache` with tag bust**

Replace the entire `invalidatePublicCache` private method:

```ts
private async invalidateAfterWrite(opts: { recruiterId: string; jobId?: string }): Promise<void> {
  const tags: string[] = [TAGS.jobsPublic(), TAGS.jobsRecruiter(opts.recruiterId)];
  if (opts.jobId) tags.push(TAGS.jobDetail(opts.jobId));
  await this.cacheService.bustTags(tags);
}
```

Find every call site of `await this.invalidatePublicCache();` (in `create`, `update`, `publish`, `archive`) and replace with:

```ts
await this.invalidateAfterWrite({ recruiterId: user.id, jobId: id }); // for update/publish/archive
await this.invalidateAfterWrite({ recruiterId: user.id, jobId: job.id }); // for create — uses freshly-inserted job.id
```

- [ ] **Step 6: Verify it compiles**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: passes. The unused `CACHE_MANAGER` / `Cache` imports are gone; the unused `PUBLIC_CACHE_TTL_MS` constant is gone.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/jobs/jobs.service.ts
git commit -m "feat(api/jobs): replace ad-hoc cache with tagged CacheService + bust on writes"
```

---

## Task 11: Cache recruiter dashboard aggregates + applications list

The recruiter dashboard pulls three endpoints concurrently. All three benefit from caching with the same tag (`dashboard:recruiter:{userId}`) so they bust together on application/job mutations.

**Files:**
- Modify: `apps/api/src/modules/applications/applications.service.ts`

### Steps

- [ ] **Step 1: Read the current service**

Run: `cat apps/api/src/modules/applications/applications.service.ts | head -80`

Identify the methods that serve `GET /recruiter-stats`, `GET /recruiter-analytics`, `GET /recent`, and the apply / status-update mutation methods. (Names from the prior plan: `recruiterStats(user, range)`, `recruiterAnalytics(user)`, `recentForRecruiter(user, limit)`, plus `apply(...)` and `updateStatus(...)`.)

- [ ] **Step 2: Add CacheService and wrap reads**

Open `apps/api/src/modules/applications/applications.service.ts`. Add imports:

```ts
import { CacheService, TTL_SECONDS, TAGS } from "../../cache";
```

Add `CacheService` to constructor (preserve existing dependencies).

Wrap each of the three read methods. Pattern (apply to all three; vary key/tag per method):

```ts
async recruiterStats(user: AuthUser, range: RecruiterStatsRange): Promise<RecruiterStatsDto> {
  if (user.role !== "recruiter") {
    throw new ForbiddenException({ code: "FORBIDDEN", message: "Recruiter role required" });
  }
  return this.cacheService.getOrSet<RecruiterStatsDto>({
    key: `dashboard:recruiter:${user.id}:stats:${range}`,
    ttlSeconds: TTL_SECONDS.hot,
    tags: [TAGS.dashboardRecruiter(user.id)],
    telemetryName: "dashboard:recruiter:stats",
    load: async () => {
      // <-- existing recruiterStats body unchanged -->
    },
  });
}
```

Apply the same wrapper to `recruiterAnalytics` (key `dashboard:recruiter:${user.id}:analytics`) and `recentForRecruiter` (key `dashboard:recruiter:${user.id}:recent:${limit}`). Both carry tag `TAGS.dashboardRecruiter(user.id)`.

For the candidate's own applications list (`GET /applications/mine`), wrap with tag `applicationsCandidate(user.id)`:

```ts
async listMine(user: AuthUser, query: ListApplicationsQueryDto): Promise<...> {
  return this.cacheService.getOrSet({
    key: `applications:candidate:${user.id}:list:${serializeQuery(query)}`,
    ttlSeconds: TTL_SECONDS.hot,
    tags: [TAGS.applicationsCandidate(user.id)],
    telemetryName: "applications:candidate:list",
    load: async () => {
      // <-- existing listMine body -->
    },
  });
}
```

- [ ] **Step 3: Bust tags on mutations**

In `apply(...)`, after the DB write succeeds and before/after the audit log call, bust both the candidate's applications cache and the recruiter's dashboard cache. The recruiter id comes from the job that was applied to:

```ts
await this.cacheService.bustTags([
  TAGS.applicationsCandidate(user.id),
  TAGS.dashboardRecruiter(job.recruiterId), // job is the row already loaded for ownership/scoring
  TAGS.applicationsRecruiter(job.recruiterId),
]);
```

In `updateStatus(...)`, bust both sides:

```ts
await this.cacheService.bustTags([
  TAGS.dashboardRecruiter(user.id),
  TAGS.applicationsRecruiter(user.id),
  TAGS.applicationsCandidate(application.candidateId),
]);
```

In `withdraw` / `updateNotes` etc., apply the same pattern — bust the side that owns the read.

- [ ] **Step 4: Verify it compiles**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/applications/applications.service.ts
git commit -m "feat(api/applications): cache dashboard aggregates + my-applications, bust on writes"
```

---

## Task 12: Cache recruiter shortlist, interviews, candidate interviews

Same pattern as applications. Apply to whichever services own these reads.

**Files:**
- Modify: `apps/api/src/modules/applications/applications.service.ts` (shortlist may live here)
- Modify: `apps/api/src/modules/interviews/interviews.service.ts`

### Steps

- [ ] **Step 1: Find the shortlist read method**

Run: `grep -n "shortlist" apps/api/src/modules/**/*.service.ts`

The shortlist is "applications a recruiter has explicitly shortlisted." Likely a method like `listShortlistForRecruiter(user)` on applications.service. Wrap with:
- key: `shortlist:recruiter:${user.id}:list:${serializeQuery(query)}`
- ttlSeconds: `TTL_SECONDS.hot`
- tags: `[TAGS.shortlistRecruiter(user.id), TAGS.applicationsRecruiter(user.id)]`

Bust `TAGS.shortlistRecruiter(user.id)` whenever the shortlist boolean is toggled (find the toggle/star method and add a `bustTag` call).

- [ ] **Step 2: Cache interviews — recruiter and candidate**

Open `apps/api/src/modules/interviews/interviews.service.ts`. Add imports + `CacheService` to constructor.

Wrap the recruiter list method:
- key: `interviews:recruiter:${user.id}:list:${serializeQuery(query)}`
- tags: `[TAGS.interviewsRecruiter(user.id)]`

And the candidate list method:
- key: `interviews:candidate:${user.id}:list:${serializeQuery(query)}`
- tags: `[TAGS.interviewsCandidate(user.id)]`

In `schedule` / `updateStatus` / `cancel` mutations, bust both sides:

```ts
await this.cacheService.bustTags([
  TAGS.interviewsRecruiter(interview.recruiterId),
  TAGS.interviewsCandidate(interview.candidateId),
  TAGS.dashboardRecruiter(interview.recruiterId), // dashboard widgets show interview counts
]);
```

The exact field names (`interview.recruiterId`, `interview.candidateId`) come from whatever `interview` row is being mutated — adjust to actual field names.

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/applications/applications.service.ts apps/api/src/modules/interviews/interviews.service.ts
git commit -m "feat(api): cache shortlist + interviews lists, bust on writes"
```

---

## Task 13: Cache profile-score read

Profile score is read on every candidate dashboard load. Long TTL because it only changes when the candidate recomputes (which already busts via the compute endpoint).

**Files:**
- Modify: `apps/api/src/modules/scoring/scoring.service.ts`

### Steps

- [ ] **Step 1: Read the current service**

Run: `cat apps/api/src/modules/scoring/scoring.service.ts | head -60`

Find the read method (likely `getProfileScoreForUser(user)` returning the cached row from `scoring_profile_scores` table).

- [ ] **Step 2: Wrap read + bust on compute**

Open `apps/api/src/modules/scoring/scoring.service.ts`. Add imports + `CacheService` to constructor.

Wrap the read method:

```ts
async getProfileScoreForUser(user: AuthUser): Promise<ProfileScoreDto | null> {
  return this.cacheService.getOrSet({
    key: `profile-score:${user.id}`,
    ttlSeconds: TTL_SECONDS.warm, // 5 min — recomputed on demand
    tags: [TAGS.profileScore(user.id)],
    telemetryName: "profile-score:read",
    load: async () => {
      // <-- existing body -->
    },
  });
}
```

In `computeProfileScore(user, ...)` (the mutation that recomputes), after the DB upsert, bust:

```ts
await this.cacheService.bustTag(TAGS.profileScore(user.id));
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @aurahire/api tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/scoring/scoring.service.ts
git commit -m "feat(api/scoring): cache profile-score read, bust on recompute"
```

---

## Phase C — Frontend SSR Prefetch + Hydration

Builds the shared query plumbing, then refactors each portal page to prefetch on the server, dehydrate, and rehydrate on the client. After this phase, refreshing any dashboard page renders with data already in the cache — no skeleton flash.

---

## Task 14: Shared QueryClient factory

`makeQueryClient` is needed in two places: the existing client provider AND every Server Component that prefetches. Pull it into `lib/query/`.

**Files:**
- Create: `apps/web/lib/query/query-client.ts`
- Modify: `apps/web/components/providers/query-provider.tsx`

### Steps

- [ ] **Step 1: Create the factory**

Create `apps/web/lib/query/query-client.ts`:

```ts
import { QueryClient, defaultShouldDehydrateQuery } from "@tanstack/react-query";

/**
 * Single source of truth for QueryClient configuration. Used by both:
 *   - the client-side QueryProvider (one singleton per browser session)
 *   - Server Components that prefetch + dehydrate (a fresh instance per request)
 *
 * `staleTime: 60_000` matches the typical backend hot-tier TTL — the client
 * trusts hydrated data for one minute before refetching in the background.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const status = (error as { response?: { status?: number } })?.response?.status;
          if (status === 401 || status === 403 || status === 404) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: 0,
      },
      dehydrate: {
        // Only ship successfully-loaded queries to the client. Pending queries
        // serialized would re-trigger the loader on hydrate, defeating the purpose.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) && query.state.status === "success",
      },
    },
  });
}
```

- [ ] **Step 2: Use the factory in the client provider**

Open `apps/web/components/providers/query-provider.tsx`. Replace the local `makeQueryClient` function with an import:

```ts
"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { makeQueryClient } from "@/lib/query/query-client";

let browserQueryClient: ReturnType<typeof makeQueryClient> | undefined;
function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV !== "production" && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @aurahire/web tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/query/query-client.ts apps/web/components/providers/query-provider.tsx
git commit -m "feat(web/query): extract makeQueryClient into lib/query for shared SSR/CSR use"
```

---

## Task 15: Server-side fetch helper

A typed helper that Server Components call inside `prefetchQuery`. Reads the Supabase session via cookies, attaches Bearer token, throws a typed error on non-2xx.

**Files:**
- Create: `apps/web/lib/query/server-fetch.ts`

### Steps

- [ ] **Step 1: Create the helper**

Create `apps/web/lib/query/server-fetch.ts`:

```ts
import "server-only";

import { getCurrentSession } from "@/lib/auth/session";

/**
 * Error thrown by serverApiFetch on non-2xx responses. Carries the HTTP status
 * so callers (or React Query's retry config) can branch on 401/403/404.
 */
export class ServerApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ServerApiError";
  }
}

interface ServerApiFetchInit {
  /** Optional query params merged into the URL. Skips undefined/null. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Override the HTTP method. Defaults to GET. */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Optional JSON body; serialized + sent with `content-type: application/json`. */
  body?: unknown;
  /**
   * Optional Next.js fetch cache config. We pass `{ cache: "no-store" }` by
   * default — the backend cache is the source of truth, and Next's data cache
   * would shadow our Redis cache and lengthen the bust path.
   */
  cache?: RequestCache;
  /** Forwarded as `next.tags`. Defaults unset. */
  nextTags?: string[];
}

/**
 * Server-side typed fetch to the NestJS backend.
 *
 * Use ONLY in Server Components / Server Actions / Route Handlers. Reads the
 * Supabase session from cookies and attaches `Authorization: Bearer <jwt>`.
 * Returns parsed JSON typed as T. Throws `ServerApiError` on non-2xx.
 */
export async function serverApiFetch<T>(
  path: string,
  init: ServerApiFetchInit = {},
): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const session = await getCurrentSession();
  if (!session) throw new ServerApiError(401, null, "No active session");

  const url = new URL(path.startsWith("http") ? path : `${apiUrl}${path}`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: init.cache ?? "no-store",
    next: init.nextTags ? { tags: init.nextTags } : undefined,
  });

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // body may not be JSON; ignore.
    }
    throw new ServerApiError(res.status, body, `API ${res.status} for ${url.pathname}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @aurahire/web tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/query/server-fetch.ts
git commit -m "feat(web/query): add serverApiFetch helper for Server Component prefetch"
```

---

## Task 16: Query keys + query functions catalog

Centralize keys and queryFns so both the Server Component prefetch and the client `useQuery` reach for the same key + same function. This is what makes hydration work — keys must match exactly.

**Files:**
- Create: `apps/web/lib/query/keys.ts`
- Create: `apps/web/lib/query/queries.ts`
- Create: `apps/web/lib/query/index.ts`

### Steps

- [ ] **Step 1: Create the keys file**

Create `apps/web/lib/query/keys.ts`:

```ts
/**
 * Centralized query key factory. Every query key in the app is built here
 * so that prefetch (server) and useQuery (client) can never drift.
 *
 * Convention: arrays of [domain, scope, ...params]. Keep params stable and
 * primitives only — TanStack Query hashes the array.
 */
export const queryKeys = {
  recruiterDashboard: {
    stats: (range: string) => ["recruiter-dashboard", "stats", range] as const,
    analytics: () => ["recruiter-dashboard", "analytics"] as const,
    recent: (limit: number) => ["recruiter-dashboard", "recent", limit] as const,
  },
  recruiterJobs: {
    list: (params: RecruiterJobsListParams) =>
      ["recruiter-jobs", "list", params] as const,
    detail: (id: string) => ["recruiter-jobs", "detail", id] as const,
  },
  recruiterShortlist: {
    list: (params: RecruiterShortlistParams) =>
      ["recruiter-shortlist", "list", params] as const,
  },
  recruiterInterviews: {
    list: (params: RecruiterInterviewsParams) =>
      ["recruiter-interviews", "list", params] as const,
  },
  recruiterApplications: {
    byJob: (jobId: string, params: RecruiterApplicationsByJobParams) =>
      ["recruiter-applications", "by-job", jobId, params] as const,
  },
  candidateJobs: {
    list: (params: CandidateJobsListParams) =>
      ["candidate-jobs", "list", params] as const,
    detail: (id: string) => ["candidate-jobs", "detail", id] as const,
  },
  candidateApplications: {
    list: (params: CandidateApplicationsParams) =>
      ["candidate-applications", "list", params] as const,
  },
  candidateInterviews: {
    list: (params: CandidateInterviewsParams) =>
      ["candidate-interviews", "list", params] as const,
  },
  profileScore: {
    me: () => ["profile-score", "me"] as const,
  },
} as const;

export interface RecruiterJobsListParams {
  status?: string;
  page?: number;
  include?: "stats";
}
export interface RecruiterShortlistParams {
  page?: number;
}
export interface RecruiterInterviewsParams {
  status?: string;
  page?: number;
}
export interface RecruiterApplicationsByJobParams {
  status?: string;
  page?: number;
}
export interface CandidateJobsListParams {
  q?: string;
  mode?: string;
  experienceLevel?: string;
  page?: number;
}
export interface CandidateApplicationsParams {
  status?: string;
  page?: number;
}
export interface CandidateInterviewsParams {
  status?: string;
  page?: number;
}
```

- [ ] **Step 2: Create the queries file**

Create `apps/web/lib/query/queries.ts`:

```ts
import "server-only";

import { serverApiFetch } from "./server-fetch";
import type {
  RecruiterJobsListParams,
  RecruiterShortlistParams,
  RecruiterInterviewsParams,
  RecruiterApplicationsByJobParams,
  CandidateJobsListParams,
  CandidateApplicationsParams,
  CandidateInterviewsParams,
} from "./keys";

/**
 * Server-side query functions. Each one matches a backend endpoint and is
 * called inside `queryClient.prefetchQuery` from a Server Component, then
 * re-runnable client-side via the matching hook (which uses fetch with
 * client-side bearer token).
 *
 * Server vs client queryFn split:
 * - SERVER (this file, via serverApiFetch): used at SSR-prefetch time.
 * - CLIENT (apps/web/hooks/*): uses fetch + the bearer token already attached
 *   by AuthTokenProvider via the Orval fetcher. The shapes returned MUST be
 *   identical so dehydrated data hydrates without type drift.
 */

// Type aliases — sourced from the backend response shapes. These are locally
// declared to avoid leaking the backend's DTO classes into the web package.
// Adjust if `@aurahire/shared` exports DTO types you can import directly.

export interface RecruiterStatsResponse {
  totals: {
    candidates: number;
    new: number;
    interviewed: number;
    offered: number;
    hired: number;
  };
  range: string;
}

export interface RecruiterAnalyticsResponse {
  pipeline: Array<{ stage: string; count: number }>;
  conversion: { applied_to_hired: number };
}

export interface RecruiterRecentApplicationItem {
  id: string;
  candidateName: string;
  jobTitle: string;
  status: string;
  appliedAt: string;
  matchScore: number | null;
}

export const serverQueries = {
  recruiterDashboardStats: (range: string) =>
    serverApiFetch<RecruiterStatsResponse>("/api/v1/applications/recruiter-stats", {
      query: { range },
    }),
  recruiterDashboardAnalytics: () =>
    serverApiFetch<RecruiterAnalyticsResponse>(
      "/api/v1/applications/recruiter-analytics",
    ),
  recruiterDashboardRecent: (limit: number) =>
    serverApiFetch<{ data: RecruiterRecentApplicationItem[] }>(
      "/api/v1/applications/recent",
      { query: { limit } },
    ),
  recruiterJobsList: (params: RecruiterJobsListParams) =>
    serverApiFetch<{ data: unknown[]; meta: { total: number; page: number; limit: number } }>(
      "/api/v1/jobs/mine",
      { query: { status: params.status, page: params.page, include: params.include } },
    ),
  recruiterJobDetail: (id: string) =>
    serverApiFetch<unknown>(`/api/v1/jobs/${id}`),
  recruiterShortlist: (params: RecruiterShortlistParams) =>
    serverApiFetch<{ data: unknown[]; meta: { total: number } }>(
      "/api/v1/applications/shortlist",
      { query: { page: params.page } },
    ),
  recruiterInterviews: (params: RecruiterInterviewsParams) =>
    serverApiFetch<{ data: unknown[]; meta: { total: number } }>(
      "/api/v1/interviews",
      { query: { status: params.status, page: params.page, scope: "recruiter" } },
    ),
  recruiterApplicationsByJob: (jobId: string, params: RecruiterApplicationsByJobParams) =>
    serverApiFetch<{ data: unknown[]; meta: { total: number } }>(
      "/api/v1/applications",
      { query: { jobId, status: params.status, page: params.page } },
    ),
  candidateJobsList: (params: CandidateJobsListParams) =>
    serverApiFetch<{ data: unknown[]; meta: { total: number } }>(
      "/api/v1/jobs/for-candidate",
      {
        query: {
          q: params.q,
          mode: params.mode,
          experienceLevel: params.experienceLevel,
          page: params.page,
        },
      },
    ),
  candidateJobDetail: (id: string) =>
    serverApiFetch<unknown>(`/api/v1/jobs/for-candidate/${id}`),
  candidateApplications: (params: CandidateApplicationsParams) =>
    serverApiFetch<{ data: unknown[]; meta: { total: number } }>(
      "/api/v1/applications/mine",
      { query: { status: params.status, page: params.page } },
    ),
  candidateInterviews: (params: CandidateInterviewsParams) =>
    serverApiFetch<{ data: unknown[]; meta: { total: number } }>(
      "/api/v1/interviews",
      { query: { status: params.status, page: params.page, scope: "candidate" } },
    ),
  profileScoreMe: () =>
    serverApiFetch<unknown>("/api/v1/scoring/profile/me"),
} as const;
```

- [ ] **Step 3: Barrel export**

Create `apps/web/lib/query/index.ts`:

```ts
export { makeQueryClient } from "./query-client";
export { serverApiFetch, ServerApiError } from "./server-fetch";
export { queryKeys } from "./keys";
export type {
  RecruiterJobsListParams,
  RecruiterShortlistParams,
  RecruiterInterviewsParams,
  RecruiterApplicationsByJobParams,
  CandidateJobsListParams,
  CandidateApplicationsParams,
  CandidateInterviewsParams,
} from "./keys";
export { serverQueries } from "./queries";
export type {
  RecruiterStatsResponse,
  RecruiterAnalyticsResponse,
  RecruiterRecentApplicationItem,
} from "./queries";
```

- [ ] **Step 4: Verify it compiles**

Run: `pnpm --filter @aurahire/web tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/query/keys.ts apps/web/lib/query/queries.ts apps/web/lib/query/index.ts
git commit -m "feat(web/query): centralized query keys + server-side query functions"
```

---

## Task 17: Hydration boundary helper

Wraps the page's children in `<HydrationBoundary>` and accepts a freshly-built `QueryClient` with prefetched queries already loaded.

**Files:**
- Create: `apps/web/lib/query/hydration.tsx`

### Steps

- [ ] **Step 1: Create the helper**

Create `apps/web/lib/query/hydration.tsx`:

```tsx
import type { ReactNode } from "react";
import {
  HydrationBoundary,
  dehydrate,
  type QueryClient,
} from "@tanstack/react-query";

interface PrefetchedHydrationProps {
  /** The QueryClient that was used for SSR prefetching. */
  queryClient: QueryClient;
  children: ReactNode;
}

/**
 * Server Component helper. Dehydrates the prefetched QueryClient and renders
 * a HydrationBoundary so client components below see a pre-populated cache.
 *
 * Pattern in a page.tsx:
 *
 *   export default async function Page() {
 *     const queryClient = makeQueryClient();
 *     await Promise.all([
 *       queryClient.prefetchQuery({
 *         queryKey: queryKeys.recruiterJobs.list({}),
 *         queryFn: () => serverQueries.recruiterJobsList({}),
 *       }),
 *     ]);
 *     return (
 *       <PrefetchedHydration queryClient={queryClient}>
 *         <JobsListClient />
 *       </PrefetchedHydration>
 *     );
 *   }
 */
export function PrefetchedHydration({
  queryClient,
  children,
}: PrefetchedHydrationProps) {
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>
  );
}
```

- [ ] **Step 2: Add to barrel**

Append to `apps/web/lib/query/index.ts`:

```ts
export { PrefetchedHydration } from "./hydration";
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @aurahire/web tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/query/hydration.tsx apps/web/lib/query/index.ts
git commit -m "feat(web/query): add PrefetchedHydration helper for SSR-to-CSR cache handoff"
```

---

## Task 18: Client query hooks (the "use this in components" layer)

Each hook calls `useQuery` with the canonical key + a client-side fetcher that uses the existing Orval bearer-attached fetcher. Hydrated data → first paint without a network round trip.

**Files:**
- Create: `apps/web/hooks/use-recruiter-jobs.ts`
- Create: `apps/web/hooks/use-candidate-jobs.ts`
- Create: `apps/web/hooks/use-applications.ts`
- Create: `apps/web/hooks/use-dashboard.ts`
- Create: `apps/web/hooks/use-interviews.ts`
- Create: `apps/web/hooks/use-shortlist.ts`
- Create: `apps/web/hooks/use-profile-score.ts`

### Steps

- [ ] **Step 1: Create a small client-side fetch helper**

The Orval fetcher is at `packages/shared/src/api-client/fetcher.ts` and exports `setAccessToken` etc. but the typed query hooks aren't generated, so we'll call fetch directly with the in-memory access token. Add this helper at `apps/web/hooks/_client-fetch.ts`:

```ts
import { getAccessToken } from "@aurahire/shared/api-client/fetcher";

/**
 * Client-side typed fetch. Mirrors serverApiFetch but reads the token from
 * the in-memory store maintained by AuthTokenProvider — no cookies path,
 * no Server Component imports.
 */
export class ClientApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

export async function clientApiFetch<T>(
  path: string,
  init: {
    query?: Record<string, string | number | boolean | undefined | null>;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const token = getAccessToken();
  const url = new URL(path.startsWith("http") ? path : `${apiUrl}${path}`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "include",
    signal: init.signal,
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {}
    const err = new ClientApiError(res.status, body, `API ${res.status} for ${url.pathname}`);
    (err as { response?: unknown }).response = { status: res.status, body };
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```

If `getAccessToken` is not exported from `@aurahire/shared/api-client/fetcher`, add it: open `packages/shared/src/api-client/fetcher.ts` and confirm `export function getAccessToken(): string | null`. If it's already there per the prior exploration, no change needed. If not, export it and run `pnpm --filter @aurahire/shared build`.

- [ ] **Step 2: Create `use-recruiter-jobs.ts`**

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys, type RecruiterJobsListParams } from "@/lib/query";
import { clientApiFetch } from "./_client-fetch";

interface RecruiterJobsListResponse {
  data: unknown[];
  meta: { total: number; page: number; limit: number };
}

export function useRecruiterJobsQuery(params: RecruiterJobsListParams) {
  return useQuery({
    queryKey: queryKeys.recruiterJobs.list(params),
    queryFn: ({ signal }) =>
      clientApiFetch<RecruiterJobsListResponse>("/api/v1/jobs/mine", {
        query: {
          status: params.status,
          page: params.page,
          include: params.include,
        },
        signal,
      }),
  });
}

export function useRecruiterJobDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.recruiterJobs.detail(id),
    queryFn: ({ signal }) =>
      clientApiFetch<unknown>(`/api/v1/jobs/${id}`, { signal }),
    enabled: Boolean(id),
  });
}
```

- [ ] **Step 3: Create `use-candidate-jobs.ts`, `use-applications.ts`, `use-dashboard.ts`, `use-interviews.ts`, `use-shortlist.ts`, `use-profile-score.ts`**

Apply the same shape — one named hook per query key. Each calls `useQuery` with the matching `queryKeys.<domain>.<scope>(...)` and `clientApiFetch` to the same path the server query function used. Keep the response generic (`unknown[]`) for now; tighten types in a follow-up if shared types become available.

Example for `use-dashboard.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query";
import type {
  RecruiterStatsResponse,
  RecruiterAnalyticsResponse,
  RecruiterRecentApplicationItem,
} from "@/lib/query";
import { clientApiFetch } from "./_client-fetch";

export function useRecruiterStatsQuery(range: string) {
  return useQuery({
    queryKey: queryKeys.recruiterDashboard.stats(range),
    queryFn: ({ signal }) =>
      clientApiFetch<RecruiterStatsResponse>("/api/v1/applications/recruiter-stats", {
        query: { range },
        signal,
      }),
  });
}

export function useRecruiterAnalyticsQuery() {
  return useQuery({
    queryKey: queryKeys.recruiterDashboard.analytics(),
    queryFn: ({ signal }) =>
      clientApiFetch<RecruiterAnalyticsResponse>(
        "/api/v1/applications/recruiter-analytics",
        { signal },
      ),
  });
}

export function useRecruiterRecentApplicationsQuery(limit: number) {
  return useQuery({
    queryKey: queryKeys.recruiterDashboard.recent(limit),
    queryFn: ({ signal }) =>
      clientApiFetch<{ data: RecruiterRecentApplicationItem[] }>(
        "/api/v1/applications/recent",
        { query: { limit }, signal },
      ),
  });
}
```

Apply the analogous structure to the other six hooks. Match query keys exactly; match URL paths to the server-side `serverQueries` definitions in Task 16.

- [ ] **Step 4: Verify it compiles**

Run: `pnpm --filter @aurahire/web tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/hooks/_client-fetch.ts apps/web/hooks/use-*.ts
git commit -m "feat(web/hooks): add typed client query hooks for hydrated SSR data"
```

---

## Task 19: Refactor `/recruiter/jobs` to prefetch + hydrate (template page)

This is the page in the user's screenshot. The template every other page mirrors.

**Files:**
- Modify: `apps/web/app/(recruiter)/recruiter/jobs/page.tsx`
- Create: `apps/web/app/(recruiter)/recruiter/jobs/_jobs-list-client.tsx`

### Steps

- [ ] **Step 1: Move the list rendering into a client component**

Create `apps/web/app/(recruiter)/recruiter/jobs/_jobs-list-client.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { JobStatus } from "@aurahire/shared";

import { JobListRow } from "@/components/jobs/job-list-row";
import { EmptyState } from "@/components/empty-state";
import { useRecruiterJobsQuery } from "@/hooks/use-recruiter-jobs";

interface RecruiterJobRow {
  id: string;
  title: string;
  department: string | null;
  employmentType: string;
  workMode: string;
  locationCity: string | null;
  locationCountry: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  status: JobStatus;
  publishedAt: string | null;
  company: { name: string };
}

interface JobsListClientProps {
  status?: string;
  page?: number;
}

export function JobsListClient({ status, page }: JobsListClientProps) {
  const { data, isLoading, isError } = useRecruiterJobsQuery({ status, page });

  // Hydrated cache populates `data` on first render — no skeleton flash.
  // `isLoading` only fires when the cache miss is real (e.g. initial CSR navigation).
  if (isError) {
    return (
      <div className="text-[var(--color-status-danger)]">Failed to load jobs.</div>
    );
  }

  const rows = (data?.data ?? []) as RecruiterJobRow[];
  const total = data?.meta?.total ?? 0;

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
            My Jobs
          </h1>
          <p className="mt-1 text-sm text-[var(--color-body)]">
            {isLoading ? "—" : `${total} job${total === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link
          href="/recruiter/jobs/new"
          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
        >
          <Plus className="h-4 w-4" />
          New Job
        </Link>
      </header>

      {!isLoading && rows.length === 0 ? (
        <EmptyState
          headline="Post your first job"
          description="Create a job posting and start receiving applications."
          cta={{ href: "/recruiter/jobs/new", label: "New Job" }}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((job) => (
            <JobListRow
              key={job.id}
              job={job}
              href={`/recruiter/jobs/${job.id}`}
              showStatus
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the page as Server Component prefetch + hydrate**

Replace `apps/web/app/(recruiter)/recruiter/jobs/page.tsx` entirely:

```tsx
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import {
  makeQueryClient,
  PrefetchedHydration,
  queryKeys,
  serverQueries,
} from "@/lib/query";

import { JobsListClient } from "./_jobs-list-client";

export const metadata = { title: "My Jobs" };

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function RecruiterJobsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const params = {
    status: sp.status && sp.status !== "all" ? sp.status : undefined,
    page: sp.page ? Number(sp.page) : undefined,
  };

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.recruiterJobs.list(params),
    queryFn: () => serverQueries.recruiterJobsList(params),
  });

  return (
    <PrefetchedHydration queryClient={queryClient}>
      <JobsListClient status={params.status} page={params.page} />
    </PrefetchedHydration>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @aurahire/web tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Manual smoke (human runs)**

The human runs `pnpm dev`, signs in as a recruiter, navigates to `/recruiter/jobs`, then refreshes the page. Expected: no skeleton flash; the list renders immediately with the prefetched data, then optionally background-refetches if stale.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(recruiter)/recruiter/jobs/page.tsx apps/web/app/(recruiter)/recruiter/jobs/_jobs-list-client.tsx
git commit -m "feat(web/recruiter): prefetch+hydrate /recruiter/jobs (kills skeleton-on-refresh)"
```

---

## Task 20: Refactor `/recruiter` dashboard to prefetch + hydrate

The dashboard fetches three endpoints in parallel. All three get prefetched and hydrated. The existing `_dashboard-client.tsx` (which already has the date-range filter) becomes a `useQuery` consumer instead of a Server-Action consumer.

**Files:**
- Modify: `apps/web/app/(recruiter)/recruiter/page.tsx`
- Modify: `apps/web/app/(recruiter)/recruiter/_dashboard-client.tsx`

### Steps

- [ ] **Step 1: Read the current files**

Run:
```
cat apps/web/app/(recruiter)/recruiter/page.tsx
cat apps/web/app/(recruiter)/recruiter/_dashboard-client.tsx
```

Note the current pattern: the page fetches stats/analytics/recent in `Promise.all`, passes the data as props to a server component for rendering, and the client component manages the date-range filter via a Server Action.

- [ ] **Step 2: Rewrite `page.tsx`**

Replace its contents:

```tsx
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import {
  makeQueryClient,
  PrefetchedHydration,
  queryKeys,
  serverQueries,
} from "@/lib/query";

import { RecruiterDashboardClient } from "./_dashboard-client";

export const metadata = { title: "Recruiter Dashboard" };

const DEFAULT_RANGE = "7d";
const DEFAULT_RECENT_LIMIT = 6;

export default async function RecruiterDashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const queryClient = makeQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.recruiterDashboard.stats(DEFAULT_RANGE),
      queryFn: () => serverQueries.recruiterDashboardStats(DEFAULT_RANGE),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.recruiterDashboard.analytics(),
      queryFn: () => serverQueries.recruiterDashboardAnalytics(),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.recruiterDashboard.recent(DEFAULT_RECENT_LIMIT),
      queryFn: () => serverQueries.recruiterDashboardRecent(DEFAULT_RECENT_LIMIT),
    }),
  ]);

  return (
    <PrefetchedHydration queryClient={queryClient}>
      <RecruiterDashboardClient
        defaultRange={DEFAULT_RANGE}
        recentLimit={DEFAULT_RECENT_LIMIT}
      />
    </PrefetchedHydration>
  );
}
```

- [ ] **Step 3: Rewrite `_dashboard-client.tsx`**

Replace its contents (preserving the visual structure of the existing three sections — Active Jobs, Pipeline Analytics, Recent Applications — but reading from `useQuery` instead of props):

```tsx
"use client";

import { useState } from "react";

import {
  useRecruiterStatsQuery,
  useRecruiterAnalyticsQuery,
  useRecruiterRecentApplicationsQuery,
} from "@/hooks/use-dashboard";

interface RecruiterDashboardClientProps {
  defaultRange: string;
  recentLimit: number;
}

export function RecruiterDashboardClient({
  defaultRange,
  recentLimit,
}: RecruiterDashboardClientProps) {
  const [range, setRange] = useState(defaultRange);

  const stats = useRecruiterStatsQuery(range);
  const analytics = useRecruiterAnalyticsQuery();
  const recent = useRecruiterRecentApplicationsQuery(recentLimit);

  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Recruiter Dashboard
        </h1>
        <p className="mt-1 text-sm text-[var(--color-body)]">Pipeline at a glance.</p>
      </header>

      {/*
        Sections preserved from the prior dashboard rewrite (sprint plan
        2026-05-04). Replace the three subtree blocks below with whatever the
        existing implementation rendered, but source data from the three
        useQuery results above instead of props.

        - stats.data → drives "Active Jobs" inline metric strips per job
        - analytics.data → drives "Pipeline Analytics" with the date-range filter
          (the date-range filter calls setRange — useRecruiterStatsQuery already
          re-runs when range changes; analytics is range-independent today)
        - recent.data → drives "Recent Applications"
      */}

      {/* Replace these placeholders with the existing sections, wired to the queries above. */}
      <section>{/* ActiveJobsSection: render stats.data */}</section>
      <section>{/* PipelineAnalyticsSection: render analytics.data + range filter (setRange) */}</section>
      <section>{/* RecentApplicationsSection: render recent.data */}</section>
    </div>
  );
}
```

The literal section JSX should be ported verbatim from the existing `_dashboard-client.tsx` — only the data sources change. After porting, every place that previously read `props.stats`, `props.analytics`, `props.recent` now reads `stats.data`, `analytics.data`, `recent.data`. Every place that called the existing `fetchKpis` Server Action becomes `setRange(newRange)`.

- [ ] **Step 4: Verify it compiles**

Run: `pnpm --filter @aurahire/web tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Manual smoke**

Human refreshes `/recruiter` → no skeleton flash; date-range filter works (changes range → useQuery refetches with new key, instant cache hit if seen before).

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/(recruiter)/recruiter/page.tsx apps/web/app/(recruiter)/recruiter/_dashboard-client.tsx
git commit -m "feat(web/recruiter): prefetch+hydrate dashboard (stats/analytics/recent)"
```

---

## Task 21: Refactor `/recruiter/jobs/[id]` to prefetch + hydrate

**Files:**
- Modify: `apps/web/app/(recruiter)/recruiter/jobs/[id]/page.tsx`
- Create: `apps/web/app/(recruiter)/recruiter/jobs/[id]/_job-detail-client.tsx`

### Steps

- [ ] **Step 1: Read the current page**

Run: `cat apps/web/app/(recruiter)/recruiter/jobs/[id]/page.tsx`

Note what it fetches (likely the job detail + applications by job).

- [ ] **Step 2: Apply the same pattern as Task 19**

The page becomes:

```tsx
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import {
  makeQueryClient,
  PrefetchedHydration,
  queryKeys,
  serverQueries,
} from "@/lib/query";

import { JobDetailClient } from "./_job-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function RecruiterJobDetailPage({ params, searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const sp = await searchParams;
  const appsParams = {
    status: sp.status && sp.status !== "all" ? sp.status : undefined,
    page: sp.page ? Number(sp.page) : undefined,
  };

  const queryClient = makeQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.recruiterJobs.detail(id),
      queryFn: () => serverQueries.recruiterJobDetail(id),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.recruiterApplications.byJob(id, appsParams),
      queryFn: () => serverQueries.recruiterApplicationsByJob(id, appsParams),
    }),
  ]);

  return (
    <PrefetchedHydration queryClient={queryClient}>
      <JobDetailClient jobId={id} appsParams={appsParams} />
    </PrefetchedHydration>
  );
}
```

The `_job-detail-client.tsx` is a `"use client"` component that calls `useRecruiterJobDetailQuery(jobId)` and a new `useRecruiterApplicationsByJobQuery(jobId, params)` hook (add this to `apps/web/hooks/use-applications.ts`). Port the existing visual sections from the current page (kanban / table) into the client component.

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @aurahire/web tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(recruiter)/recruiter/jobs/[id]/page.tsx apps/web/app/(recruiter)/recruiter/jobs/[id]/_job-detail-client.tsx apps/web/hooks/use-applications.ts
git commit -m "feat(web/recruiter): prefetch+hydrate /recruiter/jobs/[id]"
```

---

## Task 22: Refactor remaining recruiter pages (shortlist, interviews)

Identical pattern — Server Component prefetches via `serverQueries`, wraps a small `_*-client.tsx` in `<PrefetchedHydration>`. Each client component uses the matching hook from Task 18.

**Files:**
- Modify: `apps/web/app/(recruiter)/recruiter/shortlist/page.tsx`
- Create: `apps/web/app/(recruiter)/recruiter/shortlist/_shortlist-client.tsx`
- Modify: `apps/web/app/(recruiter)/recruiter/interviews/page.tsx`
- Create: `apps/web/app/(recruiter)/recruiter/interviews/_interviews-client.tsx`

### Steps

- [ ] **Step 1: Apply the Task 19 template**

For each page:
1. Move existing render code into `_*-client.tsx` with `"use client"` and the matching `use*Query` hook.
2. Rewrite `page.tsx` to: get session, build params, `makeQueryClient`, `prefetchQuery({ queryKey, queryFn })`, return `<PrefetchedHydration><ClientComponent ... /></PrefetchedHydration>`.

Use these mappings:

| Page | Query key | Query function |
|---|---|---|
| `/recruiter/shortlist` | `queryKeys.recruiterShortlist.list({ page })` | `serverQueries.recruiterShortlist({ page })` |
| `/recruiter/interviews` | `queryKeys.recruiterInterviews.list({ status, page })` | `serverQueries.recruiterInterviews({ status, page })` |

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @aurahire/web tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(recruiter)/recruiter/shortlist" "apps/web/app/(recruiter)/recruiter/interviews"
git commit -m "feat(web/recruiter): prefetch+hydrate /recruiter/{shortlist,interviews}"
```

---

## Task 23: Refactor candidate dashboard, jobs list, and job detail

**Files:**
- Modify: `apps/web/app/(candidate)/candidate/page.tsx` + new `_dashboard-client.tsx`
- Modify: `apps/web/app/(candidate)/candidate/jobs/page.tsx` + new `_jobs-list-client.tsx`
- Modify: `apps/web/app/(candidate)/candidate/jobs/[id]/page.tsx` + new `_job-detail-client.tsx`

### Steps

- [ ] **Step 1: Apply the Task 19 template per page**

Mappings:

| Page | Prefetched keys + functions |
|---|---|
| `/candidate` | `profileScore.me()` → `serverQueries.profileScoreMe()` AND `candidateApplications.list({})` → `serverQueries.candidateApplications({})` |
| `/candidate/jobs` | `candidateJobs.list({ q, mode, experienceLevel, page })` → `serverQueries.candidateJobsList({...})` |
| `/candidate/jobs/[id]` | `candidateJobs.detail(id)` → `serverQueries.candidateJobDetail(id)` |

For each, port the existing render code into a `"use client"` component reading from the matching hook (`useProfileScoreQuery`, `useMyApplicationsQuery`, `useCandidateJobsQuery`, `useCandidateJobDetailQuery`).

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @aurahire/web tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(candidate)/candidate/page.tsx" "apps/web/app/(candidate)/candidate/_dashboard-client.tsx" "apps/web/app/(candidate)/candidate/jobs"
git commit -m "feat(web/candidate): prefetch+hydrate /candidate/{,jobs,jobs/[id]}"
```

---

## Task 24: Refactor candidate applications + interviews pages

**Files:**
- Modify: `apps/web/app/(candidate)/candidate/applications/page.tsx` + new `_applications-client.tsx`
- Modify: `apps/web/app/(candidate)/candidate/interviews/page.tsx` + new `_interviews-client.tsx`

### Steps

- [ ] **Step 1: Apply the Task 19 template**

Mappings:

| Page | Query key | Query function |
|---|---|---|
| `/candidate/applications` | `queryKeys.candidateApplications.list({ status, page })` | `serverQueries.candidateApplications({ status, page })` |
| `/candidate/interviews` | `queryKeys.candidateInterviews.list({ status, page })` | `serverQueries.candidateInterviews({ status, page })` |

Each uses `useMyApplicationsQuery` / `useMyInterviewsQuery` from Task 18.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @aurahire/web tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(candidate)/candidate/applications" "apps/web/app/(candidate)/candidate/interviews"
git commit -m "feat(web/candidate): prefetch+hydrate /candidate/{applications,interviews}"
```

---

## Task 25: Wire mutation invalidation on the client

When the client mutates (e.g. publishes a job), the in-memory React Query cache must drop the matching keys so the next render fetches fresh. The backend already busts its Redis tags; the client just needs to invalidate the query keys.

**Files:**
- Create: `apps/web/hooks/use-invalidate-queries.ts`

### Steps

- [ ] **Step 1: Add a small invalidation hook**

Create `apps/web/hooks/use-invalidate-queries.ts`:

```ts
"use client";

import { useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query";

/**
 * Returns helper functions that invalidate scoped subtrees of the React Query
 * cache. Call after a mutation succeeds. The backend already busts its Redis
 * tags; this just makes the client refetch.
 *
 * Example:
 *   const inv = useInvalidate();
 *   const mutation = useJobsControllerPublishV1({
 *     mutation: { onSuccess: () => inv.recruiterJobs() },
 *   });
 */
export function useInvalidate() {
  const qc = useQueryClient();
  return {
    recruiterJobs: () => qc.invalidateQueries({ queryKey: ["recruiter-jobs"] }),
    recruiterDashboard: () =>
      qc.invalidateQueries({ queryKey: ["recruiter-dashboard"] }),
    recruiterApplications: () =>
      qc.invalidateQueries({ queryKey: ["recruiter-applications"] }),
    recruiterShortlist: () =>
      qc.invalidateQueries({ queryKey: ["recruiter-shortlist"] }),
    recruiterInterviews: () =>
      qc.invalidateQueries({ queryKey: ["recruiter-interviews"] }),
    candidateJobs: () => qc.invalidateQueries({ queryKey: ["candidate-jobs"] }),
    candidateApplications: () =>
      qc.invalidateQueries({ queryKey: ["candidate-applications"] }),
    candidateInterviews: () =>
      qc.invalidateQueries({ queryKey: ["candidate-interviews"] }),
    profileScore: () => qc.invalidateQueries({ queryKey: ["profile-score"] }),
  };
}
```

- [ ] **Step 2: Wire it into existing mutation call sites**

Find every place an Orval mutation is called (`useJobsControllerCreateV1`, `useJobsControllerPublishV1`, `useApplicationsControllerApplyV1`, etc.) and add `onSuccess` invalidation. Example for the job-publish call site:

```ts
const inv = useInvalidate();
const publish = useJobsControllerPublishV1({
  mutation: {
    onSuccess: () => {
      inv.recruiterJobs();
      inv.recruiterDashboard();
    },
  },
});
```

Map mutations to invalidation:

| Mutation | Invalidate |
|---|---|
| `useJobsControllerCreateV1`, `useJobsControllerUpdateV1`, `useJobsControllerPublishV1`, `useJobsControllerArchiveV1` | `recruiterJobs`, `recruiterDashboard`, `candidateJobs` |
| `useApplicationsControllerApplyV1` | `candidateApplications`, `recruiterApplications`, `recruiterDashboard` |
| `useApplicationsControllerUpdateStatusV1` | `recruiterApplications`, `recruiterDashboard`, `candidateApplications` |
| `useApplicationsControllerWithdrawV1` | `candidateApplications`, `recruiterApplications`, `recruiterDashboard` |
| `useInterviewsControllerScheduleV1`, `*UpdateStatusV1`, `*UpdateFeedbackV1` | `recruiterInterviews`, `candidateInterviews`, `recruiterDashboard` |
| `useScoringControllerComputeProfileScoreV1` | `profileScore` |
| `useBiasControllerOverrideV1` | `recruiterJobs` |
| `useAdminConfigControllerUpdateV1` (if present) | none on client (it's admin-only; admin pages can refetch on demand) |

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @aurahire/web tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/web/hooks/use-invalidate-queries.ts <every modified mutation call site>
git commit -m "feat(web): invalidate React Query cache on mutation success"
```

---

## Phase D — Documentation + Verification

---

## Task 26: Long-term reference doc

A reference doc in `docs/main/` so future contributors know where to add caching for new endpoints.

**Files:**
- Create: `docs/main/caching-strategy.md`

### Steps

- [ ] **Step 1: Create the reference**

Create `docs/main/caching-strategy.md`:

```markdown
# Caching Strategy

Two layers, owned by two different parts of the stack:

| Layer | Where | What it caches | Invalidation |
|---|---|---|---|
| Backend Redis cache | `apps/api/src/cache/` | DB query results, AI outputs, aggregates | Tag-based via CacheService.bustTag, TTL backstop |
| Frontend React Query cache | `apps/web/lib/query/` | Server-prefetched data, hydrated to client | Key-based via useInvalidate, staleTime 60s |

## Backend cache (NestJS + ioredis)

**Module:** `apps/api/src/cache/cache.module.ts` — registered globally.

**Service:** `CacheService` (injectable). Three primitives:
- `getOrSet({ key, ttlSeconds, tags?, load })` — cache-aside with single-flight
- `bustTag(tag)` — evict every key indexed under a tag
- `bustKey(key)` — evict a single key

**TTL bands** (`apps/api/src/cache/cache.constants.ts`):
- `hot` (60s) — recruiter aggregates, list pages
- `warm` (5m) — single-entity reads when cheap to recompute
- `cool` (1h) — admin config, system flags
- `ai` (24h) — content-hash-keyed AI outputs

**Tag conventions** (always use `TAGS.<name>(...)` from constants):
- `scoring-config:active`
- `jobs:public`, `jobs:recruiter:{userId}`, `job:{jobId}`
- `dashboard:recruiter:{userId}`
- `applications:recruiter:{userId}`, `applications:candidate:{userId}`
- `interviews:recruiter:{userId}`, `interviews:candidate:{userId}`
- `shortlist:recruiter:{userId}`
- `profile-score:{userId}`

**Invalidation matrix:**
| Mutation | Tags to bust |
|---|---|
| Job create/update/publish/archive | `jobs:public`, `jobs:recruiter:{userId}`, `job:{jobId}` |
| Application apply | `applications:candidate:{userId}`, `applications:recruiter:{recruiterId}`, `dashboard:recruiter:{recruiterId}` |
| Application status change | `applications:recruiter:{userId}`, `applications:candidate:{candidateId}`, `dashboard:recruiter:{userId}` |
| Interview schedule/cancel/update | `interviews:recruiter:{recruiterId}`, `interviews:candidate:{candidateId}`, `dashboard:recruiter:{recruiterId}` |
| Profile score recompute | `profile-score:{userId}` |
| Scoring config update | `scoring-config:active` |

**AI caching** uses content-hash keys built via `sha256OfStable({...})` — same input always returns same output. Inputs MUST include the prompt version constant so prompt edits invalidate cleanly.

**Failure mode:** Redis down → CacheService logs at warn and falls through to the loader. The API stays up. Tag bust failures log but don't throw — entries fall off via TTL.

## Frontend cache (TanStack Query)

**QueryClient factory:** `apps/web/lib/query/query-client.ts` — same config server + client. `staleTime: 60_000` matches the backend hot-tier TTL.

**Server prefetch pattern (Server Component pages):**
```tsx
const queryClient = makeQueryClient();
await queryClient.prefetchQuery({
  queryKey: queryKeys.recruiterJobs.list(params),
  queryFn: () => serverQueries.recruiterJobsList(params),
});
return (
  <PrefetchedHydration queryClient={queryClient}>
    <ClientComponent />
  </PrefetchedHydration>
);
```

**Client read pattern (`"use client"` components):**
```tsx
const { data, isLoading } = useRecruiterJobsQuery(params);
```

The keys MUST match. They're centralized in `apps/web/lib/query/keys.ts` so prefetch + useQuery are guaranteed to align.

**Mutations:** call `useInvalidate()` and invalidate the affected scope on success.

## Adding caching to a new endpoint

Backend:
1. Add a tag template in `cache.constants.ts` if a new entity is involved.
2. In the service method that reads, wrap with `cacheService.getOrSet({ key, ttlSeconds, tags, load })`.
3. In every service method that writes, call `cacheService.bustTags([...])`.

Frontend (if the endpoint is hit by a page):
1. Add a key to `queryKeys` in `lib/query/keys.ts`.
2. Add a server query function to `lib/query/queries.ts`.
3. Add a client hook under `apps/web/hooks/use-*.ts`.
4. In the page Server Component, `prefetchQuery` and wrap children in `PrefetchedHydration`.
5. In the client component, call the hook.
6. In any mutation that writes data the page reads, add an `onSuccess` invalidation via `useInvalidate()`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/main/caching-strategy.md
git commit -m "docs: add caching strategy reference"
```

---

## Task 27: Manual smoke checklist

After all phases land, the human runs through this checklist.

**No files modified.**

### Steps

- [ ] **Step 1: Backend smoke**

Human runs (in a separate terminal): `pnpm dev`. Then exercises:

- Sign in as recruiter. Open `/recruiter/jobs`. Watch backend logs — first request shows `MISS` for the jobs:recruiter list cache; second request (refresh) shows `HIT`.
- Apply as a candidate to a job. Watch logs — backend logs `bustTag tag=applications:candidate:* count=N` and `dashboard:recruiter:* count=M`.
- Recruiter refreshes dashboard — first request after the bust shows `MISS`, then subsequent shows `HIT`.
- Admin updates `scoring_config`. Recruiter triggers a profile-score recompute. Backend logs show `bustTag tag=scoring-config:active` and the next read shows `MISS`.
- Stop Redis (`docker compose -f docker-compose.dev.yml stop redis` from a SEPARATE terminal — claude does NOT run this). Hit `/recruiter/jobs` again. Backend should still serve data (loader runs every time, no crash). Backend logs warn-level "cache GET failed". Restart Redis when done.

- [ ] **Step 2: Frontend smoke**

- Refresh `/recruiter/jobs` — no skeleton flash; data renders immediately.
- Refresh `/recruiter` (dashboard) — no skeleton flash on any of the three sections.
- Same for `/recruiter/jobs/[id]`, `/recruiter/shortlist`, `/recruiter/interviews`.
- Same for all five candidate pages.
- Change date-range filter on `/recruiter` — UI updates without a hard reload.
- Publish a job → recruiter jobs list reflects the published status without a manual refresh.
- Apply to a job as candidate → candidate applications list shows the new row without a manual refresh.

- [ ] **Step 3: Type + lint gates**

Run: `pnpm --filter @aurahire/api tsc --noEmit && pnpm --filter @aurahire/web tsc --noEmit`
Run: `pnpm lint`
Both must pass.

- [ ] **Step 4: Tag the sprint**

```bash
git tag v0.6-caching
git log --oneline v0.6-caching~30..v0.6-caching
```

---

## Self-Review Notes

**Spec coverage:** Every page named in the user's intent (recruiter dashboard, jobs, plus the rest of the recruiter portal, the entire candidate portal) has an explicit refactor task. Backend AI caching covers all four AI services. Cache invalidation is wired at every mutation call site documented in the architecture report.

**Placeholder scan:** Tasks 5, 6, 7, 9, 11, 12, 13 each say "find the actual method name and field names from the file" instead of inventing names — this is intentional because those services weren't fully read at plan time. The pattern (`getOrSet` with TTL band + tag) is fully spelled out; only the local variable names need the executor to read the file. Task 20 has placeholder section blocks for the dashboard re-render — that's because the existing `_dashboard-client.tsx` (per the prior recruiter portal redesign plan) has visual code that should be ported verbatim. The task explicitly says "port the existing implementation" rather than "write something new."

**Type consistency:** `CacheService.getOrSet` signature is consistent across all backend tasks. `serverQueries.*` and `useTask*Query` keys mirror each other across Tasks 16 and 18. `queryKeys` factory is the single source of truth for both server and client.

**Admin pages:** Excluded from frontend SSR-prefetch refactor in this plan because admin pages currently live behind a "use client" wrapper (per the architecture report). Admin caching wins are entirely on the backend (scoring-config, audit log lists). If admin SSR-prefetch is needed later, apply the Task 19 template — no architectural change required.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-05-redis-caching-strategy.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. Best for this plan because backend tasks (5–13) read service files at execution time and Phase C frontend tasks each touch a distinct page.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch through phases with checkpoints between Phase A→B, B→C, C→D.

Which approach?
