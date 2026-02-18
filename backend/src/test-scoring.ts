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

// ─── Unit Tests: calculateReputation() ───────────────────────────────

function testScoringUnit() {
  console.log('\n═══ Unit Tests: calculateReputation() ═══\n');

  // Test 1: Perfect deployer — 1 alive token, no rug, no cluster
  {
    const r = calculateReputation({
      rugRate: 0.0,
      tokenCount: 1,
      avgLifespanDays: 60,
      clusterSize: 0,
    });
    assert(r.verdict === 'CLEAN', 'Perfect deployer → CLEAN', `got ${r.verdict}`);
    assert(r.score >= 85, 'Perfect deployer score >= 85', `got ${r.score}`);
  }

  // Test 2: Serial rugger — many dead tokens, high rug rate
  {
    const r = calculateReputation({
      rugRate: 0.9,
      tokenCount: 50,
      avgLifespanDays: 1,
      clusterSize: 5,
    });
    assert(r.verdict === 'SERIAL_RUGGER', 'Serial rugger → SERIAL_RUGGER', `got ${r.verdict}`);
    assert(r.score < 30, 'Serial rugger score < 30', `got ${r.score}`);
  }

  // Test 3 (Bug 1 fix): Single dead token should NOT be SERIAL_RUGGER
  {
    const r = calculateReputation({
      rugRate: 1.0,
      tokenCount: 1,
      avgLifespanDays: 0,
      clusterSize: 0,
    });
    assert(
      r.verdict !== 'SERIAL_RUGGER',
      'Single dead token ≠ SERIAL_RUGGER (Bug 1 fix)',
      `got ${r.verdict}, score=${r.score}`
    );
    assert(
      r.verdict === 'SUSPICIOUS' || r.verdict === 'CLEAN',
      'Single dead token → SUSPICIOUS or CLEAN',
      `got ${r.verdict}`
    );
  }

  // Test 4: Two dead tokens — still below threshold (needs >= 3)
  {
    const r = calculateReputation({
      rugRate: 1.0,
      tokenCount: 2,
      avgLifespanDays: 0,
      clusterSize: 0,
    });
    assert(
      r.verdict !== 'SERIAL_RUGGER',
      '2 dead tokens ≠ SERIAL_RUGGER (Bug 1 fix)',
      `got ${r.verdict}, score=${r.score}`
    );
  }

  // Test 5: Three dead tokens — now eligible for SERIAL_RUGGER via rugRate override
  {
    const r = calculateReputation({
      rugRate: 1.0,
      tokenCount: 3,
      avgLifespanDays: 0,
      clusterSize: 0,
    });
    assert(
      r.verdict === 'SERIAL_RUGGER',
      '3 dead tokens + 100% rug → SERIAL_RUGGER',
      `got ${r.verdict}, score=${r.score}`
    );
  }

  // Test 6: Score math spot-check
  {
    // rugRate=0.5, tokenCount=10, avgLifespan=20, clusterSize=3
    // rugComponent = (1 - 0.5) * 40 = 20
    // baseTokenPenalty = max(0, 20 * (1 - log10(10)/3)) = 20 * (1 - 1/3) = 13.33
    // lostPoints = 20 - 13.33 = 6.67
    // rugScaleFactor = min(1, 0.5/0.5) = 1.0
    // tokenPenalty = 20 - 6.67 * 1.0 = 13.33
    // lifespanScore = min(20, 20 * 0.5) = 10
    // clusterPenalty = max(0, 20 - min(20, 3*2)) = max(0, 20 - 6) = 14
    // total = round(20 + 13.33 + 10 + 14) = round(57.33) = 57
    const r = calculateReputation({
      rugRate: 0.5,
      tokenCount: 10,
      avgLifespanDays: 20,
      clusterSize: 3,
    });
    assert(r.score === 57, 'Score math spot-check = 57', `got ${r.score}`);
    assert(r.verdict === 'SUSPICIOUS', 'Score 57 → SUSPICIOUS', `got ${r.verdict}`);
  }

  // Test 7: Risk penalties deduct correctly
  {
    const base = calculateReputation({
      rugRate: 0.0,
      tokenCount: 1,
      avgLifespanDays: 60,
      clusterSize: 0,
    });
    const withRisks = calculateReputation({
      rugRate: 0.0,
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
      },
    });
    const expectedDiff = 25;
    const actualDiff = base.score - withRisks.score;
    assert(actualDiff === expectedDiff, `Risk penalties total -25 (got -${actualDiff})`);
  }

  // Test 8: Cluster size penalty works
  {
    const noCluster = calculateReputation({
      rugRate: 0.0,
      tokenCount: 1,
      avgLifespanDays: 30,
      clusterSize: 0,
    });
    const bigCluster = calculateReputation({
      rugRate: 0.0,
      tokenCount: 1,
      avgLifespanDays: 30,
      clusterSize: 10,
    });
    assert(noCluster.score > bigCluster.score, 'Big cluster lowers score', `no=${noCluster.score} big=${bigCluster.score}`);
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
  // We try test routes first, then unauthenticated, then skip
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
    assert(arcResult.deployer?.reputation_score >= 85, '$ARC score >= 85', `got ${arcResult.deployer?.reputation_score}`);
    assert(arcResult.deployer?.wallet !== undefined, '$ARC has deployer wallet');
    assert(arcResult.token?.symbol !== undefined, '$ARC has token symbol');
    assert(arcResult.confidence !== undefined, '$ARC has confidence block');
    assert(arcResult.evidence !== undefined, '$ARC has evidence block');
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
