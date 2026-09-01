import { getSubClient, publishMessage } from '../pubsub/client';
import {
  CHANNELS,
  TaskBroadcastSchema,
  AwardSchema,
  BidMessage,
  ResultMessage,
} from '../pubsub/messages';
import { RateLimiter } from '../resilience/rateLimiter';
import { invokeGroq } from '../services/groq';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export type BotPersonality = (
  taskDesc: string,
  maxBudget: number
) => { willBid: boolean; amount: number };

export class WorkerBot {
  public id: string;
  private apiKey: string;
  private personality: BotPersonality;
  private rateLimiter: RateLimiter;

  constructor(id: string, apiKey: string, personality: BotPersonality) {
    this.id = id;
    this.apiKey = apiKey;
    this.personality = personality;
    this.rateLimiter = new RateLimiter(env.BOT_RATE_LIMIT_PER_MINUTE);
  }

  async start() {
    const sub = getSubClient();
    // In ioredis, to subscribe to multiple channels and keep callbacks isolated,
    // we use a single `on('message')` switch. But since Orchestrator also uses getSubClient(),
    // wait, getSubClient() returns a singleton. If Orchestrator and Workers are in the same process,
    // they share the same subClient instance. This is fine, but they all need to check the channel.

    // Subscribe if not already subscribed by another part of the app
    await sub.subscribe(CHANNELS.TASKS, CHANNELS.AWARDS);

    sub.on('message', async (channel, messageStr) => {
      try {
        if (channel === CHANNELS.TASKS) {
          await this.handleTaskBroadcast(messageStr);
        } else if (channel === CHANNELS.AWARDS) {
          await this.handleAward(messageStr);
        }
      } catch (err: any) {
        logger.error(`[Worker ${this.id}] Error handling message:`, { error: err.message, bot_id: this.id });
      }
    });

    logger.info(`Worker ${this.id} started.`, { bot_id: this.id });
  }

  private async handleTaskBroadcast(messageStr: string) {
    const raw = JSON.parse(messageStr);
    const task = TaskBroadcastSchema.parse(raw);

    const { willBid, amount } = this.personality(task.description, task.max_budget);

    if (willBid) {
      try {
        this.rateLimiter.consume(this.id);

        const bid: BidMessage = {
          type: 'BID',
          task_id: task.task_id,
          bot_id: this.id,
          amount,
          token: this.apiKey, // Web2 style simple auth
          correlation_id: task.correlation_id,
          timestamp: new Date().toISOString(),
        };

        await publishMessage(CHANNELS.BIDS, bid);
        logger.info(`Submitted bid of ${amount}`, { correlation_id: task.correlation_id, bot_id: this.id, amount });
      } catch (err: any) {
        if (err.name === 'RateLimiterError') {
          logger.warn(`Rate limited. Cannot bid.`, { correlation_id: task.correlation_id, bot_id: this.id });
        } else {
          logger.error('Failed to submit bid', { correlation_id: task.correlation_id, bot_id: this.id, error: err.message });
        }
      }
    }
  }

  private async handleAward(messageStr: string) {
    const raw = JSON.parse(messageStr);
    const award = AwardSchema.parse(raw);

    if (award.winning_bot_id !== this.id) {
      // Loser stands down cleanly
      return;
    }

    logger.info(`🎉 Won task ${award.task_id}! Working...`, { correlation_id: award.correlation_id, bot_id: this.id, task_id: award.task_id });

    try {
      const output = await invokeGroq(this.id, this.apiKey, `Perform task: ${award.task_id}`);

      const result: ResultMessage = {
        type: 'RESULT',
        task_id: award.task_id,
        bot_id: this.id,
        output,
        correlation_id: award.correlation_id,
        timestamp: new Date().toISOString(),
      };

      await publishMessage(CHANNELS.RESULTS, result);
      logger.info(`Finished task ${award.task_id} and submitted result.`, { correlation_id: award.correlation_id, bot_id: this.id, task_id: award.task_id });
    } catch (err: any) {
      logger.error(`Failed to complete task. Circuit breaker or Groq error`, { correlation_id: award.correlation_id, bot_id: this.id, task_id: award.task_id, error: err.message });
    }
  }
}
