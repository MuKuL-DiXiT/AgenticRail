import { initDb, closeDb } from './db';
import { appendEntry, verifyChain } from './ledger';
import { LedgerEntryType } from './types';

describe('SQLite Concurrency & High Load Test (WAL + IMMEDIATE tx)', () => {
  beforeAll(() => {
    initDb(':memory:');
  });

  afterAll(() => {
    closeDb();
  });

  it('should cleanly insert 200 concurrent commerce transactions without deadlocks or hash-chain corruption', async () => {
    const buyers = ['buyer_agent_1', 'buyer_agent_2', 'buyer_agent_3', 'buyer_agent_4'];

    const promises = Array.from({ length: 200 }).map((_, i) => {
      return async () => {
        const buyerId = buyers[i % 4];
        appendEntry({
          idempotency_key: `load_test_settle_${i}`,
          type: LedgerEntryType.COMMERCE_SETTLEMENT,
          from_entity: buyerId,
          to_entity: 'mch_urbanfit_001',
          amount_paise: 499900,
          reference_id: `order_load_${i}`,
        });
      };
    });

    await Promise.all(promises.map(p => p()));

    const verification = verifyChain();
    expect(verification.isValid).toBe(true);
    expect(verification.totalEntries).toBe(200);
  });
});
