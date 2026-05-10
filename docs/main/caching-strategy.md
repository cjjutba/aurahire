# Caching Strategy

Two layers, owned by two different parts of the stack:

| Layer                      | Where                 | What it caches                             | Invalidation                                       |
| -------------------------- | --------------------- | ------------------------------------------ | -------------------------------------------------- |
| Backend Redis cache        | `apps/api/src/cache/` | DB query results, AI outputs, aggregates   | Tag-based via `CacheService.bustTag`, TTL backstop |
| Frontend React Query cache | `apps/web/lib/query/` | Server-prefetched data, hydrated to client | Key-based via `useInvalidate`, `staleTime` 60s     |

## Backend cache (NestJS + ioredis)

**Module:** `apps/api/src/cache/cache.module.ts` — registered globally as `AppCacheModule` (the `@nestjs/cache-manager` global also remains, but is no longer the primary path for new code).

**Service:** `CacheService` (injectable). Three primitives:

- `getOrSet({ key, ttlSeconds, tags?, load, bypass?, telemetryName? })` — cache-aside with single-flight (in-process map dedupes concurrent loads for the same key)
- `bustTag(tag)` — evict every key indexed under a tag
- `bustTags(tags)` — bust multiple tags
- `bustKey(key)` — evict a single key

**TTL bands** (`apps/api/src/cache/cache.constants.ts`):

- `hot` (60 s) — recruiter aggregates, list pages, candidate's own applications
- `warm` (5 min) — single-entity reads when cheap to recompute (profile-score)
- `cool` (1 hour) — admin config, system flags
- `ai` (24 hours) — content-hash-keyed AI outputs

**Tag conventions** (always use `TAGS.<name>(...)` from `cache.constants.ts`):

- `scoring-config:active`
- `jobs:public`, `jobs:recruiter:{userId}`, `job:{jobId}`
- `dashboard:recruiter:{userId}`
- `applications:recruiter:{userId}`, `applications:candidate:{userId}`
- `interviews:recruiter:{userId}`, `interviews:candidate:{userId}`
- `shortlist:recruiter:{userId}` _(reserved; backend not implemented yet)_
- `profile-score:{userId}`

**Invalidation matrix:**

| Mutation                                              | Tags to bust                                                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Job create/update/publish/archive                     | `jobs:public`, `jobs:recruiter:{userId}`, `job:{jobId}`                                                         |
| Application apply                                     | `applications:candidate:{userId}`, `applications:recruiter:{recruiterId}`, `dashboard:recruiter:{recruiterId}`  |
| Application status change / notes update              | `applications:recruiter:{userId}`, `applications:candidate:{candidateId}`, `dashboard:recruiter:{userId}`       |
| Application withdraw                                  | `applications:candidate:{userId}`, `applications:recruiter:{recruiterId}`, `dashboard:recruiter:{recruiterId}`  |
| Interview schedule/cancel/updateStatus/updateFeedback | `interviews:recruiter:{recruiterId}`, `interviews:candidate:{candidateId}`, `dashboard:recruiter:{recruiterId}` |
| Profile score recompute                               | `profile-score:{userId}`                                                                                        |
| Scoring config update                                 | `scoring-config:active`                                                                                         |

**AI caching** uses content-hash keys built via `sha256OfStable({...})` — same input always returns same output. Inputs MUST include the prompt version constant so prompt edits invalidate cleanly. Examples:

```ts
// parse-resume
sha256OfStable({ truncatedText, promptVersion: PARSE_RESUME_VERSION })

// score-profile
sha256OfStable({ redacted, weights, desiredRole, desiredSeniority, promptVersion: SCORE_PROFILE_VERSION })

// score-match
sha256OfStable({ redacted, job: {...}, weights, promptVersion: SCORE_MATCH_VERSION })

// detect-bias
sha256OfStable({ text, customFlaggedTerms, promptVersion: DETECT_BIAS_VERSION })
```

