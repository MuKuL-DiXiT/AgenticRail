import { getDb } from '../ledger/db';
import { Product, Recommendation } from '../models/domain';
import { CatalogService } from './catalogService';
import { formatPaise } from '../utils/format';

export interface UpsellSuggestion {
  recommendation: Recommendation;
  product: Product;
  pitch_message: string;
}

export class RecommendationEngine {
  public static getRecommendationsForProduct(productId: string): UpsellSuggestion[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM recommendations 
      WHERE source_product_id = ? 
      ORDER BY relevance_score DESC 
      LIMIT 3
    `).all(productId) as any[];

    const suggestions: UpsellSuggestion[] = [];

    for (const row of rows) {
      const recProduct = CatalogService.getProductById(row.recommended_product_id);
      if (recProduct) {
        let pitch = `Would you like to add ${recProduct.name} for ${formatPaise(recProduct.price_paise)}?`;
        if (row.type === 'CROSS_SELL') {
          pitch = `Pair with ${recProduct.name} (${formatPaise(recProduct.price_paise)}) — ${row.rationale}`;
        } else if (row.type === 'UPSELL') {
          pitch = `Upgrade option: ${recProduct.name} (${formatPaise(recProduct.price_paise)}) — ${row.rationale}`;
        }

        suggestions.push({
          recommendation: {
            id: row.id,
            source_product_id: row.source_product_id,
            recommended_product_id: row.recommended_product_id,
            type: row.type,
            rationale: row.rationale,
            relevance_score: row.relevance_score,
          },
          product: recProduct,
          pitch_message: pitch,
        });
      }
    }

    return suggestions;
  }

  public static getMerchantAnalytics(): {
    totalRevenuePaise: number;
    totalOrders: number;
    aiGeneratedOrders: number;
    averageOrderValuePaise: number;
    upsellRevenuePaise: number;
    failedTransactions: number;
    conversionRate: number;
  } {
    const db = getDb();

    const orders = db.prepare("SELECT * FROM orders WHERE status = 'PAID'").all() as any[];
    const failedPayments = db.prepare("SELECT count(*) as count FROM payments WHERE status = 'FAILED'").get() as { count: number };
    const allCarts = db.prepare('SELECT count(*) as count FROM carts').get() as { count: number };

    const totalRevenuePaise = orders.reduce((sum, o) => sum + o.total_paise, 0);
    const totalOrders = orders.length;
    const aiGeneratedOrders = orders.length; // In AgentCart, all orders are orchestrated via agent
    const averageOrderValuePaise = totalOrders > 0 ? Math.round(totalRevenuePaise / totalOrders) : 0;

    // Calculate upsell revenue (orders with more than 1 item)
    let upsellRevenuePaise = 0;
    for (const order of orders) {
      const items = JSON.parse(order.items || '[]');
      if (items.length > 1) {
        // Items beyond the primary item count as upsell revenue
        for (let i = 1; i < items.length; i++) {
          upsellRevenuePaise += items[i].subtotal_paise;
        }
      }
    }

    const conversionRate = allCarts.count > 0 ? Math.min(100, Math.round((totalOrders / allCarts.count) * 100)) : (totalOrders > 0 ? 100 : 0);

    return {
      totalRevenuePaise,
      totalOrders,
      aiGeneratedOrders,
      averageOrderValuePaise,
      upsellRevenuePaise,
      failedTransactions: failedPayments.count,
      conversionRate,
    };
  }
}
