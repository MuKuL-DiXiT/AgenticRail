import { WorkerBot } from './bot';
import * as pubsubClient from '../pubsub/client';
import * as groqService from '../services/groq';

// Mock dependencies
jest.mock('../pubsub/client', () => ({
  getSubClient: jest.fn().mockReturnValue({
    subscribe: jest.fn(),
    on: jest.fn(),
  }),
  publishMessage: jest.fn(),
}));

jest.mock('../services/groq', () => ({
  invokeGroq: jest.fn().mockResolvedValue('MOCKED_RESULT'),
}));

describe('WorkerBot', () => {
  it('bids on tasks based on personality', async () => {
    const alwaysBidPersonality = jest.fn().mockReturnValue({ willBid: true, amount: 10 });
    const bot = new WorkerBot('test_bot', 'key', alwaysBidPersonality);

    await bot.start();

    // Simulate receiving a TASK_BROADCAST message
    const handleTaskBroadcast = (bot as any).handleTaskBroadcast.bind(bot);
    await handleTaskBroadcast(
      JSON.stringify({
        type: 'TASK_BROADCAST',
        task_id: 'task_1',
        description: 'do work',
        max_budget: 100,
        correlation_id: 'c1',
        timestamp: new Date().toISOString(),
      })
    );

    expect(alwaysBidPersonality).toHaveBeenCalledWith('do work', 100);
    expect(pubsubClient.publishMessage).toHaveBeenCalledWith(
      'bids',
      expect.objectContaining({
        type: 'BID',
        bot_id: 'test_bot',
        amount: 10,
      })
    );
  });

  it('executes Groq and publishes result when winning an award', async () => {
    const bot = new WorkerBot('test_bot', 'key', () => ({ willBid: true, amount: 10 }));
    const handleAward = (bot as any).handleAward.bind(bot);

    await handleAward(
      JSON.stringify({
        type: 'AWARD',
        task_id: 'task_1',
        winning_bot_id: 'test_bot',
        winning_amount: 10,
        correlation_id: 'c1',
        timestamp: new Date().toISOString(),
      })
    );

    expect(groqService.invokeGroq).toHaveBeenCalledWith('test_bot', 'key', 'Perform task: task_1');
    expect(pubsubClient.publishMessage).toHaveBeenCalledWith(
      'results',
      expect.objectContaining({
        type: 'RESULT',
        bot_id: 'test_bot',
        output: 'MOCKED_RESULT',
        task_id: 'task_1',
      })
    );
  });

  it('ignores awards for other bots', async () => {
    const bot = new WorkerBot('test_bot', 'key', () => ({ willBid: true, amount: 10 }));
    const handleAward = (bot as any).handleAward.bind(bot);

    await handleAward(
      JSON.stringify({
        type: 'AWARD',
        task_id: 'task_1',
        winning_bot_id: 'OTHER_BOT',
        winning_amount: 10,
        correlation_id: 'c1',
        timestamp: new Date().toISOString(),
      })
    );

    // Shouldn't invoke groq or publish result
    expect(pubsubClient.publishMessage).not.toHaveBeenCalledWith('results', expect.anything());
  });
});
