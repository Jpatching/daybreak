import type { Verdict } from '../types';

export interface RiskPenalties {
  mintAuthorityActive: boolean;   // -10 points
  freezeAuthorityActive: boolean; // -5 points
  topHolderAbove80: boolean;      // -5 points
  bundleDetected: boolean;        // -5 points
}

interface ReputationInput {
  rugRate: number;         // 0.0 - 1.0
  tokenCount: number;      // total tokens created
  avgLifespanDays: number; // average days tokens survived
  clusterSize: number;     // number of related deployers in funding cluster
  riskPenalties?: RiskPenalties;
}

interface ReputationResult {
  score: number;    // 0-100 (0 = worst, 100 = cleanest)
  verdict: Verdict;
}

export function calculateReputation(input: ReputationInput): ReputationResult {
  // Rug rate component (40% weight) — higher rug rate = lower score
  const rugComponent = (1 - input.rugRate) * 40;

  // Token count penalty (20% weight) — more tokens = more suspicious (log scale)
  // Scale penalty by rug rate: many tokens is only suspicious if most are dead
  // Low rug rate → reduced penalty; high rug rate → full penalty
  const baseTokenPenalty = Math.max(0, 20 * (1 - Math.log10(Math.max(1, input.tokenCount)) / 3));
  const lostPoints = 20 - baseTokenPenalty;
  const rugScaleFactor = Math.min(1, input.rugRate / 0.5); // full penalty at 50%+ rug rate
  const tokenPenalty = 20 - lostPoints * rugScaleFactor;

  // Average lifespan (20% weight) — longer lived tokens = better
  const lifespanScore = Math.min(20, input.avgLifespanDays * 0.5);

  // Cluster size (20% weight) — larger cluster = more suspicious
  const clusterPenalty = Math.max(0, 20 - Math.min(20, input.clusterSize * 2));

  let riskDeduction = 0;
  if (input.riskPenalties) {
    const p = input.riskPenalties;
    if (p.mintAuthorityActive) riskDeduction += 10;
    if (p.freezeAuthorityActive) riskDeduction += 5;
    if (p.topHolderAbove80) riskDeduction += 5;
    if (p.bundleDetected) riskDeduction += 5;
  }

  const score = Math.max(0, Math.round(rugComponent + tokenPenalty + lifespanScore + clusterPenalty) - riskDeduction);

  // Verdict based on composite score, with rug rate override
  let verdict: Verdict;
  if (input.rugRate > 0.8 || score < 30) {
    verdict = 'SERIAL_RUGGER';
  } else if (score < 60) {
    verdict = 'SUSPICIOUS';
  } else {
    verdict = 'CLEAN';
  }

  return { score, verdict };
}
