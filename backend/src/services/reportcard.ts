import puppeteer, { type Browser } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import type { DeployerScan } from '../types';

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

// Singleton browser instance — reused across renders
let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  return browser;
}

/** Replace all {{PLACEHOLDER}} tokens in an HTML template string */
function applyReplacements(html: string, replacements: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/** Core render function — shared by both card types */
async function renderTemplate(
  templatePath: string,
  replacements: Record<string, string>,
  viewport: { width: number; height: number },
): Promise<Buffer> {
  const templateHtml = fs.readFileSync(templatePath, 'utf-8');
  const html = applyReplacements(templateHtml, replacements);

  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load' });

    const screenshot = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: viewport.width, height: viewport.height },
    });

    return Buffer.from(screenshot);
  } finally {
    await page.close();
  }
}

/** Color class based on thresholds */
function colorClass(value: number, dangerThreshold: number, warnThreshold: number, invert = false): string {
  if (invert) {
    // Higher is better (e.g. score)
    if (value < dangerThreshold) return 'danger';
    if (value < warnThreshold) return 'warn';
    return 'safe';
  }
  // Higher is worse (e.g. rug rate, dead count)
  if (value > dangerThreshold) return 'danger';
  if (value > warnThreshold) return 'warn';
  return 'safe';
}

/** Truncate address for display: first6...last4 */
function truncAddr(addr: string | null): string {
  if (!addr) return 'Unknown';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** Format date for display */
function formatDate(iso: string | null): string {
  if (!iso) return 'Unknown';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return 'Unknown';
  }
}

/** Render a Twitter summary card (1200x675) from a DeployerScan */
export async function renderTwitterCard(scan: DeployerScan): Promise<Buffer> {
  const rugPct = Math.round(scan.deployer.rug_rate * 100);
  const verdictClass = scan.verdict === 'SERIAL_RUGGER' ? 'serial-rugger'
    : scan.verdict === 'SUSPICIOUS' ? 'suspicious'
    : 'clean';

  const clusterInfo = scan.funding.other_deployers_funded > 0
    ? `${scan.funding.other_deployers_funded} linked deployers`
    : 'No cluster detected';

  const replacements: Record<string, string> = {
    VERDICT_CLASS: verdictClass,
    VERDICT_TEXT: scan.verdict.replace('_', ' '),
    TOKEN_NAME: scan.token.name,
    TOKEN_SYMBOL: scan.token.symbol,
    DEPLOYER_ADDR: truncAddr(scan.deployer.wallet),
    FIRST_SEEN: formatDate(scan.deployer.first_seen),
    FUNDER_ADDR: truncAddr(scan.funding.source_wallet),
    TOKENS_CREATED: String(scan.deployer.tokens_created),
    TOKENS_DEAD: String(scan.deployer.tokens_dead + (scan.deployer.tokens_assumed_dead || 0)),
    RUG_RATE: `${rugPct}%`,
    REPUTATION_SCORE: String(scan.deployer.reputation_score),
    STAT_COLOR_DEAD: colorClass(scan.deployer.tokens_dead, 10, 3, false),
    STAT_COLOR_RUG: colorClass(rugPct, 70, 30, false),
    STAT_COLOR_SCORE: colorClass(scan.deployer.reputation_score, 30, 60, true),
    SCAN_DATE: formatDate(scan.scanned_at),
    CLUSTER_INFO: clusterInfo,
  };

  return renderTemplate(
    path.join(TEMPLATES_DIR, 'twitter-card.html'),
    replacements,
    { width: 1200, height: 675 },
  );
}

/** Render a deployer history card (1200x auto-height, min 675) */
export async function renderHistoryCard(scan: DeployerScan): Promise<Buffer> {
  const tokens = scan.deployer.tokens.slice(0, 20); // Cap at 20

  const tokenGridHtml = tokens.map(t => {
    const statusClass = t.alive ? 'alive' : 'dead';
    const statusText = t.alive ? 'Active' : 'Dead';
    return `<div class="token-entry ${statusClass}">
      <div class="token-entry-name">${escapeHtml(t.name)}</div>
      <div class="token-entry-symbol">$${escapeHtml(t.symbol)}</div>
      <div class="token-entry-status ${statusClass}">${statusText}</div>
    </div>`;
  }).join('\n    ');

  const totalShown = tokens.length;
  const totalAll = scan.deployer.tokens_created;
  const summaryText = totalAll > 20
    ? `Showing ${totalShown} of ${totalAll} tokens | ${scan.deployer.tokens_dead} dead | Score: ${scan.deployer.reputation_score}/100`
    : `${totalAll} tokens | ${scan.deployer.tokens_dead} dead | Score: ${scan.deployer.reputation_score}/100`;

  const replacements: Record<string, string> = {
    HISTORY_TITLE: `${scan.token.name} ($${scan.token.symbol}) Deployer`,
    TOKEN_GRID: tokenGridHtml,
    SUMMARY_TEXT: summaryText,
  };

  // Calculate height based on token count: 4 per row, ~80px per row + header/footer
  const rows = Math.ceil(tokens.length / 4);
  const height = Math.max(675, 220 + rows * 92);

  return renderTemplate(
    path.join(TEMPLATES_DIR, 'history-card.html'),
    replacements,
    { width: 1200, height },
  );
}

/** Close the shared browser instance (for graceful shutdown) */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/** Escape HTML special chars to prevent injection in templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
