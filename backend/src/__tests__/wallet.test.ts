import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const {
  mockFindDeployerTokens,
  mockGetTokenMetadata,
  mockBulkCheckTokens,
} = vi.hoisted(() => ({
  mockFindDeployerTokens: vi.fn(),
  mockGetTokenMetadata: vi.fn(),
  mockBulkCheckTokens: vi.fn(),
}));

vi.mock('../services/helius', () => ({
  healthCheck: vi.fn().mockResolvedValue(true),
  findDeployer: vi.fn(),
  findDeployerTokens: mockFindDeployerTokens,
  getTokenMetadata: mockGetTokenMetadata,
  findFundingSource: vi.fn().mockResolvedValue(null),
  getSignaturesForAddress: vi.fn().mockResolvedValue([]),
  analyzeCluster: vi.fn().mockResolvedValue({ deployerCount: 0 }),
  checkMintAuthority: vi.fn().mockResolvedValue(null),
  checkDeployerHoldings: vi.fn().mockResolvedValue(null),
  checkTopHolders: vi.fn().mockResolvedValue(null),
  checkBundledLaunch: vi.fn().mockResolvedValue(null),
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
}));

import { app } from '../index';

// Use unique addresses per test to avoid wallet scan cache collisions
const WALLET1 = 'FXkGydbnG4jHVYqbBWWG4kkkwCpz6YEeVtM1vA6kZLaS';
const WALLET2 = '5rSwWRfqGvnQaiJpW3sb3YKLbxtjVxgc4yrvrHNeNwE2';
const BOT_KEY = 'test-bot-key-123';

describe('Wallet scan endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns scan result for valid wallet', async () => {
    mockFindDeployerTokens.mockResolvedValue([]);
    mockBulkCheckTokens.mockResolvedValue(new Map());

    const res = await request(app)
      .get(`/api/v1/bot/wallet/${WALLET1}`)
      .set('X-Bot-Key', BOT_KEY);

    expect(res.status).toBe(200);
    expect(res.body.token.name).toBe('Wallet Scan');
    expect(res.body.deployer.wallet).toBe(WALLET1);
    expect(res.body).toHaveProperty('verdict');
    expect(res.body).toHaveProperty('evidence');
    expect(res.body).toHaveProperty('confidence');
    expect(res.body.confidence.token_risks_checked).toBe(false);
  });

  it('returns 400 for invalid wallet address', async () => {
    const res = await request(app)
      .get('/api/v1/bot/wallet/not-valid')
      .set('X-Bot-Key', BOT_KEY);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid Solana address');
  });

  it('handles wallet with tokens', async () => {
    const tokenMint = '61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump';
    mockFindDeployerTokens.mockResolvedValue([tokenMint]);
    mockBulkCheckTokens.mockResolvedValue(new Map([
      [tokenMint, { alive: true, liquidity: 1000000, name: 'Test', symbol: 'TST', pairCreatedAt: '2025-01-01T00:00:00.000Z' }],
    ]));
    mockGetTokenMetadata.mockResolvedValue({ name: 'Test', symbol: 'TST' });

    const res = await request(app)
      .get(`/api/v1/bot/wallet/${WALLET2}`)
      .set('X-Bot-Key', BOT_KEY);

    expect(res.status).toBe(200);
    expect(res.body.deployer.tokens_created).toBe(1);
    expect(res.body.deployer.tokens).toHaveLength(1);
    expect(res.body.deployer.tokens[0].alive).toBe(true);
  });

  it('returns 401 without bot key', async () => {
    const res = await request(app)
      .get(`/api/v1/bot/wallet/${WALLET1}`);

    expect(res.status).toBe(401);
  });
});
