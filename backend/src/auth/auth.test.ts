import request from 'supertest';
import { app } from '../api/server';
import { initDb, closeDb, getDb } from '../ledger/db';
import { AuthService } from './authService';
import { CatalogService, DEMO_MERCHANT_ID } from '../services/catalogService';
import { CartOrderService } from '../services/cartOrderService';

describe('Role-Based Authentication & Tenant Isolation', () => {
  beforeAll(async () => {
    initDb(':memory:');
    CatalogService.seedCatalog();
    await AuthService.seedDemoAccounts();
  });

  afterAll(() => {
    closeDb();
  });

  describe('Demo Accounts Seeding', () => {
    it('seeds real database accounts for buyer and merchant with valid password hashes', async () => {
      // Buyer login
      const buyerRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'rahul@runner.ai', password: 'password123' });

      expect(buyerRes.status).toBe(200);
      expect(buyerRes.body.token).toBeDefined();
      expect(buyerRes.body.user.role).toBe('BUYER');
      expect(buyerRes.body.user.email).toBe('rahul@runner.ai');

      // Merchant login
      const merchantRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'merchant@urbanfit.ai', password: 'password123' });

      expect(merchantRes.status).toBe(200);
      expect(merchantRes.body.token).toBeDefined();
      expect(merchantRes.body.user.role).toBe('MERCHANT');
      expect(merchantRes.body.user.merchant_id).toBe('mch_urbanfit_001');
    });

    it('rejects invalid password for demo accounts', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'rahul@runner.ai', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('User Registration & Policy Initialization', () => {
    it('registers a new BUYER and automatically initializes their spending policy', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'priya@fitness.in',
          password: 'securePass123!',
          name: 'Priya Patel',
          role: 'BUYER',
        });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('BUYER');

      // Verify policy was created in DB
      const policyRes = await request(app)
        .get('/api/policies')
        .set('Authorization', `Bearer ${res.body.token}`);

      expect(policyRes.status).toBe(200);
      expect(policyRes.body.policy).toBeDefined();
      expect(policyRes.body.policy.buyer_id).toBe(res.body.user.id);
      expect(policyRes.body.policy.max_transaction_paise).toBe(500000);
    });

    it('registers a new MERCHANT and creates their merchant store record', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'seller@gear.io',
          password: 'merchantSecret789',
          name: 'Apex Gear',
          role: 'MERCHANT',
          merchantName: 'Apex Outdoor Gear',
        });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('MERCHANT');
      expect(res.body.user.merchant_id).toBeDefined();

      // Verify merchant record in DB
      const db = getDb();
      const merchant = db.prepare('SELECT * FROM merchants WHERE id = ?').get(res.body.user.merchant_id) as any;
      expect(merchant).toBeDefined();
      expect(merchant.name).toBe('Apex Outdoor Gear');
      expect(merchant.owner_user_id).toBe(res.body.user.id);
    });

    it('rejects duplicate email registrations', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'rahul@runner.ai',
          password: 'anotherPassword',
          name: 'Imposter Rahul',
          role: 'BUYER',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already exists/i);
    });
  });

  describe('Session Verification & Profile Retrieval (/api/auth/me)', () => {
    it('returns user profile when authenticated with valid Bearer token', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'rahul@runner.ai', password: 'password123' });

      const token = loginRes.body.token;

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe('rahul@runner.ai');
      expect(meRes.body.user.role).toBe('BUYER');
      expect(meRes.body.user.password_hash).toBeUndefined(); // Secrets must never leak
    });

    it('rejects requests missing an Authorization header', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('rejects requests with an invalid/forged token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer forged_token_12345');
      expect(res.status).toBe(401);
    });
  });

  describe('Tenant & Resource Isolation Enforcement', () => {
    let buyerAToken: string;
    let buyerAId: string;
    let buyerBToken: string;
    let buyerBId: string;
    let merchantAToken: string;
    let merchantAId: string;
    let merchantBToken: string;
    let merchantBId: string;
    let orderAId: string;
    let productAId: string;

    beforeAll(async () => {
      // Buyer A
      const bA = await request(app).post('/api/auth/register').send({
        email: 'buyerA@test.com',
        password: 'pass',
        name: 'Buyer A',
        role: 'BUYER',
      });
      buyerAToken = bA.body.token;
      buyerAId = bA.body.user.id;

      // Buyer B
      const bB = await request(app).post('/api/auth/register').send({
        email: 'buyerB@test.com',
        password: 'pass',
        name: 'Buyer B',
        role: 'BUYER',
      });
      buyerBToken = bB.body.token;
      buyerBId = bB.body.user.id;

      // Merchant A
      const mA = await request(app).post('/api/auth/register').send({
        email: 'merchA@test.com',
        password: 'pass',
        name: 'Merchant A',
        role: 'MERCHANT',
        merchantName: 'Store A',
      });
      merchantAToken = mA.body.token;
      merchantAId = mA.body.user.merchant_id;

      // Merchant B
      const mB = await request(app).post('/api/auth/register').send({
        email: 'merchB@test.com',
        password: 'pass',
        name: 'Merchant B',
        role: 'MERCHANT',
        merchantName: 'Store B',
      });
      merchantBToken = mB.body.token;
      merchantBId = mB.body.user.merchant_id;

      // Create product for Merchant A
      const prodRes = await request(app)
        .post('/api/catalog/products')
        .set('Authorization', `Bearer ${merchantAToken}`)
        .send({
          name: 'Merchant A Exclusive Item',
          description: 'Special edition item',
          category: 'Fitness',
          price_paise: 250000,
        });
      productAId = prodRes.body.product.id;

      // Buyer A creates a cart and order
      const cart = CartOrderService.createCart(buyerAId, merchantAId);
      CartOrderService.addItem(cart.id, productAId, 1);
      const order = CartOrderService.createOrderFromCart(cart.id);
      orderAId = order.id;
    });

    it('allows Buyer A to view their own order', async () => {
      const res = await request(app)
        .get(`/api/orders/${orderAId}`)
        .set('Authorization', `Bearer ${buyerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(orderAId);
    });

    it('prevents Buyer B from viewing Buyer A order (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/orders/${orderAId}`)
        .set('Authorization', `Bearer ${buyerBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('allows Merchant A to view orders placed at their store', async () => {
      const res = await request(app)
        .get(`/api/orders/${orderAId}`)
        .set('Authorization', `Bearer ${merchantAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(orderAId);
    });

    it('prevents Merchant B from viewing Merchant A store order (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/orders/${orderAId}`)
        .set('Authorization', `Bearer ${merchantBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('prevents Merchant B from deleting Merchant A product (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/catalog/products/${productAId}`)
        .set('Authorization', `Bearer ${merchantBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('allows Merchant A to delete their own product', async () => {
      const res = await request(app)
        .delete(`/api/catalog/products/${productAId}`)
        .set('Authorization', `Bearer ${merchantAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
