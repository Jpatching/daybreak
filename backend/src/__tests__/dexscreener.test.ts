import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use unique addresses per test to avoid dexCache collisions (module-level singleton)
let addrCounter = 0;
function uniqueAddr() {
  addrCounter++;
  // Pad to look like a Solana address (doesn't need to be valid base58 for these tests)
  return `DexTest${addrCounter.toString().padStart(38, 'A')}`;
}

// Mock global fetch
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Import AFTER global fetch is stubbed
import { checkTokenStatus, bulkCheckTokens } from '../services/dexscreener';

function makePair(overrides: {
  address?: string;
  liquidity?: number;
  volume?: number;
  pairCreatedAt?: number;
  name?: string;
  symbol?: string;
} = {}) {
  return {
    chainId: 'solana',
    dexId: 'raydium',
    pairAddress: 'pair123',
    baseToken: {
      address: overrides.address || uniqueAddr(),
      name: overrides.name || 'Test Token',
      symbol: overrides.symbol || 'TEST',
    },
    liquidity: { usd: overrides.liquidity ?? 500 },
    volume: { h24: overrides.volume ?? 100 },
    pairCreatedAt: overrides.pairCreatedAt ?? Date.now() - 48 * 60 * 60 * 1000, // 48h ago by default
  };
}

describe('checkTokenStatus', () => {
  it('returns alive when liquidity >= $100', async () => {
    const addr = uniqueAddr();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pairs: [makePair({ address: addr, liquidity: 100, volume: 0 })] }),
    });
    const result = await checkTokenStatus(addr);
    expect(result.alive).toBe(true);
    expect(result.liquidity).toBe(100);
  });

  it('returns alive when volume > 0 (even with $0 liquidity)', async () => {
    const addr = uniqueAddr();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pairs: [makePair({ address: addr, liquidity: 0, volume: 50 })] }),
    });
    const result = await checkTokenStatus(addr);
    expect(result.alive).toBe(true);
  });

  it('returns alive when pair < 24h old (even with no liquidity/volume)', async () => {
    const addr = uniqueAddr();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pairs: [makePair({ address: addr, liquidity: 0, volume: 0, pairCreatedAt: oneHourAgo })] }),
    });
    const result = await checkTokenStatus(addr);
    expect(result.alive).toBe(true);
  });

  it('returns dead when liquidity < $100, no volume, and pair > 24h old', async () => {
    const addr = uniqueAddr();
    const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pairs: [makePair({ address: addr, liquidity: 50, volume: 0, pairCreatedAt: twoDaysAgo })] }),
    });
    const result = await checkTokenStatus(addr);
    expect(result.alive).toBe(false);
  });

  it('returns dead when no pairs exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pairs: [] }),
    });
    const result = await checkTokenStatus(uniqueAddr());
    expect(result.alive).toBe(false);
    expect(result.liquidity).toBe(0);
  });

  it('returns dead when pairs key is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });
    const result = await checkTokenStatus(uniqueAddr());
    expect(result.alive).toBe(false);
  });

  it('returns dead when fetch response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await checkTokenStatus(uniqueAddr());
    expect(result.alive).toBe(false);
  });

  it('returns dead when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await checkTokenStatus(uniqueAddr());
    expect(result.alive).toBe(false);
    expect(result.name).toBe('');
  });

  it('aggregates liquidity and volume across pairs', async () => {
    const addr = uniqueAddr();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        pairs: [
          makePair({ address: addr, liquidity: 60, volume: 0 }),
          makePair({ address: addr, liquidity: 60, volume: 10 }),
        ],
      }),
    });
    const result = await checkTokenStatus(addr);
    expect(result.alive).toBe(true); // 120 >= 100
    expect(result.liquidity).toBe(120);
    expect(result.volume24h).toBe(10);
  });

  it('returns ISO date string for pairCreatedAt', async () => {
    const addr = uniqueAddr();
    const ts = 1702243487000; // 2023-12-10T21:04:47.000Z
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pairs: [makePair({ address: addr, pairCreatedAt: ts })] }),
    });
    const result = await checkTokenStatus(addr);
    expect(result.pairCreatedAt).toBe(new Date(ts).toISOString());
  });

  it('returns null pairCreatedAt when not present', async () => {
    const addr = uniqueAddr();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        pairs: [{
          chainId: 'solana', dexId: 'raydium', pairAddress: 'p1',
          baseToken: { address: addr, name: 'Test', symbol: 'T' },
          liquidity: { usd: 500 }, volume: { h24: 0 },
          // no pairCreatedAt
        }],
      }),
    });
    const result = await checkTokenStatus(addr);
    expect(result.pairCreatedAt).toBeNull();
    expect(result.alive).toBe(true); // has liquidity
  });
});

describe('bulkCheckTokens', () => {
  it('batches addresses 30 per request', async () => {
    const addrs = Array.from({ length: 35 }, () => uniqueAddr());
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ pairs: addrs.slice(0, 30).map(a => makePair({ address: a })) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ pairs: addrs.slice(30).map(a => makePair({ address: a })) }),
      });

    const results = await bulkCheckTokens(addrs);
    expect(results.size).toBe(35);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('marks tokens dead but does NOT cache on failed batch (allows retry)', async () => {
    const addr1 = uniqueAddr();
    const addr2 = uniqueAddr();

    // First call: batch fails
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const results1 = await bulkCheckTokens([addr1, addr2]);
    expect(results1.get(addr1)!.alive).toBe(false);

    // Second call: should NOT be cached, so it fetches again
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pairs: [makePair({ address: addr1, liquidity: 500 })] }),
    });
    const results2 = await bulkCheckTokens([addr1]);
    expect(results2.get(addr1)!.alive).toBe(true);
  });

  it('leaves tokens out of results on thrown batch (not falsely dead)', async () => {
    const addr = uniqueAddr();
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));
    const results = await bulkCheckTokens([addr]);
    // The catch block does nothing — token is not in results
    expect(results.has(addr)).toBe(false);
  });

  it('groups pairs by token address in bulk response', async () => {
    const addr1 = uniqueAddr();
    const addr2 = uniqueAddr();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        pairs: [
          makePair({ address: addr1, liquidity: 60, volume: 0 }),
          makePair({ address: addr1, liquidity: 60, volume: 0 }),
          makePair({ address: addr2, liquidity: 0, volume: 0 }),
        ],
      }),
    });

    const results = await bulkCheckTokens([addr1, addr2]);
    expect(results.get(addr1)!.alive).toBe(true);  // 120 >= 100
    expect(results.get(addr2)!.alive).toBe(false);  // 0 liquidity, 0 volume, old
  });

  it('returns cached results without fetching', async () => {
    const addr = uniqueAddr();
    // First call populates cache
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pairs: [makePair({ address: addr, liquidity: 500 })] }),
    });
    await bulkCheckTokens([addr]);

    // Second call should use cache
    mockFetch.mockClear();
    const results = await bulkCheckTokens([addr]);
    expect(results.get(addr)!.alive).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('marks token dead when it has no pairs in bulk response', async () => {
    const addrWithPairs = uniqueAddr();
    const addrNoPairs = uniqueAddr();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        pairs: [makePair({ address: addrWithPairs, liquidity: 500 })],
      }),
    });

    const results = await bulkCheckTokens([addrWithPairs, addrNoPairs]);
    expect(results.get(addrWithPairs)!.alive).toBe(true);
    expect(results.get(addrNoPairs)!.alive).toBe(false);
  });
});
