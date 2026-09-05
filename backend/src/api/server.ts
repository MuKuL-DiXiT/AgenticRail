import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { getDb } from '../ledger/db';
import { verifyChain, getAllLedgerEntries, generateAuditCertificate, _corruptEntryForDemo, repairChain } from '../ledger/ledger';
import { CatalogService, DEMO_MERCHANT_ID } from '../services/catalogService';
import { MerchantService } from '../services/merchantService';
import { PolicyEngine, DEFAULT_BUYER_ID } from '../services/policyEngine';
import { CartOrderService } from '../services/cartOrderService';
import { PaymentService } from '../services/paymentService';
import { RecommendationEngine } from '../services/recommendationEngine';
import { AuditService } from '../services/auditService';
import { BuyerAgent } from '../agents/buyerAgent';
import { CloudinaryService } from '../services/cloudinaryService';
import { AuthService } from '../auth/authService';
import { requireAuth, requireMerchant, optionalAuth, AuthenticatedRequest } from '../auth/middleware';
import { logger } from '../utils/logger';
import { formatPaise } from '../utils/format';

export const app = express();
export const server = http.createServer(app);
export const io = new SocketIOServer(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Forward live audit events and actions over Socket.IO
AuditService.onAuditEvent((event) => {
  io.emit('audit:event', event);
});

AuditService.onAgentAction((action) => {
  io.emit('agent:action', action);
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: { error: 'Too many requests, please try again later.' }
});

app.use('/api/', apiLimiter);

// ----------------------------------------------------
// Authentication Routes (Role-Based: BUYER & MERCHANT)
// ----------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role, merchantName } = req.body;
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'email, password, name, and role (BUYER or MERCHANT) are required.' });
    }
    if (role !== 'BUYER' && role !== 'MERCHANT') {
      return res.status(400).json({ error: "role must be either 'BUYER' or 'MERCHANT'." });
    }
    const result = await AuthService.register({ email, password, name, role, merchantName });
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }
    const result = await AuthService.login(email, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

app.get('/api/auth/demo-credentials', (req, res) => {
  res.json({
    buyer: {
      email: 'rahul@runner.ai',
      password: 'password123',
      role: 'BUYER',
      name: 'Rahul Sharma',
      description: 'Pre-seeded autonomous buyer with spending policies and active shopping session.',
    },
    merchant: {
      email: 'merchant@urbanfit.ai',
      password: 'password123',
      role: 'MERCHANT',
      name: 'UrbanFit Admin',
      merchant_id: DEMO_MERCHANT_ID,
      description: 'Pre-seeded sports apparel merchant with active catalog and real inventory.',
    },
  });
});

// ----------------------------------------------------
// System Metrics & Bot Roster
// ----------------------------------------------------
app.get('/api/metrics', (req, res) => {
  res.json({
    totalTasks: 0,
    botWinRates: {},
    systemHealth: 'HEALTHY',
    activeSessions: 1,
  });
});

app.get('/api/bots', (req, res) => {
  res.json({
    bots: [
      { id: 'buyer_agent_001', name: 'AgentCart Buyer', balance: 5000 },
      { id: 'mch_urbanfit_001', name: 'UrbanFit Merchant', balance: 0 },
    ],
  });
});

app.get('/api/ledger', (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 50);
  const offset = (page - 1) * limit;
  const db = getDb();

  const rows = db.prepare('SELECT * FROM ledger ORDER BY id ASC LIMIT ? OFFSET ?').all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) as count FROM ledger').get() as { count: number };

  res.json({
    data: rows,
    meta: {
      total: total.count,
      page,
      limit,
      totalPages: Math.ceil(total.count / limit),
    },
  });
});

