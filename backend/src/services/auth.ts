import jwt from 'jsonwebtoken';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { TTLCache } from './cache';
import { getUsage, incrementUsage as dbIncrement, isAdmin } from './db';

const nonceCache = new TTLCache<string>(300); // 5min TTL for nonces

const MAX_SCANS_PER_DAY = 3;

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

/** Check if a wallet has remaining rate limit (persisted in SQLite) */
export function checkRateLimit(wallet: string): boolean {
  if (isAdmin(wallet)) return true;
  const usage = getUsage(wallet);
  return usage.scansToday < MAX_SCANS_PER_DAY;
}

/** Check if a wallet has unlimited access */
export function isUnlimited(wallet: string): boolean {
  return isAdmin(wallet);
}

/** Increment scan usage for a wallet (persisted in SQLite) */
export function incrementUsage(wallet: string): void {
  dbIncrement(wallet);
}

/** Get remaining scans for a wallet */
export function getRemainingScans(wallet: string): number {
  if (isAdmin(wallet)) return 999;
  const usage = getUsage(wallet);
  return Math.max(0, MAX_SCANS_PER_DAY - usage.scansToday);
}

/** Get current usage count for a wallet */
export function getUsageCount(wallet: string): number {
  return getUsage(wallet).scansToday;
}

/** The max scans per day constant */
export const SCANS_LIMIT = MAX_SCANS_PER_DAY;
