import { RateLimiter, RateLimiterError } from './rateLimiter';

describe('RateLimiter', () => {
  it('allows requests within the limit', () => {
    const limiter = new RateLimiter(3);
    expect(() => limiter.consume('bot1')).not.toThrow();
    expect(() => limiter.consume('bot1')).not.toThrow();
    expect(() => limiter.consume('bot1')).not.toThrow();
  });

  it('throws RateLimiterError when limit exceeded', () => {
    const limiter = new RateLimiter(2);
    limiter.consume('bot2');
    limiter.consume('bot2');
    expect(() => limiter.consume('bot2')).toThrow(RateLimiterError);
  });
});
