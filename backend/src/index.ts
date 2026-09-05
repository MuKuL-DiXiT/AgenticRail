import { env } from './config/env';
import { initDb } from './ledger/db';
import { server } from './api/server';
import { CatalogService } from './services/catalogService';
import { PolicyEngine } from './services/policyEngine';
import { AuthService } from './auth/authService';
import { logger } from './utils/logger';

async function bootstrap() {
  logger.info('[BOOT] Bootstrapping AgentCart Backend...');

  // 1. Initialize SQLite Database & Ledger
  initDb(env.SQLITE_DB_PATH || 'agentcart.db');
  logger.info('[DB] SQLite Ledger & Database initialized.');

  // 2. Seed Catalog & Merchant Data
  CatalogService.seedCatalog();
  logger.info('[CATALOG] Merchant & Demo Catalog seeded.');

  // 3. Initialize Default Buyer Policy
  PolicyEngine.initDefaultPolicy();
  logger.info('[POLICY] Autonomous Policy Engine initialized.');

  // 4. Seed Real Demo Auth Accounts (Buyer: rahul@runner.ai, Merchant: merchant@urbanfit.ai)
  await AuthService.seedDemoAccounts();
  logger.info('[AUTH] Real Auth Demo Accounts initialized in SQLite.');

  // 4. Start API Server & Socket.IO
  const port = env.PORT || 3000;
  server.listen(port, () => {
    logger.info(`[SERVER] AgentCart Server running at http://localhost:${port}`);
    logger.info(`[MANIFEST] Agent Manifest: http://localhost:${port}/api/merchants/mch_urbanfit_001/agent-manifest`);
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to bootstrap AgentCart backend', { error: err.message, stack: err.stack });
  process.exit(1);
});
