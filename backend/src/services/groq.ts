import { Groq } from 'groq-sdk';
import { env } from '../config/env';
import { CircuitBreaker } from '../resilience/circuitBreaker';
import { publishMessage } from '../pubsub/client';
import { CHANNELS, BotStatusMessage } from '../pubsub/messages';

const circuitBreakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(botId: string): CircuitBreaker {
  if (!circuitBreakers.has(botId)) {
    circuitBreakers.set(
      botId,
      new CircuitBreaker(
        env.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
        env.CIRCUIT_BREAKER_COOLDOWN_MS,
        env.EXTERNAL_CALL_TIMEOUT_MS,
        (state) => {
          const status = state === 'OPEN' ? 'DEGRADED' : 'HEALTHY';
          const msg: BotStatusMessage = {
            type: 'BOT_STATUS',
            bot_id: botId,
            status,
            timestamp: new Date().toISOString(),
          };
          publishMessage(CHANNELS.BOT_STATUS, msg).catch(console.error);
        }
      )
    );
  }
  return circuitBreakers.get(botId)!;
}

function getGroqClient(apiKey: string): Groq {
  return new Groq({ apiKey });
}

export async function invokeGroq(botId: string, apiKey: string, prompt: string): Promise<string> {
  const cb = getCircuitBreaker(botId);

  return cb.execute(async () => {
    if (env.MOCK_MODE) {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      return `MOCK OUTPUT for prompt: "${prompt}" by bot ${botId}`;
    }

    const client = getGroqClient(apiKey);
    const completion = await client.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-8b-8192',
    });

    return completion.choices[0]?.message?.content || 'NO_CONTENT';
  });
}
