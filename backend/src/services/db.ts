import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'daybreak.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS wallet_usage (
    wallet TEXT PRIMARY KEY,
    scans_today INTEGER NOT NULL DEFAULT 0,
    last_reset TEXT NOT NULL DEFAULT (date('now')),
    total_scans INTEGER NOT NULL DEFAULT 0,
    is_admin INTEGER NOT NULL DEFAULT 0
  )
`);

// Seed admin wallets from env (comma-separated) with hardcoded fallback
const DEFAULT_ADMIN_WALLETS = [
  '5rSwWRfqGvnQaiJpW3sb3YKLbxtjVxgc4yrvrHNeNwE2',
  'DW2DQdED8ABpG98YCxf2UBgeJiw3ZaELJND1UsNEXkWq',
];
const ADMIN_WALLETS = process.env.ADMIN_WALLETS
  ? process.env.ADMIN_WALLETS.split(',').map(w => w.trim()).filter(Boolean)
  : DEFAULT_ADMIN_WALLETS;

const upsertAdmin = db.prepare(`
  INSERT INTO wallet_usage (wallet, scans_today, last_reset, total_scans, is_admin)
  VALUES (?, 0, date('now'), 0, 1)
  ON CONFLICT(wallet) DO UPDATE SET is_admin = 1
`);
for (const wallet of ADMIN_WALLETS) {
  upsertAdmin.run(wallet);
}

// Prepared statements
const getUsageStmt = db.prepare(`
  SELECT scans_today, total_scans, is_admin, last_reset FROM wallet_usage WHERE wallet = ?
`);

const upsertUsageStmt = db.prepare(`
  INSERT INTO wallet_usage (wallet, scans_today, last_reset, total_scans, is_admin)
  VALUES (?, 1, date('now'), 1, 0)
  ON CONFLICT(wallet) DO UPDATE SET
    scans_today = scans_today + 1,
    total_scans = total_scans + 1
`);

const resetDailyStmt = db.prepare(`
  UPDATE wallet_usage SET scans_today = 0, last_reset = date('now')
  WHERE last_reset < date('now')
`);

const checkAdminStmt = db.prepare(`
  SELECT is_admin FROM wallet_usage WHERE wallet = ?
`);

const setAdminStmt = db.prepare(`
  INSERT INTO wallet_usage (wallet, scans_today, last_reset, total_scans, is_admin)
  VALUES (?, 0, date('now'), 0, ?)
  ON CONFLICT(wallet) DO UPDATE SET is_admin = ?
`);

// Guest usage table (IP-based rate limiting for unauthenticated scans)
db.exec(`
  CREATE TABLE IF NOT EXISTS guest_usage (
    ip TEXT PRIMARY KEY,
    scans_today INTEGER NOT NULL DEFAULT 0,
    last_reset TEXT NOT NULL DEFAULT (date('now')),
    total_scans INTEGER NOT NULL DEFAULT 0
  )
`);

// Scan log table (powers social proof stats + per-wallet history)
db.exec(`
  CREATE TABLE IF NOT EXISTS scan_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_address TEXT NOT NULL,
    verdict TEXT,
    score INTEGER,
    scanned_at TEXT NOT NULL DEFAULT (datetime('now')),
    source TEXT NOT NULL DEFAULT 'auth',
    wallet TEXT
  )
`);

// Migration: add wallet column if missing
try {
  db.exec(`ALTER TABLE scan_log ADD COLUMN wallet TEXT`);
} catch {
  // column already exists
}

// Guest usage prepared statements
const getGuestUsageStmt = db.prepare(`
  SELECT scans_today, total_scans, last_reset FROM guest_usage WHERE ip = ?
`);

const upsertGuestUsageStmt = db.prepare(`
  INSERT INTO guest_usage (ip, scans_today, last_reset, total_scans)
  VALUES (?, 1, date('now'), 1)
  ON CONFLICT(ip) DO UPDATE SET
    scans_today = scans_today + 1,
    total_scans = total_scans + 1
`);

const resetGuestDailyStmt = db.prepare(`
  UPDATE guest_usage SET scans_today = 0, last_reset = date('now')
  WHERE ip = ? AND last_reset < date('now')
`);

const incrementGuestTransaction = db.transaction((ip: string) => {
  resetGuestDailyStmt.run(ip);
  upsertGuestUsageStmt.run(ip);
});

// Scan log prepared statements
const insertScanLogStmt = db.prepare(`
  INSERT INTO scan_log (token_address, verdict, score, source, wallet) VALUES (?, ?, ?, ?, ?)
`);

const getStatsStmt = db.prepare(`
  SELECT
    COUNT(*) as total_scans,
    COUNT(DISTINCT token_address) as total_tokens,
    SUM(CASE WHEN verdict = 'CLEAN' THEN 1 ELSE 0 END) as clean,
    SUM(CASE WHEN verdict = 'SUSPICIOUS' THEN 1 ELSE 0 END) as suspicious,
    SUM(CASE WHEN verdict = 'SERIAL_RUGGER' THEN 1 ELSE 0 END) as serial_rugger
  FROM scan_log
