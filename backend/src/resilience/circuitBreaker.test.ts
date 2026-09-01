import { CircuitBreaker, CircuitBreakerError } from './circuitBreaker';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('remains closed on successful actions', async () => {
    const cb = new CircuitBreaker(3, 10000, 1000);
    const result = await cb.execute(async () => 'success');
    expect(result).toBe('success');
    expect(cb.getState()).toBe(0); // CLOSED
  });

  it('trips to open state after consecutive failures', async () => {
    const cb = new CircuitBreaker(2, 10000, 1000);

    await expect(
      cb.execute(async () => {
        throw new Error('fail');
      })
    ).rejects.toThrow();
    expect(cb.getState()).toBe(0); // STILL CLOSED (1 fail)

    await expect(
      cb.execute(async () => {
        throw new Error('fail');
      })
    ).rejects.toThrow();
    expect(cb.getState()).toBe(1); // OPEN (2 fails)

    // Now it should fast-fail with CircuitBreakerError
    await expect(cb.execute(async () => 'should not run')).rejects.toThrow(CircuitBreakerError);
  });

  it('recovers to half-open and then closed after cooldown', async () => {
    const cb = new CircuitBreaker(1, 5000, 1000);

    // Fail once -> OPEN
    await expect(
      cb.execute(async () => {
        throw new Error('fail');
      })
    ).rejects.toThrow();
    expect(cb.getState()).toBe(1); // OPEN

    // Fast forward past cooldown
    jest.advanceTimersByTime(5001);

    // Should succeed and close
    const result = await cb.execute(async () => 'success');
    expect(result).toBe('success');
    expect(cb.getState()).toBe(0); // CLOSED
  });

  it('throws timeout error if action takes too long', async () => {
    jest.useRealTimers();
    const cb = new CircuitBreaker(3, 10000, 100);

    const slowAction = () => new Promise((resolve) => setTimeout(() => resolve('done'), 200));

    await expect(cb.execute(slowAction)).rejects.toThrow('Operation timed out after 100ms');
  });
});
