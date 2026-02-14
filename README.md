# Daybreak

**Migration planning CLI for moving EVM tokens to Solana via [Sunrise](https://wormhole.com/products/ntt) (Wormhole NTT).**

![Rust](https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

Daybreak analyzes any ERC-20 token on-chain — bytecode, capabilities, proxy patterns, bridge status — and tells you exactly how to migrate it to Solana using Native Token Transfers. It scores risk, recommends NTT modes, and generates deployment configs.

## Quick Start

```bash
cargo install --path .

# Analyze a token
daybreak scan 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum

# Generate migration report + deployment config
daybreak report 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum -o ./output

# Compare migration paths (NTT vs Neon EVM vs native rewrite)
daybreak compare 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum
```

## Example Output

```
════════════════════════════════════════════════════════════
USD Coin (USDC) on Ethereum
════════════════════════════════════════════════════════════
── Token Information ──
  Address:      0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
  Decimals:     6
  Total Supply: 51280578956161361

── Capabilities ──
  Mintable           No
  Burnable           No
  Pausable           No
  Blacklist          No
  Permit (EIP-2612)  No
  Upgradeable        Yes

── Bytecode Analysis ──
  Size:         2186 bytes (Simple (<5KB))
  Is Proxy:     Yes
  ⚠ Has selfdestruct

── Bridge Status ──
  ! Token already exists on Solana
  Solana Address: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
  Bridge: Native

── NTT Compatibility ──
  Status:     Compatible
  Mode:       Locking
  Issues:
    [WARN] Self-destruct Capability
    [INFO] Upgradeable Proxy

── Risk Score ──
  Score:  23/100 (Low Risk)
  Components:
    Decimal handling:     0/20
    Token features:       3/25
    Bytecode complexity:  5/20
    Holder concentration: 0/15
    Bridge status:        15/20
```

## Commands

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `scan` | Full token analysis with risk scoring | `--chain`, `--skip-holders`, `--json` |
| `report` | Generate migration report + NTT deployment config | `--chain`, `-o/--output`, `--skip-holders` |
| `compare` | Compare migration paths (NTT / Neon EVM / native) | `--chain`, `--json` |

**Global flags:** `--rpc-url` (custom RPC), `--etherscan-key` (holder data)

## How It Works

1. **EVM RPC** — Fetches token metadata, bytecode, and capabilities via raw JSON-RPC calls
2. **Bytecode analysis** — Detects proxy patterns, selfdestruct, function selectors (mint/burn/pause/blacklist)
3. **Bridge detection** — Checks if the token already exists on Solana (Jupiter, native, Wormhole-wrapped)
4. **Risk scoring** — Scores 0-100 across decimals, features, complexity, holders, and bridge status
5. **NTT config** — Recommends locking/burning mode and generates `deployment.json` for NTT CLI

## Supported Chains

Ethereum, Polygon, BSC, Arbitrum, Base, Optimism, Avalanche

## Built With

Rust, [clap](https://docs.rs/clap), [tokio](https://tokio.rs), [reqwest](https://docs.rs/reqwest), [serde](https://serde.rs), [colored](https://docs.rs/colored)

## Hackathon

Built for the **Solana Graveyard Hackathon** — Sunrise track.

## License

[MIT](LICENSE)
