import { Request, Response, NextFunction } from 'express';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { createHash } from 'crypto';

// x402 Payment Protocol — Solana USDC server middleware
// Self-verified Ed25519 signatures (no external facilitator needed)
// Spec inspiration: https://www.x402.org/

const USDC_DECIMALS = 6;
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

interface X402PaymentPayload {
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
 * Verify x402 payment payload by checking Ed25519 signature server-side.
 * 1. Reconstruct the canonical message from the payment option fields
 * 2. SHA-256 hash it
 * 3. Verify Ed25519 signature against the claimed payer's public key
 * 4. Check timestamp freshness and payment option matches our config
 *
 * Returns the verified payer public key (base58) or null if invalid.
 */
function verifyPaymentSignature(payload: X402PaymentPayload, config: X402ServerConfig): string | null {
  try {
    const { paymentOption, signature, payer, nonce, timestamp } = payload;

    // Validate required fields
    if (!paymentOption || !signature || !payer || !nonce || !timestamp) {
      console.error('[x402] Missing required fields in payment payload');
      return null;
    }

    // Check timestamp freshness (reject stale payments)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > MAX_PAYMENT_AGE_SECONDS) {
      console.error(`[x402] Payment timestamp too old/future: ${timestamp} vs ${now}`);
      return null;
    }

    // Verify payment option matches our config
    if (paymentOption.payTo !== config.payToWallet) {
      console.error(`[x402] payTo mismatch: ${paymentOption.payTo} !== ${config.payToWallet}`);
      return null;
    }

    const expectedAmount = usdToLamports(config.priceUsd);
    if (BigInt(paymentOption.maxAmountRequired) < BigInt(expectedAmount)) {
      console.error(`[x402] Amount too low: ${paymentOption.maxAmountRequired} < ${expectedAmount}`);
      return null;
    }

    // Reconstruct the canonical message (must match client-side construction)
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

    // SHA-256 hash of the message
    const messageBytes = new TextEncoder().encode(message);
    const messageHash = createHash('sha256').update(messageBytes).digest();

    // Decode payer public key and signature from base58
    let publicKeyBytes: Uint8Array;
    let signatureBytes: Uint8Array;
    try {
      publicKeyBytes = bs58.decode(payer);
      signatureBytes = bs58.decode(signature);
    } catch {
      console.error('[x402] Failed to decode base58 payer/signature');
      return null;
    }

    if (publicKeyBytes.length !== 32) {
      console.error(`[x402] Invalid public key length: ${publicKeyBytes.length}`);
      return null;
    }

    if (signatureBytes.length !== 64) {
      console.error(`[x402] Invalid signature length: ${signatureBytes.length}`);
      return null;
    }

    // Verify Ed25519 signature
    const valid = nacl.sign.detached.verify(
      new Uint8Array(messageHash),
      signatureBytes,
      publicKeyBytes,
    );

    if (!valid) {
      console.error('[x402] Ed25519 signature verification failed');
      return null;
    }

    // Signature verified — return the proven payer identity
    return payer;
  } catch (err) {
    console.error('[x402] Signature verification error:', err);
    return null;
  }
}

/**
 * x402 middleware for paid endpoints (agents/bots, no JWT required).
 * If X-PAYMENT header present → verify Ed25519 signature server-side → allow.
 * Otherwise → 402 with USDC payment instructions.
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

    let payload: X402PaymentPayload;
    try {
      payload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
    } catch (err) {
      console.error('[x402] Payment parsing error:', err);
      res.status(400).json({ error: 'Invalid payment payload — could not decode' });
      return;
    }

    // Verify Ed25519 signature server-side (proves wallet ownership)
    const verifiedPayer = verifyPaymentSignature(payload, config);
    if (!verifiedPayer) {
      res.status(402).json({ error: 'Payment verification failed. Invalid signature or stale payment.' });
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