`);

export interface GuestUsage {
  scansToday: number;
  totalScans: number;
  lastReset: string;
}

export function getGuestUsage(ip: string): GuestUsage {
  const row = getGuestUsageStmt.get(ip) as any;
  if (!row) {
    return { scansToday: 0, totalScans: 0, lastReset: new Date().toISOString().slice(0, 10) };
  }
  // Auto-reset if last_reset is before today
  if (row.last_reset < new Date().toISOString().slice(0, 10)) {
    return { scansToday: 0, totalScans: row.total_scans, lastReset: row.last_reset };
  }
  return { scansToday: row.scans_today, totalScans: row.total_scans, lastReset: row.last_reset };
}

export function checkGuestRateLimit(ip: string): boolean {
  const usage = getGuestUsage(ip);
  return usage.scansToday < 1; // 1 free guest scan per day
}

export function incrementGuestUsage(ip: string): void {
  incrementGuestTransaction(ip);
}

export function logScan(tokenAddress: string, verdict: string | null, score: number | null, source: string = 'auth', wallet: string | null = null): void {
  insertScanLogStmt.run(tokenAddress, verdict, score, source, wallet);
}

// Wallet scan history
const getWalletHistoryStmt = db.prepare(`
  SELECT s.token_address, s.verdict, s.score, s.scanned_at,
         d.token_name, d.token_symbol
  FROM scan_log s
  LEFT JOIN deployer_cache d ON s.token_address = d.token_address
  WHERE s.wallet = ?
  GROUP BY s.token_address
  ORDER BY MAX(s.id) DESC
  LIMIT ?
`);

export function getWalletHistory(wallet: string, limit: number = 10): RecentScan[] {
  return getWalletHistoryStmt.all(wallet, limit) as RecentScan[];
}

export interface ScanStats {
  total_scans: number;
  total_tokens: number;
  verdicts: { CLEAN: number; SUSPICIOUS: number; SERIAL_RUGGER: number };
}

export function getStats(): ScanStats {
  const row = getStatsStmt.get() as any;
  return {
    total_scans: row.total_scans || 0,
    total_tokens: row.total_tokens || 0,
    verdicts: {
      CLEAN: row.clean || 0,
      SUSPICIOUS: row.suspicious || 0,
      SERIAL_RUGGER: row.serial_rugger || 0,
    },
  };
}

// Recent scans (for social proof feed)
const getRecentScansStmt = db.prepare(`
  SELECT s.token_address, s.verdict, s.score, s.scanned_at,
         d.token_name, d.token_symbol
  FROM scan_log s
  LEFT JOIN deployer_cache d ON s.token_address = d.token_address
  WHERE s.verdict IS NOT NULL
  GROUP BY s.token_address
  ORDER BY MAX(s.id) DESC
  LIMIT ?
`);

export interface RecentScan {
  token_address: string;
  verdict: string;
  score: number;
  scanned_at: string;
  token_name: string | null;
  token_symbol: string | null;
}

export function getRecentScans(limit: number = 5): RecentScan[] {
  return getRecentScansStmt.all(limit) as RecentScan[];
}

// Deployer cache table — caches token lists per deployer wallet
db.exec(`
  CREATE TABLE IF NOT EXISTS deployer_cache (
    deployer_wallet TEXT NOT NULL,
    token_address TEXT NOT NULL,
    token_name TEXT,
    token_symbol TEXT,
    created_at TEXT,
    alive INTEGER DEFAULT -1,
    liquidity REAL DEFAULT 0,
    last_checked TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (deployer_wallet, token_address)
  )
`);

const getCachedDeployerTokensStmt = db.prepare(`
  SELECT token_address, token_name, token_symbol, created_at, alive, liquidity, last_checked
  FROM deployer_cache WHERE deployer_wallet = ?
`);

const upsertDeployerTokenStmt = db.prepare(`
  INSERT INTO deployer_cache (deployer_wallet, token_address, token_name, token_symbol, created_at, alive, liquidity, last_checked)
  VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  ON CONFLICT(deployer_wallet, token_address) DO UPDATE SET
    token_name = excluded.token_name,
    token_symbol = excluded.token_symbol,
    created_at = COALESCE(excluded.created_at, deployer_cache.created_at),
    alive = excluded.alive,
    liquidity = excluded.liquidity,
    last_checked = datetime('now')
`);

const getStaleAliveTokensStmt = db.prepare(`
  SELECT token_address FROM deployer_cache
  WHERE deployer_wallet = ? AND alive = 1
  AND last_checked < datetime('now', '-' || ? || ' hours')
`);

const markTokenDeadStmt = db.prepare(`
  UPDATE deployer_cache SET alive = 0, liquidity = 0, last_checked = datetime('now')
  WHERE token_address = ?
