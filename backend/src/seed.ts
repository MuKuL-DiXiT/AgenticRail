import { env } from './config/env';
import { initDb, closeDb } from './ledger/db';
import { CatalogService } from './services/catalogService';
import { PolicyEngine } from './services/policyEngine';
import { AuthService } from './auth/authService';
import { logger } from './utils/logger';

async function runSeed() {
  console.log('====================================================');
  console.log('🌱 AgentCart Database Seeder');
  console.log('====================================================');

  const dbPath = env.SQLITE_DB_PATH || 'agentcart.db';
  logger.info(`Connecting to SQLite database at: ${dbPath}`);
  initDb(dbPath);

  // 1. Seed Merchant & Realistic Products / Variants
  logger.info('📦 Seeding Merchant Store & Product Catalog...');
  CatalogService.seedCatalog();

  // 2. Initialize Default Spending Policy
  logger.info('🛡️ Initializing Autonomous Buyer Spending Policy...');
  PolicyEngine.initDefaultPolicy();

  // 3. Seed Real Auth Accounts (Passwords hashed with bcrypt)
  logger.info('👤 Seeding Real Database Users (Buyer & Merchant)...');
  await AuthService.seedDemoAccounts();

  console.log('====================================================');
  console.log('✅ Seeding Complete! Real Database Credentials:');
  console.log('----------------------------------------------------');
  console.log('🛒 BUYER ACCOUNT:');
  console.log('   Email:    rahul@runner.ai');
  console.log('   Password: password123');
  console.log('   Role:     BUYER');
  console.log('   Name:     Rahul Sharma');
  console.log('   Policy:   Max Tx ₹5,000 | Daily Spend ₹10,000');
  console.log('----------------------------------------------------');
  console.log('🏪 MERCHANT ACCOUNT:');
  console.log('   Email:    merchant@urbanfit.ai');
  console.log('   Password: password123');
  console.log('   Role:     MERCHANT');
  console.log('   Name:     UrbanFit Admin');
  console.log('   Store ID: mch_urbanfit_001');
  console.log('====================================================');

  closeDb();
  process.exit(0);
}

runSeed().catch((err) => {
  logger.error('Database seeding failed', { error: err.message, stack: err.stack });
  process.exit(1);
});
