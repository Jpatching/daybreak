import { Request, Response, NextFunction } from 'express';
import { verifyToken, checkRateLimit, incrementUsage, getRemainingScans, getUsageCount, SCANS_LIMIT } from '../services/auth';

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
    const remaining = getRemainingScans(wallet);
    res.status(429).json({
      error: 'Rate limit exceeded. Max 10 scans per hour.',
      remaining,
      retry_after: '1 hour',
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
