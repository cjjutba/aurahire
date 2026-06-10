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
  /** Tag for telemetry log lines - defaults to the first tag or "untagged". */
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
      // 3. Store + index tags. Failures here MUST NOT propagate - we have the
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
