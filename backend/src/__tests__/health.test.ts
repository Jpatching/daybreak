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
}));

vi.mock('../services/db', () => ({
  getUsage: vi.fn().mockReturnValue({ scansToday: 0, totalScans: 0, isAdmin: false, lastReset: '2026-01-01' }),
  incrementUsage: vi.fn(),
  resetDailyUsage: vi.fn(),
  isAdmin: vi.fn().mockReturnValue(false),
  setAdmin: vi.fn(),
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
