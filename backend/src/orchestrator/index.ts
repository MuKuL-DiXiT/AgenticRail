import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { getSubClient, publishMessage } from '../pubsub/client';
import {
  CHANNELS,
  BidSchema,
  BidMessage,
  TaskBroadcastMessage,
  AwardMessage,
  ResultSchema,
} from '../pubsub/messages';
import { validateBotToken } from '../auth/tokens';
import { appendEntry } from '../ledger/ledger';
import { LedgerEntryType } from '../ledger/types';
import { logger } from '../utils/logger';

export class Orchestrator {
  private budget: number;
  private openTasks: Map<
    string,
    {
      taskInfo: TaskBroadcastMessage;
      bids: BidMessage[];
      resolveWindow: NodeJS.Timeout;
    }
  > = new Map();

  private awardedTasks: Map<string, { bot_id: string; amount: number }> = new Map();

  constructor() {
    this.budget = env.ORCHESTRATOR_STARTING_BUDGET;
  }

  getBudget() {
    return this.budget;
  }

  async start() {
    const sub = getSubClient();
    await sub.subscribe(CHANNELS.BIDS, CHANNELS.RESULTS);

    sub.on('message', (channel, messageStr) => {
      if (channel === CHANNELS.BIDS) {
        this.handleBid(messageStr);
      } else if (channel === CHANNELS.RESULTS) {
        this.handleResult(messageStr);
      }
    });

    logger.info(`Orchestrator started. Initial budget: ${this.budget}`);
  }

  async broadcastTask(description: string, maxBudget: number) {
    const taskId = `task_${uuidv4()}`;
    const correlationId = `corr_${uuidv4()}`;

    const taskMessage: TaskBroadcastMessage = {
      type: 'TASK_BROADCAST',
      task_id: taskId,
      description,
      max_budget: maxBudget,
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
    };

    // Open bidding window (2 seconds)
    const resolveWindow = setTimeout(() => {
      this.closeBiddingWindow(taskId);
    }, 2000);

    this.openTasks.set(taskId, {
      taskInfo: taskMessage,
      bids: [],
      resolveWindow,
    });

    await publishMessage(CHANNELS.TASKS, taskMessage);
    logger.info(`Task broadcasted`, { correlation_id: correlationId, task_id: taskId, max_budget: maxBudget });

    return taskId;
  }

  private handleBid(messageStr: string) {
    try {
      const raw = JSON.parse(messageStr);
      const bid = BidSchema.parse(raw);

      // Validate Auth Token
      try {
        validateBotToken(bid.bot_id, bid.token);
      } catch (err: any) {
        logger.warn(`Security: Invalid bid`, { correlation_id: bid.correlation_id, bot_id: bid.bot_id, error: err.message });
        return; // Reject bid silently on pubsub
      }

      const taskState = this.openTasks.get(bid.task_id);
      if (taskState) {
        taskState.bids.push(bid);
        logger.info(`Valid bid received`, { correlation_id: bid.correlation_id, bot_id: bid.bot_id, amount: bid.amount, task_id: bid.task_id });
      } else {
        logger.warn(`Bid received for unknown or closed task`, { correlation_id: bid.correlation_id, task_id: bid.task_id });
      }
    } catch (err: any) {
      logger.error('Failed to parse bid message', { error: err.message });
    }
  }

  private handleResult(messageStr: string) {
    try {
      const raw = JSON.parse(messageStr);
      const result = ResultSchema.parse(raw);

      const { task_id, bot_id, output, correlation_id } = result;

      // In a real system, we might ask the judge bot to evaluate the result.
      // For now, if output starts with 'MOCK OUTPUT' or isn't empty/NO_CONTENT, we release.
      // If it fails, we refund.
      let action: LedgerEntryType;

      if (output && output !== 'NO_CONTENT') {
        action = LedgerEntryType.ESCROW_RELEASE;
        logger.info(`Result ACCEPTED`, { correlation_id, task_id });
      } else {
        action = LedgerEntryType.ESCROW_REFUND;
        logger.warn(`Result REJECTED`, { correlation_id, task_id });
      }

      const awarded = this.awardedTasks.get(task_id);
      if (!awarded || awarded.bot_id !== bot_id) {
        logger.warn(`Ignored result for unknown or mismatched task/bot`, { correlation_id, task_id, bot_id });
        return;
      }

      try {
        appendEntry({
          idempotency_key: `resolve_${task_id}`,
          type: action,
          from_entity: 'orchestrator',
          to_entity: bot_id,
          amount_paise: Math.round(awarded.amount * 100),
          reference_id: task_id,
        });

        this.awardedTasks.delete(task_id);

        if (action === LedgerEntryType.ESCROW_REFUND) {
          this.budget += awarded.amount;
          logger.info(`Budget refunded`, { correlation_id, new_budget: this.budget });
        }
      } catch (err: any) {
        logger.error(`Failed to log resolution to ledger`, { correlation_id, error: err.message });
      }
    } catch (err: any) {
      logger.error('Failed to handle result', { error: err.message });
    }
  }

  private async closeBiddingWindow(taskId: string) {
    const taskState = this.openTasks.get(taskId);
    if (!taskState) return;

    this.openTasks.delete(taskId);
    const { taskInfo, bids } = taskState;
    const { correlation_id, max_budget } = taskInfo;

    logger.info(`Bidding window closed`, { correlation_id, task_id: taskId, bids_count: bids.length });

    if (bids.length === 0) {
      logger.info(`No valid bids received. Task aborted.`, { correlation_id, task_id: taskId });
      return;
    }

    // Find the lowest bid that is <= max_budget
    const validBids = bids.filter((b) => b.amount <= max_budget);

    if (validBids.length === 0) {
      logger.info(`No bids met the max budget constraint`, { correlation_id, task_id: taskId, max_budget });
      return;
    }

    // Sort ascending by amount
    validBids.sort((a, b) => a.amount - b.amount);
    const winningBid = validBids[0];

    // Check orchestrator budget
    if (this.budget < winningBid.amount) {
      logger.warn(`Insufficient orchestrator budget to award bid`, { correlation_id, task_id: taskId, budget: this.budget, bid_amount: winningBid.amount });
      return;
    }

    // Temporarily deduct budget in memory (Ledger will handle real deduction later)
    this.budget -= winningBid.amount;

    // Record ESCROW_HOLD to the Immutable Ledger
    try {
      appendEntry({
        idempotency_key: `hold_${taskId}`,
        type: LedgerEntryType.ESCROW_HOLD,
        from_entity: 'orchestrator',
        to_entity: winningBid.bot_id,
        amount_paise: Math.round(winningBid.amount * 100),
        reference_id: taskId,
      });
    } catch (err: any) {
      logger.error(`Failed to hold escrow. Aborting award`, { correlation_id, task_id: taskId, error: err.message });
      return;
    }

    logger.info(`[WINNER] Winner selected`, { correlation_id, task_id: taskId, winning_bot_id: winningBid.bot_id, amount: winningBid.amount, remaining_budget: this.budget });

    const awardMsg: AwardMessage = {
      type: 'AWARD',
      task_id: taskId,
      winning_bot_id: winningBid.bot_id,
      winning_amount: winningBid.amount,
      correlation_id,
      timestamp: new Date().toISOString(),
    };

    this.awardedTasks.set(taskId, { bot_id: winningBid.bot_id, amount: winningBid.amount });

    await publishMessage(CHANNELS.AWARDS, awardMsg);
  }
}
