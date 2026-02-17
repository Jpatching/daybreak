import { Router, Request, Response } from 'express';
import { isValidSolanaAddress } from '../utils/validate';
import { sanitizeString } from '../utils/sanitize';
import {
  findDeployer,
  findDeployerTokens,
  getTokenMetadata,
  findFundingSource,
  getSignaturesForAddress,
  analyzeCluster,
} from '../services/helius';
import { bulkCheckTokens } from '../services/dexscreener';
import { calculateReputation } from '../services/reputation';
import { TTLCache } from '../services/cache';
import type { DeployerScan, DeployerToken, FundingInfo } from '../types';

const router = Router();
const scanCache = new TTLCache<DeployerScan>(300); // 5 min TTL

router.get('/:token_address', async (req: Request, res: Response) => {
  const token_address = req.params.token_address as string;

  if (!isValidSolanaAddress(token_address)) {
    res.status(400).json({ error: 'Invalid Solana address' });
    return;
  }

  // Check cache
  const cached = scanCache.get(token_address);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    // Step 1: Get token metadata
    const tokenMeta = await getTokenMetadata(token_address);

    // Step 2: Find deployer wallet
    const deployerWallet = await findDeployer(token_address);
    if (!deployerWallet) {
      res.status(404).json({ error: 'Could not find deployer for this token' });
      return;
    }

    // Step 3: Find all tokens this deployer created via Pump.fun
    const deployerTokenMints = await findDeployerTokens(deployerWallet);

    // Safety net: always include the scanned token if not already found
    if (!deployerTokenMints.includes(token_address)) {
      deployerTokenMints.unshift(token_address);
    }

    // Step 4: Bulk check alive/dead status via DexScreener
    const tokenStatuses = await bulkCheckTokens(deployerTokenMints);

    // Step 5: Build token list
    const tokens: DeployerToken[] = [];
    let deadCount = 0;
    let totalLifespanDays = 0;
    let tokensWithLifespan = 0;

    // Fetch metadata for tokens not found on DexScreener (via Helius DAS)
    const metadataPromises = deployerTokenMints.map(async (mint) => {
      if (mint === token_address) return { mint, ...tokenMeta };
      const status = tokenStatuses.get(mint);
      if (status?.name && status.name !== 'Unknown') return { mint, name: status.name, symbol: status.symbol || '???' };
      // Fallback to on-chain metadata
      const onChain = await getTokenMetadata(mint);
      return { mint, ...onChain };
    });
    const allMetadata = await Promise.all(metadataPromises);
    const metaMap = new Map(allMetadata.map(m => [m.mint, { name: m.name, symbol: m.symbol }]));

    for (const mint of deployerTokenMints) {
      const status = tokenStatuses.get(mint);
      const meta = metaMap.get(mint) || { name: 'Unknown', symbol: '???' };

      const isAlive = status?.alive || false;
      if (!isAlive) deadCount++;

      // Estimate lifespan from pair creation date
      if (status?.pairCreatedAt) {
        const created = new Date(status.pairCreatedAt).getTime();
        const now = Date.now();
        const days = (now - created) / (1000 * 60 * 60 * 24);
        totalLifespanDays += days;
        tokensWithLifespan++;
      }

      tokens.push({
        address: mint,
        name: sanitizeString(meta.name),
        symbol: sanitizeString(meta.symbol),
        alive: isAlive,
        liquidity: status?.liquidity || 0,
        created_at: status?.pairCreatedAt || null,
      });
    }

    const totalTokens = deployerTokenMints.length;
    const rugRate = totalTokens > 0 ? deadCount / totalTokens : 0;
    const avgLifespan = tokensWithLifespan > 0 ? totalLifespanDays / tokensWithLifespan : 0;

    // Step 6: Funding trace (1 hop)
    const fundingSource = await findFundingSource(deployerWallet);
    let funding: FundingInfo = {
      source_wallet: fundingSource,
      other_deployers_funded: 0,
      cluster_total_tokens: totalTokens,
      cluster_total_dead: deadCount,
    };

    // Step 7: Cluster analysis — parse funder's outgoing transfers,
    // find other wallets it funded, check if they're Pump.fun deployers
    if (fundingSource) {
      try {
        const cluster = await analyzeCluster(fundingSource, deployerWallet);
        funding.other_deployers_funded = cluster.deployerCount;
        // Cluster totals reflect only the scanned deployer's tokens
        funding.cluster_total_tokens = totalTokens;
        funding.cluster_total_dead = deadCount;
      } catch {
        // Cluster analysis is best-effort
      }
    }

    // Step 8: Calculate reputation score
    const { score, verdict } = calculateReputation({
      rugRate,
      tokenCount: totalTokens,
      avgLifespanDays: avgLifespan,
      clusterSize: funding.other_deployers_funded,
    });

    // Get deployer first/last seen from signatures
    let firstSeen: string | null = null;
    let lastSeen: string | null = null;
    try {
      const deployerSigs = await getSignaturesForAddress(deployerWallet, 1);
      if (deployerSigs.length > 0 && deployerSigs[0].blockTime) {
        lastSeen = new Date(deployerSigs[0].blockTime * 1000).toISOString();
      }
      // First seen approximation from oldest token creation
      const oldestToken = tokens.reduce((oldest, t) => {
        if (!t.created_at) return oldest;
        if (!oldest) return t.created_at;
        return t.created_at < oldest ? t.created_at : oldest;
      }, null as string | null);
      firstSeen = oldestToken;
    } catch {
      // best-effort
    }

    const result: DeployerScan = {
      token: {
        address: token_address,
        name: sanitizeString(tokenMeta.name),
        symbol: sanitizeString(tokenMeta.symbol),
      },
      deployer: {
        wallet: deployerWallet,
        tokens_created: totalTokens,
        tokens_dead: deadCount,
        rug_rate: Math.round(rugRate * 1000) / 1000,
        reputation_score: score,
        first_seen: firstSeen,
        last_seen: lastSeen,
        tokens,
      },
      funding,
      verdict,
      scanned_at: new Date().toISOString(),
    };

    scanCache.set(token_address, result);
    res.json(result);
  } catch (err: any) {
    console.error('Scan error:', err.message);
    if (err.message?.includes('Helius API')) {
      res.status(503).json({ error: 'Upstream API temporarily unavailable. Please try again later.' });
    } else {
      res.status(500).json({ error: 'Scan failed. Please try again later.' });
    }
  }
});

export default router;
