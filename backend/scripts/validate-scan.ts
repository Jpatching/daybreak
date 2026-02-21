#!/usr/bin/env npx ts-node
/**
 * validate-scan.ts — Manual data validation CLI tool
 *
 * Usage:
 *   npx ts-node backend/scripts/validate-scan.ts <token_address>
 *
 * Calls DexScreener directly and cross-checks alive/dead status
 * against the $100 liquidity threshold. Validates score math.
 */

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';
const ALIVE_LIQUIDITY_THRESHOLD = 100;

interface ValidationResult {
  token: string;
  dexScreenerAlive: boolean;
  liquidity: number;
  volume24h: number;
  pairCount: number;
  discrepancies: string[];
}

async function validateToken(address: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    token: address,
    dexScreenerAlive: false,
    liquidity: 0,
    volume24h: 0,
    pairCount: 0,
    discrepancies: [],
  };

  try {
    const res = await fetch(`${DEXSCREENER_API}/tokens/${address}`);
    if (!res.ok) {
      result.discrepancies.push(`DexScreener returned HTTP ${res.status}`);
      return result;
    }

    const data: any = await res.json();
    const pairs = data.pairs || [];
    result.pairCount = pairs.length;

    if (pairs.length === 0) {
      console.log(`  No DexScreener pairs found — token should be unverified or dead`);
      return result;
    }

    result.liquidity = pairs.reduce((sum: number, p: any) => sum + (p.liquidity?.usd || 0), 0);
    result.volume24h = pairs.reduce((sum: number, p: any) => sum + (p.volume?.h24 || 0), 0);

    const hasLiquidity = result.liquidity >= ALIVE_LIQUIDITY_THRESHOLD;
    const hasVolume = result.volume24h > 0;
    result.dexScreenerAlive = hasLiquidity || hasVolume;

    // Check for common data issues
    if (result.liquidity > 0 && result.liquidity < ALIVE_LIQUIDITY_THRESHOLD && !hasVolume) {
      result.discrepancies.push(
        `Token has $${result.liquidity.toFixed(2)} liquidity (below $${ALIVE_LIQUIDITY_THRESHOLD} threshold) — should be DEAD`
      );
    }

    if (result.liquidity === 0 && result.volume24h === 0 && pairs.length > 0) {
      result.discrepancies.push(
        `Token has ${pairs.length} DexScreener pairs but $0 liquidity and $0 volume — should be DEAD`
      );
    }

    // Check for price without liquidity (suspicious)
    const bestPair = pairs[0];
    if (bestPair.priceUsd && parseFloat(bestPair.priceUsd) > 0 && result.liquidity === 0) {
      result.discrepancies.push(
        `Token has price ($${bestPair.priceUsd}) but $0 liquidity — price is unreliable`
      );
    }

  } catch (err: any) {
    result.discrepancies.push(`DexScreener fetch failed: ${err.message}`);
  }

  return result;
}

