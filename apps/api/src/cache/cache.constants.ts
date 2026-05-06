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
 *
 * Phase 2c sweep: every recruiter-keyed tag (jobs/dashboard/applications/
 * interviews/shortlistRecruiter) was deleted. Tenant cutover demands the
 * keys themselves include `companyId` so a stale read from another tenant
 * cannot poison cache. Tags below split into:
 *   - global (jobsPublic, scoringConfigActive)
 *   - candidate-scoped (applicationsCandidate, interviewsCandidate, profileScore)
 *   - company-scoped (everything that was previously recruiter-keyed)
 *   - membership-utility (companyMembership, userMemberships)
 */
export const TAGS = {
  scoringConfigActive: () => "scoring-config:active",
  jobsPublic: () => "jobs:public",
  jobDetail: (jobId: string) => `job:${jobId}`,
  applicationsCandidate: (candidateId: string) =>
    `applications:candidate:${candidateId}`,
  interviewsCandidate: (candidateId: string) =>
    `interviews:candidate:${candidateId}`,
  profileScore: (userId: string) => `profile-score:${userId}`,
  // ─── Company-scoped tags (Phase 2 multi-tenancy) ─────────────────────
  companyJobs: (companyId: string) => `jobs:company:${companyId}`,
  companyApplications: (companyId: string) => `applications:company:${companyId}`,
  companyInterviews: (companyId: string) => `interviews:company:${companyId}`,
  companyOffers: (companyId: string) => `offers:company:${companyId}`,
  companyShortlist: (companyId: string) => `shortlist:company:${companyId}`,
  companyDashboard: (companyId: string) => `dashboard:company:${companyId}`,
  companyMembership: (companyId: string) => `company-members:${companyId}`,
  userMemberships: (userId: string) => `user-memberships:${userId}`,
} as const;

/** Injection token for the ioredis client owned by CacheModule. */
export const CACHE_REDIS = Symbol("CACHE_REDIS");
