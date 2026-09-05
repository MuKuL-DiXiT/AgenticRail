import { getDb, initDb, closeDb } from './db';
import { appendEntry, verifyChain, _corruptEntryForDemo } from './ledger';
import { LedgerEntryType } from './types';

describe('Ledger Rigor & Cryptographic Hash Chain', () => {
  beforeEach(() => {
    initDb(':memory:');
  });

  afterEach(() => {
    closeDb();
  });

  it('maintains chain integrity across N sequential appends', () => {
    for (let i = 0; i < 50; i++) {
      appendEntry({
        idempotency_key: `key_${i}`,
        type: LedgerEntryType.COMMERCE_SETTLEMENT,
        from_entity: 'buyer_agent_001',
        to_entity: `merchant_${i}`,
        amount_paise: 499900,
        reference_id: `order_${i}`,
      });
    }
    const verification = verifyChain();
    expect(verification.isValid).toBe(true);
    expect(verification.totalEntries).toBe(50);
  });

  it('detects tampering with a historical block and localizes it', () => {
    appendEntry({
      idempotency_key: 't1',
      type: LedgerEntryType.COMMERCE_SETTLEMENT,
      from_entity: 'buyer_1',
      to_entity: 'merchant_1',
      amount_paise: 100000,
      reference_id: 'order_1',
    });
    const e2 = appendEntry({
      idempotency_key: 't2',
      type: LedgerEntryType.COMMERCE_SETTLEMENT,
      from_entity: 'buyer_2',
      to_entity: 'merchant_1',
      amount_paise: 200000,
      reference_id: 'order_2',
    });
    appendEntry({
      idempotency_key: 't3',
      type: LedgerEntryType.COMMERCE_SETTLEMENT,
      from_entity: 'buyer_3',
      to_entity: 'merchant_1',
      amount_paise: 300000,
      reference_id: 'order_3',
    });

    expect(verifyChain().isValid).toBe(true);

    // Corrupt the second entry
    _corruptEntryForDemo(e2.id, 'amount_paise', 9999999);

    // Verification must fail and point to entry 2
    const verification = verifyChain();
    expect(verification.isValid).toBe(false);
    expect(verification.brokenIndex).toBe(1);
    expect(verification.brokenId).toBe(e2.id);
    expect(verification.reason).toContain('hash mismatch');
  });

  it('handles idempotent retries without creating duplicate entries', () => {
    const payload = {
      idempotency_key: 'idem_settle_001',
      type: LedgerEntryType.COMMERCE_SETTLEMENT,
      from_entity: 'buyer_1',
      to_entity: 'merchant_1',
      amount_paise: 499900,
      reference_id: 'order_100',
    };

    const e1 = appendEntry(payload);
    const e2 = appendEntry(payload); // simulate retry

    expect(e1.id).toBe(e2.id);
    expect(e1.hash).toBe(e2.hash);

    const db = getDb();
    const rows = db
      .prepare('SELECT count(*) as count FROM ledger WHERE idempotency_key = ?')
      .get('idem_settle_001') as { count: number };
    expect(rows.count).toBe(1);
  });
});
