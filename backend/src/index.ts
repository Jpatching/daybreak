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
import { requireAuth } from './middleware/auth';
import { createX402Middleware, getX402Stats, type X402ServerConfig } from './services/x402';

// Import db to trigger SQLite init + admin seeding on startup
import './services/db';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Trust Nginx reverse proxy (required for express-rate-limit + X-Forwarded-For)
app.set('trust proxy', 1);

// Parse JSON bodies (needed for POST /auth/verify)
app.use(express.json());

// CORS — allow Vercel frontend and local dev
app.use(cors({
  origin: [
    'https://daybreakscan.com',
    'https://www.daybreakscan.com',
    /\.vercel\.app$/,
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

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Daybreak API running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/v1/health`);
  console.log(`x402 paid endpoints: /api/v1/paid/deployer/:token, /api/v1/paid/wallet/:wallet`);
  console.log(`x402 stats: http://localhost:${PORT}/api/v1/x402/stats`);
});
