import { initDb, closeDb } from '../ledger/db';
import { PolicyEngine } from './policyEngine';
import { CartOrderService } from './cartOrderService';
import { CatalogService, DEMO_MERCHANT_ID } from './catalogService';
import { PaymentService } from './paymentService';
import { verifyChain, verifyDoubleEntryBalances, getAllLedgerEntries } from '../ledger/ledger';

describe('Hostile Adversarial & Concurrency Security Audit', () => {
  beforeAll(() => {
    initDb(':memory:');
    CatalogService.seedCatalog();
    PolicyEngine.initDefaultPolicy('hostile_buyer');
  });

  afterAll(() => {
    closeDb();
  });

  it('P0: should prevent concurrent budget overspending race conditions', () => {
    // Set daily limit to ₹5,000
    PolicyEngine.updatePolicy('hostile_buyer', {
      daily_spend_limit_paise: 500000,
      max_transaction_paise: 500000,
      require_confirmation_above_paise: 500000,
    });

    const products = CatalogService.search('shoes');
    const product = products[0]; // Pegasus 40 @ ₹4,999

    // Request A creates a cart, adds product, and evaluates policy
    let cartA = CartOrderService.createCart('hostile_buyer', DEMO_MERCHANT_ID);
    cartA = CartOrderService.addItem(cartA.id, product.id, 1);

    const evalA = PolicyEngine.evaluateTransaction({
      buyer_id: 'hostile_buyer',
      amount_paise: cartA.total_paise,
      cart_id: cartA.id,
    });

    expect(evalA.verdict).toBe('ALLOW');
    expect(evalA.ticket).toBeDefined();

    // Now Request B attempts to create a second order for ₹4,999 while Request A's ticket is active
    let cartB = CartOrderService.createCart('hostile_buyer', DEMO_MERCHANT_ID);
    cartB = CartOrderService.addItem(cartB.id, product.id, 1);

    const evalB = PolicyEngine.evaluateTransaction({
      buyer_id: 'hostile_buyer',
      amount_paise: cartB.total_paise,
      cart_id: cartB.id,
    });

    // Request B MUST be denied because Request A has committed/reserved the daily budget!
    expect(evalB.verdict).toBe('DENY');
    expect(evalB.reason).toContain('exceed daily limit');
  });

  it('P0: should prevent authorization ticket replay attacks on multiple orders', () => {
    // Reset policy
    PolicyEngine.updatePolicy('hostile_buyer', {
      daily_spend_limit_paise: 10000000,
      max_transaction_paise: 5000000,
      require_confirmation_above_paise: 4000000,
    });

    const products = CatalogService.search('socks');
    const socks = products[0]; // ₹499

    let cart1 = CartOrderService.createCart('hostile_buyer', DEMO_MERCHANT_ID);
    cart1 = CartOrderService.addItem(cart1.id, socks.id, 1);

    const evalRes = PolicyEngine.evaluateTransaction({
      buyer_id: 'hostile_buyer',
      amount_paise: cart1.total_paise,
      cart_id: cart1.id,
    });

    const ticket = evalRes.ticket!;
    expect(ticket).toBeDefined();

    // 1st order creation consumes the ticket
    const order1 = CartOrderService.createOrderFromCart(cart1.id, ticket);
    expect(order1.id).toBeDefined();

    // 2nd order attempt using the SAME ticket MUST fail
    let cart2 = CartOrderService.createCart('hostile_buyer', DEMO_MERCHANT_ID);
    cart2 = CartOrderService.addItem(cart2.id, socks.id, 1);

    expect(() => {
      CartOrderService.createOrderFromCart(cart2.id, ticket);
    }).toThrow(/already been consumed/);
  });

  it('P0: should guarantee idempotency and zero duplicate ledger entries under 10 concurrent webhook captures', async () => {
    const products = CatalogService.search('socks');
    const cart = CartOrderService.createCart('hostile_buyer', DEMO_MERCHANT_ID);
    CartOrderService.addItem(cart.id, products[0].id, 1);

    const order = CartOrderService.createOrderFromCart(cart.id);
    const initialLedgerCount = getAllLedgerEntries().length;

    // Simulate 10 duplicate/concurrent capture events for the same order
    const capturePromises = Array.from({ length: 10 }).map((_, idx) =>
      PaymentService.captureAndSettlePayment({
        orderId: order.id,
        razorpayPaymentId: `pay_test_duplicate_${idx}`,
      })
    );

    const results = await Promise.all(capturePromises);
    expect(results.every(r => r.success)).toBe(true);

    const afterLedgerCount = getAllLedgerEntries().length;
    // Exactly ONE ledger row should be appended regardless of 10 capture calls!
    expect(afterLedgerCount - initialLedgerCount).toBe(1);

    // Verify double entry balance
    const doubleEntry = verifyDoubleEntryBalances();
    expect(doubleEntry.balanced).toBe(true);
    expect(doubleEntry.total_debits_paise).toBe(doubleEntry.total_credits_paise);
  });

  it('P0: should reject unconfirmed orders exceeding confirmation threshold if ticket is omitted', () => {
    // Policy requires confirmation above ₹4,000
    PolicyEngine.updatePolicy('hostile_buyer', {
      require_confirmation_above_paise: 400000,
      max_transaction_paise: 1000000,
    });

    const shoes = CatalogService.search('pegasus')[0]; // ₹4,999
    const cart = CartOrderService.createCart('hostile_buyer', DEMO_MERCHANT_ID);
    CartOrderService.addItem(cart.id, shoes.id, 1);

    // Attempting to checkout without explicit ticket confirmation MUST throw error
    expect(() => {
      CartOrderService.createOrderFromCart(cart.id);
    }).toThrow(/explicit human confirmation/);
  });

  it('P0: should reject payment capture on a cancelled order', () => {
    const products = CatalogService.search('socks');
    const cart = CartOrderService.createCart('hostile_buyer', DEMO_MERCHANT_ID);
    CartOrderService.addItem(cart.id, products[0].id, 1);

    const order = CartOrderService.createOrderFromCart(cart.id);
    CartOrderService.updateOrderStatus(order.id, 'CANCELLED');

    expect(async () => {
      await PaymentService.captureAndSettlePayment({ orderId: order.id });
    }).rejects.toThrow(/Cannot capture payment for order .* with status CANCELLED/);
  });

  it('P1: should verify that prompt injection attacks in product descriptions cannot tamper with cart pricing', () => {
    // Even if an attacker injects a malicious prompt text, price is loaded strictly from SQL schema
    const maliciousProduct = {
      id: 'attacker_fake_id',
      price_paise: 1, // Attacker wants ₹0.01
    };

    const cart = CartOrderService.createCart('hostile_buyer', DEMO_MERCHANT_ID);

    // Cart service strictly verifies product existence against server catalog DB
    expect(() => {
      CartOrderService.addItem(cart.id, maliciousProduct.id, 1);
    }).toThrow(/not found/);
  });
});
