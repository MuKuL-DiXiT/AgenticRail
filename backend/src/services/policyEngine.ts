import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getDb } from '../ledger/db';
import { Policy, PolicyEvaluationResult, PolicyTicket, PolicyVerdict } from '../models/domain';

export const DEFAULT_BUYER_ID = 'buyer_agent_001';
const POLICY_SIGNING_SECRET = process.env.POLICY_SECRET || 'agentcart_policy_signature_secret_2026';

export class PolicyEngine {
  public static initDefaultPolicy(buyerId: string = DEFAULT_BUYER_ID): Policy {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM policies WHERE buyer_id = ?').get(buyerId) as any;
    if (existing) {
      return {
        id: existing.id,
        buyer_id: existing.buyer_id,
        max_transaction_paise: existing.max_transaction_paise,
        daily_spend_limit_paise: existing.daily_spend_limit_paise,
        require_confirmation_above_paise: existing.require_confirmation_above_paise,
        allowed_categories: JSON.parse(existing.allowed_categories || '[]'),
        created_at: existing.created_at,
      };
    }

    const defaultPolicy: Policy = {
      id: uuidv4(),
      buyer_id: buyerId,
      max_transaction_paise: 500000, // ₹5,000 maximum per single transaction
      daily_spend_limit_paise: 1000000, // ₹10,000 maximum per day
      require_confirmation_above_paise: 499900, // Any transaction strictly above ₹4,999 requires manual user confirmation
      allowed_categories: ['footwear', 'apparel', 'gear', 'nutrition', 'fitness', 'clothing', 'electronics'],
      created_at: new Date().toISOString(),
    };

    db.prepare(`
      INSERT INTO policies (id, buyer_id, max_transaction_paise, daily_spend_limit_paise, require_confirmation_above_paise, allowed_categories, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      defaultPolicy.id,
      defaultPolicy.buyer_id,
      defaultPolicy.max_transaction_paise,
      defaultPolicy.daily_spend_limit_paise,
      defaultPolicy.require_confirmation_above_paise,
      JSON.stringify(defaultPolicy.allowed_categories),
      defaultPolicy.created_at
    );

    return defaultPolicy;
  }

  public static getPolicy(buyerId: string = DEFAULT_BUYER_ID): Policy {
    return this.initDefaultPolicy(buyerId);
  }

  public static updatePolicy(buyerId: string, updates: Partial<Omit<Policy, 'id' | 'buyer_id' | 'created_at'>>): Policy {
    const current = this.getPolicy(buyerId);
    const db = getDb();

    const maxTx = updates.max_transaction_paise !== undefined ? updates.max_transaction_paise : current.max_transaction_paise;
    const dailyLimit = updates.daily_spend_limit_paise !== undefined ? updates.daily_spend_limit_paise : current.daily_spend_limit_paise;
    const reqConf = updates.require_confirmation_above_paise !== undefined ? updates.require_confirmation_above_paise : current.require_confirmation_above_paise;
    const categories = updates.allowed_categories !== undefined ? updates.allowed_categories : current.allowed_categories;

    db.prepare(`
      UPDATE policies
      SET max_transaction_paise = ?, daily_spend_limit_paise = ?, require_confirmation_above_paise = ?, allowed_categories = ?
      WHERE buyer_id = ?
    `).run(maxTx, dailyLimit, reqConf, JSON.stringify(categories), buyerId);

    return {
      ...current,
      max_transaction_paise: maxTx,
      daily_spend_limit_paise: dailyLimit,
      require_confirmation_above_paise: reqConf,
      allowed_categories: categories,
    };
  }

  public static getCommittedSpendPaise(buyerId: string = DEFAULT_BUYER_ID): number {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // 1. Settled paid orders today
    const paidResult = db.prepare(`
      SELECT SUM(total_paise) as total
      FROM orders
      WHERE buyer_id = ? AND status = 'PAID' AND created_at >= ?
    `).get(buyerId, `${today}T00:00:00.000Z`) as { total: number | null };

    // 2. Pending payment orders within 15-min reservation window
    const pendingResult = db.prepare(`
      SELECT SUM(total_paise) as total
      FROM orders
      WHERE buyer_id = ? AND status = 'PENDING_PAYMENT' AND created_at >= ?
    `).get(buyerId, fifteenMinsAgo) as { total: number | null };

    // 3. Unconsumed issued policy tickets within active TTL
    const activeTicketsResult = db.prepare(`
      SELECT SUM(amount_paise) as total
      FROM policy_tickets
      WHERE buyer_id = ? AND status = 'ISSUED' AND expires_at >= ?
    `).get(buyerId, new Date().toISOString()) as { total: number | null };

    const paidTotal = paidResult?.total || 0;
    const pendingTotal = pendingResult?.total || 0;
    const activeTicketsTotal = activeTicketsResult?.total || 0;

    return paidTotal + pendingTotal + activeTicketsTotal;
  }

  public static getTodaySpentPaise(buyerId: string = DEFAULT_BUYER_ID): number {
    return this.getCommittedSpendPaise(buyerId);
  }

  public static issuePolicyTicket(params: {
    buyer_id: string;
    amount_paise: number;
    verdict: PolicyVerdict;
    cart_id?: string;
  }): PolicyTicket {
    const db = getDb();
    const ticketId = uuidv4();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15-minute TTL

    const payloadToSign = `${ticketId}:${params.buyer_id}:${params.amount_paise}:${params.verdict}:${issuedAt}:${expiresAt}:${params.cart_id || ''}`;
    const signature = crypto
      .createHmac('sha256', POLICY_SIGNING_SECRET)
      .update(payloadToSign)
      .digest('hex');

    const ticket: PolicyTicket = {
      ticket_id: ticketId,
      buyer_id: params.buyer_id,
      amount_paise: params.amount_paise,
      cart_id: params.cart_id,
      verdict: params.verdict,
      issued_at: issuedAt,
      expires_at: expiresAt,
      signature,
    };

    // Store in DB table to track lifecycle and prevent replay
    db.prepare(`
      INSERT INTO policy_tickets (ticket_id, buyer_id, amount_paise, cart_id, verdict, issued_at, expires_at, signature, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ISSUED')
    `).run(
      ticket.ticket_id,
      ticket.buyer_id,
      ticket.amount_paise,
      ticket.cart_id || null,
      ticket.verdict,
      ticket.issued_at,
      ticket.expires_at,
      ticket.signature
    );

    return ticket;
  }

  public static verifyPolicyTicket(
    ticket: PolicyTicket,
    expectedAmountPaise: number,
    expectedBuyerId: string
  ): { valid: boolean; reason?: string } {
    if (!ticket || !ticket.signature || !ticket.ticket_id) {
      return { valid: false, reason: 'Missing policy ticket or signature' };
    }

    // Check expiration
    if (new Date(ticket.expires_at).getTime() < Date.now()) {
      return { valid: false, reason: 'Policy ticket expired' };
    }

    // Check buyer & amount match
    if (ticket.buyer_id !== expectedBuyerId) {
      return { valid: false, reason: 'Ticket buyer_id mismatch' };
    }

    if (ticket.amount_paise < expectedAmountPaise) {
      return { valid: false, reason: `Ticket approved amount (₹${(ticket.amount_paise / 100).toFixed(2)}) is less than required (₹${(expectedAmountPaise / 100).toFixed(2)})` };
    }

    const payloadToSign = `${ticket.ticket_id}:${ticket.buyer_id}:${ticket.amount_paise}:${ticket.verdict}:${ticket.issued_at}:${ticket.expires_at}:${ticket.cart_id || ''}`;
    const expectedSignature = crypto
      .createHmac('sha256', POLICY_SIGNING_SECRET)
      .update(payloadToSign)
      .digest('hex');

    if (expectedSignature !== ticket.signature) {
      return { valid: false, reason: 'Cryptographic signature verification failed' };
    }

    return { valid: true };
  }

  public static consumePolicyTicket(
    ticket: PolicyTicket,
    expectedAmountPaise: number,
    expectedBuyerId: string,
    orderId: string
  ): void {
    const verification = this.verifyPolicyTicket(ticket, expectedAmountPaise, expectedBuyerId);
    if (!verification.valid) {
      throw new Error(`Policy ticket validation failed: ${verification.reason}`);
    }

    const db = getDb();
    const tx = db.transaction(() => {
      const row = db.prepare('SELECT * FROM policy_tickets WHERE ticket_id = ?').get(ticket.ticket_id) as any;
      if (row && row.status === 'CONSUMED') {
        throw new Error(`Policy ticket ${ticket.ticket_id} has already been consumed for order ${row.order_id}`);
      }

      if (row) {
        db.prepare(`
          UPDATE policy_tickets
          SET status = 'CONSUMED', consumed_at = ?, order_id = ?
          WHERE ticket_id = ?
        `).run(new Date().toISOString(), orderId, ticket.ticket_id);
      } else {
        // Record consumed ticket directly if in-memory
        db.prepare(`
          INSERT INTO policy_tickets (ticket_id, buyer_id, amount_paise, cart_id, verdict, issued_at, expires_at, signature, status, consumed_at, order_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONSUMED', ?, ?)
        `).run(
          ticket.ticket_id,
          ticket.buyer_id,
          ticket.amount_paise,
          ticket.cart_id || null,
          ticket.verdict,
          ticket.issued_at,
          ticket.expires_at,
          ticket.signature,
          new Date().toISOString(),
          orderId
        );
      }
    });

    tx.immediate();
  }

  public static evaluateTransaction(params: {
    buyer_id?: string;
    amount_paise: number;
    categories?: string[];
    cart_id?: string;
  }): PolicyEvaluationResult & { ticket?: PolicyTicket } {
    const buyerId = params.buyer_id || DEFAULT_BUYER_ID;
    const policy = this.getPolicy(buyerId);
    const amount = params.amount_paise;
    const todaySpent = this.getTodaySpentPaise(buyerId);

    // Rule 1: Category Check
    if (params.categories && params.categories.length > 0) {
      const disallowed = params.categories.filter(c => !policy.allowed_categories.includes(c.toLowerCase()));
      if (disallowed.length > 0) {
        return {
          verdict: 'DENY',
          reason: `Disallowed category: ${disallowed.join(', ')}. Allowed categories: ${policy.allowed_categories.join(', ')}`,
          policy_id: policy.id,
          evaluated_amount_paise: amount,
          max_allowed_paise: policy.max_transaction_paise,
          confirmation_threshold_paise: policy.require_confirmation_above_paise,
        };
      }
    }

    // Rule 2: Hard Max Transaction Limit Check
    if (amount > policy.max_transaction_paise) {
      return {
        verdict: 'DENY',
        reason: `Amount (₹${(amount / 100).toFixed(2)}) exceeds maximum single transaction limit of ₹${(policy.max_transaction_paise / 100).toFixed(2)}.`,
        policy_id: policy.id,
        evaluated_amount_paise: amount,
        max_allowed_paise: policy.max_transaction_paise,
        confirmation_threshold_paise: policy.require_confirmation_above_paise,
      };
    }

    // Rule 3: Daily Spend Limit Check
    if (todaySpent + amount > policy.daily_spend_limit_paise) {
      return {
        verdict: 'DENY',
        reason: `Transaction would cause total daily spend (₹${((todaySpent + amount) / 100).toFixed(2)}) to exceed daily limit of ₹${(policy.daily_spend_limit_paise / 100).toFixed(2)}.`,
        policy_id: policy.id,
        evaluated_amount_paise: amount,
        max_allowed_paise: policy.max_transaction_paise,
        confirmation_threshold_paise: policy.require_confirmation_above_paise,
      };
    }

    // Rule 4: Manual Confirmation Threshold Check
    if (amount > policy.require_confirmation_above_paise) {
      return {
        verdict: 'REQUIRE_CONFIRMATION',
        reason: `Amount ₹${(amount / 100).toFixed(2)} exceeds autonomous approval threshold of ₹${(policy.require_confirmation_above_paise / 100).toFixed(2)}. User confirmation is required.`,
        policy_id: policy.id,
        evaluated_amount_paise: amount,
        max_allowed_paise: policy.max_transaction_paise,
        confirmation_threshold_paise: policy.require_confirmation_above_paise,
      };
    }

    // Default: Approved -> Issue Signed Policy Ticket
    const ticket = this.issuePolicyTicket({
      buyer_id: buyerId,
      amount_paise: amount,
      verdict: 'ALLOW',
      cart_id: params.cart_id,
    });

    return {
      verdict: 'ALLOW',
      reason: `Transaction of ₹${(amount / 100).toFixed(2)} is within autonomous limit of ₹${(policy.max_transaction_paise / 100).toFixed(2)} and daily budget.`,
      policy_id: policy.id,
      evaluated_amount_paise: amount,
      max_allowed_paise: policy.max_transaction_paise,
      confirmation_threshold_paise: policy.require_confirmation_above_paise,
      ticket,
    };
  }
}
