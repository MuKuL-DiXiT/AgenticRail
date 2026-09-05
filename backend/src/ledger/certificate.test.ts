import { initDb, closeDb } from './db';
import { appendEntry, generateAuditCertificate, _corruptEntryForDemo, verifyChain } from './ledger';
import { LedgerEntryType } from './types';

describe('Ledger Cryptographic Audit Certificate & Tamper Detection', () => {
  beforeAll(() => {
    initDb(':memory:');
  });

  afterAll(() => {
    closeDb();
  });

  it('should generate an intact cryptographic audit certificate for valid chain', () => {
    // Add multiple transactions
    appendEntry({
      idempotency_key: 'cert_test_tx_001',
      type: LedgerEntryType.COMMERCE_SETTLEMENT,
      from_entity: 'buyer_001',
      to_entity: 'merchant_001',
      amount_paise: 499900,
      reference_id: 'ord_001',
    });

    appendEntry({
      idempotency_key: 'cert_test_tx_002',
      type: LedgerEntryType.COMMERCE_SETTLEMENT,
      from_entity: 'buyer_001',
      to_entity: 'merchant_001',
      amount_paise: 49900,
      reference_id: 'ord_002',
    });

    const cert = generateAuditCertificate();

    expect(cert.is_valid).toBe(true);
    expect(cert.total_entries).toBeGreaterThanOrEqual(2);
    expect(cert.tamper_evident_fingerprint).toBeDefined();
    expect(cert.head_hash).toBeDefined();
    expect(cert.genesis_hash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
  });

  it('should detect tampering and report invalid certificate when database row is manipulated', () => {
    // Tamper with block #1
    _corruptEntryForDemo(1, 'amount_paise', 99999999);

    const verification = verifyChain();
    expect(verification.isValid).toBe(false);
    expect(verification.brokenId).toBe(1);

    const cert = generateAuditCertificate();
    expect(cert.is_valid).toBe(false);
  });
});
