import { sanitizeString } from '../utils/sanitize';
import { TTLCache } from './cache';
import { basicRpc } from './rpc';
import type { FindDeployerResult } from '../types';

const PUMP_FUN_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const NATIVE_MINT = 'So11111111111111111111111111111111111111112';

// Known CEX hot wallets on Solana
const CEX_WALLETS: Record<string, string> = {
  '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S': 'Binance',
  'AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2': 'Binance',
  'H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS': 'Coinbase',
  '2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm': 'Coinbase',
  'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE': 'Bybit',
  '5tzFkiKscjHK98YYhQvUDjUG462wVOzGAPz6TuBLgyVM': 'OKX',
  'HbZ5FfmKWNHC7uwGCA6MrmSfpmJjJtazEiFMTFApHsNa': 'Kraken',
};

// Cache metadata lookups for 30 minutes to save RPC calls on repeat deployers
const metadataCache = new TTLCache<{ name: string; symbol: string }>(1800);

// Cache mint authority data for 2 hours (authority revocation is permanent)
const mintAuthorityCache = new TTLCache<{
  mintAuthority: string | null;
  freezeAuthority: string | null;
  supply: string;
  decimals: number;
}>(7200);

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
  return basicRpc(method, params);
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
 * Returns wallet, creation signature, and detection method.
 * Strategy 1: Enhanced API sort-order=asc (1-2 calls)
 * Strategy 2: RPC pagination fallback
 */
export async function findDeployer(mintAddress: string): Promise<FindDeployerResult | null> {
  // Strategy 1: Enhanced API — get oldest transactions for this token (1 call)
  try {
    const txs = await getEnhancedTransactions(mintAddress, {
      limit: 5,
      sortOrder: 'asc',
    });

    for (const tx of txs) {
      if (tx.type === 'CREATE' && tx.source === 'PUMP_FUN' && tx.feePayer) {
        return { wallet: tx.feePayer, creationSig: tx.signature || null, method: 'enhanced_api' };
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
          return { wallet: txs[0].feePayer, creationSig: txs[0].signature || null, method: 'enhanced_api' };
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
        const feePayer = accounts.find((k: any) => k.signer);
        if (feePayer?.pubkey) {
          return { wallet: feePayer.pubkey, creationSig: oldestSig.signature, method: 'rpc_fallback' };
        }
      }
    }
  }

  // Fallback: return first signer if no initializeMint2 found
  const signers = accounts.filter((k: any) => k.signer);
  if (signers.length > 0) {
    return { wallet: signers[0].pubkey, creationSig: oldestSig.signature, method: 'rpc_fallback' };
  }

  return null;
}

/**
 * Find all tokens a deployer created via Pump.fun.
 * Paginates to 5000 transactions (up from 1000).
 * Returns { tokens, limitReached }.
 */
