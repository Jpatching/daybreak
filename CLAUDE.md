# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Daybreak is a Rust CLI that analyzes EVM tokens and generates migration reports for moving to Solana via Sunrise (Wormhole NTT). Three commands: `analyze`, `check`, `report`.

**Hackathon deadline: Feb 27, 2026**

## Commands

```bash
# Build
cargo build

# Run
cargo run -- analyze 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum
cargo run -- check 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum
cargo run -- report 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum --output report.md

# Test
cargo test
cargo test <test_name>

# Check without building
cargo check

# Format and lint
cargo fmt
cargo clippy
```

## Architecture

```
src/
├── main.rs              # CLI entry point (clap)
├── cli.rs               # CLI argument definitions
├── types.rs             # Shared types (TokenInfo, CompatibilityResult, MigrationReport)
├── analyzer/
│   ├── evm.rs           # EVM token analysis via JSON-RPC (no ethers-rs)
│   ├── solana.rs        # Solana checks (Jupiter API, rent costs)
│   └── compatibility.rs # NTT compatibility checks
├── report/
│   ├── migration_plan.rs # Migration steps, mode recommendations
│   ├── ntt_config.rs     # deployment.json generation, NTT CLI commands
│   └── cost_estimate.rs  # SOL/gas cost estimation
└── output/
    ├── terminal.rs      # Colored terminal output
    ├── markdown.rs      # Markdown report generation
    └── json.rs          # JSON export
```

## Code Style

- Use `anyhow::Result` for all error handling
- Use `#[derive(Debug, Clone, Serialize, Deserialize)]` on all types
- Use `async fn` with tokio for network calls
- EVM interaction: raw JSON-RPC calls via reqwest (NOT ethers-rs)
- Add comments explaining WHY, not WHAT

## Key Technical Details

**EVM function selectors:**
- `name()` → `0x06fdde03`
- `symbol()` → `0x95d89b41`
- `decimals()` → `0x313ce567`
- `totalSupply()` → `0x18160ddd`
- `burn(uint256)` → `0x42966c68`
- `paused()` → `0x5c975abb`

**NTT mode pairing:** If source chain is LOCKING, destination MUST be BURNING.

**Decimal trimming:** NTT caps at 8 decimals. Amounts with >8 decimals get trimmed.

**SPL token decimals:** Max 9 (not 18 like ERC-20).

## Reference Docs

See `DOCS/` folder:
- `daybreak-project-brief.md` — features and requirements
- `daybreak-technical-reference.md` — NTT internals, EVM RPC patterns, Solana checks
- `daybreak-build-plan.md` — day-by-day build plan
