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

import { z } from 'zod';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

export const app = express();
export const server = http.createServer(app);
export const io = new SocketIOServer(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});

app.use('/api/razorpay/', apiLimiter);

const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

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

const ledgerQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

app.get('/api/ledger', (req, res) => {
  try {
    const { page, limit } = ledgerQuerySchema.parse(req.query);
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

app.post('/api/ledger/tamper', (req, res) => {
  const db = getDb();
  try {
    // Corrupt the hash of the most recent block to simulate an attack
    db.prepare(`
      UPDATE ledger 
      SET previous_hash = 'tampered_hash_12345'
      WHERE id = (SELECT MAX(id) FROM ledger)
    `).run();
    logger.warn('🚨 SECURITY ALERT: Ledger actively tampered via backdoor API');
    res.json({ message: 'Ledger tampered successfully for demo purposes.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to tamper' });
  }
});

import { appendEntry } from '../ledger/ledger';
import { LedgerEntryType } from '../ledger/types';

const orderSchema = z.object({
  amount: z.number().positive(), // Amount in INR
});

app.post('/api/razorpay/create-order', async (req, res) => {
  try {
    const { amount } = orderSchema.parse(req.body);
    const options = {
      amount: Math.round(amount * 100), // Razorpay expects paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`
    };
    const order = await razorpay.orders.create(options);
    res.json({
      order_id: order.id,
      key_id: env.RAZORPAY_KEY_ID,
      amount: options.amount
    });
  } catch (err) {
    logger.error('Failed to create Razorpay order', { error: err });
    res.status(500).json({ error: 'Failed to create order' });
  }
});

const verifySchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  task_id: z.string(),
  bot_id: z.string(),
  amount: z.number().positive(),
  action: z.enum(['FUND_ESCROW', 'SETTLE_PAYMENT'])
});

app.post('/api/razorpay/verify', (req, res) => {
  try {
    const payload = verifySchema.parse(req.body);
    const body = payload.razorpay_order_id + "|" + payload.razorpay_payment_id;
    
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');
      
    if (expectedSignature === payload.razorpay_signature) {
      // Signature is valid! Safe to write to ledger.
      appendEntry({
        idempotency_key: `fiat_${payload.action}_${payload.razorpay_payment_id}`,
        type: payload.action === 'FUND_ESCROW' ? LedgerEntryType.FIAT_FUNDED : LedgerEntryType.FIAT_SETTLED,
        from_bot_id: payload.action === 'FUND_ESCROW' ? 'human_funder' : 'escrow_system',
        to_bot_id: payload.bot_id,
        amount: payload.amount,
        task_id: payload.task_id
      });

      logger.info(`✅ Razorpay Payment Verified: ${payload.action}`, { payment_id: payload.razorpay_payment_id });
      res.json({ success: true });
    } else {
      logger.warn('🚨 Invalid Razorpay signature detected!', { body });
      res.status(400).json({ error: 'Invalid signature' });
    }
  } catch (err) {
    logger.error('Verification failed', { error: err });
    res.status(400).json({ error: 'Verification failed' });
  }
});

app.post('/api/razorpay/webhook', (req, res) => {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'] as string;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (expectedSignature === signature) {
      logger.info('✅ Webhook verified', { event: req.body.event });
      // In a real system, you would reconcile the database state here if the client disconnected during /verify
      res.json({ status: 'ok' });
    } else {
      logger.warn('🚨 Invalid Webhook signature');
      res.status(400).json({ error: 'Invalid signature' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Socket.IO Bridge
const sub = getSubClient();
sub.subscribe(CHANNELS.TASKS, CHANNELS.BIDS, CHANNELS.AWARDS, CHANNELS.RESULTS, CHANNELS.BOT_STATUS).catch(console.error);
sub.on('message', (channel, messageStr) => {
  io.emit(channel, JSON.parse(messageStr));
});
