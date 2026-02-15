# Hackathon Next Steps — Winning Strategy

## Submission Requirements (Feb 27)
- [ ] Working demo/prototype
- [ ] 3-minute video walkthrough
- [ ] GitHub repo with source code
- [ ] Built on Solana

## Track Strategy
- **Primary:** Sunrise track ($3K / $2.5K / $1.5K)
- **Secondary:** Overall track ($15K / $10K / $5K) — infrastructure tools win here

## What Judges Look For
1. Functionality — does it work?
2. Potential Impact — does it solve an ecosystem problem?
3. Novelty — is it genuinely new?
4. Design/UX — is it polished?
5. Composability — can others build on it?

## Differentiation Points (use in video + tweets)
- "First-ever migration planning CLI"
- "Discovers migration candidates automatically"
- "NTT deployment configs generated in seconds"
- "Real bytecode analysis, not just metadata"
- "Actually deploys SPL tokens on Solana"

## Demo Video Script (3 minutes)
- 0:00-0:20 — Hook: "EVM projects want Solana speed. Migration is confusing."
- 0:20-0:40 — Problem: Manual NTT docs, config files, bytecode analysis
- 0:40-2:20 — Live demo:
  - `daybreak scan` on ONDO (risk analysis in seconds)
  - `daybreak compare` (NTT vs Neon vs native)
  - `daybreak deploy` (SPL token created on devnet LIVE)
  - Show generated report.md and deployment.json
- 2:20-2:40 — Impact: "Every migration = more Solana TVL"
- 2:40-3:00 — Close: "Daybreak makes Sunrise accessible. Try it."

## Twitter Strategy
### Launch Tweet (after first push)
"Built Daybreak for @solaboragraveyard — a CLI that analyzes any ERC-20 token and tells you exactly how to migrate it to @solana via @WormholeCrypto NTT.

Risk scoring. Compatibility checks. Deployment configs.

One command: `daybreak scan 0x...`

Thread below:"

### Thread
1. "The problem: 1000s of ERC-20 tokens could be on Solana but aren't. The NTT docs are 50 pages. Nobody has built the planning layer."
2. "daybreak scan — Analyzes bytecode, detects proxy patterns, checks bridge status. Risk score 0-100 in seconds." [screenshot]
3. "daybreak list — Discovers migration candidates at scale. ONDO, AAVE, UNI — all ready for Solana." [screenshot]
4. "daybreak deploy — Actually creates the SPL token on Solana devnet." [screenshot]
5. "daybreak report — Generates deployment.json + ntt-commands.sh. Copy-paste ready." [screenshot]
6. "Built in Rust. Zero dependencies on ethers-rs. Raw JSON-RPC. Fast.

GitHub: [link]
Built for @solaboragraveyard Sunrise track"

### Tags to use
@solana @WormholeCrypto @JupiterExchange
#GraveyardHack #Solana #Sunrise #NTT

### When to tweet
- After first push (today)
- After demo video (1 week before deadline)
- On submission day

## High-Impact Features to Add (if time)
1. **`daybreak wizard`** — Interactive step-by-step migration walkthrough
2. **PDF export** — Professional migration reports as PDFs
3. **More tokens in list** — Expand from 18 to 50+ curated tokens
4. **Live Solana RPC checks** — Query token existence, rent costs from Solana mainnet
5. **Token metadata** — Create Metaplex metadata for deployed SPL tokens
6. **Rate limit calculator** — Suggest NTT rate limits based on token volume

## Testing Checklist (before submission)
- [ ] Test scan on 10+ different tokens (different decimals, proxy types, chains)
- [ ] Test deploy on devnet with fresh keypair
- [ ] Test report generation and verify all sections present
- [ ] Test compare output formatting
- [ ] Test list with --limit and --json flags
- [ ] Test --rpc-url override with custom RPC
- [ ] Verify demo.gif plays correctly on GitHub
- [ ] Run cargo test, cargo clippy, cargo fmt --check
