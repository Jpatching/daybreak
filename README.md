# Daybreak

**Solana deployer reputation engine. Check any token's deployer before you ape.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Solana](https://img.shields.io/badge/Solana-9945FF?style=flat&logo=solana&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)

Daybreak scans any Solana token address and analyzes the deployer's on-chain history. It calculates a reputation score based on rug rate, token count, lifespan, and funding cluster — then returns a verdict: **CLEAN**, **SUSPICIOUS**, or **SERIAL_RUGGER**.

## Live

- **Web UI** — [daybreakscan.com](https://daybreakscan.com)
- **API** — `https://api.daybreakscan.com/api/v1/`

## How It Works

1. **Find deployer** — Traces the token back to the wallet that created it on Pump.fun
2. **Scan history** — Finds all other tokens this deployer has created
3. **Check liveness** — Queries DexScreener for liquidity on each token (alive vs dead)
4. **Score reputation** — Calculates 0-100 score from rug rate, token count, lifespan, cluster size
5. **Trace funding** — Finds who funded the deployer and checks for linked deployer networks
6. **Return verdict** — CLEAN (score 70+), SUSPICIOUS (30-70), SERIAL_RUGGER (<30)

## Example Output

```
Token:    ShadyToken (SHADY)
Deployer: Dk9f...3xYp
Tokens:   194 created, 157 dead (80.9% rug rate)
Score:    8/100
Verdict:  SERIAL_RUGGER
Cluster:  12 linked deployers from same funder
```

## API

All scan endpoints require wallet authentication (JWT via wallet signature).

```bash
# Health check (public)
curl https://api.daybreakscan.com/api/v1/health

# Get auth nonce
curl "https://api.daybreakscan.com/api/v1/auth/nonce?wallet=YOUR_WALLET"

# Verify signature and get JWT
curl -X POST https://api.daybreakscan.com/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"wallet":"...","signature":"...","message":"..."}'

# Scan token (requires Bearer token)
curl -H "Authorization: Bearer YOUR_JWT" \
  https://api.daybreakscan.com/api/v1/deployer/TOKEN_ADDRESS

# Scan wallet directly
curl -H "Authorization: Bearer YOUR_JWT" \
  https://api.daybreakscan.com/api/v1/wallet/WALLET_ADDRESS
```

## Reputation Scoring

| Component | Weight | Logic |
|-----------|--------|-------|
| Rug rate | 40% | (1 - rugRate) * 40 |
| Token count | 20% | Logarithmic penalty (more tokens = lower score) |
| Avg lifespan | 20% | 0.5 points per day, max 20 |
| Cluster size | 20% | 20 - min(20, clusterSize * 2) |

**Verdicts:**
- `CLEAN` — rug rate <= 30%, score 70+
- `SUSPICIOUS` — rug rate 30-70%, score 30-70
- `SERIAL_RUGGER` — rug rate > 70%, score < 30

## Project Structure

```
├── backend/          # TypeScript API (Express + Node)
│   └── src/
│       ├── index.ts              # Express app, CORS, routes
│       ├── routes/               # health, deployer, wallet, auth
│       ├── services/             # helius, dexscreener, reputation, auth, cache
│       ├── middleware/           # JWT auth + rate limiting
│       └── utils/                # address validation, sanitization
├── web/              # React frontend (Vite + Tailwind)
│   └── src/
│       ├── pages/                # LandingPage, ScannerPage
│       ├── components/           # WalletProvider, SunriseShader
│       ├── hooks/                # useAuth
│       └── api.js                # API client
└── src/              # Rust CLI (legacy EVM migration tool)
```

## Tech Stack

- **Backend:** Express, TypeScript, Helius Enhanced API, DexScreener API
- **Frontend:** React 18, Vite, Tailwind CSS, Solana Wallet Adapter
- **Auth:** Ed25519 signature verification, JWT, per-wallet rate limiting
- **Data:** Helius RPC + Enhanced API, DexScreener liquidity data

## Development

```bash
# Backend
cd backend && npm install
cp ../.env.example ../.env  # Add your HELIUS_API_KEY and JWT_SECRET
npm run dev

# Frontend
cd web && npm install
npm run dev
```

## Hackathon

Built for the **Solana Graveyard Hackathon** (Feb 2026).

## License

[MIT](LICENSE)
