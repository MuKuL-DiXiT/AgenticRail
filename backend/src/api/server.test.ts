import request from 'supertest';
import { app } from './server';
import { initDb, closeDb } from '../ledger/db';

jest.mock('../pubsub/client', () => ({
  getSubClient: jest.fn().mockReturnValue({
    subscribe: jest.fn().mockResolvedValue(true),
    on: jest.fn(),
  }),
}));

describe('API Routes', () => {
  beforeAll(() => {
    initDb(':memory:');
  });

  afterAll(() => {
    closeDb();
  });

  it('GET /api/metrics returns system metrics', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalTasks');
    expect(res.body).toHaveProperty('botWinRates');
  });

  it('GET /api/bots returns known bots with balances', async () => {
    const res = await request(app).get('/api/bots');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('bots');
    expect(Array.isArray(res.body.bots)).toBe(true);
    expect(res.body.bots[0]).toHaveProperty('id');
    expect(res.body.bots[0]).toHaveProperty('balance');
  });

  it('GET /api/ledger returns paginated rows', async () => {
    const res = await request(app).get('/api/ledger?limit=10&page=1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta.limit).toBe(10);
    expect(res.body.meta.page).toBe(1);
  });

  it('POST /api/ledger/verify validates the chain', async () => {
    const res = await request(app).post('/api/ledger/verify');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('valid');
  });
});
