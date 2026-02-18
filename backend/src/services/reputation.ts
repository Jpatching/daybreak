import type { Verdict, ScoreBreakdown } from '../types';

export interface RiskPenalties {
  mintAuthorityActive: boolean;   // -10 points
  freezeAuthorityActive: boolean; // -5 points
  topHolderPct: number | null;    // graduated: >80% -5, >60% -3, >40% -2
  bundleDetected: boolean;        // -5 points
  deployerHoldingsPct: number | null; // >50% -10, >30% -5, >10% -3
  deployVelocity: number | null;  // >5/day -10, >2/day -5, >1/day -3
}

interface ReputationInput {
  rugRate: number;         // 0.0 - 1.0
  tokenCount: number;      // total tokens created
  avgLifespanDays: number; // average days tokens survived
  clusterSize: number;     // number of related deployers in funding cluster
  riskPenalties?: RiskPenalties;
}

interface ReputationResult {
  score: number;
  verdict: Verdict;
  breakdown: ScoreBreakdown;
}

export function calculateReputation(input: ReputationInput): ReputationResult {
  const details: string[] = [];

  // Rug rate component (40% weight) — higher rug rate = lower score
  const rugComponent = Math.round(((1 - input.rugRate) * 40) * 10) / 10;
  details.push(`Rug rate ${(input.rugRate * 100).toFixed(1)}%: ${rugComponent.toFixed(1)} / 40 points`);

  // Token count penalty (20% weight) — more tokens = more suspicious (log scale)
  // Scale penalty by rug rate: many tokens is only suspicious if most are dead
  const baseTokenPenalty = Math.max(0, 20 * (1 - Math.log10(Math.max(1, input.tokenCount)) / 3));
  const lostPoints = 20 - baseTokenPenalty;
  const rugScaleFactor = Math.min(1, input.rugRate / 0.5);
  const tokenPenalty = Math.round((20 - lostPoints * rugScaleFactor) * 10) / 10;
  details.push(`${input.tokenCount} tokens created: ${tokenPenalty.toFixed(1)} / 20 points${rugScaleFactor < 1 ? ' (scaled by rug rate)' : ''}`);

  // Average lifespan (20% weight) — longer lived tokens = better
  const lifespanScore = Math.round(Math.min(20, input.avgLifespanDays * 0.5) * 10) / 10;
  details.push(`Avg lifespan ${input.avgLifespanDays.toFixed(1)} days: ${lifespanScore.toFixed(1)} / 20 points`);

  // Cluster size (20% weight) — larger cluster = more suspicious
  const clusterPenalty = Math.round(Math.max(0, 20 - Math.min(20, input.clusterSize * 2)) * 10) / 10;
  details.push(`Cluster size ${input.clusterSize}: ${clusterPenalty.toFixed(1)} / 20 points`);

  let riskDeduction = 0;
  if (input.riskPenalties) {
    const p = input.riskPenalties;

    if (p.mintAuthorityActive) {
      riskDeduction += 10;
      details.push('Mint authority active: -10 points');
    }
    if (p.freezeAuthorityActive) {
      riskDeduction += 5;
      details.push('Freeze authority active: -5 points');
    }

    // Graduated top holder penalty
    if (p.topHolderPct !== null && p.topHolderPct !== undefined) {
      if (p.topHolderPct > 80) {
        riskDeduction += 5;
        details.push(`Top holder ${p.topHolderPct.toFixed(1)}% (>80%): -5 points`);
      } else if (p.topHolderPct > 60) {
        riskDeduction += 3;
        details.push(`Top holder ${p.topHolderPct.toFixed(1)}% (>60%): -3 points`);
      } else if (p.topHolderPct > 40) {
        riskDeduction += 2;
        details.push(`Top holder ${p.topHolderPct.toFixed(1)}% (>40%): -2 points`);
      }
    }

    if (p.bundleDetected) {
      riskDeduction += 5;
      details.push('Bundled launch detected: -5 points');
    }

    // Deployer holdings penalty
    if (p.deployerHoldingsPct !== null && p.deployerHoldingsPct !== undefined) {
      if (p.deployerHoldingsPct > 50) {
        riskDeduction += 10;
        details.push(`Deployer holds ${p.deployerHoldingsPct.toFixed(1)}% (>50%): -10 points`);
      } else if (p.deployerHoldingsPct > 30) {
        riskDeduction += 5;
        details.push(`Deployer holds ${p.deployerHoldingsPct.toFixed(1)}% (>30%): -5 points`);
      } else if (p.deployerHoldingsPct > 10) {
        riskDeduction += 3;
        details.push(`Deployer holds ${p.deployerHoldingsPct.toFixed(1)}% (>10%): -3 points`);
      }
    }

    // Deploy velocity penalty
    if (p.deployVelocity !== null && p.deployVelocity !== undefined) {
      if (p.deployVelocity > 5) {
        riskDeduction += 10;
        details.push(`Deploy velocity ${p.deployVelocity.toFixed(1)}/day (>5): -10 points`);
      } else if (p.deployVelocity > 2) {
        riskDeduction += 5;
        details.push(`Deploy velocity ${p.deployVelocity.toFixed(1)}/day (>2): -5 points`);
      } else if (p.deployVelocity > 1) {
        riskDeduction += 3;
        details.push(`Deploy velocity ${p.deployVelocity.toFixed(1)}/day (>1): -3 points`);
      }
    }
  }

  const rawScore = rugComponent + tokenPenalty + lifespanScore + clusterPenalty;
  const score = Math.max(0, Math.round(rawScore) - riskDeduction);

  const breakdown: ScoreBreakdown = {
    rug_rate_component: rugComponent,
    token_count_component: tokenPenalty,
    lifespan_component: lifespanScore,
    cluster_component: clusterPenalty,
    risk_deductions: riskDeduction > 0 ? -riskDeduction : 0,
    details,
  };

  // Verdict based on composite score, with rug rate override
  let verdict: Verdict;
  if ((input.rugRate > 0.8 && input.tokenCount >= 3) || score < 30) {
    verdict = 'SERIAL_RUGGER';
  } else if (score < 60) {
    verdict = 'SUSPICIOUS';
  } else {
    verdict = 'CLEAN';
  }

  return { score, verdict, breakdown };
}
