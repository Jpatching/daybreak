import puppeteer, { type Browser } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import type { DeployerScan } from '../types';

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');
const FONTS_DIR = path.resolve(TEMPLATES_DIR, 'fonts');

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

/** Core render function — shared by all card types */
async function renderTemplate(
  templatePath: string,
  replacements: Record<string, string>,
  viewport: { width: number; height: number },
): Promise<Buffer> {
  const templateHtml = fs.readFileSync(templatePath, 'utf-8');
  // Always inject fonts directory path
  replacements.FONTS_DIR = `file://${FONTS_DIR}`;
  const html = applyReplacements(templateHtml, replacements);

  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load' });
    // Wait for fonts to load
    await page.evaluate('document.fonts.ready');

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
    if (value < dangerThreshold) return 'danger';
    if (value < warnThreshold) return 'warn';
    return 'safe';
  }
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

/** Format date as "MMM YYYY" */
function formatMonthYear(iso: string | null): string {
  if (!iso) return 'Unknown';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  } catch {
    return 'Unknown';
  }
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

/** Format liquidity as $X,XXX or $X.XK or $X.XM */
function formatLiquidity(liq: number): string {
  if (liq >= 1e6) return `$${(liq / 1e6).toFixed(1)}M`;
  if (liq >= 1e3) return `$${(liq / 1e3).toFixed(0)}K`;
  if (liq > 0) return `$${Math.round(liq).toLocaleString()}`;
  return '$0';
}

/** Render a Twitter summary card (1200x675) from a DeployerScan */
export async function renderTwitterCard(scan: DeployerScan): Promise<Buffer> {
  const deathRate = scan.deployer.death_rate ?? scan.deployer.rug_rate;
  const deathPct = Math.round(deathRate * 100);
  const verdictClass = scan.verdict === 'SERIAL_RUGGER' ? 'serial-rugger'
    : scan.verdict === 'SUSPICIOUS' ? 'suspicious'
    : 'clean';

  // Top bar gradient: red proportional to death rate, teal for remainder
  const redPct = Math.round(deathRate * 100);
  const topBarGradient = `linear-gradient(90deg, #E63946 0%, #E63946 ${redPct}%, #2A9D8F ${redPct}%, #2A9D8F 100%)`;

  const deployerLine = `Deployer: ${truncAddr(scan.deployer.wallet)} — Active since ${formatMonthYear(scan.deployer.first_seen)} — Funded by ${truncAddr(scan.funding.source_wallet)}`;

  const burnerBadge = scan.deployer.deployer_is_burner
    ? '<span class="burner-badge">BURNER WALLET</span>'
    : '';

  const unverifiedNote = scan.deployer.tokens_unverified > 0
    ? ` · ${scan.deployer.tokens_unverified} unverified`
    : '';

  const clusterInfo = scan.funding.other_deployers_funded > 0
    ? `${scan.funding.other_deployers_funded} linked deployers`
    : 'No cluster detected';

  const footerLeft = `Scanned ${formatDate(scan.scanned_at)} — ${scan.deployer.tokens_dead} dead${unverifiedNote} — ${clusterInfo}`;

  const replacements: Record<string, string> = {
    VERDICT_CLASS: verdictClass,
    VERDICT_TEXT: scan.verdict.replace('_', ' '),
    TOKEN_NAME: escapeHtml(scan.token.name),
    TOKEN_SYMBOL: escapeHtml(scan.token.symbol),
    DEPLOYER_LINE: deployerLine,
    BURNER_BADGE: burnerBadge,
    TOKENS_CREATED: String(scan.deployer.tokens_created),
    TOKENS_DEAD: String(scan.deployer.tokens_dead),
    DEATH_RATE: `${deathPct}%`,
    TRUST_SCORE: `${scan.deployer.reputation_score}/100`,
    STAT_COLOR_DEAD: colorClass(scan.deployer.tokens_dead, 10, 3, false),
    STAT_COLOR_RATE: colorClass(deathPct, 70, 30, false),
    STAT_COLOR_SCORE: colorClass(scan.deployer.reputation_score, 30, 60, true),
    FOOTER_LEFT: footerLeft,
    TOP_BAR_GRADIENT: topBarGradient,
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
    const statusIcon = t.alive ? '●' : '✕';
    const statusText = t.alive ? 'Alive' : 'Dead';
    return `<div class="token ${statusClass}">
      <div class="token-name">${escapeHtml(t.name)}</div>
      <div class="token-symbol">${escapeHtml(t.symbol)}</div>
      <div class="token-status ${statusClass}">${statusIcon} ${statusText}</div>
      <div class="token-liq">${formatLiquidity(t.liquidity)}</div>
    </div>`;
  }).join('\n    ');

  const aliveCount = tokens.filter(t => t.alive).length;
  const deadTokenCount = tokens.filter(t => !t.alive).length;
  const summaryText = `${aliveCount} survived. <em>${deadTokenCount} didn't.</em>`;

  const historyTitle = `Deployer's Token History — ${scan.deployer.tokens_created} tokens since ${formatMonthYear(scan.deployer.first_seen)}`;

  const replacements: Record<string, string> = {
    HISTORY_TITLE: historyTitle,
    TOKEN_GRID: tokenGridHtml,
    SUMMARY_TEXT: summaryText,
  };

  // Calculate height based on token count: 5 per row, ~100px per row + header/footer
  const rows = Math.ceil(tokens.length / 5);
  const height = Math.max(675, 200 + rows * 100);

  return renderTemplate(
    path.join(TEMPLATES_DIR, 'history-card.html'),
    replacements,
    { width: 1200, height },
  );
}

/** Render a thesis/brand card (1200x675) */
export async function renderThesisCard(totalScans: number): Promise<Buffer> {
  const replacements: Record<string, string> = {
    TOTAL_SCANS: totalScans > 0 ? totalScans.toLocaleString() : '0',
  };

  return renderTemplate(
    path.join(TEMPLATES_DIR, 'thesis-card.html'),
    replacements,
    { width: 1200, height: 675 },
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
