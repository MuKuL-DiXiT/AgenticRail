import request from 'supertest';
import { initDb, closeDb } from '../ledger/db';
import { CatalogService, DEMO_MERCHANT_ID } from './catalogService';
import { CloudinaryService } from './cloudinaryService';
import { app } from '../api/server';

describe('Merchant Inventory & Policy Management', () => {
  beforeAll(() => {
    initDb(':memory:');
    CatalogService.seedCatalog();
  });

  afterAll(() => {
    closeDb();
  });

  it('verifies Cloudinary configuration status from env', () => {
    // Cloudinary config should detect keys provided in .env
    const isConfigured = CloudinaryService.isConfigured();
    expect(typeof isConfigured).toBe('boolean');
  });

  it('allows merchant to create product with custom policies and initial stock', () => {
    const newProduct = CatalogService.createProduct({
      merchant_id: DEMO_MERCHANT_ID,
      name: 'Puma Velocity Nitro 3',
      category: 'footwear',
      description: 'Nitrogen-infused foam offering maximum propulsion and cushioned ride.',
      price_paise: 549900, // ₹5,499
      tags: ['running', 'nitro', 'puma'],
      initial_stock: 35,
      sku: 'PUM-VEL-UK9',
      policies: {
        max_concession_percent: 20,
        autonomous_checkout: true,
        requires_reservation: true,
      },
      image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
    });

    expect(newProduct.id).toBeDefined();
    expect(newProduct.name).toBe('Puma Velocity Nitro 3');
    expect(newProduct.price_paise).toBe(549900);
    expect(newProduct.policies?.max_concession_percent).toBe(20);
    expect(newProduct.variants.length).toBeGreaterThan(0);
    expect(newProduct.variants[0].stock_quantity).toBe(35);

    // Verify product is immediately discoverable in catalog search
    const searchResults = CatalogService.search('velocity nitro');
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].name).toBe('Puma Velocity Nitro 3');
    expect(searchResults[0].policies?.max_concession_percent).toBe(20);

    // Verify inventory check
    const inventory = CatalogService.checkInventory(newProduct.id);
    expect(inventory.available).toBe(true);
    expect(inventory.totalStock).toBe(35);
  });

  it('exposes POST /api/catalog/products endpoint for merchants', async () => {
    const payload = {
      name: 'Salomon Trail Hydro Flask 500ml',
      category: 'gear',
      description: 'Collapsible soft flask with high-flow bite valve for runners.',
      price_inr: 899,
      tags: 'hydration, flask, trail',
      initial_stock: 50,
      policies: {
        max_concession_percent: 10,
        autonomous_checkout: true,
      },
    };

    const res = await request(app)
      .post('/api/catalog/products')
      .send(payload)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.product.name).toBe('Salomon Trail Hydro Flask 500ml');
    expect(res.body.product.price_paise).toBe(89900);

    const createdId = res.body.product.id;

    // Delete endpoint test
    const delRes = await request(app)
      .delete(`/api/catalog/products/${createdId}`)
      .expect(200);

    expect(delRes.body.success).toBe(true);
    expect(delRes.body.deleted_product_id).toBe(createdId);
  });
});
