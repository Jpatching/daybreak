import { describe, it, expect } from 'vitest';
import { calculateReputation, type RiskPenalties } from '../services/reputation';

// Helper to build minimal input with defaults
function repInput(overrides: {
  rugRate?: number;
  tokenCount?: number;
  avgLifespanDays?: number;
  clusterSize?: number;
  riskPenalties?: RiskPenalties;
} = {}) {
  return {
    rugRate: overrides.rugRate ?? 0,
    tokenCount: overrides.tokenCount ?? 1,
    avgLifespanDays: overrides.avgLifespanDays ?? 30,
    clusterSize: overrides.clusterSize ?? 0,
    riskPenalties: overrides.riskPenalties,
  };
}

// Default no-risk penalties for tests that need to specify riskPenalties
const noRisk: RiskPenalties = {
  mintAuthorityActive: false,
  freezeAuthorityActive: false,
  topHolderPct: null,
  bundleDetected: false,
  deployerHoldingsPct: null,
  deployVelocity: null,
};

describe('calculateReputation', () => {
  it('returns score, verdict, and breakdown', () => {
    const result = calculateReputation(repInput());
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('verdict');
    expect(result).toHaveProperty('breakdown');
    expect(result.breakdown).toHaveProperty('rug_rate_component');
    expect(result.breakdown).toHaveProperty('token_count_component');
    expect(result.breakdown).toHaveProperty('lifespan_component');
    expect(result.breakdown).toHaveProperty('cluster_component');
    expect(result.breakdown).toHaveProperty('risk_deductions');
    expect(result.breakdown).toHaveProperty('details');
    expect(Array.isArray(result.breakdown.details)).toBe(true);
  });

  describe('rug rate component (40% weight)', () => {
    it('gives 40 points for 0% rug rate', () => {
      const { score } = calculateReputation(repInput({ rugRate: 0, tokenCount: 1, avgLifespanDays: 40, clusterSize: 0 }));
      expect(score).toBe(100);
    });

    it('gives 20 points for 50% rug rate', () => {
      const { score } = calculateReputation(repInput({ rugRate: 0.5, tokenCount: 1, avgLifespanDays: 40, clusterSize: 0 }));
      expect(score).toBe(80);
    });

    it('gives 0 points for 100% rug rate', () => {
      const { score } = calculateReputation(repInput({ rugRate: 1.0, tokenCount: 1, avgLifespanDays: 40, clusterSize: 0 }));
      expect(score).toBeLessThanOrEqual(60);
    });
  });

  describe('token count penalty (20% weight, log scale)', () => {
    it('gives 20 points for 1 token with 0% rug rate', () => {
      const { score } = calculateReputation(repInput({ tokenCount: 1, rugRate: 0, avgLifespanDays: 40 }));
      expect(score).toBe(100);
    });

    it('scales penalty by rug rate', () => {
      const lowRug = calculateReputation(repInput({ tokenCount: 100, rugRate: 0.1 }));
      const highRug = calculateReputation(repInput({ tokenCount: 100, rugRate: 0.8 }));
      expect(lowRug.score).toBeGreaterThan(highRug.score);
    });

    it('applies full penalty at 50%+ rug rate (rugScaleFactor capped at 1)', () => {
      const at50 = calculateReputation(repInput({ tokenCount: 100, rugRate: 0.5, avgLifespanDays: 40 }));
      const at90 = calculateReputation(repInput({ tokenCount: 100, rugRate: 0.9, avgLifespanDays: 40 }));
      const scoreDiff = at50.score - at90.score;
      expect(scoreDiff).toBe(16);
    });
  });

  describe('lifespan score (20% weight)', () => {
    it('gives 0 points for 0 days lifespan', () => {
      const zero = calculateReputation(repInput({ avgLifespanDays: 0, clusterSize: 0 }));
      const thirty = calculateReputation(repInput({ avgLifespanDays: 30, clusterSize: 0 }));
      expect(thirty.score).toBeGreaterThan(zero.score);
    });

    it('caps at 20 points (40+ days)', () => {
      const at40 = calculateReputation(repInput({ avgLifespanDays: 40 }));
      const at100 = calculateReputation(repInput({ avgLifespanDays: 100 }));
      expect(at40.score).toBe(at100.score);
    });

    it('scales at 0.5 points per day', () => {
      const at10 = calculateReputation(repInput({ avgLifespanDays: 10, rugRate: 0, tokenCount: 1, clusterSize: 0 }));
      const at20 = calculateReputation(repInput({ avgLifespanDays: 20, rugRate: 0, tokenCount: 1, clusterSize: 0 }));
      expect(at20.score - at10.score).toBe(5);
    });
  });

  describe('cluster penalty (20% weight)', () => {
    it('gives 20 points for cluster size 0', () => {
      const { score } = calculateReputation(repInput({ clusterSize: 0, rugRate: 0, tokenCount: 1, avgLifespanDays: 40 }));
      expect(score).toBe(100);
    });

    it('gives 0 points for cluster size >= 10', () => {
      const at10 = calculateReputation(repInput({ clusterSize: 10, rugRate: 0, tokenCount: 1, avgLifespanDays: 40 }));
      const at15 = calculateReputation(repInput({ clusterSize: 15, rugRate: 0, tokenCount: 1, avgLifespanDays: 40 }));
      expect(at10.score).toBe(80);
      expect(at15.score).toBe(at10.score);
    });

    it('deducts 2 points per cluster member', () => {
      const at0 = calculateReputation(repInput({ clusterSize: 0, rugRate: 0, tokenCount: 1, avgLifespanDays: 40 }));
      const at5 = calculateReputation(repInput({ clusterSize: 5, rugRate: 0, tokenCount: 1, avgLifespanDays: 40 }));
      expect(at0.score - at5.score).toBe(10);
    });
  });

  describe('risk deductions', () => {
    it('deducts 10 for mint authority active', () => {
      const base = calculateReputation(repInput({ avgLifespanDays: 40 }));
      const withMint = calculateReputation(repInput({
        avgLifespanDays: 40,
        riskPenalties: { ...noRisk, mintAuthorityActive: true },
      }));
      expect(base.score - withMint.score).toBe(10);
    });

    it('deducts 5 for freeze authority active', () => {
      const base = calculateReputation(repInput({ avgLifespanDays: 40 }));
      const withFreeze = calculateReputation(repInput({
        avgLifespanDays: 40,
        riskPenalties: { ...noRisk, freezeAuthorityActive: true },
      }));
      expect(base.score - withFreeze.score).toBe(5);
    });

    it('deducts 5 for top holder above 80%', () => {
      const base = calculateReputation(repInput({ avgLifespanDays: 40 }));
      const withTop = calculateReputation(repInput({
        avgLifespanDays: 40,
        riskPenalties: { ...noRisk, topHolderPct: 85 },
      }));
      expect(base.score - withTop.score).toBe(5);
    });

    it('deducts 3 for top holder 60-80%', () => {
      const base = calculateReputation(repInput({ avgLifespanDays: 40 }));
      const withTop = calculateReputation(repInput({
        avgLifespanDays: 40,
        riskPenalties: { ...noRisk, topHolderPct: 70 },
      }));
      expect(base.score - withTop.score).toBe(3);
    });

    it('deducts 2 for top holder 40-60%', () => {
      const base = calculateReputation(repInput({ avgLifespanDays: 40 }));
      const withTop = calculateReputation(repInput({
        avgLifespanDays: 40,
        riskPenalties: { ...noRisk, topHolderPct: 50 },
      }));
      expect(base.score - withTop.score).toBe(2);
    });

    it('deducts 5 for bundle detected', () => {
      const base = calculateReputation(repInput({ avgLifespanDays: 40 }));
      const withBundle = calculateReputation(repInput({
        avgLifespanDays: 40,
        riskPenalties: { ...noRisk, bundleDetected: true },
      }));
      expect(base.score - withBundle.score).toBe(5);
    });

    it('deducts 10 for deployer holdings > 50%', () => {
      const base = calculateReputation(repInput({ avgLifespanDays: 40 }));
      const with50 = calculateReputation(repInput({
        avgLifespanDays: 40,
        riskPenalties: { ...noRisk, deployerHoldingsPct: 55 },
      }));
      expect(base.score - with50.score).toBe(10);
    });

    it('deducts 5 for deployer holdings 30-50%', () => {
      const base = calculateReputation(repInput({ avgLifespanDays: 40 }));
      const with35 = calculateReputation(repInput({
        avgLifespanDays: 40,
        riskPenalties: { ...noRisk, deployerHoldingsPct: 35 },
      }));
      expect(base.score - with35.score).toBe(5);
    });

    it('deducts 3 for deployer holdings 10-30%', () => {
      const base = calculateReputation(repInput({ avgLifespanDays: 40 }));
      const with15 = calculateReputation(repInput({
        avgLifespanDays: 40,
        riskPenalties: { ...noRisk, deployerHoldingsPct: 15 },
      }));
      expect(base.score - with15.score).toBe(3);
    });

    it('deducts 10 for velocity > 5/day', () => {
      const base = calculateReputation(repInput({ avgLifespanDays: 40 }));
      const withVel = calculateReputation(repInput({
        avgLifespanDays: 40,
        riskPenalties: { ...noRisk, deployVelocity: 6 },
      }));
      expect(base.score - withVel.score).toBe(10);
    });

    it('deducts 5 for velocity 2-5/day', () => {
      const base = calculateReputation(repInput({ avgLifespanDays: 40 }));
      const withVel = calculateReputation(repInput({
        avgLifespanDays: 40,
        riskPenalties: { ...noRisk, deployVelocity: 3 },
      }));
      expect(base.score - withVel.score).toBe(5);
    });

    it('deducts 3 for velocity 1-2/day', () => {
      const base = calculateReputation(repInput({ avgLifespanDays: 40 }));
      const withVel = calculateReputation(repInput({
        avgLifespanDays: 40,
        riskPenalties: { ...noRisk, deployVelocity: 1.5 },
      }));
      expect(base.score - withVel.score).toBe(3);
    });

    it('clamps score to 0 (never negative)', () => {
      const { score } = calculateReputation({
        rugRate: 1.0,
        tokenCount: 1000,
        avgLifespanDays: 0,
        clusterSize: 20,
        riskPenalties: {
          mintAuthorityActive: true,
          freezeAuthorityActive: true,
          topHolderPct: 90,
          bundleDetected: true,
          deployerHoldingsPct: 60,
          deployVelocity: 10,
        },
      });
      expect(score).toBe(0);
    });

    it('does not apply deductions when riskPenalties is undefined', () => {
      const without = calculateReputation(repInput({ avgLifespanDays: 40 }));
      expect(without.score).toBe(100);
    });
  });

  describe('verdict thresholds', () => {
    it('returns SERIAL_RUGGER when rugRate > 0.8 AND tokenCount >= 3', () => {
      const { verdict } = calculateReputation(repInput({ rugRate: 0.81, tokenCount: 3, avgLifespanDays: 40 }));
      expect(verdict).toBe('SERIAL_RUGGER');
    });

    it('does NOT override to SERIAL_RUGGER when rugRate is exactly 0.8 (strict >)', () => {
      const { verdict } = calculateReputation(repInput({ rugRate: 0.8, tokenCount: 3, avgLifespanDays: 40 }));
      expect(verdict).not.toBe('SERIAL_RUGGER');
    });

    it('does NOT override to SERIAL_RUGGER with rugRate > 0.8 but tokenCount < 3', () => {
      const { verdict } = calculateReputation(repInput({ rugRate: 0.9, tokenCount: 2, avgLifespanDays: 40 }));
      expect(verdict).not.toBe('SERIAL_RUGGER');
    });

    it('returns SERIAL_RUGGER when score < 30 regardless of rug rate', () => {
      const { verdict, score } = calculateReputation({
        rugRate: 0.6,
        tokenCount: 500,
        avgLifespanDays: 0,
        clusterSize: 20,
        riskPenalties: {
          mintAuthorityActive: true,
          freezeAuthorityActive: true,
          topHolderPct: 90,
          bundleDetected: true,
          deployerHoldingsPct: 60,
          deployVelocity: 10,
        },
      });
      expect(score).toBeLessThan(30);
      expect(verdict).toBe('SERIAL_RUGGER');
    });

    it('returns SUSPICIOUS when score >= 30 and < 60', () => {
      const { verdict, score } = calculateReputation(repInput({ rugRate: 0.6, tokenCount: 10, avgLifespanDays: 5, clusterSize: 5 }));
      expect(score).toBeGreaterThanOrEqual(30);
      expect(score).toBeLessThan(60);
      expect(verdict).toBe('SUSPICIOUS');
    });

    it('returns CLEAN when score >= 60', () => {
      const { verdict, score } = calculateReputation(repInput({ rugRate: 0, tokenCount: 1, avgLifespanDays: 40, clusterSize: 0 }));
      expect(score).toBeGreaterThanOrEqual(60);
      expect(verdict).toBe('CLEAN');
    });
  });

  describe('breakdown details', () => {
    it('includes detail strings for each component', () => {
      const { breakdown } = calculateReputation(repInput({ rugRate: 0.5, tokenCount: 10, avgLifespanDays: 5 }));
      expect(breakdown.details.length).toBeGreaterThanOrEqual(4);
      expect(breakdown.details[0]).toContain('Rug rate');
      expect(breakdown.details[1]).toContain('tokens created');
      expect(breakdown.details[2]).toContain('Avg lifespan');
      expect(breakdown.details[3]).toContain('Cluster size');
    });

    it('includes risk deduction details when penalties present', () => {
      const { breakdown } = calculateReputation(repInput({
        avgLifespanDays: 40,
        riskPenalties: { ...noRisk, mintAuthorityActive: true, deployerHoldingsPct: 55 },
      }));
      expect(breakdown.details.some(d => d.includes('Mint authority active'))).toBe(true);
      expect(breakdown.details.some(d => d.includes('Deployer holds'))).toBe(true);
      expect(breakdown.risk_deductions).toBe(-20);
    });
  });

  describe('real-world scenarios', () => {
    it('194 tokens / 80.9% rug → SERIAL_RUGGER', () => {
      const { verdict } = calculateReputation(repInput({
        rugRate: 0.809,
        tokenCount: 194,
        avgLifespanDays: 2,
        clusterSize: 0,
      }));
      expect(verdict).toBe('SERIAL_RUGGER');
    });

    it('1 token / 0% rug → CLEAN with score ~100', () => {
      const { verdict, score } = calculateReputation(repInput({
        rugRate: 0,
        tokenCount: 1,
        avgLifespanDays: 40,
        clusterSize: 0,
      }));
      expect(verdict).toBe('CLEAN');
      expect(score).toBe(100);
    });

    it('perfect deployer with all risk flags → reduced score', () => {
      const { score, verdict } = calculateReputation({
        rugRate: 0,
        tokenCount: 1,
        avgLifespanDays: 40,
        clusterSize: 0,
        riskPenalties: {
          mintAuthorityActive: true,     // -10
          freezeAuthorityActive: true,   // -5
          topHolderPct: 90,              // -5
          bundleDetected: true,          // -5
          deployerHoldingsPct: null,
          deployVelocity: null,
        },
      });
      expect(score).toBe(75); // 100 - 25
      expect(verdict).toBe('CLEAN');
    });
  });
});
