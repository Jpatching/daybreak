# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**DaybreakScan** is a Solana deployer reputation scanner. It analyzes token deployers to surface their full on-chain history — rug rate, funding clusters, token risk signals, and a Bayesian reputation score (0–100). Before you buy a Solana token, check whether the deployer has rugged before.

- **Live:** [daybreakscan.com](https://www.daybreakscan.com) (frontend) / [api.daybreakscan.com](https://api.daybreakscan.com) (API)
- **Hackathon:** Solana Graveyard Hack, deadline Feb 27, 2026
- **GitHub:** github.com/Jpatching/daybreak

## Stack

- **Backend:** TypeScript + Express.js (port 3001 on VPS)
- **Frontend:** Next.js 15 App Router + Tailwind CSS (deployed to Vercel)
- **Database:** SQLite via better-sqlite3 (`data/daybreak.db`)
- **Auth:** Ed25519 wallet signatures → JWT
- **Report cards:** Puppeteer PNG generation
- **MCP server:** Stdio JSON-RPC (`dist/mcp-server.js`)
- **Payments:** x402 USDC pay-per-scan
- **Agent:** Automaton integration with skill definition

## Commands

```bash
# Backend
cd backend && npm run build          # Compile TypeScript
cd backend && npm run dev            # Dev server (ts-node)
cd backend && npm start              # Production (node dist/index.js)
cd backend && npm test               # Run vitest tests

# Frontend
cd web && npm run dev                # Next.js dev server
cd web && npm run build              # Production build
cd web && npm start                  # Production server

# Deploy frontend to Vercel (from VPS)
cd web && npx vercel --prod --token <VERCEL_TOKEN>

# Tests
cd backend && npm test               # Backend tests (vitest)
```

## Architecture

```
daybreak/
├── backend/                         # Express.js API (TypeScript)
│   └── src/
│       ├── index.ts                 # App entry, routes, middleware
│       ├── mcp-server.ts            # MCP stdio server (2 tools)
│       ├── types.ts                 # All interfaces (DeployerScan, TokenRisks, etc.)
│       ├── middleware/
│       │   └── auth.ts              # JWT verify, guest rate limit, admin check
│       ├── routes/
│       │   ├── auth.ts              # Nonce + verify (wallet → JWT)
│       │   ├── deployer.ts          # GET /deployer/:token → full scan
│       │   ├── wallet.ts            # GET /wallet/:wallet → wallet scan
│       │   ├── health.ts            # GET /health
│       │   └── reportcard.ts        # POST/GET report card PNGs
│       ├── services/
│       │   ├── helius.ts            # Helius Enhanced API (deployer detection, tx history)
│       │   ├── reputation.ts        # Bayesian scoring engine (0–100)
│       │   ├── death-classifier.ts  # Token liveness check (DexScreener liquidity)
│       │   ├── dexscreener.ts       # DexScreener API client
│       │   ├── rpc.ts               # Multi-provider Solana RPC (Helius primary)
│       │   ├── cache.ts             # In-memory TTL cache
│       │   ├── db.ts                # SQLite persistence (usage, scans, report cards)
│       │   ├── auth.ts              # Nonce generation, JWT signing
│       │   ├── x402.ts              # USDC payment middleware
│       │   ├── reportcard.ts        # Puppeteer PNG pipeline
│       │   ├── jupiter.ts           # Jupiter price API
│       │   ├── pumpportal.ts        # PumpPortal WebSocket feed
│       │   └── rugcheck.ts          # RugCheck API fallback
│       ├── utils/
│       │   ├── sanitize.ts          # Input sanitization
│       │   └── validate.ts          # Address validation
│       └── __tests__/               # 12 test files (vitest)
│
├── web/                             # Next.js 15 frontend
│   ├── app/
│   │   ├── page.jsx                 # Landing page
│   │   ├── layout.jsx               # Root layout + wallet provider
│   │   ├── scan/page.jsx            # Scanner page
│   │   ├── scan/[address]/page.jsx  # Scan result page (SSR)
│   │   ├── profile/page.jsx         # User profile + scan history
│   │   ├── leaderboard/page.jsx     # Top scanners
│   │   ├── docs/page.jsx            # API documentation
│   │   ├── blog/page.jsx            # Blog index
│   │   ├── blog/[slug]/page.jsx     # Blog post (MDX)
│   │   ├── og/route.js              # OG image generation
│   │   ├── sitemap.js               # Dynamic sitemap
│   │   └── robots.js                # robots.txt
│   ├── components/
│   │   ├── ScannerClient.jsx        # Main scanner UI + results
│   │   ├── LandingContent.jsx       # Hero + features
│   │   ├── WalletProvider.jsx       # Solana wallet adapter
│   │   ├── ProfileClient.jsx        # Profile + history
│   │   ├── Nav.jsx                  # Navigation bar
│   │   ├── Footer.jsx               # Footer
│   │   └── SunriseShader.jsx        # Background animation
│   ├── lib/
│   │   └── api.js                   # API client (fetch wrapper)
│   ├── content/                     # MDX blog posts
│   └── styles/                      # Global CSS + Tailwind
│
├── automaton/                       # Conway Automaton agent config
│   ├── automaton.json               # Agent definition
│   ├── SOUL.md                      # Agent persona
│   └── heartbeat.yml                # Scheduled tasks (trending scans)
│
├── skills/                          # Automaton skill definitions
│   └── daybreak-scan/               # Scan skill for other agents
│
└── (legacy Rust files)              # Cargo.toml, src/, examples/ — historical
```

## API Endpoints

### Public
- `GET /api/v1/health` — health check + Helius status
- `GET /api/v1/auth/nonce?wallet=<addr>` — get auth nonce
- `POST /api/v1/auth/verify` — verify signature → JWT

### Authenticated (Bearer JWT)
- `GET /api/v1/deployer/:token_address` — full deployer reputation scan
- `GET /api/v1/wallet/:wallet_address` — direct wallet scan
- `GET /api/v1/profile` — user profile + usage
- `GET /api/v1/leaderboard` — top scanners

### Bot API (X-Bot-Key header)
- `GET /api/v1/bot/deployer/:token` — bot scan
- `GET /api/v1/bot/wallet/:wallet` — bot wallet scan
- `POST /api/v1/report/bot/:token` — generate report card

### x402 Paid
- `GET /api/v1/paid/deployer/:token` — USDC pay-per-scan
- `GET /api/v1/paid/wallet/:wallet` — USDC pay-per-scan

## Key Technical Details

**Verdicts:** CLEAN (60–100), SUSPICIOUS (30–59), SERIAL_RUGGER (0–29)

**Detection pipeline:**
1. `findDeployer()` — Helius Enhanced API, sort-order=asc, CREATE + PUMP_FUN
2. `findDeployerTokens()` — Scan deployer tx history for Pump.fun deploys
3. Death classification — DexScreener liquidity check ($100 threshold)
4. `findFundingSource()` — Oldest incoming SOL transfer
5. `analyzeCluster()` — Funder's outgoing SOL transfers → linked deployers
6. Token risks — mint/freeze authority, bundle detection, top holder %, deployer holdings
7. Reputation scoring — Bayesian 0–100 with per-component breakdown

**Pump.fun program ID:** `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`

**Free tier:** 3 scans/day per wallet, then 402 → x402 USDC payment

## Infrastructure

- **VPS:** 202.148.52.56 (user: ubuntu)
- **Nginx:** `api.daybreakscan.com` → port 3001 (Express), SSL via Let's Encrypt
- **pm2:** `daybreak-api` process on port 3001
- **Vercel:** Frontend at `www.daybreakscan.com` (manual deploy via token)
- **Node:** v25.3.0 via nvm

## Environment Variables (backend/.env)

```
HELIUS_API_KEY=          # Required — Helius Enhanced API
SOLANA_RPC_URL=          # Helius RPC endpoint
PORT=3001
JWT_SECRET=              # 64-char hex
TREASURY_WALLET=         # SOL fee destination
X402_PRICE_USD=0.01
X402_NETWORK=solana
BOT_API_KEY=             # For bot integrations
```

## Code Style

- TypeScript strict mode
- Express.js route handlers with explicit typing
- `better-sqlite3` for synchronous SQLite
- Vitest for testing
- Input validation at route level (sanitize + validate utils)
- All env vars loaded via dotenv from repo root `.env`
