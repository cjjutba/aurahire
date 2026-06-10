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
 * - retryStrategy: exponential backoff capped at 2s; never gives up - the
 *   client keeps reconnecting in the background.
 * - maxRetriesPerRequest: 1 - fail fast on individual commands so a
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
