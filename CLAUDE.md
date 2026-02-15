# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Daybreak is a Rust CLI that analyzes EVM tokens and generates migration reports for moving to Solana via Sunrise (Wormhole NTT). Three commands: `scan`, `report`, `compare`.

**Hackathon deadline: Feb 27, 2026**

## Commands

```bash
# Build
cargo build

# Scan — full token analysis with risk score and verdict
cargo run -- scan 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum
cargo run -- scan 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum --json

# Report — generate migration report and deployment.json
cargo run -- report 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum --output ./reports

# Compare — NTT vs Neon EVM vs native rewrite
cargo run -- compare 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum

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
├── main.rs                # CLI entry point (clap)
├── cli.rs                 # CLI argument definitions (scan, report, compare)
├── commands/
│   ├── scan.rs            # Scan command — full analysis with progress output
│   ├── report.rs          # Report command — markdown + deployment.json
│   └── compare.rs         # Compare command — migration path comparison
├── analyzers/
│   ├── evm/
│   │   ├── rpc.rs         # Raw JSON-RPC calls via reqwest
│   │   ├── token.rs       # Token metadata fetching
│   │   ├── bytecode.rs    # Bytecode analysis (proxy, fee, capabilities)
│   │   └── decoder.rs     # ABI decoding helpers
│   ├── bridges.rs         # Bridge detection (Jupiter, Wormhole)
│   ├── compatibility.rs   # NTT compatibility checks
│   ├── holders.rs         # Holder distribution via Etherscan
│   └── solana.rs          # Solana cost estimation
├── scoring/
│   └── risk.rs            # Composite risk score calculation
├── report/
│   ├── migration_plan.rs  # Migration steps, mode recommendations
│   ├── ntt_config.rs      # deployment.json generation, NTT CLI commands
│   ├── comparison.rs      # Path comparison logic
│   └── cost_estimate.rs   # SOL/gas cost estimation
├── types/
│   ├── token.rs           # TokenInfo, Chain, TokenCapabilities
│   ├── analysis.rs        # BytecodeAnalysis, RiskScore, HolderData
│   ├── compatibility.rs   # CompatibilityResult, BridgeStatus, NttMode
│   └── migration.rs       # MigrationPath, MigrationStep
└── output/
    ├── terminal.rs        # Colored terminal output with verdict
    ├── markdown.rs        # Markdown report generation
    └── json.rs            # JSON export
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
