import { z } from 'zod';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // It will be run from dist/config or src/config so need to go up to root

const envSchema = z.object({
  GROQ_API_KEY_ORCHESTRATOR: z.string().min(1),
  GROQ_API_KEY_WORKER_1: z.string().min(1),
  GROQ_API_KEY_WORKER_2: z.string().min(1),
  GROQ_API_KEY_WORKER_3: z.string().min(1),
  GROQ_API_KEY_WORKER_4: z.string().min(1),
  GROQ_API_KEY_WORKER_5: z.string().min(1),
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
  MOCK_MODE: z.string().transform((val) => val === 'true'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  PORT: z.string().transform(Number).default('4000'),
  FRONTEND_PORT: z.string().transform(Number).default('5173'),
  ORCHESTRATOR_STARTING_BUDGET: z.string().transform(Number).default('1000'),
  BOT_RATE_LIMIT_PER_MINUTE: z.string().transform(Number).default('30'),
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.string().transform(Number).default('3'),
  CIRCUIT_BREAKER_COOLDOWN_MS: z.string().transform(Number).default('30000'),
  EXTERNAL_CALL_TIMEOUT_MS: z.string().transform(Number).default('10000'),
});

export function validateEnv(): z.infer<typeof envSchema> {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    for (const [key, errors] of Object.entries(result.error.flatten().fieldErrors)) {
      console.error(`- ${key}: ${errors?.join(', ')}`);
    }
    process.exit(1);
  }

  // Startup validation: If MOCK_MODE is false, check if keys are 'replace_me'
  if (!result.data.MOCK_MODE) {
    const keysToCheck = [
      'GROQ_API_KEY_ORCHESTRATOR',
      'GROQ_API_KEY_WORKER_1',
      'GROQ_API_KEY_WORKER_2',
      'GROQ_API_KEY_WORKER_3',
      'GROQ_API_KEY_WORKER_4',
      'GROQ_API_KEY_WORKER_5',
    ] as const;

    for (const key of keysToCheck) {
      if (result.data[key] === 'replace_me') {
        console.error(`❌ MOCK_MODE is false, but ${key} is still set to 'replace_me'.`);
        process.exit(1);
      }
    }
  }

  // Always check Razorpay keys for placeholders
  const rzpKeys = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'] as const;
  for (const key of rzpKeys) {
    if (result.data[key] === 'rzp_test_placeholder' || result.data[key] === 'placeholder_replace_me') {
      console.error(`❌ Missing real value for ${key}. Please update your .env file with test credentials. Do NOT use live keys.`);
      process.exit(1);
    }
  }

  return result.data;
}

export const env = validateEnv();
