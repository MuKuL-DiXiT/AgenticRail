import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { getDb } from '../ledger/db';
import { appendEntry } from '../ledger/ledger';
import { LedgerEntryType } from '../ledger/types';
import { Payment, PaymentStatus } from '../models/domain';
import { CartOrderService } from './cartOrderService';
import { AuditService } from './auditService';
import { formatPaise } from '../utils/format';

export class PaymentService {
  private static razorpayInstance: any = null;
  private static simulateFailureMode: boolean = false;

  public static setFailureSimulation(enabled: boolean): void {
    this.simulateFailureMode = enabled;
  }

  public static getFailureSimulation(): boolean {
    return this.simulateFailureMode;
  }

  private static getRazorpayClient(): any {
    if (this.razorpayInstance) return this.razorpayInstance;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (keyId && keySecret && keyId.startsWith('rzp_test_')) {
      try {
        this.razorpayInstance = new Razorpay({
          key_id: keyId,
          key_secret: keySecret,
        });
        return this.razorpayInstance;
      } catch (err) {
        console.warn('Razorpay SDK init failed, falling back to simulated test mode', err);
      }
    }

    return null;
  }

  public static async createPaymentOrder(
    orderId: string,
    conversationId?: string,
    forceFailure?: boolean
  ): Promise<{ payment: Payment; razorpay_options?: any; simulated: boolean }> {
    const order = CartOrderService.getOrder(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    const db = getDb();
    const paymentId = uuidv4();
    const shouldFail = forceFailure !== undefined ? forceFailure : this.simulateFailureMode;

    const rzpClient = this.getRazorpayClient();
    let rzpOrderId = `order_${uuidv4().replace(/-/g, '').slice(0, 14)}`;

    if (rzpClient) {
      try {
        const rzpOrder = await rzpClient.orders.create({
          amount: order.total_paise,
          currency: 'INR',
          receipt: `rcpt_${order.id.slice(0, 8)}`,
          notes: {
            order_id: order.id,
            buyer_id: order.buyer_id,
            merchant_id: order.merchant_id,
          },
        });
        rzpOrderId = rzpOrder.id;
      } catch (err: any) {
        console.warn('Razorpay API call failed, proceeding in simulated mode:', err?.message);
      }
    }

    const initialStatus: PaymentStatus = shouldFail ? 'FAILED' : 'CREATED';
    const failureReason = shouldFail ? 'Payment rejected by acquiring bank simulation (insufficient funds/test card decline).' : undefined;

    const payment: Payment = {
      id: paymentId,
      order_id: order.id,
      amount_paise: order.total_paise,
      currency: 'INR',
      status: initialStatus,
      razorpay_order_id: rzpOrderId,
      failure_reason: failureReason,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.prepare(`
      INSERT INTO payments (id, order_id, amount_paise, currency, status, razorpay_order_id, failure_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payment.id,
      payment.order_id,
      payment.amount_paise,
      payment.currency,
      payment.status,
      payment.razorpay_order_id,
      payment.failure_reason || null,
      payment.created_at,
      payment.updated_at
    );

    if (shouldFail) {
      CartOrderService.updateOrderStatus(order.id, 'PAYMENT_FAILED');
      
      if (conversationId) {
        AuditService.recordEvent({
          conversation_id: conversationId,
          actor: 'RAZORPAY',
          event_type: 'PAYMENT_DECLINED',
          title: 'Payment Simulation Failed',
          description: `Transaction of ${formatPaise(order.total_paise)} was rejected by payment provider. No duplicate charge created.`,
          status: 'FAILURE',
          metadata: { order_id: order.id, razorpay_order_id: rzpOrderId, reason: failureReason },
        });
      }
    } else {
      if (conversationId) {
        AuditService.recordEvent({
          conversation_id: conversationId,
          actor: 'RAZORPAY',
          event_type: 'ORDER_INITIALIZED',
          title: 'Razorpay Order Created',
          description: `Razorpay order ${rzpOrderId} initialized for ${formatPaise(order.total_paise)}.`,
          status: 'SUCCESS',
          metadata: { order_id: order.id, razorpay_order_id: rzpOrderId },
        });
      }
    }

    return {
      payment,
      razorpay_options: {
        key: process.env.RAZORPAY_KEY_ID || 'rzp_test_agentcart_mock',
        amount: order.total_paise,
        currency: 'INR',
        name: 'AgentCart Merchant',
        description: `Order ${order.id.slice(0, 8)}`,
        order_id: rzpOrderId,
      },
      simulated: !rzpClient,
    };
  }

  public static verifySignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET || 'agentcart_test_secret';
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    return expectedSignature === razorpaySignature;
  }

  public static async captureAndSettlePayment(params: {
    orderId: string;
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
    razorpaySignature?: string;
    conversationId?: string;
  }): Promise<{ success: boolean; payment: Payment }> {
    const db = getDb();
    const order = CartOrderService.getOrder(params.orderId);
    if (!order) throw new Error(`Order ${params.orderId} not found`);

    // Guard against invalid state transitions
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      throw new Error(`Cannot capture payment for order ${order.id} with status ${order.status}`);
    }

    let paymentRow = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(order.id) as any;

    // Idempotency: If already settled and PAID, return existing without appending duplicate ledger rows
    if (order.status === 'PAID' && paymentRow && paymentRow.status === 'CAPTURED') {
      return {
        success: true,
        payment: {
          id: paymentRow.id,
          order_id: order.id,
          amount_paise: order.total_paise,
          currency: 'INR',
          status: 'CAPTURED',
          razorpay_order_id: paymentRow.razorpay_order_id,
          razorpay_payment_id: paymentRow.razorpay_payment_id,
          razorpay_signature: paymentRow.razorpay_signature,
          created_at: paymentRow.created_at,
          updated_at: paymentRow.updated_at,
        },
      };
    }

    const rzpPaymentId = params.razorpayPaymentId || `pay_${uuidv4().replace(/-/g, '').slice(0, 14)}`;
    const now = new Date().toISOString();

    if (!paymentRow) {
      const pId = uuidv4();
      db.prepare(`
        INSERT INTO payments (id, order_id, amount_paise, currency, status, razorpay_order_id, razorpay_payment_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'CAPTURED', ?, ?, ?, ?)
      `).run(pId, order.id, order.total_paise, 'INR', params.razorpayOrderId || null, rzpPaymentId, now, now);
      paymentRow = db.prepare('SELECT * FROM payments WHERE id = ?').get(pId);
    } else {
      db.prepare(`
        UPDATE payments
        SET status = 'CAPTURED', razorpay_payment_id = ?, razorpay_signature = ?, updated_at = ?
        WHERE id = ?
      `).run(rzpPaymentId, params.razorpaySignature || null, now, paymentRow.id);
    }

    // Update order status
    CartOrderService.updateOrderStatus(order.id, 'PAID');

    // Immutable Ledger recording (deterministic key per order prevents duplicate settlements)
    const ledgerEntry = appendEntry({
      idempotency_key: `settle_order_${order.id}`,
      type: LedgerEntryType.COMMERCE_SETTLEMENT,
      from_entity: order.buyer_id,
      to_entity: order.merchant_id,
      amount_paise: order.total_paise,
      reference_id: order.id,
    });

    // Record Audit Event
    const convId = params.conversationId || 'system_flow';
    AuditService.recordEvent({
      conversation_id: convId,
      actor: 'LEDGER',
      event_type: 'PAYMENT_SETTLED',
      title: 'Payment Captured & Settled on Ledger',
      description: `Payment ${rzpPaymentId} verified and captured. Amount ${formatPaise(order.total_paise)} recorded on cryptographic ledger.`,
      status: 'SUCCESS',
      metadata: {
        order_id: order.id,
        payment_id: rzpPaymentId,
        ledger_hash: ledgerEntry.hash,
        ledger_id: ledgerEntry.id,
      },
    });

    const updatedPayment: Payment = {
      id: paymentRow.id,
      order_id: order.id,
      amount_paise: order.total_paise,
      currency: 'INR',
      status: 'CAPTURED',
      razorpay_order_id: params.razorpayOrderId || paymentRow.razorpay_order_id,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: params.razorpaySignature,
      created_at: paymentRow.created_at,
      updated_at: now,
    };

    return { success: true, payment: updatedPayment };
  }

  public static async processWebhook(
    eventBody: any,
    signatureHeader?: string,
    rawBody?: string
  ): Promise<{ status: string; event_id: string; processed_already: boolean }> {
    const db = getDb();
    const eventId = eventBody.id || eventBody.event_id || `evt_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const eventType = eventBody.event || 'payment.captured';

    // Verify webhook signature if webhook secret is configured and headers present
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (webhookSecret && signatureHeader && rawBody) {
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSig !== signatureHeader) {
        throw new Error('Invalid Razorpay webhook signature');
      }
    }

    // Check idempotency
    const existing = db.prepare('SELECT * FROM webhook_events WHERE event_id = ?').get(eventId) as any;
    if (existing) {
      return { status: 'OK', event_id: eventId, processed_already: true };
    }

    // Insert into webhook_events
    db.prepare(`
      INSERT INTO webhook_events (id, event_id, event_type, payload, processed, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(uuidv4(), eventId, eventType, JSON.stringify(eventBody), new Date().toISOString());

    // Process event types
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = eventBody.payload?.payment?.entity || eventBody.payload?.payment;
      const orderId = paymentEntity?.notes?.order_id || eventBody.order_id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        await this.captureAndSettlePayment({
          orderId,
          razorpayPaymentId: paymentId,
          razorpayOrderId: paymentEntity?.order_id,
        });
      }
    }

    return { status: 'OK', event_id: eventId, processed_already: false };
  }

  public static getAllPayments(): Payment[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM payments ORDER BY created_at DESC').all() as any[];
    return rows.map(r => ({
      id: r.id,
      order_id: r.order_id,
      amount_paise: r.amount_paise,
      currency: r.currency,
      status: r.status,
      razorpay_order_id: r.razorpay_order_id,
      razorpay_payment_id: r.razorpay_payment_id,
      razorpay_signature: r.razorpay_signature,
      failure_reason: r.failure_reason,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }
}
