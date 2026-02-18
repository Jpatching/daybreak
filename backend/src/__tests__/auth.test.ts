import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../services/helius', () => ({
  healthCheck: vi.fn().mockResolvedValue(true),
  findDeployer: vi.fn(),
  findDeployerTokens: vi.fn(),
  getTokenMetadata: vi.fn(),
  findFundingSource: vi.fn(),
  getSignaturesForAddress: vi.fn(),
  analyzeCluster: vi.fn(),
  checkMintAuthority: vi.fn(),
  checkDeployerHoldings: vi.fn(),
  checkTopHolders: vi.fn(),
  checkBundledLaunch: vi.fn(),
  getWalletSolBalance: vi.fn().mockResolvedValue(1.5),
}));

vi.mock('../services/db', () => ({
  getUsage: vi.fn().mockReturnValue({ scansToday: 0, totalScans: 0, isAdmin: false, lastReset: '2026-01-01' }),
  incrementUsage: vi.fn(),
  resetDailyUsage: vi.fn(),
  isAdmin: vi.fn().mockReturnValue(false),
  setAdmin: vi.fn(),
  logScan: vi.fn(),
  getGuestUsage: vi.fn().mockReturnValue({ scansToday: 0, totalScans: 0, lastReset: '2026-01-01' }),
  checkGuestRateLimit: vi.fn().mockReturnValue(true),
  incrementGuestUsage: vi.fn(),
  getStats: vi.fn().mockReturnValue({ total_scans: 0, total_tokens: 0, verdicts: { CLEAN: 0, SUSPICIOUS: 0, SERIAL_RUGGER: 0 } }),
}));

vi.mock('../services/jupiter', () => ({
  getTokenPrice: vi.fn().mockResolvedValue(0.05),
  getTokenPrices: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock('../services/rugcheck', () => ({
  getTokenReport: vi.fn().mockResolvedValue(null),
}));

vi.mock('../services/pumpportal', () => ({
  startPumpPortal: vi.fn(),
  stopPumpPortal: vi.fn(),
  getRecentNewTokens: vi.fn().mockReturnValue([]),
  getRecentMigrations: vi.fn().mockReturnValue([]),
  getPumpPortalStatus: vi.fn().mockReturnValue({ connected: false, newTokenCount: 0, migrationCount: 0 }),
}));

import { app } from '../index';

const VALID_WALLET = '5rSwWRfqGvnQaiJpW3sb3YKLbxtjVxgc4yrvrHNeNwE2';

describe('Auth endpoints', () => {
  describe('GET /api/v1/auth/nonce', () => {
    it('returns nonce for valid wallet', async () => {
      const res = await request(app)
        .get(`/api/v1/auth/nonce?wallet=${VALID_WALLET}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('nonce');
      expect(typeof res.body.nonce).toBe('string');
      expect(res.body.nonce.length).toBeGreaterThan(0);
    });

    it('returns 400 without wallet param', async () => {
      const res = await request(app).get('/api/v1/auth/nonce');
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid wallet address', async () => {
      const res = await request(app).get('/api/v1/auth/nonce?wallet=invalid');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/verify', () => {
    it('returns 400 without required fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify')
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 with invalid wallet', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify')
        .send({ wallet: 'invalid', signature: 'sig', message: 'msg' });

      expect(res.status).toBe(400);
    });

    it('returns 401 with invalid signature', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify')
        .send({ wallet: VALID_WALLET, signature: 'badsig', message: 'wrong message' });

      expect(res.status).toBe(401);
    });
  });

  describe('Protected deployer endpoint', () => {
    it('returns 401 without auth header', async () => {
      const res = await request(app)
        .get(`/api/v1/deployer/${VALID_WALLET}`);

      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid bearer token', async () => {
      const res = await request(app)
        .get(`/api/v1/deployer/${VALID_WALLET}`)
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });
});
