# Changelog

All notable changes to Daybreak will be documented in this file.

## [0.2.0] - 2026-02-15

### Added
- `list` command — discover migration-ready ERC-20 tokens with ranked table output
- `deploy` command — create SPL tokens on Solana devnet/mainnet matching EVM token specs
- Solana on-chain integration (solana-sdk, spl-token) for real token deployment
- Sunrise branding — "Next Steps" section in scan output with Sunrise links
- Pre-migration checklist in markdown reports
- Estimated costs table in migration reports (~0.5 SOL total)
- "Next Steps with Sunrise" section in reports linking to sunrise.wtf
- Example reports for ONDO and AAVE tokens (examples/ directory)
- Demo recording (demo.gif, demo.cast, demo.sh)
- RPC retry logic with exponential backoff (3 retries)

### Changed
- Switched default RPC from LlamaRPC to PublicNode (more reliable)
- Fixed hardcoded decimals bug in terminal output (now shows actual token decimals)
- Terminal verdict now shows actionable next steps for compatible tokens
- Markdown reports now include cost estimates, checklist, and Sunrise section

### Removed
- Unused `SolanaChecker` module (replaced by `deploy` command)
- Unused `CostEstimator` module (replaced by inline cost table in reports)
- Dead code: unused methods, structs, and imports across codebase

### Fixed
- All compiler warnings eliminated (was 16)
- All clippy warnings fixed (was 5)
- Identical if-else branches in NTT config generation
- Useless `format!()` wrapper in markdown output

## [0.1.0] - 2026-02-14

### Added
- Initial release with `scan`, `report`, and `compare` commands
- EVM bytecode analysis (proxy detection, selfdestruct, fee patterns)
- Token capability detection (mint, burn, pause, blacklist, permit)
- NTT compatibility checking with mode recommendation
- Risk scoring system (0-100 across 5 dimensions)
- Bridge detection (Jupiter, Wormhole, native Solana)
- Markdown report generation with deployment.json
- Multi-chain support (Ethereum, Polygon, BSC, Arbitrum, Base, Optimism, Avalanche)
