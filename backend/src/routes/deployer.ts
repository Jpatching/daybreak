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
  getWalletSolBalance,
} from '../services/helius';
import { bulkCheckTokens, checkTokenStatus } from '../services/dexscreener';
import { getTokenPrice } from '../services/jupiter';
import { getTokenReport } from '../services/rugcheck';
import { classifyDeaths } from '../services/death-classifier';
import { calculateReputation, type RiskPenalties } from '../services/reputation';
import { TTLCache } from '../services/cache';
import {
  logScan,
  getCachedDeployerTokens,
  upsertDeployerTokens,
  getStaleAliveTokens,
  saveReportCard,
  upsertWalletAppearance,
  getNetworkStats,
  incrementGuestUsage,
} from '../services/db';
import { incrementUsage, getUsageCount, SCANS_LIMIT } from '../services/auth';
import { renderTwitterCard } from '../services/reportcard';
import fs from 'fs';
import pathModule from 'path';
import type {
  DeployerScan, DeployerToken, FundingInfo, TokenRisks,
  TokenMarketData, RugCheckResult,
  ScanEvidence, ScanConfidence, ScanUsage,
} from '../types';

const router = Router();
const scanCache = new TTLCache<DeployerScan>(1800); // 30 min TTL

router.get('/:token_address', async (req: Request, res: Response) => {
  const token_address = req.params.token_address as string;

  if (!isValidSolanaAddress(token_address)) {
    res.status(400).json({ error: 'Invalid Solana address' });
    return;
  }

  // Check cache
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

    // Step 2: Find deployer wallet
    const deployerResult = await findDeployer(token_address);
    if (!deployerResult) {
      res.status(404).json({ error: 'Could not find deployer for this token' });
      return;
    }
    const { wallet: deployerWallet, creationSig, method: deployerMethod } = deployerResult;

    // Step 3: Find all tokens this deployer created (paginated to 5000)
    // Check deployer cache first
    const cachedTokens = getCachedDeployerTokens(deployerWallet) || [];
    let deployerTokenMints: string[];
    let limitReached = false;
    let usedCache = false;

    if (cachedTokens.length > 0) {
      // Have cached data — check if alive tokens need re-checking
      const staleAlive = getStaleAliveTokens(deployerWallet, 6);
      deployerTokenMints = cachedTokens.map(t => t.token_address);
      usedCache = true;

      if (staleAlive.length > 0) {
        // Only re-check stale alive tokens via DexScreener
        const freshStatuses = await bulkCheckTokens(staleAlive);
        const cacheUpdates: Array<{ address: string; name?: string; symbol?: string; created_at?: string | null; alive: number; liquidity: number }> = [];
        for (const addr of staleAlive) {
          const status = freshStatuses.get(addr);
          if (status) {
            cacheUpdates.push({
              address: addr,
              name: status.name || undefined,
              symbol: status.symbol || undefined,
              created_at: status.pairCreatedAt,
              alive: status.alive ? 1 : 0,
              liquidity: status.liquidity || 0,
            });
          }
        }
        if (cacheUpdates.length > 0) {
          upsertDeployerTokens(deployerWallet, cacheUpdates);
        }
      }
    } else {
      // No cache — full discovery
      const result = await findDeployerTokens(deployerWallet);
      deployerTokenMints = result.tokens;
      limitReached = result.limitReached;
    }

    // Safety net: include the scanned token if not already found
    if (deployerWallet !== token_address && !deployerTokenMints.includes(token_address)) {
      deployerTokenMints.unshift(token_address);
    }

    // Step 4: Bulk check alive/dead status via DexScreener
    // If using cache and no stale tokens, build statuses from cache
    let tokenStatuses: Map<string, import('../services/dexscreener').TokenStatus>;
    if (usedCache) {
      // Build from cache + any fresh data
      tokenStatuses = new Map();
      const refreshedCache = getCachedDeployerTokens(deployerWallet);
      const needDexCheck: string[] = [];

      for (const ct of refreshedCache) {
        if (ct.alive === -1) {
          // Unverified — skip (handled separately)
          continue;
        }
        tokenStatuses.set(ct.token_address, {
          alive: ct.alive === 1,
          liquidity: ct.liquidity || 0,
          volume24h: 0,
          priceUsd: null,
          priceChange24h: null,
          fdv: null,
          marketCap: null,
          name: ct.token_name || '',
          symbol: ct.token_symbol || '',
          pairCreatedAt: ct.created_at,
          socials: null,
        });
      }

      // Also check mints not in cache yet
      for (const mint of deployerTokenMints) {
        if (!tokenStatuses.has(mint) && !refreshedCache.some(c => c.token_address === mint)) {
          needDexCheck.push(mint);
        }
      }

      if (needDexCheck.length > 0) {
        const freshStatuses = await bulkCheckTokens(needDexCheck);
        for (const [addr, status] of freshStatuses) {
          tokenStatuses.set(addr, status);
        }
      }
    } else {
      tokenStatuses = await bulkCheckTokens(deployerTokenMints);
    }

    // Always fetch fresh DexScreener data for the scanned token specifically
    try {
      const freshScannedStatus = await checkTokenStatus(token_address);
      if (freshScannedStatus.pairCreatedAt !== null) {
        tokenStatuses.set(token_address, freshScannedStatus);
      }
    } catch { /* best-effort */ }

    // Step 5: Build token list
    const tokens: DeployerToken[] = [];
    let deadCount = 0;
    let totalLifespanDays = 0;
    let tokensWithLifespan = 0;
    let unknownCount = 0;

    const verifiedMints = deployerTokenMints.filter(mint => tokenStatuses.has(mint));
    const unverifiedMints = deployerTokenMints.filter(mint => !tokenStatuses.has(mint));
    unknownCount = unverifiedMints.length;

    // Fetch metadata in batches of 5
    const allMetadata: Array<{ mint: string; name: string; symbol: string }> = [];
    for (let i = 0; i < verifiedMints.length; i += 5) {
      const batch = verifiedMints.slice(i, i + 5);
      const batchResults = await Promise.all(batch.map(async (mint) => {
        if (mint === token_address) return { mint, ...tokenMeta };
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

    // Append unverified tokens (limited to first 50) with alive: null
    if (unverifiedMints.length > 0) {
      const unverifiedBatch = unverifiedMints.slice(0, 50);
      const unverifiedMeta = await Promise.all(
        unverifiedBatch.map(async (mint) => {
          try {
            const meta = await getTokenMetadata(mint);
            return { mint, name: meta.name, symbol: meta.symbol };
          } catch {
            return { mint, name: 'Unknown', symbol: '???' };
          }
        })
      );
      for (const { mint, name, symbol } of unverifiedMeta) {
        tokens.push({
          address: mint,
          name: sanitizeString(name),
          symbol: sanitizeString(symbol),
          alive: null,
          liquidity: 0,
          price_usd: null,
          price_change_24h: null,
          volume_24h: null,
          fdv: null,
          created_at: null,
          dexscreener_url: `https://dexscreener.com/solana/${mint}`,
          death_type: 'unverified',
          death_evidence: null,
        });
      }
    }

    const totalTokens = deployerTokenMints.length;
    const verifiedCount = verifiedMints.length;

    // Death rate: only count verified tokens (don't lump unverified as dead)
    const deathRate = verifiedCount > 0 ? deadCount / verifiedCount : 0;
    // Legacy rug rate (includes unverified as dead) — keep for backward compat
    const adjustedDead = deadCount + unknownCount;
    const rugRate = totalTokens > 0 ? adjustedDead / totalTokens : 0;

    const avgLifespan = tokensWithLifespan > 0 ? totalLifespanDays / tokensWithLifespan : 0;

    // Deploy velocity: use totalTokens (including unverified) / time span
    // If we only have dates for a subset, extrapolate using total count
    let deployVelocity: number | null = null;
    const creationDates = tokens
      .map(t => t.created_at)
      .filter((d): d is string => d !== null)
      .sort();
    if (creationDates.length >= 2) {
      const daySpan = (new Date(creationDates[creationDates.length - 1]).getTime() - new Date(creationDates[0]).getTime()) / 86400000;
      // Use totalTokens (not just dated ones) for more accurate velocity
      deployVelocity = Math.round((totalTokens / Math.max(1, daySpan)) * 100) / 100;
    } else if (totalTokens >= 2) {
      deployVelocity = totalTokens; // All deployed at roughly same time
    }

    // Step 6: Parallel fetch — funding, deployer SOL balance, Jupiter price, RugCheck
    const [fundingResult, deployerSolBalance, jupiterPrice, rugcheckReport] = await Promise.all([
      findFundingSource(deployerWallet),
      getWalletSolBalance(deployerWallet).catch(() => null),
      getTokenPrice(token_address).catch(() => null),
      getTokenReport(token_address).catch(() => null),
    ]);

    const fundingSourceWallet = fundingResult?.wallet || null;
    const fundingTimestamp = fundingResult?.timestamp || null;

    // Burner wallet detection: funded <60s before first deploy
    let deployerIsBurner = false;
    if (fundingTimestamp && creationDates.length > 0) {
      const fundedAt = new Date(fundingTimestamp).getTime();
      const firstDeploy = new Date(creationDates[0]).getTime();
      const gapSeconds = (firstDeploy - fundedAt) / 1000;
      if (gapSeconds >= 0 && gapSeconds < 60) {
        deployerIsBurner = true;
      }
    }

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

    // Step 7: Cluster analysis
    let clusterChecked = false;
    if (fundingSourceWallet) {
      try {
        const cluster = await analyzeCluster(fundingSourceWallet, deployerWallet);
        funding.other_deployers_funded = cluster.deployerCount;
        funding.cluster_total_tokens = totalTokens;
        funding.cluster_total_dead = deadCount;
        funding.from_cex = cluster.fromCex;
        funding.cex_name = cluster.cexName;
        clusterChecked = true;
      } catch {
        // best-effort
      }
    }

    // Step 7.5: Token risk checks
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
          lp_locked: rugcheckReport?.lp_locked ?? null,
          lp_lock_pct: rugcheckReport?.lp_lock_pct ?? null,
        };

        riskPenalties = {
          mintAuthorityActive: mintInfo.mintAuthority !== null,
          freezeAuthorityActive: mintInfo.freezeAuthority !== null,
          topHolderPct: topHolders?.topHolderPct ?? null,
          bundleDetected: bundled === true,
          deployerHoldingsPct: deployerHoldings,
          deployVelocity,
          deployerIsBurner,
        };

        tokenRisksChecked = true;
      }
    } catch {
      // best-effort
    }

    // Step 7.6: Death classification (best-effort)
    try {
      const deadTokensForClassification = tokens
        .filter(t => t.alive === false)
        .map(t => ({ address: t.address, liquidity: t.liquidity, created_at: t.created_at }));

      if (deadTokensForClassification.length > 0) {
        const classifications = await classifyDeaths(
          deployerWallet,
          deadTokensForClassification,
          fundingSourceWallet,
        );

        for (const t of tokens) {
          const classification = classifications.get(t.address);
          if (classification) {
            t.death_type = classification.type;
            t.death_evidence = classification.evidence;
          }
        }
      }
    } catch (err) {
      console.error('[death-classifier] Classification failed:', err instanceof Error ? err.message : err);
    }

    // Compute confirmed rug counts from classification
    const confirmedRugs = tokens.filter(t =>
      t.death_type === 'likely_rug' || t.death_type === 'distributed_rug'
    ).length;
    const naturalDeaths = tokens.filter(t => t.death_type === 'natural').length;

    // Step 7.7: Record wallet appearances for network detection (best-effort)
    try {
      for (const t of tokens) {
        if (t.death_evidence?.initial_transfer_to && !t.death_evidence.initial_transfer_is_dex) {
          upsertWalletAppearance(
            t.death_evidence.initial_transfer_to,
            t.address,
            deployerWallet,
            t.death_evidence.deployer_holdings_pct,
          );
        }
      }

      // Compute network risk
      const networkStats = getNetworkStats(deployerWallet);
      funding.network_wallets = networkStats.network_wallets;
      funding.network_tokens_affected = networkStats.network_tokens_affected;
      funding.network_risk = networkStats.network_wallets >= 4 ? 'high'
        : networkStats.network_wallets >= 1 ? 'medium'
        : 'low';
    } catch {
      // best-effort
    }

    // Step 8: Calculate reputation score (Bayesian)
    const { score, verdict, verdict_reason, breakdown } = calculateReputation({
      deathRate,
      rugRate,
      tokenCount: totalTokens,
      verifiedCount,
      avgLifespanDays: avgLifespan,
      clusterSize: funding.other_deployers_funded,
      riskPenalties,
    });

    // Cache deployer tokens in SQLite
    if (!usedCache && tokens.length > 0) {
      const cacheEntries = tokens.map(t => ({
        address: t.address,
        name: t.name,
        symbol: t.symbol,
        created_at: t.created_at,
        alive: t.alive === null ? -1 : t.alive ? 1 : 0,
        liquidity: t.liquidity,
      }));
      // Also cache unverified tokens
      for (const mint of unverifiedMints) {
        cacheEntries.push({
          address: mint,
          name: undefined as any,
          symbol: undefined as any,
          created_at: null,
          alive: -1,
          liquidity: 0,
        });
      }
      upsertDeployerTokens(deployerWallet, cacheEntries);
    }

    // Deployer first/last seen
    let firstSeen: string | null = null;
    let lastSeen: string | null = null;
    try {
      const deployerSigs = await getSignaturesForAddress(deployerWallet, 1);
      if (deployerSigs.length > 0 && deployerSigs[0].blockTime) {
        lastSeen = new Date(deployerSigs[0].blockTime * 1000).toISOString();
      }
      firstSeen = tokens.reduce((oldest, t) => {
        if (!t.created_at) return oldest;
        if (!oldest) return t.created_at;
        return t.created_at < oldest ? t.created_at : oldest;
      }, null as string | null);
    } catch { /* best-effort */ }

    // Build market data from DexScreener + Jupiter
    const scannedTokenStatus = tokenStatuses.get(token_address);
    const marketData: TokenMarketData | null = scannedTokenStatus ? {
      price_usd: jupiterPrice ?? scannedTokenStatus.priceUsd ?? null,
      price_change_24h: scannedTokenStatus.priceChange24h ?? null,
      volume_24h: scannedTokenStatus.volume24h || null,
      fdv: scannedTokenStatus.fdv ?? null,
      market_cap: scannedTokenStatus.marketCap ?? null,
      socials: scannedTokenStatus.socials ?? null,
    } : null;

    const rugcheck: RugCheckResult | null = rugcheckReport;

    const evidence: ScanEvidence = {
      deployer_url: `https://solscan.io/account/${deployerWallet}`,
      funding_source_url: fundingSourceWallet ? `https://solscan.io/account/${fundingSourceWallet}` : null,
      creation_tx_url: creationSig ? `https://solscan.io/tx/${creationSig}` : null,
    };

    const confidence: ScanConfidence = {
      tokens_verified: verifiedCount,
      tokens_unverified: unknownCount,
      deployer_method: deployerMethod,
      cluster_checked: clusterChecked,
      token_risks_checked: tokenRisksChecked,
      tokens_may_be_incomplete: limitReached,
    };

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
        sol_balance: deployerSolBalance,
        tokens_created: totalTokens,
        tokens_dead: deadCount,
        tokens_unverified: unknownCount,
        tokens_assumed_dead: unknownCount,
        rug_rate: Math.round(rugRate * 1000) / 1000,
        death_rate: Math.round(deathRate * 1000) / 1000,
        reputation_score: score,
        deploy_velocity: deployVelocity,
        deployer_is_burner: deployerIsBurner,
        first_seen: firstSeen,
        last_seen: lastSeen,
        tokens,
      },
      funding,
      verdict,
      verdict_reason,
      score_breakdown: breakdown,
      token_risks: tokenRisks,
      market_data: marketData,
      rugcheck,
      evidence,
      confidence,
      usage,
      scanned_at: new Date().toISOString(),
    };

    // Increment usage AFTER successful scan (not in middleware)
    if (req.wallet?.startsWith('guest:')) {
      const ip = req.wallet.replace('guest:', '');
      incrementGuestUsage(ip);
    } else if (req.wallet && !req.headers['x-bot-key'] && !req.headers['x-payment']) {
      incrementUsage(req.wallet);
      req.scansUsed = getUsageCount(req.wallet);
      req.scansRemaining = SCANS_LIMIT - req.scansUsed;
      result.usage = {
        scans_used: req.scansUsed,
        scans_limit: req.scansLimit || SCANS_LIMIT,
        scans_remaining: req.scansRemaining,
      };
    }

    scanCache.set(token_address, result);

    const scanSource = req.wallet?.startsWith('guest:') ? 'guest'
      : req.headers['x-bot-key'] ? 'bot'
      : req.headers['x-payment'] ? 'x402'
      : 'auth';
    logScan(token_address, verdict, score, scanSource, req.wallet || null);

    // Fire-and-forget: generate twitter report card for OG image sharing
    (async () => {
      try {
        const cardDir = pathModule.resolve(__dirname, '../../data/cards', token_address);
        if (!fs.existsSync(cardDir)) fs.mkdirSync(cardDir, { recursive: true });
        const cardPath = pathModule.join(cardDir, 'twitter.png');
        const pngBuffer = await renderTwitterCard(result);
        fs.writeFileSync(cardPath, pngBuffer);
        saveReportCard(token_address, 'twitter', cardPath, verdict, score);
      } catch (err) {
        console.error('[report-card] Auto-generation failed:', err instanceof Error ? err.message : err);
      }
    })();

    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Scan error:', message);
    if (message.includes('Helius API')) {
      res.status(503).json({ error: 'Upstream API temporarily unavailable. Please try again later.', code: 'UPSTREAM_ERROR' });
    } else {
      res.status(500).json({ error: 'Scan failed. Please try again later.', code: 'SCAN_ERROR' });
    }
  }
});

export default router;
