import { initDb, closeDb } from '../ledger/db';
import { verifyChain } from '../ledger/ledger';
import { CatalogService } from './catalogService';
import { CartOrderService } from './cartOrderService';
import { PaymentService } from './paymentService';
import crypto from 'crypto';

describe('PaymentService & Webhook Idempotency', () => {
  beforeAll(() => {
    initDb(':memory:');
    CatalogService.seedCatalog();
  });

  afterAll(() => {
    closeDb();
  });

  it('creates an order from cart and initializes payment', async () => {
    const products = CatalogService.search('pegasus');
    expect(products.length).toBeGreaterThan(0);

    const cart = CartOrderService.createCart('test_buyer', products[0].merchant_id);
    CartOrderService.addItem(cart.id, products[0].id, 1);

    const order = CartOrderService.createOrderFromCart(cart.id);
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.total_paise).toBe(products[0].price_paise);

    const paymentRes = await PaymentService.createPaymentOrder(order.id, 'test_conv_1');
    expect(paymentRes.payment.status).toBe('CREATED');
    expect(paymentRes.payment.razorpay_order_id).toBeDefined();
  });

  it('verifies razorpay signature cryptographically', () => {
    const orderId = 'order_test_12345';
    const paymentId = 'pay_test_67890';
    const secret = process.env.RAZORPAY_KEY_SECRET || 'agentcart_test_secret';

    const validSig = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const isValid = PaymentService.verifySignature(orderId, paymentId, validSig);
    expect(isValid).toBe(true);

    const isInvalid = PaymentService.verifySignature(orderId, paymentId, 'invalid_signature_hash');
    expect(isInvalid).toBe(false);
  });

  it('processes webhooks idempotently without double settlement', async () => {
    const products = CatalogService.search('supernova');
    const cart = CartOrderService.createCart('test_buyer', products[0].merchant_id);
    CartOrderService.addItem(cart.id, products[0].id, 1);
    const order = CartOrderService.createOrderFromCart(cart.id);

    const webhookPayload = {
      id: 'evt_test_unique_001',
      event: 'payment.captured',
      order_id: order.id,
      payload: {
        payment: {
          id: 'pay_rzp_mock_111',
          order_id: `order_rzp_${order.id.slice(0, 8)}`,
          notes: { order_id: order.id },
        },
      },
    };

    // First webhook call: Should process successfully
    const firstRes = await PaymentService.processWebhook(webhookPayload);
    expect(firstRes.status).toBe('OK');
    expect(firstRes.processed_already).toBe(false);

    // Second webhook call with duplicate event_id: Should skip duplicate settlement
    const secondRes = await PaymentService.processWebhook(webhookPayload);
    expect(secondRes.status).toBe('OK');
    expect(secondRes.processed_already).toBe(true);

    // Verify cryptographic chain is intact
    const chain = verifyChain();
    expect(chain.isValid).toBe(true);
  });
});
