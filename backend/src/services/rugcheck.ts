import { TTLCache } from './cache';
import type { RugCheckResult, RugCheckRisk } from '../types';

const RUGCHECK_API = 'https://api.rugcheck.xyz/v1';

// Cache reports for 30 minutes (risk data doesn't change frequently)
const reportCache = new TTLCache<RugCheckResult>(1800);

/**
 * Get RugCheck token risk report.
 * Free API — key optional (works without it for basic endpoints).
 * Returns risk level, score, LP lock status, and risk flags.
 */
export async function getTokenReport(mint: string): Promise<RugCheckResult | null> {
  const cached = reportCache.get(mint);
  if (cached) return cached;

  try {
    const res = await fetch(`${RUGCHECK_API}/tokens/${mint}/report/summary`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data: any = await res.json();
    if (!data) return null;

    // Parse risks array
    const risks: RugCheckRisk[] = (data.risks || []).map((r: any) => ({
      name: r.name || 'Unknown',
      level: r.level || 'unknown',
      description: r.description || '',
      score: r.score || 0,
    }));

    // Determine LP lock status from risks and markets
    let lpLocked = false;
    let lpLockPct = 0;

    // Check markets for LP lock info
    const markets = data.markets || [];
    for (const market of markets) {
      const lp = market.lp || {};
      if (lp.lpLockedPct !== undefined && lp.lpLockedPct > 0) {
        lpLocked = true;
        lpLockPct = Math.max(lpLockPct, lp.lpLockedPct);
      }
    }

    // Also check risks for LP-related flags
    if (!lpLocked) {
      const lpRisk = risks.find(r =>
        r.name.toLowerCase().includes('lp') &&
        r.name.toLowerCase().includes('lock')
      );
      if (lpRisk && lpRisk.level === 'good') {
        lpLocked = true;
      }
    }

    // Map RugCheck score: they use 0 = good, higher = worse
    // Normalize: their "score" field is the total risk score
    const riskScore = typeof data.score === 'number' ? data.score : null;

    // Risk level mapping
    let riskLevel: string | null = null;
    if (data.score !== undefined) {
      if (data.score <= 300) riskLevel = 'Good';
      else if (data.score <= 700) riskLevel = 'Warning';
      else riskLevel = 'Danger';
    }
    // If RugCheck provides their own level, prefer it
    if (data.riskLevel) riskLevel = data.riskLevel;
    if (data.tokenMeta?.riskLevel) riskLevel = data.tokenMeta.riskLevel;

    const result: RugCheckResult = {
      risk_level: riskLevel,
      risk_score: riskScore,
      risks,
      lp_locked: lpLocked,
      lp_lock_pct: Math.round(lpLockPct * 100) / 100,
    };

    reportCache.set(mint, result);
    return result;
  } catch {
    return null;
  }
}
