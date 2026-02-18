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
