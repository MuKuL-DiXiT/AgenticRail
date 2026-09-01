import { TaskBroadcastSchema, BidSchema } from './messages';

describe('PubSub Message Schemas', () => {
  it('validates a correct TaskBroadcast message', () => {
    const valid = {
      type: 'TASK_BROADCAST',
      task_id: 'task_1',
      description: 'Do something',
      max_budget: 100,
      correlation_id: 'corr_1',
      timestamp: new Date().toISOString(),
    };

    expect(() => TaskBroadcastSchema.parse(valid)).not.toThrow();
  });

  it('rejects an invalid Bid message (missing token)', () => {
    const invalid = {
      type: 'BID',
      task_id: 'task_1',
      bot_id: 'worker_1',
      amount: 10,
      // token is missing
      correlation_id: 'corr_1',
      timestamp: new Date().toISOString(),
    };

    expect(() => BidSchema.parse(invalid)).toThrow();
  });

  it('validates a correct Bid message', () => {
    const valid = {
      type: 'BID',
      task_id: 'task_1',
      bot_id: 'worker_1',
      amount: 10,
      token: 'secret',
      correlation_id: 'corr_1',
      timestamp: new Date().toISOString(),
    };

    expect(() => BidSchema.parse(valid)).not.toThrow();
  });
});
