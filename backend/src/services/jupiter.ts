import { TTLCache } from './cache';

const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';

// Cache prices for 5 minutes (prices change frequently)
const priceCache = new TTLCache<JupiterPrice>(300);

interface JupiterPrice {
  price: number;
  extraInfo?: {
    confidenceLevel?: string;
  };
}

/**
 * Get real-time USD price for a single token via Jupiter Price API v2.
 * Free tier: 60 req/min, no API key needed.
 */
export async function getTokenPrice(mint: string): Promise<number | null> {
  const cached = priceCache.get(mint);
  if (cached) return cached.price;

  try {
    const res = await fetch(`${JUPITER_PRICE_API}?ids=${mint}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data: any = await res.json();
    const tokenData = data?.data?.[mint];
    if (!tokenData?.price) return null;

    const price = parseFloat(tokenData.price);
    priceCache.set(mint, { price });
    return price;
  } catch {
    return null;
  }
}

/**
 * Batch get prices for multiple tokens (max 100 per call).
 * Returns a map of mint -> USD price.
 */
export async function getTokenPrices(mints: string[]): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  if (mints.length === 0) return results;

  // Check cache first
  const uncached: string[] = [];
  for (const mint of mints) {
    const cached = priceCache.get(mint);
    if (cached) {
      results.set(mint, cached.price);
    } else {
      uncached.push(mint);
    }
  }

  if (uncached.length === 0) return results;

  // Jupiter allows up to 100 IDs per request
  const batchSize = 100;
  for (let i = 0; i < uncached.length; i += batchSize) {
    const batch = uncached.slice(i, i + batchSize);
    const ids = batch.join(',');

    try {
      const res = await fetch(`${JUPITER_PRICE_API}?ids=${ids}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const data: any = await res.json();
      const tokenMap = data?.data || {};

      for (const mint of batch) {
        const tokenData = tokenMap[mint];
        if (tokenData?.price) {
          const price = parseFloat(tokenData.price);
          results.set(mint, price);
          priceCache.set(mint, { price });
        }
      }
    } catch {
      // Best-effort — skip failed batches
    }

    // Small delay between batches to respect 60 req/min
    if (i + batchSize < uncached.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return results;
}
