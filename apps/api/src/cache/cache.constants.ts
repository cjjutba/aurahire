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
