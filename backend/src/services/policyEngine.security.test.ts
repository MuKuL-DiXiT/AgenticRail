import { PolicyEngine } from './policyEngine';
import { initDb, closeDb } from '../ledger/db';

describe('PolicyEngine Security & Cryptographic Ticket Verification', () => {
  beforeAll(() => {
    initDb(':memory:');
    PolicyEngine.initDefaultPolicy('buyer_security_test');
  });

  afterAll(() => {
    closeDb();
  });

  it('should generate a valid cryptographic policy ticket for an approved transaction', () => {
    const evalResult = PolicyEngine.evaluateTransaction({
      buyer_id: 'buyer_security_test',
      amount_paise: 300000, // ₹3,000 (below ₹5,000 limit)
      categories: ['footwear'],
    });

    expect(evalResult.verdict).toBe('ALLOW');
    expect(evalResult.ticket).toBeDefined();
    expect(evalResult.ticket?.signature).toBeDefined();

    const verification = PolicyEngine.verifyPolicyTicket(
      evalResult.ticket!,
      300000,
      'buyer_security_test'
    );

    expect(verification.valid).toBe(true);
  });

  it('should reject a policy ticket with a forged/tampered signature', () => {
    const evalResult = PolicyEngine.evaluateTransaction({
      buyer_id: 'buyer_security_test',
      amount_paise: 200000,
    });

    const forgedTicket = {
      ...evalResult.ticket!,
      signature: '000000000000000000000000000000000000000000000000000000000000dead',
    };

    const verification = PolicyEngine.verifyPolicyTicket(
      forgedTicket,
      200000,
      'buyer_security_test'
    );

    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain('Cryptographic signature verification failed');
  });

  it('should reject a policy ticket when an attacker attempts to escalate the approved amount', () => {
    const evalResult = PolicyEngine.evaluateTransaction({
      buyer_id: 'buyer_security_test',
      amount_paise: 100000, // ₹1,000 approved
    });

    // Attacker tries to use the ₹1,000 ticket for a ₹50,000 order
    const verification = PolicyEngine.verifyPolicyTicket(
      evalResult.ticket!,
      5000000, // ₹50,000
      'buyer_security_test'
    );

    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain('less than required');
  });

  it('should reject a policy ticket presented by a different buyer ID (replay protection)', () => {
    const evalResult = PolicyEngine.evaluateTransaction({
      buyer_id: 'buyer_security_test',
      amount_paise: 250000,
    });

    const verification = PolicyEngine.verifyPolicyTicket(
      evalResult.ticket!,
      250000,
      'malicious_buyer_999'
    );

    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain('buyer_id mismatch');
  });

  it('should reject an expired policy ticket', () => {
    const expiredTicket = PolicyEngine.issuePolicyTicket({
      buyer_id: 'buyer_security_test',
      amount_paise: 100000,
      verdict: 'ALLOW',
    });

    // Retroactively expire the ticket timestamp
    expiredTicket.expires_at = new Date(Date.now() - 60000).toISOString();

    const verification = PolicyEngine.verifyPolicyTicket(
      expiredTicket,
      100000,
      'buyer_security_test'
    );

    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain('expired');
  });
});
