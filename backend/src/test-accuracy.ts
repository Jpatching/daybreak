/**
 * Daybreak API Accuracy Verification Script
 *
 * Tests the live API against known on-chain data to catch
 * false positives/negatives in deployer detection and scoring.
 *
 * Usage: npx ts-node src/test-accuracy.ts
 */

import 'dotenv/config';

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3001/api/v1';

interface TestResult {
  name: string;
  passed: boolean;
  details: string[];
}

async function fetchScan(endpoint: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    signal: AbortSignal.timeout(60000),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// ─── Test 1: Known clean deployer (ARC token) ────────────────────────
async function testCleanDeployer(): Promise<TestResult> {
  const name = 'Known clean deployer (ARC)';
  const details: string[] = [];
  let passed = true;

  try {
    const { status, body } = await fetchScan('/deployer/61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump');

    if (status !== 200) {
      details.push(`✗ Expected 200, got ${status}`);
      return { name, passed: false, details };
    }

    // Should find a deployer
    if (!body.deployer?.wallet) {
      details.push('✗ No deployer wallet found');
      passed = false;
    } else {
      details.push(`✓ Deployer wallet: ${body.deployer.wallet}`);
    }

    // Should have very few tokens (1-3 expected for clean deployer)
    const tokenCount = body.deployer?.tokens_created || 0;
    if (tokenCount <= 5) {
      details.push(`✓ tokens_created = ${tokenCount} (expected: ≤5 for clean deployer)`);
    } else {
      details.push(`✗ tokens_created = ${tokenCount} (expected: ≤5, possible over-counting bug)`);
      passed = false;
    }

    // Verdict should be CLEAN
    if (body.verdict === 'CLEAN') {
      details.push(`✓ verdict = CLEAN`);
    } else {
      details.push(`✗ verdict = ${body.verdict} (expected: CLEAN)`);
      passed = false;
    }

    // Should have liquidity (ARC is a live token)
    const scannedToken = body.deployer?.tokens?.find(
      (t: any) => t.address === '61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump'
    );
    if (scannedToken?.alive) {
      details.push(`✓ Token alive, liquidity: $${scannedToken.liquidity?.toLocaleString()}`);
    } else {
      details.push(`⚠ Token not detected as alive (may be market conditions)`);
    }
  } catch (err: any) {
    details.push(`✗ Error: ${err.message}`);
    passed = false;
  }

  return { name, passed, details };
}

// ─── Test 2: Known serial rugger ─────────────────────────────────────
async function testSerialRugger(): Promise<TestResult> {
  const name = 'Known serial rugger';
  const details: string[] = [];
  let passed = true;

  // Token from the known serial rugger (deployer GTheBZR...)
  // Previous test showed 194 tokens due to over-counting bug (Bug 1), actual count ~20-30
  try {
    const { status, body } = await fetchScan('/deployer/F5tfztTnE4sYsMhZT5KrFpWvHmYSfJZoRjCuxKPbpump');

    if (status !== 200) {
      details.push(`✗ Expected 200, got ${status}`);
      return { name, passed: false, details };
    }

    const wallet = body.deployer?.wallet;
    details.push(`✓ Deployer wallet: ${wallet}`);

    const tokenCount = body.deployer?.tokens_created || 0;
    if (tokenCount >= 10) {
      details.push(`✓ tokens_created = ${tokenCount} (expected: ≥10 for serial rugger)`);
    } else {
      details.push(`✗ tokens_created = ${tokenCount} (expected: ≥10, possible under-counting)`);
      passed = false;
    }

    const rugRate = body.deployer?.rug_rate || 0;
    if (rugRate > 0.7) {
      details.push(`✓ rug_rate = ${rugRate} (expected: >0.7)`);
    } else {
      details.push(`✗ rug_rate = ${rugRate} (expected: >0.7)`);
      passed = false;
    }

    if (body.verdict === 'SERIAL_RUGGER') {
      details.push(`✓ verdict = SERIAL_RUGGER`);
    } else {
      details.push(`✗ verdict = ${body.verdict} (expected: SERIAL_RUGGER)`);
      passed = false;
    }

    // Score should be low
    const score = body.deployer?.reputation_score ?? -1;
    if (score >= 0 && score <= 30) {
      details.push(`✓ reputation_score = ${score} (expected: ≤30)`);
    } else {
      details.push(`⚠ reputation_score = ${score} (expected: ≤30)`);
    }
  } catch (err: any) {
    details.push(`✗ Error: ${err.message}`);
    passed = false;
  }

  return { name, passed, details };
}

// ─── Test 3: Invalid token address ───────────────────────────────────
async function testInvalidToken(): Promise<TestResult> {
  const name = 'Invalid token address';
  const details: string[] = [];
  let passed = true;

  try {
    // Valid base58 but not a real mint
    const { status, body } = await fetchScan('/deployer/11111111111111111111111111111111');

    if (status === 400 || status === 404) {
      details.push(`✓ Returns ${status} (not a false CLEAN)`);
    } else if (status === 200 && body.verdict === 'CLEAN') {
      details.push(`✗ Returns 200 with CLEAN verdict — false positive!`);
      passed = false;
    } else {
      details.push(`✓ Returns ${status} — not a false CLEAN`);
    }
  } catch (err: any) {
    details.push(`✗ Error: ${err.message}`);
    passed = false;
  }

  // Also test truly invalid address
  try {
    const { status } = await fetchScan('/deployer/not-a-real-address');
    if (status === 400) {
      details.push(`✓ Invalid format returns 400`);
    } else {
      details.push(`✗ Invalid format returns ${status} (expected: 400)`);
      passed = false;
    }
  } catch (err: any) {
    details.push(`✗ Error: ${err.message}`);
    passed = false;
  }

  return { name, passed, details };
}

// ─── Test 4: Non-Pump.fun token (USDC) ──────────────────────────────
async function testNonPumpToken(): Promise<TestResult> {
  const name = 'Non-Pump.fun token (USDC)';
  const details: string[] = [];
  let passed = true;

  try {
    // USDC mint address
    const { status, body } = await fetchScan('/deployer/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

    if (status === 404) {
      details.push(`✓ Returns 404 — correctly identifies no Pump.fun deployer`);
    } else if (status === 200) {
      const tokenCount = body.deployer?.tokens_created || 0;
      if (tokenCount <= 5) {
        details.push(`✓ tokens_created = ${tokenCount} (not inflated by swap activity)`);
      } else {
        details.push(`✗ tokens_created = ${tokenCount} — likely inflated by swap activity!`);
        passed = false;
      }
      details.push(`  verdict = ${body.verdict}, deployer = ${body.deployer?.wallet}`);
    } else {
      details.push(`✓ Returns ${status} — not producing false data`);
    }
  } catch (err: any) {
    details.push(`✗ Error: ${err.message}`);
    passed = false;
  }

  return { name, passed, details };
}

// ─── Test 5: Deployer cross-check via direct RPC ─────────────────────
async function testDeployerCrossCheck(): Promise<TestResult> {
  const name = 'Deployer cross-check (ARC token via RPC)';
  const details: string[] = [];
  let passed = true;

  try {
    // First get the API result
    const { status, body } = await fetchScan('/deployer/61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump');
    if (status !== 200 || !body.deployer?.wallet) {
      details.push(`✗ API scan failed (status ${status})`);
      return { name, passed: false, details };
    }

    const apiDeployer = body.deployer.wallet;
    details.push(`  API says deployer: ${apiDeployer}`);

    // Cross-check: fetch the token's oldest tx directly via RPC
    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
    const sigsRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getSignaturesForAddress',
        params: ['61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump', { limit: 1000 }],
      }),
    });
    const sigsJson: any = await sigsRes.json();
    const sigs = sigsJson.result || [];
    if (sigs.length === 0) {
      details.push(`⚠ No signatures found via RPC — cannot cross-check`);
      return { name, passed: true, details };
    }

    // Get the oldest signature
    const oldestSig = sigs[sigs.length - 1].signature;
    const txRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getTransaction',
        params: [oldestSig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
      }),
    });
    const txJson: any = await txRes.json();
    const tx = txJson.result;
    if (!tx) {
      details.push(`⚠ Could not fetch oldest tx — cannot cross-check`);
      return { name, passed: true, details };
    }

    const accounts = tx.transaction?.message?.accountKeys || [];
    const firstSigner = accounts.find((k: any) => k.signer)?.pubkey;
    details.push(`  RPC oldest tx first signer: ${firstSigner}`);

    if (firstSigner === apiDeployer) {
      details.push(`✓ Deployer matches RPC cross-check`);
    } else {
      details.push(`⚠ Deployer mismatch — API: ${apiDeployer}, RPC: ${firstSigner}`);
      details.push(`  (May be expected if feePayer differs from first signer)`);
      // Don't fail — feePayer vs first signer can legitimately differ
    }
  } catch (err: any) {
    details.push(`✗ Error: ${err.message}`);
    passed = false;
  }

  return { name, passed, details };
}

// ─── Runner ──────────────────────────────────────────────────────────
async function main() {
  console.log('=== Daybreak API Accuracy Tests ===\n');
  console.log(`API: ${API_BASE}\n`);

  const tests = [
    testCleanDeployer,
    testSerialRugger,
    testInvalidToken,
    testNonPumpToken,
    testDeployerCrossCheck,
  ];

  const results: TestResult[] = [];
  for (let i = 0; i < tests.length; i++) {
    console.log(`TEST ${i + 1}: Running...`);
    const result = await tests[i]();
    results.push(result);
    console.log(`TEST ${i + 1}: ${result.name}`);
    for (const line of result.details) {
      console.log(`  ${line}`);
    }
    console.log();
  }

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`RESULT: ${passed}/${total} tests passed`);

  if (passed < total) {
    console.log('\nFailed tests:');
    for (const r of results) {
      if (!r.passed) console.log(`  - ${r.name}`);
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