`);

export interface CachedDeployerToken {
  token_address: string;
  token_name: string | null;
  token_symbol: string | null;
  created_at: string | null;
  alive: number; // 0=dead, 1=alive, -1=unverified
  liquidity: number;
  last_checked: string;
}

export function getCachedDeployerTokens(wallet: string): CachedDeployerToken[] {
  return getCachedDeployerTokensStmt.all(wallet) as CachedDeployerToken[];
}

const upsertDeployerTokensTransaction = db.transaction(
  (wallet: string, tokens: Array<{ address: string; name?: string; symbol?: string; created_at?: string | null; alive: number; liquidity: number }>) => {
    for (const t of tokens) {
      upsertDeployerTokenStmt.run(wallet, t.address, t.name || null, t.symbol || null, t.created_at || null, t.alive, t.liquidity);
    }
  }
);

export function upsertDeployerTokens(
  wallet: string,
  tokens: Array<{ address: string; name?: string; symbol?: string; created_at?: string | null; alive: number; liquidity: number }>
): void {
  upsertDeployerTokensTransaction(wallet, tokens);
}

export function getStaleAliveTokens(wallet: string, maxAgeHours: number = 6): string[] {
  const rows = getStaleAliveTokensStmt.all(wallet, maxAgeHours) as Array<{ token_address: string }>;
  return rows.map(r => r.token_address);
}

export function markTokenDead(address: string): void {
  markTokenDeadStmt.run(address);
}

// Report cards table
db.exec(`
  CREATE TABLE IF NOT EXISTS report_cards (
    token_address TEXT NOT NULL,
    card_type     TEXT NOT NULL,
    image_path    TEXT NOT NULL,
    verdict       TEXT,
    score         INTEGER,
    generated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (token_address, card_type)
  )
`);

const saveReportCardStmt = db.prepare(`
  INSERT INTO report_cards (token_address, card_type, image_path, verdict, score, generated_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'))
  ON CONFLICT(token_address, card_type) DO UPDATE SET
    image_path = excluded.image_path,
    verdict = excluded.verdict,
    score = excluded.score,
    generated_at = datetime('now')
`);

const getReportCardStmt = db.prepare(`
  SELECT token_address, card_type, image_path, verdict, score, generated_at
  FROM report_cards WHERE token_address = ? AND card_type = ?
`);

const getRecentCardsStmt = db.prepare(`
  SELECT token_address, card_type, image_path, verdict, score, generated_at
  FROM report_cards ORDER BY generated_at DESC LIMIT ?
`);

export interface ReportCardRow {
  token_address: string;
  card_type: string;
  image_path: string;
  verdict: string | null;
  score: number | null;
  generated_at: string;
}

export function saveReportCard(token: string, type: string, imagePath: string, verdict: string | null, score: number | null): void {
  saveReportCardStmt.run(token, type, imagePath, verdict, score);
}

export function getReportCard(token: string, type: string): ReportCardRow | null {
  return (getReportCardStmt.get(token, type) as ReportCardRow) || null;
}

export function getRecentCards(limit: number = 20): ReportCardRow[] {
  return getRecentCardsStmt.all(limit) as ReportCardRow[];
}

// Public API

export interface WalletUsage {
  scansToday: number;
  totalScans: number;
  isAdmin: boolean;
  lastReset: string;
}

export function getUsage(wallet: string): WalletUsage {
  const row = getUsageStmt.get(wallet) as any;
  if (!row) {
    return { scansToday: 0, totalScans: 0, isAdmin: false, lastReset: new Date().toISOString().slice(0, 10) };
  }
  return {
    scansToday: row.scans_today,
    totalScans: row.total_scans,
    isAdmin: row.is_admin === 1,
    lastReset: row.last_reset,
  };
}

const resetWalletStmt = db.prepare(`
  UPDATE wallet_usage SET scans_today = 0, last_reset = date('now') WHERE wallet = ? AND last_reset < date('now')
`);

const incrementTransaction = db.transaction((wallet: string) => {
  resetWalletStmt.run(wallet);
  upsertUsageStmt.run(wallet);
});

export function incrementUsage(wallet: string): void {
  incrementTransaction(wallet);
}

export function resetDailyUsage(): void {
  const info = resetDailyStmt.run();
  if (info.changes > 0) {
    console.log(`[db] Reset daily usage for ${info.changes} wallets`);
  }
}

export function isAdmin(wallet: string): boolean {
  const row = checkAdminStmt.get(wallet) as any;
  return row?.is_admin === 1;
}

export function setAdmin(wallet: string, flag: boolean): void {
  const val = flag ? 1 : 0;
  setAdminStmt.run(wallet, val, val);
}

// Run daily reset on startup
resetDailyUsage();

// Reset daily usage every hour
setInterval(() => resetDailyUsage(), 60 * 60 * 1000).unref();

console.log(`[db] SQLite initialized at ${DB_PATH}`);
