export class RateLimiterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimiterError';
  }
}

/**
 * A simple in-memory Token Bucket rate limiter per bot.
 * Allows bursts up to `limit` within the rolling `windowMs`.
 */
export class RateLimiter {
  private limit: number;
  private windowMs: number;

  // Maps bot_id to an array of request timestamps
  private botTimestamps: Map<string, number[]> = new Map();

  constructor(limitPerMinute: number) {
    this.limit = limitPerMinute;
    this.windowMs = 60 * 1000;
  }

  /**
   * Attempts to consume a token.
   * @throws RateLimiterError if the limit is exceeded.
   */
  consume(botId: string): void {
    const now = Date.now();
    let timestamps = this.botTimestamps.get(botId) || [];

    // Filter out timestamps older than the window
    timestamps = timestamps.filter((t) => now - t < this.windowMs);

    if (timestamps.length >= this.limit) {
      this.botTimestamps.set(botId, timestamps); // Update the state even if rejected
      throw new RateLimiterError(
        `Rate limit exceeded for bot ${botId}. Max ${this.limit} requests per minute.`
      );
    }

    timestamps.push(now);
    this.botTimestamps.set(botId, timestamps);
  }

  // Used for testing/cleanup
  clear(botId: string): void {
    this.botTimestamps.delete(botId);
  }
}
