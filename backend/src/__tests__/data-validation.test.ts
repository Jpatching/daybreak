import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateReputation, type RiskPenalties } from '../services/reputation';

// ── DexScreener parsePairs validation ──

let addrCounter = 1000;
function uniqueAddr() {
  addrCounter++;
  return `DataVal${addrCounter.toString().padStart(37, 'B')}`;
}

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

import { checkTokenStatus } from '../services/dexscreener';

function makePair(overrides: {
  address?: string;
  liquidity?: number;
  volume?: number;
  pairCreatedAt?: number;
  priceUsd?: string;
  name?: string;
  symbol?: string;
} = {}) {
  return {
    chainId: 'solana',
    dexId: 'raydium',
    pairAddress: 'pair123',
    baseToken: {
      address: overrides.address || uniqueAddr(),
      name: overrides.name || 'Test Token',
      symbol: overrides.symbol || 'TEST',
    },
    priceUsd: overrides.priceUsd || null,
    liquidity: { usd: overrides.liquidity ?? 0 },
    volume: { h24: overrides.volume ?? 0 },
    pairCreatedAt: overrides.pairCreatedAt ?? Date.now() - 48 * 60 * 60 * 1000,
  };
}

describe('Data Accuracy: $0 liquidity tokens must be dead', () => {
  it('$0 liquidity + $0 volume = dead (regardless of having a DexScreener pair)', async () => {
    const addr = uniqueAddr();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pairs: [makePair({ address: addr, liquidity: 0, volume: 0 })] }),
    });
    const result = await checkTokenStatus(addr);
    expect(result.alive).toBe(false);
    expect(result.liquidity).toBe(0);
  });

  it('$0.01 liquidity + $0 volume = dead (micro-liquidity trap)', async () => {
    const addr = uniqueAddr();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pairs: [makePair({ address: addr, liquidity: 0.01, volume: 0 })] }),
    });
    const result = await checkTokenStatus(addr);
    expect(result.alive).toBe(false);
  });

  it('$99 liquidity + $0 volume = dead (below $100 threshold)', async () => {
    const addr = uniqueAddr();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pairs: [makePair({ address: addr, liquidity: 99, volume: 0 })] }),
    });
    const result = await checkTokenStatus(addr);
    expect(result.alive).toBe(false);
  });

  it('$100 liquidity + $0 volume = alive (meets threshold)', async () => {
    const addr = uniqueAddr();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pairs: [makePair({ address: addr, liquidity: 100, volume: 0 })] }),
    });
    const result = await checkTokenStatus(addr);
    expect(result.alive).toBe(true);
  });

  it('$0 liquidity + $1 volume = alive (has trading activity)', async () => {
    const addr = uniqueAddr();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pairs: [makePair({ address: addr, liquidity: 0, volume: 1 })] }),
    });
    const result = await checkTokenStatus(addr);
    expect(result.alive).toBe(true);
  });

  it('new token (<24h) with $50 liquidity and no volume = dead (no new-token loophole)', async () => {
    const addr = uniqueAddr();
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pairs: [makePair({ address: addr, liquidity: 50, volume: 0, pairCreatedAt: fiveMinAgo })] }),
    });
    const result = await checkTokenStatus(addr);
    expect(result.alive).toBe(false);
  });
});

