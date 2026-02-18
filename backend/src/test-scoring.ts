/**
 * E2E Scoring Validation Script
 *
 * Validates the scoring logic end-to-end with both unit tests
 * (direct calculateReputation calls) and live API integration tests.
 *
 * Usage: npx ts-node src/test-scoring.ts
 */

import { calculateReputation } from './services/reputation';

const API_BASE = process.env.API_BASE || 'https://api.daybreakscan.com/api/v1';

// Known test tokens
const ARC_TOKEN = '61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump';
const BONK_TOKEN = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.log(`  ✗ ${testName}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// Helper to create input with defaults
function makeInput(overrides: Partial<{
  deathRate: number;
  rugRate: number;
  tokenCount: number;
  verifiedCount: number;
  avgLifespanDays: number;
  clusterSize: number;
  riskPenalties: any;
}>) {
  const deathRate = overrides.deathRate ?? overrides.rugRate ?? 0;
  const tokenCount = overrides.tokenCount ?? 1;
  return {
    deathRate,
    rugRate: overrides.rugRate ?? deathRate,
    tokenCount,
    verifiedCount: overrides.verifiedCount ?? tokenCount,
    avgLifespanDays: overrides.avgLifespanDays ?? 0,
    clusterSize: overrides.clusterSize ?? 0,
    riskPenalties: overrides.riskPenalties,
  };
}

// ─── Unit Tests: calculateReputation() ───────────────────────────────

function testScoringUnit() {
  console.log('\n═══ Unit Tests: calculateReputation() ═══\n');

  // Test 1: Perfect deployer — 1 alive token, no rug, no cluster
  {
    const r = calculateReputation(makeInput({
      deathRate: 0.0,
      tokenCount: 1,
      avgLifespanDays: 60,
      clusterSize: 0,
    }));
    assert(r.verdict === 'CLEAN', 'Perfect deployer → CLEAN', `got ${r.verdict}`);
    assert(r.score >= 75, 'Perfect deployer score >= 75', `got ${r.score}`);
  }

  // Test 2: Serial rugger — many dead tokens, high death rate
  {
    const r = calculateReputation(makeInput({
      deathRate: 0.9,
      tokenCount: 50,
      verifiedCount: 50,
      avgLifespanDays: 1,
      clusterSize: 5,
    }));
    assert(r.verdict === 'SERIAL_RUGGER', 'Serial rugger → SERIAL_RUGGER', `got ${r.verdict}`);
    assert(r.score < 30, 'Serial rugger score < 30', `got ${r.score}`);
  }

  // Test 3: Single dead token should NOT be SERIAL_RUGGER
  {
    const r = calculateReputation(makeInput({
      deathRate: 1.0,
      tokenCount: 1,
      avgLifespanDays: 0,
      clusterSize: 0,
    }));
    assert(
      r.verdict !== 'SERIAL_RUGGER',
      'Single dead token ≠ SERIAL_RUGGER',
      `got ${r.verdict}, score=${r.score}`
    );
  }

  // Test 4: Two dead tokens — still below threshold (needs >= 3)
  {
    const r = calculateReputation(makeInput({
      deathRate: 1.0,
      tokenCount: 2,
      verifiedCount: 2,
      avgLifespanDays: 0,
      clusterSize: 0,
    }));
    assert(
      r.verdict !== 'SERIAL_RUGGER',
      '2 dead tokens ≠ SERIAL_RUGGER',
      `got ${r.verdict}, score=${r.score}`
    );
  }

  // Test 5: Three dead tokens — now eligible for SERIAL_RUGGER
  {
    const r = calculateReputation(makeInput({
      deathRate: 1.0,
      tokenCount: 3,
      verifiedCount: 3,
      avgLifespanDays: 0,
      clusterSize: 0,
    }));
    assert(
      r.verdict === 'SERIAL_RUGGER',
      '3 dead tokens + 100% death → SERIAL_RUGGER',
      `got ${r.verdict}, score=${r.score}`
    );
  }

  // Test 6: Bayesian scoring — small sample regresses toward prior
  {
    const small = calculateReputation(makeInput({
      deathRate: 0.5,
      tokenCount: 2,
      verifiedCount: 2,
      avgLifespanDays: 20,
      clusterSize: 0,
    }));
    const large = calculateReputation(makeInput({
      deathRate: 0.5,
      tokenCount: 100,
      verifiedCount: 100,
      avgLifespanDays: 20,
      clusterSize: 0,
    }));
    // Small sample should regress toward 50% prior, so score should be similar but not worse
    assert(small.score >= large.score - 5, 'Small sample Bayesian regression protects score',
      `small=${small.score} large=${large.score}`);
  }

  // Test 7: Risk penalties deduct correctly
  {
    const base = calculateReputation(makeInput({
      deathRate: 0.0,
      tokenCount: 1,
      avgLifespanDays: 60,
      clusterSize: 0,
    }));
    const withRisks = calculateReputation(makeInput({
      deathRate: 0.0,
      tokenCount: 1,
      avgLifespanDays: 60,
      clusterSize: 0,
      riskPenalties: {
        mintAuthorityActive: true,    // -10
        freezeAuthorityActive: true,  // -5
        topHolderPct: 90,             // -5 (>80%)
        bundleDetected: true,         // -5
        deployerHoldingsPct: null,
        deployVelocity: null,
        deployerIsBurner: false,
      },
    }));
    const expectedDiff = 25;
    const actualDiff = base.score - withRisks.score;
    assert(actualDiff === expectedDiff, `Risk penalties total -25 (got -${actualDiff})`);
  }

  // Test 8: Cluster size penalty works
  {
    const noCluster = calculateReputation(makeInput({
      deathRate: 0.0,
      tokenCount: 1,
      avgLifespanDays: 30,
      clusterSize: 0,
    }));
    const bigCluster = calculateReputation(makeInput({
      deathRate: 0.0,
      tokenCount: 1,
      avgLifespanDays: 30,
      clusterSize: 10,
    }));
    assert(noCluster.score > bigCluster.score, 'Big cluster lowers score', `no=${noCluster.score} big=${bigCluster.score}`);
  }

  // Test 9: Burner wallet penalty
  {
    const noBurner = calculateReputation(makeInput({
      deathRate: 0.5,
      tokenCount: 5,
      verifiedCount: 5,
      avgLifespanDays: 10,
      clusterSize: 0,
      riskPenalties: {
        mintAuthorityActive: false,
        freezeAuthorityActive: false,
        topHolderPct: null,
        bundleDetected: false,
        deployerHoldingsPct: null,
        deployVelocity: null,
        deployerIsBurner: false,
      },
    }));
    const withBurner = calculateReputation(makeInput({
      deathRate: 0.5,
      tokenCount: 5,
      verifiedCount: 5,
      avgLifespanDays: 10,
      clusterSize: 0,
      riskPenalties: {
        mintAuthorityActive: false,
        freezeAuthorityActive: false,
        topHolderPct: null,
        bundleDetected: false,
        deployerHoldingsPct: null,
        deployVelocity: null,
        deployerIsBurner: true,
      },
    }));
    assert(noBurner.score - withBurner.score === 10, 'Burner penalty = -10',
      `no=${noBurner.score} burner=${withBurner.score}`);
  }
}

// ─── Integration Tests: Live API ─────────────────────────────────────

async function testLiveAPI() {
  console.log('\n═══ Integration Tests: Live API ═══\n');

  // Test: Health endpoint
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data: any = await res.json();
    assert(res.ok, 'Health endpoint returns 200');
    assert(data.status === 'ok', 'Health status = ok', `got ${data.status}`);
    assert(data.helius === true, 'Helius connected', `got ${data.helius}`);
  } catch (err: any) {
    assert(false, 'Health endpoint reachable', err.message);
  }

  // Test: $ARC token scan (requires auth — use test routes or skip)
  const testEndpoints = [
    `${API_BASE}/test/deployer/${ARC_TOKEN}`,
    `${API_BASE}/deployer/${ARC_TOKEN}`,
  ];

  let arcResult: any = null;
  for (const url of testEndpoints) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        arcResult = await res.json();
        console.log(`  (using ${url.includes('test') ? 'test' : 'public'} endpoint)`);
        break;
      }
    } catch {
      // try next
    }
  }

  if (arcResult) {
    assert(arcResult.verdict === 'CLEAN', '$ARC verdict = CLEAN', `got ${arcResult.verdict}`);
    assert(arcResult.deployer?.reputation_score >= 60, '$ARC score >= 60', `got ${arcResult.deployer?.reputation_score}`);
    assert(arcResult.deployer?.wallet !== undefined, '$ARC has deployer wallet');
    assert(arcResult.token?.symbol !== undefined, '$ARC has token symbol');
    assert(arcResult.confidence !== undefined, '$ARC has confidence block');
    assert(arcResult.evidence !== undefined, '$ARC has evidence block');
    assert(arcResult.deployer?.death_rate !== undefined, '$ARC has death_rate field');
  } else {
    console.log('  ⚠ Skipping $ARC live test (auth required, no test routes)');
  }

  // Test: BONK token scan
  let bonkResult: any = null;
  for (const base of [`${API_BASE}/test/deployer/${BONK_TOKEN}`, `${API_BASE}/deployer/${BONK_TOKEN}`]) {
    try {
      const res = await fetch(base);
      if (res.ok) {
        bonkResult = await res.json();
        break;
      }
    } catch {
      // try next
    }
  }

  if (bonkResult) {
    assert(bonkResult.verdict === 'CLEAN', 'BONK verdict = CLEAN', `got ${bonkResult.verdict}`);
    assert(bonkResult.deployer?.reputation_score >= 60, 'BONK score >= 60', `got ${bonkResult.deployer?.reputation_score}`);
  } else {
    console.log('  ⚠ Skipping BONK live test (auth required, no test routes)');
  }
}

// ─── Run ─────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   Daybreak Scoring Validation Suite    ║');
  console.log('╚═══════════════════════════════════════╝');

  testScoringUnit();
  await testLiveAPI();

  console.log('\n───────────────────────────────────────');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('───────────────────────────────────────\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
