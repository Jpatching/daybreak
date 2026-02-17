import { sanitizeString } from '../utils/sanitize';
import { TTLCache } from './cache';

const PUMP_FUN_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const NATIVE_MINT = 'So11111111111111111111111111111111111111112';

// Cache metadata lookups for 30 minutes to save RPC calls on repeat deployers
const metadataCache = new TTLCache<{ name: string; symbol: string }>(1800);

function getApiKey(): string {
  const key = process.env.HELIUS_API_KEY;
  if (!key) throw new Error('HELIUS_API_KEY not set');
  return key;
}

function getRpcUrl(): string {
  return `https://mainnet.helius-rpc.com/?api-key=${getApiKey()}`;
}

function getEnhancedApiUrl(): string {
  return `https://api.helius.xyz/v0`;
}

async function rpcCall(method: string, params: any[]): Promise<any> {
  const res = await fetch(getRpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json: any = await res.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result;
}

export async function getSignaturesForAddress(
  address: string,
  limit: number = 1000,
  before?: string
): Promise<any[]> {
  const opts: any = { limit };
  if (before) opts.before = before;
  return rpcCall('getSignaturesForAddress', [address, opts]);
}

export async function getParsedTransaction(signature: string): Promise<any> {
  return rpcCall('getTransaction', [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]);
}

/**
 * Get enhanced transaction history from Helius Enhanced API.
 * 100 txs per call — much more efficient than fetching 1-by-1.
 */
async function getEnhancedTransactions(
  address: string,
  opts: { limit?: number; sortOrder?: 'asc' | 'desc'; type?: string; before?: string } = {}
): Promise<any[]> {
  const params = new URLSearchParams({ 'api-key': getApiKey() });
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.sortOrder) params.set('sort-order', opts.sortOrder);
  if (opts.type) params.set('type', opts.type);
  if (opts.before) params.set('before', opts.before);

  const url = `${getEnhancedApiUrl()}/addresses/${address}/transactions?${params}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`Helius API error: ${res.status}`);
    const json: any = await res.json();
    if (!Array.isArray(json)) return [];
    return json;
  }
  throw new Error('Helius API rate limited after 3 retries');
}

/**
 * Find the deployer/creator of a Pump.fun token.
 * Strategy 1: Enhanced API sort-order=asc (1-2 calls)
 * Strategy 2: RPC pagination fallback
 */
export async function findDeployer(mintAddress: string): Promise<string | null> {
  // Strategy 1: Enhanced API — get oldest transactions for this token (1 call)
  try {
    const txs = await getEnhancedTransactions(mintAddress, {
      limit: 5,
      sortOrder: 'asc',
    });

    for (const tx of txs) {
      if (tx.type === 'CREATE' && tx.source === 'PUMP_FUN' && tx.feePayer) {
        return tx.feePayer;
      }
    }

    // If first tx is PUMP_FUN-related, use feePayer (they paid to create)
    if (txs.length > 0 && txs[0].feePayer) {
      const parsed = await getParsedTransaction(txs[0].signature);
      if (parsed) {
        const accounts = parsed.transaction?.message?.accountKeys || [];
        const hasPumpFun = accounts.some((k: any) => k.pubkey === PUMP_FUN_PROGRAM);
        const inner = parsed.meta?.innerInstructions || [];
        let hasInitMint = false;
        for (const group of inner) {
          for (const ix of (group.instructions || [])) {
            if (ix.parsed?.type === 'initializeMint2') hasInitMint = true;
          }
        }
        if (hasPumpFun && hasInitMint) {
          // Prefer feePayer — on Pump.fun the deployer pays to create
          return txs[0].feePayer;
        }
      }
    }
  } catch {
    // Enhanced API failed, try fallback
  }

  // Strategy 2: RPC pagination to oldest signature
  let before: string | undefined;
  let oldestSig: any = null;
  for (let page = 0; page < 10; page++) {
    const sigs = await getSignaturesForAddress(mintAddress, 1000, before);
    if (!sigs || sigs.length === 0) break;
    oldestSig = sigs[sigs.length - 1];
    before = oldestSig.signature;
    if (sigs.length < 1000) break;
  }

  if (!oldestSig) return null;

  const tx = await getParsedTransaction(oldestSig.signature);
  if (!tx) return null;

  // Look for initializeMint2 to confirm this is a creation tx,
  // then return the feePayer (the actual deployer)
  const accounts = tx.transaction?.message?.accountKeys || [];
  const inner = tx.meta?.innerInstructions || [];
  for (const group of inner) {
    for (const ix of (group.instructions || [])) {
      if (ix.parsed?.type === 'initializeMint2' && ix.parsed?.info?.mint === mintAddress) {
        // The feePayer of this tx is the deployer
        const feePayer = accounts.find((k: any) => k.signer);
        return feePayer?.pubkey || null;
      }
    }
  }

  // Fallback: return first signer if no initializeMint2 found
  const signers = accounts.filter((k: any) => k.signer);
  if (signers.length > 0) return signers[0].pubkey;

  return null;
}

/**
 * Find all tokens a deployer created via Pump.fun.
 *
 * Strategy: Scan enhanced tx history for CREATE txs from PUMP_FUN source,
 * plus check instructions for Pump.fun program ID. Extract mints from all
 * token transfers and balance changes in matching txs.
 *
 * Much more reliable than the old endsWith('pump') heuristic — catches all
 * Pump.fun tokens regardless of mint address format.
 */
export async function findDeployerTokens(deployerWallet: string): Promise<string[]> {
  const confirmedMints = new Set<string>();

  // Strategy 1: Enhanced API — scan for Pump.fun CREATE txs directly
  let before: string | undefined;
  for (let page = 0; page < 20; page++) {
    const txs = await getEnhancedTransactions(deployerWallet, {
      limit: 100,
      before,
    });

    if (!txs || txs.length === 0) break;

    for (const tx of txs) {
      // Only count tokens the deployer CREATED, not traded
      // A deployer must be the feePayer on the creation tx
      if (tx.feePayer !== deployerWallet) continue;

      const isPumpSource = tx.source === 'PUMP_FUN';
      const isPumpCreate =
        (tx.type === 'CREATE' && isPumpSource) ||
        (tx.type === 'TOKEN_MINT' && isPumpSource);

      // Check if any instruction or inner instruction targets Pump.fun program
      const hasPumpInstruction = (tx.instructions || []).some(
        (ix: any) =>
          ix.programId === PUMP_FUN_PROGRAM ||
          (ix.innerInstructions || []).some((inner: any) => inner.programId === PUMP_FUN_PROGRAM)
      );

      // For non-CREATE txs (swaps, sells), skip entirely — we only want creations
      if (!isPumpCreate && !hasPumpInstruction) continue;
      // If it has Pump.fun instructions but isn't a CREATE, skip
      // (this filters out buy/sell interactions with pump tokens)
      if (!isPumpCreate && hasPumpInstruction) {
        // Only allow if this looks like a token creation (has TOKEN_MINT or CREATE type)
        if (tx.type !== 'CREATE' && tx.type !== 'TOKEN_MINT') continue;
      }

      // Extract mints from this creation tx
      const transfers = tx.tokenTransfers || [];
      for (const t of transfers) {
        if (t.mint && t.mint !== NATIVE_MINT) {
          confirmedMints.add(t.mint);
        }
      }

      // Also check accountData for token balance changes
      const accountData = tx.accountData || [];
      for (const ad of accountData) {
        const changes = ad.tokenBalanceChanges || [];
        for (const tbc of changes) {
          if (tbc.mint && tbc.mint !== NATIVE_MINT) {
            confirmedMints.add(tbc.mint);
          }
        }
      }
    }

    before = txs[txs.length - 1]?.signature;
    if (txs.length < 100) break;
  }

  if (confirmedMints.size === 0) {
    // Fallback: RPC scan for deployers with no enhanced API data
    return findDeployerTokensRpc(deployerWallet);
  }

  return Array.from(confirmedMints);
}

/**
 * Fallback: RPC-based token discovery for when enhanced API has no data.
 * More expensive but catches edge cases.
 */
async function findDeployerTokensRpc(deployerWallet: string): Promise<string[]> {
  const tokenMints = new Set<string>();

  const allSigs: any[] = [];
  let before: string | undefined;
  for (let page = 0; page < 5; page++) {
    const sigs = await getSignaturesForAddress(deployerWallet, 1000, before);
    if (!sigs || sigs.length === 0) break;
    allSigs.push(...sigs);
    before = sigs[sigs.length - 1].signature;
    if (sigs.length < 1000) break;
  }

  const successSigs = allSigs.filter(s => s.err === null);
  const batchSize = 10;
  const maxTxsToCheck = Math.min(successSigs.length, 300);

  for (let i = 0; i < maxTxsToCheck; i += batchSize) {
    const batch = successSigs.slice(i, i + batchSize);
    const txPromises = batch.map(sig =>
      getParsedTransaction(sig.signature).catch(() => null)
    );
    const txs = await Promise.all(txPromises);

    for (const tx of txs) {
      if (!tx) continue;
      const accounts = tx.transaction?.message?.accountKeys || [];
      const hasPumpFun = accounts.some((k: any) => k.pubkey === PUMP_FUN_PROGRAM);
      if (!hasPumpFun) continue;

      const inner = tx.meta?.innerInstructions || [];
      for (const group of inner) {
        for (const ix of (group.instructions || [])) {
          if (ix.parsed?.type === 'initializeMint2' && ix.parsed?.info?.mint) {
            const mint = ix.parsed.info.mint;
            if (mint !== NATIVE_MINT) {
              tokenMints.add(mint);
            }
          }
        }
      }
    }
  }

  return Array.from(tokenMints);
}

/** Get token metadata (name, symbol) from on-chain data via Helius DAS API */
export async function getTokenMetadata(mintAddress: string): Promise<{ name: string; symbol: string }> {
  const cached = metadataCache.get(mintAddress);
  if (cached) return cached;

  try {
    const res = await fetch(getRpcUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAsset',
        params: { id: mintAddress },
      }),
    });
    const json: any = await res.json();
    if (json.result?.content?.metadata) {
      const result = {
        name: sanitizeString(json.result.content.metadata.name || 'Unknown'),
        symbol: sanitizeString(json.result.content.metadata.symbol || '???'),
      };
      metadataCache.set(mintAddress, result);
      return result;
    }
  } catch {
    // fallback below
  }
  const fallback = { name: 'Unknown', symbol: '???' };
  metadataCache.set(mintAddress, fallback);
  return fallback;
}

/** Find the funding source of a wallet (earliest incoming SOL transfer) */
export async function findFundingSource(wallet: string): Promise<string | null> {
  // Enhanced API sort-order=asc — 1 call to get oldest tx
  try {
    const txs = await getEnhancedTransactions(wallet, { limit: 5, sortOrder: 'asc' });
    for (const tx of txs) {
      const transfers = tx.nativeTransfers || [];
      for (const t of transfers) {
        if (t.toUserAccount === wallet && t.fromUserAccount && t.fromUserAccount !== wallet) {
          return t.fromUserAccount;
        }
      }
      if (tx.feePayer && tx.feePayer !== wallet) return tx.feePayer;
    }
  } catch {
    // fallback to RPC
  }

  // RPC fallback
  let before: string | undefined;
  let oldestSig: any = null;
  for (let page = 0; page < 3; page++) {
    const sigs = await getSignaturesForAddress(wallet, 1000, before);
    if (!sigs || sigs.length === 0) break;
    oldestSig = sigs[sigs.length - 1];
    before = oldestSig.signature;
    if (sigs.length < 1000) break;
  }

  if (!oldestSig) return null;

  const tx = await getParsedTransaction(oldestSig.signature);
  if (!tx) return null;

  const instructions = tx.transaction?.message?.instructions || [];
  for (const ix of instructions) {
    if (ix.parsed?.type === 'transfer' && ix.parsed?.info?.destination === wallet) {
      return ix.parsed.info.source;
    }
  }

  const signers = (tx.transaction?.message?.accountKeys || [])
    .filter((k: any) => k.signer && k.pubkey !== wallet);
  if (signers.length > 0) return signers[0].pubkey;

  return null;
}

/**
 * Analyze a funding wallet's cluster — find other wallets it funded
 * and check if they are also Pump.fun deployers.
 * Returns list of funded wallets and how many are deployers.
 */
export async function analyzeCluster(
  funderWallet: string,
  excludeWallet: string
): Promise<{ fundedWallets: string[]; deployerCount: number }> {
  const fundedWallets = new Set<string>();

  // Scan funder's outgoing SOL transfers via Enhanced API
  try {
    let before: string | undefined;
    for (let page = 0; page < 5; page++) {
      const txs = await getEnhancedTransactions(funderWallet, {
        limit: 100,
        before,
      });

      if (!txs || txs.length === 0) break;

      for (const tx of txs) {
        const nativeTransfers = tx.nativeTransfers || [];
        for (const t of nativeTransfers) {
          // Outgoing SOL from funder to other wallets
          if (
            t.fromUserAccount === funderWallet &&
            t.toUserAccount &&
            t.toUserAccount !== funderWallet &&
            t.toUserAccount !== excludeWallet &&
            t.toUserAccount !== NATIVE_MINT &&
            t.amount > 10_000_000 // > 0.01 SOL (filter dust)
          ) {
            fundedWallets.add(t.toUserAccount);
          }
        }
      }

      before = txs[txs.length - 1]?.signature;
      if (txs.length < 100) break;
    }
  } catch {
    // cluster analysis is best-effort
  }

  if (fundedWallets.size === 0) {
    return { fundedWallets: [], deployerCount: 0 };
  }

  // Check a sample of funded wallets for Pump.fun activity (max 10 to limit API calls)
  const walletsToCheck = Array.from(fundedWallets).slice(0, 10);
  let deployerCount = 0;

  const checkBatchSize = 3;
  for (let i = 0; i < walletsToCheck.length; i += checkBatchSize) {
    const batch = walletsToCheck.slice(i, i + checkBatchSize);
    const results = await Promise.all(
      batch.map(async (wallet) => {
        try {
          // Quick check: look for any Pump.fun CREATE tx in first 20 txs
          const txs = await getEnhancedTransactions(wallet, { limit: 20 });
          const hasPump = txs.some(
            (tx: any) =>
              (tx.source === 'PUMP_FUN') ||
              (tx.instructions || []).some((ix: any) => ix.programId === PUMP_FUN_PROGRAM)
          );
          return hasPump;
        } catch {
          return false;
        }
      })
    );

    for (const isDeployer of results) {
      if (isDeployer) deployerCount++;
    }
  }

  return {
    fundedWallets: Array.from(fundedWallets),
    deployerCount,
  };
}

/** Check if Helius API is reachable */
export async function healthCheck(): Promise<boolean> {
  try {
    const result = await rpcCall('getHealth', []);
    return result === 'ok';
  } catch {
    return false;
  }
}