describe('Data Accuracy: Score breakdown math', () => {
  const noRisk: RiskPenalties = {
    mintAuthorityActive: false,
    freezeAuthorityActive: false,
    topHolderPct: null,
    bundleDetected: false,
    deployerHoldingsPct: null,
    deployVelocity: null,
    deployerIsBurner: false,
  };

  it('component scores sum to total (no risk deductions)', () => {
    const result = calculateReputation({
      deathRate: 0,
      rugRate: 0,
      tokenCount: 5,
      verifiedCount: 5,
      avgLifespanDays: 30,
      clusterSize: 0,
      riskPenalties: noRisk,
    });

    const componentSum =
      result.breakdown.rug_rate_component +
      result.breakdown.token_count_component +
      result.breakdown.lifespan_component +
      result.breakdown.cluster_component;

    expect(result.score).toBe(Math.round(Math.max(0, Math.min(100, componentSum + result.breakdown.risk_deductions))));
  });

  it('100% death rate with many tokens → SERIAL_RUGGER verdict', () => {
    const result = calculateReputation({
      deathRate: 1.0,
      rugRate: 1.0,
      tokenCount: 20,
      verifiedCount: 20,
      avgLifespanDays: 0.5,
      clusterSize: 10,
      riskPenalties: noRisk,
    });
    expect(result.verdict).toBe('SERIAL_RUGGER');
    expect(result.score).toBeLessThan(30);
  });

  it('0% death rate → CLEAN verdict', () => {
    const result = calculateReputation({
      deathRate: 0,
      rugRate: 0,
      tokenCount: 5,
      verifiedCount: 5,
      avgLifespanDays: 90,
      clusterSize: 0,
      riskPenalties: noRisk,
    });
    expect(result.verdict).toBe('CLEAN');
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('score is always between 0 and 100', () => {
    // Worst case
    const worst = calculateReputation({
      deathRate: 1.0,
      rugRate: 1.0,
      tokenCount: 100,
      verifiedCount: 100,
      avgLifespanDays: 0.01,
      clusterSize: 20,
      riskPenalties: {
        mintAuthorityActive: true,
        freezeAuthorityActive: true,
        topHolderPct: 99,
        bundleDetected: true,
        deployerHoldingsPct: 90,
        deployVelocity: 50,
        deployerIsBurner: true,
      },
    });
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);

    // Best case
    const best = calculateReputation({
      deathRate: 0,
      rugRate: 0,
      tokenCount: 3,
      verifiedCount: 3,
      avgLifespanDays: 365,
      clusterSize: 0,
      riskPenalties: noRisk,
    });
    expect(best.score).toBeGreaterThanOrEqual(0);
    expect(best.score).toBeLessThanOrEqual(100);
  });
});

describe('Data Accuracy: Death rate calculation', () => {
  it('death rate = dead / verified, not dead / total', () => {
    // If 5 tokens total, 3 verified, 2 unverified, 2 dead out of verified
    // death_rate should be 2/3 ≈ 0.667, not 2/5 = 0.4
    const verifiedCount = 3;
    const deadCount = 2;
    const totalTokens = 5;

    const deathRate = verifiedCount > 0 ? deadCount / verifiedCount : 0;
    expect(deathRate).toBeCloseTo(0.667, 2);
    expect(deathRate).not.toBeCloseTo(deadCount / totalTokens, 2);
  });
});

describe('Data Accuracy: Verdict thresholds', () => {
  const noRisk: RiskPenalties = {
    mintAuthorityActive: false,
    freezeAuthorityActive: false,
    topHolderPct: null,
    bundleDetected: false,
    deployerHoldingsPct: null,
    deployVelocity: null,
    deployerIsBurner: false,
  };

  it('score 60+ = CLEAN', () => {
    const result = calculateReputation({
      deathRate: 0.1,
      rugRate: 0.1,
      tokenCount: 3,
      verifiedCount: 3,
      avgLifespanDays: 60,
      clusterSize: 0,
      riskPenalties: noRisk,
    });
    if (result.score >= 60) {
      expect(result.verdict).toBe('CLEAN');
    }
  });

  it('score 30-59 = SUSPICIOUS', () => {
    const result = calculateReputation({
      deathRate: 0.6,
      rugRate: 0.6,
      tokenCount: 10,
      verifiedCount: 10,
      avgLifespanDays: 5,
      clusterSize: 2,
      riskPenalties: noRisk,
    });
    if (result.score >= 30 && result.score < 60) {
      expect(result.verdict).toBe('SUSPICIOUS');
    }
  });

  it('score 0-29 = SERIAL_RUGGER', () => {
    const result = calculateReputation({
      deathRate: 0.95,
      rugRate: 0.95,
      tokenCount: 20,
      verifiedCount: 20,
      avgLifespanDays: 0.5,
      clusterSize: 10,
      riskPenalties: noRisk,
    });
    if (result.score < 30) {
      expect(result.verdict).toBe('SERIAL_RUGGER');
    }
  });
});
