import { Request, Response, NextFunction } from 'express';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { createHash } from 'crypto';
import { isPaymentUsed, recordPayment } from './db';

// x402 Payment Protocol — Solana USDC server middleware
// Supports two verification modes:
// 1. On-chain USDC transfer verification (frontend web UI)
// 2. Legacy Ed25519 signature verification (MCP/programmatic clients)

const USDC_DECIMALS = 6;
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MAX_PAYMENT_AGE_SECONDS = 600; // 10 minutes

export interface X402ServerConfig {
  payToWallet: string;
  network: 'solana' | 'solana-devnet';
  priceUsd: number;
  description?: string;
}

export interface X402PaymentOption {
  scheme: 'exact';
  network: string;
  asset: string;
  maxAmountRequired: string;
  payTo: string;
  validUntil: number;
}

export interface X402PaymentDetails {
  accepts: X402PaymentOption[];
  description: string;
  resource: string;
}

interface PaymentStats {
  totalPayments: number;
  totalRevenue: number;
  byEndpoint: Record<string, { count: number; revenue: number }>;
}

// In-memory payment stats (survives within process lifetime)
const stats: PaymentStats = {
  totalPayments: 0,
  totalRevenue: 0,
  byEndpoint: {},
};

export function getX402Stats(): PaymentStats {
  return { ...stats, byEndpoint: { ...stats.byEndpoint } };
}

function usdToLamports(usd: number): string {
  return Math.round(usd * Math.pow(10, USDC_DECIMALS)).toString();
}

export function buildPaymentDetails(config: X402ServerConfig, resource: string): X402PaymentDetails {
  return {
    accepts: [{
      scheme: 'exact',
      network: config.network,
      asset: 'USDC',
      maxAmountRequired: usdToLamports(config.priceUsd),
      payTo: config.payToWallet,
      validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
    }],
    description: config.description || `Daybreak deployer scan — $${config.priceUsd} USDC`,
    resource,
  };
}

export function send402(res: Response, config: X402ServerConfig, resource: string): void {
  const details = buildPaymentDetails(config, resource);
  const detailsBase64 = Buffer.from(JSON.stringify(details)).toString('base64');

  res.status(402)
    .set('WWW-Authenticate', `X402 details="${detailsBase64}"`)
    .set('X-PAYMENT-DETAILS', detailsBase64)
    .json({
      error: 'Payment Required',
      payment_required: true,
      price_usd: config.priceUsd,
      details,
    });
}

// ---------- On-chain transaction verification ----------

interface X402TxPayload {
  txSignature: string;  // base58 Solana tx signature
  payer: string;        // base58 public key of payer
}

/**
 * Verify a real on-chain USDC transfer to the treasury.
 * Fetches the transaction from Helius RPC, checks:
 * 1. Transaction succeeded (no errors)
 * 2. Recent enough (within MAX_PAYMENT_AGE_SECONDS)
 * 3. USDC balance of treasury increased by at least the expected amount
 * 4. Claimed payer is a signer on the transaction
 * 5. Transaction hasn't been used before (replay protection)
 *
 * Returns the verified payer public key (base58) or null if invalid.
 */
async function verifyPaymentTransaction(
  payload: X402TxPayload,
  config: X402ServerConfig
): Promise<string | null> {
  try {
    const { txSignature, payer } = payload;

    if (!txSignature || !payer) return null;

    // Check replay protection first (cheap DB lookup)
    if (isPaymentUsed(txSignature)) {
      console.error(`[x402] Transaction already used: ${txSignature}`);
      return null;
    }

    // Fetch transaction from Helius RPC
    const rpcUrl = process.env.SOLANA_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getTransaction',
        params: [txSignature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
      }),
    });

    const json = await res.json() as any;
    const tx = json.result;
    if (!tx) {
      console.error(`[x402] Transaction not found: ${txSignature}`);
      return null;
    }

    // Check transaction succeeded
    if (tx.meta?.err) {
      console.error(`[x402] Transaction failed on-chain: ${txSignature}`);
      return null;
    }

    // Check recency
    const txTime = tx.blockTime;
    const now = Math.floor(Date.now() / 1000);
    if (!txTime || Math.abs(now - txTime) > MAX_PAYMENT_AGE_SECONDS) {
      console.error(`[x402] Transaction too old: blockTime=${txTime}, now=${now}`);
      return null;
    }

    // Check USDC balance change via pre/post token balances
    const expectedAmount = parseInt(usdToLamports(config.priceUsd));
    const preBalances = tx.meta?.preTokenBalances || [];
    const postBalances = tx.meta?.postTokenBalances || [];

    let treasuryReceived = false;
    for (const post of postBalances) {
      if (post.mint !== USDC_MINT) continue;
      if (post.owner !== config.payToWallet) continue;
      const pre = preBalances.find(
        (p: any) => p.accountIndex === post.accountIndex && p.mint === USDC_MINT
      );
      const preBal = parseInt(pre?.uiTokenAmount?.amount || '0');
      const postBal = parseInt(post.uiTokenAmount?.amount || '0');
      if (postBal - preBal >= expectedAmount) {
        treasuryReceived = true;
        break;
      }
    }

    if (!treasuryReceived) {
      console.error(`[x402] Treasury did not receive expected USDC amount (>=${expectedAmount})`);
      return null;
    }

    // Verify payer is a signer on the tx
    const signers = tx.transaction?.message?.accountKeys
      ?.filter((k: any) => k.signer)
      ?.map((k: any) => k.pubkey) || [];
    if (!signers.includes(payer)) {
      console.error(`[x402] Claimed payer ${payer} is not a signer on tx`);
      return null;
    }

    // Record payment to prevent replay
    recordPayment(txSignature, payer, config.priceUsd, 'x402');

    console.log(`[x402] On-chain payment verified: ${txSignature} from ${payer}`);
    return payer;
  } catch (err) {
    console.error('[x402] Transaction verification error:', err);
    return null;
  }
}

