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

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

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

// Protected routes — require wallet auth
app.use('/api/v1/deployer', requireAuth, deployerRouter);
app.use('/api/v1/wallet', requireAuth, walletRouter);

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Daybreak API running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/v1/health`);
});
