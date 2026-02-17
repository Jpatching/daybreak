import { Request, Response, NextFunction } from 'express';

// x402 Payment Protocol — Solana USDC server middleware
// Spec: https://www.x402.org/
// Facilitator: https://x402.coinbase.com

const COINBASE_FACILITATOR_URL = 'https://x402.coinbase.com';
const USDC_DECIMALS = 6;

export interface X402ServerConfig {
  payToWallet: string;
  network: 'solana' | 'solana-devnet';
  facilitatorUrl?: string;
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

async function verifyWithFacilitator(payload: any, facilitatorUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return false;
    const result = await response.json() as { valid?: boolean; settled?: boolean };
    return result.valid === true && (result.settled === true || result.settled === undefined);
  } catch (err) {
    console.error('[x402] Facilitator verification error:', err);
    return false;
  }
}

/**
 * x402 middleware for paid endpoints (agents/bots, no JWT required).
 * If X-PAYMENT header present → verify with Coinbase facilitator → allow.
 * Otherwise → 402 with USDC payment instructions.
 */
export function createX402Middleware(config: X402ServerConfig) {
  const facilitatorUrl = config.facilitatorUrl || COINBASE_FACILITATOR_URL;

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

    try {
      const payload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());

      const verified = await verifyWithFacilitator(payload, facilitatorUrl);
      if (!verified) {
        res.status(402).json({ error: 'Payment verification failed. Please try again.' });
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

      console.log(`[x402] Payment received: ${endpoint} from ${payload.payer || 'unknown'} — $${config.priceUsd}`);

      // Attach payer info for downstream usage tracking
      req.wallet = payload.payer || 'x402-anonymous';

      next();
    } catch (err) {
      console.error('[x402] Payment parsing error:', err);
      res.status(400).json({ error: 'Invalid payment payload' });
    }
  };
}
