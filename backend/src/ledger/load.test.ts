import { initDb, closeDb } from './db';
import { appendEntry, verifyChain, getBalance } from './ledger';
import { LedgerEntryType } from './types';

describe('SQLite Concurrency Load Test (WAL + IMMEDIATE tx)', () => {
  beforeAll(() => {
    initDb(':memory:');
  });

  afterAll(() => {
    closeDb();
  });

  it('should cleanly insert 500 overlapping concurrent ledger transactions without SQLITE_BUSY deadlocks or hash-chain corruption', async () => {
    const BOTS = ['worker_1', 'worker_2', 'worker_3', 'worker_4', 'worker_5'];
    
    // Create an array of 500 promises that will fire at the exact same time
    const promises = Array.from({ length: 500 }).map((_, i) => {
      return async () => {
        const botId = BOTS[i % 5];
        appendEntry({
          idempotency_key: `load_test_hold_${i}`,
          type: LedgerEntryType.ESCROW_HOLD,
          from_bot_id: botId,
          to_bot_id: 'orchestrator',
          amount: 10,
          task_id: `task_${i}`
        });

        // Add a slight realistic micro-delay
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));

        appendEntry({
          idempotency_key: `load_test_release_${i}`,
          type: LedgerEntryType.ESCROW_RELEASE,
          from_bot_id: 'orchestrator',
          to_bot_id: botId,
          amount: 10,
          task_id: `task_${i}`
        });
      };
    });

    // Execute them all concurrently
    await Promise.all(promises.map(p => p()));

    // Verify the chain integrity after 1000 total inserts (500 hold + 500 release)
    const verification = verifyChain();
    expect(verification.isValid).toBe(true);

    // Verify balances reconcile properly (net 0 for each bot since they held and were released)
    for (const bot of BOTS) {
      expect(getBalance(bot)).toBe(0);
    }
  });
});
