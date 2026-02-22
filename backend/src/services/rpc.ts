/**
 * Multi-provider RPC routing layer with circuit breaker.
 * - Enhanced API calls -> always Helius (only provider with Enhanced Transaction API)
 * - Basic RPC calls -> Alchemy primary -> QuickNode fallback -> Helius last resort
 * - Circuit breaker: skip provider for 60s after 3 consecutive failures
 */

interface Provider {
  name: string;
  url: string;
  type: 'enhanced' | 'basic';
}

// Circuit breaker state per provider
interface CircuitState {
  failures: number;
  lastFailure: number;
  open: boolean;
}

const circuitBreakers = new Map<string, CircuitState>();
const FAILURE_THRESHOLD = 3;
const RECOVERY_MS = 60_000; // 60 seconds

function isCircuitOpen(name: string): boolean {
  const state = circuitBreakers.get(name);
  if (!state || !state.open) return false;
  // Check if recovery period has elapsed
  if (Date.now() - state.lastFailure > RECOVERY_MS) {
    state.open = false;
    state.failures = 0;
    return false;
  }
  return true;
}

function recordFailure(name: string): void {
  const state = circuitBreakers.get(name) || { failures: 0, lastFailure: 0, open: false };
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= FAILURE_THRESHOLD) {
    state.open = true;
    console.warn(`[rpc] Circuit OPEN for ${name} — skipping for ${RECOVERY_MS / 1000}s after ${FAILURE_THRESHOLD} failures`);
  }
  circuitBreakers.set(name, state);
}

function recordSuccess(name: string): void {
  const state = circuitBreakers.get(name);
  if (state) {
    state.failures = 0;
    state.open = false;
  }
}

function getProviders(): Provider[] {
  const providers: Provider[] = [];

  const heliusKey = process.env.HELIUS_API_KEY;
  if (heliusKey) {
    providers.push({
      name: 'helius',
      url: `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`,
      type: 'enhanced',
    });
  }

  const alchemyKey = process.env.ALCHEMY_API_KEY;
  if (alchemyKey) {
    providers.push({
      name: 'alchemy',
      url: `https://solana-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      type: 'basic',
    });
  }

  const quicknodeUrl = process.env.QUICKNODE_RPC_URL;
  if (quicknodeUrl) {
    providers.push({
      name: 'quicknode',
      url: quicknodeUrl,
      type: 'basic',
    });
  }

  return providers;
}

function getBasicProviders(): Provider[] {
  const all = getProviders();
  // Prefer non-Helius for basic calls to save Helius quota for enhanced API
  const basic = all.filter(p => p.type === 'basic');
  const helius = all.find(p => p.name === 'helius');
  if (helius) basic.push(helius); // Helius as last resort
  if (basic.length === 0 && helius) return [helius];
  return basic;
}

function getHeliusUrl(): string {
  const key = process.env.HELIUS_API_KEY;
  if (!key) throw new Error('HELIUS_API_KEY not set');
  return `https://mainnet.helius-rpc.com/?api-key=${key}`;
}

/**
 * Make a basic JSON-RPC call with provider fallback chain + circuit breaker.
 * Tries Alchemy -> QuickNode -> Helius for basic calls.
 */
export async function basicRpc(method: string, params: any[]): Promise<any> {
  const providers = getBasicProviders();
  if (providers.length === 0) throw new Error('No RPC providers configured');

  let lastError: Error | null = null;

  for (const provider of providers) {
    // Skip providers with open circuit breaker
    if (isCircuitOpen(provider.name)) {
      continue;
    }

    try {
      const res = await fetch(provider.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(15000),
      });

      const json: any = await res.json();
      if (json.error) {
        lastError = new Error(`RPC error (${provider.name}): ${json.error.message}`);
        recordFailure(provider.name);
        continue;
      }
      recordSuccess(provider.name);
      return json.result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      recordFailure(provider.name);
      continue;
    }
  }

  throw lastError || new Error('All RPC providers failed');
}

/**
 * Make an enhanced RPC call — always uses Helius.
 */
export async function enhancedRpc(method: string, params: any[]): Promise<any> {
  const url = getHeliusUrl();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });

  const json: any = await res.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result;
}

/**
 * Batch multiple basic RPC calls across providers.
 */
export async function batchRpc(
  calls: Array<{ method: string; params: any[] }>
): Promise<any[]> {
  const providers = getBasicProviders().filter(p => !isCircuitOpen(p.name));
  if (providers.length === 0) throw new Error('No RPC providers available (all circuits open)');

  const provider = providers[0]; // Use primary available provider for batch

  try {
    const body = calls.map((c, i) => ({
      jsonrpc: '2.0',
      id: i,
      method: c.method,
      params: c.params,
    }));

    const res = await fetch(provider.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    const json: any = await res.json();
    if (!Array.isArray(json)) throw new Error('Batch RPC returned non-array');

    // Sort by id to maintain order
    json.sort((a: any, b: any) => a.id - b.id);
    recordSuccess(provider.name);
    return json.map((r: any) => {
      if (r.error) throw new Error(`Batch RPC error: ${r.error.message}`);
      return r.result;
    });
  } catch (err) {
    recordFailure(provider.name);
    throw err;
  }
}
