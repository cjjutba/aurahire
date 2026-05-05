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