async function validateScanResponse(apiBase: string, address: string) {
  console.log(`\nFetching scan from API: ${apiBase}/api/v1/guest/deployer/${address}`);

  try {
    const res = await fetch(`${apiBase}/api/v1/guest/deployer/${address}`);
    if (!res.ok) {
      console.log(`  API returned HTTP ${res.status}: ${res.statusText}`);
      const body = await res.text();
      console.log(`  Body: ${body.slice(0, 200)}`);
      return;
    }

    const scan: any = await res.json();

    console.log(`\n=== SCAN RESULT ===`);
    console.log(`Token: ${scan.token?.name} (${scan.token?.symbol})`);
    console.log(`Deployer: ${scan.deployer?.wallet}`);
    console.log(`Score: ${scan.deployer?.reputation_score}/100`);
    console.log(`Verdict: ${scan.verdict}`);
    console.log(`Death Rate: ${((scan.deployer?.death_rate ?? 0) * 100).toFixed(1)}%`);
    console.log(`Tokens: ${scan.deployer?.tokens_created} total, ${scan.deployer?.tokens_dead} dead, ${scan.deployer?.tokens_unverified} unverified`);

    // Validate score breakdown math
    if (scan.score_breakdown) {
      const b = scan.score_breakdown;
      const componentSum = b.rug_rate_component + b.token_count_component + b.lifespan_component + b.cluster_component;
      const expectedScore = Math.round(Math.max(0, Math.min(100, componentSum + b.risk_deductions)));
      console.log(`\n=== SCORE VALIDATION ===`);
      console.log(`Components: ${b.rug_rate_component.toFixed(1)} + ${b.token_count_component.toFixed(1)} + ${b.lifespan_component.toFixed(1)} + ${b.cluster_component.toFixed(1)} = ${componentSum.toFixed(1)}`);
      console.log(`Risk deductions: ${b.risk_deductions}`);
      console.log(`Expected score: ${expectedScore}, Actual score: ${scan.deployer?.reputation_score}`);
      if (expectedScore !== scan.deployer?.reputation_score) {
        console.log(`  ⚠ SCORE MISMATCH`);
      } else {
        console.log(`  ✓ Score math checks out`);
      }
    }

    // Cross-check tokens against DexScreener
    const tokens = scan.deployer?.tokens || [];
    const aliveTokens = tokens.filter((t: any) => t.alive === true);
    console.log(`\n=== ALIVE TOKEN CROSS-CHECK (${aliveTokens.length} alive tokens) ===`);

    let discrepancyCount = 0;
    const checkLimit = Math.min(aliveTokens.length, 10); // Check first 10

    for (let i = 0; i < checkLimit; i++) {
      const t = aliveTokens[i];
      const validation = await validateToken(t.address);

      if (!validation.dexScreenerAlive && t.alive) {
        console.log(`  ✗ ${t.name || t.address.slice(0, 8)} — marked Alive but DexScreener says Dead (liq: $${validation.liquidity.toFixed(2)}, vol: $${validation.volume24h.toFixed(2)})`);
        discrepancyCount++;
      } else {
        console.log(`  ✓ ${t.name || t.address.slice(0, 8)} — correctly ${t.alive ? 'Alive' : 'Dead'} (liq: $${validation.liquidity.toFixed(2)})`);
      }

      // Rate limit: DexScreener allows 300/min but be nice
      await new Promise(r => setTimeout(r, 250));
    }

    if (aliveTokens.length > checkLimit) {
      console.log(`  ... (${aliveTokens.length - checkLimit} more alive tokens not checked)`);
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Discrepancies found: ${discrepancyCount}/${checkLimit}`);
    if (discrepancyCount === 0) {
      console.log(`✓ All checked tokens have accurate alive/dead status`);
    } else {
      console.log(`⚠ ${discrepancyCount} token(s) have incorrect alive/dead status`);
    }

  } catch (err: any) {
    console.log(`  API fetch failed: ${err.message}`);
  }
}

async function main() {
  const address = process.argv[2];
  if (!address) {
    console.log('Usage: npx ts-node backend/scripts/validate-scan.ts <token_address>');
    console.log('       npx ts-node backend/scripts/validate-scan.ts <token_address> [api_base_url]');
    process.exit(1);
  }

  const apiBase = process.argv[3] || 'https://api.daybreakscan.com';

  console.log(`=== DaybreakScan Data Validation ===`);
  console.log(`Token: ${address}`);
  console.log(`API: ${apiBase}`);

  // Direct DexScreener check for the scanned token
  console.log(`\n--- Direct DexScreener check ---`);
  const directCheck = await validateToken(address);
  console.log(`  Pairs: ${directCheck.pairCount}`);
  console.log(`  Liquidity: $${directCheck.liquidity.toFixed(2)}`);
  console.log(`  Volume 24h: $${directCheck.volume24h.toFixed(2)}`);
  console.log(`  Should be: ${directCheck.dexScreenerAlive ? 'ALIVE' : 'DEAD'}`);
  if (directCheck.discrepancies.length > 0) {
    for (const d of directCheck.discrepancies) {
      console.log(`  ⚠ ${d}`);
    }
  }

  // Full scan validation
  await validateScanResponse(apiBase, address);
}

main().catch(console.error);
