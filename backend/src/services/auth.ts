import jwt from 'jsonwebtoken';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { TTLCache } from './cache';

const nonceCache = new TTLCache<string>(300); // 5min TTL for nonces
const usageCache = new TTLCache<number>(86400); // 24hr window for rate limiting

const MAX_SCANS_PER_DAY = 3;

// Wallets exempt from rate limits (admin/dev wallets)
const UNLIMITED_WALLETS = new Set([
  '5rSwWRfqGvnQaiJpW3sb3YKLbxtjVxgc4yrvrHNeNwE2',
]);

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return secret;
}

/** Generate a nonce challenge for wallet authentication */
export function generateNonce(wallet: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const nonce = `Daybreak auth ${timestamp} ${random}`;
  nonceCache.set(wallet, nonce);
  return nonce;
}

/** Verify an ed25519 signature from a Solana wallet */
export function verifyWalletSignature(
  wallet: string,
  signature: string,
  message: string
): boolean {
  // Check that the message matches the nonce we issued
  const storedNonce = nonceCache.get(wallet);
  if (!storedNonce || storedNonce !== message) return false;

  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(wallet);
    const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    // Consume the nonce after verification attempt
    if (valid) nonceCache.set(wallet, ''); // invalidate
    return valid;
  } catch {
    return false;
  }
}

/** Issue a JWT for an authenticated wallet */
export function issueToken(wallet: string): string {
  return jwt.sign({ wallet }, getJwtSecret(), { expiresIn: '24h' });
}

/** Verify a JWT and return the wallet address */
export function verifyToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { wallet: string };
    return decoded.wallet || null;
  } catch {
    return null;
  }
}

/** Check if a wallet has remaining rate limit */
export function checkRateLimit(wallet: string): boolean {
  if (UNLIMITED_WALLETS.has(wallet)) return true;
  const usage = usageCache.get(wallet) || 0;
  return usage < MAX_SCANS_PER_DAY;
}

/** Check if a wallet has unlimited access */
export function isUnlimited(wallet: string): boolean {
  return UNLIMITED_WALLETS.has(wallet);
}

/** Increment scan usage for a wallet */
export function incrementUsage(wallet: string): void {
  const current = usageCache.get(wallet) || 0;
  usageCache.set(wallet, current + 1);
}

/** Get remaining scans for a wallet */
export function getRemainingScans(wallet: string): number {
  const usage = usageCache.get(wallet) || 0;
  return Math.max(0, MAX_SCANS_PER_DAY - usage);
}

/** Get current usage count for a wallet */
export function getUsageCount(wallet: string): number {
  return usageCache.get(wallet) || 0;
}

/** The max scans per hour constant */
export const SCANS_LIMIT = MAX_SCANS_PER_DAY;