// ----------------------------------------------------
// Machine-Readable Merchant Manifest (Core Track 01 requirement)
// ----------------------------------------------------
app.get('/api/merchants/:merchantId/agent-manifest', (req, res) => {
  try {
    const manifest = MerchantService.getAgentManifest(req.params.merchantId);
    res.json(manifest);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/merchants/:merchantId/negotiate', (req, res) => {
  try {
    const { buyer_agent_id, product_ids, total_budget_paise, requested_discount_percent } = req.body;
    const offer = MerchantService.negotiateAgentOffer(req.params.merchantId, {
      buyer_agent_id: buyer_agent_id || DEFAULT_BUYER_ID,
      product_ids: product_ids || [],
      total_budget_paise,
      requested_discount_percent,
    });
    res.json(offer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/merchant', optionalAuth, (req: AuthenticatedRequest, res) => {
  const merchantId = req.user?.merchant_id || (req.query.merchant_id as string) || DEMO_MERCHANT_ID;
  const merchant = MerchantService.getMerchant(merchantId);
  if (!merchant) return res.status(404).json({ error: 'Merchant not found' });
  res.json(merchant);
});

// Merchant Live Analytics & Dashboard Stats (Database source of truth)
app.get('/api/merchant/dashboard/stats', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const merchantId = req.user?.merchant_id || (req.query.merchant_id as string) || DEMO_MERCHANT_ID;
    const stats = MerchantService.getMerchantStats(merchantId);
    res.json({ merchant_id: merchantId, ...stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Merchant Products Scoped
app.get('/api/merchant/products', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const merchantId = req.user?.merchant_id || (req.query.merchant_id as string) || DEMO_MERCHANT_ID;
    const products = CatalogService.getProductsByMerchant(merchantId);
    res.json({ products });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Catalog & Discovery Endpoints
// ----------------------------------------------------
app.get('/api/catalog/products', (req, res) => {
  try {
    const products = CatalogService.search('', { limit: 50 });
    res.json({ products });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/catalog/search', (req, res) => {
  try {
    const query = (req.query.q as string) || '';
    const category = req.query.category as string | undefined;
    const maxPrice = req.query.max_price ? Number(req.query.max_price) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    const products = CatalogService.search(query, {
      category,
      maxPricePaise: maxPrice,
      limit,
    });
    res.json({ products, count: products.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/catalog/products/:id', (req, res) => {
  try {
    const product = CatalogService.getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/catalog/inventory/:id', (req, res) => {
  try {
    const inventory = CatalogService.checkInventory(req.params.id, req.query.variant_id as string | undefined);
    res.json(inventory);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cloudinary Image Upload
app.post('/api/upload/image', async (req, res) => {
  try {
    const { image, folder } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Image data is required (base64 data URI or remote image URL)' });
    }

    const uploadResult = await CloudinaryService.uploadImage(image, folder || 'agentcart/products');
    res.json({
      success: true,
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
    });
  } catch (err: any) {
    logger.error('Failed to upload image to Cloudinary', { error: err.message });
    res.status(500).json({ error: err.message || 'Image upload failed' });
  }
});

// Merchant Inventory Creation (Tenant-isolated)
app.post('/api/catalog/products', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const {
      name,
      description,
      category,
      price_paise,
      price_inr,
      image_url,
      tags,
      initial_stock,
      sku,
      variants,
      policies,
      merchant_id,
    } = req.body;

    if (!name || !description || !category) {
      return res.status(400).json({ error: 'Product name, description, and category are required.' });
    }

    const price = price_paise ? Number(price_paise) : price_inr ? Math.round(Number(price_inr) * 100) : 0;
    if (price <= 0) {
      return res.status(400).json({ error: 'Price must be greater than 0.' });
    }

    const effectiveMerchantId = req.user?.merchant_id || merchant_id || DEMO_MERCHANT_ID;

    const product = CatalogService.createProduct({
      merchant_id: effectiveMerchantId,
      name,
      description,
      category,
      price_paise: price,
      image_url,
      tags,
      initial_stock: initial_stock ? Number(initial_stock) : 25,
      sku,
      variants,
      policies,
    });

    AuditService.recordEvent({
      conversation_id: 'catalog_merchant_admin',
      actor: 'MERCHANT_AGENT',
      event_type: 'PRODUCT_CREATED',
      title: 'New Product Published',
      description: `Merchant (${effectiveMerchantId}) created product "${product.name}" (${formatPaise(product.price_paise)}) with category "${product.category}".`,
      status: 'SUCCESS',
      metadata: { product_id: product.id, name: product.name, price_paise: product.price_paise, policies: product.policies, merchant_id: effectiveMerchantId },
    });

    res.status(201).json({ success: true, product });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Product with tenant ownership enforcement
app.delete('/api/catalog/products/:id', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (req.user && req.user.role === 'MERCHANT' && req.user.merchant_id) {
      const deleted = CatalogService.deleteProductForMerchant(req.params.id, req.user.merchant_id);
      if (!deleted) return res.status(404).json({ error: 'Product not found.' });
      return res.json({ success: true, deleted_product_id: req.params.id });
    }

    const deleted = CatalogService.deleteProduct(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Product not found.' });
    res.json({ success: true, deleted_product_id: req.params.id });
  } catch (err: any) {
    if (err.message && err.message.includes('Forbidden')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/catalog/recommendations/:productId', (req, res) => {
  try {
    const recs = RecommendationEngine.getRecommendationsForProduct(req.params.productId);
    res.json({ recommendations: recs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Cart Endpoints (Buyer scoped & persisted)
// ----------------------------------------------------
app.get('/api/cart/active', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const buyerId = req.user?.id || (req.query.buyer_id as string) || DEFAULT_BUYER_ID;
    let cart = CartOrderService.getActiveCartForBuyer(buyerId);
    if (!cart) {
      cart = CartOrderService.createCart(buyerId, DEMO_MERCHANT_ID);
    }
    res.json(cart);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cart/create', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const buyerId = req.user?.id || req.body.buyer_id || DEFAULT_BUYER_ID;
    const merchantId = req.body.merchant_id || DEMO_MERCHANT_ID;
    const cart = CartOrderService.createCart(buyerId, merchantId);
    res.json(cart);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cart/:id', (req, res) => {
  try {
    const cart = CartOrderService.getCart(req.params.id);
    if (!cart) return res.status(404).json({ error: 'Cart not found' });
    res.json(cart);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cart/:id/add', (req, res) => {
  try {
    const { product_id, quantity, variant_id } = req.body;
    const cart = CartOrderService.addItem(req.params.id, product_id, quantity || 1, variant_id);
    res.json(cart);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/cart/:id/remove/:productId', (req, res) => {
  try {
    const cart = CartOrderService.removeItem(req.params.id, req.params.productId);
    res.json(cart);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Order & Checkout Endpoints (Tenant-isolated)
// ----------------------------------------------------
app.post('/api/orders/checkout', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { cart_id, policy_ticket } = req.body;
    if (!cart_id) return res.status(400).json({ error: 'cart_id is required' });

    const cart = CartOrderService.getCart(cart_id);
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    // Enforce ownership if authenticated buyer
    if (req.user && req.user.role === 'BUYER' && cart.buyer_id !== req.user.id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Cart belongs to a different buyer.' });
    }

    const order = CartOrderService.createOrderFromCart(cart_id, policy_ticket);
    res.json(order);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/orders', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (req.user) {
      if (req.user.role === 'MERCHANT' && req.user.merchant_id) {
        const orders = CartOrderService.getOrdersByMerchant(req.user.merchant_id);
        return res.json({ orders });
      } else if (req.user.role === 'BUYER') {
        const orders = CartOrderService.getOrdersByBuyer(req.user.id);
        return res.json({ orders });
      }
    }

    if (req.query.buyer_id) {
      return res.json({ orders: CartOrderService.getOrdersByBuyer(req.query.buyer_id as string) });
    }
    if (req.query.merchant_id) {
      return res.json({ orders: CartOrderService.getOrdersByMerchant(req.query.merchant_id as string) });
    }

    const orders = CartOrderService.getAllOrders();
    res.json({ orders });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:id', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const order = CartOrderService.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Strict Tenant Isolation: verify resource ownership
    if (req.user) {
      if (req.user.role === 'BUYER' && order.buyer_id !== req.user.id) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Access denied. You do not own this order.',
        });
      }
      if (req.user.role === 'MERCHANT' && order.merchant_id !== req.user.merchant_id) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Access denied. This order belongs to a different merchant.',
        });
      }
    }

    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Policy Engine Endpoints (Buyer scoped)
// ----------------------------------------------------
app.get('/api/policies', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const buyerId = req.user?.id || (req.query.buyer_id as string) || DEFAULT_BUYER_ID;
    const policy = PolicyEngine.getPolicy(buyerId);
    const todaySpent = PolicyEngine.getTodaySpentPaise(buyerId);
    res.json({ policy, today_spent_paise: todaySpent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/policies', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const buyerId = req.user?.id || req.body.buyer_id || DEFAULT_BUYER_ID;
    const updated = PolicyEngine.updatePolicy(buyerId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/policies/evaluate', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const buyerId = req.user?.id || req.body.buyer_id || DEFAULT_BUYER_ID;
    const result = PolicyEngine.evaluateTransaction({
      buyer_id: buyerId,
      amount_paise: req.body.amount_paise,
      categories: req.body.categories,
      cart_id: req.body.cart_id,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Payment & Razorpay Endpoints (Platform infrastructure rails)
// ----------------------------------------------------
app.post('/api/payments/create-order', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { order_id, conversation_id, force_failure } = req.body;
    if (!order_id) return res.status(400).json({ error: 'order_id is required' });

    // Verify order ownership if buyer is authenticated
    const order = CartOrderService.getOrder(order_id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (req.user && req.user.role === 'BUYER' && order.buyer_id !== req.user.id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You do not own this order.' });
    }

    const result = await PaymentService.createPaymentOrder(order_id, conversation_id, force_failure);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments/verify', async (req, res) => {
  try {
    const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, conversation_id } = req.body;

    if (razorpay_signature) {
      const isValid = PaymentService.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid Razorpay payment signature' });
      }
    }

    const result = await PaymentService.captureAndSettlePayment({
      orderId: order_id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      conversationId: conversation_id,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/payments/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = JSON.stringify(req.body);
    const result = await PaymentService.processWebhook(req.body, signature, rawBody);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/payments', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const payments = PaymentService.getAllPayments();
    if (req.user) {
      if (req.user.role === 'BUYER') {
        const buyerOrders = CartOrderService.getOrdersByBuyer(req.user.id).map(o => o.id);
        const filtered = payments.filter(p => buyerOrders.includes(p.order_id));
        return res.json({ payments: filtered });
      } else if (req.user.role === 'MERCHANT' && req.user.merchant_id) {
        const merchantOrders = CartOrderService.getOrdersByMerchant(req.user.merchant_id).map(o => o.id);
        const filtered = payments.filter(p => merchantOrders.includes(p.order_id));
        return res.json({ payments: filtered });
      }
    }
    res.json({ payments });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Buyer Agent Chat Endpoint (Dynamic Buyer Session)
// ----------------------------------------------------
app.post('/api/agent/chat', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { message, conversation_id } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const buyerId = req.user?.id || DEFAULT_BUYER_ID;
    const response = await BuyerAgent.processMessage(message, conversation_id, buyerId);
    res.json(response);
  } catch (err: any) {
    logger.error('Agent chat error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Audit & Ledger Verification Endpoints
// ----------------------------------------------------
app.get('/api/audit/events', (req, res) => {
  try {
    const conversationId = req.query.conversation_id as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const events = AuditService.getEvents(conversationId, limit);
    res.json({ events });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audit/actions', (req, res) => {
  try {
    const conversationId = req.query.conversation_id as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const actions = AuditService.getActions(conversationId, limit);
    res.json({ actions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ledger/entries', (req, res) => {
  try {
    const entries = getAllLedgerEntries();
    res.json({ entries });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ledger/verify', (req, res) => {
  try {
    const result = verifyChain();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ledger/certificate', (req, res) => {
  try {
    const cert = generateAuditCertificate();
    res.json(cert);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ledger/verify', (req, res) => {
  try {
    const result = verifyChain();
    if (result.isValid) {
      res.status(200).json({ status: 'valid', result });
    } else {
      res.status(409).json({ error: 'Ledger tampering detected', result });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ledger/tamper', (req, res) => {
  try {
    const db = getDb();
    const lastEntry = db.prepare('SELECT id FROM ledger ORDER BY id DESC LIMIT 1').get() as { id: number } | undefined;
    if (!lastEntry) {
      return res.status(400).json({ error: 'No ledger entries to tamper' });
    }

    _corruptEntryForDemo(lastEntry.id, 'hash', 'tampered_sha256_hash_99999');
    res.json({ success: true, message: `Corrupted ledger block #${lastEntry.id} hash` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ledger/repair', (req, res) => {
  try {
    const result = repairChain();
    res.json({ success: true, message: `Repaired ${result.repaired} of ${result.total} block(s). Ledger integrity restored.`, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Analytics & Demo Controls
// ----------------------------------------------------
app.get('/api/analytics', (req, res) => {
  try {
    const analytics = RecommendationEngine.getMerchantAnalytics();
    res.json(analytics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/demo/toggle-failure', (req, res) => {
  try {
    const { enabled } = req.body;
    const newState = enabled !== undefined ? enabled : !PaymentService.getFailureSimulation();
    PaymentService.setFailureSimulation(newState);
    res.json({ simulate_failure: newState });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/demo/status', (req, res) => {
  res.json({
    simulate_failure: PaymentService.getFailureSimulation(),
    merchant_id: DEMO_MERCHANT_ID,
    merchant_name: 'UrbanFit Athletics',
    currency: 'INR',
    default_policy: PolicyEngine.getPolicy(DEFAULT_BUYER_ID),
  });
});
