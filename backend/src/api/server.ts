import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import swaggerUi from 'swagger-ui-express';
import { env } from '../config/env';
import { getBalance, verifyChain } from '../ledger/ledger';
import { getDb } from '../ledger/db';
import { metricsCollector } from './metrics';
import { getSubClient } from '../pubsub/client';
import { CHANNELS } from '../pubsub/messages';
import { logger } from '../utils/logger';

export const app = express();
export const server = http.createServer(app);
export const io = new SocketIOServer(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// OpenAPI simple doc
const swaggerDoc = {
  openapi: '3.0.0',
  info: { title: 'BotBot API', version: '1.0.0' },
  paths: {
    '/api/metrics': { get: { summary: 'Get system metrics', responses: { 200: { description: 'Success' } } } },
    '/api/bots': { get: { summary: 'Get bot roster and balances', responses: { 200: { description: 'Success' } } } },
    '/api/ledger': { get: { summary: 'Get paginated ledger', responses: { 200: { description: 'Success' } } } }
  }
};
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.get('/api/metrics', (req, res) => {
  res.json(metricsCollector.getMetrics());
});

app.get('/api/bots', (req, res) => {
  // Return the known bot IDs and their derived balances
  const bots = ['worker_1', 'worker_2', 'worker_3', 'worker_4', 'worker_5', 'orchestrator'];
  const balances = bots.map(bot => ({
    id: bot,
    balance: getBalance(bot)
  }));
  res.json({ bots: balances });
});

app.get('/api/ledger', (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
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
        totalPages: Math.ceil(total.count / limit)
      }
    });
  } catch (err: any) {
    logger.error('Failed to fetch ledger', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/ledger/verify', (req, res) => {
  const isValid = verifyChain();
  if (isValid) {
    res.status(200).json({ status: 'valid' });
  } else {
    res.status(409).json({ error: 'Ledger tampering detected' });
  }
});

// Socket.IO Bridge
const sub = getSubClient();
sub.subscribe(CHANNELS.TASKS, CHANNELS.BIDS, CHANNELS.AWARDS, CHANNELS.RESULTS).catch(console.error);
sub.on('message', (channel, messageStr) => {
  io.emit(channel, JSON.parse(messageStr));
});
