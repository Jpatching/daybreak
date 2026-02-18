import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Mock external services
vi.mock('../services/helius', () => ({
  healthCheck: vi.fn().mockResolvedValue(true),
  findDeployer: vi.fn().mockResolvedValue({ wallet: 'FakeDeployerWallet1111111111111111111111111', creationSig: 'sig123', method: 'enhanced_api' }),
  findDeployerTokens: vi.fn().mockResolvedValue({ tokens: [], limitReached: false }),
  getTokenMetadata: vi.fn().mockResolvedValue({ name: 'Test Token', symbol: 'TEST' }),
  findFundingSource: vi.fn().mockResolvedValue({ wallet: null, timestamp: null }),
  getSignaturesForAddress: vi.fn().mockResolvedValue([]),
  analyzeCluster: vi.fn().mockResolvedValue({ deployerCount: 0, fromCex: false, cexName: null, fundedWallets: [] }),
  checkMintAuthority: vi.fn().mockResolvedValue(null),
  checkDeployerHoldings: vi.fn().mockResolvedValue(null),
  checkTopHolders: vi.fn().mockResolvedValue(null),
  checkBundledLaunch: vi.fn().mockResolvedValue(null),
  getWalletSolBalance: vi.fn().mockResolvedValue(1.5),
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
  logScan: vi.fn(),
  getGuestUsage: vi.fn().mockReturnValue({ scansToday: 0, totalScans: 0, lastReset: '2026-01-01' }),
  checkGuestRateLimit: vi.fn().mockReturnValue(true),
  incrementGuestUsage: vi.fn(),
  getStats: vi.fn().mockReturnValue({ total_scans: 0, total_tokens: 0, verdicts: { CLEAN: 0, SUSPICIOUS: 0, SERIAL_RUGGER: 0 } }),
  getCachedDeployerTokens: vi.fn().mockReturnValue(null),
  upsertDeployerTokens: vi.fn(),
  getStaleAliveTokens: vi.fn().mockReturnValue([]),
  markTokenDead: vi.fn(),
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
