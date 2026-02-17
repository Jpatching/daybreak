import { Router, Request, Response } from 'express';
import { isValidSolanaAddress } from '../utils/validate';
import { sanitizeString } from '../utils/sanitize';
import {
  findDeployerTokens,
  getTokenMetadata,
  findFundingSource,
  getSignaturesForAddress,
  analyzeCluster,
} from '../services/helius';
import { bulkCheckTokens } from '../services/dexscreener';
import { calculateReputation } from '../services/reputation';
import { TTLCache } from '../services/cache';
import type { DeployerScan, DeployerToken, FundingInfo, ScanEvidence, ScanConfidence, ScanUsage } from '../types';

const router = Router();
const walletCache = new TTLCache<DeployerScan>(1800); // 30 min TTL

router.get('/:wallet_address', async (req: Request, res: Response) => {
  const wallet_address = req.params.wallet_address as string;

  if (!isValidSolanaAddress(wallet_address)) {
    res.status(400).json({ error: 'Invalid Solana address' });
    return;
  }

  // Check cache — clone to avoid mutating shared object, attach fresh usage info
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
    // Skip token→deployer lookup — go straight to wallet scan
    const deployerTokenMints = await findDeployerTokens(wallet_address);
    const tokenStatuses = await bulkCheckTokens(deployerTokenMints);

    // Build token list — drop unknown tokens entirely
    const tokens: DeployerToken[] = [];
    let deadCount = 0;
    let totalLifespanDays = 0;
    let tokensWithLifespan = 0;

    const verifiedMints = deployerTokenMints.filter(mint => tokenStatuses.has(mint));
    const unknownCount = deployerTokenMints.length - verifiedMints.length;

    // Fetch metadata for verified tokens
    const metadataPromises = verifiedMints.map(async (mint) => {
      const status = tokenStatuses.get(mint);
      if (status?.name && status.name !== 'Unknown') return { mint, name: status.name, symbol: status.symbol || '???' };
      const onChain = await getTokenMetadata(mint);
      return { mint, ...onChain };
    });
    const allMetadata = await Promise.all(metadataPromises);
    const metaMap = new Map(allMetadata.map(m => [m.mint, { name: m.name, symbol: m.symbol }]));

    for (const mint of verifiedMints) {
      const status = tokenStatuses.get(mint)!;
      const meta = metaMap.get(mint) || { name: 'Unknown', symbol: '???' };
      const isAlive = status.alive || false;

      if (!isAlive) deadCount++;

      // Count lifespan for ALL tokens with known creation date
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
        created_at: status.pairCreatedAt || null,
        dexscreener_url: `https://dexscreener.com/solana/${mint}`,
      });
    }

    const totalTokens = deployerTokenMints.length;
    const verifiedCount = verifiedMints.length;
    // Rug rate based ONLY on verified tokens
    const rugRate = verifiedCount > 0 ? deadCount / verifiedCount : 0;
    const avgLifespan = tokensWithLifespan > 0 ? totalLifespanDays / tokensWithLifespan : 0;

    // Funding trace + cluster analysis
    const fundingSource = await findFundingSource(wallet_address);
    let funding: FundingInfo = {
      source_wallet: fundingSource,
      other_deployers_funded: 0,
      cluster_total_tokens: totalTokens,
      cluster_total_dead: deadCount,
    };

    let clusterChecked = false;
    if (fundingSource) {
      try {
        const cluster = await analyzeCluster(fundingSource, wallet_address);
        funding.other_deployers_funded = cluster.deployerCount;
        funding.cluster_total_tokens = totalTokens;
        funding.cluster_total_dead = deadCount;
        clusterChecked = true;
      } catch {
        // Cluster analysis is best-effort
      }
    }

    const { score, verdict } = calculateReputation({
      rugRate,
      tokenCount: totalTokens,
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

    // Build evidence links
    const evidence: ScanEvidence = {
      deployer_url: `https://solscan.io/account/${wallet_address}`,
      funding_source_url: fundingSource ? `https://solscan.io/account/${fundingSource}` : null,
      creation_tx_url: null, // wallet scan has no single creation tx
    };

    // Build confidence flags
    const confidence: ScanConfidence = {
      tokens_verified: verifiedCount,
      tokens_unverified: unknownCount,
      deployer_method: 'enhanced_api', // wallet scans always use enhanced API via findDeployerTokens
      cluster_checked: clusterChecked,
      token_risks_checked: false, // wallet scans have no single target token
    };

    // Build usage info
    const usage: ScanUsage = {
      scans_used: req.scansUsed || 0,
      scans_limit: req.scansLimit || 3,
      scans_remaining: req.scansRemaining || 0,
    };

    const result: DeployerScan = {
      token: { address: wallet_address, name: 'Wallet Scan', symbol: 'N/A' },
      deployer: {
        wallet: wallet_address,
        tokens_created: totalTokens,
        tokens_dead: deadCount,
        tokens_unverified: unknownCount,
        rug_rate: Math.round(rugRate * 1000) / 1000,
        reputation_score: score,
        first_seen: firstSeen,
        last_seen: lastSeen,
        tokens,
      },
      funding,
      verdict,
      token_risks: null,
      evidence,
      confidence,
      usage,
      scanned_at: new Date().toISOString(),
    };

    walletCache.set(wallet_address, result);
    res.json(result);
  } catch (err: any) {
    console.error('Wallet scan error:', err.message);
    res.status(500).json({ error: 'Wallet scan failed. Please try again later.' });
  }
});

export default router;
