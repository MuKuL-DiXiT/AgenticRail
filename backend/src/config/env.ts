import { z } from 'zod';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const envSchema = z.object({
  BUYER_AGENT: z.string().default(''),
  SELLER_AGENT: z.string().default(''),
  BUYER_AGENT_API_KEY: z.string().default(''),
  SELLER_AGENT_API_KEY: z.string().default(''),
  GROQ_API_KEY_ORCHESTRATOR: z.string().default('mock_groq_key'),
  GROQ_API_KEY_WORKER_1: z.string().default('mock_groq_key'),
  GROQ_API_KEY_WORKER_2: z.string().default('mock_groq_key'),
  GROQ_API_KEY_WORKER_3: z.string().default('mock_groq_key'),
  GROQ_API_KEY_WORKER_4: z.string().default('mock_groq_key'),
  GROQ_API_KEY_WORKER_5: z.string().default('mock_groq_key'),
  RAZORPAY_KEY_ID: z.string().default('rzp_test_agentcart_mock'),
  RAZORPAY_KEY_SECRET: z.string().default('agentcart_test_secret'),
  RAZORPAY_WEBHOOK_SECRET: z.string().default('agentcart_webhook_secret'),
  JWT_SECRET: z.string().default('agentcart_jwt_secret_dev_2026'),
  MOCK_MODE: z.string().default('false').transform((val) => val === 'true'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  PORT: z.string().default('3000').transform(Number),
  FRONTEND_PORT: z.string().default('5173').transform(Number),
  SQLITE_DB_PATH: z.string().default('agentcart.db'),
  ORCHESTRATOR_STARTING_BUDGET: z.string().default('1000').transform(Number),
  BOT_RATE_LIMIT_PER_MINUTE: z.string().default('30').transform(Number),
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.string().default('3').transform(Number),
  CIRCUIT_BREAKER_COOLDOWN_MS: z.string().default('30000').transform(Number),
  EXTERNAL_CALL_TIMEOUT_MS: z.string().default('10000').transform(Number),
  CLOUDINARY_NAME: z.string().default(''),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  API_KEY: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  API_SECRET: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
});

export function validateEnv(): z.infer<typeof envSchema> {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.warn('[WARN] Some environment variables had issues, using robust defaults:', parsed.error.flatten().fieldErrors);
    return envSchema.parse({});
  }
  return parsed.data;
}

export const env = validateEnv();

export const CLOUDINARY_CONFIG = {
  cloud_name: env.CLOUDINARY_NAME || env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME || '',
  api_key: env.API_KEY || env.CLOUDINARY_API_KEY || process.env.API_KEY || '',
  api_secret: env.API_SECRET || env.CLOUDINARY_API_SECRET || process.env.API_SECRET || '',
};
