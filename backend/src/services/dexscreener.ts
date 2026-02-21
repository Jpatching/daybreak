import type { DexScreenerPair, TokenSocials } from '../types';
import { TTLCache } from './cache';

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';
const ALIVE_LIQUIDITY_THRESHOLD = 100; // USD

// Cache token status for 2 hours to reduce DexScreener API calls
const dexCache = new TTLCache<TokenStatus>(7200);

export interface TokenStatus {
  alive: boolean;
  liquidity: number;
  volume24h: number;
  priceUsd: number | null;
  priceChange24h: number | null;
  fdv: number | null;
  marketCap: number | null;
  name: string;
  symbol: string;
  pairCreatedAt: string | null;
  socials: TokenSocials | null;
}

function extractSocials(pair: DexScreenerPair): TokenSocials | null {
  const info = pair.info;
  if (!info) return null;

  let website: string | null = null;
  let twitter: string | null = null;
  let telegram: string | null = null;

  if (info.websites && info.websites.length > 0) {
    website = info.websites[0].url || null;
  }

  if (info.socials) {
    for (const s of info.socials) {
      if (s.type === 'twitter' && s.url) twitter = s.url;
      if (s.type === 'telegram' && s.url) telegram = s.url;
    }
  }

  if (!website && !twitter && !telegram) return null;
  return { website, twitter, telegram };
}

function parsePairs(pairs: DexScreenerPair[]): {
  totalLiquidity: number;
  totalVolume24h: number;
  priceUsd: number | null;
  priceChange24h: number | null;
  fdv: number | null;
  marketCap: number | null;
  name: string;
  symbol: string;
  pairCreatedAt: string | null;
  socials: TokenSocials | null;
  isAlive: boolean;
} {
  if (pairs.length === 0) {
    return {
      totalLiquidity: 0, totalVolume24h: 0, priceUsd: null, priceChange24h: null,
      fdv: null, marketCap: null, name: '', symbol: '', pairCreatedAt: null,
      socials: null, isAlive: false,
    };
  }

  const totalLiquidity = pairs.reduce((sum, p) => sum + (p.liquidity?.usd || 0), 0);
  const totalVolume24h = pairs.reduce((sum, p) => sum + (p.volume?.h24 || 0), 0);
  const bestPair = pairs[0];

  const priceUsd = bestPair.priceUsd ? parseFloat(bestPair.priceUsd) : null;
  const priceChange24h = bestPair.priceChange?.h24 ?? null;
  const fdv = bestPair.fdv ?? null;
  const marketCap = bestPair.marketCap ?? null;
  const socials = extractSocials(bestPair);

  const hasLiquidity = totalLiquidity >= ALIVE_LIQUIDITY_THRESHOLD;
  const hasVolume = totalVolume24h > 0;
  const isAlive = hasLiquidity || hasVolume;

  return {
    totalLiquidity, totalVolume24h, priceUsd, priceChange24h,
    fdv, marketCap,
    name: bestPair.baseToken?.name || '',
    symbol: bestPair.baseToken?.symbol || '',
    pairCreatedAt: bestPair.pairCreatedAt
      ? new Date(bestPair.pairCreatedAt).toISOString()
      : null,
    socials,
    isAlive,
  };
}

/** Check if a single token is alive or dead based on liquidity */
export async function checkTokenStatus(mintAddress: string): Promise<TokenStatus> {
  try {
    const res = await fetch(`${DEXSCREENER_API}/tokens/${mintAddress}`);
    if (!res.ok) return deadStatus();

    const data: any = await res.json();
    const pairs: DexScreenerPair[] = data.pairs || [];

    if (pairs.length === 0) return deadStatus();

    const parsed = parsePairs(pairs);
    return {
      alive: parsed.isAlive,
      liquidity: parsed.totalLiquidity,
      volume24h: parsed.totalVolume24h,
      priceUsd: parsed.priceUsd,
      priceChange24h: parsed.priceChange24h,
      fdv: parsed.fdv,
      marketCap: parsed.marketCap,
      name: parsed.name,
      symbol: parsed.symbol,
      pairCreatedAt: parsed.pairCreatedAt,
      socials: parsed.socials,
    };
  } catch {
    return deadStatus();
  }
}

function deadStatus(): TokenStatus {
  return {
    alive: false, liquidity: 0, volume24h: 0,
    priceUsd: null, priceChange24h: null, fdv: null, marketCap: null,
    name: '', symbol: '', pairCreatedAt: null, socials: null,
  };
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

  // Split into batches and fetch all in parallel (DexScreener allows 300 req/min)
  const batches: string[][] = [];
  for (let i = 0; i < uncached.length; i += batchSize) {
    batches.push(uncached.slice(i, i + batchSize));
  }

  const batchResults = await Promise.all(
    batches.map(async (batch) => {
      const joined = batch.join(',');
      try {
        const res = await fetch(`${DEXSCREENER_API}/tokens/${joined}`);
        if (!res.ok) {
          return { batch, pairs: [] as DexScreenerPair[] };
        }
        const data: any = await res.json();
        return { batch, pairs: (data.pairs || []) as DexScreenerPair[] };
      } catch {
        return { batch, pairs: [] as DexScreenerPair[] };
      }
    })
  );

  for (const { batch, pairs } of batchResults) {
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
        // No DexScreener data — mark as unverified (NOT dead)
        // Don't add to results so deployer route can track as unverified
        continue;
      }

      const parsed = parsePairs(tokenPairs);
      const status: TokenStatus = {
        alive: parsed.isAlive,
        liquidity: parsed.totalLiquidity,
        volume24h: parsed.totalVolume24h,
        priceUsd: parsed.priceUsd,
        priceChange24h: parsed.priceChange24h,
        fdv: parsed.fdv,
        marketCap: parsed.marketCap,
        name: parsed.name,
        symbol: parsed.symbol,
        pairCreatedAt: parsed.pairCreatedAt,
        socials: parsed.socials,
      };
      results.set(addr, status);
      dexCache.set(addr, status);
    }
  }

  return results;
}
