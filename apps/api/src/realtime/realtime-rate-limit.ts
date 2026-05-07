/**
 * Tiny in-memory token-bucket-style limiter, scoped per Socket.io client id.
 * Used only for inbound `subscribe`/`unsubscribe` messages — server-emitted
 * events are server-trusted and unlimited.
 *
 * Limit: 30 messages per 60s rolling window per socket. Tuning is intentional:
 * the only legitimate use is a few subscribes per page nav, so even noisy SPAs
 * stay well under.
 */
export class SocketRateLimiter {
  private readonly windowMs = 60_000;
  private readonly limit = 30;
  private readonly hits = new Map<string, number[]>();

  /**
   * Returns true if the message is allowed; false if the socket is over its
   * budget for the current window. The gateway disconnects on false.
   */
  allow(socketId: string): boolean {
    const now = Date.now();
    const bucket = this.hits.get(socketId) ?? [];
    const fresh = bucket.filter((ts) => now - ts < this.windowMs);
    if (fresh.length >= this.limit) {
      this.hits.set(socketId, fresh);
      return false;
    }
    fresh.push(now);
    this.hits.set(socketId, fresh);
    return true;
  }

  forget(socketId: string): void {
    this.hits.delete(socketId);
  }
}