The cached blob deliberately excludes per-call metadata that varies independently (e.g. `redactedFields` for score services) — those fields are reattached on the way out so the cache stays compact and per-call info stays accurate.

**Failure mode:** Redis down → `CacheService` logs at warn and falls through to the loader. The API stays up. Tag-bust failures log but don't throw — entries fall off via TTL.

**Stampede protection:** an in-process `Map<fullKey, Promise>` dedupes concurrent loads on the same key in the same NestJS instance. 100 concurrent requests all run ONE loader, the rest await it. Cross-instance stampede protection is not implemented; the 60-s hot-tier TTL keeps the worst case bounded.

## Frontend cache (TanStack Query)

**QueryClient factory:** `apps/web/lib/query/query-client.ts` — same config server + client. `staleTime: 60_000` matches the backend hot-tier TTL.

**Server-side fetcher:** `apps/web/lib/query/server-fetch.ts` — `serverApiFetch<T>(path, init)` reads the Supabase session via cookies, attaches `Authorization: Bearer <jwt>`, returns parsed JSON typed as `T`, throws `ServerApiError` on non-2xx.

**Client-side fetcher:** `apps/web/hooks/_client-fetch.ts` — `clientApiFetch<T>(path, init)` reads the in-memory token set by `AuthTokenProvider`, mirrors the server signature.

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

The query keys MUST match. They're centralized in `apps/web/lib/query/keys.ts` so prefetch + `useQuery` are guaranteed to align.

**Pages currently prefetched** (`PrefetchedHydration` wrapper):

- `/recruiter` (dashboard — stats, analytics, recent)
- `/recruiter/jobs` (list)
- `/recruiter/interviews`
- `/candidate` (dashboard — profile-score, applications)
- `/candidate/jobs` (list)
- `/candidate/applications`
- `/candidate/interviews`

**Pages still using `serverApiFetch` directly** (read-only, no client interactivity):

- `/recruiter/jobs/[id]`
- `/candidate/jobs/[id]`

Both benefit from the backend Redis cache (60-s hot tier on detail reads); since they don't mount any `useQuery` consumer, hydration would be wasted ceremony.

**Mutations:** call `useInvalidate()` from `apps/web/hooks/use-invalidate-queries.ts` and invalidate the affected scope on success. Today only the job-form and job-actions components consume Orval mutation hooks — when other mutations migrate from raw fetch to Orval hooks, follow the same pattern.

## Adding caching to a new endpoint

**Backend:**

1. Add a tag template in `cache.constants.ts` if a new entity is involved.
2. In the service method that reads, wrap with `cacheService.getOrSet({ key, ttlSeconds, tags, load })`.
3. In every service method that writes, call `cacheService.bustTags([...])` after the DB write commits and audit log fires.

**Frontend (if the endpoint is hit by a page):**

1. Add a key to `queryKeys` in `lib/query/keys.ts`.
2. Add a server query function to `lib/query/queries.ts`.
3. Add a client hook under `apps/web/hooks/use-*.ts`.
4. In the page Server Component, `prefetchQuery` and wrap children in `PrefetchedHydration`.
5. In the client component, call the hook.
6. In any mutation that writes data the page reads, add an `onSuccess` invalidation via `useInvalidate()`.

## Operations

**Redis is required for production.** The CacheService falls open when Redis is unreachable, but the API will lose two things:

1. AI cost savings — every AI call hits OpenAI.
2. Aggregate latency — every dashboard request runs the full DB query.

**Observability** — `CacheService` logs at debug level on hit/miss/coalesce and at warn on Redis errors. Set `LOG_LEVEL=debug` in the API env to see hit-rate signals during dev.

**Cache namespace versioning** — the namespace is `ah:v1` (in `CACHE_NAMESPACE`). Bumping it (e.g. to `ah:v2`) on a breaking change to cached DTO shapes invalidates the entire cache atomically without touching individual keys.
