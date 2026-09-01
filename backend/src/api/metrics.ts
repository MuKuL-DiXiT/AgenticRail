import { getSubClient } from '../pubsub/client';
import { CHANNELS } from '../pubsub/messages';

export class MetricsCollector {
  private totalBids = 0;
  private totalTasks = 0;
  private totalAwards = 0;
  private totalResults = 0;
  private botWins: Record<string, number> = {};
  
  // Track latencies
  private taskStartTimes: Record<string, number> = {};
  private bidLatencies: number[] = [];
  private escrowDurations: number[] = [];

  constructor() {}

  async start() {
    const sub = getSubClient();
    await sub.subscribe(CHANNELS.TASKS, CHANNELS.BIDS, CHANNELS.AWARDS, CHANNELS.RESULTS);

    sub.on('message', (channel, messageStr) => {
      try {
        const raw = JSON.parse(messageStr);
        const now = Date.now();

        if (channel === CHANNELS.TASKS) {
          this.totalTasks++;
          this.taskStartTimes[raw.task_id] = now;
        } else if (channel === CHANNELS.BIDS) {
          this.totalBids++;
          if (this.taskStartTimes[raw.task_id]) {
            this.bidLatencies.push(now - this.taskStartTimes[raw.task_id]);
          }
        } else if (channel === CHANNELS.AWARDS) {
          this.totalAwards++;
          this.botWins[raw.winning_bot_id] = (this.botWins[raw.winning_bot_id] || 0) + 1;
          this.taskStartTimes[`award_${raw.task_id}`] = now; // track escrow start
        } else if (channel === CHANNELS.RESULTS) {
          this.totalResults++;
          if (this.taskStartTimes[`award_${raw.task_id}`]) {
            this.escrowDurations.push(now - this.taskStartTimes[`award_${raw.task_id}`]);
          }
        }
      } catch (e) {
        // Ignore parse errors in metrics
      }
    });
  }

  getMetrics() {
    const avgBidLatency = this.bidLatencies.length ? this.bidLatencies.reduce((a,b) => a+b, 0) / this.bidLatencies.length : 0;
    const avgEscrowDuration = this.escrowDurations.length ? this.escrowDurations.reduce((a,b) => a+b, 0) / this.escrowDurations.length : 0;
    
    return {
      totalTasks: this.totalTasks,
      totalBids: this.totalBids,
      totalAwards: this.totalAwards,
      totalResults: this.totalResults,
      avgBidLatencyMs: avgBidLatency,
      avgEscrowDurationMs: avgEscrowDuration,
      botWinRates: Object.keys(this.botWins).reduce((acc, bot) => {
        acc[bot] = this.botWins[bot] / this.totalTasks;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

export const metricsCollector = new MetricsCollector();
