import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { isValidSolanaAddress } from '../utils/validate';
import { renderTwitterCard, renderHistoryCard, renderThesisCard } from '../services/reportcard';
import { saveReportCard, getReportCard, getRecentCards, getStats } from '../services/db';

const router = Router();
const CARDS_DIR = path.resolve(__dirname, '../../data/cards');

const BOT_API_KEY = process.env.BOT_API_KEY;

/** Bot key check (same pattern as index.ts) */
function checkBotKey(req: Request, res: Response): boolean {
  if (!BOT_API_KEY) {
    res.status(503).json({ error: 'Bot API key not configured' });
    return false;
  }
  const key = req.headers['x-bot-key'] as string | undefined;
  if (!key || key !== BOT_API_KEY) {
    res.status(401).json({ error: 'Invalid or missing X-Bot-Key header' });
    return false;
  }
  return true;
}

/** Ensure card directory exists for a token */
function ensureCardDir(tokenAddress: string): string {
  const dir = path.join(CARDS_DIR, tokenAddress);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * GET /:token/twitter.png — serve cached Twitter card PNG
 * Public, no auth needed.
 */
router.get('/:token/twitter.png', (req: Request, res: Response) => {
  const token = req.params.token as string;
  if (!isValidSolanaAddress(token)) {
    res.status(400).json({ error: 'Invalid Solana address' });
    return;
  }

  const record = getReportCard(token, 'twitter');
  if (!record || !fs.existsSync(record.image_path)) {
    res.status(404).json({ error: 'Report card not generated yet. Use POST /api/v1/bot/report/:token to generate.' });
    return;
  }

  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.resolve(record.image_path));
});

/**
 * GET /:token/history.png — serve cached history card PNG
 * Public, no auth needed.
 */
router.get('/:token/history.png', (req: Request, res: Response) => {
  const token = req.params.token as string;
  if (!isValidSolanaAddress(token)) {
    res.status(400).json({ error: 'Invalid Solana address' });
    return;
  }

  const record = getReportCard(token, 'history');
  if (!record || !fs.existsSync(record.image_path)) {
    res.status(404).json({ error: 'History card not generated yet. Use POST /api/v1/bot/report/:token to generate.' });
    return;
  }

  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.resolve(record.image_path));
});

/**
 * GET /:token/thesis.png — serve cached thesis card PNG
 * Public, no auth needed.
 */
router.get('/:token/thesis.png', (req: Request, res: Response) => {
  const token = req.params.token as string;
  if (!isValidSolanaAddress(token)) {
    res.status(400).json({ error: 'Invalid Solana address' });
    return;
  }

  const record = getReportCard(token, 'thesis');
  if (!record || !fs.existsSync(record.image_path)) {
    res.status(404).json({ error: 'Thesis card not generated yet. Use POST /api/v1/report/bot/:token to generate.' });
    return;
  }

  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.resolve(record.image_path));
});

/**
 * GET /:token — return JSON metadata about generated cards
 * Public, no auth needed.
 */
router.get('/:token', (req: Request, res: Response) => {
  const token = req.params.token as string;
  if (!isValidSolanaAddress(token)) {
    res.status(400).json({ error: 'Invalid Solana address' });
    return;
  }

  const twitter = getReportCard(token, 'twitter');
  const history = getReportCard(token, 'history');
  const thesis = getReportCard(token, 'thesis');

  if (!twitter && !history && !thesis) {
    res.status(404).json({ error: 'No report cards generated for this token.' });
    return;
  }

  res.json({
    token_address: token,
    verdict: twitter?.verdict || history?.verdict || null,
    score: twitter?.score ?? history?.score ?? null,
    cards: {
      twitter: twitter ? {
        url: `/api/v1/report/${token}/twitter.png`,
        generated_at: twitter.generated_at,
      } : null,
      history: history ? {
        url: `/api/v1/report/${token}/history.png`,
        generated_at: history.generated_at,
      } : null,
      thesis: thesis ? {
        url: `/api/v1/report/${token}/thesis.png`,
        generated_at: thesis.generated_at,
      } : null,
    },
  });
});

/**
 * POST /bot/:token — generate report cards (bot-key auth)
 * Triggers: scan token → render both cards → save to disk + DB → return metadata.
 */
router.post('/bot/:token', async (req: Request, res: Response) => {
  if (!checkBotKey(req, res)) return;

  const token = req.params.token as string;
  if (!isValidSolanaAddress(token)) {
    res.status(400).json({ error: 'Invalid Solana address' });
    return;
  }

  try {
    // Call the bot deployer endpoint internally to get scan data
    const botUrl = `http://localhost:${process.env.PORT || 3001}/api/v1/bot/deployer/${token}`;
    const scanRes = await fetch(botUrl, {
      headers: { 'X-Bot-Key': BOT_API_KEY! },
    });

    if (!scanRes.ok) {
      const err = await scanRes.json().catch(() => ({ error: 'Scan failed' }));
      res.status(scanRes.status).json(err);
      return;
    }

    const scan = await scanRes.json() as import('../types').DeployerScan;

    // Get scan stats for thesis card
    const stats = getStats();

    // Render all 3 cards in parallel
    const [twitterBuf, historyBuf, thesisBuf] = await Promise.all([
      renderTwitterCard(scan),
      renderHistoryCard(scan),
      renderThesisCard(stats.total_scans),
    ]);

    // Save to disk
    const cardDir = ensureCardDir(token);
    const twitterPath = path.join(cardDir, 'twitter.png');
    const historyPath = path.join(cardDir, 'history.png');
    const thesisPath = path.join(cardDir, 'thesis.png');
    fs.writeFileSync(twitterPath, twitterBuf);
    fs.writeFileSync(historyPath, historyBuf);
    fs.writeFileSync(thesisPath, thesisBuf);

    // Save to DB
    saveReportCard(token, 'twitter', twitterPath, scan.verdict, scan.deployer.reputation_score);
    saveReportCard(token, 'history', historyPath, scan.verdict, scan.deployer.reputation_score);
    saveReportCard(token, 'thesis', thesisPath, scan.verdict, scan.deployer.reputation_score);

    console.log(`[reportcard] Generated 3 cards for ${token} (${scan.verdict}, score=${scan.deployer.reputation_score})`);

    res.json({
      token_address: token,
      verdict: scan.verdict,
      score: scan.deployer.reputation_score,
      cards: {
        twitter: {
          url: `/api/v1/report/${token}/twitter.png`,
          generated_at: new Date().toISOString(),
          size_bytes: twitterBuf.length,
        },
        history: {
          url: `/api/v1/report/${token}/history.png`,
          generated_at: new Date().toISOString(),
          size_bytes: historyBuf.length,
        },
        thesis: {
          url: `/api/v1/report/${token}/thesis.png`,
          generated_at: new Date().toISOString(),
          size_bytes: thesisBuf.length,
        },
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[reportcard] Generation error:', message);
    res.status(500).json({ error: 'Report card generation failed', detail: message });
  }
});

/**
 * GET /recent — list recently generated cards
 * Public, no auth needed.
 */
router.get('/', (_req: Request, res: Response) => {
  const cards = getRecentCards(20);
  res.json({ cards });
});

export default router;
