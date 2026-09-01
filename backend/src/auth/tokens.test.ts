import { validateBotToken, AuthError, BOT_TOKENS } from './tokens';
import { env } from '../config/env';

describe('Auth Layer: Tokens', () => {
  it('validates a correct token for a valid bot', () => {
    // Should not throw
    expect(() => validateBotToken('worker_1', env.GROQ_API_KEY_WORKER_1)).not.toThrow();
  });

  it('rejects an invalid token for a valid bot', () => {
    expect(() => validateBotToken('worker_1', 'wrong_token')).toThrow(AuthError);
    expect(() => validateBotToken('worker_1', 'wrong_token')).toThrow(
      'Invalid token provided for bot ID: worker_1'
    );
  });

  it('rejects an unknown bot ID', () => {
    expect(() => validateBotToken('unknown_bot', 'some_token')).toThrow(AuthError);
    expect(() => validateBotToken('unknown_bot', 'some_token')).toThrow(
      'Unknown bot ID: unknown_bot'
    );
  });
});
