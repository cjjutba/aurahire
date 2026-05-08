import { Global, Module } from "@nestjs/common";

import { CACHE_REDIS } from "./cache.constants";
import { CacheService } from "./cache.service";
import { IORedisProvider } from "./redis.provider";

/**
 * Project-local cache module. Distinct from `@nestjs/cache-manager` (which is
 * also registered globally and used elsewhere) — this one owns its own
 * ioredis client so it can do tag indexing and atomic operations the
 * cache-manager abstraction doesn't expose.
 *
 * Marked @Global so feature modules don't need to import it. The raw
 * `CACHE_REDIS` ioredis client is exported alongside `CacheService` so feature
 * services that need atomic primitives (INCR, EXPIRE, scripting) can
 * `@Inject(CACHE_REDIS)` directly without re-registering the provider.
 */
@Global()
@Module({
  providers: [IORedisProvider, CacheService],
  exports: [CacheService, CACHE_REDIS],
})
export class CacheModule {}
