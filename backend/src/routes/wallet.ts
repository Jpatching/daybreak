import { Router, Request, Response } from 'express';
import { isValidSolanaAddress } from '../utils/validate';
import { sanitizeString } from '../utils/sanitize';
import {
  findDeployerTokens,
  getTokenMetadata,
  findFundingSource,
  getSignaturesForAddress,
  analyzeCluster,
  getWalletSolBalance,
} from '../services/helius';
import { bulkCheckTokens } from '../services/dexscreener';
import { calculateReputation } from '../services/reputation';
import { TTLCache } from '../services/cache';
import { logScan } from '../services/db';
import type { DeployerScan, DeployerToken, FundingInfo, ScanEvidence, ScanConfidence, ScanUsage } from '../types';

const router = Router();
const walletCache = new TTLCache<DeployerScan>(1800); // 30 min TTL

router.get('/:wallet_address', async (req: Request, res: Response) => {
  const wallet_address = req.params.wallet_address as string;

  if (!isValidSolanaAddress(wallet_address)) {
    res.status(400).json({ error: 'Invalid Solana address' });
    return;
  }

  // Check cache
  const cached = walletCache.get(wallet_address);
  if (cached) {
    res.json({
      ...cached,
      usage: {
        scans_used: req.scansUsed || 0,
        scans_limit: req.scansLimit || 3,
        scans_remaining: req.scansRemaining || 0,
      },
    });
    return;
  }

  try {
    // Parallel: find tokens + get SOL balance
    const [tokenResult, walletSolBalance] = await Promise.all([
      findDeployerTokens(wallet_address),
      getWalletSolBalance(wallet_address).catch(() => null),
    ]);

    const deployerTokenMints = tokenResult.tokens;
    const tokenStatuses = await bulkCheckTokens(deployerTokenMints);

    const tokens: DeployerToken[] = [];
    let deadCount = 0;
    let totalLifespanDays = 0;
    let tokensWithLifespan = 0;

    const verifiedMints = deployerTokenMints.filter(mint => tokenStatuses.has(mint));
    const unknownCount = deployerTokenMints.length - verifiedMints.length;

    // Fetch metadata in batches
    const allMetadata: Array<{ mint: string; name: string; symbol: string }> = [];
    for (let i = 0; i < verifiedMints.length; i += 5) {
      const batch = verifiedMints.slice(i, i + 5);
      const batchResults = await Promise.all(batch.map(async (mint) => {
        const status = tokenStatuses.get(mint);
        if (status?.name && status.name !== 'Unknown') return { mint, name: status.name, symbol: status.symbol || '???' };
        const onChain = await getTokenMetadata(mint);
        return { mint, ...onChain };
      }));
      allMetadata.push(...batchResults);
    }
    const metaMap = new Map(allMetadata.map(m => [m.mint, { name: m.name, symbol: m.symbol }]));

    for (const mint of verifiedMints) {
      const status = tokenStatuses.get(mint)!;
      const meta = metaMap.get(mint) || { name: 'Unknown', symbol: '???' };
      const isAlive = status.alive || false;

      if (!isAlive) deadCount++;

      if (status.pairCreatedAt) {
        const created = new Date(status.pairCreatedAt).getTime();
        const days = (Date.now() - created) / (1000 * 60 * 60 * 24);
        totalLifespanDays += days;
        tokensWithLifespan++;
      }

      tokens.push({
        address: mint,
        name: sanitizeString(meta.name),
        symbol: sanitizeString(meta.symbol),
        alive: isAlive,
        liquidity: status.liquidity || 0,
        price_usd: status.priceUsd ?? null,
        price_change_24h: status.priceChange24h ?? null,
        volume_24h: status.volume24h || null,
        fdv: status.fdv ?? null,
        created_at: status.pairCreatedAt || null,
        dexscreener_url: `https://dexscreener.com/solana/${mint}`,
        death_type: null,
        death_evidence: null,
      });
    }

    const totalTokens = deployerTokenMints.length;
    const verifiedCount = verifiedMints.length;
    const deathRate = verifiedCount > 0 ? deadCount / verifiedCount : 0;
    const adjustedDead = deadCount + unknownCount;
    const rugRate = totalTokens > 0 ? adjustedDead / totalTokens : 0;
    const avgLifespan = tokensWithLifespan > 0 ? totalLifespanDays / tokensWithLifespan : 0;

    // Funding trace + cluster analysis
    const fundingResult = await findFundingSource(wallet_address);
    const fundingSourceWallet = fundingResult?.wallet || null;

    let funding: FundingInfo = {
      source_wallet: fundingSourceWallet,
      other_deployers_funded: 0,
      cluster_total_tokens: totalTokens,
      cluster_total_dead: adjustedDead,
      from_cex: false,
      cex_name: null,
      network_wallets: 0,
      network_tokens_affected: 0,
      network_risk: null,
    };

    let clusterChecked = false;
    if (fundingSourceWallet) {
      try {
        const cluster = await analyzeCluster(fundingSourceWallet, wallet_address);
        funding.other_deployers_funded = cluster.deployerCount;
        funding.cluster_total_tokens = totalTokens;
        funding.cluster_total_dead = deadCount;
        funding.from_cex = cluster.fromCex;
        funding.cex_name = cluster.cexName;
        clusterChecked = true;
      } catch { /* best-effort */ }
    }

    const { score, verdict, verdict_reason, breakdown } = calculateReputation({
      deathRate,
      rugRate,
      tokenCount: totalTokens,
      verifiedCount,
      avgLifespanDays: avgLifespan,
      clusterSize: funding.other_deployers_funded,
    });

    let firstSeen: string | null = null;
    let lastSeen: string | null = null;
    try {
      const sigs = await getSignaturesForAddress(wallet_address, 1);
      if (sigs.length > 0 && sigs[0].blockTime) {
        lastSeen = new Date(sigs[0].blockTime * 1000).toISOString();
      }
      firstSeen = tokens.reduce((oldest, t) => {
        if (!t.created_at) return oldest;
        if (!oldest) return t.created_at;
        return t.created_at < oldest ? t.created_at : oldest;
      }, null as string | null);
    } catch { /* best-effort */ }

    const evidence: ScanEvidence = {
      deployer_url: `https://solscan.io/account/${wallet_address}`,
      funding_source_url: fundingSourceWallet ? `https://solscan.io/account/${fundingSourceWallet}` : null,
      creation_tx_url: null,
    };

    const confidence: ScanConfidence = {
      tokens_verified: verifiedCount,
      tokens_unverified: unknownCount,
      deployer_method: 'enhanced_api',
      cluster_checked: clusterChecked,
      token_risks_checked: false,
      tokens_may_be_incomplete: tokenResult.limitReached,
    };

    const usage: ScanUsage = {
      scans_used: req.scansUsed || 0,
      scans_limit: req.scansLimit || 3,
      scans_remaining: req.scansRemaining || 0,
    };

    const result: DeployerScan = {
      token: { address: wallet_address, name: 'Wallet Scan', symbol: 'N/A' },
      deployer: {
        wallet: wallet_address,
        sol_balance: walletSolBalance,
        tokens_created: totalTokens,
        tokens_dead: deadCount,
        tokens_unverified: unknownCount,
        tokens_assumed_dead: unknownCount,
        rug_rate: Math.round(rugRate * 1000) / 1000,
        death_rate: Math.round(deathRate * 1000) / 1000,
        reputation_score: score,
        deploy_velocity: null,
        deployer_is_burner: false,
        first_seen: firstSeen,
        last_seen: lastSeen,
        tokens,
      },
      funding,
      verdict,
      verdict_reason,
      score_breakdown: breakdown,
      token_risks: null,
      market_data: null,
      rugcheck: null,
      evidence,
      confidence,
      usage,
      scanned_at: new Date().toISOString(),
    };

    walletCache.set(wallet_address, result);

    const scanSource = req.wallet?.startsWith('guest:') ? 'guest'
      : req.headers['x-bot-key'] ? 'bot'
      : req.headers['x-payment'] ? 'x402'
      : 'auth';
    logScan(wallet_address, verdict, score, scanSource, req.wallet || null);

    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Wallet scan error:', message);
    if (message.includes('Helius API')) {
      res.status(503).json({ error: 'Upstream API temporarily unavailable. Please try again later.', code: 'UPSTREAM_ERROR' });
    } else {
      res.status(500).json({ error: 'Wallet scan failed. Please try again later.', code: 'SCAN_ERROR' });
    }
  }
});

export default router;
