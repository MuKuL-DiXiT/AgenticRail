import { getDb, initDb, closeDb } from './db';
import { appendEntry, verifyChain, getBalance, _corruptEntryForDemo, LedgerError } from './ledger';
import { LedgerEntryType } from './types';

describe('Ledger Rigor', () => {
  beforeEach(() => {
    // Re-initialize an in-memory DB before each test
    initDb(':memory:');
  });

  afterEach(() => {
    closeDb();
  });

  it('maintains chain integrity across N sequential appends', () => {
    for (let i = 0; i < 50; i++) {
      appendEntry({
        idempotency_key: `key_${i}`,
        type: LedgerEntryType.ESCROW_HOLD,
        from_bot_id: 'orchestrator',
        to_bot_id: `worker_${i}`,
        amount: 10,
        task_id: `task_${i}`,
      });
    }
    const verification = verifyChain();
    expect(verification.isValid).toBe(true);
  });

  it('detects tampering with a single historical field and localizes it', () => {
    // Append 3 valid entries
    appendEntry({
      idempotency_key: 't1',
      type: LedgerEntryType.ESCROW_HOLD,
      from_bot_id: 'orch',
      to_bot_id: 'w1',
      amount: 10,
      task_id: 't_a',
    });
    const e2 = appendEntry({
      idempotency_key: 't2',
      type: LedgerEntryType.ESCROW_HOLD,
      from_bot_id: 'orch',
      to_bot_id: 'w2',
      amount: 20,
      task_id: 't_b',
    });
    appendEntry({
      idempotency_key: 't3',
      type: LedgerEntryType.ESCROW_HOLD,
      from_bot_id: 'orch',
      to_bot_id: 'w3',
      amount: 30,
      task_id: 't_c',
    });

    // Initial check passes
    expect(verifyChain().isValid).toBe(true);

    // Corrupt the second entry
    _corruptEntryForDemo(e2.id, 'amount', 999);

    // Verification must fail and point to index 1 (id 2)
    const verification = verifyChain();
    expect(verification.isValid).toBe(false);
    expect(verification.brokenIndex).toBe(1);
    expect(verification.brokenId).toBe(e2.id);
    expect(verification.reason).toContain('hash mismatch');
  });

  it('rejects double-release and double-refund on the same escrow', () => {
    appendEntry({
      idempotency_key: 'h1',
      type: LedgerEntryType.ESCROW_HOLD,
      from_bot_id: 'orch',
      to_bot_id: 'w1',
      amount: 10,
      task_id: 'task_1',
    });

    // Release
    appendEntry({
      idempotency_key: 'r1',
      type: LedgerEntryType.ESCROW_RELEASE,
      from_bot_id: 'orch',
      to_bot_id: 'w1',
      amount: 10,
      task_id: 'task_1',
    });

    // Double release should throw
    expect(() => {
      appendEntry({
        idempotency_key: 'r2',
        type: LedgerEntryType.ESCROW_RELEASE,
        from_bot_id: 'orch',
        to_bot_id: 'w1',
        amount: 10,
        task_id: 'task_1',
      });
    }).toThrow(LedgerError);
    expect(() => {
      appendEntry({
        idempotency_key: 'r2',
        type: LedgerEntryType.ESCROW_RELEASE,
        from_bot_id: 'orch',
        to_bot_id: 'w1',
        amount: 10,
        task_id: 'task_1',
      });
    }).toThrow('Invalid transition: ESCROW_RELEASE requires HELD state');

    // Refund after release should throw
    expect(() => {
      appendEntry({
        idempotency_key: 'ref1',
        type: LedgerEntryType.ESCROW_REFUND,
        from_bot_id: 'orch',
        to_bot_id: 'w1',
        amount: 10,
        task_id: 'task_1',
      });
    }).toThrow('Invalid transition: ESCROW_REFUND requires HELD state');
  });

  it('rejects release or refund with mismatched amounts', () => {
    appendEntry({
      idempotency_key: 'h1',
      type: LedgerEntryType.ESCROW_HOLD,
      from_bot_id: 'orch',
      to_bot_id: 'w1',
      amount: 100,
      task_id: 't1',
    });

    expect(() => {
      appendEntry({
        idempotency_key: 'r1',
        type: LedgerEntryType.ESCROW_RELEASE,
        from_bot_id: 'orch',
        to_bot_id: 'w1',
        amount: 50,
        task_id: 't1',
      });
    }).toThrow('Release amount must match hold amount');
  });

  it('derives correct balances after mixed sequences', () => {
    // orch holds 10 for task 1
    appendEntry({
      idempotency_key: 'k1',
      type: LedgerEntryType.ESCROW_HOLD,
      from_bot_id: 'orch',
      to_bot_id: 'w1',
      amount: 10,
      task_id: 't1',
    });
    // orch holds 20 for task 2
    appendEntry({
      idempotency_key: 'k2',
      type: LedgerEntryType.ESCROW_HOLD,
      from_bot_id: 'orch',
      to_bot_id: 'w2',
      amount: 20,
      task_id: 't2',
    });

    expect(getBalance('orch')).toBe(-30);
    expect(getBalance('w1')).toBe(0); // funds locked, not received yet

    // Release task 1
    appendEntry({
      idempotency_key: 'k3',
      type: LedgerEntryType.ESCROW_RELEASE,
      from_bot_id: 'orch',
      to_bot_id: 'w1',
      amount: 10,
      task_id: 't1',
    });

    expect(getBalance('orch')).toBe(-30); // 10 is gone to w1, 20 is still locked
    expect(getBalance('w1')).toBe(10);

    // Refund task 2
    appendEntry({
      idempotency_key: 'k4',
      type: LedgerEntryType.ESCROW_REFUND,
      from_bot_id: 'orch',
      to_bot_id: 'w2',
      amount: 20,
      task_id: 't2',
    });

    expect(getBalance('orch')).toBe(-10); // got 20 back
    expect(getBalance('w2')).toBe(0);
  });

  it('handles idempotent retries without double charging', () => {
    const p = {
      idempotency_key: 'idem1',
      type: LedgerEntryType.ESCROW_HOLD,
      from_bot_id: 'orch',
      to_bot_id: 'w1',
      amount: 100,
      task_id: 't1',
    };

    const e1 = appendEntry(p);
    const e2 = appendEntry(p); // simulate retry

    expect(e1.id).toBe(e2.id); // Same record returned
    expect(e1.hash).toBe(e2.hash);

    const db = getDb();
    const rows = db
      .prepare('SELECT count(*) as count FROM ledger WHERE idempotency_key = ?')
      .get('idem1') as { count: number };
    expect(rows.count).toBe(1);

    expect(getBalance('orch')).toBe(-100); // Only charged once
  });

  it('handles concurrent/burst appends without corruption', async () => {
    // While Node is single-threaded, better-sqlite3 is synchronous.
    // We simulate burst arrivals by wrapping in Promises.all.
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(
        new Promise<void>((resolve) => {
          appendEntry({
            idempotency_key: `burst_${i}`,
            type: LedgerEntryType.ESCROW_HOLD,
            from_bot_id: 'orch',
            to_bot_id: `worker`,
            amount: 1,
            task_id: `task_${i}`,
          });
          resolve();
        })
      );
    }

    await Promise.all(promises);

    const verification = verifyChain();
    expect(verification.isValid).toBe(true);
    expect(getBalance('orch')).toBe(-100);
  });
});
