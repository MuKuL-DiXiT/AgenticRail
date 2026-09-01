import { env } from './config/env';
import { initDb } from './ledger/db';
import { Orchestrator } from './orchestrator';
import { startWorkers } from './workers';
import { server } from './api/server';
import { metricsCollector } from './api/metrics';
import { logger } from './utils/logger';

async function bootstrap() {
  logger.info('Bootstrapping BotBot Backend...');

  // 1. Initialize SQLite Ledger
  initDb(env.SQLITE_DB_PATH);
  
  // 2. Start Metrics Collector
  await metricsCollector.start();
  
  // 3. Start Workers
  await startWorkers();

  // 4. Start Orchestrator
  const orchestrator = new Orchestrator();
  await orchestrator.start();

  // 5. Start API & WebSockets
  server.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`);
  });

  // (Optional) Kick off a demo loop for simulation
  if (process.env.DEMO_MODE === 'true') {
    logger.info('Starting DEMO loop...');
    setInterval(async () => {
      const budget = orchestrator.getBudget();
      if (budget > 10) {
        await orchestrator.broadcastTask(`Analyze data chunk ${Date.now()}`, Math.floor(Math.random() * 50) + 10);
      } else {
        logger.warn('Orchestrator budget depleted. Stopping demo loop.');
      }
    }, 5000);
  }
}

bootstrap().catch((err) => {
  logger.error('Failed to bootstrap backend', { error: err.message });
  process.exit(1);
});
