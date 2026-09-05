import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../ledger/db';
import { env } from '../config/env';

export type UserRole = 'BUYER' | 'MERCHANT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  merchant_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    merchant_id?: string | null;
  };
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  merchantName?: string;
}

export class AuthService {
  private static getJwtSecret(): string {
    return env.JWT_SECRET || 'agentcart_jwt_secret_dev_2026';
  }

  static generateToken(user: Pick<User, 'id' | 'email' | 'name' | 'role' | 'merchant_id'>): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        merchant_id: user.merchant_id || null,
      },
      this.getJwtSecret(),
      { expiresIn: '7d' }
    );
  }

  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.getJwtSecret());
    } catch {
      return null;
    }
  }

  static async register(input: RegisterInput): Promise<AuthResponse> {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(input.email.toLowerCase().trim());
    if (existing) {
      throw new Error('User already exists with this email');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const userId = `usr_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();
    let merchantId: string | null = null;

    if (input.role === 'MERCHANT') {
      merchantId = `mch_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      const mName = input.merchantName?.trim() || `${input.name}'s Store`;
      db.prepare(`
        INSERT INTO merchants (id, name, currency, description, support_email, capabilities, owner_user_id, created_at)
        VALUES (?, ?, 'INR', ?, ?, ?, ?, ?)
      `).run(
        merchantId,
        mName,
        `Official store of ${mName}`,
        input.email.toLowerCase().trim(),
        JSON.stringify(['catalog.search', 'cart.create', 'checkout.create', 'offers.negotiate']),
        userId,
        now
      );
    }

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, merchant_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      input.email.toLowerCase().trim(),
      passwordHash,
      input.name.trim(),
      input.role,
      merchantId,
      now,
      now
    );

    // If buyer, create initial default spending policy
    if (input.role === 'BUYER') {
      const existingPolicy = db.prepare('SELECT id FROM policies WHERE buyer_id = ?').get(userId);
      if (!existingPolicy) {
        db.prepare(`
          INSERT INTO policies (id, buyer_id, max_transaction_paise, daily_spend_limit_paise, require_confirmation_above_paise, allowed_categories, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          `pol_${uuidv4().slice(0, 8)}`,
          userId,
          500000, // ₹5,000 max single transaction
          1000000, // ₹10,000 daily spend limit
          250000, // ₹2,500 requires confirmation
          JSON.stringify(['Sports', 'Fitness', 'Footwear', 'Electronics', 'Apparel', 'Accessories', 'Water Bottles']),
          now
        );
      }
    }

    const user: User = {
      id: userId,
      email: input.email.toLowerCase().trim(),
      name: input.name.trim(),
      role: input.role,
      merchant_id: merchantId,
      created_at: now,
      updated_at: now,
    };

    const token = this.generateToken(user);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        merchant_id: user.merchant_id,
      },
    };
  }

  static async login(email: string, password: string): Promise<AuthResponse> {
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as any;
    if (!row) {
      throw new Error('Invalid email or password');
    }

    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) {
      throw new Error('Invalid email or password');
    }

    const user: User = {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as UserRole,
      merchant_id: row.merchant_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    const token = this.generateToken(user);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        merchant_id: user.merchant_id,
      },
    };
  }

  static getUserById(id: string): User | null {
    const db = getDb();
    const row = db.prepare('SELECT id, email, name, role, merchant_id, created_at, updated_at FROM users WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as UserRole,
      merchant_id: row.merchant_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  static async seedDemoAccounts(): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    const defaultPasswordHash = await bcrypt.hash('password123', 10);

    // 1. Demo Buyer: rahul@runner.ai
    const existingBuyer = db.prepare('SELECT id FROM users WHERE email = ?').get('rahul@runner.ai');
    if (!existingBuyer) {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, name, role, merchant_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'BUYER', NULL, ?, ?)
      `).run(
        'usr_runner_rahul',
        'rahul@runner.ai',
        defaultPasswordHash,
        'Rahul Sharma',
        now,
        now
      );
    }

    // Ensure policy exists for usr_runner_rahul
    const existingBuyerPolicy = db.prepare('SELECT id FROM policies WHERE buyer_id = ?').get('usr_runner_rahul');
    if (!existingBuyerPolicy) {
      db.prepare(`
        INSERT INTO policies (id, buyer_id, max_transaction_paise, daily_spend_limit_paise, require_confirmation_above_paise, allowed_categories, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'pol_default_rahul',
        'usr_runner_rahul',
        500000,
        1000000,
        250000,
        JSON.stringify(['Sports', 'Fitness', 'Footwear', 'Electronics', 'Apparel', 'Accessories', 'Water Bottles']),
        now
      );
    }

    // 2. Demo Merchant: merchant@urbanfit.ai
    const existingMerchantUser = db.prepare('SELECT id FROM users WHERE email = ?').get('merchant@urbanfit.ai');
    if (!existingMerchantUser) {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, name, role, merchant_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'MERCHANT', 'mch_urbanfit_001', ?, ?)
      `).run(
        'usr_urbanfit_admin',
        'merchant@urbanfit.ai',
        defaultPasswordHash,
        'UrbanFit Admin',
        now,
        now
      );
    }

    // Ensure mch_urbanfit_001 merchant owner is linked
    try {
      db.prepare('UPDATE merchants SET owner_user_id = ? WHERE id = ?').run('usr_urbanfit_admin', 'mch_urbanfit_001');
    } catch {}
  }
}
