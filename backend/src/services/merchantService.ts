import { getDb } from '../ledger/db';
import { Merchant, MerchantManifest } from '../models/domain';
import { DEMO_MERCHANT_ID, DEMO_MERCHANT_NAME } from './catalogService';
import { formatPaise } from '../utils/format';

export class MerchantService {
  public static getMerchant(merchantId: string = DEMO_MERCHANT_ID): Merchant | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM merchants WHERE id = ?').get(merchantId) as any;
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      currency: row.currency,
      description: row.description,
      support_email: row.support_email,
      capabilities: JSON.parse(row.capabilities || '[]'),
      created_at: row.created_at,
    };
  }

  public static getMerchantByOwner(ownerUserId: string): Merchant | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM merchants WHERE owner_user_id = ?').get(ownerUserId) as any;
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      currency: row.currency,
      description: row.description,
      support_email: row.support_email,
      capabilities: JSON.parse(row.capabilities || '[]'),
      created_at: row.created_at,
    };
  }

  public static getMerchantStats(merchantId: string) {
    const db = getDb();
    const ordersCount = db.prepare('SELECT COUNT(*) as count FROM orders WHERE merchant_id = ?').get(merchantId) as { count: number };
    const revenueRow = db.prepare(`
      SELECT COALESCE(SUM(p.amount_paise), 0) as total_paise 
      FROM payments p 
      JOIN orders o ON p.order_id = o.id 
      WHERE o.merchant_id = ? AND p.status = 'CAPTURED'
    `).get(merchantId) as { total_paise: number };
    const productsCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE merchant_id = ?').get(merchantId) as { count: number };
    const lowStockCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM product_variants pv 
      JOIN products p ON pv.product_id = p.id 
      WHERE p.merchant_id = ? AND pv.stock_quantity < 10
    `).get(merchantId) as { count: number };
    const recentOrders = db.prepare(`
      SELECT * FROM orders WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 5
    `).all(merchantId) as any[];

    return {
      total_orders: ordersCount?.count || 0,
      total_revenue_paise: revenueRow?.total_paise || 0,
      total_products: productsCount?.count || 0,
      low_stock_items: lowStockCount?.count || 0,
      recent_orders: recentOrders.map(r => ({
        id: r.id,
        buyer_id: r.buyer_id,
        status: r.status,
        total_paise: r.total_paise,
        created_at: r.created_at,
        items: JSON.parse(r.items || '[]'),
      })),
    };
  }

  public static getAgentManifest(merchantId: string = DEMO_MERCHANT_ID, baseUrl: string = 'http://localhost:3000'): MerchantManifest {
    const merchant = this.getMerchant(merchantId) || {
      id: merchantId,
      name: DEMO_MERCHANT_NAME,
      currency: 'INR',
      capabilities: [
        'catalog.search',
        'product.get',
        'inventory.check',
        'cart.create',
        'checkout.create',
        'payment.request',
        'recommendations.get'
      ],
      created_at: new Date().toISOString(),
    };

    return {
      merchant_id: merchant.id,
      merchant_name: merchant.name,
      capabilities: merchant.capabilities,
      supported_currencies: ['INR'],
      policy_constraints: {
        max_order_items: 20,
        requires_inventory_reservation: true,
        supported_payment_rails: ['RAZORPAY_TEST', 'RAZORPAY_LIVE'],
        autonomous_checkout_allowed: true,
        supported_protocols: ['agentcart.v1', 'acp.draft.v1', 'mcp.tools.v1'],
      },
      endpoints: {
        catalog_search: `${baseUrl}/api/catalog/search`,
        product_get: `${baseUrl}/api/catalog/products/:id`,
        inventory_check: `${baseUrl}/api/catalog/inventory/:id`,
        negotiate_offer: `${baseUrl}/api/merchants/:id/negotiate`,
        cart_create: `${baseUrl}/api/cart/create`,
        checkout_create: `${baseUrl}/api/orders/checkout`,
        payment_request: `${baseUrl}/api/payments/create-order`,
      },
      protocol_version: 'agentcart.v1',
    };
  }

  public static negotiateAgentOffer(
    merchantId: string,
    params: {
      buyer_agent_id: string;
      product_ids: string[];
      total_budget_paise?: number;
      requested_discount_percent?: number;
      conversation_id?: string;
    }
  ): {
    accepted: boolean;
    discount_percentage: number;
    discount_paise: number;
    bundle_name: string;
    rationale: string;
    offer_code: string;
    counter_offer?: boolean;
    final_price_paise?: number;
  } {
    const isMultiItem = params.product_ids.length > 1;
    const db = getDb();

    // 1. Calculate subtotal of requested items
    const placeholders = params.product_ids.map(() => '?').join(',');
    const rows = params.product_ids.length > 0
      ? (db.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`).all(...params.product_ids) as any[])
      : [];
    const subtotal = rows.reduce((acc: number, r: any) => acc + (r.price_paise || 0), 0);

    // 2. Determine merchant's PRIVATE, CONFIDENTIAL concession limit (never shared with buyer agent)
    let secretMaxConcessionPct = 15; // default merchant tolerance floor
    if (rows.length === 1 && rows[0]?.policies) {
      try {
        const parsed = typeof rows[0].policies === 'string' ? JSON.parse(rows[0].policies) : rows[0].policies;
        if (typeof parsed?.max_concession_percent === 'number') {
          secretMaxConcessionPct = parsed.max_concession_percent;
        }
      } catch {}
    }

    const secretFloorPricePaise = Math.round(subtotal * (1 - secretMaxConcessionPct / 100));
    const maxAllowedDiscountPaise = subtotal - secretFloorPricePaise;

    // 3. Multi-Item Bundle Loyalty Incentive
    if (isMultiItem) {
      const bundlePct = Math.min(secretMaxConcessionPct, 10);
      const bundleDiscountPaise = Math.round(subtotal * (bundlePct / 100));
      return {
        accepted: true,
        discount_percentage: bundlePct,
        discount_paise: bundleDiscountPaise,
        bundle_name: 'Athlete Starter Pack Bundle',
        rationale: `Merchant Agent granted ${bundlePct}% multi-item bundle incentive to increase conversion.`,
        offer_code: `AGENT_BUNDLE_${Date.now().toString(36).toUpperCase()}`,
        final_price_paise: subtotal - bundleDiscountPaise,
      };
    }

    // 4. Budget Price-Match Negotiation (Buyer attempts to bring price down to budget ceiling)
    if (params.total_budget_paise && params.total_budget_paise < subtotal) {
      // Case A: Buyer budget is at or above the merchant's secret floor -> ACCEPT!
      if (params.total_budget_paise >= secretFloorPricePaise) {
        const discountPaise = subtotal - params.total_budget_paise;
        const discountPct = Math.max(1, Math.round((discountPaise / subtotal) * 100));
        return {
          accepted: true,
          discount_percentage: discountPct,
          discount_paise: discountPaise,
          bundle_name: 'Budget Price-Match Concession',
          rationale: `Merchant Agent approved a ${discountPct}% price-match concession to meet buyer budget ceiling of ${formatPaise(params.total_budget_paise)}.`,
          offer_code: `AGENT_PRICEMATCH_${Date.now().toString(36).toUpperCase()}`,
          final_price_paise: params.total_budget_paise,
        };
      }

      // Case B: Buyer pushed past the secret floor -> Counter-offer with merchant's absolute bottom floor!
      if (secretMaxConcessionPct > 0) {
        return {
          accepted: false,
          counter_offer: true,
          discount_percentage: secretMaxConcessionPct,
          discount_paise: maxAllowedDiscountPaise,
          bundle_name: 'Merchant Floor Counter-Offer',
          rationale: `Requested budget of ${formatPaise(params.total_budget_paise)} exceeds operating margin. Counter-offering automated maximum floor concession of ${secretMaxConcessionPct}% (-${formatPaise(maxAllowedDiscountPaise)}) for a final price of ${formatPaise(secretFloorPricePaise)}.`,
          offer_code: `AGENT_COUNTER_${Date.now().toString(36).toUpperCase()}`,
          final_price_paise: secretFloorPricePaise,
        };
      }
    }

    // 5. Aggressive Probing / Autonomous Checkout Concession (Buyer probes for discounts without stated budget)
    if (params.requested_discount_percent && params.requested_discount_percent > 0) {
      if (params.requested_discount_percent <= secretMaxConcessionPct) {
        const discountPaise = Math.round(subtotal * (params.requested_discount_percent / 100));
        return {
          accepted: true,
          discount_percentage: params.requested_discount_percent,
          discount_paise: discountPaise,
          bundle_name: 'Autonomous Checkout Concession',
          rationale: `Merchant Agent approved ${params.requested_discount_percent}% concession for autonomous cryptographic settlement.`,
          offer_code: `AGENT_PROBE_${Date.now().toString(36).toUpperCase()}`,
          final_price_paise: subtotal - discountPaise,
        };
      } else if (secretMaxConcessionPct > 0) {
        // Counter with merchant's maximum floor
        return {
          accepted: false,
          counter_offer: true,
          discount_percentage: secretMaxConcessionPct,
          discount_paise: maxAllowedDiscountPaise,
          bundle_name: 'Merchant Floor Counter-Offer',
          rationale: `Requested ${params.requested_discount_percent}% discount exceeds operating margin. Counter-offering maximum automated floor concession of ${secretMaxConcessionPct}% (-${formatPaise(maxAllowedDiscountPaise)}) for a final price of ${formatPaise(secretFloorPricePaise)}.`,
          offer_code: `AGENT_COUNTER_${Date.now().toString(36).toUpperCase()}`,
          final_price_paise: secretFloorPricePaise,
        };
      }
    }

    // 6. Default: Standard catalog pricing
    return {
      accepted: false,
      discount_percentage: 0,
      discount_paise: 0,
      bundle_name: 'Standard Catalog Price',
      rationale: 'Standard price applies for single-item order. Bundle with accessories to unlock 10% agent discount.',
      offer_code: 'NONE',
      final_price_paise: subtotal,
    };
  }
}
