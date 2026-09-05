import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../ledger/db';
import { Product, ProductVariant } from '../models/domain';

export const DEMO_MERCHANT_ID = 'mch_urbanfit_001';
export const DEMO_MERCHANT_NAME = 'UrbanFit Athletics';

export class CatalogService {
  public static seedCatalog(): void {
    const db = getDb();
    
    // Seed Merchant
    const existingMerchant = db.prepare('SELECT id FROM merchants WHERE id = ?').get(DEMO_MERCHANT_ID);
    if (!existingMerchant) {
      db.prepare(`
        INSERT INTO merchants (id, name, currency, description, support_email, capabilities, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        DEMO_MERCHANT_ID,
        DEMO_MERCHANT_NAME,
        'INR',
        'High-performance sportswear, footwear, and running accessories designed for athletes and AI buyers.',
        'support@urbanfit.ai',
        JSON.stringify([
          'catalog.search',
          'product.get',
          'inventory.check',
          'cart.create',
          'checkout.create',
          'payment.request',
          'recommendations.get'
        ]),
        new Date().toISOString()
      );
    }

    // Check if products exist
    const count = (db.prepare('SELECT count(*) as count FROM products').get() as { count: number }).count;
    if (count > 0) {
      return;
    }

    const demoProducts: Array<{
      name: string;
      slug: string;
      description: string;
      category: string;
      tags: string[];
      price_paise: number;
      image_url: string;
      variants: Array<{ sku: string; name: string; price_paise: number; stock: number; attributes?: Record<string, string> }>;
    }> = [
      {
        name: 'Nike Air Zoom Pegasus 40',
        slug: 'nike-air-zoom-pegasus-40',
        description: 'A springy ride for every run, familiar and personalized just for you. Features responsive React foam and dual Zoom Air units for maximum energy return under budget.',
        category: 'footwear',
        tags: ['running', 'shoes', 'marathon', 'cushioning', 'nike', 'road'],
        price_paise: 499900, // ₹4,999
        image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
        variants: [
          { sku: 'NIK-PEG-UK8', name: 'UK 8 / Black-White', price_paise: 499900, stock: 15, attributes: { size: 'UK 8', color: 'Black/White' } },
          { sku: 'NIK-PEG-UK9', name: 'UK 9 / Black-White', price_paise: 499900, stock: 22, attributes: { size: 'UK 9', color: 'Black/White' } },
          { sku: 'NIK-PEG-UK10', name: 'UK 10 / Black-White', price_paise: 499900, stock: 8, attributes: { size: 'UK 10', color: 'Black/White' } },
        ],
      },
      {
        name: 'Adidas Supernova Rise',
        slug: 'adidas-supernova-rise',
        description: 'Engineered for comfort and support during everyday road runs. Dreamstrike+ midsole super-foam delivers comfort with each stride.',
        category: 'footwear',
        tags: ['running', 'shoes', 'daily', 'breathable', 'adidas'],
        price_paise: 479900, // ₹4,799
        image_url: 'https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=600&auto=format&fit=crop&q=80',
        variants: [
          { sku: 'ADI-SN-UK8', name: 'UK 8 / Blue-Core', price_paise: 479900, stock: 12, attributes: { size: 'UK 8', color: 'Solar Blue' } },
          { sku: 'ADI-SN-UK9', name: 'UK 9 / Blue-Core', price_paise: 479900, stock: 14, attributes: { size: 'UK 9', color: 'Solar Blue' } },
        ],
      },
      {
        name: 'Asics Gel-Cumulus 25',
        slug: 'asics-gel-cumulus-25',
        description: 'PureGEL technology and FF BLAST PLUS cushioning provide softer landings and an energized toe-off.',
        category: 'footwear',
        tags: ['running', 'shoes', 'gel', 'comfort', 'asics'],
        price_paise: 449900, // ₹4,499
        image_url: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&auto=format&fit=crop&q=80',
        variants: [
          { sku: 'ASC-GEL-UK8', name: 'UK 8 / Piedmont Grey', price_paise: 449900, stock: 10, attributes: { size: 'UK 8', color: 'Grey' } },
          { sku: 'ASC-GEL-UK9', name: 'UK 9 / Piedmont Grey', price_paise: 449900, stock: 18, attributes: { size: 'UK 9', color: 'Grey' } },
        ],
      },
      {
        name: 'Nike Dri-FIT Cushioned Running Socks (3-Pack)',
        slug: 'nike-dri-fit-running-socks-3pk',
        description: 'Sweat-wicking fabric and strategic arch compression keep your feet dry and comfortable through long miles.',
        category: 'apparel',
        tags: ['running', 'socks', 'accessories', 'moisture-wicking', 'nike', 'gear'],
        price_paise: 49900, // ₹499
        image_url: 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=600&auto=format&fit=crop&q=80',
        variants: [
          { sku: 'NIK-SOX-M', name: 'Medium (UK 6-8)', price_paise: 49900, stock: 50, attributes: { size: 'M', color: 'White' } },
          { sku: 'NIK-SOX-L', name: 'Large (UK 8-11)', price_paise: 49900, stock: 65, attributes: { size: 'L', color: 'White' } },
        ],
      },
      {
        name: 'Ultra-Light Hydration Running Vest 5L',
        slug: 'ultra-light-hydration-vest-5l',
        description: 'Ergonomic breathable mesh vest with twin 500ml flask pockets, emergency whistle, and phone pouch.',
        category: 'gear',
        tags: ['running', 'hydration', 'trail', 'vest', 'marathon', 'gear'],
        price_paise: 129900, // ₹1,299
        image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',
        variants: [
          { sku: 'HYD-VST-UNISIZE', name: 'Universal Adjustable', price_paise: 129900, stock: 25, attributes: { size: 'Free Size' } },
        ],
      },
      {
        name: 'Pro Performance Electrolyte Mix (30 Servings)',
        slug: 'pro-performance-electrolyte-mix',
        description: 'Zero-sugar rapid hydration formula packed with magnesium, sodium, and potassium to prevent cramping.',
        category: 'nutrition',
        tags: ['nutrition', 'hydration', 'energy', 'supplements', 'running'],
        price_paise: 79900, // ₹799
        image_url: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=600&auto=format&fit=crop&q=80',
        variants: [
          { sku: 'NUT-ELEC-CITRUS', name: 'Citrus Blast 300g', price_paise: 79900, stock: 40, attributes: { flavor: 'Citrus' } },
        ],
      },
    ];

    const insertProductStmt = db.prepare(`
      INSERT INTO products (id, merchant_id, name, slug, description, category, tags, price_paise, image_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertVariantStmt = db.prepare(`
      INSERT INTO product_variants (id, product_id, sku, name, price_paise, stock_quantity, attributes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertRecStmt = db.prepare(`
      INSERT INTO recommendations (id, source_product_id, recommended_product_id, type, rationale, relevance_score)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const createdProductIds: Record<string, string> = {};

    for (const p of demoProducts) {
      const pId = uuidv4();
      createdProductIds[p.slug] = pId;
      
      insertProductStmt.run(
        pId,
        DEMO_MERCHANT_ID,
        p.name,
        p.slug,
        p.description,
        p.category,
        JSON.stringify(p.tags),
        p.price_paise,
        p.image_url,
        new Date().toISOString()
      );

      for (const v of p.variants) {
        insertVariantStmt.run(
          uuidv4(),
          pId,
          v.sku,
          v.name,
          v.price_paise,
          v.stock,
          JSON.stringify(v.attributes || {})
        );
      }
    }

    // Seed smart recommendations (growth / upsell engine)
    const pegasusId = createdProductIds['nike-air-zoom-pegasus-40'];
    const supernovaId = createdProductIds['adidas-supernova-rise'];
    const socksId = createdProductIds['nike-dri-fit-running-socks-3pk'];
    const vestId = createdProductIds['ultra-light-hydration-vest-5l'];
    const nutritionId = createdProductIds['pro-performance-electrolyte-mix'];

    if (pegasusId && socksId) {
      insertRecStmt.run(
        uuidv4(),
        pegasusId,
        socksId,
        'CROSS_SELL',
        'Frequently purchased together with Nike Pegasus for friction reduction and blister prevention.',
        0.95
      );
    }
    if (pegasusId && vestId) {
      insertRecStmt.run(
        uuidv4(),
        pegasusId,
        vestId,
        'UPSELL',
        'Complete marathon preparation kit: Pair shoes with hydration vest.',
        0.82
      );
    }
    if (supernovaId && socksId) {
      insertRecStmt.run(
        uuidv4(),
        supernovaId,
        socksId,
        'CROSS_SELL',
        'Frequently purchased together with running shoes.',
        0.91
      );
    }
    if (supernovaId && nutritionId) {
      insertRecStmt.run(
        uuidv4(),
        supernovaId,
        nutritionId,
        'CROSS_SELL',
        'Essential energy & electrolyte replenishment for long runs.',
        0.78
      );
    }
  }

  public static search(query: string, options?: { category?: string; maxPricePaise?: number; limit?: number }): Product[] {
    const db = getDb();
    const limit = options?.limit || 10;
    const cleanQuery = query.toLowerCase().trim();

    let sql = 'SELECT * FROM products WHERE 1=1';
    const params: any[] = [];

    if (options?.category) {
      sql += ' AND category = ?';
      params.push(options.category);
    }

    if (options?.maxPricePaise) {
      sql += ' AND price_paise <= ?';
      params.push(options.maxPricePaise);
    }

    const rows = db.prepare(sql).all(...params) as any[];

    const stopWords = new Set(['i', 'need', 'want', 'to', 'buy', 'find', 'show', 'me', 'get', 'a', 'an', 'the', 'for', 'under', 'below', 'less', 'than', 'in', 'with', 'and', 'or', 'of', 'please', 'can', 'you']);
    const queryTokens = cleanQuery
      .split(/\s+/)
      .map(t => t.replace(/[^a-z0-9]/g, ''))
      .filter(t => t.length > 1 && !stopWords.has(t));

    const categorySynonyms: Record<string, string[]> = {
      footwear: ['shoe', 'shoes', 'sneaker', 'sneakers', 'boots', 'runner', 'runners', 'footwear'],
      apparel: ['sock', 'socks', 'shirt', 'shorts', 'pants', 'apparel', 'clothing', 'tee', 'singlet'],
      gear: ['vest', 'flask', 'bottle', 'belt', 'pack', 'bag', 'gear', 'hydration'],
      nutrition: ['nutrition', 'mix', 'gel', 'drink', 'electrolyte', 'electrolytes', 'energy', 'supplement', 'supplements'],
    };

    // Calculate relevance score based on tags, title, description, category, and token coverage
    const scored = rows.map((row) => {
      const tags: string[] = JSON.parse(row.tags || '[]');
      let score = 0;
      let matchedTokens = 0;

      const titleLower = row.name.toLowerCase();
      const descLower = row.description.toLowerCase();
      const catLower = row.category.toLowerCase();

      // Exact substring match on title
      if (cleanQuery.length > 2 && titleLower.includes(cleanQuery)) {
        score += 40;
      }

      for (const token of queryTokens) {
        let tokenMatched = false;
        if (titleLower.includes(token)) {
          score += 15;
          tokenMatched = true;
        }
        if (catLower.includes(token) || (categorySynonyms[catLower] && categorySynonyms[catLower].includes(token))) {
          score += 15;
          tokenMatched = true;
        }
        if (tags.some(t => t.toLowerCase().includes(token))) {
          score += 10;
          tokenMatched = true;
        }
        if (descLower.includes(token)) {
          score += 4;
          tokenMatched = true;
        }
        if (tokenMatched) {
          matchedTokens++;
        }
      }

      // Reward products matching multiple query tokens (higher token recall coverage)
      if (queryTokens.length > 1) {
        score += matchedTokens * 25;
        if (matchedTokens === queryTokens.length) {
          score += 30; // 100% token coverage bonus
        }
      }

      // If no query tokens specified, give baseline score to list items
      if (queryTokens.length === 0) score = 1;

      return { row, score, tags };
    });

    // Filter scored items > 0, sort by score descending, then price descending
    const sorted = scored
      .filter((item) => item.score > 0 || cleanQuery.length === 0)
      .sort((a, b) => b.score - a.score || b.row.price_paise - a.row.price_paise)
      .slice(0, limit);

    return sorted.map((item) => {
      const variants = db
        .prepare('SELECT * FROM product_variants WHERE product_id = ?')
        .all(item.row.id) as any[];

      return {
        id: item.row.id,
        merchant_id: item.row.merchant_id,
        name: item.row.name,
        slug: item.row.slug,
        description: item.row.description,
        category: item.row.category,
        tags: item.tags,
        price_paise: item.row.price_paise,
        image_url: item.row.image_url,
        policies: item.row.policies ? JSON.parse(item.row.policies) : undefined,
        variants: variants.map((v) => ({
          id: v.id,
          product_id: v.product_id,
          sku: v.sku,
          name: v.name,
          price_paise: v.price_paise,
          stock_quantity: v.stock_quantity,
          attributes: v.attributes ? JSON.parse(v.attributes) : {},
        })),
        created_at: item.row.created_at,
      };
    });
  }

  public static getProductById(productId: string): Product | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
    if (!row) return null;

    const variants = db
      .prepare('SELECT * FROM product_variants WHERE product_id = ?')
      .all(productId) as any[];

    return {
      id: row.id,
      merchant_id: row.merchant_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      category: row.category,
      tags: JSON.parse(row.tags || '[]'),
      price_paise: row.price_paise,
      image_url: row.image_url,
      policies: row.policies ? JSON.parse(row.policies) : undefined,
      variants: variants.map((v) => ({
        id: v.id,
        product_id: v.product_id,
        sku: v.sku,
        name: v.name,
        price_paise: v.price_paise,
        stock_quantity: v.stock_quantity,
        attributes: v.attributes ? JSON.parse(v.attributes) : {},
      })),
      created_at: row.created_at,
    };
  }

  public static checkInventory(productId: string, variantId?: string): { available: boolean; totalStock: number; variants: Array<{ id: string; sku: string; stock: number }> } {
    const db = getDb();
    const variants = db
      .prepare('SELECT * FROM product_variants WHERE product_id = ?')
      .all(productId) as any[];

    const totalStock = variants.reduce((acc, v) => acc + v.stock_quantity, 0);

    if (variantId) {
      const specific = variants.find(v => v.id === variantId);
      return {
        available: specific ? specific.stock_quantity > 0 : false,
        totalStock,
        variants: variants.map(v => ({ id: v.id, sku: v.sku, stock: v.stock_quantity })),
      };
    }

    return {
      available: totalStock > 0,
      totalStock,
      variants: variants.map(v => ({ id: v.id, sku: v.sku, stock: v.stock_quantity })),
    };
  }

  public static createProduct(input: CreateProductInput): Product {
    const db = getDb();
    const id = uuidv4();
    const merchantId = input.merchant_id || DEMO_MERCHANT_ID;
    const now = new Date().toISOString();
    const cleanSlug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + id.slice(0, 4);

    let tags: string[] = [];
    if (Array.isArray(input.tags)) {
      tags = input.tags.map(t => t.trim()).filter(Boolean);
    } else if (typeof input.tags === 'string') {
      tags = input.tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    if (tags.length === 0) {
      tags = [input.category.toLowerCase(), 'merchandise'];
    }

    const policies = {
      max_concession_percent: input.policies?.max_concession_percent ?? 15,
      autonomous_checkout: input.policies?.autonomous_checkout ?? true,
      requires_reservation: input.policies?.requires_reservation ?? false,
    };

    db.prepare(`
      INSERT INTO products (id, merchant_id, name, slug, description, category, tags, price_paise, image_url, policies, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      merchantId,
      input.name,
      cleanSlug,
      input.description,
      input.category,
      JSON.stringify(tags),
      input.price_paise,
      input.image_url || null,
      JSON.stringify(policies),
      now
    );

    const variantsToInsert = (input.variants && input.variants.length > 0)
      ? input.variants
      : [
          {
            sku: input.sku || `SKU-${input.name.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
            name: 'Standard Edition',
            price_paise: input.price_paise,
            stock_quantity: input.initial_stock ?? 25,
            attributes: {},
          },
        ];

    const insertVarStmt = db.prepare(`
      INSERT INTO product_variants (id, product_id, sku, name, price_paise, stock_quantity, attributes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const createdVariants = variantsToInsert.map((v) => {
      const variantId = uuidv4();
      const variantPrice = v.price_paise ?? input.price_paise;
      const sku = v.sku || `SKU-${Date.now().toString(36).toUpperCase()}`;
      insertVarStmt.run(
        variantId,
        id,
        sku,
        v.name,
        variantPrice,
        v.stock_quantity,
        JSON.stringify(v.attributes || {})
      );
      return {
        id: variantId,
        product_id: id,
        sku,
        name: v.name,
        price_paise: variantPrice,
        stock_quantity: v.stock_quantity,
        attributes: v.attributes || {},
      };
    });

    return {
      id,
      merchant_id: merchantId,
      name: input.name,
      slug: cleanSlug,
      description: input.description,
      category: input.category,
      tags,
      price_paise: input.price_paise,
      image_url: input.image_url,
      variants: createdVariants,
      policies,
      created_at: now,
    };
  }

  public static deleteProduct(productId: string): boolean {
    const db = getDb();
    db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM recommendations WHERE source_product_id = ? OR recommended_product_id = ?').run(productId, productId);
    const res = db.prepare('DELETE FROM products WHERE id = ?').run(productId);
    return res.changes > 0;
  }

  public static deleteProductForMerchant(productId: string, merchantId: string): boolean {
    const db = getDb();
    const prod = db.prepare('SELECT id, merchant_id FROM products WHERE id = ?').get(productId) as any;
    if (!prod) return false;
    if (prod.merchant_id !== merchantId) {
      throw new Error('Forbidden: Product belongs to another merchant.');
    }
    return this.deleteProduct(productId);
  }

  public static getProductsByMerchant(merchantId: string): Product[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM products WHERE merchant_id = ? ORDER BY created_at DESC').all(merchantId) as any[];
    return rows.map(r => this.getProductById(r.id)!).filter(Boolean);
  }
}

export interface CreateProductInput {
  merchant_id?: string;
  name: string;
  description: string;
  category: string;
  tags?: string[] | string;
  price_paise: number;
  image_url?: string;
  initial_stock?: number;
  sku?: string;
  variants?: Array<{
    sku?: string;
    name: string;
    price_paise?: number;
    stock_quantity: number;
    attributes?: Record<string, string>;
  }>;
  policies?: {
    max_concession_percent?: number;
    autonomous_checkout?: boolean;
    requires_reservation?: boolean;
  };
}

