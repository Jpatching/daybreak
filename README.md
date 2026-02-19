# DaybreakScan

**Solana deployer reputation scanner — check any token creator's rug rate, wallet history, funding clusters, and risk score before you trade.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-9945FF?style=flat&logo=solana&logoColor=white)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![API](https://img.shields.io/badge/API-daybreakscan.com-green)](https://www.daybreakscan.com)

**[daybreakscan.com](https://www.daybreakscan.com)** — Live scanner, API docs, and report cards

---

## What is DaybreakScan?

DaybreakScan analyzes Solana token deployers to surface their full on-chain history. Before you buy into a new token on Pump.fun or Raydium, you can instantly check whether the deployer has rugged before, how they fund new wallets, and what their historical rug rate looks like.

**The problem:** Most Solana token scanners check the *token* — mint authority, liquidity lock, holder distribution. DaybreakScan checks the *deployer*. A clean token from a serial rugger is still a rug waiting to happen.

**How it works:**

1. **Find deployer** — Traces any token back to the wallet that created it (Pump.fun, Raydium, etc.)
2. **Scan full history** — Finds every other token this deployer has ever launched
3. **Check liveness** — Queries DexScreener for liquidity on each token (alive vs dead)
4. **Detect risks** — Checks mint/freeze authority, bundle detection, top holder concentration, deployer holdings
5. **Score reputation** — Bayesian scoring from 0–100 based on rug rate, velocity, cluster size, token lifespan
6. **Trace funding** — Identifies who funded the deployer and maps linked deployer networks
7. **Return verdict** — `CLEAN` (70+), `SUSPICIOUS` (30–70), `SERIAL_RUGGER` (<30)

---

## Features

- **Deployer reputation score** — Bayesian 0–100 score based on historical behavior, rug rate, and wallet patterns
- **Rug rate analysis** — Percentage of past tokens that were abandoned, rugged, or never gained liquidity
- **Funding cluster detection** — Maps wallets funding the deployer to identify sybil and coordinated launch networks
- **Token risk signals** — Mint/freeze authority status, bundled launches, top holder concentration, deployer holdings
- **Full deploy history** — Every token ever launched from a wallet, with live/dead status and lifespan
- **Pump.fun tracking** — Native support for Pump.fun deployer detection and bonding curve analysis
- **Report cards** — Auto-generated PNG report cards for sharing scan results on social media
- **MCP server** — Stdio JSON-RPC server with `daybreak_scan_deployer` and `daybreak_scan_wallet` tools for AI agent integration
- **x402 payments** — USDC payment-gated API access for high-volume usage beyond the free tier
- **Free daily scans** — 3 free scans per day with wallet authentication, no credit card required

---

## Quick Start

### Web Interface

Visit **[daybreakscan.com](https://www.daybreakscan.com)**, connect your Solana wallet (Phantom or Solflare), and paste any token address or deployer wallet.

### API

All scan endpoints require wallet authentication (Ed25519 signature → JWT).

```bash
# Health check (public)
curl https://api.daybreakscan.com/api/v1/health

# Get auth nonce
curl "https://api.daybreakscan.com/api/v1/auth/nonce?wallet=YOUR_WALLET"

# Verify signature → get JWT
curl -X POST https://api.daybreakscan.com/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"wallet":"...","signature":"...","message":"..."}'

# Scan token deployer (requires Bearer token)
curl -H "Authorization: Bearer YOUR_JWT" \
  https://api.daybreakscan.com/api/v1/deployer/TOKEN_ADDRESS

# Scan wallet directly
curl -H "Authorization: Bearer YOUR_JWT" \
  https://api.daybreakscan.com/api/v1/wallet/WALLET_ADDRESS
```

Bot integrations can use `X-Bot-Key` header authentication for unlimited scans.

Full API documentation: **[daybreakscan.com/docs](https://www.daybreakscan.com/docs)**

---

## Example Output

```
Token:    ShadyToken (SHADY)
Deployer: Dk9f...3xYp
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Risk Score:      8/100  SERIAL_RUGGER
Rug Rate:        157/194 tokens dead (80.9%)
Deploy Velocity: 5.2 tokens/day
Avg Hold Time:   3.1 hours before sell
Funding Source:  Cluster of 12 linked deployers

Token Risks:
  Mint authority:   Revoked
  Freeze authority: Revoked
  Bundle detected:  Yes (3 buys in same slot)
  Top holder:       62.4%
  Deployer holds:   0%

Recent tokens:
  PEPE2     — Dead (dev sold 100% at $12K MC)
  MOONDOG   — Dead (LP pulled after 6h)
  SOLCAT    — Active (currently live)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This deployer has rugged 80.9% of past launches.
Proceed with extreme caution.
```

---

## Reputation Scoring

DaybreakScan uses Bayesian scoring with a prior based on the Pump.fun base death rate. The final score combines multiple weighted components with risk penalties:

| Component | Weight | Description |
|---|---|---|
| Rug rate | 40% | Bayesian-adjusted death rate across all deployed tokens |
| Token count | 20% | Logarithmic penalty — more tokens from one wallet = higher risk |
| Avg lifespan | 20% | How long tokens survive before liquidity disappears |
| Cluster size | 20% | Number of linked deployers sharing the same funding source |

### Risk Penalties

Additional deductions applied on top of the base score:

| Signal | Penalty | Description |
|---|---|---|
| Mint authority active | -10 | Deployer can mint unlimited tokens |
| Freeze authority active | -5 | Deployer can freeze holder accounts |
| Deployer holdings >50% | -10 | Deployer still holds majority supply |
| Deploy velocity >5/day | -10 | Rapid-fire token launches |
| Bundle detected | -5 | Coordinated buys in the same slot as launch |
| Top holder >80% | -5 | Single wallet holds most of supply |

### Verdicts

- **`CLEAN`** — Score 70+, rug rate ≤ 30%
- **`SUSPICIOUS`** — Score 30–70, rug rate 30–70%
- **`SERIAL_RUGGER`** — Score < 30, rug rate > 70%

---

## Use Cases

- **Traders** — Research any token's creator before buying on Pump.fun, Raydium, or PumpSwap
- **AI agents** — Integrate deployer reputation checks into automated trading via MCP server or REST API
- **Trading bots** — Add rug detection to Telegram, Discord, or Twitter bots using the bot API
- **Researchers** — Analyze deployer behavior patterns and funding networks across the Solana ecosystem
- **DAOs & protocols** — Screen token launches for deployer credibility before listings or partnerships

---

## MCP Server (AI Agent Integration)

DaybreakScan includes a standalone MCP server for integration with Claude Code, Cursor, Windsurf, and any MCP-compatible AI agent:

```json
{
  "mcpServers": {
    "daybreak": {
      "command": "node",
      "args": ["path/to/dist/mcp-server.js"]
    }
  }
}
```

**Available tools:**
- `daybreak_scan_deployer` — Scan a token address and return the deployer's full reputation report
- `daybreak_scan_wallet` — Scan a wallet address directly for deploy history and reputation

---

## Project Structure

```
├── backend/              # TypeScript API (Express + Node)
│   └── src/
│       ├── index.ts              # Express app, CORS, rate limiting, routes
│       ├── routes/               # health, auth, deployer, wallet, reportcard
│       ├── services/
│       │   ├── helius.ts         # Solana RPC + Helius Enhanced API
│       │   ├── reputation.ts     # Bayesian scoring algorithm
│       │   ├── dexscreener.ts    # Token liveness + liquidity checks
│       │   ├── db.ts             # SQLite persistence (WAL mode)
│       │   ├── cache.ts          # TTLCache (metadata, DexScreener, mint authority)
│       │   ├── auth.ts           # JWT + Ed25519 nonce verification
│       │   └── x402.ts           # USDC payment middleware
│       ├── middleware/           # requireAuth, requireBotKey, x402Middleware
│       ├── types.ts              # DeployerScan, TokenRisks, Verdict interfaces
│       └── mcp-server.ts         # Standalone stdio JSON-RPC MCP server
├── web/                  # React frontend (Next.js 15 + Tailwind)
│   ├── app/                      # App Router pages (scan, blog, docs, profile)
│   ├── components/               # Scanner, WalletProvider, SunriseShader
│   ├── content/blog/             # MDX blog posts
│   ├── hooks/                    # useAuth
│   └── lib/                      # API client
└── .env.example          # Required environment variables
```

## Tech Stack

- **Backend:** Express, TypeScript, Helius Enhanced API, DexScreener API, SQLite (better-sqlite3)
- **Frontend:** React 18, Next.js 15 (App Router), Tailwind CSS, Solana Wallet Adapter
- **Auth:** Ed25519 wallet signature verification (tweetnacl), JWT, per-wallet rate limiting
- **Payments:** x402 protocol (USDC on Solana)
- **AI Integration:** MCP server (stdio JSON-RPC), bot API key auth
- **Data:** Helius RPC + Enhanced Transactions API, DexScreener liquidity data

## Development

```bash
# Backend
cd backend && npm install
cp ../.env.example ../.env  # Add HELIUS_API_KEY, JWT_SECRET, etc.
npm run dev                 # ts-node dev server on port 3001
npm test                    # Vitest test suite

# Frontend
cd web && npm install
npm run dev                 # Next.js dev server
```

See `.env.example` for all required environment variables.

---

## Supported Platforms

| Platform | Status |
|---|---|
| Pump.fun | Live |
| PumpSwap | Coming soon |
| Raydium | Coming soon |
| Meteora | Coming soon |

---

## License

[MIT](LICENSE)

---

*DaybreakScan is an independent research tool. Not financial advice. Always DYOR.*