export async function findDeployerTokens(
  deployerWallet: string
): Promise<{ tokens: string[]; limitReached: boolean }> {
  const confirmedMints = new Set<string>();
  const MAX_TX = 5000;
  let totalTx = 0;

  // Strategy 1: Enhanced API — scan for Pump.fun CREATE txs directly
  let before: string | undefined;
  for (let page = 0; page < 50; page++) { // 50 pages * 100 = 5000 max
    if (totalTx >= MAX_TX) break;

    const txs = await getEnhancedTransactions(deployerWallet, {
      limit: 100,
      before,
    });

    if (!txs || txs.length === 0) break;

    for (const tx of txs) {
      // Only count tokens the deployer CREATED, not traded
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

      if (isPumpCreate) {
        // Confirmed Pump.fun creation — extract mints below
      } else if (hasPumpInstruction && (tx.type === 'UNKNOWN' || tx.type === 'COMPRESSED_NFT_MINT')) {
        const hasInitMint = (tx.instructions || []).some(
          (ix: any) =>
            ix.parsed?.type === 'initializeMint2' ||
            (ix.innerInstructions || []).some((inner: any) => inner.parsed?.type === 'initializeMint2')
        );
        if (!hasInitMint) continue;
      } else {
        continue;
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
    totalTx += txs.length;
    if (txs.length < 100) break;
  }

  if (confirmedMints.size === 0) {
    // Fallback: RPC scan for deployers with no enhanced API data
    const fallbackTokens = await findDeployerTokensRpc(deployerWallet);
    return { tokens: fallbackTokens, limitReached: false };
  }

  return { tokens: Array.from(confirmedMints), limitReached: totalTx >= MAX_TX };
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

/** Find the funding source of a wallet (earliest incoming SOL transfer).
 *  Returns wallet address AND timestamp for burner detection. */
export async function findFundingSource(wallet: string): Promise<{ wallet: string; timestamp: string } | null> {
  // Enhanced API sort-order=asc — 1 call to get oldest tx
  try {
    const txs = await getEnhancedTransactions(wallet, { limit: 5, sortOrder: 'asc' });
    for (const tx of txs) {
      const transfers = tx.nativeTransfers || [];
      for (const t of transfers) {
        if (t.toUserAccount === wallet && t.fromUserAccount && t.fromUserAccount !== wallet) {
          const timestamp = tx.timestamp
            ? new Date(tx.timestamp * 1000).toISOString()
            : new Date().toISOString();
          return { wallet: t.fromUserAccount, timestamp };
        }
      }
      if (tx.feePayer && tx.feePayer !== wallet) {
        const timestamp = tx.timestamp
          ? new Date(tx.timestamp * 1000).toISOString()
          : new Date().toISOString();
        return { wallet: tx.feePayer, timestamp };
      }
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

  const timestamp = oldestSig.blockTime
    ? new Date(oldestSig.blockTime * 1000).toISOString()
    : new Date().toISOString();

  const instructions = tx.transaction?.message?.instructions || [];
  for (const ix of instructions) {
    if (ix.parsed?.type === 'transfer' && ix.parsed?.info?.destination === wallet) {
      return { wallet: ix.parsed.info.source, timestamp };
    }
  }

  const signers = (tx.transaction?.message?.accountKeys || [])
    .filter((k: any) => k.signer && k.pubkey !== wallet);
  if (signers.length > 0) return { wallet: signers[0].pubkey, timestamp };

  return null;
}

/**
 * Analyze a funding wallet's cluster — find other wallets it funded
 * and check if they are also deployers.
 * Now checks 25 wallets (up from 10), any CREATE type (not just PUMP_FUN),
 * and detects CEX funding sources.
 */
export async function analyzeCluster(
  funderWallet: string,
  excludeWallet: string
): Promise<{ fundedWallets: string[]; deployerCount: number; fromCex: boolean; cexName: string | null }> {
  // CEX detection
  const cexName = CEX_WALLETS[funderWallet] || null;
  const fromCex = cexName !== null;

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
    return { fundedWallets: [], deployerCount: 0, fromCex, cexName };
  }

  // Check up to 25 funded wallets for deployer activity (up from 10)
  const walletsToCheck = Array.from(fundedWallets).slice(0, 25);
  let deployerCount = 0;

  // Check all 25 in parallel (each is a single API call)
  const results = await Promise.all(
    walletsToCheck.map(async (wallet) => {
      try {
        const txs = await getEnhancedTransactions(wallet, { limit: 20 });
        // Broadened: any CREATE or TOKEN_MINT type (not just PUMP_FUN source)
        const isDeployer = txs.some(
          (tx: any) =>
            tx.feePayer === wallet &&
            (tx.type === 'CREATE' || tx.type === 'TOKEN_MINT')
        );
        return isDeployer;
      } catch {
        return false;
      }
    })
  );

  for (const isDeployer of results) {
    if (isDeployer) deployerCount++;
  }

  return {
    fundedWallets: Array.from(fundedWallets),
    deployerCount,
    fromCex,
    cexName,
  };
}

/**
 * Check mint/freeze authority status for a token.
 * Returns null if the mint account can't be parsed.
 */
export async function checkMintAuthority(mintAddress: string): Promise<{
  mintAuthority: string | null;
  freezeAuthority: string | null;
  supply: string;
  decimals: number;
} | null> {
  const cached = mintAuthorityCache.get(mintAddress);
  if (cached) return cached;

  const result = await rpcCall('getAccountInfo', [mintAddress, { encoding: 'jsonParsed' }]);
  const parsed = result?.value?.data?.parsed;
  if (!parsed || parsed.type !== 'mint') return null;

  const info = parsed.info;
  const data = {
    mintAuthority: info.mintAuthority || null,
    freezeAuthority: info.freezeAuthority || null,
    supply: info.supply as string,
    decimals: info.decimals as number,
  };
  mintAuthorityCache.set(mintAddress, data);
  return data;
}

/**
 * Check how much of a token's supply the deployer still holds.
 * Returns percentage (0-100) or null if lookup fails.
 */
export async function checkDeployerHoldings(
  deployerWallet: string,
  mintAddress: string,
  totalSupply: string,
  decimals: number
): Promise<number | null> {
  if (totalSupply === '0') return 0;

  const result = await rpcCall('getTokenAccountsByOwner', [
    deployerWallet,
    { mint: mintAddress },
    { encoding: 'jsonParsed' },
  ]);

  const accounts = result?.value || [];
  let deployerBalance = BigInt(0);
  for (const acc of accounts) {
    const amount = acc.account?.data?.parsed?.info?.tokenAmount?.amount;
    if (amount) deployerBalance += BigInt(amount);
  }

  const supply = BigInt(totalSupply);
  if (supply === BigInt(0)) return 0;

  const pct = Number((deployerBalance * BigInt(10000)) / supply) / 100;
  return Math.round(pct * 100) / 100;
}

/**
 * Get top holder concentration for a token.
 * Returns top 1 and top 5 holder percentages.
 */
export async function checkTopHolders(
  mintAddress: string,
  totalSupply: string
): Promise<{ topHolderPct: number; top5Pct: number } | null> {
  if (totalSupply === '0') return null;

  const result = await rpcCall('getTokenLargestAccounts', [mintAddress]);
  const accounts = result?.value || [];
  if (accounts.length === 0) return null;

  const supply = BigInt(totalSupply);
  let topHolderAmount = BigInt(0);
  let top5Amount = BigInt(0);

  for (let i = 0; i < accounts.length && i < 5; i++) {
    const amount = BigInt(accounts[i].amount || '0');
    if (i === 0) topHolderAmount = amount;
    top5Amount += amount;
  }

  const topHolderPct = Number((topHolderAmount * BigInt(10000)) / supply) / 100;
  const top5Pct = Number((top5Amount * BigInt(10000)) / supply) / 100;

  return {
    topHolderPct: Math.round(topHolderPct * 100) / 100,
    top5Pct: Math.round(top5Pct * 100) / 100,
  };
}

/**
 * Detect bundled launches — 3+ unique wallets buying in the creation slot (±3).
 * Returns true if bundled, false if not, null if detection couldn't run.
 */
export async function checkBundledLaunch(
  mintAddress: string,
  creationSig: string | null
): Promise<boolean | null> {
  if (!creationSig) return null;

  try {
    const txs = await getEnhancedTransactions(mintAddress, {
      limit: 20,
      sortOrder: 'asc',
    });

    if (!txs || txs.length === 0) return null;

    // Find the creation slot
    const creationTx = txs.find((tx: any) => tx.signature === creationSig);
    const creationSlot = creationTx?.slot;
    if (!creationSlot) return null;

    // Find the deployer (feePayer of creation tx)
    const deployer = creationTx.feePayer;

    // Count unique non-deployer wallets that bought within ±3 slots
    const earlyBuyers = new Set<string>();
    for (const tx of txs) {
      if (!tx.slot || Math.abs(tx.slot - creationSlot) > 3) continue;
      if (tx.signature === creationSig) continue;

      const transfers = tx.tokenTransfers || [];
      for (const t of transfers) {
        if (t.mint === mintAddress && t.toUserAccount && t.toUserAccount !== deployer) {
          earlyBuyers.add(t.toUserAccount);
        }
      }

      if (tx.feePayer && tx.feePayer !== deployer) {
        const hasBuy = transfers.some(
          (t: any) => t.mint === mintAddress && t.toUserAccount === tx.feePayer
        );
        if (hasBuy) earlyBuyers.add(tx.feePayer);
      }
    }

    return earlyBuyers.size >= 3;
  } catch {
    return null;
  }
}

/** Get SOL balance for a wallet (in SOL, not lamports) */
export async function getWalletSolBalance(wallet: string): Promise<number | null> {
  try {
    const result = await rpcCall('getBalance', [wallet]);
    if (result?.value !== undefined) {
      return result.value / 1e9;
    }
    return null;
  } catch {
    return null;
  }
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
