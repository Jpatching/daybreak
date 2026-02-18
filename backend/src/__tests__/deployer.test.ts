import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const {
  mockFindDeployer,
  mockFindDeployerTokens,
  mockGetTokenMetadata,
  mockFindFundingSource,
  mockGetSignaturesForAddress,
  mockBulkCheckTokens,
} = vi.hoisted(() => ({
  mockFindDeployer: vi.fn(),
  mockFindDeployerTokens: vi.fn(),
  mockGetTokenMetadata: vi.fn(),
  mockFindFundingSource: vi.fn(),
  mockGetSignaturesForAddress: vi.fn(),
  mockBulkCheckTokens: vi.fn(),
}));

vi.mock('../services/helius', () => ({
  healthCheck: vi.fn().mockResolvedValue(true),
  findDeployer: mockFindDeployer,
  findDeployerTokens: mockFindDeployerTokens,
  getTokenMetadata: mockGetTokenMetadata,
  findFundingSource: mockFindFundingSource,
  getSignaturesForAddress: mockGetSignaturesForAddress,
  analyzeCluster: vi.fn().mockResolvedValue({ deployerCount: 0, fromCex: false, cexName: null, fundedWallets: [] }),
  checkMintAuthority: vi.fn().mockResolvedValue(null),
  checkDeployerHoldings: vi.fn().mockResolvedValue(null),
  checkTopHolders: vi.fn().mockResolvedValue(null),
  checkBundledLaunch: vi.fn().mockResolvedValue(null),
  getWalletSolBalance: vi.fn().mockResolvedValue(1.5),
}));

vi.mock('../services/dexscreener', () => ({
  bulkCheckTokens: mockBulkCheckTokens,
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

// Use unique addresses per test to avoid scan cache collisions
const DEPLOYER_WALLET = 'FXkGydbnG4jHVYqbBWWG4kkkwCpz6YEeVtM1vA6kZLaS';
const BOT_KEY = 'test-bot-key-123';
// Generate unique-ish addresses by using different known valid Solana addresses
const ADDR1 = '61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump';
const ADDR2 = '5rSwWRfqGvnQaiJpW3sb3YKLbxtjVxgc4yrvrHNeNwE2';
const ADDR3 = 'DW2DQdED8ABpG98YCxf2UBgeJiw3ZaELJND1UsNEXkWq';
const ADDR4 = 'So11111111111111111111111111111111111111112';
const ADDR5 = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const ADDR6 = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

describe('Deployer scan endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns full scan result with valid token', async () => {
    mockGetTokenMetadata.mockResolvedValue({ name: 'AI Rig Complex', symbol: 'arc' });
    mockFindDeployer.mockResolvedValue({ wallet: DEPLOYER_WALLET, creationSig: 'sig123', method: 'enhanced_api' });
    mockFindDeployerTokens.mockResolvedValue({ tokens: [ADDR1], limitReached: false });
    mockBulkCheckTokens.mockResolvedValue(new Map([
      [ADDR1, { alive: true, liquidity: 4000000, name: 'AI Rig Complex', symbol: 'arc', pairCreatedAt: '2024-12-10T21:14:47.000Z' }],
    ]));
    mockFindFundingSource.mockResolvedValue({ wallet: null, timestamp: null });
    mockGetSignaturesForAddress.mockResolvedValue([]);

    const res = await request(app)
      .get(`/api/v1/bot/deployer/${ADDR1}`)
      .set('X-Bot-Key', BOT_KEY);

    expect(res.status).toBe(200);
    expect(res.body.token.address).toBe(ADDR1);
    expect(res.body.token.name).toBe('AI Rig Complex');
    expect(res.body.deployer.wallet).toBe(DEPLOYER_WALLET);
    expect(res.body.deployer.tokens_created).toBe(1);
    expect(res.body.deployer.tokens_dead).toBe(0);
    expect(res.body.deployer.reputation_score).toBeGreaterThanOrEqual(0);
    expect(res.body.deployer.reputation_score).toBeLessThanOrEqual(100);
    expect(res.body).toHaveProperty('verdict');
    expect(res.body).toHaveProperty('score_breakdown');
    expect(res.body.score_breakdown).toHaveProperty('rug_rate_component');
    expect(res.body.score_breakdown).toHaveProperty('details');
    expect(Array.isArray(res.body.score_breakdown.details)).toBe(true);
    expect(res.body.deployer).toHaveProperty('tokens_assumed_dead');
    expect(res.body).toHaveProperty('evidence');
    expect(res.body).toHaveProperty('confidence');
    expect(res.body).toHaveProperty('scanned_at');
  });

  it('returns 400 for invalid address', async () => {
    const res = await request(app)
      .get('/api/v1/bot/deployer/invalid-address')
      .set('X-Bot-Key', BOT_KEY);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid Solana address');
  });

  it('returns 404 when deployer not found', async () => {
    mockGetTokenMetadata.mockResolvedValue({ name: 'Unknown', symbol: '???' });
    mockFindDeployer.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/v1/bot/deployer/${ADDR3}`)
      .set('X-Bot-Key', BOT_KEY);

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Could not find deployer');
  });

  it('returns 503 on Helius API failure', async () => {
    mockGetTokenMetadata.mockRejectedValue(new Error('Helius API rate limited after 3 retries'));

    const res = await request(app)
      .get(`/api/v1/bot/deployer/${ADDR4}`)
      .set('X-Bot-Key', BOT_KEY);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('UPSTREAM_ERROR');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetTokenMetadata.mockRejectedValue(new Error('unexpected boom'));

    const res = await request(app)
      .get(`/api/v1/bot/deployer/${ADDR5}`)
      .set('X-Bot-Key', BOT_KEY);

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('SCAN_ERROR');
  });

  it('handles deployer with multiple tokens and dead tokens', async () => {
    mockGetTokenMetadata.mockResolvedValue({ name: 'Test Token', symbol: 'TEST' });
    mockFindDeployer.mockResolvedValue({ wallet: DEPLOYER_WALLET, creationSig: 'sig456', method: 'enhanced_api' });
    mockFindDeployerTokens.mockResolvedValue({ tokens: [ADDR6, ADDR2], limitReached: false });
    mockBulkCheckTokens.mockResolvedValue(new Map([
      [ADDR6, { alive: true, liquidity: 4000000, name: 'Token A', symbol: 'A', pairCreatedAt: '2024-12-10T21:14:47.000Z' }],
      [ADDR2, { alive: false, liquidity: 0, name: 'Dead Token', symbol: 'DEAD', pairCreatedAt: '2024-11-01T00:00:00.000Z' }],
    ]));
    mockFindFundingSource.mockResolvedValue({ wallet: null, timestamp: null });
    mockGetSignaturesForAddress.mockResolvedValue([]);

    const res = await request(app)
      .get(`/api/v1/bot/deployer/${ADDR6}`)
      .set('X-Bot-Key', BOT_KEY);

    expect(res.status).toBe(200);
    expect(res.body.deployer.tokens_created).toBe(2);
    expect(res.body.deployer.tokens_dead).toBe(1);
    expect(res.body.deployer.rug_rate).toBeGreaterThan(0);
  });
});
