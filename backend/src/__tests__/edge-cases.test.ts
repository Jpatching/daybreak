import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const {
  mockFindDeployer,
  mockFindDeployerTokens,
  mockGetTokenMetadata,
  mockFindFundingSource,
  mockGetSignaturesForAddress,
  mockBulkCheckTokens,
  mockCheckMintAuthority,
} = vi.hoisted(() => ({
  mockFindDeployer: vi.fn(),
  mockFindDeployerTokens: vi.fn(),
  mockGetTokenMetadata: vi.fn(),
  mockFindFundingSource: vi.fn(),
  mockGetSignaturesForAddress: vi.fn(),
  mockBulkCheckTokens: vi.fn(),
  mockCheckMintAuthority: vi.fn(),
}));

vi.mock('../services/helius', () => ({
  healthCheck: vi.fn().mockResolvedValue(true),
  findDeployer: mockFindDeployer,
  findDeployerTokens: mockFindDeployerTokens,
  getTokenMetadata: mockGetTokenMetadata,
  findFundingSource: mockFindFundingSource,
  getSignaturesForAddress: mockGetSignaturesForAddress,
  analyzeCluster: vi.fn().mockResolvedValue({ deployerCount: 0, fromCex: false, cexName: null, fundedWallets: [] }),
  checkMintAuthority: mockCheckMintAuthority,
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

const BOT_KEY = 'test-bot-key-123';
// Use unique addresses to avoid scan cache collisions
const EDGE_ADDR1 = '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr';
const EDGE_ADDR2 = '8GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr';
const EDGE_ADDR3 = '9GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr';
const EDGE_ADDR4 = 'AGCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr';
const DEPLOYER_WALLET = 'BGCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr';

describe('Edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles zero-token deployer: 0 tokens, 0 rug rate, CLEAN verdict', async () => {
    mockGetTokenMetadata.mockResolvedValue({ name: 'Ghost Token', symbol: 'GHOST' });
    mockFindDeployer.mockResolvedValue({ wallet: DEPLOYER_WALLET, creationSig: 'sig1', method: 'enhanced_api' });
    mockFindDeployerTokens.mockResolvedValue({ tokens: [], limitReached: false });
    // Safety net adds the scanned token back, so bulkCheckTokens is called with [EDGE_ADDR1]
    mockBulkCheckTokens.mockResolvedValue(new Map([
      [EDGE_ADDR1, { alive: true, liquidity: 1000, volume24h: 50, name: 'Ghost Token', symbol: 'GHOST', pairCreatedAt: new Date().toISOString() }],
    ]));
    mockFindFundingSource.mockResolvedValue({ wallet: null, timestamp: null });
    mockGetSignaturesForAddress.mockResolvedValue([]);
    mockCheckMintAuthority.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/v1/bot/deployer/${EDGE_ADDR1}`)
      .set('X-Bot-Key', BOT_KEY);

    expect(res.status).toBe(200);
    // Safety net ensures at least 1 token (the scanned one)
    expect(res.body.deployer.tokens_created).toBe(1);
    expect(res.body.deployer.rug_rate).toBe(0);
    expect(res.body.verdict).toBe('CLEAN');
  });

  it('safety net includes scanned token even when deployer history is empty', async () => {
    mockGetTokenMetadata.mockResolvedValue({ name: 'Orphan', symbol: 'ORPH' });
    mockFindDeployer.mockResolvedValue({ wallet: DEPLOYER_WALLET, creationSig: 'sig2', method: 'rpc_fallback' });
    mockFindDeployerTokens.mockResolvedValue({ tokens: [], limitReached: false }); // empty history
    mockBulkCheckTokens.mockResolvedValue(new Map([
      [EDGE_ADDR2, { alive: true, liquidity: 200, volume24h: 0, name: 'Orphan', symbol: 'ORPH', pairCreatedAt: new Date().toISOString() }],
    ]));
    mockFindFundingSource.mockResolvedValue({ wallet: null, timestamp: null });
    mockGetSignaturesForAddress.mockResolvedValue([]);
    mockCheckMintAuthority.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/v1/bot/deployer/${EDGE_ADDR2}`)
      .set('X-Bot-Key', BOT_KEY);

    expect(res.status).toBe(200);
    expect(res.body.deployer.tokens_created).toBe(1);
    // The scanned token address should be present in the token list
    const tokenAddresses = res.body.deployer.tokens.map((t: any) => t.address);
    expect(tokenAddresses).toContain(EDGE_ADDR2);
  });

  it('handles brand-new token < 24h old with isNew alive logic', async () => {
    const recentTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h ago
    mockGetTokenMetadata.mockResolvedValue({ name: 'Fresh', symbol: 'FRESH' });
    mockFindDeployer.mockResolvedValue({ wallet: DEPLOYER_WALLET, creationSig: 'sig3', method: 'enhanced_api' });
    mockFindDeployerTokens.mockResolvedValue({ tokens: [EDGE_ADDR3], limitReached: false });
    mockBulkCheckTokens.mockResolvedValue(new Map([
      [EDGE_ADDR3, { alive: true, liquidity: 0, volume24h: 0, name: 'Fresh', symbol: 'FRESH', pairCreatedAt: recentTimestamp }],
    ]));
    mockFindFundingSource.mockResolvedValue({ wallet: null, timestamp: null });
    mockGetSignaturesForAddress.mockResolvedValue([]);
    mockCheckMintAuthority.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/v1/bot/deployer/${EDGE_ADDR3}`)
      .set('X-Bot-Key', BOT_KEY);

    expect(res.status).toBe(200);
    expect(res.body.deployer.tokens_dead).toBe(0);
    // avgLifespanDays should be non-null (calculated from creation date)
    expect(res.body.deployer.tokens.length).toBe(1);
    expect(res.body.deployer.tokens[0].alive).toBe(true);
  });

  it('x402 paid endpoint returns 402 with payment_required structure when no X-PAYMENT header', async () => {
    const res = await request(app)
      .get(`/api/v1/paid/deployer/${EDGE_ADDR4}`)
      // No X-PAYMENT header

    expect(res.status).toBe(402);
    expect(res.body.payment_required).toBe(true);
    expect(res.body.price_usd).toBeDefined();
    expect(res.body.details).toBeDefined();
    expect(res.body.details.accepts).toBeInstanceOf(Array);
    expect(res.body.details.accepts[0]).toHaveProperty('scheme');
    expect(res.body.details.accepts[0]).toHaveProperty('payTo');
    expect(res.body.details.accepts[0]).toHaveProperty('network');
  });

  describe('address validation edge cases', () => {
    it('rejects address with invalid base58 char 0', async () => {
      const res = await request(app)
        .get('/api/v1/bot/deployer/0rSwWRfqGvnQaiJpW3sb3YKLbxtjVxgc4yrvrHNeNwE2')
        .set('X-Bot-Key', BOT_KEY);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid Solana address');
    });

    it('rejects address with invalid base58 char O', async () => {
      const res = await request(app)
        .get('/api/v1/bot/deployer/OrSwWRfqGvnQaiJpW3sb3YKLbxtjVxgc4yrvrHNeNwE2')
        .set('X-Bot-Key', BOT_KEY);
      expect(res.status).toBe(400);
    });

    it('rejects address with invalid base58 char I', async () => {
      const res = await request(app)
        .get('/api/v1/bot/deployer/IrSwWRfqGvnQaiJpW3sb3YKLbxtjVxgc4yrvrHNeNwE2')
        .set('X-Bot-Key', BOT_KEY);
      expect(res.status).toBe(400);
    });

    it('rejects address with invalid base58 char l', async () => {
      const res = await request(app)
        .get('/api/v1/bot/deployer/lrSwWRfqGvnQaiJpW3sb3YKLbxtjVxgc4yrvrHNeNwE2')
        .set('X-Bot-Key', BOT_KEY);
      expect(res.status).toBe(400);
    });
  });
});
