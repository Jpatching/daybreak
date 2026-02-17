import { Router, Request, Response } from 'express';
import { isValidSolanaAddress } from '../utils/validate';
import { sanitizeString } from '../utils/sanitize';
import {
  findDeployerTokens,
  findFundingSource,
  getSignaturesForAddress,
} from '../services/helius';
import { bulkCheckTokens } from '../services/dexscreener';
import { calculateReputation } from '../services/reputation';
import { TTLCache } from '../services/cache';
import type { DeployerScan, DeployerToken, FundingInfo } from '../types';

const router = Router();
const walletCache = new TTLCache<DeployerScan>(300);

router.get('/:wallet_address', async (req: Request, res: Response) => {
  const wallet_address = req.params.wallet_address as string;

  if (!isValidSolanaAddress(wallet_address)) {
    res.status(400).json({ error: 'Invalid Solana address' });
    return;
  }

  const cached = walletCache.get(wallet_address);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    // Skip token→deployer lookup — go straight to wallet scan
    const deployerTokenMints = await findDeployerTokens(wallet_address);
    const tokenStatuses = await bulkCheckTokens(deployerTokenMints);

    const tokens: DeployerToken[] = [];
    let deadCount = 0;
    let totalLifespanDays = 0;
    let tokensWithLifespan = 0;

    for (const mint of deployerTokenMints) {
      const status = tokenStatuses.get(mint);
      const isAlive = status?.alive || false;
      if (!isAlive) deadCount++;

      if (status?.pairCreatedAt) {
        const created = new Date(status.pairCreatedAt).getTime();
        const days = (Date.now() - created) / (1000 * 60 * 60 * 24);
        totalLifespanDays += days;
        tokensWithLifespan++;
      }

      tokens.push({
        address: mint,
        name: sanitizeString(status?.name || 'Unknown'),
        symbol: sanitizeString(status?.symbol || '???'),
        alive: isAlive,
        liquidity: status?.liquidity || 0,
        created_at: status?.pairCreatedAt || null,
      });
    }

    const totalTokens = deployerTokenMints.length;
    const rugRate = totalTokens > 0 ? deadCount / totalTokens : 0;
    const avgLifespan = tokensWithLifespan > 0 ? totalLifespanDays / tokensWithLifespan : 0;

    const fundingSource = await findFundingSource(wallet_address);
    const funding: FundingInfo = {
      source_wallet: fundingSource,
      other_deployers_funded: 0,
      cluster_total_tokens: totalTokens,
      cluster_total_dead: deadCount,
    };

    const { score, verdict } = calculateReputation({
      rugRate,
      tokenCount: totalTokens,
      avgLifespanDays: avgLifespan,
      clusterSize: 0,
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

    const result: DeployerScan = {
      token: { address: wallet_address, name: 'Wallet Scan', symbol: 'N/A' },
      deployer: {
        wallet: wallet_address,
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

    walletCache.set(wallet_address, result);
    res.json(result);
  } catch (err: any) {
    console.error('Wallet scan error:', err.message);
    res.status(500).json({ error: 'Wallet scan failed. Please try again later.' });
  }
});

export default router;
