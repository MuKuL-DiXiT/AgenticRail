import { env } from '../config/env';

export const BOT_TOKENS: Record<string, string> = {
  worker_1: env.GROQ_API_KEY_WORKER_1,
  worker_2: env.GROQ_API_KEY_WORKER_2,
  worker_3: env.GROQ_API_KEY_WORKER_3,
  worker_4: env.GROQ_API_KEY_WORKER_4,
  worker_5: env.GROQ_API_KEY_WORKER_5,
};

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Validates if the provided token matches the expected token for the given bot_id.
 *
 * @param botId The bot identifier (e.g. 'worker_1')
 * @param token The token provided in the bid message
 * @throws AuthError if validation fails
 */
export function validateBotToken(botId: string, token: string): void {
  const expectedToken = BOT_TOKENS[botId];

  if (!expectedToken) {
    throw new AuthError(`Unknown bot ID: ${botId}`);
  }

  if (expectedToken !== token) {
    throw new AuthError(`Invalid token provided for bot ID: ${botId}`);
  }
}
