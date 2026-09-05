import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../ledger/db';
import { Cart, CartItem, Order, OrderStatus } from '../models/domain';
import { CatalogService, DEMO_MERCHANT_ID } from './catalogService';
import { PolicyEngine, DEFAULT_BUYER_ID } from './policyEngine';

export class CartOrderService {
  public static createCart(buyerId: string = DEFAULT_BUYER_ID, merchantId: string = DEMO_MERCHANT_ID): Cart {
    const db = getDb();
    const cart: Cart = {
      id: uuidv4(),
      buyer_id: buyerId,
      merchant_id: merchantId,
      status: 'ACTIVE',
      items: [],
      subtotal_paise: 0,
      discount_paise: 0,
      total_paise: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.prepare(`
      INSERT INTO carts (id, buyer_id, merchant_id, status, items, subtotal_paise, discount_paise, total_paise, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cart.id,
      cart.buyer_id,
      cart.merchant_id,
      cart.status,
      JSON.stringify(cart.items),
      cart.subtotal_paise,
      cart.discount_paise,
      cart.total_paise,
      cart.created_at,
      cart.updated_at
    );

    return cart;
  }

  public static getCart(cartId: string): Cart | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM carts WHERE id = ?').get(cartId) as any;
    if (!row) return null;

    return {
      id: row.id,
      buyer_id: row.buyer_id,
      merchant_id: row.merchant_id,
      status: row.status,
      items: JSON.parse(row.items || '[]'),
      subtotal_paise: row.subtotal_paise,
      discount_paise: row.discount_paise,
      total_paise: row.total_paise,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  public static addItem(cartId: string, productId: string, quantity: number = 1, variantId?: string): Cart {
    const cart = this.getCart(cartId);
    if (!cart) throw new Error(`Cart ${cartId} not found`);
    if (cart.status !== 'ACTIVE') throw new Error(`Cart ${cartId} is not active`);

    const product = CatalogService.getProductById(productId);
    if (!product) throw new Error(`Product ${productId} not found`);

    let unitPrice = product.price_paise;
    let variantName = '';

    if (variantId) {
      const variant = product.variants.find(v => v.id === variantId);
      if (variant) {
        unitPrice = variant.price_paise;
        variantName = ` - ${variant.name}`;
      }
    }

    const existingItemIdx = cart.items.findIndex(
      i => i.product_id === productId && (!variantId || i.variant_id === variantId)
    );

    if (existingItemIdx >= 0) {
      cart.items[existingItemIdx].quantity += quantity;
      cart.items[existingItemIdx].subtotal_paise = cart.items[existingItemIdx].quantity * cart.items[existingItemIdx].unit_price_paise;
    } else {
      const newItem: CartItem = {
        product_id: product.id,
        variant_id: variantId,
        product_name: `${product.name}${variantName}`,
        unit_price_paise: unitPrice,
        quantity,
        subtotal_paise: unitPrice * quantity,
      };
      cart.items.push(newItem);
    }

    cart.subtotal_paise = cart.items.reduce((sum, item) => sum + item.subtotal_paise, 0);
    cart.total_paise = Math.max(0, cart.subtotal_paise - cart.discount_paise);
    cart.updated_at = new Date().toISOString();

    const db = getDb();
    db.prepare(`
      UPDATE carts 
      SET items = ?, subtotal_paise = ?, total_paise = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(cart.items), cart.subtotal_paise, cart.total_paise, cart.updated_at, cart.id);

    return cart;
  }

  public static removeItem(cartId: string, productIdOrName: string): Cart {
    const cart = this.getCart(cartId);
    if (!cart) throw new Error(`Cart ${cartId} not found`);

    const lowerTarget = productIdOrName.toLowerCase().trim();
    cart.items = cart.items.filter(
      i => i.product_id !== productIdOrName && !i.product_name.toLowerCase().includes(lowerTarget)
    );
    if (cart.items.length <= 1 || cart.discount_paise >= cart.subtotal_paise) {
      cart.discount_paise = 0;
    }
    cart.subtotal_paise = cart.items.reduce((sum, item) => sum + item.subtotal_paise, 0);
    cart.total_paise = Math.max(0, cart.subtotal_paise - cart.discount_paise);
    cart.updated_at = new Date().toISOString();

    const db = getDb();
    db.prepare(`
      UPDATE carts 
      SET items = ?, subtotal_paise = ?, discount_paise = ?, total_paise = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(cart.items), cart.subtotal_paise, cart.discount_paise, cart.total_paise, cart.updated_at, cart.id);

    return cart;
  }

  public static updateQuantity(cartId: string, productIdOrName: string, quantity: number): Cart {
    const cart = this.getCart(cartId);
    if (!cart) throw new Error(`Cart ${cartId} not found`);
    if (cart.status !== 'ACTIVE') throw new Error(`Cart ${cartId} is not active`);

    if (quantity <= 0) {
      return this.removeItem(cartId, productIdOrName);
    }

    const lowerTarget = productIdOrName.toLowerCase().trim();
    const itemIndex = cart.items.findIndex(
      i => i.product_id === productIdOrName || i.product_name.toLowerCase().includes(lowerTarget)
    );

    if (itemIndex >= 0) {
      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].subtotal_paise = quantity * cart.items[itemIndex].unit_price_paise;
    } else {
      throw new Error(`Item "${productIdOrName}" not found in cart`);
    }

    cart.subtotal_paise = cart.items.reduce((sum, item) => sum + item.subtotal_paise, 0);
    if (cart.items.length <= 1 || cart.discount_paise >= cart.subtotal_paise) {
      cart.discount_paise = 0;
    }
    cart.total_paise = Math.max(0, cart.subtotal_paise - cart.discount_paise);
    cart.updated_at = new Date().toISOString();

    const db = getDb();
    db.prepare(`
      UPDATE carts 
      SET items = ?, subtotal_paise = ?, total_paise = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(cart.items), cart.subtotal_paise, cart.total_paise, cart.updated_at, cart.id);

    return cart;
  }

  public static clearCart(cartId: string): Cart {
    const cart = this.getCart(cartId);
    if (!cart) throw new Error(`Cart ${cartId} not found`);

    cart.items = [];
    cart.subtotal_paise = 0;
    cart.discount_paise = 0;
    cart.total_paise = 0;
    cart.updated_at = new Date().toISOString();

    const db = getDb();
    db.prepare(`
      UPDATE carts 
      SET items = ?, subtotal_paise = ?, discount_paise = ?, total_paise = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(cart.items), cart.subtotal_paise, cart.discount_paise, cart.total_paise, cart.updated_at, cart.id);

    return cart;
  }

  public static applyDiscount(cartId: string, discountPaise: number): Cart {
    const cart = this.getCart(cartId);
    if (!cart) throw new Error(`Cart ${cartId} not found`);
    if (cart.status !== 'ACTIVE') throw new Error(`Cart ${cartId} is not active`);

    cart.discount_paise = Math.max(0, discountPaise);
    cart.total_paise = Math.max(0, cart.subtotal_paise - cart.discount_paise);
    cart.updated_at = new Date().toISOString();

    const db = getDb();
    db.prepare(`
      UPDATE carts 
      SET discount_paise = ?, total_paise = ?, updated_at = ?
      WHERE id = ?
    `).run(cart.discount_paise, cart.total_paise, cart.updated_at, cart.id);

    return cart;
  }

  public static createOrderFromCart(cartId: string, policyTicket?: any): Order {
    const cart = this.getCart(cartId);
    if (!cart) throw new Error(`Cart ${cartId} not found`);
    if (cart.items.length === 0) throw new Error('Cannot create order from empty cart');

    const db = getDb();
    const orderId = uuidv4();
    const now = new Date().toISOString();

    // Deterministic Policy Enforcement: Consume valid ticket or auto-evaluate within strict limits
    if (policyTicket) {
      PolicyEngine.consumePolicyTicket(policyTicket, cart.total_paise, cart.buyer_id, orderId);
    } else {
      const evaluation = PolicyEngine.evaluateTransaction({
        buyer_id: cart.buyer_id,
        amount_paise: cart.total_paise,
        cart_id: cart.id,
      });

      if (evaluation.verdict === 'DENY') {
        throw new Error(`Policy authorization denied: ${evaluation.reason}`);
      }
      if (evaluation.verdict === 'REQUIRE_CONFIRMATION') {
        throw new Error(`Policy requires explicit human confirmation: ${evaluation.reason}`);
      }

      if (evaluation.ticket) {
        PolicyEngine.consumePolicyTicket(evaluation.ticket, cart.total_paise, cart.buyer_id, orderId);
      }
    }

    // Safeguard: total_paise must never be 0 if cart has items with positive price
    let effectiveTotal = cart.total_paise;
    if (effectiveTotal <= 0 && cart.subtotal_paise > 0) {
      effectiveTotal = cart.subtotal_paise;
    }

    const order: Order = {
      id: orderId,
      cart_id: cart.id,
      buyer_id: cart.buyer_id,
      merchant_id: cart.merchant_id,
      status: 'PENDING_PAYMENT',
      items: cart.items,
      total_paise: effectiveTotal,
      currency: 'INR',
      created_at: now,
      updated_at: now,
    };

    db.prepare(`
      INSERT INTO orders (id, cart_id, buyer_id, merchant_id, status, items, total_paise, currency, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      order.id,
      order.cart_id,
      order.buyer_id,
      order.merchant_id,
      order.status,
      JSON.stringify(order.items),
      order.total_paise,
      order.currency,
      order.created_at,
      order.updated_at
    );

    // Mark cart checked out
    db.prepare("UPDATE carts SET status = 'CHECKED_OUT', updated_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      cart.id
    );

    return order;
  }

  public static getOrder(orderId: string): Order | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!row) return null;

    return {
      id: row.id,
      cart_id: row.cart_id,
      buyer_id: row.buyer_id,
      merchant_id: row.merchant_id,
      status: row.status,
      items: JSON.parse(row.items || '[]'),
      total_paise: row.total_paise,
      currency: row.currency,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  public static updateOrderStatus(orderId: string, status: OrderStatus): Order {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(status, now, orderId);
    const order = this.getOrder(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    return order;
  }

  public static getOrdersByBuyer(buyerId: string): Order[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM orders WHERE buyer_id = ? ORDER BY created_at DESC').all(buyerId) as any[];
    return rows.map(row => ({
      id: row.id,
      cart_id: row.cart_id,
      buyer_id: row.buyer_id,
      merchant_id: row.merchant_id,
      status: row.status,
      items: JSON.parse(row.items || '[]'),
      total_paise: row.total_paise,
      currency: row.currency,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  public static getOrdersByMerchant(merchantId: string): Order[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM orders WHERE merchant_id = ? ORDER BY created_at DESC').all(merchantId) as any[];
    return rows.map(row => ({
      id: row.id,
      cart_id: row.cart_id,
      buyer_id: row.buyer_id,
      merchant_id: row.merchant_id,
      status: row.status,
      items: JSON.parse(row.items || '[]'),
      total_paise: row.total_paise,
      currency: row.currency,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  public static getActiveCartForBuyer(buyerId: string): Cart | null {
    const db = getDb();
    const row = db.prepare("SELECT * FROM carts WHERE buyer_id = ? AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1").get(buyerId) as any;
    if (!row) return null;
    return {
      id: row.id,
      buyer_id: row.buyer_id,
      merchant_id: row.merchant_id,
      status: row.status,
      items: JSON.parse(row.items || '[]'),
      subtotal_paise: row.subtotal_paise,
      discount_paise: row.discount_paise,
      total_paise: row.total_paise,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  public static getAllOrders(): Order[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as any[];
    return rows.map(row => ({
      id: row.id,
      cart_id: row.cart_id,
      buyer_id: row.buyer_id,
      merchant_id: row.merchant_id,
      status: row.status,
      items: JSON.parse(row.items || '[]'),
      total_paise: row.total_paise,
      currency: row.currency,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }
}
