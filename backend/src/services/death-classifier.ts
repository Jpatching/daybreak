import type { DeathType, DeathEvidence } from '../types';
import {
  getEnhancedTransactions,
  checkDeployerHoldings,
  checkMintAuthority,
  findFundingSource,
  DEX_PROGRAM_IDS,
} from './helius';

interface DeadTokenInput {
  address: string;
  liquidity: number;
  created_at: string | null;
}

interface ClassificationResult {
  type: DeathType;
  evidence: DeathEvidence;
}

/**
 * Classify dead tokens as natural_death, likely_rug, distributed_rug, or unverified.
 * Rate-limited: only classifies tokens that had liquidity, capped at 20 per scan.
 */
export async function classifyDeaths(
  deployerWallet: string,
  deadTokens: DeadTokenInput[],
  fundingSourceWallet: string | null,
): Promise<Map<string, ClassificationResult>> {
  const results = new Map<string, ClassificationResult>();

  // Only classify tokens that had a DexScreener pair (liquidity > 0 or created_at set)
  const classifiable = deadTokens
    .filter(t => t.liquidity > 0 || t.created_at !== null)
    .sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0))
    .slice(0, 20); // Cap at 20 to control API costs

  // Tokens with no DexScreener data at all → natural (never got traction)
  for (const t of deadTokens) {
    if (!classifiable.some(c => c.address === t.address)) {
      results.set(t.address, {
        type: 'natural',
        evidence: {
          deployer_sold: false,
          deployer_holdings_pct: null,
          peak_liquidity: 0,
          lifespan_hours: null,
          had_real_buyers: false,
          initial_transfer_to: null,
          initial_transfer_is_dex: false,
          initial_transfer_is_associated: false,
        },
      });
    }
  }

  // Process classifiable tokens in parallel batches of 5
  for (let i = 0; i < classifiable.length; i += 5) {
    const batch = classifiable.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map(t => classifySingleToken(t, deployerWallet, fundingSourceWallet))
    );
    for (let j = 0; j < batch.length; j++) {
      results.set(batch[j].address, batchResults[j]);
    }
  }

  return results;
}

async function classifySingleToken(
  token: DeadTokenInput,
  deployerWallet: string,
  fundingSourceWallet: string | null,
): Promise<ClassificationResult> {
  const evidence: DeathEvidence = {
    deployer_sold: false,
    deployer_holdings_pct: null,
    peak_liquidity: token.liquidity,
    lifespan_hours: null,
    had_real_buyers: token.liquidity >= 500,
    initial_transfer_to: null,
    initial_transfer_is_dex: false,
    initial_transfer_is_associated: false,
  };

  // Calculate age (time from creation to now — not true lifespan since we don't know exact death time)
  if (token.created_at) {
    const created = new Date(token.created_at).getTime();
    evidence.lifespan_hours = Math.round((Date.now() - created) / (1000 * 60 * 60));
  }
  // Note: lifespan_hours is actually token age, not time-to-death.
  // True lifespan would require knowing when liquidity was removed.

  // Check deployer holdings for this token
  try {
    const mintInfo = await checkMintAuthority(token.address);
    if (mintInfo) {
      const holdings = await checkDeployerHoldings(
        deployerWallet, token.address, mintInfo.supply, mintInfo.decimals
      );
      if (holdings !== null) {
        evidence.deployer_holdings_pct = holdings;
        evidence.deployer_sold = holdings < 0.01; // effectively 0%
      }
    }
  } catch (err) {
    console.error('[death-classifier] Holdings check failed:', err instanceof Error ? err.message : err);
  }

  // Check initial token distribution (first transfer out from deployer)
  try {
    const txs = await getEnhancedTransactions(deployerWallet, {
      limit: 30,
      sortOrder: 'asc',
    });

    // Find token transfers for this specific mint within first few hours
    const createdTime = token.created_at ? new Date(token.created_at).getTime() / 1000 : 0;
    const cutoff = createdTime + (4 * 60 * 60); // first 4 hours

    for (const tx of txs) {
      if (tx.timestamp && tx.timestamp > cutoff) break;

      const transfers = tx.tokenTransfers || [];
      for (const t of transfers) {
        if (
          t.mint === token.address &&
          t.fromUserAccount === deployerWallet &&
          t.toUserAccount &&
          t.toUserAccount !== deployerWallet
        ) {
          evidence.initial_transfer_to = t.toUserAccount;

          // Check if destination is a DEX
          const accountKeys = tx.accountData?.map((a: any) => a.account) || [];
          const instructions = tx.instructions || [];
          const isDex = instructions.some((ix: any) => DEX_PROGRAM_IDS.has(ix.programId)) ||
                        accountKeys.some((k: string) => DEX_PROGRAM_IDS.has(k));
          evidence.initial_transfer_is_dex = isDex;

          // Check if destination shares same funding source
          if (!isDex && fundingSourceWallet) {
            try {
              const destFunding = await findFundingSource(t.toUserAccount);
              if (destFunding?.wallet === fundingSourceWallet) {
                evidence.initial_transfer_is_associated = true;
              }
            } catch {
              // best-effort
            }
          }
          break; // only care about first transfer out
        }
      }
      if (evidence.initial_transfer_to) break;
    }
  } catch (err) {
    console.error('[death-classifier] Distribution check failed:', err instanceof Error ? err.message : err);
  }

  // Classification rules (order matters — most specific first)

  // 1. Distributed rug: tokens sent to associated wallet + deployer sold
  if (evidence.initial_transfer_is_associated && evidence.deployer_sold) {
    return { type: 'distributed_rug', evidence };
  }

  // 2. Quick dump: deployer sold within 48h (catches low-liquidity pump.fun rugs)
  if (evidence.deployer_sold && evidence.lifespan_hours !== null && evidence.lifespan_hours < 48) {
    return { type: 'likely_rug', evidence };
  }

  // 3. Likely rug: had real buyers + deployer sold
  if (evidence.had_real_buyers && evidence.deployer_sold) {
    return { type: 'likely_rug', evidence };
  }

  // 4. Natural death: no real buyers and deployer still holds
  if (!evidence.had_real_buyers && (evidence.deployer_holdings_pct === null || evidence.deployer_holdings_pct > 0)) {
    return { type: 'natural', evidence };
  }

  // Can't determine confidently
  return { type: 'unverified', evidence };
}
