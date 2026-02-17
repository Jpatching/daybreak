import { Request, Response, NextFunction } from 'express';
import { verifyToken, checkRateLimit, incrementUsage, getRemainingScans, getUsageCount, SCANS_LIMIT } from '../services/auth';
import { buildPaymentDetails, type X402ServerConfig } from '../services/x402';

// Extend Express Request to include wallet and usage info
declare global {
  namespace Express {
    interface Request {
      wallet?: string;
      scansUsed?: number;
      scansRemaining?: number;
      scansLimit?: number;
    }
  }
}

// x402 config for 402 responses (lazy-loaded from env)
function getX402Config(): X402ServerConfig {
  return {
    payToWallet: process.env.TREASURY_WALLET || '5rSwWRfqGvnQaiJpW3sb3YKLbxtjVxgc4yrvrHNeNwE2',
    network: (process.env.X402_NETWORK as 'solana' | 'solana-devnet') || 'solana',
    priceUsd: parseFloat(process.env.X402_PRICE_USD || '0.01'),
    description: 'Daybreak deployer scan',
  };
}

/** Middleware: require valid JWT + enforce per-wallet rate limit */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Connect your wallet first.' });
    return;
  }

  const token = authHeader.slice(7);
  const wallet = verifyToken(token);
  if (!wallet) {
    res.status(401).json({ error: 'Invalid or expired token. Please reconnect your wallet.' });
    return;
  }

  if (!checkRateLimit(wallet)) {
    // Return 402 with x402 payment details instead of 429
    const config = getX402Config();
    const resource = req.originalUrl || req.url;
    const details = buildPaymentDetails(config, resource);
    const detailsBase64 = Buffer.from(JSON.stringify(details)).toString('base64');

    res.status(402)
      .set('WWW-Authenticate', `X402 details="${detailsBase64}"`)
      .set('X-PAYMENT-DETAILS', detailsBase64)
      .json({
        error: 'Daily scan limit reached. 3 free scans per day.',
        payment_required: true,
        price_usd: config.priceUsd,
        paid_endpoint: `/api/v1/paid${resource.replace('/api/v1', '')}`,
        details,
      });
    return;
  }

  incrementUsage(wallet);
  req.wallet = wallet;
  req.scansUsed = getUsageCount(wallet);
  req.scansRemaining = SCANS_LIMIT - req.scansUsed;
  req.scansLimit = SCANS_LIMIT;
  next();
}
