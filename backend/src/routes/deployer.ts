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
  checkMintAuthority,
  checkDeployerHoldings,
  checkTopHolders,
  checkBundledLaunch,
} from '../services/helius';
import { bulkCheckTokens } from '../services/dexscreener';
import { calculateReputation, type RiskPenalties } from '../services/reputation';
import { TTLCache } from '../services/cache';
import type { DeployerScan, DeployerToken, FundingInfo, TokenRisks, ScanEvidence, ScanConfidence, ScanUsage } from '../types';

const router = Router();
const scanCache = new TTLCache<DeployerScan>(1800); // 30 min TTL — saves Helius + DexScreener calls

router.get('/:token_address', async (req: Request, res: Response) => {
  const token_address = req.params.token_address as string;

  if (!isValidSolanaAddress(token_address)) {
    res.status(400).json({ error: 'Invalid Solana address' });
    return;
  }

  // Check cache — clone to avoid mutating shared object, attach fresh usage info
  const cached = scanCache.get(token_address);
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
    // Step 1: Get token metadata
    const tokenMeta = await getTokenMetadata(token_address);

    // Step 2: Find deployer wallet (now returns wallet + creationSig + method)
    const deployerResult = await findDeployer(token_address);
    if (!deployerResult) {
      res.status(404).json({ error: 'Could not find deployer for this token' });
      return;
    }
    const { wallet: deployerWallet, creationSig, method: deployerMethod } = deployerResult;

    // Step 3: Find all tokens this deployer created via Pump.fun
    const deployerTokenMints = await findDeployerTokens(deployerWallet);

    // Safety net: include the scanned token if not already found,
    // but only if the deployer is DIFFERENT from the token address.
    // (If they're the same, the user entered a wallet address, not a token.)
    if (deployerWallet !== token_address && !deployerTokenMints.includes(token_address)) {
      deployerTokenMints.unshift(token_address);
    }

    // Step 4: Bulk check alive/dead status via DexScreener
    const tokenStatuses = await bulkCheckTokens(deployerTokenMints);

    // Step 5: Build token list — drop unknown tokens entirely
    const tokens: DeployerToken[] = [];
    let deadCount = 0;
    let totalLifespanDays = 0;
    let tokensWithLifespan = 0;
    let unknownCount = 0;

    // Fetch metadata for verified tokens
    const verifiedMints = deployerTokenMints.filter(mint => tokenStatuses.has(mint));
    const unverifiedMints = deployerTokenMints.filter(mint => !tokenStatuses.has(mint));
    unknownCount = unverifiedMints.length;

    const metadataPromises = verifiedMints.map(async (mint) => {
      if (mint === token_address) return { mint, ...tokenMeta };
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

      // Only count lifespan for alive tokens
      if (isAlive && status.pairCreatedAt) {
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

    // Step 6: Funding trace (1 hop)
    const fundingSource = await findFundingSource(deployerWallet);
    let funding: FundingInfo = {
      source_wallet: fundingSource,
      other_deployers_funded: 0,
      cluster_total_tokens: totalTokens,
      cluster_total_dead: deadCount,
    };

    // Step 7: Cluster analysis
    let clusterChecked = false;
    if (fundingSource) {
      try {
        const cluster = await analyzeCluster(fundingSource, deployerWallet);
        funding.other_deployers_funded = cluster.deployerCount;
        funding.cluster_total_tokens = totalTokens;
        funding.cluster_total_dead = deadCount;
        clusterChecked = true;
      } catch {
        // Cluster analysis is best-effort
      }
    }

    // Step 7.5: Token risk checks (best-effort, all 4 signals)
    let tokenRisks: TokenRisks | null = null;
    let riskPenalties: RiskPenalties | undefined;
    let tokenRisksChecked = false;
    try {
      const mintInfo = await checkMintAuthority(token_address);
      if (mintInfo) {
        const [deployerHoldings, topHolders, bundled] = await Promise.all([
          checkDeployerHoldings(deployerWallet, token_address, mintInfo.supply, mintInfo.decimals).catch(() => null),
          checkTopHolders(token_address, mintInfo.supply).catch(() => null),
          checkBundledLaunch(token_address, creationSig).catch(() => null),
        ]);

        tokenRisks = {
          mint_authority: mintInfo.mintAuthority,
          freeze_authority: mintInfo.freezeAuthority,
          deployer_holdings_pct: deployerHoldings,
          top_holder_pct: topHolders?.topHolderPct ?? null,
          bundle_detected: bundled,
        };

        riskPenalties = {
          mintAuthorityActive: mintInfo.mintAuthority !== null,
          freezeAuthorityActive: mintInfo.freezeAuthority !== null,
          topHolderAbove80: (topHolders?.topHolderPct ?? 0) > 80,
          bundleDetected: bundled === true,
        };

        tokenRisksChecked = true;
      }
    } catch {
      // Risk checks are best-effort — scan proceeds with base score only
    }

    // Step 8: Calculate reputation score
    const { score, verdict } = calculateReputation({
      rugRate,
      tokenCount: totalTokens,
      avgLifespanDays: avgLifespan,
      clusterSize: funding.other_deployers_funded,
      riskPenalties,
    });

    // Get deployer first/last seen from signatures
    let firstSeen: string | null = null;
    let lastSeen: string | null = null;
    try {
      const deployerSigs = await getSignaturesForAddress(deployerWallet, 1);
      if (deployerSigs.length > 0 && deployerSigs[0].blockTime) {
        lastSeen = new Date(deployerSigs[0].blockTime * 1000).toISOString();
      }
      const oldestToken = tokens.reduce((oldest, t) => {
        if (!t.created_at) return oldest;
        if (!oldest) return t.created_at;
        return t.created_at < oldest ? t.created_at : oldest;
      }, null as string | null);
      firstSeen = oldestToken;
    } catch {
      // best-effort
    }

    // Build evidence links
    const evidence: ScanEvidence = {
      deployer_url: `https://solscan.io/account/${deployerWallet}`,
      funding_source_url: fundingSource ? `https://solscan.io/account/${fundingSource}` : null,
      creation_tx_url: creationSig ? `https://solscan.io/tx/${creationSig}` : null,
    };

    // Build confidence flags
    const confidence: ScanConfidence = {
      tokens_verified: verifiedCount,
      tokens_unverified: unknownCount,
      deployer_method: deployerMethod,
      cluster_checked: clusterChecked,
      token_risks_checked: tokenRisksChecked,
    };

    // Build usage info
    const usage: ScanUsage = {
      scans_used: req.scansUsed || 0,
      scans_limit: req.scansLimit || 3,
      scans_remaining: req.scansRemaining || 0,
    };

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
        tokens_unverified: unknownCount,
        rug_rate: Math.round(rugRate * 1000) / 1000,
        reputation_score: score,
        first_seen: firstSeen,
        last_seen: lastSeen,
        tokens,
      },
      funding,
      verdict,
      token_risks: tokenRisks,
      evidence,
      confidence,
      usage,
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
