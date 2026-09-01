import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { getSubClient, publishMessage } from '../pubsub/client';
import {
  CHANNELS,
  BidSchema,
  BidMessage,
  TaskBroadcastMessage,
  AwardMessage,
} from '../pubsub/messages';
import { validateBotToken, AuthError } from '../auth/tokens';

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
        // Handle result later
        console.log('Result received', messageStr);
      }
    });

    console.log(`Orchestrator started. Initial budget: ${this.budget}`);
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
    console.log(`[${correlationId}] Task ${taskId} broadcasted. Max budget: ${maxBudget}`);

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
        console.warn(
          `[${bid.correlation_id}] ❌ Security: Invalid bid from ${bid.bot_id}. Reason: ${err.message}`
        );
        return; // Reject bid silently on pubsub
      }

      const taskState = this.openTasks.get(bid.task_id);
      if (taskState) {
        taskState.bids.push(bid);
        console.log(
          `[${bid.correlation_id}] Valid bid received from ${bid.bot_id} for amount ${bid.amount}`
        );
      } else {
        console.log(
          `[${bid.correlation_id}] Bid received for unknown or closed task: ${bid.task_id}`
        );
      }
    } catch (err) {
      console.error('Failed to parse bid message', err);
    }
  }

  private async closeBiddingWindow(taskId: string) {
    const taskState = this.openTasks.get(taskId);
    if (!taskState) return;

    this.openTasks.delete(taskId);
    const { taskInfo, bids } = taskState;
    const { correlation_id, max_budget } = taskInfo;

    console.log(
      `[${correlation_id}] Bidding window closed for ${taskId}. Received ${bids.length} valid bids.`
    );

    if (bids.length === 0) {
      console.log(`[${correlation_id}] No valid bids received. Task aborted.`);
      return;
    }

    // Find the lowest bid that is <= max_budget
    const validBids = bids.filter((b) => b.amount <= max_budget);

    if (validBids.length === 0) {
      console.log(`[${correlation_id}] No bids met the max budget constraint of ${max_budget}.`);
      return;
    }

    // Sort ascending by amount
    validBids.sort((a, b) => a.amount - b.amount);
    const winningBid = validBids[0];

    // Check orchestrator budget
    if (this.budget < winningBid.amount) {
      console.log(
        `[${correlation_id}] Insufficient orchestrator budget (${this.budget}) to award bid of ${winningBid.amount}.`
      );
      return;
    }

    // Temporarily deduct budget in memory (Ledger will handle real deduction later)
    this.budget -= winningBid.amount;

    console.log(
      `[${correlation_id}] 🏆 Winner selected: ${winningBid.bot_id} for amount ${winningBid.amount}. Remaining budget: ${this.budget}`
    );

    const awardMsg: AwardMessage = {
      type: 'AWARD',
      task_id: taskId,
      winning_bot_id: winningBid.bot_id,
      winning_amount: winningBid.amount,
      correlation_id,
      timestamp: new Date().toISOString(),
    };

    await publishMessage(CHANNELS.AWARDS, awardMsg);
  }
}
