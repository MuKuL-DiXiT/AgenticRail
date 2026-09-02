export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

enum State {
  CLOSED,
  OPEN,
  HALF_OPEN,
}

export class CircuitBreaker {
  private state: State = State.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;

  private failureThreshold: number;
  private cooldownMs: number;
  private timeoutMs: number;
  private onStateChange?: (state: string) => void;

  constructor(
    failureThreshold: number,
    cooldownMs: number,
    timeoutMs: number,
    onStateChange?: (state: string) => void
  ) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.timeoutMs = timeoutMs;
    this.onStateChange = onStateChange;
  }

  async execute<T>(action: () => Promise<T>): Promise<T> {
    if (this.state === State.OPEN) {
      if (Date.now() - this.lastFailureTime > this.cooldownMs) {
        this.state = State.HALF_OPEN;
      } else {
        throw new CircuitBreakerError('Circuit is OPEN');
      }
    }

    try {
      const result = await this.withTimeout(action(), this.timeoutMs);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    if (this.state !== State.CLOSED) {
      this.state = State.CLOSED;
      this.onStateChange?.('CLOSED');
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state !== State.OPEN && (this.state === State.HALF_OPEN || this.failureCount >= this.failureThreshold)) {
      this.state = State.OPEN;
      this.onStateChange?.('OPEN');
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      clearTimeout(timeoutId);
    });
  }

  // For testing
  getState() {
    return this.state;
  }
}
