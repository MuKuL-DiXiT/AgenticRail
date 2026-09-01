import { Orchestrator } from './index';
import * as pubsubClient from '../pubsub/client';
import { env } from '../config/env';
import { BidMessage } from '../pubsub/messages';

// Mock the Redis client
jest.mock('../pubsub/client', () => {
  return {
    getSubClient: jest.fn().mockReturnValue({
      subscribe: jest.fn(),
      on: jest.fn(),
    }),
    publishMessage: jest.fn(),
  };
});

describe('Orchestrator Logic', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    orchestrator = new Orchestrator();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initializes with the correct starting budget', () => {
    expect(orchestrator.getBudget()).toBe(env.ORCHESTRATOR_STARTING_BUDGET);
  });

  it('broadcasts task and selects the lowest valid bid within the budget', async () => {
    const taskId = await orchestrator.broadcastTask('Do work', 100);
    expect(pubsubClient.publishMessage).toHaveBeenCalledWith(
      'tasks',
      expect.objectContaining({
        type: 'TASK_BROADCAST',
        task_id: taskId,
        max_budget: 100,
      })
    );

    // Simulate receiving bids
    // We can cast orchestrator to any to access the private handleBid method for testing
    const handleBid = (orchestrator as any).handleBid.bind(orchestrator);

    const bid1: BidMessage = {
      type: 'BID',
      task_id: taskId,
      bot_id: 'worker_1',
      amount: 90,
      token: env.GROQ_API_KEY_WORKER_1,
      correlation_id: 'c1',
      timestamp: new Date().toISOString(),
    };

    const bid2: BidMessage = {
      type: 'BID',
      task_id: taskId,
      bot_id: 'worker_2',
      amount: 80,
      token: env.GROQ_API_KEY_WORKER_2,
      correlation_id: 'c1',
      timestamp: new Date().toISOString(),
    };

    handleBid(JSON.stringify(bid1));
    handleBid(JSON.stringify(bid2));

    // Fast-forward time to trigger the closeBiddingWindow timeout (2000ms)
    await jest.advanceTimersByTimeAsync(2000);

    // Should publish the award to worker_2 (amount 80 is lower than 90)
    expect(pubsubClient.publishMessage).toHaveBeenCalledWith(
      'awards',
      expect.objectContaining({
        type: 'AWARD',
        task_id: taskId,
        winning_bot_id: 'worker_2',
        winning_amount: 80,
      })
    );

    // Budget should be deducted
    expect(orchestrator.getBudget()).toBe(env.ORCHESTRATOR_STARTING_BUDGET - 80);
  });

  it('gracefully handles zero bids', async () => {
    await orchestrator.broadcastTask('No one wants this', 10);

    // Fast-forward
    await jest.advanceTimersByTimeAsync(2000);

    // No award published
    expect(pubsubClient.publishMessage).toHaveBeenCalledTimes(1); // Only the task broadcast
    expect(orchestrator.getBudget()).toBe(env.ORCHESTRATOR_STARTING_BUDGET);
  });

  it('ignores bids that exceed max budget', async () => {
    const taskId = await orchestrator.broadcastTask('Cheap task', 50);
    const handleBid = (orchestrator as any).handleBid.bind(orchestrator);

    const bid: BidMessage = {
      type: 'BID',
      task_id: taskId,
      bot_id: 'worker_1',
      amount: 60,
      token: env.GROQ_API_KEY_WORKER_1,
      correlation_id: 'c1',
      timestamp: new Date().toISOString(),
    };
    handleBid(JSON.stringify(bid));

    await jest.advanceTimersByTimeAsync(2000);

    // No award published
    expect(pubsubClient.publishMessage).toHaveBeenCalledTimes(1);
  });

  it('ignores bids with invalid tokens', async () => {
    const taskId = await orchestrator.broadcastTask('Task', 100);
    const handleBid = (orchestrator as any).handleBid.bind(orchestrator);

    const invalidBid = {
      type: 'BID',
      task_id: taskId,
      bot_id: 'worker_1',
      amount: 40,
      token: 'INVALID_TOKEN',
      correlation_id: 'c1',
      timestamp: new Date().toISOString(),
    };
    handleBid(JSON.stringify(invalidBid));

    await jest.advanceTimersByTimeAsync(2000);

    // No award published
    expect(pubsubClient.publishMessage).toHaveBeenCalledTimes(1);
  });
});
