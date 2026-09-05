import { initDb, closeDb } from '../ledger/db';
import { CatalogService } from '../services/catalogService';
import { PolicyEngine } from '../services/policyEngine';
import { BuyerAgent } from './buyerAgent';
import { verifyChain } from '../ledger/ledger';

describe('BuyerAgent End-to-End Flow', () => {
  const convId = 'test_e2e_conversation_001';

  beforeAll(() => {
    initDb(':memory:');
    CatalogService.seedCatalog();
    PolicyEngine.initDefaultPolicy();
  });

  afterAll(() => {
    closeDb();
  });

  it('executes full conversational checkout flow successfully', async () => {
    // Step 1: User expresses shopping intent with budget
    const step1 = await BuyerAgent.processMessage('I need running shoes for under ₹5,000', convId);
    expect(step1.reply).toContain('Nike Air Zoom Pegasus 40');
    expect(step1.context.search_results.length).toBeGreaterThan(0);
    expect(step1.context.state).toBe('RECOMMEND');

    // Step 2: User confirms selection & receives intelligent upsell suggestion
    const step2 = await BuyerAgent.processMessage('Yes, add to cart', convId);
    expect(step2.context.cart).toBeDefined();
    expect(step2.context.cart?.items.length).toBe(1);
    expect(step2.reply).toContain('Smart Add-On Suggestion');
    expect(step2.action_type).toBe('UPSELL_PROPOSAL');

    // Step 3: User declines upsell -> Policy engine evaluates cart
    const step3 = await BuyerAgent.processMessage('No, proceed to checkout', convId);
    expect(step3.policy_verdict).toBe('ALLOW');
    expect(step3.reply).toContain('ALLOWED');

    // Step 4: User confirms payment -> Order created, Razorpay simulated payment executed & settled on cryptographic ledger
    const step4 = await BuyerAgent.processMessage('Yes, proceed with payment', convId);
    expect(step4.action_type).toBe('PAYMENT_CONFIRMED');
    expect(step4.reply).toContain('Transaction Completed Successfully');
    expect(step4.context.order?.status).toBe('PAID');

    // Step 5: Verify cryptographic ledger integrity
    const chainVerification = verifyChain();
    expect(chainVerification.isValid).toBe(true);
    expect(chainVerification.totalEntries).toBeGreaterThan(0);
  });

  it('discovers products above budget and autonomously negotiates price-match concession within policy', async () => {
    const negoConvId = 'test_nego_conversation_002';
    // User budget: ₹4,500. Nike Pegasus is listed at ₹4,999 (+11% above budget, within 15% negotiation buffer)
    const step1 = await BuyerAgent.processMessage('I need running shoes for under ₹4,500', negoConvId);

    // Verify buyer agent discovered it using the buffer and negotiated with merchant
    expect(step1.context.search_results.some(p => p.name.includes('Nike Air Zoom Pegasus'))).toBe(true);
    expect(step1.reply).toContain('Autonomous Merchant Negotiation');
    expect(step1.reply).toContain('price-match concession');
    expect(step1.context.negotiated_discount?.accepted).toBe(true);

    // Step 2: Add to cart and verify discount applied to cart
    const step2 = await BuyerAgent.processMessage('Yes, add to cart', negoConvId);
    expect(step2.context.cart?.discount_paise).toBe(49900); // ₹499 discount
    expect(step2.context.cart?.total_paise).toBe(450000); // exactly ₹4,500

    // Step 3: Checkout and verify policy ALLOW
    const step3 = await BuyerAgent.processMessage('No, proceed to checkout', negoConvId);
    expect(step3.policy_verdict).toBe('ALLOW');
    expect(step3.reply).toContain('₹4,500');

    // Step 4: Pay and confirm order matches negotiated total
    const step4 = await BuyerAgent.processMessage('Yes, proceed with payment', negoConvId);
    expect(step4.action_type).toBe('PAYMENT_CONFIRMED');
    expect(step4.context.order?.total_paise).toBe(450000);
  });
});