// ---------- Legacy Ed25519 signature verification ----------

interface X402SignaturePayload {
  paymentOption: {
    scheme: string;
    network: string;
    asset: string;
    maxAmountRequired: string;
    payTo: string;
    validUntil?: number;
  };
  signature: string;  // base58 Ed25519 signature
  payer: string;      // base58 public key
  nonce: string;
  timestamp: number;
}

/**
 * Legacy: Verify x402 payment via Ed25519 signature (no on-chain transfer).
 * Used by MCP and programmatic clients.
 */
function verifyPaymentSignature(payload: X402SignaturePayload, config: X402ServerConfig): string | null {
  try {
    const { paymentOption, signature, payer, nonce, timestamp } = payload;

    if (!paymentOption || !signature || !payer || !nonce || !timestamp) {
      console.error('[x402] Missing required fields in signature payload');
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > MAX_PAYMENT_AGE_SECONDS) {
      console.error(`[x402] Payment timestamp too old/future: ${timestamp} vs ${now}`);
      return null;
    }

    if (paymentOption.payTo !== config.payToWallet) {
      console.error(`[x402] payTo mismatch: ${paymentOption.payTo} !== ${config.payToWallet}`);
      return null;
    }

    const expectedAmount = usdToLamports(config.priceUsd);
    if (BigInt(paymentOption.maxAmountRequired) < BigInt(expectedAmount)) {
      console.error(`[x402] Amount too low: ${paymentOption.maxAmountRequired} < ${expectedAmount}`);
      return null;
    }

    const message = JSON.stringify({
      scheme: paymentOption.scheme,
      network: paymentOption.network,
      asset: paymentOption.asset,
      amount: paymentOption.maxAmountRequired,
      payTo: paymentOption.payTo,
      nonce,
      timestamp,
      validUntil: paymentOption.validUntil ?? timestamp + 300,
    });

    const messageBytes = new TextEncoder().encode(message);
    const messageHash = createHash('sha256').update(messageBytes).digest();

    let publicKeyBytes: Uint8Array;
    let signatureBytes: Uint8Array;
    try {
      publicKeyBytes = bs58.decode(payer);
      signatureBytes = bs58.decode(signature);
    } catch {
      console.error('[x402] Failed to decode base58 payer/signature');
      return null;
    }

    if (publicKeyBytes.length !== 32 || signatureBytes.length !== 64) {
      console.error('[x402] Invalid key/signature length');
      return null;
    }

    const valid = nacl.sign.detached.verify(
      new Uint8Array(messageHash),
      signatureBytes,
      publicKeyBytes,
    );

    if (!valid) {
      console.error('[x402] Ed25519 signature verification failed');
      return null;
    }

    return payer;
  } catch (err) {
    console.error('[x402] Signature verification error:', err);
    return null;
  }
}

// ---------- Middleware ----------

/**
 * x402 middleware for paid endpoints.
 * Supports two payment modes:
 * 1. On-chain USDC transfer (payload has `txSignature`) — used by web UI
 * 2. Legacy Ed25519 signature (payload has `signature` + `paymentOption`) — used by MCP/bots
 *
 * If no X-PAYMENT header → returns 402 with payment instructions.
 */
export function createX402Middleware(config: X402ServerConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const paymentHeader = req.headers['x-payment'] as string | undefined;

    if (!paymentHeader) {
      const resource = req.originalUrl || req.url;
      send402(res, config, resource);
      return;
    }

    // Validate header size
    if (paymentHeader.length > 10000) {
      res.status(400).json({ error: 'Payment header too large' });
      return;
    }

    let payload: any;
    try {
      payload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
    } catch (err) {
      console.error('[x402] Payment parsing error:', err);
      res.status(400).json({ error: 'Invalid payment payload — could not decode' });
      return;
    }

    // Determine payment mode and verify
    let verifiedPayer: string | null;

    if ('txSignature' in payload) {
      // New: real on-chain USDC transfer
      verifiedPayer = await verifyPaymentTransaction(payload as X402TxPayload, config);
    } else if ('signature' in payload && 'paymentOption' in payload) {
      // Legacy: Ed25519 signature only (for MCP/programmatic clients)
      verifiedPayer = verifyPaymentSignature(payload as X402SignaturePayload, config);
    } else {
      res.status(400).json({ error: 'Invalid payment payload format' });
      return;
    }

    if (!verifiedPayer) {
      res.status(402).json({ error: 'Payment verification failed. Invalid transaction or stale payment.' });
      return;
    }

    // Track payment stats
    const endpoint = req.baseUrl + req.path;
    stats.totalPayments++;
    stats.totalRevenue += config.priceUsd;
    if (!stats.byEndpoint[endpoint]) {
      stats.byEndpoint[endpoint] = { count: 0, revenue: 0 };
    }
    stats.byEndpoint[endpoint].count++;
    stats.byEndpoint[endpoint].revenue += config.priceUsd;

    console.log(`[x402] Payment verified: ${endpoint} from ${verifiedPayer} — $${config.priceUsd}`);

    // Attach cryptographically verified payer identity
    req.wallet = verifiedPayer;

    next();
  };
}
