import { INestApplicationContext, Logger } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { ServerOptions } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";

/**
 * Custom Socket.io adapter that wires the @socket.io/redis-adapter against
 * the existing REDIS_URL. Required for cross-instance broadcast when we run
 * more than one Railway instance — even with one instance today, wiring this
 * from day one means scaling out is a redeploy, not a refactor.
 *
 * Falls back to the default in-memory adapter if REDIS_URL is unset (matches
 * the cache-module fail-open posture).
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger("RedisIoAdapter");
  private pub?: Redis;
  private sub?: Redis;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.warn(
        "REDIS_URL not set; Socket.io will use in-memory adapter (single-instance only)",
      );
      return;
    }
    // Pub/sub adapter needs distinct connections (Redis pub/sub blocks the conn).
    this.pub = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(50 * 2 ** Math.min(times, 6), 2000),
    });
    this.sub = this.pub.duplicate();
    this.pub.on("error", (e) => this.logger.warn(`pub error: ${e.message}`));
    this.sub.on("error", (e) => this.logger.warn(`sub error: ${e.message}`));
    await Promise.all([this.pub.connect(), this.sub.connect()]).catch(() => {
      // ioredis with lazyConnect:false connects automatically; .connect() is
      // idempotent / errors here are also surfaced via the 'error' listeners.
    });
    this.logger.log("Socket.io Redis adapter connected");
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options) as {
      adapter: (a: ReturnType<typeof createAdapter>) => void;
    };
    if (this.pub && this.sub) {
      server.adapter(createAdapter(this.pub, this.sub));
    }
    return server;
  }
}
