import Database from 'better-sqlite3';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export function initDb(dbPath: string = ':memory:'): Database.Database {
  db = new Database(dbPath, { timeout: 5000 });
  
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // Ledger table with cryptographic hash chain
  db.exec(`
    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT UNIQUE NOT NULL,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      from_entity TEXT NOT NULL,
      to_entity TEXT NOT NULL,
      amount_paise INTEGER NOT NULL,
      reference_id TEXT NOT NULL,
      prev_hash TEXT NOT NULL,
      hash TEXT NOT NULL
    )
  `);

  // Users (Role-based Authentication: BUYER vs MERCHANT)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('BUYER', 'MERCHANT')),
      merchant_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Merchants
  db.exec(`
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      description TEXT,
      support_email TEXT,
      capabilities TEXT NOT NULL,
      owner_user_id TEXT,
      created_at TEXT NOT NULL
    )
  `);

  try {
    db.exec('ALTER TABLE merchants ADD COLUMN owner_user_id TEXT');
  } catch {
    // Column already exists
  }

  // Products
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT NOT NULL,
      price_paise INTEGER NOT NULL,
      image_url TEXT,
      policies TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(merchant_id) REFERENCES merchants(id)
    )
  `);

  try {
    db.exec('ALTER TABLE products ADD COLUMN policies TEXT');
  } catch {
    // Column already exists
  }

  // Product variants
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      price_paise INTEGER NOT NULL,
      stock_quantity INTEGER NOT NULL,
      attributes TEXT,
      FOREIGN KEY(product_id) REFERENCES products(id)
    )
  `);

  // Recommendations
  db.exec(`
    CREATE TABLE IF NOT EXISTS recommendations (
      id TEXT PRIMARY KEY,
      source_product_id TEXT NOT NULL,
      recommended_product_id TEXT NOT NULL,
      type TEXT NOT NULL,
      rationale TEXT NOT NULL,
      relevance_score REAL NOT NULL
    )
  `);

  // Carts
  db.exec(`
    CREATE TABLE IF NOT EXISTS carts (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      status TEXT NOT NULL,
      items TEXT NOT NULL,
      subtotal_paise INTEGER NOT NULL,
      discount_paise INTEGER NOT NULL DEFAULT 0,
      total_paise INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Orders
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      cart_id TEXT NOT NULL,
      buyer_id TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      status TEXT NOT NULL,
      items TEXT NOT NULL,
      total_paise INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Payments & Transactions
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      amount_paise INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL,
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      razorpay_signature TEXT,
      failure_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Policies
  db.exec(`
    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL,
      max_transaction_paise INTEGER NOT NULL,
      daily_spend_limit_paise INTEGER NOT NULL,
      require_confirmation_above_paise INTEGER NOT NULL,
      allowed_categories TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // Policy Authorization Tickets (Cryptographic gating & replay protection)
  db.exec(`
    CREATE TABLE IF NOT EXISTS policy_tickets (
      ticket_id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL,
      amount_paise INTEGER NOT NULL,
      cart_id TEXT,
      verdict TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      signature TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ISSUED',
      consumed_at TEXT,
      order_id TEXT
    )
  `);

  // Agent Actions (Structured decision logging)
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_actions (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      inputs TEXT NOT NULL,
      result TEXT NOT NULL,
      policy_verdict TEXT,
      timestamp TEXT NOT NULL
    )
  `);

  // Audit Events
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      actor TEXT NOT NULL,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata TEXT,
      status TEXT NOT NULL
    )
  `);

  // Webhook Events (for idempotency)
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      event_id TEXT UNIQUE NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      processed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  // Indexes for performance & integrity
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ledger_idempotency ON ledger(idempotency_key)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_conversation ON audit_events(conversation_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_actions_conversation ON agent_actions(conversation_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_event_id ON webhook_events(event_id)`);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
