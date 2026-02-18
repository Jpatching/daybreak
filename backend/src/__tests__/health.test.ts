import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Mock helius before importing app
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

describe('GET /api/v1/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('helius', true);
    expect(res.body).toHaveProperty('version', '1.0.0');
  });
});

describe('404 catch-all', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not found');
  });
});
