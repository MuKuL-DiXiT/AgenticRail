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

  it('allows user to prompt the agent to remove cart items, modify quantity, and clear cart', async () => {
    const modConvId = 'test_mod_cart_conv_003';

    // 1. Search running shoes
    await BuyerAgent.processMessage('Search running shoes', modConvId);

    // 2. Add to cart -> triggers upsell
    await BuyerAgent.processMessage('Yes, add to cart', modConvId);

    // 3. Accept upsell (adds Nike Dri-FIT Socks)
    const stepWithUpsell = await BuyerAgent.processMessage('Yes, add socks', modConvId);
    expect(stepWithUpsell.context.cart?.items.length).toBe(2);
    expect(stepWithUpsell.reply).toContain('paise');
    expect(stepWithUpsell.reply).toContain('(₹');

    // 4. Prompt agent to remove socks: "remove socks"
    const stepRemove = await BuyerAgent.processMessage('Please remove socks from my cart', modConvId);
    expect(stepRemove.reply).toContain('Removed');
    expect(stepRemove.reply).toContain('Socks');
    expect(stepRemove.context.cart?.items.length).toBe(1);
    expect(stepRemove.context.cart?.items[0].product_name).toContain('Nike Air Zoom Pegasus');
    expect(stepRemove.reply).toContain('paise');
    expect(stepRemove.reply).toContain('(₹');

    // 5. Prompt agent to modify quantity: "change quantity to 2"
    const stepQty = await BuyerAgent.processMessage('change quantity of shoes to 2', modConvId);
    expect(stepQty.reply).toContain('Updated quantity');
    expect(stepQty.reply).toContain('2');
    expect(stepQty.context.cart?.items[0].quantity).toBe(2);
    expect(stepQty.context.cart?.subtotal_paise).toBe(stepQty.context.cart!.items[0].unit_price_paise * 2);
    expect(stepQty.context.cart?.total_paise).toBe(stepQty.context.cart!.subtotal_paise - stepQty.context.cart!.discount_paise);
    expect(stepQty.reply).toContain('paise');
    expect(stepQty.reply).toContain('(₹');

    // 6. Prompt agent to clear cart: "clear cart"
    const stepClear = await BuyerAgent.processMessage('clear the cart', modConvId);
    expect(stepClear.action_type).toBe('CLEAR_CART');
    expect(stepClear.reply).toContain('cart has been cleared');
    expect(stepClear.context.cart?.items.length).toBe(0);

    // 7. Prompt agent to remove when cart is already empty
    const stepEmptyRemove = await BuyerAgent.processMessage('remove item', modConvId);
    expect(stepEmptyRemove.reply).toContain('cart is currently empty');
  });

  it('handles "Check policy rules" without searching the product catalog', async () => {
    const policyConvId = 'test_policy_rules_conv_004';
    const res = await BuyerAgent.processMessage('Check policy rules', policyConvId);
    expect(res.action_type).toBe('VIEW_POLICY');
    expect(res.reply).toContain('Autonomous Spending Policy Rules');
    expect(res.reply).toContain('Single Transaction Limit');
    expect(res.reply).toContain('Daily Spending Budget');
    expect(res.reply).not.toContain("searched the merchant's catalog");
  });

  it('allows water bottle (accessories) to be added to cart and passes policy evaluation', async () => {
    const bottleConvId = 'test_water_bottle_conv_005';
    const bottleBuyerId = 'buyer_bottle_test';
    // Search water bottle
    const searchStep = await BuyerAgent.processMessage('I need a water bottle', bottleConvId, bottleBuyerId);
    expect(searchStep.reply).toContain('Water Bottle');

    // Add to cart
    const addStep = await BuyerAgent.processMessage('Yes, add to cart', bottleConvId, bottleBuyerId);
    // If upsell offered or policy evaluated, verify policy is not DENY
    if (addStep.action_type === 'UPSELL_PROPOSAL') {
      const checkoutStep = await BuyerAgent.processMessage('No, proceed to checkout', bottleConvId, bottleBuyerId);
      expect(checkoutStep.policy_verdict).toBe('ALLOW');
      expect(checkoutStep.reply).toContain('ALLOWED');
    } else {
      expect(addStep.policy_verdict).toBe('ALLOW');
      expect(addStep.reply).toContain('ALLOWED');
    }
  });

  it('completes payment when user explicitly confirms after REQUIRE_CONFIRMATION and retains non-zero order amount', async () => {
    const confConvId = 'test_manual_confirm_conv_006';
    const confBuyerId = 'buyer_manual_confirm_test';

    // Set confirmation threshold low (e.g. ₹3,500 = 350000 paise) so Pegasus requires confirmation
    PolicyEngine.updatePolicy(confBuyerId, {
      max_transaction_paise: 500000, // ₹5,000 max
      daily_spend_limit_paise: 1000000,
      require_confirmation_above_paise: 350000, // > ₹3,500 requires confirmation
    });

    // 1. Search running shoes
    await BuyerAgent.processMessage('Search running shoes', confConvId, confBuyerId);

    // 2. Add to cart
    await BuyerAgent.processMessage('Yes, add to cart', confConvId, confBuyerId);

    // 3. Decline upsell -> triggers REQUIRE_CONFIRMATION
    const stepRequireConf = await BuyerAgent.processMessage('No, proceed to checkout', confConvId, confBuyerId);
    expect(stepRequireConf.policy_verdict).toBe('REQUIRE_CONFIRMATION');
    expect(stepRequireConf.reply).toContain('MANUAL CONFIRMATION REQUIRED');

    // 4. User explicitly confirms: "Yes, proceed with payment"
    const stepPay = await BuyerAgent.processMessage('Yes, proceed with payment', confConvId, confBuyerId);
    expect(stepPay.action_type).toBe('PAYMENT_CONFIRMED');
    expect(stepPay.reply).toContain('Transaction Completed Successfully');
    expect(stepPay.reply).not.toContain("searched the merchant's catalog");
    expect(stepPay.context.order?.status).toBe('PAID');
    expect(stepPay.context.order?.total_paise).toBeGreaterThan(0);
  });
});



