# Daybreak — Solana Migration Assessment CLI

## What Is Daybreak?

Daybreak is a Rust CLI tool that helps project teams plan and execute their migration to Solana. It analyses tokens and contracts on other chains (primarily EVM) and generates a comprehensive migration report — what the equivalent Solana architecture looks like, what steps are needed, estimated costs, and a step-by-step Sunrise (Wormhole NTT) integration guide.

Daybreak does NOT perform the migration. It PLANS it. Think of it as a migration architect's assistant.

## Hackathon Context

- **Hackathon:** Solana Graveyard Hackathon (Feb 12–27, 2026)
- **Track:** Migrations / Sunrise ($7,000 prize pool — $3K / $2.5K / $1.5K)
- **Sponsor:** Sunrise (by Wormhole Labs) — Solana's canonical asset gateway
- **Theme:** Resurrect "dead" categories. Migration tooling is overlooked — everyone builds bridges, nobody builds planning tools.
- **Submission requirements:** Working demo/prototype, 3-min video walkthrough, GitHub repo with source code, built on Solana

## What Sunrise Is

Sunrise is Wormhole Labs' "day-one listing platform" for Solana. It provides a canonical route for external assets to enter Solana with immediate liquidity via Wormhole's Native Token Transfers (NTT) framework. Key points:

- Uses Wormhole NTT (Native Token Transfers) — no wrapped tokens
- Tokens arrive on Solana natively via NTT, immediately tradeable on Jupiter etc.
- Supports ERC-20 tokens from EVM chains and SPL tokens
- Two modes: "locking" (lock on source, mint on Solana) and "burning" (burn on source, mint on Solana)
- The sponsor track specifically asks for: "migration tooling, bridges, or onboarding guides using Sunrise"

## Core Features (MVP for hackathon)

### 1. Token Analysis (`daybreak analyze`)
- Input: EVM contract address + chain (or token symbol)
- Fetch token metadata via public RPC/API: name, symbol, decimals, total supply, holder count
- Identify token standard (ERC-20, ERC-20 Burnable, etc.)
- Check if token already exists on Solana (via known bridge mappings)

### 2. Migration Report (`daybreak report`)
- Generate a structured migration plan:
  - **Token mapping:** ERC-20 properties → SPL Token equivalent (decimals handling, mint authority)
  - **NTT mode recommendation:** Locking vs Burning based on token properties
  - **Decimal trimming analysis:** Flag if decimals > 8 (NTT trims to 8 max)
  - **Rate limiting suggestions:** Based on token supply and expected volume
  - **Solana account structure:** What PDAs, ATAs, and accounts are needed
  - **Cost estimate:** Approximate SOL needed for deployment (rent, transactions)
  - **Step-by-step Sunrise integration guide:** Exact commands and config for NTT deployment

### 3. Compatibility Check (`daybreak check`)
- Verify if a token is compatible with Sunrise/NTT migration
- Flag potential issues: non-standard ERC-20, rebasing tokens, fee-on-transfer, pausable
- Output: compatible / compatible with caveats / incompatible (with reasons)

### 4. Report Output
- Clean terminal output (coloured, structured)
- Optional markdown file export (`--output report.md`)
- Optional JSON export for programmatic use (`--format json`)

## Tech Stack

- **Language:** Rust
- **CLI framework:** `clap` (argument parsing)
- **HTTP client:** `reqwest` (for RPC calls and API fetches)
- **JSON:** `serde` / `serde_json`
- **EVM interaction:** Direct JSON-RPC calls (no ethers-rs needed for read-only)
- **Solana interaction:** `solana-sdk` / `solana-client` for Solana-side checks
- **Output formatting:** `colored` crate for terminal, custom markdown generator
- **Async runtime:** `tokio`

## Architecture

```
daybreak/
├── Cargo.toml
├── src/
│   ├── main.rs              # CLI entry point (clap)
│   ├── cli.rs               # CLI argument definitions
│   ├── analyzer/
│   │   ├── mod.rs
│   │   ├── evm.rs           # EVM token analysis (JSON-RPC calls)
│   │   ├── solana.rs        # Solana-side checks (token exists? etc.)
│   │   └── compatibility.rs # NTT compatibility checks
│   ├── report/
│   │   ├── mod.rs
│   │   ├── migration_plan.rs # Generate migration steps
│   │   ├── ntt_config.rs     # NTT-specific configuration generation
│   │   └── cost_estimate.rs  # SOL cost estimation
│   ├── output/
│   │   ├── mod.rs
│   │   ├── terminal.rs      # Coloured terminal output
│   │   ├── markdown.rs      # Markdown report generation
│   │   └── json.rs          # JSON export
│   └── types.rs             # Shared types and structs
├── README.md
└── examples/
    └── sample_report.md     # Example output
```

## What Makes This Unique

1. **Nobody has built this** — migration tools are all bridges/UIs, not planning/assessment CLIs
2. **Developer-first** — Rust CLI, not another web app
3. **Sunrise-native** — generates NTT-specific config, not generic bridge advice
4. **Practical** — solves a real pain point for any team considering Solana migration
5. **Graveyard theme** — literally helps projects "rise from the grave" of other chains

## Key Technical Details

### EVM JSON-RPC Calls Needed
```
eth_call — read token name(), symbol(), decimals(), totalSupply()
eth_getCode — verify contract exists
eth_call — check for burn function (ERC-20 Burnable detection)
eth_call — check for pause function (pausable detection)
eth_call — check for fee-on-transfer patterns
```

### Wormhole NTT Integration Points
- NTT supports ERC-20 and SPL tokens
- Decimal trimming: amounts capped at 8 decimals (TRIMMED_DECIMALS)
- Two modes: Hub-and-spoke (locking) vs Burn-and-mint
- Rate limiting per chain configurable
- NTT CLI: `ntt init`, `ntt add-chain`, `ntt deploy`
- The report should generate a `deployment.json` skeleton for NTT CLI

### Solana-Side Checks
- Check if token mint already exists (via known registries)
- Estimate rent costs for: token mint, NTT manager PDA, token accounts
- Check for existing Wormhole attestations

## Demo Flow (for 3-min video)

1. "I have an ERC-20 token on Ethereum that I want to bring to Solana"
2. Run `daybreak analyze 0x...` — shows token details
3. Run `daybreak check 0x...` — shows compatibility status
4. Run `daybreak report 0x... --output migration.md` — generates full migration plan
5. Open the markdown report — walk through the sections
6. "Daybreak told me exactly what I need to do. Now I just follow the Sunrise/NTT steps."

## Important Constraints

- Must be buildable in ~12 days (Feb 14–27)
- Solo developer (J)
- Focus on EVM → Solana migration path (most common use case)
- Use public/free RPC endpoints (Ethereum, Solana)
- Keep dependencies minimal — this should compile fast
- The tool should work offline for report generation once token data is fetched
