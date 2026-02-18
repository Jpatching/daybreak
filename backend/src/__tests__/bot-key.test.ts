import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Mock external services
vi.mock('../services/helius', () => ({
  healthCheck: vi.fn().mockResolvedValue(true),
  findDeployer: vi.fn().mockResolvedValue({ wallet: 'FakeDeployerWallet1111111111111111111111111', creationSig: 'sig123', method: 'enhanced_api' }),
  findDeployerTokens: vi.fn().mockResolvedValue([]),
  getTokenMetadata: vi.fn().mockResolvedValue({ name: 'Test Token', symbol: 'TEST' }),
  findFundingSource: vi.fn().mockResolvedValue(null),
  getSignaturesForAddress: vi.fn().mockResolvedValue([]),
  analyzeCluster: vi.fn().mockResolvedValue({ deployerCount: 0 }),
  checkMintAuthority: vi.fn().mockResolvedValue(null),
  checkDeployerHoldings: vi.fn().mockResolvedValue(null),
  checkTopHolders: vi.fn().mockResolvedValue(null),
  checkBundledLaunch: vi.fn().mockResolvedValue(null),
}));

vi.mock('../services/dexscreener', () => ({
  bulkCheckTokens: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock('../services/db', () => ({
  getUsage: vi.fn().mockReturnValue({ scansToday: 0, totalScans: 0, isAdmin: false, lastReset: '2026-01-01' }),
  incrementUsage: vi.fn(),
  resetDailyUsage: vi.fn(),
  isAdmin: vi.fn().mockReturnValue(false),
  setAdmin: vi.fn(),
}));

import { app } from '../index';

const VALID_ADDRESS = '61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump';

describe('Bot API key auth (/api/v1/bot/*)', () => {
  it('returns 200 with valid bot key', async () => {
    const res = await request(app)
      .get(`/api/v1/bot/deployer/${VALID_ADDRESS}`)
      .set('X-Bot-Key', 'test-bot-key-123');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('deployer');
    expect(res.body).toHaveProperty('verdict');
  });

  it('returns 401 with invalid bot key', async () => {
    const res = await request(app)
      .get(`/api/v1/bot/deployer/${VALID_ADDRESS}`)
      .set('X-Bot-Key', 'wrong-key');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 without bot key header', async () => {
    const res = await request(app)
      .get(`/api/v1/bot/deployer/${VALID_ADDRESS}`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for invalid address', async () => {
    const res = await request(app)
      .get('/api/v1/bot/deployer/not-a-valid-address')
      .set('X-Bot-Key', 'test-bot-key-123');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid Solana address');
  });

  it('wallet endpoint works with valid bot key', async () => {
    const res = await request(app)
      .get(`/api/v1/bot/wallet/${VALID_ADDRESS}`)
      .set('X-Bot-Key', 'test-bot-key-123');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('deployer');
  });
});
