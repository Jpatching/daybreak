import dotenv from 'dotenv';
import path from 'path';

// Load .env from repo root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import healthRouter from './routes/health';
import authRouter from './routes/auth';
import deployerRouter from './routes/deployer';
import walletRouter from './routes/wallet';
import reportcardRouter from './routes/reportcard';
import { requireAuth, guestRateLimit } from './middleware/auth';
import { createX402Middleware, getX402Stats, type X402ServerConfig } from './services/x402';
import { closeBrowser } from './services/reportcard';
import { startPumpPortal, stopPumpPortal, getRecentNewTokens, getRecentMigrations, getPumpPortalStatus } from './services/pumpportal';

// Import db to trigger SQLite init + admin seeding on startup
import { getStats } from './services/db';

export const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Bot API key middleware — bypasses JWT auth + rate limits for trusted bots
const BOT_API_KEY = process.env.BOT_API_KEY;
const requireBotKey: express.RequestHandler = (req, res, next) => {
  if (!BOT_API_KEY) {
    res.status(503).json({ error: 'Bot API key not configured' });
    return;
  }
  const key = req.headers['x-bot-key'] as string | undefined;
  if (!key || key !== BOT_API_KEY) {
    res.status(401).json({ error: 'Invalid or missing X-Bot-Key header' });
    return;
  }
  next();
};

// Trust Nginx reverse proxy (required for express-rate-limit + X-Forwarded-For)
app.set('trust proxy', 1);

// Parse JSON bodies (needed for POST /auth/verify)
app.use(express.json());

// CORS — allow Vercel frontend and local dev
app.use(cors({
  origin: [
    'https://daybreakscan.com',
    'https://www.daybreakscan.com',
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
    'http://localhost:3000',
    'http://localhost:5173',
  ],
  methods: ['GET', 'POST'],
}));

// Rate limiting: 30 req/min per IP
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a minute.' },
}));

// Public routes
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/report', reportcardRouter);

// Guest tier: IP-based rate limit, no auth (1 scan/day)
app.use('/api/v1/guest/deployer', guestRateLimit, deployerRouter);
app.use('/api/v1/guest/wallet', guestRateLimit, walletRouter);

// Public stats endpoint (social proof)
app.get('/api/v1/stats', (_req, res) => {
  const stats = getStats();
  res.json(stats);
});

// Free tier: wallet auth + rate limit (frontend users)
app.use('/api/v1/deployer', requireAuth, deployerRouter);
app.use('/api/v1/wallet', requireAuth, walletRouter);

// x402 paid tier config
const x402Config: X402ServerConfig = {
  payToWallet: process.env.TREASURY_WALLET || '5rSwWRfqGvnQaiJpW3sb3YKLbxtjVxgc4yrvrHNeNwE2',
  network: (process.env.X402_NETWORK as 'solana' | 'solana-devnet') || 'solana',
  priceUsd: parseFloat(process.env.X402_PRICE_USD || '0.01'),
  description: 'Daybreak deployer scan',
};

const x402Middleware = createX402Middleware(x402Config);

// Bot tier: API key auth, no rate limits (trusted bots only)
app.use('/api/v1/bot/deployer', requireBotKey, deployerRouter);
app.use('/api/v1/bot/wallet', requireBotKey, walletRouter);

// Paid tier: x402 paywall (agents/bots, no JWT needed)
app.use('/api/v1/paid/deployer', x402Middleware, deployerRouter);
app.use('/api/v1/paid/wallet', x402Middleware, walletRouter);

// x402 payment stats (public)
app.get('/api/v1/x402/stats', (_req, res) => {
  const stats = getX402Stats();
  res.json({
    ...stats,
    config: {
      price_usd: x402Config.priceUsd,
      network: x402Config.network,
      treasury: x402Config.payToWallet,
    },
  });
});

// PumpPortal live data (public, from WebSocket feed)
app.get('/api/v1/live/new-tokens', (_req, res) => {
  const limit = Math.min(parseInt((_req.query as any).limit || '50', 10), 100);
  res.json({ tokens: getRecentNewTokens(limit) });
});

app.get('/api/v1/live/migrations', (_req, res) => {
  const limit = Math.min(parseInt((_req.query as any).limit || '50', 10), 100);
  res.json({ migrations: getRecentMigrations(limit) });
});

app.get('/api/v1/live/status', (_req, res) => {
  res.json(getPumpPortalStatus());
});

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Only start listening when run directly (not imported for testing)
if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    // Start PumpPortal WebSocket for real-time data
    startPumpPortal();

    console.log(`Daybreak API running on port ${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/v1/health`);
    console.log(`Guest endpoints: /api/v1/guest/deployer/:token, /api/v1/guest/wallet/:wallet`);
    console.log(`Stats: http://localhost:${PORT}/api/v1/stats`);
    console.log(`Live: /api/v1/live/new-tokens, /api/v1/live/migrations, /api/v1/live/status`);
    console.log(`Bot endpoints: /api/v1/bot/deployer/:token, /api/v1/bot/wallet/:wallet`);
    console.log(`Report cards: /api/v1/report/:token, POST /api/v1/report/bot/:token`);
    console.log(`x402 paid endpoints: /api/v1/paid/deployer/:token, /api/v1/paid/wallet/:wallet`);
    console.log(`x402 stats: http://localhost:${PORT}/api/v1/x402/stats`);
  });

  // Graceful shutdown: close Puppeteer browser
  const shutdown = async () => {
    console.log('\nShutting down...');
    stopPumpPortal();
    await closeBrowser();
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
