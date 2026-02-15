# Daybreak

**Migration planning CLI for moving EVM tokens to Solana via [Sunrise](https://wormhole.com/products/ntt) (Wormhole NTT).**

[![CI](https://github.com/Jpatching/daybreak/actions/workflows/ci.yml/badge.svg)](https://github.com/Jpatching/daybreak/actions/workflows/ci.yml)
![Rust](https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Solana](https://img.shields.io/badge/Solana-9945FF?style=flat&logo=solana&logoColor=white)

![Daybreak Demo](demo.gif)

Daybreak analyzes any ERC-20 token on-chain — bytecode, capabilities, proxy patterns, bridge status — and tells you exactly how to migrate it to Solana using Native Token Transfers. It scores risk, recommends NTT modes, generates deployment configs, and deploys SPL tokens with metadata.

## Why NTT?

[Native Token Transfers](https://wormhole.com/products/ntt) let token issuers keep full ownership of their token on every chain. Unlike wrapped tokens, NTT gives you a native mint on Solana with the same supply controls — no middleman, no wrapped-asset risk. Sunrise is Wormhole's program for onboarding new tokens to Solana via NTT.

## Why Daybreak?

Moving an ERC-20 token to Solana means reading Wormhole docs, understanding NTT modes, checking decimal compatibility, analyzing bytecode for blockers, and manually writing deployment configs. **Daybreak does all of this in one command.**

- **Instant analysis** — Risk score, compatibility verdict, and mode recommendation in seconds
- **Zero guesswork** — Generates `deployment.json` and NTT CLI commands ready to run
- **Discovery at scale** — `list` finds 50+ migration candidates you didn't know about
- **Real deployment** — `deploy` creates SPL tokens on Solana with Metaplex metadata
- **Readiness check** — `check` verifies your tools, wallet, and config before you start

## Prerequisites

- [Rust](https://rustup.rs/) (1.70+)
- [Solana CLI](https://docs.solanalabs.com/cli/install) (for `deploy` and `check`)
- [NTT CLI](https://www.npmjs.com/package/@wormhole-foundation/ntt-cli) (optional, for bridge deployment)
- An [Etherscan API key](https://etherscan.io/apis) (optional, for holder data and rate limits)

## Quick Start

```bash
cargo install --path .

# Discover migration-ready tokens
daybreak list --limit 10

# Analyze ONDO (a strong migration candidate)
daybreak scan 0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3 --chain ethereum

# Generate migration report + deployment config
daybreak report 0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3 --chain ethereum -o ./output

# Compare migration paths (NTT vs Neon EVM vs native rewrite)
daybreak compare 0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3 --chain ethereum

# Deploy SPL token on Solana devnet (with Metaplex metadata)
daybreak deploy 0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3 --chain ethereum --network devnet

# Check migration readiness
daybreak check 0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3 --chain ethereum
```

## Full Migration Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DISCOVER    daybreak list --limit 20                     │
│    Find tokens not yet on Solana                            │
├─────────────────────────────────────────────────────────────┤
│ 2. ANALYZE     daybreak scan <ADDRESS>                      │
│    Risk score, NTT mode, compatibility verdict              │
├─────────────────────────────────────────────────────────────┤
│ 3. PLAN        daybreak report <ADDRESS> -o ./output        │
│    Migration report + deployment.json + NTT CLI commands    │
├─────────────────────────────────────────────────────────────┤
│ 4. DEPLOY      daybreak deploy <ADDRESS> --network devnet   │
│    SPL token on Solana with Metaplex metadata               │
├─────────────────────────────────────────────────────────────┤
│ 5. CHECK       daybreak check <ADDRESS>                     │
│    Verify tools, wallet, and config                         │
├─────────────────────────────────────────────────────────────┤
│ 6. BRIDGE      ntt init && ntt deploy                       │
│    Run generated NTT CLI commands to complete the bridge    │
└─────────────────────────────────────────────────────────────┘
```

## Example: ONDO Token Analysis

```
════════════════════════════════════════════════════════════
Ondo Finance (ONDO) on Ethereum
════════════════════════════════════════════════════════════
── Token Information ──
  Address:      0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3
  Decimals:     18
  Total Supply: 10000000000000000000000000000

── Capabilities ──
  Mintable           No
  Burnable           No
  Pausable           No
  Blacklist          No

── NTT Compatibility ──
  Status:     Compatible
  Mode:       Locking
  Decimals:   18 → 8 (trimming required)

── Risk Score ──
  Score:  15/100 (Low Risk)

  ✅ ONDO is a strong candidate for NTT migration via Sunrise.
     Recommended mode: Locking.
════════════════════════════════════════════════════════════
```

## List: Discover Migration Candidates

```
═══════════════════════════════════════════════════════════════════════════════
  Symbol   Decimals   Risk       Compatible   Mode       Status
───────────────────────────────────────────────────────────────────────────────
  ONDO     18         15/100     ✓            Locking    Not on Solana — strong candidate
  AAVE     18         15/100     ✓            Locking    Not on Solana — strong candidate
  UNI      18         18/100     ✓            Locking    Not on Solana — strong candidate
  LINK     18         18/100     ✓            Locking    Not on Solana — strong candidate
  COMP     18         10/100     ✓            Locking    Not on Solana — strong candidate
  USDC     6          23/100     ✓            Locking    Already on Solana (Native)
  USDT     6          23/100     ✓            Locking    Already on Solana (Wormhole)
═══════════════════════════════════════════════════════════════════════════════

  Found 5 tokens ready for migration to Solana via NTT.
  Run daybreak scan <address> for detailed analysis.
```

## Example Reports

See [examples/](examples/) for sample migration reports:
- [ONDO](examples/ondo/report.md) — Strong migration candidate (not yet on Solana)
- [AAVE](examples/aave/report.md) — DeFi governance token analysis

## Commands

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `list` | Discover migration-ready ERC-20 tokens (50+ curated) | `--chain`, `--limit`, `--json` |
| `scan` | Full token analysis with risk scoring | `--chain`, `--skip-holders`, `--json` |
| `report` | Generate migration report + NTT deployment config | `--chain`, `-o/--output`, `--skip-holders` |
| `compare` | Compare migration paths (NTT / Neon EVM / native) | `--chain`, `--json` |
| `deploy` | Deploy SPL token on Solana with Metaplex metadata | `--chain`, `--network`, `--keypair` |
| `check` | Pre-migration readiness checker | `--chain`, `--network`, `--keypair` |

**Global flags:** `--rpc-url` (custom RPC), `--etherscan-key` (holder data and volume-based rate limits)

## Architecture

```
src/
├── main.rs                # CLI entry point (clap)
├── cli.rs                 # CLI argument definitions
├── commands/
│   ├── scan.rs            # Full analysis with progress output
│   ├── report.rs          # Markdown + deployment.json generation
│   ├── compare.rs         # Migration path comparison
│   ├── deploy.rs          # SPL token deployment + Metaplex metadata
│   ├── check.rs           # Pre-migration readiness checker
│   └── list.rs            # Token discovery (50+ curated tokens)
├── analyzers/
│   ├── evm/               # Raw JSON-RPC calls, bytecode analysis
│   ├── bridges.rs         # Bridge detection (Jupiter, Wormhole)
│   ├── compatibility.rs   # NTT compatibility + mode recommendation
│   ├── holders.rs         # Holder distribution via Etherscan
│   └── volume.rs          # Transfer volume + rate limit calculator
├── solana/
│   └── deployer.rs        # SPL mint creation + Metaplex metadata
├── scoring/
│   └── risk.rs            # Composite risk score (0-100)
├── report/
│   ├── ntt_config.rs      # deployment.json + NTT CLI commands
│   ├── migration_plan.rs  # Step-by-step migration plan
│   └── comparison.rs      # Path comparison logic
├── types/                 # Shared types (Token, Analysis, Risk, etc.)
└── output/                # Terminal, Markdown, JSON formatters
```

## How It Works

1. **EVM RPC** — Fetches token metadata, bytecode, and capabilities via raw JSON-RPC calls (no ethers-rs)
2. **Bytecode analysis** — Detects proxy patterns, selfdestruct, fee-on-transfer, rebasing selectors
3. **Bridge detection** — Checks if the token already exists on Solana (Jupiter, native, Wormhole-wrapped)
4. **Risk scoring** — Scores 0-100 across decimals, features, complexity, holders, and bridge status
5. **NTT config** — Recommends locking/burning mode, generates `deployment.json` with rate limits and transceiver config
6. **SPL deployment** — Creates the token on Solana with correct decimals and Metaplex metadata

## Supported Chains

Ethereum, Polygon, BSC, Arbitrum, Base, Optimism, Avalanche

## Built With

Rust, [clap](https://docs.rs/clap), [tokio](https://tokio.rs), [reqwest](https://docs.rs/reqwest), [solana-sdk](https://docs.rs/solana-sdk), [mpl-token-metadata](https://docs.rs/mpl-token-metadata)

## Hackathon

Built for the **[Solana Graveyard Hackathon](https://solana.com/graveyard-hack)** — Sunrise track.

Bringing dead EVM tokens back to life on Solana.

## License

[MIT](LICENSE)
