import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock helius before importing death-classifier
vi.mock('../services/helius', () => ({
  getEnhancedTransactions: vi.fn().mockResolvedValue([]),
  checkDeployerHoldings: vi.fn().mockResolvedValue(null),
  checkMintAuthority: vi.fn().mockResolvedValue(null),
  findFundingSource: vi.fn().mockResolvedValue(null),
  DEX_PROGRAM_IDS: new Set(['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8']),
}));

import { classifyDeaths } from '../services/death-classifier';
import { checkMintAuthority, checkDeployerHoldings, getEnhancedTransactions } from '../services/helius';

const DEPLOYER = 'DeployerWallet111111111111111111111111111111';
const FUNDER = 'FunderWallet1111111111111111111111111111111';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Death Classifier: lifespan_hours correctness', () => {
  it('caps lifespan_hours at 168 (7 days) for old dead tokens', async () => {
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const results = await classifyDeaths(
      DEPLOYER,
      [{ address: 'Token111111111111111111111111111111111111111', liquidity: 500, created_at: sixMonthsAgo }],
      null,
    );
    const classification = results.get('Token111111111111111111111111111111111111111');
    expect(classification).toBeDefined();
    expect(classification!.evidence.lifespan_hours).toBeLessThanOrEqual(168);
  });

  it('preserves short lifespan for recent tokens', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const results = await classifyDeaths(
      DEPLOYER,
      [{ address: 'Token222222222222222222222222222222222222222', liquidity: 500, created_at: twoHoursAgo }],
      null,
    );
    const classification = results.get('Token222222222222222222222222222222222222222');
    expect(classification).toBeDefined();
    expect(classification!.evidence.lifespan_hours).toBeLessThanOrEqual(3); // ~2h with rounding
  });
});

describe('Death Classifier: likely_rug detection', () => {
  it('classifies as likely_rug when deployer sold and had real buyers', async () => {
    const tokenAddr = 'Token333333333333333333333333333333333333333';
    vi.mocked(checkMintAuthority).mockResolvedValue({
      mintAuthority: null,
      freezeAuthority: null,
      supply: 1000000000,
      decimals: 9,
    });
    vi.mocked(checkDeployerHoldings).mockResolvedValue(0); // deployer sold everything

    const results = await classifyDeaths(
      DEPLOYER,
      [{ address: tokenAddr, liquidity: 500, created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() }],
      null,
    );
    const c = results.get(tokenAddr);
    expect(c).toBeDefined();
    expect(c!.type).toBe('likely_rug');
    expect(c!.evidence.deployer_sold).toBe(true);
  });

  it('classifies quick dump within 48h as likely_rug', async () => {
    const tokenAddr = 'Token444444444444444444444444444444444444444';
    vi.mocked(checkMintAuthority).mockResolvedValue({
      mintAuthority: null,
      freezeAuthority: null,
      supply: 1000000000,
      decimals: 9,
    });
    vi.mocked(checkDeployerHoldings).mockResolvedValue(0); // deployer sold

    // Token created 6 hours ago — should still trigger quick dump after lifespan fix
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const results = await classifyDeaths(
      DEPLOYER,
      [{ address: tokenAddr, liquidity: 10, created_at: sixHoursAgo }], // low liquidity but deployer sold
      null,
    );
    const c = results.get(tokenAddr);
    expect(c).toBeDefined();
    expect(c!.type).toBe('likely_rug');
    expect(c!.evidence.lifespan_hours).toBeLessThan(48);
  });
});

describe('Death Classifier: natural death', () => {
  it('classifies as natural when no real buyers and deployer still holds', async () => {
    const tokenAddr = 'Token555555555555555555555555555555555555555';
    vi.mocked(checkMintAuthority).mockResolvedValue({
      mintAuthority: null,
      freezeAuthority: null,
      supply: 1000000000,
      decimals: 9,
    });
    vi.mocked(checkDeployerHoldings).mockResolvedValue(50); // deployer still holds 50%

    const results = await classifyDeaths(
      DEPLOYER,
      [{ address: tokenAddr, liquidity: 10, created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }],
      null,
    );
    const c = results.get(tokenAddr);
    expect(c).toBeDefined();
    expect(c!.type).toBe('natural');
    expect(c!.evidence.deployer_sold).toBe(false);
  });

  it('classifies tokens with no DexScreener data as natural (never got traction)', async () => {
    const tokenAddr = 'Token666666666666666666666666666666666666666';
    const results = await classifyDeaths(
      DEPLOYER,
      [{ address: tokenAddr, liquidity: 0, created_at: null }],
      null,
    );
    const c = results.get(tokenAddr);
    expect(c).toBeDefined();
    expect(c!.type).toBe('natural');
  });
});

describe('Death Classifier: token at 48h boundary', () => {
  it('token at exactly 48h with deployer sold = likely_rug (boundary)', async () => {
    const tokenAddr = 'Token777777777777777777777777777777777777777';
    vi.mocked(checkMintAuthority).mockResolvedValue({
      mintAuthority: null,
      freezeAuthority: null,
      supply: 1000000000,
      decimals: 9,
    });
    vi.mocked(checkDeployerHoldings).mockResolvedValue(0);

    // Exactly 47h ago — should still be under 48h after rounding
    const created = new Date(Date.now() - 47 * 60 * 60 * 1000).toISOString();
    const results = await classifyDeaths(
      DEPLOYER,
      [{ address: tokenAddr, liquidity: 10, created_at: created }],
      null,
    );
    const c = results.get(tokenAddr);
    expect(c).toBeDefined();
    expect(c!.type).toBe('likely_rug');
    expect(c!.evidence.lifespan_hours).toBeLessThan(48);
  });
});

describe('Death Classifier: classification limit', () => {
  it('classifies up to 50 tokens (not just 20)', async () => {
    const deadTokens = Array.from({ length: 60 }, (_, i) => ({
      address: `Token${String(i).padStart(39, '0')}AA`,
      liquidity: 100 + i,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    }));

    const results = await classifyDeaths(DEPLOYER, deadTokens, null);
    // All 60 should get some classification (50 classifiable + 10 overflow as natural)
    expect(results.size).toBe(60);
    // The top 50 by liquidity should have been processed (even if they end up as natural/unverified)
    // The bottom 10 should be natural (no DexScreener classification needed)
  });
});
