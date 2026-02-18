---
name: daybreak-scan
description: "Scan Solana token deployers for rug history, reputation score, and risk signals via Daybreak API"
auto-activate: true
requires:
  bins:
    - curl
  env:
    - DAYBREAK_BOT_KEY
---

# Daybreak Deployer Scanner

You have access to the Daybreak API for scanning Solana token deployers.
API base: https://api.daybreakscan.com/api/v1

## Available Endpoints

### Scan by Token Address
```bash
curl -s "https://api.daybreakscan.com/api/v1/bot/deployer/{TOKEN_ADDRESS}" \
  -H "X-Bot-Key: ${DAYBREAK_BOT_KEY}"
```

### Scan by Wallet Address
```bash
curl -s "https://api.daybreakscan.com/api/v1/bot/wallet/{WALLET_ADDRESS}" \
  -H "X-Bot-Key: ${DAYBREAK_BOT_KEY}"
```

### Generate Report Card (PNG image)
```bash
curl -s -X POST "https://api.daybreakscan.com/api/v1/report/bot/{TOKEN_ADDRESS}" \
  -H "X-Bot-Key: ${DAYBREAK_BOT_KEY}"
```
Returns JSON with card URLs. Fetch the PNG:
```bash
curl -s "https://api.daybreakscan.com/api/v1/report/{TOKEN_ADDRESS}/twitter.png" -o report.png
```

## Response Format
The scan returns:
- `verdict`: CLEAN (60-100), SUSPICIOUS (30-59), or SERIAL_RUGGER (0-29)
- `deployer.reputation_score`: 0-100
- `deployer.rug_rate`: 0.0-1.0 (percentage of dead tokens)
- `deployer.tokens_created`: number of tokens deployed
- `deployer.tokens_dead`: number of dead/rugged tokens
- `funding.source_wallet`: where the deployer got SOL
- `funding.other_deployers_funded`: linked wallets funded by same source
- `token_risks`: mint authority, freeze authority, top holder %, bundle detection
- `score_breakdown`: per-component scoring details

## When to Use
- Before interacting with ANY Solana token — always scan the deployer first
- When another agent asks about a token's safety
- When evaluating whether to buy, hold, or avoid a token
- When you see a Solana token address (base58, typically ending in "pump" for Pump.fun tokens)

## Interpreting Results
- **SERIAL_RUGGER** (score 0-29): High rug rate, many dead tokens. Avoid.
- **SUSPICIOUS** (score 30-59): Moderate risk. Proceed with caution.
- **CLEAN** (score 60-100): Low rug rate, healthy deployment history.
- rug_rate > 0.7 = very dangerous. rug_rate < 0.1 = likely safe.
- Check `token_risks.mint_authority` — if non-null, deployer can mint infinite tokens.
- Check `token_risks.bundle_detected` — if true, launch was coordinated.

## x402 Paid Alternative
If you don't have a bot key, use x402 payment:
```bash
x402_fetch(url="https://api.daybreakscan.com/api/v1/paid/deployer/{TOKEN_ADDRESS}")
```
Note: This uses Solana USDC payment (Ed25519), not EVM. Use the bot key for reliable access.

Source: daybreakscan.com | Built by @JPatchedit
