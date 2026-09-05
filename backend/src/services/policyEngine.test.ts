import { initDb, closeDb } from '../ledger/db';
import { PolicyEngine } from './policyEngine';

describe('PolicyEngine', () => {
  const testBuyer = 'test_buyer_policy_1';

  beforeAll(() => {
    initDb(':memory:');
  });

  afterAll(() => {
    closeDb();
  });

  it('initializes default policy with correct spending bounds', () => {
    const policy = PolicyEngine.initDefaultPolicy(testBuyer);
    expect(policy.max_transaction_paise).toBe(500000); // ₹5,000
    expect(policy.daily_spend_limit_paise).toBe(1000000); // ₹10,000
    expect(policy.allowed_categories).toContain('footwear');
  });

  it('ALLOWS transactions within max limit and permitted categories', () => {
    const result = PolicyEngine.evaluateTransaction({
      buyer_id: testBuyer,
      amount_paise: 499900, // ₹4,999 (Nike Pegasus)
      categories: ['footwear'],
    });

    expect(result.verdict).toBe('ALLOW');
    expect(result.evaluated_amount_paise).toBe(499900);
  });

  it('DENIES transactions exceeding max transaction limit', () => {
    const result = PolicyEngine.evaluateTransaction({
      buyer_id: testBuyer,
      amount_paise: 550000, // ₹5,500 > ₹5,000
      categories: ['footwear'],
    });

    expect(result.verdict).toBe('DENY');
    expect(result.reason).toContain('exceeds maximum single transaction limit');
  });

  it('DENIES transactions for disallowed categories', () => {
    const result = PolicyEngine.evaluateTransaction({
      buyer_id: testBuyer,
      amount_paise: 100000,
      categories: ['luxury_cars', 'jewelry'],
    });

    expect(result.verdict).toBe('DENY');
    expect(result.reason).toContain('Disallowed category');
  });

  it('REQUIRES_CONFIRMATION for amounts between confirmation threshold and max limit', () => {
    PolicyEngine.updatePolicy(testBuyer, {
      max_transaction_paise: 600000, // ₹6,000
      require_confirmation_above_paise: 400000, // ₹4,000
    });

    const result = PolicyEngine.evaluateTransaction({
      buyer_id: testBuyer,
      amount_paise: 450000, // ₹4,500
      categories: ['footwear'],
    });

    expect(result.verdict).toBe('REQUIRE_CONFIRMATION');
    expect(result.reason).toContain('User confirmation is required');
  });
});
