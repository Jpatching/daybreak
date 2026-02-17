import type { DexScreenerPair } from '../types';
import { TTLCache } from './cache';

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';
const ALIVE_LIQUIDITY_THRESHOLD = 100; // USD

// Cache token status for 1 hour to avoid redundant DexScreener calls
const dexCache = new TTLCache<TokenStatus>(3600);

interface TokenStatus {
  alive: boolean;
  liquidity: number;
  volume24h: number;
  name: string;
  symbol: string;
  pairCreatedAt: string | null;
}

/** Check if a single token is alive or dead based on liquidity */
export async function checkTokenStatus(mintAddress: string): Promise<TokenStatus> {
  try {
    const res = await fetch(`${DEXSCREENER_API}/tokens/${mintAddress}`);
    if (!res.ok) return { alive: false, liquidity: 0, volume24h: 0, name: '', symbol: '', pairCreatedAt: null };

    const data: any = await res.json();
    const pairs: DexScreenerPair[] = data.pairs || [];

    if (pairs.length === 0) {
      return { alive: false, liquidity: 0, volume24h: 0, name: '', symbol: '', pairCreatedAt: null };
    }

    const totalLiquidity = pairs.reduce((sum, p) => sum + (p.liquidity?.usd || 0), 0);
    const totalVolume24h = pairs.reduce((sum, p) => sum + (p.volume?.h24 || 0), 0);
    const bestPair = pairs[0];

    // A token is alive if it has meaningful liquidity AND recent activity
    const ageHours = bestPair.pairCreatedAt
      ? (Date.now() - bestPair.pairCreatedAt) / (1000 * 60 * 60)
      : Infinity;
    const isAlive = totalLiquidity >= ALIVE_LIQUIDITY_THRESHOLD &&
      (totalVolume24h > 0 || ageHours < 24);

    return {
      alive: isAlive,
      liquidity: totalLiquidity,
      volume24h: totalVolume24h,
      name: bestPair.baseToken?.name || '',
      symbol: bestPair.baseToken?.symbol || '',
      pairCreatedAt: bestPair.pairCreatedAt
        ? new Date(bestPair.pairCreatedAt).toISOString()
        : null,
    };
  } catch {
    return { alive: false, liquidity: 0, volume24h: 0, name: '', symbol: '', pairCreatedAt: null };
  }
}

/** Bulk check multiple tokens — DexScreener allows comma-separated addresses (max 30) */
export async function bulkCheckTokens(
  mintAddresses: string[]
): Promise<Map<string, TokenStatus>> {
  const results = new Map<string, TokenStatus>();

  // Check cache first, collect uncached mints
  const uncached: string[] = [];
  for (const addr of mintAddresses) {
    const cached = dexCache.get(addr);
    if (cached) {
      results.set(addr, cached);
    } else {
      uncached.push(addr);
    }
  }

  const batchSize = 30;

  for (let i = 0; i < uncached.length; i += batchSize) {
    const batch = uncached.slice(i, i + batchSize);
    const joined = batch.join(',');

    try {
      const res = await fetch(`${DEXSCREENER_API}/tokens/${joined}`);
      if (!res.ok) {
        batch.forEach(addr => results.set(addr, { alive: false, liquidity: 0, volume24h: 0, name: '', symbol: '', pairCreatedAt: null }));
        continue;
      }

      const data: any = await res.json();
      const pairs: DexScreenerPair[] = data.pairs || [];

      // Group pairs by token address
      const pairsByToken = new Map<string, DexScreenerPair[]>();
      for (const pair of pairs) {
        const addr = pair.baseToken?.address;
        if (!addr) continue;
        if (!pairsByToken.has(addr)) pairsByToken.set(addr, []);
        pairsByToken.get(addr)!.push(pair);
      }

      for (const addr of batch) {
        const tokenPairs = pairsByToken.get(addr) || [];
        if (tokenPairs.length === 0) {
          const dead = { alive: false, liquidity: 0, volume24h: 0, name: '', symbol: '', pairCreatedAt: null };
          results.set(addr, dead);
          dexCache.set(addr, dead);
          continue;
        }
        const totalLiquidity = tokenPairs.reduce((sum, p) => sum + (p.liquidity?.usd || 0), 0);
        const totalVolume24h = tokenPairs.reduce((sum, p) => sum + (p.volume?.h24 || 0), 0);
        const bestPair = tokenPairs[0];

        const ageHours = bestPair.pairCreatedAt
          ? (Date.now() - bestPair.pairCreatedAt) / (1000 * 60 * 60)
          : Infinity;
        const isAlive = totalLiquidity >= ALIVE_LIQUIDITY_THRESHOLD &&
          (totalVolume24h > 0 || ageHours < 24);

        const status = {
          alive: isAlive,
          liquidity: totalLiquidity,
          volume24h: totalVolume24h,
          name: bestPair.baseToken?.name || '',
          symbol: bestPair.baseToken?.symbol || '',
          pairCreatedAt: bestPair.pairCreatedAt
            ? new Date(bestPair.pairCreatedAt).toISOString()
            : null,
        };
        results.set(addr, status);
        dexCache.set(addr, status);
      }
    } catch {
      batch.forEach(addr => {
        const dead = { alive: false, liquidity: 0, volume24h: 0, name: '', symbol: '', pairCreatedAt: null };
        results.set(addr, dead);
        dexCache.set(addr, dead);
      });
    }

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < uncached.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return results;
}
