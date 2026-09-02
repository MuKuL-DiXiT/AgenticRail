import { z } from 'zod';

// Channels
export const CHANNELS = {
  TASKS: 'tasks', // Orchestrator broadcasts tasks here
  BIDS: 'bids', // Workers publish bids here
  AWARDS: 'awards', // Orchestrator publishes the award decision here
  RESULTS: 'results', // Workers publish task results here
  BOT_STATUS: 'bot_status', // Workers publish their health state here
} as const;

// Message Schemas
export const TaskBroadcastSchema = z.object({
  type: z.literal('TASK_BROADCAST'),
  task_id: z.string(),
  description: z.string(),
  max_budget: z.number(),
  correlation_id: z.string(),
  timestamp: z.string(),
});

export const BidSchema = z.object({
  type: z.literal('BID'),
  task_id: z.string(),
  bot_id: z.string(),
  amount: z.number(),
  token: z.string(), // Added for authentication
  correlation_id: z.string(),
  timestamp: z.string(),
});

export const AwardSchema = z.object({
  type: z.literal('AWARD'),
  task_id: z.string(),
  winning_bot_id: z.string(),
  winning_amount: z.number(),
  correlation_id: z.string(),
  timestamp: z.string(),
});

export const ResultSchema = z.object({
  type: z.literal('RESULT'),
  task_id: z.string(),
  bot_id: z.string(),
  output: z.string(),
  correlation_id: z.string(),
  timestamp: z.string(),
});

export const BotStatusSchema = z.object({
  type: z.literal('BOT_STATUS'),
  bot_id: z.string(),
  status: z.enum(['HEALTHY', 'DEGRADED']),
  timestamp: z.string(),
});

// TypeScript Types
export type TaskBroadcastMessage = z.infer<typeof TaskBroadcastSchema>;
export type BidMessage = z.infer<typeof BidSchema>;
export type AwardMessage = z.infer<typeof AwardSchema>;
export type ResultMessage = z.infer<typeof ResultSchema>;
export type BotStatusMessage = z.infer<typeof BotStatusSchema>;
