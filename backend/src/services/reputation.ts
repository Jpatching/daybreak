import type { Verdict } from '../types';

interface ReputationInput {
  rugRate: number;         // 0.0 - 1.0
  tokenCount: number;      // total tokens created
  avgLifespanDays: number; // average days tokens survived
  clusterSize: number;     // number of related deployers in funding cluster
}

interface ReputationResult {
  score: number;    // 0-100 (0 = worst, 100 = cleanest)
  verdict: Verdict;
}

export function calculateReputation(input: ReputationInput): ReputationResult {
  // Rug rate component (40% weight) — higher rug rate = lower score
  const rugComponent = (1 - input.rugRate) * 40;

  // Token count penalty (20% weight) — more tokens = more suspicious (log scale)
  // 1 token = 20, 10 tokens = 13.3, 100 tokens = 6.7, 1000 tokens = 0
  const tokenPenalty = Math.max(0, 20 * (1 - Math.log10(Math.max(1, input.tokenCount)) / 3));

  // Average lifespan (20% weight) — longer lived tokens = better
  const lifespanScore = Math.min(20, input.avgLifespanDays * 0.5);

  // Cluster size (20% weight) — larger cluster = more suspicious
  const clusterPenalty = Math.max(0, 20 - Math.min(20, input.clusterSize * 2));

  const score = Math.round(rugComponent + tokenPenalty + lifespanScore + clusterPenalty);

  let verdict: Verdict;
  if (input.rugRate > 0.7) {
    verdict = 'SERIAL_RUGGER';
  } else if (input.rugRate > 0.3) {
    verdict = 'SUSPICIOUS';
  } else {
    verdict = 'CLEAN';
  }

  return { score, verdict };
}
