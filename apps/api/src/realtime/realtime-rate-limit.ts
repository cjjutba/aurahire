/**
 * Tiny in-memory token-bucket-style limiter, scoped per Socket.io client id
 * AND per message kind. Used only for inbound `subscribe`/`unsubscribe`
 * messages - server-emitted events are server-trusted and unlimited.
 *
 * Limit: 30 messages per 60s rolling window per (socket, kind). Subscribe and
 * unsubscribe get separate budgets so a user rapidly switching between job
 * pages doesn't burn through both kinds in the same window.
 */
export type SocketMessageKind = "subscribe" | "unsubscribe";

export class SocketRateLimiter {
  private readonly windowMs = 60_000;
  private readonly limit = 30;
  // Composite key: `${socketId}:${kind}` - keeps the data structure flat
  // while giving subscribe and unsubscribe independent budgets.
  private readonly hits = new Map<string, number[]>();

  /**
   * Returns true if the message is allowed; false if the (socket, kind) is
   * over its budget for the current window. The gateway disconnects on false.
   */
  allow(socketId: string, kind: SocketMessageKind): boolean {
    const key = `${socketId}:${kind}`;
    const now = Date.now();
    const bucket = this.hits.get(key) ?? [];
    const fresh = bucket.filter((ts) => now - ts < this.windowMs);
    if (fresh.length >= this.limit) {
      this.hits.set(key, fresh);
      return false;
    }
    fresh.push(now);
    this.hits.set(key, fresh);
    return true;
  }

  /** Drop both subscribe and unsubscribe buckets for a disconnecting socket. */
  forget(socketId: string): void {
    this.hits.delete(`${socketId}:subscribe`);
    this.hits.delete(`${socketId}:unsubscribe`);
  }
}
